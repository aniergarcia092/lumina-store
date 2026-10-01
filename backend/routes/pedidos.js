import { Router } from "express";
import { db, parseJSON } from "../database.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const validStates = ["pendiente", "confirmado", "enviado", "entregado", "cancelado"];
const validPayments = ["efectivo", "transferencia", "whatsapp"];

/* =========================================================
   GET /api/pedidos (admin)
========================================================= */
router.get("/", requireAuth, async (req, res) => {
  try {
    let sql = "SELECT * FROM pedidos", args = [];
    if (req.query.estado) {
      sql += " WHERE estado=?";
      args.push(req.query.estado);
    }
    sql += " ORDER BY creado_en DESC";
    const r = await db.execute({ sql, args });
    res.json(r.rows.map(x => ({ ...x, items: parseJSON(x.items) })));
  } catch (e) {
    console.error("Error en GET /pedidos:", e.message);
    res.status(500).json({ error: "No se pudieron cargar los pedidos" });
  }
});

/* =========================================================
   GET /api/pedidos/stats/dashboard (admin)
   ⚠️ Va ANTES de /:id para que no lo confunda
========================================================= */
router.get("/stats/dashboard", requireAuth, async (req, res) => {
  try {
    const [p, o, pend, sales, out] = await Promise.all([
      db.execute("SELECT COUNT(*) total FROM productos"),
      db.execute("SELECT COUNT(*) total FROM pedidos"),
      db.execute("SELECT COUNT(*) total FROM pedidos WHERE estado='pendiente'"),
      db.execute("SELECT COALESCE(SUM(total),0) total FROM pedidos WHERE estado!='cancelado' AND strftime('%Y-%m',creado_en)=strftime('%Y-%m','now')"),
      db.execute("SELECT COUNT(*) total FROM productos WHERE stock<=0")
    ]);

    const chart = await db.execute(`
      SELECT substr(creado_en,1,10) dia, COALESCE(SUM(total),0) total
      FROM pedidos
      WHERE estado!='cancelado' AND creado_en>=datetime('now','-29 day')
      GROUP BY substr(creado_en,1,10)
      ORDER BY dia
    `);

    res.json({
      productos: Number(p.rows[0].total),
      pedidos: Number(o.rows[0].total),
      pendientes: Number(pend.rows[0].total),
      ventasMes: Number(sales.rows[0].total),
      sinStock: Number(out.rows[0].total),
      ventasDiarias: chart.rows
    });
  } catch (e) {
    console.error("Error en GET /pedidos/stats/dashboard:", e.message);
    res.status(500).json({ error: "No se pudieron cargar estadísticas" });
  }
});

/* =========================================================
   GET /api/pedidos/:id (admin)
========================================================= */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const r = await db.execute({
      sql: "SELECT * FROM pedidos WHERE id=?",
      args: [Number(req.params.id)]
    });
    if (!r.rows.length) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }
    res.json({ ...r.rows[0], items: parseJSON(r.rows[0].items) });
  } catch (e) {
    console.error("Error en GET /pedidos/:id:", e.message);
    res.status(500).json({ error: "No se pudo cargar el pedido" });
  }
});

/* =========================================================
   POST /api/pedidos (público — cliente hace checkout)
========================================================= */
router.post("/", async (req, res) => {
  try {
    const {
      nombre_cliente,
      telefono,
      email = "",
      direccion = "",
      ciudad = "",
      notas = "",
      items = [],
      envio = 0,
      moneda = "USD",
      metodo_pago = "whatsapp"
    } = req.body || {};

    if (!nombre_cliente || !telefono || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: "Completa nombre, teléfono y carrito" });
    }

    if (!validPayments.includes(metodo_pago)) {
      return res.status(400).json({ error: "Método de pago no válido" });
    }

    // Revalidar precios y stock en servidor
    const cleanItems = [];
    let serverSubtotal = 0;

    for (const item of items) {
      const id = Number(item.id);
      const qty = Math.max(1, Number.parseInt(item.cantidad || 1, 10));

      const pr = await db.execute({
        sql: "SELECT id,nombre,precio,precio_oferta,moneda,stock,imagenes FROM productos WHERE id=? AND activo=1",
        args: [id]
      });

      if (!pr.rows.length) {
        return res.status(400).json({ error: `Producto ${id} no disponible` });
      }

      const p = pr.rows[0];
      if (p.stock < qty) {
        return res.status(409).json({ error: `Stock insuficiente para ${p.nombre}` });
      }

      const unit = Number(p.precio_oferta ?? p.precio);
      serverSubtotal += unit * qty;

      cleanItems.push({
        id,
        nombre: p.nombre,
        cantidad: qty,
        precio: unit,
        moneda: p.moneda,
        imagenes: parseJSON(p.imagenes),
        talla: item.talla || "",
        color: item.color || ""
      });
    }

    const finalEnvio = Number(envio) || 0;
    const finalTotal = serverSubtotal + finalEnvio;
    const codigo = `PED-${Date.now().toString().slice(-8)}`;

    // ✅ batch SIN isolationLevel
    const statements = [
      {
        sql: `INSERT INTO pedidos 
              (codigo,nombre_cliente,telefono,email,direccion,ciudad,notas,items,
               subtotal,envio,total,moneda,estado,metodo_pago) 
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [
          codigo,
          nombre_cliente,
          telefono,
          email,
          direccion,
          ciudad,
          notas,
          JSON.stringify(cleanItems),
          serverSubtotal,
          finalEnvio,
          finalTotal,
          moneda,
          "pendiente",
          metodo_pago
        ]
      },
      ...cleanItems.map(i => ({
        sql: "UPDATE productos SET stock=stock-? WHERE id=? AND stock>=?",
        args: [i.cantidad, i.id, i.cantidad]
      }))
    ];

    await db.batch(statements);   // ✅ Sin segundo argumento

    res.status(201).json({
      ok: true,
      codigo,
      subtotal: serverSubtotal,
      envio: finalEnvio,
      total: finalTotal,
      moneda
    });
  } catch (e) {
    console.error("Error en POST /pedidos:", e.message);
    res.status(500).json({
      error: "No se pudo registrar el pedido",
      detail: e.message
    });
  }
});

/* =========================================================
   PATCH /api/pedidos/:id/estado (admin)
========================================================= */
router.patch("/:id/estado", requireAuth, async (req, res) => {
  try {
    if (!validStates.includes(req.body.estado)) {
      return res.status(400).json({ error: "Estado no válido" });
    }
    await db.execute({
      sql: "UPDATE pedidos SET estado=?,actualizado_en=CURRENT_TIMESTAMP WHERE id=?",
      args: [req.body.estado, Number(req.params.id)]
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("Error en PATCH /pedidos/:id/estado:", e.message);
    res.status(500).json({ error: "No se pudo cambiar el estado" });
  }
});

/* =========================================================
   DELETE /api/pedidos/:id (admin)
========================================================= */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await db.execute({
      sql: "DELETE FROM pedidos WHERE id=?",
      args: [Number(req.params.id)]
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("Error en DELETE /pedidos:", e.message);
    res.status(500).json({ error: "No se pudo eliminar el pedido" });
  }
});

export default router;
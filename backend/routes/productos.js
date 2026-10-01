import { Router } from "express";
import { db, serializeProduct } from "../database.js";
import { requireAuth } from "../middleware/auth.js";
import cloudinary from "../utils/cloudinary.js";
import multer from "multer";
import { CloudinaryStorage } from "@fluidjs/multer-cloudinary";

const router = Router();

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "tienda-online/productos",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "avif"],
    resource_type: "image"
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 8 }
});

const parseArray = (v) =>
  Array.isArray(v)
    ? v
    : typeof v === "string"
      ? (() => {
          try {
            return JSON.parse(v);
          } catch {
            return v.split(",").map(x => x.trim()).filter(Boolean);
          }
        })()
      : [];

const cleanProduct = (b) => ({
  nombre: String(b.nombre || "").trim(),
  descripcion_corta: String(b.descripcion_corta || "").trim(),
  descripcion_larga: String(b.descripcion_larga || "").trim(),
  precio: Number(b.precio || 0),
  precio_oferta:
    b.precio_oferta === "" || b.precio_oferta == null
      ? null
      : Number(b.precio_oferta),
  moneda: String(b.moneda || "USD").toUpperCase(),
  stock: Math.max(0, Number.parseInt(b.stock || 0, 10)),
  categoria_id: b.categoria_id ? Number(b.categoria_id) : null,
  marca: String(b.marca || "").trim(),
  tallas: JSON.stringify(parseArray(b.tallas)),
  colores: JSON.stringify(parseArray(b.colores)),
  destacado:
    b.destacado === true || b.destacado === "true" || b.destacado === "1" ? 1 : 0,
  activo:
    b.activo === false || b.activo === "false" || b.activo === "0" ? 0 : 1
});

/* =========================================================
   GET /api/productos
========================================================= */
router.get("/", async (req, res) => {
  try {
    const { categoria, q, min, max, stock, destacado, sort = "newest", admin } = req.query;

    let sql = `SELECT p.*, c.nombre AS categoria_nombre 
               FROM productos p 
               LEFT JOIN categorias c ON c.id=p.categoria_id`;

    const where = [];
    const args = [];

    if (admin !== "1") where.push("p.activo=1");

    if (categoria) {
      where.push("p.categoria_id=?");
      args.push(Number(categoria));
    }

    if (q) {
      where.push("(LOWER(p.nombre) LIKE ? OR LOWER(p.descripcion_corta) LIKE ?)");
      args.push(`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`);
    }

    if (min !== "undefined" && min !== undefined && min !== "") {
      where.push("COALESCE(p.precio_oferta,p.precio)>=?");
      args.push(Number(min));
    }

    if (max !== "undefined" && max !== undefined && max !== "") {
      where.push("COALESCE(p.precio_oferta,p.precio)<=?");
      args.push(Number(max));
    }

    if (stock === "in") where.push("p.stock>0");
    if (stock === "out") where.push("p.stock=0");
    if (destacado === "1") where.push("p.destacado=1");

    if (where.length) sql += " WHERE " + where.join(" AND ");

    const sorts = {
      newest: "p.creado_en DESC",
      price_asc: "COALESCE(p.precio_oferta,p.precio) ASC",
      price_desc: "COALESCE(p.precio_oferta,p.precio) DESC",
      name: "p.nombre ASC",
      stock: "p.stock DESC"
    };

    sql += " ORDER BY " + (sorts[sort] || sorts.newest);

    const result = await db.execute({ sql, args });
    res.json(result.rows.map(serializeProduct));
  } catch (e) {
    console.error("Error en GET /productos:", e.message);
    res.status(500).json({ error: "No se pudieron cargar los productos" });
  }
});

/* =========================================================
   GET /api/productos/:id
========================================================= */
router.get("/:id", async (req, res) => {
  try {
    const r = await db.execute({
      sql: `SELECT p.*, c.nombre AS categoria_nombre 
            FROM productos p 
            LEFT JOIN categorias c ON c.id=p.categoria_id 
            WHERE p.id=?`,
      args: [Number(req.params.id)]
    });

    if (!r.rows.length) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json(serializeProduct(r.rows[0]));
  } catch {
    res.status(500).json({ error: "Error al cargar el producto" });
  }
});

/* =========================================================
   POST /api/productos (admin)
========================================================= */
router.post("/", requireAuth, upload.array("imagenes", 8), async (req, res) => {
  try {
    const p = cleanProduct(req.body);

    if (!p.nombre || !Number.isFinite(p.precio)) {
      return res.status(400).json({ error: "Nombre y precio son obligatorios" });
    }

    const imagenes = (req.files || []).map(f => f.path);
    const manual = parseArray(req.body.imagenes_urls);   // ✅ Cambio: imagenes_urls
    const all = [...manual, ...imagenes];

    const r = await db.execute({
      sql: `INSERT INTO productos 
            (nombre,descripcion_corta,descripcion_larga,precio,precio_oferta,moneda,
             stock,categoria_id,marca,tallas,colores,imagenes,destacado,activo) 
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        p.nombre,
        p.descripcion_corta,
        p.descripcion_larga,
        p.precio,
        p.precio_oferta,
        p.moneda,
        p.stock,
        p.categoria_id,
        p.marca,
        p.tallas,
        p.colores,
        JSON.stringify(all),
        p.destacado,
        p.activo
      ]
    });

    res.status(201).json({ id: Number(r.lastInsertRowid), imagenes: all });
  } catch (e) {
    console.error("Error en POST /productos:", e.message);
    res.status(500).json({ error: "No se pudo crear el producto", detail: e.message });
  }
});

/* =========================================================
   PUT /api/productos/:id (admin)
========================================================= */
router.put("/:id", requireAuth, upload.array("imagenes", 8), async (req, res) => {
  try {
    const id = Number(req.params.id);

    const old = await db.execute({
      sql: "SELECT imagenes FROM productos WHERE id=?",
      args: [id]
    });

    if (!old.rows.length) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    const p = cleanProduct(req.body);

    let imgs = parseArray(req.body.imagenes_urls);   // ✅ Cambio: imagenes_urls

    if (req.body.reemplazar_imagenes !== "true") {
      imgs = [...parseArray(old.rows[0].imagenes), ...imgs];
    }

    imgs = [...imgs, ...(req.files || []).map(f => f.path)];

    await db.execute({
      sql: `UPDATE productos 
            SET nombre=?,descripcion_corta=?,descripcion_larga=?,precio=?,precio_oferta=?,
                moneda=?,stock=?,categoria_id=?,marca=?,tallas=?,colores=?,imagenes=?,
                destacado=?,activo=? 
            WHERE id=?`,
      args: [
        p.nombre,
        p.descripcion_corta,
        p.descripcion_larga,
        p.precio,
        p.precio_oferta,
        p.moneda,
        p.stock,
        p.categoria_id,
        p.marca,
        p.tallas,
        p.colores,
        JSON.stringify([...new Set(imgs)]),
        p.destacado,
        p.activo,
        id
      ]
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("Error en PUT /productos:", e.message);
    res.status(500).json({ error: "No se pudo actualizar el producto", detail: e.message });
  }
});

/* =========================================================
   DELETE /api/productos/:id (admin)
========================================================= */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await db.execute({
      sql: "DELETE FROM productos WHERE id=?",
      args: [Number(req.params.id)]
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "No se pudo eliminar el producto" });
  }
});

export default router;
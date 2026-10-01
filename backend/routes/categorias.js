import { Router } from "express";
import { db } from "../database.js";
import { requireAuth } from "../middleware/auth.js";
import cloudinary from "../utils/cloudinary.js";
import multer from "multer";
import { CloudinaryStorage } from "@fluidjs/multer-cloudinary";

const router = Router();

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "tienda-online/categorias",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "avif"],
    resource_type: "image"
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 }
});

router.get("/", async (req, res) => {
  try {
    const admin = req.query.admin === "1";
    const r = await db.execute(
      `SELECT * FROM categorias ${admin ? "" : "WHERE activa=1"} ORDER BY orden ASC, nombre ASC`
    );
    res.json(r.rows.map(x => ({ ...x, activa: Boolean(x.activa) })));
  } catch {
    res.status(500).json({ error: "No se pudieron cargar las categorías" });
  }
});

router.post("/", requireAuth, upload.single("imagen"), async (req, res) => {
  try {
    const nombre = String(req.body.nombre || "").trim();
    const slug = String(req.body.slug || nombre)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    if (!nombre) return res.status(400).json({ error: "El nombre es obligatorio" });

    await db.execute({
      sql: "INSERT INTO categorias (nombre,slug,descripcion,imagen_url,orden,activa) VALUES (?,?,?,?,?,?)",
      args: [
        nombre,
        slug,
        String(req.body.descripcion || ""),
        req.file?.path || String(req.body.imagen_url || ""),
        Number(req.body.orden || 0),
        req.body.activa === "0" ? 0 : 1
      ]
    });

    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: "No se pudo crear la categoría", detail: e.message });
  }
});

router.put("/:id", requireAuth, upload.single("imagen"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const nombre = String(req.body.nombre || "").trim();

    const slug = String(req.body.slug || nombre)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const old = await db.execute({
      sql: "SELECT imagen_url FROM categorias WHERE id=?",
      args: [id]
    });

    if (!old.rows.length) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }

    await db.execute({
      sql: "UPDATE categorias SET nombre=?,slug=?,descripcion=?,imagen_url=?,orden=?,activa=? WHERE id=?",
      args: [
        nombre,
        slug,
        String(req.body.descripcion || ""),
        req.file?.path || String(req.body.imagen_url ?? old.rows[0].imagen_url ?? ""),
        Number(req.body.orden || 0),
        req.body.activa === "0" ? 0 : 1,
        id
      ]
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: "No se pudo actualizar la categoría", detail: e.message });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await db.execute({
      sql: "DELETE FROM categorias WHERE id=?",
      args: [Number(req.params.id)]
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "No se pudo eliminar la categoría" });
  }
});

export default router;
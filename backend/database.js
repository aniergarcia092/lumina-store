import { createClient } from "@libsql/client";
import "dotenv/config";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) throw new Error("Falta TURSO_DATABASE_URL en .env");

export const db = createClient({ url, authToken });

export async function initDB() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      descripcion TEXT DEFAULT '',
      imagen_url TEXT DEFAULT '',
      orden INTEGER DEFAULT 0,
      activa INTEGER DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion_corta TEXT DEFAULT '',
      descripcion_larga TEXT DEFAULT '',
      precio REAL NOT NULL DEFAULT 0,
      precio_oferta REAL,
      moneda TEXT NOT NULL DEFAULT 'USD',
      stock INTEGER NOT NULL DEFAULT 0,
      categoria_id INTEGER,
      marca TEXT DEFAULT '',
      tallas TEXT DEFAULT '[]',
      colores TEXT DEFAULT '[]',
      imagenes TEXT DEFAULT '[]',
      destacado INTEGER DEFAULT 0,
      activo INTEGER DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      nombre_cliente TEXT NOT NULL,
      telefono TEXT NOT NULL,
      email TEXT DEFAULT '',
      direccion TEXT DEFAULT '',
      ciudad TEXT DEFAULT '',
      notas TEXT DEFAULT '',
      items TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      envio REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      moneda TEXT NOT NULL DEFAULT 'USD',
      estado TEXT NOT NULL DEFAULT 'pendiente',
      metodo_pago TEXT NOT NULL DEFAULT 'whatsapp',
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS contenido (
      clave TEXT PRIMARY KEY,
      valor TEXT DEFAULT '',
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS mensajes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      telefono TEXT DEFAULT '',
      mensaje TEXT NOT NULL,
      leido INTEGER DEFAULT 0,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id)`,
    `CREATE INDEX IF NOT EXISTS idx_productos_activo ON productos(activo)`,
    `CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado)`
  ];

  for (const sql of statements) await db.execute(sql);

  const defaults = {
    negocio_nombre: "LUMINA STORE",
    hero_titulo: "Tu estilo. Tu tecnología. Tu mundo.",
    hero_subtitulo: "Descubre productos seleccionados para cada momento, con una experiencia de compra simple y elegante.",
    hero_boton: "Comprar ahora",
    contacto_telefono: "",
    contacto_email: "",
    contacto_direccion: "",
    whatsapp: "",
    instagram: "",
    logo: "",
    color_acento: "#d8ad70",
    envio_base: "0",
    moneda: "USD"
  };

  for (const [clave, valor] of Object.entries(defaults)) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO contenido (clave, valor) VALUES (?, ?)`,
      args: [clave, valor]
    });
  }

  const catCount = await db.execute("SELECT COUNT(*) AS total FROM categorias");
  if (Number(catCount.rows[0].total) === 0) {
    const seed = [
      ["Ropa de mujer","ropa-mujer","Camisas, vestidos y prendas seleccionadas.",1],
      ["Ropa de hombre","ropa-hombre","Estilo diario y prendas esenciales.",2],
      ["Calzado","calzado","Calzado para diferentes ocasiones.",3],
      ["Tecnología","tecnologia","Celulares, accesorios y gadgets.",4],
      ["Infantil","infantil","Productos para los más pequeños.",5]
    ];
    for (const [nombre, slug, descripcion, orden] of seed) {
      await db.execute({
        sql:"INSERT INTO categorias (nombre,slug,descripcion,orden,activa) VALUES (?,?,?,?,1)",
        args:[nombre,slug,descripcion,orden]
      });
    }
  }
}

export function parseJSON(value, fallback=[]) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

export function serializeProduct(row) {
  if (!row) return null;
  return {
    ...row,
    tallas: parseJSON(row.tallas),
    colores: parseJSON(row.colores),
    imagenes: parseJSON(row.imagenes),
    destacado: Boolean(row.destacado),
    activo: Boolean(row.activo)
  };
}

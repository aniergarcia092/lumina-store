import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import "dotenv/config";
import { initDB } from "./database.js";
import auth from "./routes/auth.js";
import productos from "./routes/productos.js";
import categorias from "./routes/categorias.js";
import pedidos from "./routes/pedidos.js";
import contenido from "./routes/contenido.js";
import mensajes from "./routes/mensajes.js";

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Orígenes permitidos (Frontend + localhost)
const origins = (process.env.FRONTEND_URL || "http://localhost:5500,http://127.0.0.1:5500")
  .split(",")
  .map(x => x.trim());

app.set("trust proxy", 1);

// ✅ CORS bien configurado para Express 5
app.use(cors({
  origin: (origin, cb) => {
    // Permitir peticiones sin origin (Postman, curl, mismo servidor)
    if (!origin) return cb(null, true);

    // Si está en la lista de orígenes permitidos
    if (origins.includes("*") || origins.includes(origin)) {
      return cb(null, true);
    }

    // En desarrollo, permitir cualquier localhost/127.0.0.1
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return cb(null, true);
    }

    console.warn("❌ CORS bloqueado para origen:", origin);
    cb(new Error("Origen no permitido por CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// ✅ Responder a preflight OPTIONS

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false
}));

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "tienda-online",
    time: new Date().toISOString()
  });
});

// Rutas
app.use("/api/auth", auth);
app.use("/api/productos", productos);
app.use("/api/categorias", categorias);
app.use("/api/pedidos", pedidos);
app.use("/api/contenido", contenido);
app.use("/api/mensajes", mensajes);

// Manejo de errores
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  res.status(err.status || 500).json({
    error: err.message || "Error interno del servidor"
  });
});

// Arrancar servidor
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Base de datos Turso lista`);
      console.log(`✅ Backend corriendo en http://localhost:${PORT}`);
      console.log(`✅ CORS permitido para: ${origins.join(", ")}`);
    });
  })
  .catch(err => {
    console.error("❌ No se pudo inicializar la base de datos:", err);
    process.exit(1);
  });
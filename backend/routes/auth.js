import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";

const router = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

router.post("/login", loginLimiter, async (req,res) => {
  try {
    const { usuario, password } = req.body || {};
    if (!usuario || !password) return res.status(400).json({error:"Usuario y contraseña son obligatorios"});
    if (usuario !== process.env.ADMIN_USER) return res.status(401).json({error:"Credenciales inválidas"});
    const ok = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH || "");
    if (!ok) return res.status(401).json({error:"Credenciales inválidas"});
    const token = jwt.sign({ usuario, rol:"admin" }, process.env.JWT_SECRET, { expiresIn:"7d" });
    res.json({ token, usuario });
  } catch (e) {
    res.status(500).json({error:"No se pudo iniciar sesión"});
  }
});

export default router;

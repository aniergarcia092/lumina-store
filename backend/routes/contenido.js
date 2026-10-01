import { Router } from "express";
import { db } from "../database.js";
import { requireAuth } from "../middleware/auth.js";
const router=Router();

router.get("/",async(req,res)=>{
  try{
    const r=await db.execute("SELECT clave,valor FROM contenido");
    res.json(Object.fromEntries(r.rows.map(x=>[x.clave,x.valor])));
  }catch{res.status(500).json({error:"No se pudo cargar el contenido"})}
});

router.put("/",requireAuth,async(req,res)=>{
  try{
    const entries=Object.entries(req.body||{});
    for(const [clave,valor] of entries){
      if(!/^[a-zA-Z0-9_]+$/.test(clave))continue;
      await db.execute({sql:"INSERT INTO contenido (clave,valor,actualizado_en) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor,actualizado_en=CURRENT_TIMESTAMP",args:[clave,String(valor??"")]});
    }
    res.json({ok:true});
  }catch{res.status(500).json({error:"No se pudo guardar el contenido"})}
});
export default router;

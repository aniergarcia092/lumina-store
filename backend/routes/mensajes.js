import { Router } from "express";
import { db } from "../database.js";
import { requireAuth } from "../middleware/auth.js";
const router=Router();

router.post("/",async(req,res)=>{
  try{
    const {nombre,telefono="",mensaje}=req.body||{};
    if(!nombre||!mensaje)return res.status(400).json({error:"Nombre y mensaje son obligatorios"});
    await db.execute({sql:"INSERT INTO mensajes (nombre,telefono,mensaje) VALUES (?,?,?)",args:[nombre,telefono,mensaje]});
    res.status(201).json({ok:true});
  }catch{res.status(500).json({error:"No se pudo enviar el mensaje"})}
});
router.get("/",requireAuth,async(req,res)=>{
  try{const r=await db.execute("SELECT * FROM mensajes ORDER BY creado_en DESC");res.json(r.rows.map(x=>({...x,leido:Boolean(x.leido)})))}catch{res.status(500).json({error:"No se pudieron cargar los mensajes"})}
});
router.patch("/:id/leido",requireAuth,async(req,res)=>{
  try{await db.execute({sql:"UPDATE mensajes SET leido=1 WHERE id=?",args:[Number(req.params.id)]});res.json({ok:true})}catch{res.status(500).json({error:"No se pudo marcar el mensaje"})}
});
router.delete("/:id",requireAuth,async(req,res)=>{
  try{await db.execute({sql:"DELETE FROM mensajes WHERE id=?",args:[Number(req.params.id)]});res.json({ok:true})}catch{res.status(500).json({error:"No se pudo eliminar el mensaje"})}
});
export default router;

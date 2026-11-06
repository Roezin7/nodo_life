import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import webpush from 'web-push';
import { rateLimit } from 'express-rate-limit';
import type { Express } from 'express';
export function bridge(op:string,params:Record<string,unknown>={}):Promise<any>{
 return new Promise((ok,fail)=>{
  const c=spawn(process.env.PYTHON || 'python3',[resolve('web_bridge.py')],{stdio:['pipe','pipe','ignore'],env:process.env});let raw='';let done=false;
  const end=(err?:Error,data?:unknown)=>{if(done)return;done=true;clearTimeout(timer);err?fail(err):ok(data)};
  const timer=setTimeout(()=>{c.kill('SIGKILL');end(Error('No se pudo consultar el canal de avisos.'))},15000);
  c.stdout.on('data',(b:Buffer)=>{raw+=b.toString();if(raw.length>1000000){c.kill();end(Error('Respuesta excesiva'))}});
  c.on('error',()=>end(Error('Canal temporalmente no disponible')));
  c.on('close',()=>{try{const r=JSON.parse(raw);if(!r.ok)throw Error(r.error);end(undefined,r.data)}catch{end(Error('No se pudo procesar el canal de avisos.'))}});
  c.stdin.end(JSON.stringify({op,params}));
 });
}
function config():{publicKey:string,privateKey:string,subject:string}|null{
 try {const c=JSON.parse(readFileSync(process.env.PUSH_VAPID_FILE || '/data/push-vapid.json','utf8'));if(!c.publicKey||!c.privateKey||!c.subject)return null;return c}catch{return null}
}
export function pushReceiptRoute(app:Express){
 app.post('/api/push/receipt',rateLimit({windowMs:60000,limit:60,legacyHeaders:false}),async(req,res)=>{try{const p=req.body;await bridge('push.receipt',{delivery_id:p.delivery_id,token:p.token,kind:p.kind});res.json({recorded:true})}catch{res.status(400).json({error:'Recibo inválido'})}});
}
export function pushRoutes(app:Express){
 app.get('/api/push/status',async(req,res)=>{try{const c=config();res.json({...await bridge('push.status',req.query.device_id?{device_id:req.query.device_id}:{}),configured:!!c,public_key:c?.publicKey??null})}catch{res.status(400).json({error:'No se pudo leer el estado de avisos'})}});
 app.post('/api/push/subscribe',async(req,res)=>{try{if(!config())throw Error();res.json(await bridge('push.subscribe',{subscription:req.body.subscription}))}catch{res.status(400).json({error:'No se pudo registrar este dispositivo'})}});
 app.post('/api/push/unsubscribe',async(req,res)=>{try{res.json(await bridge('push.unsubscribe',{device_id:req.body.device_id}))}catch{res.status(400).json({error:'No se pudo desactivar este dispositivo'})}});
 app.post('/api/push/test',async(req,res)=>{try{res.json(await bridge('push.test',{device_id:req.body.device_id,request_id:req.body.request_id}))}catch{res.status(400).json({error:'Activa los avisos en este dispositivo antes de probar'})}});
}
export function startPushSender(){
 let busy=false;
 const run=async()=>{
  if(busy)return;const c=config();if(!c)return;busy=true;
  try{
   const batch=await bridge('push.batch');
   for(const d of batch.deliveries){
    let code=0;
    try{const result=await webpush.sendNotification(d.subscription,JSON.stringify({title:d.is_test?'Nodo · Prueba de aviso':'Nodo · Tienes un aviso',body:d.is_test?'Si ves este mensaje en tu iPhone, la prueba llegó. Abre Nodo para confirmar.':'Abre Avisos para consultar tu recordatorio o resultado pendiente.',delivery_id:d.id,receipt_token:d.receipt_token}),{vapidDetails:c,TTL:300,timeout:10000,urgency:'normal',topic:d.id.replaceAll('-','').slice(0,32)});code=result.statusCode}
    catch(e){const n=(e as {statusCode?:number}).statusCode;code=typeof n==='number'?n:0}
    await bridge('push.result',{delivery_id:d.id,code});
   }
  }catch{console.warn('Nodo push: ciclo pendiente; se reintentará sin mostrar datos privados.')}finally{busy=false}
 };
 setInterval(()=>void run(),20000).unref();setTimeout(()=>void run(),5000).unref();
}

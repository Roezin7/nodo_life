import {useEffect,useState,useRef} from 'react';
import {api} from './api';
type Status={configured:boolean,public_key:string|null,active_devices:number,this_device_active:boolean|null,attempts_by_state:Record<string,number>,browser_display_reports:number};
const key='nodo-push-device';
function decode(v:string){const raw=atob(v.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-v.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
export default function PushSetup(){
 const [status,setStatus]=useState<Status|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [permission,setPermission]=useState(typeof Notification==='undefined'?'unsupported':Notification.permission);
 const [device,setDevice]=useState(localStorage.getItem(key));const testKey=useRef<string|null>(null);
 const supported=typeof Notification!=='undefined'&&'serviceWorker'in navigator&&'PushManager'in window;
 const ios=/iPhone|iPad|iPod/.test(navigator.userAgent);
 const standalone=window.matchMedia('(display-mode: standalone)').matches || !!(navigator as Navigator&{standalone?:boolean}).standalone;
 async function load(){try{setStatus(await api<Status>('/push/status'+(device?'?device_id='+encodeURIComponent(device):'')))}catch(e){setError((e as Error).message)}}
 useEffect(()=>{void load();const timer=setInterval(()=>void load(),20000);return()=>clearInterval(timer)},[device]);
 async function enable(){
  setBusy(true);setError('');setMessage('');
  try{
   // Invoke directly from the user's click, before network awaits.
   const p=await Notification.requestPermission();setPermission(p);if(p!=='granted')throw Error('El permiso no fue concedido. Puedes revisarlo en los ajustes de notificaciones de Nodo.');
   const s=await api<Status>('/push/status');if(!s.public_key)throw Error('El servidor aún no está preparado.');
   const r=await Promise.race([navigator.serviceWorker.ready,new Promise<never>((_,fail)=>setTimeout(()=>fail(Error('Cierra y abre Nodo para actualizar su servicio de avisos.')),15000))]);
   let subscription=await r.pushManager.getSubscription();
   if(!subscription)subscription=await r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decode(s.public_key)});
   const result=await api<{device_id:string}>('/push/subscribe',{method:'POST',body:{subscription:subscription.toJSON()}});
   localStorage.setItem(key,result.device_id);setDevice(result.device_id);setMessage('Dispositivo registrado. Envía una prueba para comprobar que llega.');
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function test(){if(!device)return;setBusy(true);setError('');try{testKey.current ||= crypto.randomUUID();await api('/push/test',{method:'POST',body:{device_id:device,request_id:testKey.current}});testKey.current=null;setMessage('Prueba en cola. El servidor la enviará en unos segundos; comprueba el iPhone.');await load()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function disable(){if(!device)return;setBusy(true);setError('');try{await api('/push/unsubscribe',{method:'POST',body:{device_id:device}});const r=await navigator.serviceWorker.ready;await(await r.pushManager.getSubscription())?.unsubscribe();localStorage.removeItem(key);setDevice(null);setMessage('Avisos desactivados para este dispositivo.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <section className="card"><h2>Avisos en tu iPhone</h2>
 <p>Recibe un aviso y toca la notificación para abrir esta bandeja. Los detalles personales se consultan dentro de Nodo.</p>
 {ios&&!standalone&&<p><strong>Abre Nodo desde su icono de la pantalla de inicio.</strong> Si aún no lo tienes: en Safari, Compartir → Añadir a pantalla de inicio; después abre el icono.</p>}
 {!supported&&<p>Este navegador no permite activar los avisos. En iPhone utiliza Nodo como app añadida a la pantalla de inicio.</p>}
 <p>Permiso: {({granted:'Permitido',denied:'Bloqueado',default:'Sin solicitar',unsupported:'No disponible'}as Record<string,string>)[permission]} · Este dispositivo: {status?.this_device_active?'Registrado':'Sin registrar'}</p>
 {supported&&(!ios||standalone)&&<button className="btn-primary" disabled={busy||!status?.configured} onClick={enable}>{busy?'Procesando…':'Activar avisos en este dispositivo'}</button>}
 {device&&status?.this_device_active&&<><button className="btn-ghost" disabled={busy} onClick={test}>Enviar prueba</button><button className="btn-ghost" disabled={busy} onClick={disable}>Desactivar este dispositivo</button></>}
 {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 {status&&<p className="evidence">Proveedor: {status.attempts_by_state.accepted||0} aceptados · Navegador: {status.browser_display_reports} informes de visualización. Esto no confirma que hayas leído el aviso.</p>}
 <small>Los envíos salen de Hetzner. La entrega depende del permiso y de la configuración de este dispositivo.</small>
 </section>
}

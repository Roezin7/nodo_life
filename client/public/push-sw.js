/* Every push is visible. A display receipt is distinct from a human reading it. */
async function reportPush(data,kind){
 try{await fetch('/api/push/receipt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({delivery_id:data.delivery_id,token:data.receipt_token,kind})})}catch{}
}
self.addEventListener('push',event=>{
 event.waitUntil((async()=>{
  let d={};try{d=event.data.json()}catch{}
  await self.registration.showNotification(typeof d.title==='string'?d.title:'Nodo · Aviso',{body:typeof d.body==='string'?d.body:'Abre Nodo para consultar tus avisos.',icon:'/pwa-192.png',badge:'/pwa-192.png',tag:typeof d.delivery_id==='string'?d.delivery_id:'nodo-aviso',data:d});
  await reportPush(d,'displayed');
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const d=event.notification.data||{};
 event.waitUntil((async()=>{
  await reportPush(d,'opened');
  const url=new URL('/avisos',self.location.origin).href;
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){if(new URL(client.url).origin===self.location.origin){await client.navigate(url);return client.focus()}}
  return self.clients.openWindow(url);
 })());
});

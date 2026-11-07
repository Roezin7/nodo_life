"""Allowlisted interface to the existing canonical domain classes. No shell or SQL from input."""
import os,sys,json
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
sys.path.insert(0,os.environ.get('CANONICAL_MODULE_DIR','/canonical'))
from memory import Memory
from inbox import Inbox
from health import Health
from finance import Finance
from agenda import Agenda
from reminders import Reminders
from attention import Attention
from push_store import PushStore
from business import Business
from direction import Direction

def health_history(health,end):
 end=datetime.fromisoformat(end).date()
 days=[health.health_day((end-timedelta(days=i)).isoformat())for i in range(6,-1,-1)]
 row=health.db.execute("SELECT event_date FROM health_events WHERE kind='weight' AND is_demo=0 AND event_date<=? ORDER BY event_date DESC LIMIT 1",(end.isoformat(),)).fetchone()
 last=None
 if row:
  weights=[r for r in health.health_day(row[0])['records']if r['kind']=='weight']
  if weights:
   r=max(weights,key=lambda r:(r.get('captured_at',''),r['id']))
   last={'event_date':r['event_date'],'kg':r['data']['kg'],'record_id':r['id'],'source':r['source'],'is_reference':r['event_date']!=end.isoformat()}
 return {'days':[{'date':d['event_date'],'record_count':len(d['records']),'summary':d['summary'],'truncated':d['truncated']}for d in days],'latest_weight':last,'as_of':end.isoformat()}

def execute(op,p):
 store=Memory(os.environ['NODO_DB']);tasks=Inbox(store);health=Health(store);finance=Finance(store,real_enabled=True)
 today=datetime.now(ZoneInfo('America/Mexico_City')).date().isoformat()
 source='NODO Vida · captura autenticada de Arturo'
 try:
  if op.startswith('push.'):
   push=PushStore(store)
   if op=='push.status':return push.status(p.get('device_id'))
   if op=='push.subscribe':return push.subscribe(p['subscription'])
   if op=='push.unsubscribe':return push.unsubscribe(p['device_id'])
   if op=='push.test':return push.test(p['device_id'],p['request_id'])
   if op=='push.batch':return push.batch()
   if op=='push.result':return push.result(p['delivery_id'],p['code'])
   if op=='push.receipt':return push.receipt(p['delivery_id'],p['token'],p['kind'])
   raise ValueError('Operación de push inválida')
  if op=='direction':return Direction(store).direction_read(p.get('as_of',today))
  if op=='direction.goal.save':return Direction(store).goal_save(p['data'],source,p['request_id'],p.get('goal_id'),p.get('expected_version'))
  if op=='direction.goal.decide':return Direction(store).goal_decide(p['goal_id'],p['expected_version'],p['decision'],p['human_confirmed'],p['evidence'],source,p['request_id'])
  if op=='direction.review.prepare':return Direction(store).review_prepare(p.get('as_of',today),source,p['request_id'])
  if op=='direction.review.decide':return Direction(store).review_decide(p['review_id'],p['expected_version'],p['decision'],p['priority_ids'],p['notes'],p['human_confirmed'],source,p['request_id'])
  if op=='businesses':return Business(store).business_list()
  if op=='business':return Business(store).business_read(p['project_id'])
  if op=='overview':
   t=tasks.task_list(status='active');t['tasks']=[x for x in t['tasks'] if x['project']!='demo']
   direction=Direction(store).direction_read(today)
   direction={k:direction[k]for k in ('accepted_plan','proposed_priorities','latest_review','pending_decisions')}
   return {'direction':direction,'date':today,'read_at':datetime.now().astimezone().isoformat(),'tasks':t,'health':health.health_day(today),'health_history':health_history(health,today),'finance':finance.finance_summary(today,False),'context':store.context_get(['continuidad','objetivos','proyectos'],50),'attention':Attention(store).read()}
  if op=='notifications':
   reminders=Reminders(store).reminder_list();reminders['reminders']=[r for r in reminders['reminders']if r['project']!='demo'];return dict(Attention(store).read(),reminders=reminders)
  if op=='notification.ack':return Attention(store).ack(p['notice_id'],source,p['request_id'])
  if op=='agenda':return Agenda(store).read(p.get('date',today),p.get('days',7))
  if op=='tasks':
   t=tasks.task_list(status=p.get('status','all'));t['tasks']=[x for x in t['tasks'] if x['project']!='demo'];return t
  if op=='task.capture':return tasks.task_capture(p['project'],p['title'],p['next_action'],source,p['request_id'],p.get('review_at'))
  if op=='task.update':
   if tasks.task_get(p['task_id'])['task']['project']=='demo':raise ValueError('Registro de prueba fuera de esta vista')
   return tasks.task_update(p['task_id'],p['expected_version'],p['changes'],source,p['request_id'])
  if op=='health':
   result=health.health_day(p.get('date',today));result['history']=health_history(health,p.get('date',today));return result
  if op=='health.trend':
   end=datetime.fromisoformat(p.get('date',today)).date();days=[health.health_day((end-timedelta(days=i)).isoformat()) for i in range(13,-1,-1)]
   return {'days':[{'date':d['event_date'],'weights':[r['data']['kg'] for r in d['records'] if r['kind']=='weight'],'summary':d['summary']} for d in days]}
  if op=='health.capture':return health.health_capture(p['kind'],p['event_date'],p['data'],source,p['request_id'],False)
  if op=='health.correct':return health.health_correct(p['record_id'],p['expected_version'],p['event_date'],p['data'],source,p['request_id'])
  if op=='finance':
   result=finance.finance_summary(p.get('date',today),False)
   result['records']=[r for r in finance.all() if not r['is_demo'] and not r['void']][:200]
   result['records_truncated']=sum(not r['is_demo'] and not r['void'] for r in finance.all())>200
   return result
  if op=='finance.capture':return finance.finance_capture(p['kind'],p['data'],source,p['request_id'],False)
  if op=='finance.correct':
   if finance.record(p['record_id'])['is_demo']:raise ValueError('Registro de prueba fuera de esta vista')
   return finance.finance_correct(p['record_id'],p['expected_version'],p['data'],p.get('void',False),source,p['request_id'])
  if op=='memory':return store.context_get([p.get('domain','continuidad')],50)
  if op=='memory.propose':return store.memory_propose(p['record_id'],p['expected_version'],p['text'],source,p['request_id'])
  if op=='system':
   try:
    from pathlib import Path
    operational=json.loads(Path('/status/operational.json').read_text())
   except (OSError,ValueError):operational=None
   return {'operational':operational,'version':'1.6.1','storage':'Base canónica compartida de Nodo','timezone':'America/Mexico_City','calendar':'Google Calendar principal se consulta por suscripción privada cada5minutos. Sólo lectura; puede existir demora de publicación de Google.','notifications':'Canal Web Push instalado. Cada dispositivo requiere activación propia y prueba de recepción; tener un envío aceptado no significa que se haya leído.','offline':'No se guardan registros sin conexión.','read_at':datetime.now().astimezone().isoformat(),'context_revision':store.context_get(['sistema'],1)['revision']}
  raise ValueError('Operación no admitida')
 finally:store.close()

if __name__=='__main__':
 try:
  request=json.loads(sys.stdin.read(32769));result=execute(request['op'],request.get('params',{}));print(json.dumps({'ok':True,'data':result},ensure_ascii=False))
 except (ValueError,KeyError,TypeError) as e:print(json.dumps({'ok':False,'error':str(e)[:180]},ensure_ascii=False))
 except Exception:print(json.dumps({'ok':False,'error':'No se pudo consultar la base canónica. Reintenta sin duplicar el registro.'}))

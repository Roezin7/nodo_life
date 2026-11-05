"""Allowlisted interface to the existing canonical domain classes. No shell or SQL from input."""
import os,sys,json
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
sys.path.insert(0,os.environ.get('CANONICAL_MODULE_DIR','/canonical'))
from memory import Memory
from inbox import Inbox
from health import Health
from finance import Finance

def execute(op,p):
 store=Memory(os.environ['NODO_DB']);tasks=Inbox(store);health=Health(store);finance=Finance(store,real_enabled=True)
 today=datetime.now(ZoneInfo('America/Mexico_City')).date().isoformat()
 source='NODO Vida · captura autenticada de Arturo'
 try:
  if op=='overview':
   t=tasks.task_list(status='active');t['tasks']=[x for x in t['tasks'] if x['project']!='demo']
   return {'date':today,'read_at':datetime.now().astimezone().isoformat(),'tasks':t,'health':health.health_day(today),'finance':finance.finance_summary(today,False),'context':store.context_get(['continuidad','objetivos','proyectos'],50)}
  if op=='tasks':
   t=tasks.task_list(status=p.get('status','all'));t['tasks']=[x for x in t['tasks'] if x['project']!='demo'];return t
  if op=='task.capture':return tasks.task_capture(p['project'],p['title'],p['next_action'],source,p['request_id'],p.get('review_at'))
  if op=='task.update':
   if tasks.task_get(p['task_id'])['task']['project']=='demo':raise ValueError('Registro de prueba fuera de esta vista')
   return tasks.task_update(p['task_id'],p['expected_version'],p['changes'],source,p['request_id'])
  if op=='health':return health.health_day(p.get('date',today))
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
   return {'version':'1.0.0','storage':'Base canónica compartida de Nodo','timezone':'America/Mexico_City','calendar':'Los vencimientos de tareas son documentales; Google Calendar aún no está conectado a esta web.','notifications':'No se han activado nuevas notificaciones push en esta web. Se conservan los canales y automatizaciones existentes.','offline':'No se guardan registros sin conexión.','read_at':datetime.now().astimezone().isoformat(),'context_revision':store.context_get(['sistema'],1)['revision']}
  raise ValueError('Operación no admitida')
 finally:store.close()

if __name__=='__main__':
 try:
  request=json.loads(sys.stdin.read(32769));result=execute(request['op'],request.get('params',{}));print(json.dumps({'ok':True,'data':result},ensure_ascii=False))
 except (ValueError,KeyError,TypeError) as e:print(json.dumps({'ok':False,'error':str(e)[:180]},ensure_ascii=False))
 except Exception:print(json.dumps({'ok':False,'error':'No se pudo consultar la base canónica. Reintenta sin duplicar el registro.'}))

import os,sys,unittest,tempfile,uuid,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
import web_bridge as bridge
from memory import Memory
from health import Health
from finance import Finance
from inbox import Inbox
class Integration(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();os.environ['NODO_DB']=self.tmp.name+'/context.sqlite3';self.store=Memory(os.environ['NODO_DB'])
 def tearDown(self):self.store.close();self.tmp.cleanup()
 def key(self):return str(uuid.uuid4())
 def call(self,op,**params):return bridge.execute(op,params)
 def test_tasks_shared_version_idempotency(self):
  p=dict(project='iberico',title='Prueba',next_action='Revisar',request_id=self.key());a=self.call('task.capture',**p);b=self.call('task.capture',**p);self.assertEqual(a,b)
  self.assertEqual(Inbox(self.store).task_get(a['task']['id'])['task']['title'],'Prueba')
  self.call('task.update',task_id=a['task']['id'],expected_version=1,changes={'status':'done'},request_id=self.key())
  with self.assertRaises(ValueError):self.call('task.update',task_id=a['task']['id'],expected_version=1,changes={'status':'open'},request_id=self.key())
 def test_health_no_demo_or_invented_nutrition(self):
  h=Health(self.store);h.health_capture('weight','2026-11-05',{'kg':81},'Test',self.key(),True)
  self.call('health.capture',kind='food',event_date='2026-11-05',data={'description':'Comida','state':'consumed','quantity':'1 plato'},request_id=self.key())
  d=self.call('health',date='2026-11-05');self.assertEqual(len(d['records']),1);self.assertIsNone(d['summary']['estimated_totals_of_known_entries']['kcal']);self.assertTrue(d['summary']['nutrition_partial'])
  with self.assertRaises(ValueError):self.call('health.capture',kind='food',event_date='2026-11-05',data={'description':'Comida','state':'consumed','kcal':123},request_id=self.key())
 def test_finance_shared_expense_idempotency(self):
  a=self.call('finance.capture',kind='account',data={'name':'Prueba','currency':'MXN','opening_cents':10000,'opening_date':'2026-11-05'},request_id=self.key())['record'];p=dict(kind='movement',data={'account_id':a['id'],'event_date':'2026-11-05','direction':'out','amount_cents':2500,'classification':'expense','description':'Prueba'},request_id=self.key())
  self.call('finance.capture',**p);self.call('finance.capture',**p)
  self.assertEqual(Finance(self.store).finance_summary('2026-11-05')['totals_by_currency']['MXN']['ledger_cash_cents'],7500)
  self.assertEqual(len(self.call('finance',date='2026-11-05')['records']),2)
 def test_filters_and_invalid_operation(self):
  Inbox(self.store).task_capture('demo','Prueba','Prueba','Test',self.key())
  self.assertEqual(self.call('tasks')['tasks'],[])
  with self.assertRaises(ValueError):self.call('__shell__',command='id')
  with self.assertRaises(ValueError):self.call('memory',domain='__arbitrary__')
 def test_corrections_canonical(self):
  a=self.call('health.capture',kind='weight',event_date='2026-11-05',data={'kg':80},request_id=self.key())['record']
  self.call('health.correct',record_id=a['id'],expected_version=1,event_date='2026-11-05',data={'kg':79.9},request_id=self.key())
  self.assertEqual(Health(self.store).health_day('2026-11-05')['records'][0]['data']['kg'],79.9)
  with self.assertRaises(ValueError):self.call('health.correct',record_id=a['id'],expected_version=1,event_date='2026-11-05',data={'kg':77},request_id=self.key())


 def test_notifications_share_due_reminder_and_ack(self):
  from reminders import Reminders
  r=Reminders(self.store);x=r.reminder_create('iberico','Prueba','2026-11-05T12:00:00-06:00',[{'at':'2026-11-05T11:00:00-06:00','message':'Prueba'}],'Prueba',self.key())['reminder']
  self.assertEqual(self.call('notifications')['items'],[])
  r.tick('2026-11-05T11:00:00-06:00');a=self.call('notifications')['items'][0]
  self.call('notification.ack',notice_id=a['id'],request_id=self.key())
  self.assertIsNotNone(self.call('notifications')['items'][0]['acknowledged_at'])
  self.assertEqual(r.reminder_get(x['id'])['reminder']['status'],'open')

if __name__=='__main__':unittest.main()

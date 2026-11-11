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
 def test_accompaniment_and_projects_share_canonical_source(self):
  from memory import canonical
  from accompaniment import PROFILE_ID
  records=[dict(id=PROFILE_ID,domain='preferencias',version=1,source='test',text=json.dumps({'enabled':True,'financial_planning':'deferred'})),dict(id='project-map:altos',domain='proyectos_detalle',version=2,source='test',text=json.dumps({'id':'altos','name':'Altos','followup':{'last_activity_date':'2026-09-19'}}))]
  for r in records:self.store.db.execute('INSERT INTO records VALUES(?,?,?,?,?)',(r['id'],r['domain'],canonical(r),r['source'],r['version']))
  self.assertEqual(self.call('projects')['projects'][0]['record_version'],2)
  self.assertFalse(self.call('projects')['projects'][0]['execution_available'])
  self.assertEqual(self.call('overview')['accompaniment']['policy']['financial_planning'],'deferred')
 def test_analysis_matches_shared_motor_without_writes(self):
  h=Health(self.store)
  h.health_capture('weight','2026-11-09',{'kg':78.5},'Test',self.key(),False)
  before=self.store.db.total_changes
  d=self.call('health.analysis',date='2026-11-09')
  self.assertEqual(d['weight']['measured_days'],1)
  self.assertIsNone(d['weight']['mean_kg'])
  self.assertEqual(d['nutrition']['complete_days'],0)
  self.assertEqual(self.store.db.total_changes,before)
 def test_history_keeps_weight_date_and_excludes_future_demo(self):
  h=Health(self.store)
  h.health_capture('weight','2026-11-05',{'kg':79.08},'Test',self.key(),False)
  h.health_capture('weight','2026-11-06',{'kg':99},'Demo',self.key(),True)
  h.health_capture('weight','2026-11-08',{'kg':82},'Future',self.key(),False)
  d=self.call('health',date='2026-11-06')
  self.assertFalse(d['summary']['weight_present']);self.assertEqual(d['history']['latest_weight']['kg'],79.08);self.assertEqual(d['history']['latest_weight']['event_date'],'2026-11-05');self.assertTrue(d['history']['latest_weight']['is_reference'])
  self.assertEqual(self.call('health',date='2026-11-04')['history']['latest_weight'],None)
 def test_history_totals_do_not_duplicate_daily_estimate(self):
  h=Health(self.store)
  values=dict(kcal=500,protein_g=20,estimated=True,assumptions='Synthetic test')
  h.health_capture('food','2026-11-06',dict(values,description='Test meal',state='consumed'),'Test',self.key(),False)
  h.health_capture('daily_estimate','2026-11-06',values,'Test',self.key(),False)
  d=self.call('health',date='2026-11-07');y=d['history']['days'][-2]
  self.assertEqual(d['records'],[]);self.assertEqual(y['date'],'2026-11-06');self.assertEqual(y['summary']['consumed_entries'],1);self.assertEqual(y['summary']['estimated_totals_of_known_entries']['kcal'],500);self.assertNotEqual(y['summary']['meals_complete'],True)
 def test_overview_history_is_read_only(self):
  h=Health(self.store);h.health_capture('weight','2026-11-05',{'kg':79.08},'Test',self.key(),False)
  before=self.store.db.execute('SELECT count(*) FROM health_history').fetchone()[0]
  result=self.call('overview');self.assertIn('health_history',result)
  self.assertEqual(self.store.db.execute('SELECT count(*) FROM health_history').fetchone()[0],before)
 def test_business_shared_readonly(self):
  from business import Business
  b=Business(self.store)
  r=self.call('business',project_id='casa_blanca');self.assertEqual(r['entity_id'],'2');self.assertIsNone(r['snapshot']);self.assertEqual(r['status'],'unavailable')
  self.assertEqual(len(self.call('businesses')['businesses']),2)
 def test_business_unknown_is_rejected(self):
  with self.assertRaises(ValueError):self.call('business',project_id='unregistered')
 def test_direction_goal_proposal_then_explicit_decision(self):
  data=dict(domain='life',title='Prueba',outcome='Sólo prueba',metric='qualitative',target_value=None,unit=None,target_date=None,review_on=None)
  g=self.call('direction.goal.save',data=data,request_id=self.key())['goal'];self.assertEqual(g['status'],'proposed')
  self.call('direction.goal.decide',goal_id=g['id'],expected_version=1,decision='active',human_confirmed=True,evidence='Decisión explícita de prueba',request_id=self.key())
  self.assertEqual(self.call('direction')['goals'][0]['status'],'active')
 def test_direction_no_implicit_approval(self):
  data=dict(domain='life',title='Prueba',outcome='Sólo prueba',metric='qualitative',target_value=None,unit=None,target_date=None,review_on=None)
  g=self.call('direction.goal.save',data=data,request_id=self.key())['goal']
  with self.assertRaises(ValueError):self.call('direction.goal.decide',goal_id=g['id'],expected_version=1,decision='active',human_confirmed=False,evidence='No',request_id=self.key())
 def test_direction_review_read_write_shared(self):
  r=self.call('direction.review.prepare',as_of='2026-11-06',request_id=self.key())['review'];self.assertEqual(self.call('direction',as_of='2026-11-06')['latest_review']['id'],r['id'])
 def test_overview_direction_does_not_close_task(self):
  t=Inbox(self.store).task_capture('nodo','Antigua','Revisar','Test',self.key())['task'];self.call('direction.review.prepare',as_of='2026-11-06',request_id=self.key());r=self.call('overview');self.assertEqual(r['direction']['latest_review']['status'],'proposed');self.assertEqual(Inbox(self.store).task_get(t['id'])['task']['status'],'open')
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



 def test_push_status_does_not_expose_subscription_or_keys(self):
  s=self.call('push.status');self.assertEqual(s['active_devices'],0);self.assertNotIn('subscription',s);self.assertNotIn('keys',s)
 def test_unknown_push_is_not_a_command(self):
  with self.assertRaises(ValueError):self.call('push.shell',command='id')

if __name__=='__main__':unittest.main()

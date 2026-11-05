import os,sys,tempfile,unittest,json
from pathlib import Path
sys.path.insert(0,os.environ.get('CANONICAL_MODULE_DIR','/canonical'))
from memory import Memory
from agenda import Agenda
class CalendarTests(unittest.TestCase):
 def setUp(self):self.tmp=tempfile.TemporaryDirectory();self.store=Memory(self.tmp.name+'/test.db');self.a=Agenda(self.store)
 def tearDown(self):self.store.close();self.tmp.cleanup()
 def sync(self,events,at='2026-11-05T18:00:00Z',error=None):return self.a.sync('primary','Arturo',events,'2026-10-29','2027-01-05',at,error)
 def event(self,id='one',start='2026-11-05T15:00:00Z',end='2026-11-05T16:00:00Z',**extra):return dict(id=id,title='Reunión',start=start,end=end,all_day=False,category='meeting',location='',**extra)
 def test_same_database_and_context(self):
  self.sync([self.event()]);result=self.a.read('2026-11-05');self.assertEqual(len(result['events']),1);r=self.store.context_get(['agenda'])['records'][0];self.assertEqual(json.loads(r['text'])['events'][0]['id'],'one')
 def test_deletion_and_failure_preservation(self):
  self.sync([self.event()]);self.sync([],error='Google no disponible');self.assertEqual(len(self.a.read('2026-11-05')['events']),1);self.assertIsNotNone(self.a.read('2026-11-05')['sources'][0]['last_error']);self.sync([]);self.assertEqual(self.a.read('2026-11-05')['events'],[])
 def test_no_revision_churn(self):
  self.sync([self.event()]);r=self.store.context_get(['agenda'])['revision'];self.sync([self.event()],at='2026-11-05T18:05:00Z');self.assertEqual(r,self.store.context_get(['agenda'])['revision'])
 def test_midnight_and_all_day(self):
  a=self.event(start='2026-11-06T04:00:00Z',end='2026-11-06T05:00:00Z');b={'id':'holiday','title':'Fecha','start':'2026-11-06','end':'2026-11-07','all_day':True,'category':'meeting','location':''};self.sync([a,b]);self.assertEqual([x['id']for x in self.a.read('2026-11-05',1)['events']],['one']);self.assertEqual([x['id']for x in self.a.read('2026-11-06',1)['events']],['holiday'])
 def test_conflicts_exclude_reminders_and_tests(self):
  a=self.event();b=self.event('two',start='2026-11-05T15:30:00Z',end='2026-11-05T16:30:00Z');c=dict(a,id='reminder',category='reminder');t=dict(a,id='test',category='test');self.sync([a,b,c,t]);d=self.a.read('2026-11-05');self.assertEqual(len(d['conflicts']),1);self.assertEqual(len(d['events']),3)
 def test_invalid_snapshot_does_not_erase(self):
  self.sync([self.event()]);bad=self.event();bad['end']=bad['start']
  with self.assertRaises(ValueError):self.sync([bad])
  self.assertEqual(len(self.a.read('2026-11-05')['events']),1)
if __name__=='__main__':unittest.main()

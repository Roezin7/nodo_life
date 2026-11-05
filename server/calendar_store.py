import sys,os,json
sys.path.insert(0,os.environ.get('CANONICAL_MODULE_DIR','/canonical'))
from memory import Memory
from agenda import Agenda
store=None
try:
 p=json.loads(sys.stdin.read(4*1024*1024));store=Memory(os.environ['NODO_DB']);Agenda(store).sync(**p);print(json.dumps({'stored':True}))
except Exception:print(json.dumps({'stored':False}))
finally:
 if store:store.close()

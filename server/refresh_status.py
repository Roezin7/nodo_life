"""Root-owned deployment hook. Exposes only dated operational metadata to the authenticated web app."""
import json,subprocess,os
from pathlib import Path
from datetime import datetime,timezone
folder=Path('/opt/nodo-vida/status');folder.mkdir(mode=0o755,parents=True,exist_ok=True)
try:
 raw=json.loads(Path('/var/lib/nodo-encrypted-backups/LAST_SUCCESS.json').read_text())
 backup={k:raw.get(k) for k in ['file','completed_at_utc','bytes','snapshot_restore_before_wrapping_verified','offsite']}
except (OSError,ValueError):backup=None
r=subprocess.run(['systemctl','is-active','jarvis-memory.service'],capture_output=True,text=True)
result={'checked_at':datetime.now(timezone.utc).isoformat(),'backend_service':r.stdout.strip(),'backup':backup,'scope':'Instantánea tras respaldo o despliegue; no vigilancia continua ni prueba de entrega móvil.'}
p=folder/'operational.tmp';p.write_text(json.dumps(result));os.chmod(p,0o644);p.replace(folder/'operational.json')

import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api';
import { Icono } from '../icons';
import CapturaDraft from './CapturaDraft';

interface Msg { id?: number; rol: 'user' | 'assistant'; contenido: string }

const SIZE = 60;
const MARGEN = 14;
const POS_KEY = 'silvia-pos';

function clampPos(x: number, y: number) {
  const vw = window.innerWidth, vh = window.innerHeight;
  return { x: Math.max(MARGEN, Math.min(x, vw - SIZE - MARGEN)), y: Math.max(MARGEN, Math.min(y, vh - SIZE - MARGEN)) };
}
function posInicial() {
  try {
    const s = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
    if (s && typeof s.x === 'number') return clampPos(s.x, s.y);
  } catch { /* ignore */ }
  return clampPos(window.innerWidth - SIZE - MARGEN, Math.round(window.innerHeight * 0.62));
}

export default function SilviaBubble() {
  const [disponible, setDisponible] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState<'chat' | 'captura'>('chat');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  const [pos, setPos] = useState(posInicial);
  const [arrastrando, setArrastrando] = useState(false);
  const drag = useRef<{ id: number; ox: number; oy: number; sx: number; sy: number; moved: boolean } | null>(null);

  useEffect(() => {
    api<{ disponible: boolean }>('/silvia/estado').then((e) => setDisponible(e.disponible)).catch(() => setDisponible(false));
  }, []);
  useEffect(() => {
    if (abierto && msgs.length === 0) api<Msg[]>('/silvia/historial').then(setMsgs).catch(() => {});
  }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, pensando]);
  useEffect(() => {
    const onR = () => setPos((p) => clampPos(p.x, p.y));
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);

  if (!disponible) return null;

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { id: e.pointerId, ox: e.clientX - pos.x, oy: e.clientY - pos.y, sx: e.clientX, sy: e.clientY, moved: false };
    setArrastrando(true);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 5) d.moved = true;
    setPos(clampPos(e.clientX - d.ox, e.clientY - d.oy));
  }
  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    setArrastrando(false);
    if (!d) return;
    if (d.moved) {
      setPos((p) => {
        const snapX = p.x + SIZE / 2 < window.innerWidth / 2 ? MARGEN : window.innerWidth - SIZE - MARGEN;
        const np = { x: snapX, y: p.y };
        try { localStorage.setItem(POS_KEY, JSON.stringify(np)); } catch { /* ignore */ }
        return np;
      });
    } else setAbierto(true);
  }

  async function enviar() {
    const t = texto.trim();
    if (!t || pensando) return;
    setTexto('');
    setMsgs((m) => [...m, { rol: 'user', contenido: t }]);
    setPensando(true);
    try {
      const r = await api<{ texto: string }>('/silvia/chat', { method: 'POST', body: { mensaje: t } });
      setMsgs((m) => [...m, { rol: 'assistant', contenido: r.texto }]);
    } catch (e) {
      setMsgs((m) => [...m, { rol: 'assistant', contenido: `⚠️ ${e instanceof ApiError ? e.message : 'No pude responder ahora.'}` }]);
    } finally { setPensando(false); }
  }

  function panelStyle(): React.CSSProperties {
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = Math.min(vw - 24, 390);
    const h = Math.min(vh - 24, 620);
    let left = pos.x + SIZE / 2 < vw / 2 ? pos.x : pos.x + SIZE - w;
    left = Math.max(12, Math.min(left, vw - w - 12));
    let top = pos.y + SIZE / 2 - h / 2;
    top = Math.max(12, Math.min(top, vh - h - 12));
    return { left, top, width: w, height: h, right: 'auto', bottom: 'auto' };
  }

  return (
    <>
      {!abierto && (
        <button className={`silvia-orb ${arrastrando ? 'silvia-orb--drag' : ''}`} style={{ left: pos.x, top: pos.y }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} aria-label="Abrir Silvia">
          <span className="silvia-avatar">S</span>
        </button>
      )}
      {abierto && (
        <div className="silvia-panel" style={panelStyle()}>
          <header className="silvia-head-bar">
            <div className="silvia-head-bar__id">
              <span className="silvia-avatar silvia-avatar--sm">S</span>
              <div><strong>Silvia</strong><small className="muted"> · tu coach de vida</small></div>
            </div>
            <button className="link-btn" onClick={() => setAbierto(false)} aria-label="Cerrar"><Icono name="x" size={18} /></button>
          </header>

          <div style={{ padding: '0.5rem 0.75rem 0' }}>
            <div className="segmented">
              <button className={modo === 'chat' ? 'seg seg--on' : 'seg'} onClick={() => setModo('chat')}>Conversar</button>
              <button className={modo === 'captura' ? 'seg seg--on' : 'seg'} onClick={() => setModo('captura')}>Capturar</button>
            </div>
          </div>

          {modo === 'chat' ? (
            <>
              <div className="silvia-msgs">
                {msgs.length === 0 && (
                  <div className="silvia-bubble silvia-bubble--bot">
                    ¡Hola! Soy Silvia. Veo tus números en tiempo real — finanzas, hábitos, peso, objetivos.
                    Pregúntame cómo vas o qué conviene ajustar. En “Capturar” registro lo que me dictes.
                  </div>
                )}
                {msgs.map((m, i) => (
                  <div key={m.id ?? i} className={`silvia-bubble ${m.rol === 'user' ? 'silvia-bubble--user' : 'silvia-bubble--bot'}`}>{m.contenido}</div>
                ))}
                {pensando && <div className="silvia-bubble silvia-bubble--bot silvia-typing">Silvia está pensando…</div>}
                <div ref={finRef} />
              </div>
              <div className="silvia-input">
                <textarea rows={1} placeholder="Pregúntale a Silvia…" value={texto} onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }} />
                <button className="btn-primary" onClick={enviar} disabled={pensando} aria-label="Enviar"><Icono name="send" size={18} /></button>
              </div>
            </>
          ) : (
            <CapturaDraft />
          )}
        </div>
      )}
    </>
  );
}

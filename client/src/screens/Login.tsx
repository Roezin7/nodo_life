import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import NodoIsotipo from '../brand/NodoIsotipo';

export default function Login() {
  const { login } = useAuth();
  const [nombre, setNombre] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api<{ nombre: string } | null>('/auth/usuario', { auth: false })
      .then((u) => setNombre(u?.nombre ?? null))
      .catch(() => {});
  }, []);

  async function intentar(pinFinal: string) {
    setEnviando(true);
    setError('');
    try {
      await login(pinFinal);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error de conexión');
      setPin('');
    } finally {
      setEnviando(false);
    }
  }

  function teclear(d: string) {
    if (enviando) return;
    const next = (pin + d).slice(0, 6);
    setPin(next);
    if (next.length >= 4) void intentar(next);
  }

  return (
    <div className="login">
      <div className="login__lockup">
        <NodoIsotipo size={64} glow />
        <div className="login__wordmark">NODO VIDA</div>
      </div>
      <h1>{nombre ? `Hola, ${nombre}` : 'Bienvenido'}</h1>
      <p className="subtitle">Ingresa tu PIN</p>
      <div className="pin-dots">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`dot ${i < pin.length ? 'dot--full' : ''}`} />
        ))}
      </div>
      {error && <p className="error-msg">{error}</p>}
      <div className="pinpad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} onClick={() => teclear(d)} disabled={enviando}>{d}</button>
        ))}
        <button className="pinpad__ghost" onClick={() => setPin('')}>C</button>
        <button onClick={() => teclear('0')} disabled={enviando}>0</button>
        <button className="pinpad__ghost" onClick={() => setPin(pin.slice(0, -1))}>⌫</button>
      </div>
    </div>
  );
}

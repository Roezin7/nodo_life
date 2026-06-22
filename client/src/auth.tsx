import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from './api';

export interface Usuario {
  id: number;
  nombre: string;
}

interface AuthCtx {
  usuario: Usuario | null;
  cargando: boolean;
  login: (pin: string) => Promise<void>;
  logout: () => void;
  setNombre: (nombre: string) => void;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setCargando(false);
      return;
    }
    api<Usuario>('/auth/me')
      .then(setUsuario)
      .catch(() => setToken(null))
      .finally(() => setCargando(false));
  }, []);

  async function login(pin: string) {
    const { token, usuario } = await api<{ token: string; usuario: Usuario }>('/auth/login', {
      method: 'POST',
      body: { pin },
      auth: false,
    });
    setToken(token);
    setUsuario(usuario);
  }

  function logout() {
    void api('/silvia/historial', { method: 'DELETE' }).catch(() => {});
    setToken(null);
    setUsuario(null);
  }

  function setNombre(nombre: string) {
    setUsuario((u) => (u ? { ...u, nombre } : u));
  }

  return <Ctx.Provider value={{ usuario, cargando, login, logout, setNombre }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

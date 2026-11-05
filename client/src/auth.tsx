import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
type User = { id: number; nombre: string };
const Context = createContext<{
  usuario: User | null;
  cargando: boolean;
  login: (pin: string) => Promise<void>;
  logout: () => void;
}>(null!);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null),
    [cargando, setCargando] = useState(true);
  useEffect(() => {
    api<User>("/auth/me")
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));
    const off = () => setUsuario(null);
    window.addEventListener("nodo:unauthorized", off);
    return () => window.removeEventListener("nodo:unauthorized", off);
  }, []);
  async function login(pin: string) {
    const r = await api<{ usuario: User }>("/auth/login", {
      method: "POST",
      body: { pin },
      auth: false,
    });
    setUsuario(r.usuario);
  }
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      setUsuario(null);
    } catch {
      window.alert("No se pudo cerrar sesión. Reintenta.");
    }
  }
  return (
    <Context.Provider value={{ usuario, cargando, login, logout }}>
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);

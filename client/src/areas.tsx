import { api } from './api';
import { useCargar } from './ui';

export interface Area { id: number; nombre: string; color: string; icono: string }

/** Carga las áreas de vida activas (Dinero, Salud, Trabajo, Crecimiento…). */
export function useAreas() {
  return useCargar<Area[]>(() => api<Area[]>('/areas'));
}

/** Fila de chips para filtrar por área. value = null significa "todas". */
export function FiltroArea({ areas, value, onChange }: { areas: Area[]; value: number | null; onChange: (id: number | null) => void }) {
  if (areas.length === 0) return null;
  return (
    <div className="area-filtro">
      <button className={`area-chip-btn ${value == null ? 'area-chip-btn--on' : ''}`} onClick={() => onChange(null)}>Todo</button>
      {areas.map((a) => {
        const on = value === a.id;
        return (
          <button
            key={a.id}
            className={`area-chip-btn ${on ? 'area-chip-btn--on' : ''}`}
            style={on ? { background: a.color, borderColor: a.color, color: '#fff' } : { borderColor: a.color }}
            onClick={() => onChange(on ? null : a.id)}
          >
            <span className="area-dot" style={{ background: on ? '#fff' : a.color }} /> {a.nombre}
          </button>
        );
      })}
    </div>
  );
}

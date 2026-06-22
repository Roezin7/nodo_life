import Anthropic from '@anthropic-ai/sdk';
import { env } from '../env.js';
import { HttpError } from '../middleware/error.js';
import { catalogoCaptura } from './context.js';
import { traducirError } from './agent.js';
import { hoyMX } from '../lib/fecha.js';

// Captura asistida: la IA SOLO propone un borrador editable. Nunca escribe en la DB.
// "gasté 500 en súper", "pesé 78.4", "entrené pecho 3x10 60kg" → acciones estructuradas
// que el cliente edita y confirma con los endpoints normales de cada módulo.

const MODELO = 'claude-opus-4-8';

export const capturaDisponible = () => !!env.ANTHROPIC_API_KEY;

export type TipoAccion = 'gasto' | 'ingreso' | 'peso' | 'habito' | 'entrenamiento' | 'tarea';

export interface AccionBorrador {
  tipo: TipoAccion;
  confianza: 'alta' | 'media' | 'baja';
  // campos comunes / por tipo (todos opcionales; el cliente edita lo que falte)
  monto?: number | null;
  cuenta_id?: number | null;
  categoria_id?: number | null;
  area_id?: number | null;
  descripcion?: string | null;
  peso?: number | null;
  habito_id?: number | null;
  tipo_entrenamiento_id?: number | null;
  duracion_min?: number | null;
  titulo?: string | null;
  fecha?: string | null;
}

const HERRAMIENTA: Anthropic.Tool = {
  name: 'proponer_captura',
  description: 'Devuelve las acciones detectadas en el texto del usuario para que él las edite y confirme.',
  input_schema: {
    type: 'object',
    properties: {
      acciones: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            tipo: { type: 'string', enum: ['gasto', 'ingreso', 'peso', 'habito', 'entrenamiento', 'tarea'] },
            confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
            monto: { type: ['number', 'null'], description: 'Monto en MXN para gasto/ingreso.' },
            cuenta_id: { type: ['integer', 'null'], description: 'Id de cuenta del catálogo (origen del gasto / destino del ingreso).' },
            categoria_id: { type: ['integer', 'null'], description: 'Id de categoría del catálogo.' },
            area_id: { type: ['integer', 'null'], description: 'Id de área del catálogo.' },
            descripcion: { type: ['string', 'null'] },
            peso: { type: ['number', 'null'], description: 'Peso en kg para tipo peso.' },
            habito_id: { type: ['integer', 'null'], description: 'Id de hábito del catálogo.' },
            tipo_entrenamiento_id: { type: ['integer', 'null'], description: 'Id de tipo de entrenamiento del catálogo.' },
            duracion_min: { type: ['integer', 'null'] },
            titulo: { type: ['string', 'null'], description: 'Título para tipo tarea.' },
            fecha: { type: ['string', 'null'], description: 'YYYY-MM-DD si el usuario menciona una fecha; si no, null (=hoy).' },
          },
          required: ['tipo', 'confianza'],
        },
      },
    },
    required: ['acciones'],
  },
};

export async function borradorCaptura(texto: string): Promise<{ acciones: AccionBorrador[] }> {
  if (!env.ANTHROPIC_API_KEY) throw new HttpError(503, 'La IA no está configurada: falta ANTHROPIC_API_KEY.');
  if (!texto.trim()) throw new HttpError(400, 'Escribe qué quieres registrar.');

  const cat = await catalogoCaptura();
  const sys = `Conviertes lo que el usuario dice en lenguaje natural en acciones para su tracker de vida.
Hoy es ${hoyMX()} (America/Mexico_City). Moneda MXN.

Tipos de acción:
- gasto / ingreso: monto (MXN), cuenta_id (origen del gasto o destino del ingreso), categoria_id, area_id, descripcion.
- peso: peso en kg.
- habito: habito_id (el hábito que cumplió).
- entrenamiento: tipo_entrenamiento_id, duracion_min, descripcion.
- tarea: titulo, area_id, fecha (si menciona vencimiento).

Empata nombres con el CATÁLOGO y usa sus ids. Si no hay match claro, deja el id en null y baja la confianza.
NO inventes montos ni datos. Si un dato no está en el texto, déjalo null (el usuario lo completa).
Devuelve TODO mediante la herramienta proponer_captura.

CATÁLOGO:
Cuentas: ${cat.cuentas.map((c) => `${c.id}:${c.nombre}${c.es_central ? ' (central)' : ''}`).join(', ') || '(ninguna)'}
Categorías: ${cat.categorias.map((c) => `${c.id}:${c.nombre}[${c.clase}]`).join(', ') || '(ninguna)'}
Áreas: ${cat.areas.map((a) => `${a.id}:${a.nombre}`).join(', ') || '(ninguna)'}
Hábitos: ${cat.habitos.map((h) => `${h.id}:${h.nombre}`).join(', ') || '(ninguno)'}
Tipos de entrenamiento: ${cat.tipos_entrenamiento.map((t) => `${t.id}:${t.nombre}`).join(', ') || '(ninguno)'}`;

  const cli = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  let resp: Anthropic.Message;
  try {
    resp = await cli.messages.create({
      model: MODELO,
      max_tokens: 2048,
      thinking: { type: 'adaptive' },
      system: sys,
      tools: [HERRAMIENTA],
      tool_choice: { type: 'tool', name: 'proponer_captura' },
      messages: [{ role: 'user', content: texto.trim() }],
    });
  } catch (e) {
    throw traducirError(e);
  }

  const tool = resp.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  const crudas = (tool?.input as { acciones?: AccionBorrador[] })?.acciones ?? [];
  const tiposValidos = new Set<TipoAccion>(['gasto', 'ingreso', 'peso', 'habito', 'entrenamiento', 'tarea']);
  const acciones = crudas.filter((a) => tiposValidos.has(a.tipo));
  return { acciones };
}

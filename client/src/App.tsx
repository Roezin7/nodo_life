import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import Shell from "./Shell";
import NodoIsotipo from "./brand/NodoIsotipo";
import { query, mutate, localDay } from "./api";
import {
  Page,
  Modal,
  Field,
  Stat,
  useCargar,
  Avisos,
  toast,
  LineChart,
} from "./ui";

type Data = Record<string, any>;
type RecordItem = {
  id: string;
  version: number;
  kind: string;
  data: Data;
  source: string;
  updated_at: string;
  event_date?: string;
  void?: boolean;
};
type Task = {
  id: string;
  version: number;
  title: string;
  next_action: string;
  project: string;
  status: string;
  review_at: string | null;
  source: string;
};
const cash = (c: number | null | undefined, currency = "MXN") =>
  c == null
    ? "Sin dato"
    : new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      }).format(c / 100);
const stamp = (s?: string | null) =>
  s
    ? new Intl.DateTimeFormat("es-MX", {
        timeZone: "America/Mexico_City",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(s))
    : "Sin fecha";
const statusLabels: Data = {
  open: "Abierta",
  waiting: "En espera",
  done: "Terminada",
  cancelled: "Cancelada",
};
const projectLabels: Data = {
  nodo: "Nodo",
  iberico: "Ibérico",
  casa_blanca: "La Casa Blanca",
};
function ErrorBox({
  error,
  retry,
}: {
  error: string | null;
  retry: () => void;
}) {
  return error ? (
    <div className="error-box" role="alert">
      {error}
      <button className="btn-ghost" onClick={retry}>
        Reintentar
      </button>
    </div>
  ) : null;
}
function Loading() {
  return (
    <div className="empty-state" role="status">
      Consultando Nodo…
    </div>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}
function Evidence({ source, version }: { source?: string; version?: number }) {
  return (
    <div className="evidence">
      {source || "Base canónica de Nodo"}
      {version != null ? ` · versión ${version}` : ""}
    </div>
  );
}
function Badge({ children }: { children: ReactNode }) {
  return <span className="n-badge">{children}</span>;
}
function useLive<T>(op: string, params: Data = {}) {
  const key = JSON.stringify(params);
  const result = useCargar<T>(() => query<T>(op, params), [op, key]);
  const refresh = result[1];
  useEffect(() => {
    const focus = () => refresh();
    window.addEventListener("focus", focus);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 60000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [op, key]);
  return result;
}

function Login() {
  const { login } = useAuth();
  const [pin, setPin] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(pin);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-wrap">
      <form className="login-panel" onSubmit={submit}>
        <NodoIsotipo size={58} />
        <p className="eyebrow">TU CENTRO PERSONAL</p>
        <h1>NODO VIDA</h1>
        <p className="muted">Tu día, con contexto.</p>
        <Field label="PIN de acceso">
          <input
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            pattern="[0-9]{3,12}"
            minLength={3}
            maxLength={12}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            required
            autoFocus
          />
        </Field>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <button className="btn-primary" disabled={busy}>
          {busy ? "Entrando…" : "Entrar a Nodo"}
        </button>
        <small>Acceso privado · los datos personales requieren sesión</small>
      </form>
    </main>
  );
}

function Notifications() {
 const [d,reload,loading,error]=useLive<Data>("notifications");
 const [busy,setBusy]=useState<string|null>(null);
 const [ackError,setAckError]=useState<string|null>(null);
 const requests=useRef<Record<string,string>>({});
 async function ack(id:string){
  setBusy(id);setAckError(null);requests.current[id] ||= crypto.randomUUID();
  try {await mutate("notification.ack",{notice_id:id},requests.current[id]);reload();}
  catch(e){setAckError((e as Error).message)}finally{setBusy(null)}
 }
 return <Page titulo="Avisos" icono="checks" accion={<button className="btn-ghost" onClick={reload}>Actualizar</button>}>
  <p>Recordatorios y resultados de Nodo. «Visto» confirma lectura; no termina tareas ni aprueba cambios.</p>
  <p className="evidence">Esta bandeja se actualiza al abrirla y cada minuto mientras está visible. La entrega de notificaciones al teléfono sigue sin comprobarse.</p>
  <ErrorBox error={error || ackError} retry={reload}/>
  {!d ? loading && <Loading/> : <>
   <section><h2>Para revisar</h2>
    {!d.items.length && <p>No hay avisos disponibles. Los próximos recordatorios aparecen abajo.</p>}
    {d.items.map((n:Data)=><article className="card" key={n.id}>
     <h3>{n.title}</h3><p>{n.message || n.summary}</p>
     <small>{n.kind === "job" ? "Resultado de encargo" : "Recordatorio"} · {stamp(n.at || n.created_at)}</small>
     {n.acknowledged_at ? <p>Visto · {stamp(n.acknowledged_at)}</p> : <p><button className="btn-primary" disabled={busy!==null} onClick={()=>ack(n.id)}>{busy===n.id ? "Guardando…" : "Marcar como visto"}</button></p>}
     {n.kind === "job" && <p>La revisión técnica continúa desde el chat diario. Este botón no integra ni despliega código.</p>}
    </article>)}
    {d.truncated && <p>Hay más avisos de los que muestra esta consulta.</p>}
   </section>
   <section><h2>Recordatorios registrados</h2>
    {!d.reminders.reminders.length && <p>No hay recordatorios abiertos registrados.</p>}
    {d.reminders.reminders.map((r:Data)=><article className="card" key={r.id}><h3>{r.title}</h3><p>{stamp(r.event_at)}</p>
     {r.alerts.map((a:Data)=><p key={a.id}>{stamp(a.at)} · {a.message} · {({scheduled:"Programado en Nodo",external_scheduled:"Aviso externo existente",available:"Disponible para leer",acknowledged:"Visto",cancelled:"Cancelado"} as Data)[a.state] || a.state}</p>)}
    </article>)}
   </section>
  </>}
 </Page>
}

function Home() {
  const [d, reload, loading, error] = useLive<Data>("overview");
  return (
    <Page
      titulo="Hoy"
      icono="home"
      accion={
        <button className="btn-ghost" onClick={reload}>
          Actualizar
        </button>
      }
    >
      <ErrorBox error={error} retry={reload} />
      {!d ? (
        loading ? (
          <Loading />
        ) : null
      ) : (
        <>
          <section className="day-hero">
            <div>
              <p className="eyebrow">UN SOLO CONTEXTO · MÉXICO</p>
              <h2>Lo que importa hoy.</h2>
              <p>Tu trabajo, dinero y bienestar en el mismo lugar.</p>
              <span className="evidence">
                Lectura {stamp(d.read_at)} · {d.date}
              </span>
            </div>
            <NodoIsotipo size={92} />
          </section>
          <div className="card"><Link to="/avisos">Ver avisos y resultados</Link><p>{d.attention?.items?.filter((x: Data) => !x.acknowledged_at).length || 0} pendientes de lectura · consulta la bandeja para revisar el detalle.</p></div>
          <div className="kpi-grid">
            <Stat
              label="Pendientes activos"
              valor={String(d.tasks.tasks.length)}
              sub={
                d.tasks.truncated
                  ? "Hay más registros; refina la consulta"
                  : "Registrados en Nodo"
              }
            />
            <Stat
              label="Saldo documental MXN"
              valor={cash(d.finance.totals_by_currency.MXN?.ledger_cash_cents)}
              sub="Declarado · sin conciliación bancaria"
            />
            <Stat
              label="Peso de hoy"
              valor={
                d.health.records
                  .filter((r: RecordItem) => r.kind === "weight")
                  .map((r: RecordItem) => `${r.data.kg} kg`)
                  .join(" / ") || "Sin registro"
              }
              sub="Una medición no define la tendencia"
            />
            <Stat
              label="Alimentos y bebidas"
              valor={String(d.health.summary.consumed_entries)}
              sub={
                d.health.summary.meals_complete
                  ? "Día marcado completo"
                  : "Día abierto"
              }
            />
          </div>
          <div className="two-cols">
            <section className="card n-card">
              <div className="section-head">
                <h2>Siguiente paso</h2>
                <Link to="/tareas">Ver tareas →</Link>
              </div>
              {d.tasks.tasks.length ? (
                d.tasks.tasks.slice(0, 3).map((t: Task) => (
                  <div className="list-row" key={t.id}>
                    <Badge>{projectLabels[t.project]}</Badge>
                    <h3>{t.title}</h3>
                    <p>{t.next_action}</p>
                    <small>{stamp(t.review_at)}</small>
                  </div>
                ))
              ) : (
                <Empty>
                  No hay pendientes activos registrados. Eso no confirma que no
                  tengas obligaciones.
                </Empty>
              )}
            </section>
            <section className="card n-card">
              <h2>Cuidarte también cuenta</h2>
              <p>
                {d.health.summary.weight_present
                  ? "Tu peso de hoy ya está registrado."
                  : "Puedes registrar el peso de esta mañana si lo mediste."}
              </p>
              <p>
                {d.health.summary.activity_declared
                  ? `Actividad: ${{ trained: "gimnasio", sport: "deporte", rest: "descanso" }[d.health.summary.activity_declared as string]}.`
                  : "Actividad de hoy aún sin declarar."}
              </p>
              <div className="quick-links">
                <Link className="btn-primary" to="/salud">
                  Registrar mi día
                </Link>
                <Link className="btn-ghost" to="/finanzas">
                  Revisar dinero
                </Link>
              </div>
              <p className="muted">
                El chat y esta web comparten los registros. La ausencia de datos
                se mantiene como desconocida.
              </p>
            </section>
          </div>
        </>
      )}
    </Page>
  );
}

type Spec = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  hint?: string;
};
function EntryForm({
  title,
  specs,
  initial = {},
  onSave,
  onClose,
}: {
  title: string;
  specs: Spec[];
  initial?: Data;
  onSave: (values: Data, id: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Data>(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const rid = useRef(crypto.randomUUID());
  const digest = useRef("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    const key = JSON.stringify(values);
    if (key !== digest.current) {
      rid.current = crypto.randomUUID();
      digest.current = key;
    }
    setBusy(true);
    setError("");
    try {
      await onSave(
        Object.fromEntries(
          specs
            .filter((s) => values[s.key] !== undefined)
            .map((s) => [s.key, values[s.key]]),
        ),
        rid.current,
      );
      toast("Guardado en la base compartida");
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      titulo={title}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit} className="entry-form">
        {specs.map((s) => (
          <Field key={s.key} label={s.label} hint={s.hint}>
            {s.options ? (
              <select
                value={values[s.key] ?? ""}
                onChange={(e) =>
                  setValues({ ...values, [s.key]: e.target.value })
                }
                required={s.required}
              >
                <option value="">Selecciona…</option>
                {s.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : s.type === "textarea" ? (
              <textarea
                rows={3}
                value={values[s.key] ?? ""}
                onChange={(e) =>
                  setValues({ ...values, [s.key]: e.target.value })
                }
                required={s.required}
              />
            ) : (
              <input
                type={s.type || "text"}
                step={s.type === "number" ? "any" : undefined}
                value={values[s.key] ?? ""}
                onChange={(e) =>
                  setValues({ ...values, [s.key]: e.target.value })
                }
                required={s.required}
              />
            )}
          </Field>
        ))}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="form-foot">
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="btn-primary" disabled={busy}>
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
        <small>
          No se guarda sin conexión. Si falla, reintenta aquí; la misma
          solicitud no se duplica.
        </small>
      </form>
    </Modal>
  );
}
const options = (d: Data) =>
  Object.entries(d).map(([value, label]) => ({ value, label: String(label) }));
function Tasks() {
  const [d, reload, loading, error] = useLive<{
    tasks: Task[];
    task_revision: number;
    truncated: boolean;
  }>("tasks");
  const [edit, setEdit] = useState<Task | null | undefined>(undefined),
    [filter, setFilter] = useState("active");
  const specs: Spec[] = [
    {
      key: "project",
      label: "Proyecto",
      required: true,
      options: options(projectLabels),
    },
    { key: "title", label: "Pendiente", required: true },
    {
      key: "next_action",
      label: "Siguiente acción concreta",
      type: "textarea",
      required: true,
    },
    {
      key: "review_at",
      label: "Fecha y hora de seguimiento (México)",
      type: "datetime-local",
      hint: "Vacío significa sin fecha. No crea una alerta externa.",
    },
    ...(edit
      ? [
          {
            key: "status",
            label: "Estado",
            required: true,
            options: options(statusLabels),
          },
        ]
      : []),
  ];
  return (
    <Page
      titulo="Tareas"
      icono="checks"
      accion={
        <button className="btn-primary" onClick={() => setEdit(null)}>
          + Nuevo pendiente
        </button>
      }
    >
      <div className="toolbar">
        <select
          aria-label="Filtro de tareas"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="active">Activas</option>
          <option value="all">Todas</option>
          <option value="done">Terminadas</option>
        </select>
        <button className="btn-ghost" onClick={reload}>
          Actualizar
        </button>
      </div>
      <ErrorBox error={error} retry={reload} />
      {!d ? (
        loading ? (
          <Loading />
        ) : null
      ) : (
        <section className="card n-card">
          {d.tasks
            .filter(
              (t) =>
                filter === "all" ||
                (filter === "active" &&
                  ["open", "waiting"].includes(t.status)) ||
                t.status === filter,
            )
            .map((t) => (
              <article className="list-row" key={t.id}>
                <div className="section-head">
                  <Badge>
                    {projectLabels[t.project]} · {statusLabels[t.status]}
                  </Badge>
                  <button className="btn-ghost" onClick={() => setEdit(t)}>
                    Editar
                  </button>
                </div>
                <h3>{t.title}</h3>
                <p>{t.next_action}</p>
                <small>{stamp(t.review_at)}</small>
                <Evidence source={t.source} version={t.version} />
              </article>
            ))}
          {!d.tasks.some(
            (t) =>
              filter === "all" ||
              (filter === "active" && ["open", "waiting"].includes(t.status)) ||
              t.status === filter,
          ) && <Empty>No hay tareas en este filtro.</Empty>}
          {d.truncated && (
            <p>La lista tiene más de 50 registros; esta vista es parcial.</p>
          )}
          <Evidence source={`Tareas · revisión ${d.task_revision}`} />
        </section>
      )}
      {edit !== undefined && (
        <EntryForm
          title={edit ? "Editar pendiente" : "Nuevo pendiente"}
          specs={edit ? specs.filter((s) => s.key !== "project") : specs}
          initial={
            edit
              ? {
                  ...edit,
                  review_at: edit.review_at
                    ? new Intl.DateTimeFormat("sv-SE", {
                        timeZone: "America/Mexico_City",
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })
                        .format(new Date(edit.review_at))
                        .replace(" ", "T")
                    : "",
                }
              : { project: "nodo" }
          }
          onClose={() => setEdit(undefined)}
          onSave={(v, id) => {
            const changes = {
              title: v.title,
              next_action: v.next_action,
              review_at: v.review_at ? `${v.review_at}:00-06:00` : null,
              ...(edit ? { status: v.status } : {}),
            };
            return edit
              ? mutate(
                  "task.update",
                  { task_id: edit.id, expected_version: edit.version, changes },
                  id,
                )
              : mutate("task.capture", { ...changes, project: v.project }, id);
          }}
        />
      )}
    </Page>
  );
}
function Agenda() {
  const [date, setDate] = useState(localDay());
  const [d, reload, loading, error] = useLive<Data>("agenda", {
    date,
    days: 7,
  });
  const [tasks] = useLive<{ tasks: Task[] }>("tasks");
  const end = new Date(`${date}T12:00:00-06:00`);
  end.setDate(end.getDate() + 7);
  const endDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(end);
  const sources: Data[] = d?.sources || [];
  const covered =
    sources.length > 0 &&
    sources.every(
      (s) => s.last_success && date >= s.window_start && endDay <= s.window_end,
    );
  const stale = sources.some(
    (s) =>
      s.last_error ||
      !s.last_success ||
      Date.now() - new Date(s.last_success).getTime() > 15 * 60000,
  );
  const events: Data[] = d?.events || [];
  const meetings = events.filter((e) => e.category === "meeting"),
    reminders = events.filter((e) => e.category === "reminder");
  const observances = events.filter((e) => e.category === "observance");
  const conflictIds = new Set<string>((d?.conflicts || []).flat());
  const eventRow = (e: Data) => (
    <article className="list-row" key={e.id}>
      <div className="section-head">
        <Badge>{e.all_day ? "Todo el día" : stamp(e.start)}</Badge>
        {conflictIds.has(e.id) && <Badge>Coincide con otro evento</Badge>}
      </div>
      <h3>{e.title}</h3>
      {e.all_day ? (
        <p>
          {e.start}
          {e.end !==
          new Date(new Date(`${e.start}T12:00:00Z`).getTime() + 86400000)
            .toISOString()
            .slice(0, 10)
            ? ` → ${e.end} (fin exclusivo)`
            : ""}
        </p>
      ) : (
        <p>Hasta {stamp(e.end)}</p>
      )}
      {e.location && <p className="muted">{e.location}</p>}
    </article>
  );
  return (
    <Page
      titulo="Agenda"
      icono="calendar"
      accion={
        <button className="btn-ghost" onClick={reload}>
          Actualizar vista
        </button>
      }
    >
      <div className="toolbar">
        <Field label="Semana desde">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </Field>
        <button className="btn-ghost" onClick={() => setDate(localDay())}>
          Hoy
        </button>
        <a
          className="btn-ghost"
          href="https://calendar.google.com/calendar/u/0/r/week?authuser=arturohernandezdharak%40gmail.com"
          target="_blank"
          rel="noreferrer"
        >
          Abrir Google Calendar ↗
        </a>
      </div>
      <ErrorBox error={error} retry={reload} />
      {!d ? (
        loading ? (
          <Loading />
        ) : null
      ) : (
        <>
          <section className="day-hero">
            <div>
              <p className="eyebrow">GOOGLE CALENDAR · LECTURA PRIVADA</p>
              <h2>Tu semana, en contexto.</h2>
              <p>
                Eventos de tu calendario principal, junto a los siguientes pasos
                de Nodo.
              </p>
              {sources.map((s) => (
                <div key={s.id}>
                  <Evidence
                    source={`${s.name} · última consulta correcta ${stamp(s.last_success)}`}
                  />
                  {s.last_error && (
                    <p className="error-text" role="status">
                      {s.last_error}
                    </p>
                  )}
                </div>
              ))}
              {!sources.length && (
                <p>
                  Conexión pendiente de la primera consulta. La ausencia de
                  eventos todavía no confirma una agenda vacía.
                </p>
              )}
            </div>
            <NodoIsotipo size={72} />
          </section>
          {stale && (
            <p className="notice">
              La copia no está actualizada o no pudo comprobarse. Consulta
              Google antes de tomar decisiones de horario.
            </p>
          )}
          {!covered && (
            <p className="notice">
              Esta semana no está completamente cubierta por la copia
              sincronizada. No interpretes una lista vacía como disponibilidad.
            </p>
          )}
          {d.conflicts.length > 0 && (
            <p className="notice">
              Hay {d.conflicts.length} coincidencia(s) de horario entre eventos.
              No se movió ninguna cita.
            </p>
          )}
          <div className="two-cols">
            <section className="card n-card">
              <div className="section-head">
                <h2>Eventos del calendario</h2>
                <Badge>{meetings.length}</Badge>
              </div>
              {meetings.map(eventRow)}
              {!meetings.length && (
                <Empty>
                  {covered && !stale
                    ? "No hay citas en los próximos siete días de esta copia."
                    : "No hay eventos disponibles en la copia para este rango."}
                </Empty>
              )}
            </section>
            <section className="card n-card">
              <h2>Seguimientos de Nodo</h2>
              {(tasks?.tasks || [])
                .filter((t) => ["open", "waiting"].includes(t.status))
                .map((t) => (
                  <article className="list-row" key={t.id}>
                    <Badge>{projectLabels[t.project]}</Badge>
                    <h3>{t.title}</h3>
                    <p>{t.next_action}</p>
                    <small>{stamp(t.review_at)}</small>
                  </article>
                ))}
              {tasks &&
                !tasks.tasks.some((t) =>
                  ["open", "waiting"].includes(t.status),
                ) && <Empty>No hay seguimientos activos registrados.</Empty>}
              <Link to="/tareas">Organizar pendientes →</Link>
            </section>
          </div>
          <details className="card n-card">
            <summary>Efemérides · {observances.length}</summary>
            {observances.map(eventRow)}
            {!observances.length && (
              <Empty>No hay efemérides importadas en esta semana.</Empty>
            )}
          </details>
          <details className="card n-card">
            <summary>
              Rutinas y recordatorios de calendario · {reminders.length}
            </summary>
            {reminders.map(eventRow)}
            {!reminders.length && (
              <Empty>No hay recordatorios importados en esta semana.</Empty>
            )}
          </details>
          <p className="muted">
            Actualización automática cada cinco minutos desde Hetzner. Google
            puede demorar la publicación de cambios. Sólo lectura: los cambios y
            avisos se gestionan en Google Calendar o mediante el chat; aquí no
            se crean reuniones ni notificaciones. Las pruebas de aviso quedan
            fuera.
          </p>
          {d.truncated && (
            <p className="notice">
              Hay más eventos de los que caben en esta vista. Abre Google para
              la lista completa.
            </p>
          )}
        </>
      )}
    </Page>
  );
}
const healthNames: Data = {
  weight: "Peso",
  food: "Alimento",
  drink: "Bebida",
  workout: "Entrenamiento",
  wellbeing: "Bienestar",
  sleep: "Sueño",
  day_status: "Cierre del día",
  daily_estimate: "Estimación diaria",
  legacy: "Registro histórico",
};
const healthSpecs: Record<string, Spec[]> = {
  weight: [
    { key: "kg", label: "Peso (kg)", type: "number", required: true },
    {
      key: "conditions",
      label: "Condiciones de medición",
      hint: "Por ejemplo: después de ir al baño, antes de comer.",
    },
  ],
  food: [
    {
      key: "description",
      label: "Qué comiste",
      type: "textarea",
      required: true,
    },
    { key: "quantity", label: "Cantidad aproximada", required: true },
    {
      key: "state",
      label: "Estado",
      required: true,
      options: options({
        consumed: "Consumido",
        planned: "Planeado",
        void: "Anulado",
      }),
    },
  ],
  drink: [
    { key: "description", label: "Qué bebiste", required: true },
    { key: "quantity", label: "Cantidad y tamaño", required: true },
    {
      key: "state",
      label: "Estado",
      required: true,
      options: options({
        consumed: "Consumido",
        planned: "Planeado",
        void: "Anulado",
      }),
    },
  ],
  workout: [
    { key: "description", label: "Sesión realizada", required: true },
    { key: "elapsed_minutes", label: "Duración total (min)", type: "number" },
    {
      key: "active_minutes",
      label: "Minutos activos conocidos",
      type: "number",
    },
    {
      key: "details",
      label: "Ejercicios, series, repeticiones y pesos",
      type: "textarea",
    },
  ],
  wellbeing: [
    {
      key: "description",
      label: "Cómo te sientes",
      type: "textarea",
      required: true,
    },
    {
      key: "pain",
      label: "¿Hay dolor?",
      options: options({ true: "Sí", false: "No" }),
    },
  ],
  sleep: [
    { key: "hours", label: "Horas de sueño", type: "number", required: true },
    { key: "description", label: "Calidad o notas" },
  ],
  day_status: [
    {
      key: "meals_complete",
      label: "Registro de comidas",
      options: options({ true: "Completo", false: "Aún abierto" }),
    },
    {
      key: "activity",
      label: "Actividad declarada",
      options: options({
        trained: "Gimnasio",
        sport: "Deporte",
        rest: "Descanso",
      }),
    },
    { key: "description", label: "Notas", type: "textarea" },
  ],
};
const nutritionSpecs: Spec[] = [
  {
    key: "kcal",
    label: "Calorías conocidas o estimadas (kcal)",
    type: "number",
  },
  { key: "protein_g", label: "Proteína (g)", type: "number" },
  { key: "carbs_g", label: "Carbohidratos (g)", type: "number" },
  { key: "fat_g", label: "Grasa (g)", type: "number" },
  {
    key: "estimated",
    label: "Origen nutricional",
    options: options({ true: "Estimación", false: "Etiqueta o dato medido" }),
  },
  {
    key: "assumptions",
    label: "Fuente y supuestos de la estimación",
    type: "textarea",
    hint: "Necesario si ingresas calorías o macros. Deja cantidades desconocidas vacías.",
  },
];
function Health() {
  const [day, setDay] = useState(localDay()),
    [kind, setKind] = useState("food"),
    [edit, setEdit] = useState<RecordItem | null | undefined>(undefined);
  const [d, reload, loading, error] = useLive<Data>("health", { date: day });
  const [trend] = useLive<Data>("health.trend", { date: day });
  const nutrition = d?.summary.estimated_totals_of_known_entries;
  const specs = [
    {
      key: "event_date",
      label: "Fecha del evento",
      type: "date",
      required: true,
    },
    ...(healthSpecs[kind] || []),
    ...(["food", "drink", "daily_estimate"].includes(kind)
      ? nutritionSpecs
      : []),
  ];
  return (
    <Page
      titulo="Salud"
      icono="heart"
      accion={
        <button className="btn-primary" onClick={() => setEdit(null)}>
          + Registrar
        </button>
      }
    >
      <div className="toolbar">
        <input
          aria-label="Día de salud"
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
        <select
          aria-label="Tipo de registro"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          {Object.keys(healthSpecs).map((k) => (
            <option key={k} value={k}>
              {healthNames[k]}
            </option>
          ))}
        </select>
        <button className="btn-ghost" onClick={reload}>
          Actualizar
        </button>
      </div>
      <ErrorBox error={error} retry={reload} />
      {!d ? (
        loading ? (
          <Loading />
        ) : null
      ) : (
        <>
          <div className="kpi-grid">
            <Stat
              label="Peso registrado"
              valor={
                d.records
                  .filter((r: RecordItem) => r.kind === "weight")
                  .map((r: RecordItem) => `${r.data.kg} kg`)
                  .join(" / ") || "Sin dato"
              }
            />
            <Stat
              label="Calorías registradas"
              valor={
                nutrition?.kcal == null ? "Sin dato" : `${nutrition.kcal} kcal`
              }
              sub={
                d.summary.nutrition_partial
                  ? "Parcial · faltan cantidades nutricionales"
                  : "Suma de ingestas registradas"
              }
            />
            <Stat
              label="Proteína registrada"
              valor={
                nutrition?.protein_g == null
                  ? "Sin dato"
                  : `${nutrition.protein_g} g`
              }
              sub="No es una meta nutricional"
            />
            <Stat
              label="Estado del día"
              valor={d.summary.meals_complete ? "Completo" : "Abierto"}
              sub={
                d.summary.activity_declared
                  ? { trained: "Gimnasio", sport: "Deporte", rest: "Descanso" }[
                      d.summary.activity_declared as string
                    ]
                  : "Actividad desconocida"
              }
            />
          </div>
          <section className="card n-card">
            <h2>Tu peso, con perspectiva</h2>
            {trend && (
              <LineChart
                points={trend.days.flatMap((x: Data) =>
                  x.weights.length ? [x.weights[x.weights.length - 1]] : [],
                )}
              />
            )}
            <p className="muted">
              Últimos 14 días. Sólo mediciones registradas; la gráfica conecta
              puntos, no rellena días. No confirma grasa perdida ni déficit.
            </p>
          </section>
          <section className="card n-card">
            <h2>Registro de {day}</h2>
            {d.records.map((r: RecordItem) => (
              <article className="list-row" key={r.id}>
                <div className="section-head">
                  <Badge>{healthNames[r.kind]}</Badge>
                  {healthSpecs[r.kind] && (
                    <button
                      className="btn-ghost"
                      onClick={() => {
                        setKind(r.kind);
                        setEdit(r);
                      }}
                    >
                      Corregir
                    </button>
                  )}
                </div>
                <h3>
                  {r.data.description ||
                    (r.data.kg && `${r.data.kg} kg`) ||
                    (r.data.hours && `${r.data.hours} horas`) ||
                    "Estado declarado"}
                </h3>
                {Object.entries(r.data)
                  .filter(([k]) => k !== "description")
                  .map(([k, v]) => (
                    <p className="detail" key={k}>
                      <span>
                        {(
                          {
                            quantity: "Cantidad",
                            state: "Estado",
                            conditions: "Condiciones",
                            details: "Detalle",
                            elapsed_minutes: "Duración total (min)",
                            active_minutes: "Minutos activos",
                            kcal: "kcal",
                            protein_g: "Proteína (g)",
                            carbs_g: "Carbohidratos (g)",
                            fat_g: "Grasa (g)",
                            estimated: "Estimación",
                            assumptions: "Fuente / supuestos",
                            meals_complete: "Comidas completas",
                            activity: "Actividad",
                            pain: "Dolor",
                          } as Data
                        )[k] || k}
                      </span>
                      <strong>
                        {v == null
                          ? "Desconocido"
                          : typeof v === "boolean"
                            ? v
                              ? "Sí"
                              : "No"
                            : typeof v === "object"
                              ? JSON.stringify(v)
                              : String(v)}
                      </strong>
                    </p>
                  ))}
                <Evidence source={r.source} version={r.version} />
              </article>
            ))}
            {!d.records.length && (
              <Empty>No hay registros para esta fecha.</Empty>
            )}
            <Evidence source={`Salud · revisión ${d.health_revision}`} />
          </section>
          <p className="muted">
            El registro ayuda a observar hábitos. Las calorías y macros
            desconocidos no se inventan; una estimación diaria no se suma dos
            veces. Ajustes de dieta y rutina siguen sujetos a revisión.
          </p>
        </>
      )}
      {edit !== undefined && (
        <EntryForm
          title={
            edit
              ? `Corregir ${healthNames[kind]}`
              : `Registrar ${healthNames[kind]}`
          }
          specs={specs}
          initial={{
            event_date: edit?.event_date || day,
            ...(["food", "drink"].includes(kind) ? { state: "consumed" } : {}),
            ...(edit?.data || {}),
          }}
          onClose={() => setEdit(undefined)}
          onSave={(v, id) => {
            const { event_date, ...raw } = v;
            const data: Data = {};
            for (const [k, val] of Object.entries(raw)) {
              if (val === "" || val == null) continue;
              data[k] = [
                "kg",
                "hours",
                "elapsed_minutes",
                "active_minutes",
                "kcal",
                "protein_g",
                "carbs_g",
                "fat_g",
              ].includes(k)
                ? Number(val)
                : ["estimated", "pain", "meals_complete"].includes(k)
                  ? val === true || val === "true"
                  : val;
            }
            return edit
              ? mutate(
                  "health.correct",
                  {
                    record_id: edit.id,
                    expected_version: edit.version,
                    event_date,
                    data,
                  },
                  id,
                )
              : mutate("health.capture", { kind, event_date, data }, id);
          }}
        />
      )}
    </Page>
  );
}
const financeNames: Data = {
  account: "Cuenta",
  commitment: "Cobro o pago pendiente",
  movement: "Ingreso o gasto realizado",
  transfer: "Transferencia",
  observation: "Saldo observado",
  budget: "Reserva de gastos",
};
function Finance() {
  const [day, setDay] = useState(localDay()),
    [kind, setKind] = useState("movement"),
    [edit, setEdit] = useState<RecordItem | null | undefined>(undefined);
  const [d, reload, loading, error] = useLive<Data>("finance", { date: day });
  const accounts = (d?.accounts || []).map((a: Data) => ({
    value: a.record.id,
    label: `${a.record.data.name} · ${a.record.data.currency}`,
  }));
  const budgets = (d?.budgets || []).map((b: Data) => ({
    value: b.record.id,
    label: b.record.data.title,
  }));
  const commitments = (d?.commitments || [])
    .filter((c: Data) => c.remaining_cents > 0)
    .map((c: Data) => ({
      value: c.record.id,
      label: `${c.record.data.title} · ${c.record.data.direction === "in" ? "cobrar" : "pagar"}`,
    }));
  const amount: Spec = {
    key: "amount",
    label: "Importe (pesos o dólares según la cuenta)",
    type: "number",
    required: true,
  };
  const date: Spec = {
    key: "event_date",
    label: "Fecha real del movimiento",
    type: "date",
    required: true,
  };
  const description: Spec = {
    key: "description",
    label: "Descripción",
    required: true,
  };
  const currency: Spec = {
    key: "currency",
    label: "Moneda",
    required: true,
    options: options({ MXN: "MXN", USD: "USD" }),
  };
  const account: Spec = {
    key: "account_id",
    label: "Cuenta",
    required: true,
    options: accounts,
  };
  const budget: Spec = {
    key: "budget_id",
    label: "Reserva vinculada (opcional)",
    options: budgets,
    hint: "Sólo gastos dentro del período. Evita descontar dos veces la reserva.",
  };
  const specs: Record<string, Spec[]> = {
    account: [
      { key: "name", label: "Nombre de cuenta", required: true },
      currency,
      {
        key: "opening",
        label: "Saldo inicial ya neto",
        type: "number",
        required: true,
      },
      {
        key: "opening_date",
        label: "Fecha del saldo inicial",
        type: "date",
        required: true,
      },
      { key: "notes", label: "Qué operaciones ya incluye", type: "textarea" },
    ],
    commitment: [
      { key: "title", label: "Concepto", required: true },
      currency,
      {
        key: "direction",
        label: "Dirección",
        required: true,
        options: options({ in: "Por cobrar", out: "Por pagar" }),
      },
      amount,
      { key: "due_date", label: "Fecha exacta conocida", type: "date" },
      {
        key: "expected_month",
        label: "Mes previsto si no hay fecha",
        type: "month",
      },
      {
        key: "certainty",
        label: "Certeza",
        required: true,
        options: options({
          declared: "Declarado",
          conditional: "Condicionado",
        }),
      },
      {
        key: "capital",
        label: "Capital identificado (opcional)",
        type: "number",
      },
      {
        key: "profit",
        label: "Ganancia identificada (opcional)",
        type: "number",
      },
      budget,
      { key: "notes", label: "Condiciones / fuente", type: "textarea" },
    ],
    movement: [
      account,
      date,
      {
        key: "direction",
        label: "Dirección",
        required: true,
        options: options({ in: "Entrada", out: "Salida" }),
      },
      amount,
      {
        key: "classification",
        label: "Clasificación",
        required: true,
        options: options({
          income: "Ingreso",
          expense: "Gasto",
          capital_recovery: "Recuperación de capital",
          capital_payment: "Pago de capital",
          loan_received: "Préstamo recibido",
          loan_repayment: "Devolución de préstamo",
          unclassified: "Sin clasificar",
        }),
      },
      {
        key: "commitment_id",
        label: "Cobro o pago que liquida (opcional)",
        options: commitments,
      },
      budget,
      description,
    ],
    transfer: [
      {
        key: "from_account_id",
        label: "Desde",
        required: true,
        options: accounts,
      },
      {
        key: "to_account_id",
        label: "Hacia",
        required: true,
        options: accounts,
      },
      date,
      amount,
      description,
    ],
    observation: [
      account,
      date,
      {
        key: "balance",
        label: "Saldo observado (no modifica saldo documental)",
        type: "number",
        required: true,
      },
      description,
    ],
    budget: [
      { key: "title", label: "Concepto", required: true },
      currency,
      amount,
      { key: "period_start", label: "Desde", type: "date", required: true },
      { key: "period_end", label: "Hasta", type: "date", required: true },
      { key: "notes", label: "Notas", type: "textarea" },
    ],
  };
  const initial = edit
    ? Object.fromEntries(
        Object.entries(edit.data).map(([k, v]) => [
          (
            {
              amount_cents: "amount",
              opening_cents: "opening",
              balance_cents: "balance",
              capital_cents: "capital",
              profit_cents: "profit",
            } as Data
          )[k] || k,
          k.endsWith("_cents") && v != null ? v / 100 : v,
        ]),
      )
    : {
        currency: "MXN",
        event_date: day,
        opening_date: day,
        certainty: "declared",
      };
  return (
    <Page
      titulo="Dinero"
      icono="wallet"
      accion={
        <button className="btn-primary" onClick={() => setEdit(null)}>
          + Registrar
        </button>
      }
    >
      <div className="toolbar">
        <input
          aria-label="Fecha de corte"
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
        <select
          aria-label="Tipo de registro financiero"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          {Object.entries(financeNames).map(([k, v]) => (
            <option key={k} value={k}>
              {String(v)}
            </option>
          ))}
        </select>
        <button className="btn-ghost" onClick={reload}>
          Actualizar
        </button>
      </div>
      <ErrorBox error={error} retry={reload} />
      {!d ? (
        loading ? (
          <Loading />
        ) : null
      ) : (
        <>
          {Object.entries(d.totals_by_currency).map(([currency, raw]) => {
            const t = raw as Data;
            return (
              <section key={currency}>
                <p className="eyebrow">
                  CORTE DOCUMENTAL · {currency} · {d.as_of}
                </p>
                <div className="kpi-grid">
                  <Stat
                    label="Saldo documental"
                    valor={cash(t.ledger_cash_cents, currency)}
                    sub="Declarado · no conciliado"
                  />
                  <Stat
                    label="Por cobrar"
                    valor={cash(t.pending_in_cents, currency)}
                    sub="Incluye cobros condicionados"
                  />
                  <Stat
                    label="Por pagar"
                    valor={cash(t.pending_out_cents, currency)}
                    sub="Compromisos pendientes"
                  />
                  <Stat
                    label="Proyección condicionada"
                    valor={cash(t.conditional_projection_cents, currency)}
                    sub={`Tras reservas de ${cash(t.budget_reserve_cents, currency)}`}
                  />
                </div>
              </section>
            );
          })}
          <div className="two-cols">
            <section className="card n-card">
              <h2>Cuentas y reservas</h2>
              {d.accounts.map((a: Data) => (
                <div className="list-row" key={a.record.id}>
                  <h3>{a.record.data.name}</h3>
                  <strong className="money-large">
                    {cash(a.ledger_balance_cents, a.record.data.currency)}
                  </strong>
                  <p className="muted">
                    Saldo inicial {a.record.data.opening_date} ·{" "}
                    {a.record.data.notes}
                  </p>
                </div>
              ))}
              {d.budgets.map((b: Data) => (
                <div className="list-row" key={b.record.id}>
                  <h3>{b.record.data.title}</h3>
                  <p>
                    Reserva restante:{" "}
                    <strong>
                      {cash(b.remaining_cents, b.record.data.currency)}
                    </strong>
                  </p>
                  <small>
                    {b.record.data.period_start} a {b.record.data.period_end}
                  </small>
                </div>
              ))}
            </section>
            <section className="card n-card">
              <h2>Cobros y pagos</h2>
              {d.commitments.map((c: Data) => (
                <div className="list-row" key={c.record.id}>
                  <Badge>
                    {c.record.data.direction === "in"
                      ? "Por cobrar"
                      : "Por pagar"}
                    {c.record.data.certainty === "conditional"
                      ? " · condicionado"
                      : ""}
                  </Badge>
                  <h3>{c.record.data.title}</h3>
                  <strong>
                    {cash(c.remaining_cents, c.record.data.currency)}
                  </strong>
                  <p>
                    {c.record.data.due_date ||
                      c.record.data.expected_month ||
                      "Sin fecha exacta"}
                  </p>
                  <small>{c.record.data.notes}</small>
                </div>
              ))}
            </section>
          </div>
          <section className="card n-card">
            <h2>Registros y correcciones</h2>
            {d.records.map((r: RecordItem) => (
              <div className="list-row" key={r.id}>
                <div className="section-head">
                  <div>
                    <Badge>{financeNames[r.kind]}</Badge>
                    <h3>{r.data.title || r.data.name || r.data.description}</h3>
                  </div>
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      setKind(r.kind);
                      setEdit(r);
                    }}
                  >
                    Corregir
                  </button>
                </div>
                <Evidence source={r.source} version={r.version} />
              </div>
            ))}
            {d.records_truncated && (
              <p>Historial parcial: más de 200 registros.</p>
            )}
            <Evidence source={`Finanzas · revisión ${d.finance_revision}`} />
          </section>
          <p className="notice">
            La proyección combina vencimientos distintos: no es efectivo
            disponible ni utilidad. No se mueve dinero desde esta web. Los
            saldos observados no ajustan la contabilidad automáticamente.
          </p>
        </>
      )}
      {edit !== undefined && (
        <EntryForm
          title={
            edit
              ? `Corregir ${financeNames[kind]}`
              : `Registrar ${financeNames[kind]}`
          }
          specs={specs[kind] || []}
          initial={initial}
          onClose={() => setEdit(undefined)}
          onSave={(v, id) => {
            const data: Data = {};
            const cents: Data = {
              amount: "amount_cents",
              opening: "opening_cents",
              balance: "balance_cents",
              capital: "capital_cents",
              profit: "profit_cents",
            };
            for (const [k, val] of Object.entries(v)) {
              if (val === "" || val == null) continue;
              if (cents[k]) {
                if (!/^\d+(\.\d{1,2})?$/.test(String(val)))
                  throw Error(
                    "Importes positivos con un máximo de dos decimales.",
                  );
                data[cents[k]] = Math.round(Number(val) * 100);
              } else data[k] = val;
            }
            if (kind === "commitment") data.due_date = data.due_date || null;
            return edit
              ? mutate(
                  "finance.correct",
                  {
                    record_id: edit.id,
                    expected_version: edit.version,
                    data,
                    void: false,
                  },
                  id,
                )
              : mutate("finance.capture", { kind, data }, id);
          }}
        />
      )}
    </Page>
  );
}
function Memory() {
  const [domain, setDomain] = useState("continuidad"),
    [edit, setEdit] = useState<Data | null>(null);
  const [d, reload, loading, error] = useLive<Data>("memory", { domain });
  const domains = {
    continuidad: "Continuidad",
    objetivos: "Objetivos",
    proyectos: "Proyectos",
    perfil: "Perfil",
    preferencias: "Preferencias",
    permisos: "Permisos",
    agenda: "Agenda documentada",
    sistema: "Sistema",
    salud: "Contexto de salud",
    finanzas: "Contexto financiero",
    persona: "Vida personal",
    privado: "Contexto privado",
    proyectos_detalle: "Expedientes",
    archivo: "Archivo",
  };
  return (
    <Page titulo="Memoria" icono="target">
      <div className="toolbar">
        <select
          aria-label="Dominio de memoria"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
        >
          {options(domains).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button className="btn-ghost" onClick={reload}>
          Actualizar
        </button>
      </div>
      <p className="notice">
        Contexto compartido, con fuentes y versiones. Una propuesta de cambio se
        guarda para revisión; no reemplaza automáticamente un hecho confirmado.
      </p>
      <ErrorBox error={error} retry={reload} />
      {!d ? (
        loading ? (
          <Loading />
        ) : null
      ) : (
        <section className="card n-card">
          {d.records.map((r: Data) => (
            <article className="list-row memory-entry" key={r.id}>
              <div className="section-head">
                <Badge>{r.domain}</Badge>
                <button className="btn-ghost" onClick={() => setEdit(r)}>
                  Proponer corrección
                </button>
              </div>
              <p>{r.text}</p>
              <Evidence source={r.source} version={r.version} />
            </article>
          ))}
          {!d.records.length && <Empty>Sin documentos en este dominio.</Empty>}
          {d.truncated && (
            <p>Vista parcial: hay más de 50 documentos en este dominio.</p>
          )}
          <Evidence
            source={`Memoria · revisión ${d.revision} · ${stamp(d.read_at)}`}
          />
        </section>
      )}
      {edit && (
        <EntryForm
          title="Proponer corrección de memoria"
          specs={[
            {
              key: "text",
              label: "Texto propuesto",
              type: "textarea",
              required: true,
            },
          ]}
          initial={{ text: edit.text }}
          onClose={() => setEdit(null)}
          onSave={(v, id) =>
            mutate(
              "memory.propose",
              {
                record_id: edit.id,
                expected_version: edit.version,
                text: v.text,
              },
              id,
            )
          }
        />
      )}
    </Page>
  );
}
function System() {
  const [d, reload, loading, error] = useLive<Data>("system");
  return (
    <Page
      titulo="Sistema"
      icono="settings"
      accion={
        <button className="btn-ghost" onClick={reload}>
          Comprobar
        </button>
      }
    >
      <ErrorBox error={error} retry={reload} />
      {!d ? (
        loading ? (
          <Loading />
        ) : null
      ) : (
        <>
          <section className="day-hero">
            <div>
              <p className="eyebrow">NODO VIDA · {d.version}</p>
              <h2>Una base. Varias entradas.</h2>
              <p>
                Esta web escribe en los mismos registros que el chat de Nodo.
              </p>
              <Evidence
                source={`Comprobado ${stamp(d.read_at)} · memoria revisión ${d.context_revision}`}
              />
            </div>
            <NodoIsotipo size={80} />
          </section>
          <section className="card n-card">
            <h2>Último estado operativo conocido</h2>
            {d.operational ? (
              <>
                <p>
                  Servicio Nodo:{" "}
                  <strong>{d.operational.backend_service}</strong>
                </p>
                <p>
                  Último respaldo cifrado correcto:{" "}
                  <strong>
                    {stamp(d.operational.backup?.completed_at_utc)}
                  </strong>
                </p>
                <p>
                  {d.operational.backup
                    ?.snapshot_restore_before_wrapping_verified
                    ? "Instantánea restaurada y verificada antes de cifrar."
                    : "Restauración de esta copia no confirmada."}
                </p>
                <p>
                  {d.operational.backup?.offsite
                    ? "Copia externa registrada."
                    : "Copia en el mismo servidor; destino externo pendiente."}
                </p>
                <Evidence
                  source={`Estado revisado ${stamp(d.operational.checked_at)}`}
                />
                <p className="muted">{d.operational.scope}</p>
              </>
            ) : (
              <p>Estado de respaldos no disponible en esta instalación.</p>
            )}
          </section>
          <div className="two-cols">
            {[
              ["Base", d.storage],
              ["Zona horaria", d.timezone],
              ["Agenda", d.calendar],
              ["Notificaciones", d.notifications],
              ["Conectividad", d.offline],
              [
                "Instalar en iPhone",
                "Safari → Compartir → Agregar a pantalla de inicio. La instalación no activa notificaciones por sí sola.",
              ],
            ].map(([title, text]) => (
              <section className="card n-card" key={title}>
                <h2>{title}</h2>
                <p>{text}</p>
              </section>
            ))}
          </div>
          <p className="notice">
            El servicio web funciona en Hetzner. La autonomía del ciclo completo
            —automatizaciones, alertas y entrega al móvil— debe comprobarse por
            separado. Cerrar sesión no borra registros.
          </p>
        </>
      )}
    </Page>
  );
}
function Authenticated() {
  const { usuario, cargando } = useAuth();
  if (cargando) return <Loading />;
  if (!usuario) return <Login />;
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tareas" element={<Tasks />} />
        <Route path="/avisos" element={<Notifications />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/finanzas" element={<Finance />} />
        <Route path="/salud" element={<Health />} />
        <Route path="/memoria" element={<Memory />} />
        <Route path="/sistema" element={<System />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Authenticated />
        <Avisos />
      </AuthProvider>
    </BrowserRouter>
  );
}

type TimedItem = { title: string; at: string; all_day: boolean };
type Focus = {
  primary: null | {
    title: string;
    source: "apertura" | "compromiso";
    first_action: string | null;
    at?: string;
    all_day?: boolean;
  };
  secondary: Array<TimedItem & { id: string; kind: string }>;
  conflicts: Array<{ titles: [string, string]; at: string; kind: "overlap" | "check_timing" }>;
  needs_first_action: boolean;
};

const timeLabel = (at: string, allDay?: boolean) => allDay ? "Todo el día" :
  new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", timeStyle: "short" }).format(new Date(at));

export default function DailyFocus({ focus }: { focus: Focus }) {
  const { primary, secondary, conflicts } = focus;
  return <section className="card n-card focus-card" aria-label="Dirección diaria">
    <h2>Dirección de hoy</h2>
    {primary ? <>
      <p>{primary.source === "apertura" ? "Tu prioridad" : "Próximo compromiso"}</p>
      <h3>{primary.title}</h3>
      {primary.at && <p>{timeLabel(primary.at, primary.all_day)}</p>}
      {primary.first_action && <p><strong>Primer paso</strong> · {primary.first_action}</p>}
      {focus.needs_first_action && <a href="#morning-questions">Definir primer paso en tu apertura</a>}
    </> : <p>Elige tu prioridad en la apertura de hoy.</p>}
    {secondary.length > 0 && <ul>
      {secondary.map(item => <li key={item.id}>{timeLabel(item.at, item.all_day)} · {item.title}</li>)}
    </ul>}
    {conflicts.length > 0 && <ul>
      {conflicts.map(({ at, titles, kind }) => <li key={at + titles.join("|")}>
        {kind === "overlap" ? "Cruce de horario" : "Revisa el horario"} · {titles.join(" / ")}
      </li>)}
    </ul>}
  </section>;
}

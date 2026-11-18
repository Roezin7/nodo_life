import { useRef, useState } from "react";
import { mutate } from "./api";

type Opening = { day: string; state: string; alert_id?: string };

export default function MorningCheckIn({ opening, onConfirmed }: {
  opening?: Opening; onConfirmed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmedId, setConfirmedId] = useState("");
  const requests = useRef<Record<string, string>>({});
  if (!opening || !["pending", "responded"].includes(opening.state)) return null;
  const answered = opening.state === "responded" || confirmedId === opening.alert_id;
  async function confirm() {
    if (!opening?.alert_id || busy) return;
    const id = opening.alert_id;
    requests.current[id] ||= crypto.randomUUID();
    setBusy(true); setError("");
    try {
      await mutate("notification.ack", { notice_id: id }, requests.current[id]);
      setConfirmedId(id); onConfirmed();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="card n-card" aria-label="Apertura del día">
    <p className="eyebrow">TU MAÑANA</p>
    <h2>{answered ? "Ya retomamos tu día" : "Buen día, Arturo"}</h2>
    <p>{answered
      ? "La apertura está confirmada. Tus actividades y pendientes conservan su estado."
      : "¿Listo para organizar tu día? Puedes continuar aquí, aunque no estés cerca de Alexa."}</p>
    {!answered && <button className="btn-primary" disabled={busy || !opening.alert_id} onClick={confirm}>
      {busy ? "Confirmando…" : "Estoy aquí · empezar mi día"}
    </button>}
    {!answered && <p className="evidence">Confirmar detiene el respaldo pendiente de esta apertura. Un aviso ya enviado puede permanecer en tu teléfono.</p>}
    {error && <p role="alert" className="error-text">{error}</p>}
  </section>;
}

import { useRef, useState } from "react";
import { mutate } from "./api";

type Entry = { answer: string | null; version: number };
export type CheckIn = {
  day: string;
  questions: Record<string, string>;
  answers: Record<string, Entry>;
  next_question: string | null;
};

export default function MorningQuestions({ checkin, reload }: { checkin: CheckIn; reload: () => void }) {
  const [edit, setEdit] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [firstAction, setFirstAction] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<{ payload: string; id: string } | null>(null);
  const question = edit ?? checkin.next_question;
  const answer = question === "priority" && firstAction.trim()
    ? `${draft.trim()}\nPrimer paso: ${firstAction.trim()}`
    : draft.trim();
  async function save(answer: string | null) {
    if (pending || !question) return;
    const params = { event_date: checkin.day, question, answer, expected_version: checkin.answers[question]?.version ?? 0 };
    const payload = JSON.stringify(params);
    if (request.current?.payload !== payload) request.current = { payload, id: crypto.randomUUID() };
    setPending(true);
    setError("");
    try {
      await mutate("morning.save", params, request.current.id);
      request.current = null;
      setDraft("");
      setFirstAction("");
      setEdit(null);
      reload();
    } catch (err) {
      setError((err as Error).message);
    } finally { setPending(false); }
  }
  return <section id="morning-questions" className="card n-card" aria-label="Preguntas de la mañana">
    <h2>Tu plan de hoy</h2>
    {Object.entries(checkin.answers).map(([key, entry]) => <div className="list-row" key={key}>
      <p>{checkin.questions[key]}</p>
      <p>{entry.answer ?? "Omitida"}</p>
      <button type="button" className="btn-ghost" disabled={pending} onClick={() => {
        setEdit(key);
        const [text, ...step] = key === "priority" ? (entry.answer ?? "").split("\nPrimer paso:") : [entry.answer ?? ""];
        setDraft(text);
        setFirstAction(step.join("\nPrimer paso:").trim());
        setError("");
      }}>Corregir</button>
    </div>)}
    {question && <form onSubmit={e => { e.preventDefault(); if (draft.trim() && answer.length <= 500) void save(answer); }}>
      <label htmlFor="morning-answer">{question === "priority" ? "¿Cuál es tu prioridad de hoy?" : checkin.questions[question]}</label>
      <textarea id="morning-answer" maxLength={500} value={draft} disabled={pending} onChange={e => setDraft(e.target.value)} />
      {question === "priority" && <label>¿Qué harás primero? <input maxLength={400} value={firstAction} disabled={pending} onChange={e => setFirstAction(e.target.value)} /></label>}
      {answer.length > 500 && <p role="alert">Acorta la prioridad o el primer paso a un total de 500 caracteres.</p>}
      <button className="btn-primary" disabled={pending || !draft.trim() || answer.length > 500}>{pending ? "Guardando…" : "Guardar respuesta"}</button>
      <button className="btn-ghost" type="button" disabled={pending} onClick={() => void save(null)}>Omitir</button>
      {edit && <button className="btn-ghost" type="button" disabled={pending} onClick={() => { setEdit(null); setDraft(""); setFirstAction(""); }}>Cancelar edición</button>}
    </form>}
    {error && <p role="alert">{error} <button className="btn-ghost" onClick={reload}>Actualizar</button></p>}
  </section>;
}

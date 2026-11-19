// Selo "AEP"/"AET" no risco que veio do laudo (0.3.308, banco v363). Risco lançado à mão não mostra nada.
export default function SeloOrigemRisco({ origem }: { origem?: string | null }) {
  if (origem !== "AEP" && origem !== "AET") return null;
  return (
    <span
      title={`Trazido da ${origem} desta inspeção`}
      className="ml-1.5 inline-flex rounded bg-sky-100 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-sky-700"
    >
      {origem}
    </span>
  );
}

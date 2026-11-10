"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { PRIORIDADES, useSlaQuadro, useSalvarSlaQuadro } from "@/lib/hooks/useGestao";

// Metas escolhidas pelo usuário em 10/11/2026 ("mais folgado"): horas de 1ª resposta / resolução.
const PADRAO: Record<string, { resposta: number; resolucao: number }> = {
  Urgente: { resposta: 120, resolucao: 480 },
  Alta: { resposta: 240, resolucao: 960 },
  Media: { resposta: 480, resolucao: 1440 },
  Baixa: { resposta: 960, resolucao: 4800 },
};
const DIAS = [
  { n: 1, r: "Seg" }, { n: 2, r: "Ter" }, { n: 3, r: "Qua" }, { n: 4, r: "Qui" }, { n: 5, r: "Sex" }, { n: 6, r: "Sáb" }, { n: 7, r: "Dom" },
];
const paraHoras = (min: number) => String(Math.round((min / 60) * 100) / 100).replace(".", ",");
const paraMin = (h: string) => Math.max(0, Math.round(parseFloat(h.replace(",", ".") || "0") * 60));

/**
 * Prazo de atendimento do quadro (v353, item 8 — como no Jira Service Management): 1ª resposta e resolução por
 * prioridade, contadas no horário comercial escolhido. Só quem edita o quadro altera (a RLS confere).
 */
export default function SlaConfigModal({ open, onClose, idQuadro, nomeQuadro, podeEditar }: {
  open: boolean;
  onClose: () => void;
  idQuadro: string;
  nomeQuadro: string;
  podeEditar: boolean;
}) {
  const { data: cfg, isLoading } = useSlaQuadro(open ? idQuadro : null);
  const salvar = useSalvarSlaQuadro();
  const [ativo, setAtivo] = useState(false);
  const [metas, setMetas] = useState<Record<string, { resposta: string; resolucao: string }>>({});
  const [hi, setHi] = useState("08:00");
  const [hf, setHf] = useState("18:00");
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5]);

  useEffect(() => {
    if (!open || isLoading) return;
    const m = cfg?.metas ?? PADRAO;
    setAtivo(cfg?.ativo ?? false);
    setMetas(Object.fromEntries(PRIORIDADES.map((p) => {
      const v = m[p.value] ?? PADRAO[p.value];
      return [p.value, { resposta: paraHoras(v.resposta), resolucao: paraHoras(v.resolucao) }];
    })));
    setHi(cfg?.hora_inicio?.slice(0, 5) ?? "08:00");
    setHf(cfg?.hora_fim?.slice(0, 5) ?? "18:00");
    setDias(cfg?.dias ?? [1, 2, 3, 4, 5]);
  }, [open, isLoading, cfg]);

  async function gravar() {
    if (hf <= hi) { toast.error("O fim do expediente precisa ser depois do início."); return; }
    if (!dias.length) { toast.error("Escolha pelo menos um dia de atendimento."); return; }
    const m = Object.fromEntries(PRIORIDADES.map((p) => [p.value, { resposta: paraMin(metas[p.value]?.resposta ?? "0"), resolucao: paraMin(metas[p.value]?.resolucao ?? "0") }]));
    await salvar.mutateAsync({ id_quadro: idQuadro, ativo, metas: m, hora_inicio: hi, hora_fim: hf, dias: [...dias].sort() });
    toast.success(ativo ? "Prazo de atendimento salvo" : "Prazo de atendimento desligado");
    onClose();
  }

  const cx = "w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-marca-primary focus:outline-none disabled:bg-gray-50";
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Prazo de atendimento · ${nomeQuadro}`}
      size="lg"
      footer={podeEditar ? (
        <div className="flex justify-end">
          <button type="button" onClick={gravar} disabled={salvar.isPending} className="inline-flex items-center gap-2 rounded-lg bg-marca-primary px-5 py-2 text-sm font-semibold text-white hover:bg-marca-accent disabled:opacity-50">
            {salvar.isPending && <Loader2 className="size-4 animate-spin" />} Salvar
          </button>
        </div>
      ) : undefined}
    >
      {isLoading ? <p className="text-sm text-gray-400">Carregando…</p> : (
        <div className="space-y-4 text-sm">
          <label className="flex items-center gap-2 font-medium text-gray-800">
            <input type="checkbox" checked={ativo} disabled={!podeEditar} onChange={(e) => setAtivo(e.target.checked)} className="size-4 accent-marca-primary" />
            Contar prazo de atendimento neste quadro
          </label>
          <p className="text-xs text-gray-500">
            <b>1ª resposta</b>: primeiro comentário ou mudança de coluna feita por outra pessoa que não quem abriu.{" "}
            <b>Resolução</b>: entrar numa coluna do tipo Concluído. Os prazos contam só no expediente abaixo. Avisa os
            responsáveis da tarefa quando a resolução passa de 75% do prazo e quando um prazo estoura.
            {cfg?.vigente_desde && <> Vale para tarefas criadas desde {new Date(cfg.vigente_desde).toLocaleDateString("pt-BR")}.</>}
          </p>
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-gray-500"><th className="py-1 font-medium">Prioridade</th><th className="py-1 font-medium">1ª resposta (h)</th><th className="py-1 font-medium">Resolução (h)</th></tr>
            </thead>
            <tbody>
              {PRIORIDADES.map((p) => (
                <tr key={p.value}>
                  <td className="py-1"><span className="mr-2 inline-block size-2.5 rounded-full align-middle" style={{ background: p.cor }} />{p.label}</td>
                  <td className="py-1"><input inputMode="decimal" value={metas[p.value]?.resposta ?? ""} disabled={!podeEditar} aria-label={`1ª resposta ${p.label} (horas)`} onChange={(e) => setMetas((s) => ({ ...s, [p.value]: { ...s[p.value], resposta: e.target.value } }))} className={cx} /></td>
                  <td className="py-1"><input inputMode="decimal" value={metas[p.value]?.resolucao ?? ""} disabled={!podeEditar} aria-label={`Resolução ${p.label} (horas)`} onChange={(e) => setMetas((s) => ({ ...s, [p.value]: { ...s[p.value], resolucao: e.target.value } }))} className={cx} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-gray-600">Expediente</span>
            <input type="time" value={hi} disabled={!podeEditar} onChange={(e) => setHi(e.target.value)} aria-label="Início do expediente" className={`${cx} w-28`} />
            <span className="text-gray-500">às</span>
            <input type="time" value={hf} disabled={!podeEditar} onChange={(e) => setHf(e.target.value)} aria-label="Fim do expediente" className={`${cx} w-28`} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DIAS.map((d) => {
              const on = dias.includes(d.n);
              return (
                <button key={d.n} type="button" disabled={!podeEditar} onClick={() => setDias((s) => (on ? s.filter((x) => x !== d.n) : [...s, d.n]))}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${on ? "border-marca-primary bg-marca-light text-marca-primary" : "border-gray-200 text-gray-500 hover:bg-gray-100"}`}>
                  {d.r}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}

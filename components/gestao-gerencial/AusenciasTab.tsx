"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Loader2, CalendarOff } from "lucide-react";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import {
  useGGEquipe, useGGAusencias, useGGAusenciaMut, TIPOS_AUSENCIA, rotuloTipoAusencia,
  type GGAusencia,
} from "@/lib/hooks/useGestaoGerencial";

const fmt = (d: string) => {
  const [y, m, dia] = d.split("-");
  return dia && m && y ? `${dia}/${m}/${y}` : d;
};

/**
 * Ausências dos profissionais da unidade (folga/férias/atestado/falta/in loco).
 * Alimentam a verificação de substituição por data.
 */
export default function AusenciasTab({ idUnidade }: { idUnidade: string }) {
  const podeEditar = useCanEdit();
  const equipe = useGGEquipe(idUnidade);
  const ausencias = useGGAusencias(idUnidade);
  const mut = useGGAusenciaMut();
  const [excluir, setExcluir] = useState<GGAusencia | null>(null);

  const profissionais = useMemo(
    () => (equipe.data ?? []).map((v) => ({ id: v.id_profissional, nome: v.profissional?.nome ?? "—" })),
    [equipe.data],
  );

  return (
    <section className="space-y-4">
      {profissionais.length === 0 ? (
        <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-4 text-center text-sm text-amber-800">
          Cadastre profissionais na aba <em>Profissionais</em> antes de registrar ausências.
        </p>
      ) : (
        podeEditar && <AddAusencia idUnidade={idUnidade} profissionais={profissionais} mut={mut} />
      )}

      {ausencias.isLoading ? (
        <p className="text-sm text-gray-500">Carregando…</p>
      ) : (ausencias.data ?? []).length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
          Nenhuma ausência registrada.
        </p>
      ) : (
        <ul className="space-y-2">
          {(ausencias.data ?? []).map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
              <CalendarOff className="size-4 shrink-0 text-gray-400" />
              <span className="font-medium text-gray-900">{a.profissional?.nome ?? "—"}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.tipo === "in_loco" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"}`}>
                {rotuloTipoAusencia(a.tipo)}
              </span>
              <span className="text-sm text-gray-600">
                {fmt(a.data_inicio)}{a.data_fim !== a.data_inicio ? ` – ${fmt(a.data_fim)}` : ""}
              </span>
              {a.obs && <span className="text-xs text-gray-400 italic">“{a.obs}”</span>}
              {podeEditar && (
                <button
                  type="button"
                  onClick={() => setExcluir(a)}
                  className="ml-auto rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-alert"
                  title="Excluir ausência"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!excluir}
        title="Excluir ausência"
        description={`Excluir a ausência de "${excluir?.profissional?.nome}"?`}
        confirmLabel="Excluir"
        variant="danger"
        loading={mut.excluir.isPending}
        onConfirm={() => {
          if (!excluir) return;
          mut.excluir.mutate({ id: excluir.id, id_unidade: idUnidade }, { onSuccess: () => setExcluir(null) });
        }}
        onCancel={() => setExcluir(null)}
      />
    </section>
  );
}

function AddAusencia({
  idUnidade, profissionais, mut,
}: {
  idUnidade: string;
  profissionais: { id: string; nome: string }[];
  mut: ReturnType<typeof useGGAusenciaMut>;
}) {
  const [idProf, setIdProf] = useState("");
  const [tipo, setTipo] = useState<string>("folga");
  const [ini, setIni] = useState("");
  const [fim, setFim] = useState("");
  const [obs, setObs] = useState("");

  function salvar() {
    if (!idProf) { toast.error("Selecione o profissional"); return; }
    if (!ini) { toast.error("Informe a data inicial"); return; }
    const dataFim = fim || ini;
    if (dataFim < ini) { toast.error("A data final não pode ser antes da inicial"); return; }
    mut.criar.mutate(
      { id_unidade: idUnidade, id_profissional: idProf, tipo, data_inicio: ini, data_fim: dataFim, obs },
      { onSuccess: () => { setIdProf(""); setIni(""); setFim(""); setObs(""); setTipo("folga"); } },
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          Profissional
          <select value={idProf} onChange={(e) => setIdProf(e.target.value)} className="min-w-[180px] rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none">
            <option value="">Selecione…</option>
            {profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none">
            {TIPOS_AUSENCIA.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          Início
          <input type="date" value={ini} onChange={(e) => setIni(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          Fim <span className="text-gray-400">(opcional)</span>
          <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} min={ini} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none" />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-gray-600">
          Observação
          <input type="text" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="opcional" className="min-w-[120px] rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none" />
        </label>
        <button
          type="button"
          onClick={salvar}
          disabled={mut.criar.isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
        >
          {mut.criar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Registrar
        </button>
      </div>
    </div>
  );
}

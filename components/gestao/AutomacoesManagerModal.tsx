"use client";

import { Plus, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { confirmar } from "@/components/ui/confirm";
import {
  useAutomacoes, useSalvarAutomacao, useExcluirAutomacao, useUsuariosLista,
  PRIORIDADES, type GestaoAutomacao, type GestaoStatus, type GatilhoAutomacao, type GestaoCampo,
} from "@/lib/hooks/useGestao";

const GATILHOS: { value: GatilhoAutomacao; label: string }[] = [
  { value: "status_muda", label: "Quando o status muda" },
  { value: "tarefa_criada", label: "Quando a tarefa é criada" },
  { value: "prazo_proximo", label: "Quando o prazo se aproxima" },
  { value: "prazo_vencido", label: "Quando o prazo vence (atrasada)" },
];
const ACOES: { value: string; label: string }[] = [
  { value: "mover_status", label: "Mover para status" },
  { value: "definir_responsavel", label: "Definir responsável" },
  { value: "definir_prioridade", label: "Definir prioridade" },
  { value: "definir_campo", label: "Definir campo" },
  { value: "notificar", label: "Notificar responsável" },
];
const sel = "rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none";

export default function AutomacoesManagerModal({
  open, onClose, idQuadro, statuses, campos, podeEditar,
}: {
  open: boolean;
  onClose: () => void;
  idQuadro: string;
  statuses: GestaoStatus[];
  campos: GestaoCampo[];
  podeEditar: boolean;
}) {
  const { data: automacoes = [] } = useAutomacoes(idQuadro);
  const { data: usuarios = [] } = useUsuariosLista();
  const salvar = useSalvarAutomacao();
  const excluir = useExcluirAutomacao();

  const setCampo = (a: GestaoAutomacao, patch: Partial<GestaoAutomacao>) => salvar.mutate({ id: a.id, id_quadro: idQuadro, ...patch });
  const setCond = (a: GestaoAutomacao, patch: Record<string, string | undefined>) => salvar.mutate({ id: a.id, id_quadro: idQuadro, condicao: { ...a.condicao, ...patch } });
  const setAcao = (a: GestaoAutomacao, patch: Record<string, string | undefined>) => salvar.mutate({ id: a.id, id_quadro: idQuadro, acao: { ...a.acao, ...patch } });

  return (
    <Modal open={open} onClose={onClose} title="Automações" size="lg">
      <div className="space-y-3">
        {automacoes.map((a) => (
          <div key={a.id} className="space-y-2 rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              <input defaultValue={a.nome} disabled={!podeEditar} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== a.nome) setCampo(a, { nome: v }); }}
                className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm font-medium focus:border-verde-primary focus:outline-none" />
              <label className="inline-flex items-center gap-1 text-xs text-gray-500">
                <input type="checkbox" disabled={!podeEditar} checked={a.ativo} onChange={(e) => setCampo(a, { ativo: e.target.checked })} className="size-3.5 rounded accent-verde-primary" /> Ativa
              </label>
              {podeEditar && <button type="button" onClick={async () => { if (await confirmar({ title: `Excluir automação "${a.nome}"?` })) excluir.mutate(a.id); }} className="rounded p-1 text-gray-300 hover:text-red-600"><Trash2 className="size-4" /></button>}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs font-semibold uppercase text-gray-400">Quando</span>
              <select value={a.gatilho} disabled={!podeEditar} onChange={(e) => setCampo(a, { gatilho: e.target.value as GatilhoAutomacao })} className={sel}>
                {GATILHOS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
              {a.gatilho === "status_muda" && (
                <>
                  <span className="text-gray-400">de</span>
                  <select value={a.condicao?.de ?? ""} disabled={!podeEditar} onChange={(e) => setCond(a, { de: e.target.value || undefined })} className={sel}>
                    <option value="">qualquer</option>
                    {statuses.map((s) => <option key={s.slug} value={s.slug}>{s.nome}</option>)}
                  </select>
                  <span className="text-gray-400">para</span>
                  <select value={a.condicao?.para ?? ""} disabled={!podeEditar} onChange={(e) => setCond(a, { para: e.target.value || undefined })} className={sel}>
                    <option value="">qualquer</option>
                    {statuses.map((s) => <option key={s.slug} value={s.slug}>{s.nome}</option>)}
                  </select>
                </>
              )}
              {a.gatilho === "prazo_proximo" && (
                <>
                  <input type="number" min={0} max={90} value={a.condicao?.dias_antes ?? "3"} disabled={!podeEditar}
                    onChange={(e) => setCond(a, { dias_antes: e.target.value || undefined })} className={`${sel} w-16`} />
                  <span className="text-gray-400">dia(s) antes do prazo</span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs font-semibold uppercase text-gray-400">Então</span>
              <select value={a.acao?.tipo ?? ""} disabled={!podeEditar} onChange={(e) => setAcao(a, { tipo: e.target.value, valor: undefined })} className={sel}>
                <option value="">escolher ação…</option>
                {ACOES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
              </select>
              {a.acao?.tipo === "mover_status" && (
                <select value={a.acao?.valor ?? ""} disabled={!podeEditar} onChange={(e) => setAcao(a, { valor: e.target.value })} className={sel}>
                  <option value="">status…</option>
                  {statuses.map((s) => <option key={s.slug} value={s.slug}>{s.nome}</option>)}
                </select>
              )}
              {a.acao?.tipo === "definir_responsavel" && (
                <>
                  <input list="autom-usuarios" defaultValue={a.acao?.valor ?? ""} disabled={!podeEditar} onBlur={(e) => setAcao(a, { valor: e.target.value.trim() })} placeholder="responsável" className={sel} />
                  <datalist id="autom-usuarios">{usuarios.map((u) => <option key={u} value={u} />)}</datalist>
                </>
              )}
              {a.acao?.tipo === "definir_prioridade" && (
                <select value={a.acao?.valor ?? ""} disabled={!podeEditar} onChange={(e) => setAcao(a, { valor: e.target.value })} className={sel}>
                  <option value="">prioridade…</option>
                  {PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              )}
              {a.acao?.tipo === "definir_campo" && (
                <>
                  <select value={a.acao?.campo_id ?? ""} disabled={!podeEditar} onChange={(e) => setAcao(a, { campo_id: e.target.value, valor: undefined })} className={sel}>
                    <option value="">campo…</option>
                    {campos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                  <input defaultValue={a.acao?.valor ?? ""} disabled={!podeEditar} onBlur={(e) => setAcao(a, { valor: e.target.value.trim() })} placeholder="valor" className={sel} />
                  {campos.length === 0 && <span className="text-[11px] text-gray-400">crie um campo primeiro</span>}
                </>
              )}
              {a.acao?.tipo === "notificar" && (
                <input defaultValue={a.acao?.valor ?? ""} disabled={!podeEditar} onBlur={(e) => setAcao(a, { valor: e.target.value.trim() })} placeholder="mensagem (opcional)" className={`${sel} flex-1`} />
              )}
            </div>
            {(a.gatilho === "prazo_proximo" || a.gatilho === "prazo_vencido") && <p className="text-[11px] text-gray-400">Verificada diariamente pelo servidor (não precisa estar com o quadro aberto).</p>}
          </div>
        ))}
        {podeEditar && (
          <button type="button" onClick={() => salvar.mutate({ id_quadro: idQuadro, nome: "Nova automação", gatilho: "status_muda", ordem: automacoes.length })} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-verde-primary ring-1 ring-dashed ring-verde-primary/40 hover:bg-verde-light/40">
            <Plus className="size-4" /> Nova automação
          </button>
        )}
        {automacoes.length === 0 && !podeEditar && <p className="text-sm text-gray-400">Nenhuma automação.</p>}
        <p className="pt-1 text-xs text-gray-400">As automações rodam no servidor: as de status/criação disparam na hora; as de prazo são verificadas diariamente.</p>
      </div>
    </Modal>
  );
}

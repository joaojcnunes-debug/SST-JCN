"use client";

import { useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  useProdUnidades,
  useProdColaboradores,
  useProdAlocacoes,
  useSaveUnidade,
  useDeleteUnidade,
  useSaveColaborador,
  useSaveAlocacoes,
  useDeleteColaborador,
  TIPO_COLABORADOR_LABEL,
  type ProdUnidade,
  type ProdColaborador,
  type TipoColaborador,
} from "@/lib/hooks/useProdutividade";
import { useCanEdit } from "@/lib/hooks/useUsuario";

// ── Modais ────────────────────────────────────────────────────────────────────

function ModalUnidade({
  initial,
  onClose,
}: {
  initial?: Partial<ProdUnidade>;
  onClose: () => void;
}) {
  const [nome, setNome]             = useState(initial?.nome ?? "");
  const [cidade, setCidade]         = useState(initial?.cidade ?? "");
  const [responsavel, setResponsavel] = useState(initial?.responsavel ?? "");
  const [equipeDe, setEquipeDe]     = useState(initial?.id_unidade_equipe ?? "");
  const save = useSaveUnidade();
  const { data: unidades = [] } = useProdUnidades();
  // Só pode compartilhar de unidades que têm equipe própria (não são, elas mesmas, compartilhadas).
  const opcoesEquipe = unidades.filter((u) => u.id !== initial?.id && !u.id_unidade_equipe);

  async function handleSave() {
    if (!nome.trim()) { toast.error("Informe o nome da unidade"); return; }
    try {
      await save.mutateAsync({
        id: initial?.id,
        nome: nome.trim(),
        cidade: cidade.trim() || null,
        responsavel: responsavel.trim() || null,
        id_unidade_equipe: equipeDe || null,
      });
      toast.success(initial?.id ? "Unidade atualizada" : "Unidade criada");
      onClose();
    } catch {
      toast.error("Erro ao salvar unidade");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="font-semibold text-gray-900">{initial?.id ? "Editar unidade" : "Nova unidade"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100"><X className="size-4" /></button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Nome da unidade *</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Ex: Unidade São Paulo" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Cidade</label>
            <input value={cidade} onChange={(e) => setCidade(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Ex: São Paulo – SP" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Responsável</label>
            <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Nome do responsável" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Equipe</label>
            <select value={equipeDe} onChange={(e) => setEquipeDe(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">Equipe própria</option>
              {opcoesEquipe.map((u) => (
                <option key={u.id} value={u.id}>Compartilha a equipe de {u.nome}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-gray-400">
              Use &quot;compartilha&quot; quando esta unidade é atendida pela mesma equipe de outra (ex.: Piabetá usa a equipe de Guapimirim). A projeção soma a demanda das duas e conta a equipe uma vez.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50">Cancelar</button>
          <button type="button" onClick={handleSave} disabled={save.isPending} className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
            {save.isPending && <Loader2 className="size-3.5 animate-spin" />}
            {initial?.id ? "Salvar" : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalColaborador({
  idUnidade,
  initial,
  onClose,
}: {
  idUnidade: string;
  initial?: Partial<ProdColaborador>;
  onClose: () => void;
}) {
  const [nome, setNome]               = useState(initial?.nome ?? "");
  const [tipo, setTipo]               = useState<TipoColaborador>(initial?.tipo ?? "documentos");
  const [capDocs, setCapDocs]         = useState(String(initial?.capacidade_docs_mes ?? 0));
  const [capVisitas, setCapVisitas]   = useState(String(initial?.capacidade_visitas_mes ?? 0));
  const save = useSaveColaborador();
  const saveAlocacoes = useSaveAlocacoes();
  const { data: unidades = [] } = useProdUnidades();
  const { data: alocacoes = [] } = useProdAlocacoes();

  // Rateio entre unidades (% de dedicação). Só editável ao EDITAR um colaborador.
  const rateioInicial = initial?.id
    ? alocacoes.filter((a) => a.id_colaborador === initial.id).map((a) => ({ id_unidade: a.id_unidade, percentual: a.percentual }))
    : [];
  const [rateio, setRateio] = useState<{ id_unidade: string; percentual: number }[]>(
    rateioInicial.length > 0 ? rateioInicial : [{ id_unidade: idUnidade, percentual: 100 }],
  );
  const somaPct = rateio.reduce((s, r) => s + (r.percentual || 0), 0);
  const rateioMultiplo = rateio.length > 1;

  async function handleSave() {
    if (!nome.trim()) { toast.error("Informe o nome"); return; }
    if (rateioMultiplo && somaPct !== 100) { toast.error("Os percentuais do rateio devem somar 100%"); return; }
    try {
      await save.mutateAsync({
        id: initial?.id,
        // unidade "casa" = a 1ª do rateio (ou a unidade atual)
        id_unidade: rateio[0]?.id_unidade || idUnidade,
        nome: nome.trim(),
        tipo,
        capacidade_docs_mes: Number(capDocs) || 0,
        capacidade_visitas_mes: Number(capVisitas) || 0,
      });
      // Salva o rateio só ao editar (precisa do id). Rateio único = sem linhas (100% na unidade).
      if (initial?.id) {
        await saveAlocacoes.mutateAsync({
          id_colaborador: initial.id,
          alocacoes: rateioMultiplo ? rateio : [],
        });
      }
      toast.success(initial?.id ? "Colaborador atualizado" : "Colaborador adicionado");
      onClose();
    } catch {
      toast.error("Erro ao salvar");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="font-semibold text-gray-900">{initial?.id ? "Editar colaborador" : "Novo colaborador"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100"><X className="size-4" /></button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Nome *</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Tipo / Função</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoColaborador)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              {Object.entries(TIPO_COLABORADOR_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Cap. docs/mês</label>
              <input type="number" min={0} value={capDocs} onChange={(e) => setCapDocs(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Cap. visitas/mês</label>
              <input type="number" min={0} value={capVisitas} onChange={(e) => setCapVisitas(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>

          {/* Rateio entre unidades (só ao editar — precisa do colaborador salvo) */}
          {initial?.id && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-600">Atua em mais de uma unidade? (rateio)</label>
                <span className={`text-[11px] font-semibold ${rateioMultiplo && somaPct !== 100 ? "text-red-600" : "text-gray-400"}`}>
                  Soma: {somaPct}%
                </span>
              </div>
              <p className="mb-2 text-[11px] text-gray-400">
                A capacidade ({Number(capDocs) || 0} docs / {Number(capVisitas) || 0} vis. por mês) é rateada pelo %. No Geral conta uma vez.
              </p>
              <div className="space-y-2">
                {rateio.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={r.id_unidade}
                      onChange={(e) => setRateio((prev) => prev.map((x, j) => (j === i ? { ...x, id_unidade: e.target.value } : x)))}
                      className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                    </select>
                    <input
                      type="number" min={0} max={100} value={r.percentual}
                      onChange={(e) => setRateio((prev) => prev.map((x, j) => (j === i ? { ...x, percentual: Number(e.target.value) || 0 } : x)))}
                      className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <span className="text-xs text-gray-400">%</span>
                    {rateio.length > 1 && (
                      <button type="button" onClick={() => setRateio((prev) => prev.filter((_, j) => j !== i))} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="size-3.5" /></button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setRateio((prev) => [...prev, { id_unidade: unidades.find((u) => !prev.some((p) => p.id_unidade === u.id))?.id ?? "", percentual: 0 }])}
                className="mt-2 flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
              >
                <Plus className="size-3" /> Adicionar unidade
              </button>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50">Cancelar</button>
          <button type="button" onClick={handleSave} disabled={save.isPending} className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
            {save.isPending && <Loader2 className="size-3.5 animate-spin" />}
            {initial?.id ? "Salvar" : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Card de Unidade ──────────────────────────────────────────────────────────

function UnidadeCard({ unidade }: { unidade: ProdUnidade }) {
  const [expanded, setExpanded]         = useState(false);
  const [editU, setEditU]               = useState(false);
  const [newColab, setNewColab]         = useState(false);
  const [editColab, setEditColab]       = useState<ProdColaborador | null>(null);

  const canEdit = useCanEdit();
  const compartilha = !!unidade.id_unidade_equipe;
  const teamUnitId = unidade.id_unidade_equipe ?? unidade.id;
  const { data: colaboradores = [], isLoading } = useProdColaboradores(teamUnitId);
  const { data: todasUnidades = [] } = useProdUnidades();
  const { data: alocacoes = [] } = useProdAlocacoes();
  const rateioPorColab = (id: string) => alocacoes.filter((a) => a.id_colaborador === id);
  const donaNome = compartilha ? todasUnidades.find((u) => u.id === unidade.id_unidade_equipe)?.nome ?? "outra unidade" : null;
  const deleteU = useDeleteUnidade();
  const deleteC = useDeleteColaborador();

  const tipoCount = (tipo: TipoColaborador) => colaboradores.filter((c) => c.tipo === tipo).length;
  const capDocsMes    = colaboradores.reduce((s, c) => s + c.capacidade_docs_mes, 0);
  const capVisitasMes = colaboradores.reduce((s, c) => s + c.capacidade_visitas_mes, 0);

  return (
    <>
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-black/5">
        {/* Header */}
        <div className="flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white">
            <Building2 className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 truncate">{unidade.nome}</h3>
            <p className="text-xs text-gray-400">
              {unidade.cidade ? `${unidade.cidade} · ` : ""}
              {unidade.responsavel ? `Resp.: ${unidade.responsavel}` : "Sem responsável"}
            </p>
            {compartilha && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                <Users className="size-3" /> Equipe compartilhada de {donaNome}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {canEdit && (
              <>
                <button type="button" onClick={() => setEditU(true)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><Pencil className="size-3.5" /></button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm("Excluir esta unidade e todos os seus colaboradores?")) return;
                    try { await deleteU.mutateAsync(unidade.id); toast.success("Unidade excluída"); }
                    catch { toast.error("Erro ao excluir"); }
                  }}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </>
            )}
            <button type="button" onClick={() => setExpanded((v) => !v)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
              {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 border-t border-gray-50 px-4 py-3">
          {[
            { label: "Padronização", count: tipoCount("padronizacao") },
            { label: "Documentos",   count: tipoCount("documentos")   },
            { label: "Técnicos",     count: tipoCount("tecnico_campo")},
            { label: "Gestão",       count: tipoCount("gestao")       },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-lg font-bold text-teal-700">{s.count}</p>
              <p className="text-[10px] text-gray-400">{s.label}</p>
            </div>
          ))}
          <div className="ml-auto text-right text-xs text-gray-400">
            <p><span className="font-semibold text-gray-700">{capDocsMes}</span> docs/mês (cap.)</p>
            <p><span className="font-semibold text-gray-700">{capVisitasMes}</span> visitas/mês (cap.)</p>
          </div>
        </div>

        {/* Colaboradores expandido */}
        {expanded && (
          <div className="border-t border-gray-100 px-4 pb-4 pt-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                <Users className="mr-1 inline size-3" /> Colaboradores
                {compartilha && <span className="ml-1 normal-case text-amber-600">(equipe de {donaNome})</span>}
              </p>
              {!compartilha && canEdit && (
                <button
                  type="button"
                  onClick={() => setNewColab(true)}
                  className="flex items-center gap-1 rounded-lg bg-teal-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                >
                  <Plus className="size-3" /> Adicionar
                </button>
              )}
            </div>

            {compartilha && (
              <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                Esta unidade usa a equipe de <strong>{donaNome}</strong>. A equipe é gerenciada lá; aqui é só leitura.
              </p>
            )}

            {isLoading && <p className="text-xs text-gray-400">Carregando…</p>}

            {!isLoading && colaboradores.length === 0 && (
              <p className="text-xs text-gray-400 italic">Nenhum colaborador cadastrado</p>
            )}

            <div className="space-y-2">
              {colaboradores.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{c.nome}</p>
                    <p className="text-xs text-gray-400">{TIPO_COLABORADOR_LABEL[c.tipo]}</p>
                    {rateioPorColab(c.id).length > 0 && (
                      <p className="mt-0.5 text-[10px] font-medium text-amber-600">
                        Rateado: {rateioPorColab(c.id).map((a) => `${todasUnidades.find((u) => u.id === a.id_unidade)?.nome ?? "?"} ${a.percentual}%`).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-gray-400">
                    {c.capacidade_docs_mes > 0 && <p>{c.capacidade_docs_mes} docs/mês</p>}
                    {c.capacidade_visitas_mes > 0 && <p>{c.capacidade_visitas_mes} vis./mês</p>}
                  </div>
                  {!compartilha && canEdit && (
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setEditColab(c)} className="rounded p-1 text-gray-400 hover:bg-white hover:text-gray-600"><Pencil className="size-3" /></button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`Excluir ${c.nome}?`)) return;
                          try { await deleteC.mutateAsync(c.id); toast.success("Excluído"); }
                          catch { toast.error("Erro ao excluir"); }
                        }}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {editU     && <ModalUnidade     initial={unidade}       onClose={() => setEditU(false)} />}
      {newColab  && <ModalColaborador idUnidade={unidade.id}  onClose={() => setNewColab(false)} />}
      {editColab && <ModalColaborador idUnidade={unidade.id}  initial={editColab} onClose={() => setEditColab(null)} />}
    </>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────

export default function UnidadesPage() {
  const [showNew, setShowNew] = useState(false);
  const canEdit = useCanEdit();
  const { data: unidades = [], isLoading } = useProdUnidades();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Unidades e Equipe</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Cadastre as 6 unidades da JCN Consultoria e os colaboradores de cada uma
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <Plus className="size-4" /> Nova Unidade
          </button>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      )}

      {!isLoading && unidades.length === 0 && (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-black/5">
          <Building2 className="mx-auto size-12 text-gray-200" />
          <p className="mt-3 font-semibold text-gray-600">Nenhuma unidade cadastrada</p>
          <p className="mt-1 text-sm text-gray-400">Clique em &quot;Nova Unidade&quot; para adicionar as filiais da JCN Consultoria.</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {unidades.map((u) => (
          <UnidadeCard key={u.id} unidade={u} />
        ))}
      </div>

      {showNew && <ModalUnidade onClose={() => setShowNew(false)} />}
    </div>
  );
}

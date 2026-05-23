"use client";

import { useMemo, useState, useRef } from "react";
import {
  List,
  Plus,
  Search,
  Printer,
  Pencil,
  Trash2,
  X,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  Copy,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  useInventarioMaquinas,
  useCriarMaquina,
  useAtualizarMaquina,
  useExcluirMaquina,
  type MaquinaInput,
} from "@/lib/hooks/useInventarioMaquinas";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useCanCreate, useCanEdit, useCanDelete } from "@/lib/hooks/useUsuario";
import RelatorioPrintHeader from "@/components/layout/RelatorioPrintHeader";
import { cn, gerarId } from "@/lib/utils";
import {
  STATUS_MAQUINA_LABELS,
  GRAU_RISCO_MAQUINA_LABELS,
  type Maquina,
  type StatusMaquina,
  type GrauRiscoMaquina,
} from "@/lib/supabase/types";

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_COR: Record<StatusMaquina, string> = {
  OPERANTE: "bg-emerald-100 text-emerald-700",
  MANUTENCAO: "bg-amber-100 text-amber-700",
  INATIVA: "bg-gray-100 text-gray-600",
  BAIXADA: "bg-red-100 text-red-700",
  RESERVA: "bg-blue-100 text-blue-700",
};

const GRAU_RISCO_COR: Record<GrauRiscoMaquina, string> = {
  BAIXO: "bg-emerald-100 text-emerald-700",
  MEDIO: "bg-amber-100 text-amber-700",
  ALTO: "bg-orange-100 text-orange-700",
  CRITICO: "bg-red-100 text-red-700",
};

const INPUT_CLASS =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-gray-50 disabled:text-gray-500";

const BOOL_OPTS = [
  { value: "", label: "— Não informado —" },
  { value: "true", label: "Sim" },
  { value: "false", label: "Não" },
];

function parseBool(v: string): boolean | null {
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}
function fmtBool(v: boolean | null | undefined): string {
  if (v === true) return "Sim";
  if (v === false) return "Não";
  return "—";
}

// ─── Estado inicial do form ──────────────────────────────────────────────────

function initialForm(m?: Maquina): MaquinaInput {
  return {
    id_empresa: m?.id_empresa ?? null,
    nome: m?.nome ?? "",
    tipo: m?.tipo ?? null,
    categoria: m?.categoria ?? null,
    codigo_interno: m?.codigo_interno ?? null,
    tag: m?.tag ?? null,
    marca: m?.marca ?? null,
    modelo: m?.modelo ?? null,
    numero_serie: m?.numero_serie ?? null,
    ano_fabricacao: m?.ano_fabricacao ?? null,
    numero_patrimonio: m?.numero_patrimonio ?? null,
    status: m?.status ?? "OPERANTE",
    unidade: m?.unidade ?? null,
    setor: m?.setor ?? null,
    linha_processo: m?.linha_processo ?? null,
    area: m?.area ?? null,
    responsavel_setor: m?.responsavel_setor ?? null,
    operacao_executada: m?.operacao_executada ?? null,
    localizacao: m?.localizacao ?? null,
    capacidade_operacional: m?.capacidade_operacional ?? null,
    producao_estimada: m?.producao_estimada ?? null,
    potencia: m?.potencia ?? null,
    tensao: m?.tensao ?? null,
    pressao: m?.pressao ?? null,
    capacidade_carga: m?.capacidade_carga ?? null,
    velocidade: m?.velocidade ?? null,
    dimensoes: m?.dimensoes ?? null,
    finalidade: m?.finalidade ?? null,
    descricao_tecnica: m?.descricao_tecnica ?? null,
    protecao_fixa: m?.protecao_fixa ?? null,
    protecao_movel: m?.protecao_movel ?? null,
    intertravamento: m?.intertravamento ?? null,
    botao_emergencia: m?.botao_emergencia ?? null,
    sistema_bloqueio: m?.sistema_bloqueio ?? null,
    possui_manual: m?.possui_manual ?? null,
    possui_diagrama_eletrico: m?.possui_diagrama_eletrico ?? null,
    aterramento: m?.aterramento ?? null,
    sinalizacao: m?.sinalizacao ?? null,
    necessita_adequacao_nr12: m?.necessita_adequacao_nr12 ?? null,
    grau_risco: m?.grau_risco ?? null,
    observacoes_tecnicas: m?.observacoes_tecnicas ?? null,
    observacoes: m?.observacoes ?? null,
    foto_url: m?.foto_url ?? null,
    foto_storage_path: m?.foto_storage_path ?? null,
  };
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function RelacaoMaquinasPage() {
  const canCreate = useCanCreate();
  const canEdit = useCanEdit();
  const canDelete = useCanDelete();

  const { data: maquinas = [], isLoading } = useInventarioMaquinas();
  const { data: empresas = [] } = useEmpresas();
  const criar = useCriarMaquina();
  const atualizar = useAtualizarMaquina();
  const excluir = useExcluirMaquina();

  // Filtros
  const [busca, setBusca] = useState("");
  const [filtroEmpresa, setFiltroEmpresa] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusMaquina | "">("");
  const [filtroGrau, setFiltroGrau] = useState<GrauRiscoMaquina | "">("");
  const [filtroSetor, setFiltroSetor] = useState("");

  // Modal form
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Maquina | null>(null);
  const [form, setForm] = useState<MaquinaInput>(initialForm());
  const [abaAtiva, setAbaAtiva] = useState<0 | 1 | 2 | 3>(0);

  // Exclusão
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState<string | null>(null);

  const empresaMap = useMemo(() => {
    const m = new Map<string, string>();
    empresas.forEach((e) => m.set(e.id_empresa, e.nome_empresa));
    return m;
  }, [empresas]);

  // Setores únicos para filtro
  const setoresUnicos = useMemo(() => {
    const s = new Set<string>();
    maquinas.forEach((m) => { if (m.setor) s.add(m.setor); });
    return Array.from(s).sort();
  }, [maquinas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return maquinas.filter((m) => {
      if (filtroEmpresa && m.id_empresa !== filtroEmpresa) return false;
      if (filtroStatus && m.status !== filtroStatus) return false;
      if (filtroGrau && m.grau_risco !== filtroGrau) return false;
      if (filtroSetor && m.setor !== filtroSetor) return false;
      if (!q) return true;
      return [
        m.nome, m.tipo, m.categoria, m.codigo_interno, m.tag,
        m.marca, m.modelo, m.numero_serie, m.numero_patrimonio,
        m.setor, m.unidade, m.area, m.finalidade,
        empresaMap.get(m.id_empresa ?? "") ?? "",
      ]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }, [maquinas, busca, filtroEmpresa, filtroStatus, filtroGrau, filtroSetor, empresaMap]);

  // Stats
  const stats = useMemo(() => ({
    total: maquinas.length,
    operantes: maquinas.filter((m) => m.status === "OPERANTE").length,
    manutencao: maquinas.filter((m) => m.status === "MANUTENCAO").length,
    necessitaAdequacao: maquinas.filter((m) => m.necessita_adequacao_nr12 === true).length,
  }), [maquinas]);

  function abrirNova() {
    setEditando(null);
    setForm(initialForm());
    setAbaAtiva(0);
    setModalOpen(true);
  }

  function abrirEdicao(m: Maquina) {
    setEditando(m);
    setForm(initialForm(m));
    setAbaAtiva(0);
    setModalOpen(true);
  }

  function abrirDuplicacao(m: Maquina) {
    const clone = initialForm(m);
    clone.nome = `${m.nome} (cópia)`;
    clone.codigo_interno = null;
    clone.tag = null;
    clone.numero_serie = null;
    clone.numero_patrimonio = null;
    setEditando(null);
    setForm(clone);
    setAbaAtiva(0);
    setModalOpen(true);
    toast("Máquina duplicada — revise os dados e salve.", { icon: "📋" });
  }

  function fecharModal() {
    setModalOpen(false);
    setEditando(null);
  }

  function setF(key: keyof MaquinaInput, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSalvar() {
    if (!form.nome.trim()) {
      toast.error("Nome da máquina é obrigatório");
      return;
    }
    try {
      if (editando) {
        await atualizar.mutateAsync({ id_maquina: editando.id_maquina, patch: form });
        toast.success("Máquina atualizada");
      } else {
        await criar.mutateAsync({ input: form });
        toast.success("Máquina cadastrada");
      }
      fecharModal();
    } catch (err) {
      console.error(err);
      toast.error("Falha ao salvar");
    }
  }

  async function handleExcluir(id: string) {
    setExcluindoId(id);
    try {
      await excluir.mutateAsync(id);
      toast.success("Máquina excluída");
      setConfirmarExclusao(null);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao excluir");
    } finally {
      setExcluindoId(null);
    }
  }

  const isPending = criar.isPending || atualizar.isPending;

  return (
    <div className="mx-auto max-w-7xl space-y-6 print:max-w-none">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 1.5cm; }
          body { font-size: 10pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Cabeçalho de impressão */}
      <RelatorioPrintHeader
        titulo="Relação de Máquinas e Equipamentos"
        subtitulo="Atendimento NR-12 — item 1.7 alínea 'a'"
        terciario={`Emitido em ${new Date().toLocaleDateString("pt-BR")}`}
      />

      {/* Topo — tela */}
      <div className="no-print flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
            <List className="size-5 text-orange-600" />
            Relação de Máquinas e Equipamentos
          </h1>
          <p className="text-xs text-gray-500">
            NR-12 item 1.7 alínea &quot;a&quot; — capacidade, finalidade e conformidade
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Printer className="size-4" /> Imprimir / PDF
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={abrirNova}
              className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700"
            >
              <Plus className="size-4" /> Cadastrar máquina
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="no-print grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total cadastrado" valor={stats.total} cor="orange" />
        <StatCard label="Em operação" valor={stats.operantes} cor="emerald" />
        <StatCard label="Em manutenção" valor={stats.manutencao} cor="amber" />
        <StatCard label="Necessita adequação NR-12" valor={stats.necessitaAdequacao} cor="red" />
      </div>

      {/* Filtros */}
      <div className="no-print flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, TAG, modelo, setor..."
            className="w-full rounded-md border border-gray-300 bg-white px-9 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
        <select
          value={filtroEmpresa}
          onChange={(e) => setFiltroEmpresa(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        >
          <option value="">Todas as empresas</option>
          {empresas.map((e) => (
            <option key={e.id_empresa} value={e.id_empresa}>{e.nome_empresa}</option>
          ))}
        </select>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as StatusMaquina | "")}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        >
          <option value="">Todos os status</option>
          {(Object.keys(STATUS_MAQUINA_LABELS) as StatusMaquina[]).map((s) => (
            <option key={s} value={s}>{STATUS_MAQUINA_LABELS[s]}</option>
          ))}
        </select>
        <select
          value={filtroGrau}
          onChange={(e) => setFiltroGrau(e.target.value as GrauRiscoMaquina | "")}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        >
          <option value="">Todos os graus de risco</option>
          {(Object.keys(GRAU_RISCO_MAQUINA_LABELS) as GrauRiscoMaquina[]).map((g) => (
            <option key={g} value={g}>{GRAU_RISCO_MAQUINA_LABELS[g]}</option>
          ))}
        </select>
        {setoresUnicos.length > 0 && (
          <select
            value={filtroSetor}
            onChange={(e) => setFiltroSetor(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            <option value="">Todos os setores</option>
            {setoresUnicos.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
          {maquinas.length === 0 ? (
            <>Nenhuma máquina cadastrada ainda. {canCreate && <><br />Clique em <strong>Cadastrar máquina</strong> para começar.</>}</>
          ) : (
            "Nenhum resultado para os filtros atuais."
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-600">
                <th className="px-3 py-2">Código / TAG</th>
                <th className="px-3 py-2">Máquina / Tipo</th>
                <th className="px-3 py-2">Fabricante / Modelo</th>
                <th className="px-3 py-2">Empresa / Setor</th>
                <th className="px-3 py-2">Finalidade</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Grau de Risco</th>
                <th className="px-3 py-2 no-print">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtradas.map((m, idx) => (
                <tr key={m.id_maquina} className={cn("hover:bg-gray-50", idx % 2 === 1 && "bg-gray-50/40")}>
                  <td className="px-3 py-2">
                    <p className="font-mono text-xs text-gray-700">{m.codigo_interno || "—"}</p>
                    {m.tag && <p className="text-[11px] text-orange-600 font-medium">TAG: {m.tag}</p>}
                    {m.numero_patrimonio && <p className="text-[11px] text-gray-500">Pat.: {m.numero_patrimonio}</p>}
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-semibold text-gray-900">{m.nome}</p>
                    {m.tipo && <p className="text-[11px] text-gray-500">{m.tipo}</p>}
                    {m.categoria && <p className="text-[11px] text-gray-400">{m.categoria}</p>}
                  </td>
                  <td className="px-3 py-2">
                    <p className="text-gray-700">{m.marca || "—"}</p>
                    {m.modelo && <p className="text-[11px] text-gray-500">{m.modelo}</p>}
                    {m.ano_fabricacao && <p className="text-[11px] text-gray-400">Ano: {m.ano_fabricacao}</p>}
                  </td>
                  <td className="px-3 py-2">
                    <p className="text-gray-700">{m.id_empresa ? (empresaMap.get(m.id_empresa) ?? "—") : "Chabra"}</p>
                    {m.setor && <p className="text-[11px] text-gray-500">{m.setor}</p>}
                    {m.unidade && <p className="text-[11px] text-gray-400">{m.unidade}</p>}
                  </td>
                  <td className="max-w-[180px] px-3 py-2">
                    <p className="line-clamp-2 text-[11px] text-gray-600">{m.finalidade || "—"}</p>
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", STATUS_COR[m.status])}>
                      {STATUS_MAQUINA_LABELS[m.status]}
                    </span>
                    {m.necessita_adequacao_nr12 && (
                      <p className="mt-1 text-[10px] font-semibold text-red-600">⚠ Adequação NR-12</p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {m.grau_risco ? (
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", GRAU_RISCO_COR[m.grau_risco])}>
                        {GRAU_RISCO_MAQUINA_LABELS[m.grau_risco]}
                      </span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2 no-print">
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => abrirEdicao(m)}
                          title="Editar"
                          className="rounded p-1 text-gray-500 hover:bg-orange-50 hover:text-orange-600"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      )}
                      {canCreate && (
                        <button
                          type="button"
                          onClick={() => abrirDuplicacao(m)}
                          title="Duplicar"
                          className="rounded p-1 text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Copy className="size-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        confirmarExclusao === m.id_maquina ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleExcluir(m.id_maquina)}
                              disabled={excluindoId === m.id_maquina}
                              className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              {excluindoId === m.id_maquina ? <Loader2 className="size-3 animate-spin" /> : "Confirmar"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmarExclusao(null)}
                              className="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-gray-100"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmarExclusao(m.id_maquina)}
                            title="Excluir"
                            className="rounded p-1 text-gray-500 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
            {filtradas.length} {filtradas.length === 1 ? "máquina" : "máquinas"} exibidas
            {filtradas.length !== maquinas.length && ` de ${maquinas.length} total`}
          </div>
        </div>
      )}

      {/* Rodapé de impressão */}
      <div className="hidden print:block mt-6 text-center text-[9px] text-gray-500 border-t border-gray-200 pt-3">
        Relação de Máquinas e Equipamentos — NR-12 item 1.7 alínea &quot;a&quot; · Gerado por Chabra SST · {new Date().toLocaleDateString("pt-BR")}
      </div>

      {/* Modal de cadastro/edição */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl">
            {/* Header do modal */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-base font-bold text-gray-900">
                {editando ? "Editar Máquina / Equipamento" : "Cadastrar Máquina / Equipamento"}
              </h2>
              <button type="button" onClick={fecharModal} className="rounded p-1 text-gray-400 hover:bg-gray-100">
                <X className="size-5" />
              </button>
            </div>

            {/* Abas */}
            <div className="flex border-b border-gray-200 bg-gray-50 px-2">
              {["Identificação", "Localização", "Capacidade", "Segurança"].map((aba, i) => (
                <button
                  key={aba}
                  type="button"
                  onClick={() => setAbaAtiva(i as 0 | 1 | 2 | 3)}
                  className={cn(
                    "px-4 py-2.5 text-xs font-semibold transition-colors",
                    abaAtiva === i
                      ? "border-b-2 border-orange-500 text-orange-600"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {aba}
                </button>
              ))}
            </div>

            {/* Corpo do modal — scrollável */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* Empresa (sempre visível) */}
              <div className="mb-5">
                <Campo label="Empresa *">
                  <select
                    value={form.id_empresa ?? ""}
                    onChange={(e) => setF("id_empresa", e.target.value || null)}
                    className={INPUT_CLASS}
                  >
                    <option value="">— Patrimônio Chabra (sem empresa) —</option>
                    {empresas.map((e) => (
                      <option key={e.id_empresa} value={e.id_empresa}>{e.nome_empresa}</option>
                    ))}
                  </select>
                </Campo>
              </div>

              {/* ABA 0: Identificação */}
              {abaAtiva === 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Campo label="Nome da máquina / equipamento *">
                      <input type="text" value={form.nome} onChange={(e) => setF("nome", e.target.value)} className={INPUT_CLASS} placeholder="Ex: Prensa hidráulica" />
                    </Campo>
                    <Campo label="Tipo">
                      <input type="text" value={form.tipo ?? ""} onChange={(e) => setF("tipo", e.target.value || null)} className={INPUT_CLASS} placeholder="Ex: Prensa, Torno, Compressor..." />
                    </Campo>
                    <Campo label="Categoria">
                      <input type="text" value={form.categoria ?? ""} onChange={(e) => setF("categoria", e.target.value || null)} className={INPUT_CLASS} placeholder="Ex: Máquina de produção, Equipamento auxiliar..." />
                    </Campo>
                    <Campo label="Status">
                      <select value={form.status} onChange={(e) => setF("status", e.target.value as StatusMaquina)} className={INPUT_CLASS}>
                        {(Object.keys(STATUS_MAQUINA_LABELS) as StatusMaquina[]).map((s) => (
                          <option key={s} value={s}>{STATUS_MAQUINA_LABELS[s]}</option>
                        ))}
                      </select>
                    </Campo>
                    <Campo label="Código interno">
                      <input type="text" value={form.codigo_interno ?? ""} onChange={(e) => setF("codigo_interno", e.target.value || null)} className={INPUT_CLASS} placeholder="Ex: MAQ-001" />
                    </Campo>
                    <Campo label="TAG">
                      <input type="text" value={form.tag ?? ""} onChange={(e) => setF("tag", e.target.value || null)} className={INPUT_CLASS} placeholder="Ex: EQ-2024-001" />
                    </Campo>
                    <Campo label="Fabricante / Marca">
                      <input type="text" value={form.marca ?? ""} onChange={(e) => setF("marca", e.target.value || null)} className={INPUT_CLASS} placeholder="Ex: Schuler, Romi, Atlas Copco..." />
                    </Campo>
                    <Campo label="Modelo">
                      <input type="text" value={form.modelo ?? ""} onChange={(e) => setF("modelo", e.target.value || null)} className={INPUT_CLASS} placeholder="Ex: PH-200T" />
                    </Campo>
                    <Campo label="Número de série">
                      <input type="text" value={form.numero_serie ?? ""} onChange={(e) => setF("numero_serie", e.target.value || null)} className={INPUT_CLASS} />
                    </Campo>
                    <Campo label="Ano de fabricação">
                      <input type="number" value={form.ano_fabricacao ?? ""} onChange={(e) => setF("ano_fabricacao", e.target.value ? Number(e.target.value) : null)} className={INPUT_CLASS} min={1900} max={new Date().getFullYear()} />
                    </Campo>
                    <Campo label="Número de patrimônio">
                      <input type="text" value={form.numero_patrimonio ?? ""} onChange={(e) => setF("numero_patrimonio", e.target.value || null)} className={INPUT_CLASS} />
                    </Campo>
                  </div>
                  <Campo label="Observações gerais">
                    <textarea rows={2} value={form.observacoes ?? ""} onChange={(e) => setF("observacoes", e.target.value || null)} className={INPUT_CLASS} />
                  </Campo>
                </div>
              )}

              {/* ABA 1: Localização e Processo */}
              {abaAtiva === 1 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Campo label="Unidade">
                    <input type="text" value={form.unidade ?? ""} onChange={(e) => setF("unidade", e.target.value || null)} className={INPUT_CLASS} placeholder="Ex: Planta I, Filial SP" />
                  </Campo>
                  <Campo label="Setor">
                    <input type="text" value={form.setor ?? ""} onChange={(e) => setF("setor", e.target.value || null)} className={INPUT_CLASS} placeholder="Ex: Estamparia, Montagem" />
                  </Campo>
                  <Campo label="Linha / Processo">
                    <input type="text" value={form.linha_processo ?? ""} onChange={(e) => setF("linha_processo", e.target.value || null)} className={INPUT_CLASS} placeholder="Ex: Linha 3 — Conformação" />
                  </Campo>
                  <Campo label="Área">
                    <input type="text" value={form.area ?? ""} onChange={(e) => setF("area", e.target.value || null)} className={INPUT_CLASS} placeholder="Ex: Área produtiva, Almoxarifado" />
                  </Campo>
                  <Campo label="Responsável pelo setor">
                    <input type="text" value={form.responsavel_setor ?? ""} onChange={(e) => setF("responsavel_setor", e.target.value || null)} className={INPUT_CLASS} />
                  </Campo>
                  <Campo label="Localização física">
                    <input type="text" value={form.localizacao ?? ""} onChange={(e) => setF("localizacao", e.target.value || null)} className={INPUT_CLASS} placeholder="Ex: Galpão B, posição 12" />
                  </Campo>
                  <div className="sm:col-span-2">
                    <Campo label="Operação executada">
                      <textarea rows={3} value={form.operacao_executada ?? ""} onChange={(e) => setF("operacao_executada", e.target.value || null)} className={INPUT_CLASS} placeholder="Descreva a operação realizada pela máquina neste setor/processo..." />
                    </Campo>
                  </div>
                </div>
              )}

              {/* ABA 2: Capacidade e Finalidade */}
              {abaAtiva === 2 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Campo label="Capacidade operacional">
                    <input type="text" value={form.capacidade_operacional ?? ""} onChange={(e) => setF("capacidade_operacional", e.target.value || null)} className={INPUT_CLASS} placeholder="Ex: 200 ton, 500 L/h" />
                  </Campo>
                  <Campo label="Produção estimada">
                    <input type="text" value={form.producao_estimada ?? ""} onChange={(e) => setF("producao_estimada", e.target.value || null)} className={INPUT_CLASS} placeholder="Ex: 1200 peças/turno" />
                  </Campo>
                  <Campo label="Potência">
                    <input type="text" value={form.potencia ?? ""} onChange={(e) => setF("potencia", e.target.value || null)} className={INPUT_CLASS} placeholder="Ex: 15 kW, 20 CV" />
                  </Campo>
                  <Campo label="Tensão">
                    <input type="text" value={form.tensao ?? ""} onChange={(e) => setF("tensao", e.target.value || null)} className={INPUT_CLASS} placeholder="Ex: 380V trifásico" />
                  </Campo>
                  <Campo label="Pressão">
                    <input type="text" value={form.pressao ?? ""} onChange={(e) => setF("pressao", e.target.value || null)} className={INPUT_CLASS} placeholder="Ex: 8 bar, 120 PSI" />
                  </Campo>
                  <Campo label="Capacidade de carga">
                    <input type="text" value={form.capacidade_carga ?? ""} onChange={(e) => setF("capacidade_carga", e.target.value || null)} className={INPUT_CLASS} placeholder="Ex: 5 ton, 200 kg" />
                  </Campo>
                  <Campo label="Velocidade">
                    <input type="text" value={form.velocidade ?? ""} onChange={(e) => setF("velocidade", e.target.value || null)} className={INPUT_CLASS} placeholder="Ex: 1450 RPM, 0–80 m/min" />
                  </Campo>
                  <Campo label="Dimensões (C × L × A)">
                    <input type="text" value={form.dimensoes ?? ""} onChange={(e) => setF("dimensoes", e.target.value || null)} className={INPUT_CLASS} placeholder="Ex: 3,2m × 1,8m × 2,5m" />
                  </Campo>
                  <div className="sm:col-span-2">
                    <Campo label="Finalidade da máquina / equipamento">
                      <textarea rows={2} value={form.finalidade ?? ""} onChange={(e) => setF("finalidade", e.target.value || null)} className={INPUT_CLASS} placeholder="Descreva a finalidade principal..." />
                    </Campo>
                  </div>
                  <div className="sm:col-span-2">
                    <Campo label="Descrição técnica da operação realizada">
                      <textarea rows={3} value={form.descricao_tecnica ?? ""} onChange={(e) => setF("descricao_tecnica", e.target.value || null)} className={INPUT_CLASS} placeholder="Descreva detalhadamente como a máquina opera, ciclos, interações com operador..." />
                    </Campo>
                  </div>
                </div>
              )}

              {/* ABA 3: Segurança e Conformidade */}
              {abaAtiva === 3 && (
                <div className="space-y-5">
                  <div className="rounded-lg border border-orange-100 bg-orange-50/40 p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-orange-700">Dispositivos de segurança</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {([
                        ["protecao_fixa", "Proteção fixa"],
                        ["protecao_movel", "Proteção móvel"],
                        ["intertravamento", "Intertravamento"],
                        ["botao_emergencia", "Botão de emergência"],
                        ["sistema_bloqueio", "Sistema de bloqueio"],
                        ["aterramento", "Aterramento"],
                        ["sinalizacao", "Sinalização"],
                      ] as [keyof MaquinaInput, string][]).map(([key, label]) => (
                        <Campo key={key} label={label}>
                          <select
                            value={form[key] === null || form[key] === undefined ? "" : String(form[key])}
                            onChange={(e) => setF(key, parseBool(e.target.value))}
                            className={INPUT_CLASS}
                          >
                            {BOOL_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </Campo>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-blue-700">Documentação técnica</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {([
                        ["possui_manual", "Manual da máquina"],
                        ["possui_diagrama_eletrico", "Diagrama elétrico"],
                      ] as [keyof MaquinaInput, string][]).map(([key, label]) => (
                        <Campo key={key} label={label}>
                          <select
                            value={form[key] === null || form[key] === undefined ? "" : String(form[key])}
                            onChange={(e) => setF(key, parseBool(e.target.value))}
                            className={INPUT_CLASS}
                          >
                            {BOOL_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </Campo>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-red-100 bg-red-50/40 p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-red-700">Avaliação de conformidade NR-12</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Campo label="Grau de risco">
                        <select value={form.grau_risco ?? ""} onChange={(e) => setF("grau_risco", (e.target.value as GrauRiscoMaquina) || null)} className={INPUT_CLASS}>
                          <option value="">— Não avaliado —</option>
                          {(Object.keys(GRAU_RISCO_MAQUINA_LABELS) as GrauRiscoMaquina[]).map((g) => (
                            <option key={g} value={g}>{GRAU_RISCO_MAQUINA_LABELS[g]}</option>
                          ))}
                        </select>
                      </Campo>
                      <Campo label="Necessita adequação NR-12?">
                        <select
                          value={form.necessita_adequacao_nr12 === null || form.necessita_adequacao_nr12 === undefined ? "" : String(form.necessita_adequacao_nr12)}
                          onChange={(e) => setF("necessita_adequacao_nr12", parseBool(e.target.value))}
                          className={INPUT_CLASS}
                        >
                          {BOOL_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </Campo>
                    </div>
                    <div className="mt-3">
                      <Campo label="Observações técnicas de segurança">
                        <textarea rows={3} value={form.observacoes_tecnicas ?? ""} onChange={(e) => setF("observacoes_tecnicas", e.target.value || null)} className={INPUT_CLASS} placeholder="Pendências de adequação, riscos identificados, ações necessárias..." />
                      </Campo>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer do modal */}
            <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
              <div className="flex gap-1">
                {([0, 1, 2, 3] as const).map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setAbaAtiva(i)}
                    className={cn(
                      "size-2 rounded-full transition-colors",
                      abaAtiva === i ? "bg-orange-500" : "bg-gray-300 hover:bg-gray-400"
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={fecharModal} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSalvar}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {editando ? "Salvar alterações" : "Cadastrar máquina"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componentes auxiliares ──────────────────────────────────────────────────

function StatCard({ label, valor, cor }: { label: string; valor: number; cor: "orange" | "emerald" | "amber" | "red" }) {
  const cores: Record<string, string> = {
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
  };
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{valor}</p>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-600">{label}</span>
      {children}
    </label>
  );
}

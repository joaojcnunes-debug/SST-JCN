"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Database,
  Search,
  ArrowLeft,
  AlertTriangle,
  Skull,
  Pencil,
  Trash2,
  Plus,
  Download,
  Loader2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useRequireAdmin } from "@/lib/hooks/useRequireAdmin";
import { useUserStore } from "@/lib/store";
import {
  useBaseReferenciaQuimicos,
  useInicializarBaseQuimicos,
  useUpsertAgenteReferencia,
  useDeleteAgenteReferencia,
  useCriarAgenteReferencia,
  type AgenteReferenciaRow,
} from "@/lib/hooks/useBaseReferenciaQuimicos";
import type {
  AgenteReferencia,
  AnexoNR15,
  GrauNR15,
  IarcGrupo,
} from "@/lib/quimicos/base_referencia";

const ANEXOS: Array<{ value: "todos" | AnexoNR15; label: string }> = [
  { value: "todos", label: "Todos os anexos" },
  { value: "Anexo 11", label: "Anexo 11" },
  { value: "Anexo 12", label: "Anexo 12" },
  { value: "Anexo 13", label: "Anexo 13" },
  { value: "Anexo 13-A", label: "Anexo 13-A (cancerígenos)" },
];

const GRAUS: GrauNR15[] = ["Mínimo", "Médio", "Máximo", "Asfixiante simples"];
const IARC_GRUPOS: IarcGrupo[] = [
  "Grupo 1",
  "Grupo 2A",
  "Grupo 2B",
  "Grupo 3",
  "Grupo 4",
];
const ANEXOS_NR15: AnexoNR15[] = [
  "Anexo 11",
  "Anexo 12",
  "Anexo 13",
  "Anexo 13-A",
];

const NOVO_AGENTE: AgenteReferencia = {
  agente: "",
  cas: null,
  lt_mg_m3: null,
  lt_ppm: null,
  grau_nr15: null,
  teto: false,
  pele: false,
  esocial_tab24: null,
  iarc: null,
  inflamavel: false,
  cancerigeno_13a: false,
  tlv_acgih: null,
  decreto_3048: null,
  cod_gfip: null,
  anexo: null,
  observacoes: null,
  is_alias: false,
};

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function GrauBadge({ grau }: { grau: AgenteReferencia["grau_nr15"] }) {
  if (!grau) return <span className="text-gray-400">—</span>;
  const cores: Record<string, string> = {
    Máximo: "bg-red-100 text-red-700",
    Médio: "bg-orange-100 text-orange-700",
    Mínimo: "bg-yellow-100 text-yellow-800",
    "Asfixiante simples": "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
        cores[grau] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {grau}
    </span>
  );
}

export default function BaseReferenciaPage() {
  useRequireAdmin();
  const user = useUserStore((s) => s.user);

  const { data: linhas, isLoading } = useBaseReferenciaQuimicos();
  const inicializar = useInicializarBaseQuimicos();
  const deletar = useDeleteAgenteReferencia();

  const [q, setQ] = useState("");
  const [anexo, setAnexo] = useState<"todos" | AnexoNR15>("todos");
  const [soCancerigeno, setSoCancerigeno] = useState(false);
  const [soPele, setSoPele] = useState(false);

  const [editando, setEditando] = useState<AgenteReferenciaRow | null>(null);
  const [criando, setCriando] = useState(false);

  const itens = linhas ?? [];

  const filtrados = useMemo(() => {
    const termo = normalizar(q);
    return itens.filter((a) => {
      if (anexo !== "todos" && a.anexo !== anexo) return false;
      if (
        soCancerigeno &&
        !(a.cancerigeno_13a || a.iarc === "Grupo 1" || a.iarc === "Grupo 2A")
      ) {
        return false;
      }
      if (soPele && !a.pele) return false;
      if (!termo) return true;
      return (
        normalizar(a.agente).includes(termo) ||
        (a.cas ?? "").toLowerCase().includes(termo) ||
        (a.esocial_tab24 ?? "").toLowerCase().includes(termo)
      );
    });
  }, [itens, q, anexo, soCancerigeno, soPele]);

  // Loading + admin guard (useRequireAdmin redireciona; aqui só blocka o render)
  if (!user) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (user.perfil !== "Admin") return null;

  async function handleInicializar() {
    if (
      !window.confirm(
        "Inicializar a base com os 267 agentes padrão da Chabra? Isso só funciona se a tabela estiver vazia."
      )
    ) {
      return;
    }
    try {
      const total = await inicializar.mutateAsync();
      toast.success(`${total} agentes carregados na base.`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Falha ao inicializar a base"
      );
    }
  }

  async function handleDelete(row: AgenteReferenciaRow) {
    if (
      !window.confirm(
        `Apagar "${row.agente}" da base? Esta ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    try {
      await deletar.mutateAsync(row.id);
      toast.success("Agente removido");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Falha ao remover agente"
      );
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/analise-quimicos"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
        >
          <ArrowLeft className="size-3.5" /> Voltar
        </Link>
        <button
          type="button"
          onClick={() => setCriando(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent"
        >
          <Plus className="size-4" /> Novo agente
        </button>
      </div>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <Database className="size-5 text-sky-500" />
          Base de Referência Chabra — Químicos NR-15
        </h1>
        <p className="text-sm text-gray-600">
          {isLoading
            ? "Carregando..."
            : `${itens.length} agentes catalogados · NR-15 (Anexos 11, 12, 13, 13-A) + ACGIH + IARC + eSocial Tab.24 + Decreto 3.048`}
        </p>
      </div>

      {/* Banner inicializar quando a tabela está vazia */}
      {!isLoading && itens.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <Download className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">
                A base de referência está vazia
              </p>
              <p className="mt-1 text-sm text-amber-800">
                Importe os 267 agentes padrão da Chabra (NR-15 + ACGIH + IARC +
                eSocial) com 1 clique. Depois disso você pode editar, adicionar
                ou remover qualquer entrada.
              </p>
              <button
                type="button"
                onClick={handleInicializar}
                disabled={inicializar.isPending}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {inicializar.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Importar base padrão (267 agentes)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Busca + filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, CAS ou código eSocial..."
            className="w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary"
          />
        </div>
        <select
          value={anexo}
          onChange={(e) => setAnexo(e.target.value as "todos" | AnexoNR15)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary"
        >
          {ANEXOS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <label className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={soCancerigeno}
            onChange={(e) => setSoCancerigeno(e.target.checked)}
            className="size-4 rounded border-gray-300 text-verde-primary focus:ring-verde-primary"
          />
          Cancerígenos
        </label>
        <label className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={soPele}
            onChange={(e) => setSoPele(e.target.checked)}
            className="size-4 rounded border-gray-300 text-verde-primary focus:ring-verde-primary"
          />
          Absorção pele
        </label>
      </div>

      <p className="text-xs text-gray-500">
        Mostrando {filtrados.length} de {itens.length}
      </p>

      {/* Tabela */}
      {filtrados.length === 0 && itens.length > 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
          Nenhum agente encontrado com esses filtros.
        </div>
      ) : itens.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Agente</th>
                <th className="px-3 py-2 text-left font-semibold">CAS</th>
                <th className="px-3 py-2 text-left font-semibold">
                  LT (mg/m³ · ppm)
                </th>
                <th className="px-3 py-2 text-left font-semibold">Grau</th>
                <th className="px-3 py-2 text-left font-semibold">Anexo</th>
                <th className="px-3 py-2 text-left font-semibold">eSocial</th>
                <th className="px-3 py-2 text-left font-semibold">IARC</th>
                <th className="px-3 py-2 text-left font-semibold">Flags</th>
                <th className="px-3 py-2 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {a.agente}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {a.cas ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {a.lt_mg_m3 != null || a.lt_ppm != null ? (
                      <>
                        {a.lt_mg_m3 ?? "—"}
                        {" · "}
                        {a.lt_ppm ?? "—"}
                        {a.teto && (
                          <span className="ml-1 rounded bg-gray-200 px-1 text-[10px] font-bold">
                            TETO
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <GrauBadge grau={a.grau_nr15} />
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {a.anexo ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-700">
                    {a.esocial_tab24 ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {a.iarc ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {a.cancerigeno_13a && (
                        <span
                          title="Cancerígeno NR-15 Anexo 13-A"
                          className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700"
                        >
                          <Skull className="size-3" /> CANC
                        </span>
                      )}
                      {a.pele && (
                        <span
                          title="Absorvido por pele"
                          className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700"
                        >
                          PELE
                        </span>
                      )}
                      {a.inflamavel && (
                        <span
                          title="Inflamável"
                          className="inline-flex items-center gap-0.5 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700"
                        >
                          <AlertTriangle className="size-3" /> INFL
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditando(a)}
                        title="Editar"
                        className="rounded p-1.5 text-sky-600 hover:bg-sky-50"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(a)}
                        title="Apagar"
                        className="rounded p-1.5 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="text-xs text-gray-500">
        Dados de referência para análise NR-15. Editar aqui afeta o lookup
        automático de toda a aplicação imediatamente — qualquer Análise nova
        usará os valores corrigidos.
      </p>

      {/* Modal de edição */}
      {editando && (
        <EditModal
          row={editando}
          onClose={() => setEditando(null)}
        />
      )}
      {criando && (
        <EditModal
          row={null}
          onClose={() => setCriando(false)}
        />
      )}
    </div>
  );
}

// ============================================================
// Modal de edição / criação
// ============================================================

interface EditModalProps {
  row: AgenteReferenciaRow | null; // null = criar
  onClose: () => void;
}

function EditModal({ row, onClose }: EditModalProps) {
  const upsert = useUpsertAgenteReferencia();
  const criar = useCriarAgenteReferencia();
  const ehNovo = row === null;

  const [form, setForm] = useState<AgenteReferencia>(
    row ? { ...row } : { ...NOVO_AGENTE }
  );

  function set<K extends keyof AgenteReferencia>(
    k: K,
    v: AgenteReferencia[K]
  ) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function setNumOuNull(k: "lt_mg_m3" | "lt_ppm", v: string) {
    const trimmed = v.trim();
    if (trimmed === "") return set(k, null);
    const n = parseFloat(trimmed.replace(",", "."));
    set(k, Number.isFinite(n) ? n : null);
  }

  function setTxtOuNull<
    K extends keyof Pick<
      AgenteReferencia,
      | "cas"
      | "esocial_tab24"
      | "tlv_acgih"
      | "decreto_3048"
      | "cod_gfip"
      | "observacoes"
    >,
  >(k: K, v: string) {
    set(k, (v.trim() ? v : null) as AgenteReferencia[K]);
  }

  async function handleSalvar() {
    if (!form.agente.trim()) {
      toast.error("Nome do agente é obrigatório");
      return;
    }
    try {
      if (ehNovo) {
        await criar.mutateAsync(form);
        toast.success("Agente criado");
      } else if (row) {
        await upsert.mutateAsync({ id: row.id, ...form });
        toast.success("Agente atualizado");
      }
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao salvar"
      );
    }
  }

  const saving = upsert.isPending || criar.isPending;

  const lbl = "text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1 block";
  const inp =
    "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
          <h2 className="text-lg font-semibold text-gray-900">
            {ehNovo ? "Novo agente" : "Editar agente"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="size-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSalvar();
          }}
          className="space-y-5 p-5"
        >
          {/* Identificação */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className={lbl}>Agente *</label>
              <input
                type="text"
                value={form.agente}
                onChange={(e) => set("agente", e.target.value)}
                className={inp}
                required
              />
            </div>
            <div>
              <label className={lbl}>CAS</label>
              <input
                type="text"
                value={form.cas ?? ""}
                onChange={(e) => setTxtOuNull("cas", e.target.value)}
                placeholder="xxx-xx-x"
                className={inp}
              />
            </div>
          </div>

          {/* Limites */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label className={lbl}>LT (mg/m³)</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.lt_mg_m3 ?? ""}
                onChange={(e) => setNumOuNull("lt_mg_m3", e.target.value)}
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>LT (ppm)</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.lt_ppm ?? ""}
                onChange={(e) => setNumOuNull("lt_ppm", e.target.value)}
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Grau NR-15</label>
              <select
                value={form.grau_nr15 ?? ""}
                onChange={(e) =>
                  set(
                    "grau_nr15",
                    (e.target.value || null) as GrauNR15 | null
                  )
                }
                className={inp}
              >
                <option value="">—</option>
                {GRAUS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Anexo NR-15</label>
              <select
                value={form.anexo ?? ""}
                onChange={(e) =>
                  set("anexo", (e.target.value || null) as AnexoNR15 | null)
                }
                className={inp}
              >
                <option value="">—</option>
                {ANEXOS_NR15.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Classificações externas */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className={lbl}>eSocial Tab.24</label>
              <input
                type="text"
                value={form.esocial_tab24 ?? ""}
                onChange={(e) => setTxtOuNull("esocial_tab24", e.target.value)}
                placeholder="09.01.001"
                className={`${inp} font-mono`}
              />
            </div>
            <div>
              <label className={lbl}>IARC</label>
              <select
                value={form.iarc ?? ""}
                onChange={(e) =>
                  set("iarc", (e.target.value || null) as IarcGrupo | null)
                }
                className={inp}
              >
                <option value="">—</option>
                {IARC_GRUPOS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>TLV ACGIH</label>
              <input
                type="text"
                value={form.tlv_acgih ?? ""}
                onChange={(e) => setTxtOuNull("tlv_acgih", e.target.value)}
                placeholder="25 ppm Teto (A3)"
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Decreto 3.048 Anexo IV</label>
              <input
                type="text"
                value={form.decreto_3048 ?? ""}
                onChange={(e) => setTxtOuNull("decreto_3048", e.target.value)}
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Código GFIP</label>
              <input
                type="text"
                value={form.cod_gfip ?? ""}
                onChange={(e) => setTxtOuNull("cod_gfip", e.target.value)}
                className={inp}
              />
            </div>
          </div>

          {/* Flags */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <FlagCheck
              label="Teto"
              checked={!!form.teto}
              onChange={(v) => set("teto", v)}
            />
            <FlagCheck
              label="Pele"
              checked={!!form.pele}
              onChange={(v) => set("pele", v)}
            />
            <FlagCheck
              label="Inflamável"
              checked={!!form.inflamavel}
              onChange={(v) => set("inflamavel", v)}
            />
            <FlagCheck
              label="Cancerígeno 13-A"
              checked={!!form.cancerigeno_13a}
              onChange={(v) => set("cancerigeno_13a", v)}
            />
            <FlagCheck
              label="É alias (vide X)"
              checked={!!form.is_alias}
              onChange={(v) => set("is_alias", v)}
            />
          </div>

          <div>
            <label className={lbl}>Observações</label>
            <textarea
              value={form.observacoes ?? ""}
              onChange={(e) => setTxtOuNull("observacoes", e.target.value)}
              rows={2}
              className={inp}
            />
          </div>

          {/* Ações */}
          <div className="flex items-center justify-end gap-2 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {ehNovo ? "Criar" : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FlagCheck({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-gray-300 text-verde-primary focus:ring-verde-primary"
      />
      {label}
    </label>
  );
}

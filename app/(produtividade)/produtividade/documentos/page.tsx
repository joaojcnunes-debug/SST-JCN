"use client";

import { useState } from "react";
import { Download, FileText, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import {
  useProdUnidades,
  useProdDocumentos,
  useSaveDocumento,
  useDeleteDocumento,
  TIPOS_DOCUMENTO_SST,
  STATUS_LABEL,
  STATUS_COR,
  type ProdDocumentoSST,
  type StatusDocumentoSST,
} from "@/lib/hooks/useProdutividade";
import { useCanEdit } from "@/lib/hooks/useUsuario";

const TODOS_STATUS: StatusDocumentoSST[] = [
  "em_dia", "a_vencer", "vencido",
  "pendente_visita", "pendente_informacao", "pendente_ssg",
  "pendente_revisao", "concluido", "nao_iniciado",
];

// Converte DD/MM/AAAA ou AAAA-MM-DD → AAAA-MM-DD (para salvar no banco)
function parseDateBr(s: string): string | null {
  if (!s.trim()) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s || null;
}
// Converte AAAA-MM-DD → DD/MM/AAAA (para exibir no input)
function formatDateBr(s: string | null | undefined): string {
  if (!s) return "";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function ModalDocumento({
  initial,
  onClose,
}: {
  initial?: Partial<ProdDocumentoSST>;
  onClose: () => void;
}) {
  const { data: unidades = [] } = useProdUnidades();
  const save = useSaveDocumento();

  const [idEmpresa,   setIdEmpresa]   = useState(initial?.id_empresa ?? "");
  const [nomeEmpresa, setNomeEmpresa] = useState(initial?.nome_empresa ?? "");
  const [idUnidade,   setIdUnidade]   = useState(initial?.id_unidade ?? "");
  const [tipoDoc,     setTipoDoc]     = useState(initial?.tipo_documento ?? "PGR");
  const [numero,      setNumero]      = useState(initial?.numero ?? "");
  const [status,      setStatus]      = useState<StatusDocumentoSST>(initial?.status ?? "nao_iniciado");
  const [dataEmissao, setDataEmissao] = useState(formatDateBr(initial?.data_emissao));
  const [dataVenc,    setDataVenc]    = useState(formatDateBr(initial?.data_vencimento));
  const [responsavel, setResponsavel] = useState(initial?.responsavel_nome ?? "");
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? "");

  const INPUT = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500";

  async function handleSave() {
    if (!nomeEmpresa.trim() && !idEmpresa.trim()) { toast.error("Informe a empresa"); return; }
    if (!idUnidade) { toast.error("Selecione a unidade"); return; }
    const emissao = parseDateBr(dataEmissao);
    const venc    = parseDateBr(dataVenc);
    try {
      await save.mutateAsync({
        id:               initial?.id,
        id_empresa:       idEmpresa.trim() || nomeEmpresa.trim(),
        nome_empresa:     nomeEmpresa.trim() || null,
        id_unidade:       idUnidade,
        tipo_documento:   tipoDoc,
        numero:           numero.trim() || null,
        status,
        data_emissao:     emissao,
        data_vencimento:  venc,
        responsavel_nome: responsavel.trim() || null,
        observacoes:      observacoes.trim() || null,
      });
      toast.success(initial?.id ? "Documento atualizado" : "Documento adicionado");
      onClose();
    } catch {
      toast.error("Erro ao salvar");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="font-semibold text-gray-900">{initial?.id ? "Editar documento" : "Novo documento SST"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100"><X className="size-4" /></button>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Nome da Empresa *</label>
            <input value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} className={INPUT} placeholder="Ex: Empresa ABC Ltda" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">CNPJ / Código (opcional)</label>
            <input value={idEmpresa} onChange={(e) => setIdEmpresa(e.target.value)} inputMode="numeric" className={INPUT} placeholder="00.000.000/0000-00" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Unidade JCN Consultoria *</label>
            <select value={idUnidade} onChange={(e) => setIdUnidade(e.target.value)} className={INPUT}>
              <option value="">Selecionar…</option>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Tipo de Documento *</label>
            <select value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)} className={INPUT}>
              {TIPOS_DOCUMENTO_SST.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Número / Referência</label>
            <input value={numero} onChange={(e) => setNumero(e.target.value)} className={INPUT} placeholder="Ex: 001/2026" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as StatusDocumentoSST)} className={INPUT}>
              {TODOS_STATUS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Data de Emissão</label>
            <input
              value={dataEmissao}
              onChange={(e) => setDataEmissao(e.target.value)}
              className={INPUT}
              placeholder="DD/MM/AAAA"
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Data de Vencimento</label>
            <input
              value={dataVenc}
              onChange={(e) => setDataVenc(e.target.value)}
              className={INPUT}
              placeholder="DD/MM/AAAA"
              inputMode="numeric"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Responsável</label>
            <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={INPUT} placeholder="Nome do responsável pelo documento" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Observações</label>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} className={INPUT} />
          </div>
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

// ── Página ────────────────────────────────────────────────────────────────────

export default function DocumentosPage() {
  const [search,       setSearch]       = useState("");
  const [filtroUnid,   setFiltroUnid]   = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusDocumentoSST | "">("");
  const [filtroTipo,   setFiltroTipo]   = useState("");
  const [showNew,      setShowNew]      = useState(false);
  const [editDoc,      setEditDoc]      = useState<ProdDocumentoSST | null>(null);

  const canEdit = useCanEdit();
  const { data: unidades = [] } = useProdUnidades();
  const { data: documentos = [], isLoading } = useProdDocumentos({
    idUnidade:     filtroUnid    || undefined,
    status:        (filtroStatus as StatusDocumentoSST) || undefined,
    tipoDocumento: filtroTipo    || undefined,
    search:        search        || undefined,
  });
  const deleteDoc = useDeleteDocumento();

  const hoje  = new Date().toISOString().slice(0, 10);
  const em30d = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  function statusAlert(doc: ProdDocumentoSST) {
    if (doc.status === "vencido") return "ring-1 ring-red-200 bg-red-50/30";
    if (doc.data_vencimento && doc.data_vencimento <= em30d && doc.data_vencimento >= hoje) return "ring-1 ring-yellow-200 bg-yellow-50/30";
    return "";
  }

  function exportExcel() {
    const rows = documentos.map((d) => ({
      Empresa:      d.nome_empresa ?? d.id_empresa,
      Unidade:      unidades.find((u) => u.id === d.id_unidade)?.nome ?? "",
      Tipo:         d.tipo_documento,
      Status:       STATUS_LABEL[d.status],
      Emissão:      d.data_emissao ?? "",
      Vencimento:   d.data_vencimento ?? "",
      Responsável:  d.responsavel_nome ?? "",
      Observações:  d.observacoes ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Documentos SST");
    XLSX.writeFile(wb, "documentos-sst.xlsx");
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documentos SST</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Controle de PGR, PCMSO, LTCAT e demais documentos por empresa
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={exportExcel} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            <Download className="size-4" /> Excel
          </button>
          {canEdit && (
            <button type="button" onClick={() => setShowNew(true)} className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
              <Plus className="size-4" /> Novo Documento
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar empresa…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <select value={filtroUnid} onChange={(e) => setFiltroUnid(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
          <option value="">Todas as unidades</option>
          {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as StatusDocumentoSST | "")} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
          <option value="">Todos os status</option>
          {TODOS_STATUS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
          <option value="">Todos os tipos</option>
          {TIPOS_DOCUMENTO_SST.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Contador */}
      <p className="text-xs text-gray-400">
        {isLoading ? "Carregando…" : `${documentos.length} documento${documentos.length !== 1 ? "s" : ""} encontrado${documentos.length !== 1 ? "s" : ""}`}
      </p>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="size-4 animate-spin" /> Carregando documentos…
        </div>
      )}

      {/* Tabela */}
      {!isLoading && documentos.length === 0 && (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-black/5">
          <FileText className="mx-auto size-10 text-gray-200" />
          <p className="mt-3 text-sm font-medium text-gray-500">Nenhum documento encontrado com os filtros aplicados</p>
        </div>
      )}

      {documentos.length > 0 && (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-[11px] uppercase text-gray-400">
                  <th className="px-4 py-3 text-left">Empresa</th>
                  <th className="px-4 py-3 text-left">Unidade</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Nº / Ref.</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Emissão</th>
                  <th className="px-4 py-3 text-left">Vencimento</th>
                  <th className="px-4 py-3 text-left">Responsável</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {documentos.map((doc) => {
                  const unidade = unidades.find((u) => u.id === doc.id_unidade);
                  const cor = STATUS_COR[doc.status];
                  return (
                    <tr key={doc.id} className={`hover:bg-gray-50/50 ${statusAlert(doc)}`}>
                      <td className="px-4 py-3 font-medium text-gray-800 max-w-[180px]">
                        <span className="truncate block">{doc.nome_empresa ?? doc.id_empresa}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{unidade?.nome ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-700">{doc.tipo_documento}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{doc.numero ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cor.bg} ${cor.text}`}>
                          {STATUS_LABEL[doc.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{doc.data_emissao ?? "—"}</td>
                      <td className="px-4 py-3 text-xs font-mono">
                        <span className={doc.status === "vencido" ? "text-red-600 font-semibold" : doc.data_vencimento && doc.data_vencimento <= em30d ? "text-yellow-700 font-semibold" : "text-gray-500"}>
                          {doc.data_vencimento ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{doc.responsavel_nome ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        {canEdit && (
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => setEditDoc(doc)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><Pencil className="size-3.5" /></button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm("Excluir este documento?")) return;
                                try { await deleteDoc.mutateAsync(doc.id); toast.success("Excluído"); }
                                catch { toast.error("Erro ao excluir"); }
                              }}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNew   && <ModalDocumento                 onClose={() => setShowNew(false)} />}
      {editDoc   && <ModalDocumento initial={editDoc} onClose={() => setEditDoc(null)} />}
    </div>
  );
}

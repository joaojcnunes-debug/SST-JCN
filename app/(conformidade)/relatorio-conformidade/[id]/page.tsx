"use client";

import { use, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  Trash2,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Lock,
  Loader2,
  ShieldCheck,
  AlertCircle,
  Camera,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import {
  useRelatorioConformidade,
  useAtualizarItemConformidade,
  useAtualizarRelatorioConformidade,
  useExcluirRelatorioConformidade,
  useUploadFotoItemConformidade,
  useRemoverFotoItemConformidade,
} from "@/lib/hooks/useRelatoriosConformidade";
import type {
  RelatorioConformidadeItem,
  SituacaoConformidade,
} from "@/lib/supabase/types";

const MAX_FOTO_MB = 8;

export default function DetalheConformidadePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isLoading, error } = useRelatorioConformidade(id);
  const { data: empresa } = useEmpresa(data?.relatorio.id_empresa ?? null);

  const atualizarItem = useAtualizarItemConformidade();
  const atualizarRelatorio = useAtualizarRelatorioConformidade();
  const excluir = useExcluirRelatorioConformidade();
  const uploadFoto = useUploadFotoItemConformidade();
  const removerFoto = useRemoverFotoItemConformidade();

  const [lightbox, setLightbox] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        <Loader2 className="size-5 animate-spin" /> Carregando...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <AlertCircle className="mx-auto size-10 text-red-500" />
        <p className="mt-3 text-sm text-gray-700">
          Relatório não encontrado.
        </p>
        <Link
          href="/relatorio-conformidade"
          className="mt-4 inline-block text-sm text-teal-700 hover:underline"
        >
          Voltar
        </Link>
      </div>
    );
  }

  const { relatorio, itens } = data;
  const finalizado = relatorio.status === "FINALIZADO";

  function handleExcluir() {
    if (
      !window.confirm(
        `Apagar o relatório de ${relatorio.nr_codigo}? Esta ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    excluir.mutate(id, {
      onSuccess: () => {
        toast.success("Relatório apagado");
        router.push("/relatorio-conformidade");
      },
      onError: (e: Error) => toast.error(e.message || "Falha ao apagar"),
    });
  }

  function handleFinalizar() {
    const pendentes = itens.filter((i) => i.situacao === "PENDENTE").length;
    if (pendentes > 0) {
      if (
        !window.confirm(
          `Existem ${pendentes} item(ns) ainda PENDENTE(S). Finalizar mesmo assim?`
        )
      ) {
        return;
      }
    }
    atualizarRelatorio.mutate(
      { id_relatorio: id, status: "FINALIZADO" },
      {
        onSuccess: () => toast.success("Relatório finalizado"),
        onError: (e: Error) => toast.error(e.message || "Falha"),
      }
    );
  }

  function handleReabrir() {
    atualizarRelatorio.mutate(
      { id_relatorio: id, status: "RASCUNHO" },
      {
        onSuccess: () => toast.success("Relatório reaberto pra edição"),
        onError: (e: Error) => toast.error(e.message || "Falha"),
      }
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 print:max-w-none print:space-y-2">
      {/* Topo — ações (oculta no print) */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href="/relatorio-conformidade"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
        >
          <ArrowLeft className="size-3.5" /> Voltar
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Printer className="size-4" /> Imprimir / PDF
          </button>
          {finalizado ? (
            <button
              type="button"
              onClick={handleReabrir}
              disabled={atualizarRelatorio.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              Reabrir
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalizar}
              disabled={atualizarRelatorio.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <ShieldCheck className="size-4" /> Finalizar
            </button>
          )}
          <button
            type="button"
            onClick={handleExcluir}
            disabled={excluir.isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            title="Apagar relatório"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {/* Cabeçalho */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm print:border-0 print:shadow-none print:p-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-teal-700">
              Relatório de Conformidade — {relatorio.nr_codigo}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">
              {relatorio.nr_titulo}
            </h1>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
              finalizado
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {finalizado ? "FINALIZADO" : "RASCUNHO"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <DataItem label="Empresa" value={empresa?.nome_empresa ?? "—"} />
          <DataItem label="CNPJ" value={empresa?.cnpj ?? "—"} />
          <DataItem label="Setor / Local" value={relatorio.setor ?? "—"} />
          <DataItem
            label="Responsável técnico"
            value={relatorio.responsavel ?? "—"}
          />
          <DataItem
            label="Data da inspeção"
            value={
              relatorio.data_inspecao
                ? new Date(
                    relatorio.data_inspecao + "T00:00"
                  ).toLocaleDateString("pt-BR")
                : "—"
            }
          />
          <DataItem
            label="Criado em"
            value={new Date(relatorio.created_at).toLocaleString("pt-BR")}
          />
        </div>
      </section>

      {/* Resumo */}
      <ResumoConformidade itens={itens} />

      {/* Lista de itens do checklist */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700 print:text-base">
          Itens do Checklist ({itens.length})
        </h2>
        <div className="space-y-2">
          {itens.map((item) => (
            <ItemRow
              key={item.id_item}
              item={item}
              bloqueado={finalizado}
              onChangeSituacao={(situacao) =>
                atualizarItem.mutate({
                  id_relatorio: id,
                  id_item: item.id_item,
                  situacao,
                })
              }
              onChangeObservacao={(observacao) =>
                atualizarItem.mutate({
                  id_relatorio: id,
                  id_item: item.id_item,
                  observacao,
                })
              }
              onUploadFoto={(file) => {
                if (file.size > MAX_FOTO_MB * 1024 * 1024) {
                  toast.error(`Arquivo maior que ${MAX_FOTO_MB} MB`);
                  return;
                }
                uploadFoto.mutate(
                  {
                    id_relatorio: id,
                    id_item: item.id_item,
                    file,
                    fotos_urls_atuais: item.foto_urls,
                    fotos_paths_atuais: item.foto_storage_paths,
                  },
                  {
                    onSuccess: () => toast.success("Foto enviada"),
                    onError: (e: Error) =>
                      toast.error(e.message || "Falha ao enviar foto"),
                  }
                );
              }}
              onRemoverFoto={(path) => {
                if (!window.confirm("Remover esta foto?")) return;
                removerFoto.mutate(
                  {
                    id_relatorio: id,
                    id_item: item.id_item,
                    foto_storage_path: path,
                    fotos_urls_atuais: item.foto_urls,
                    fotos_paths_atuais: item.foto_storage_paths,
                  },
                  {
                    onSuccess: () => toast.success("Foto removida"),
                    onError: (e: Error) =>
                      toast.error(e.message || "Falha ao remover"),
                  }
                );
              }}
              onAmpliarFoto={(url) => setLightbox(url)}
              uploadEmAndamento={uploadFoto.isPending}
            />
          ))}
        </div>
      </section>

      {/* Observações gerais */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm print:border-0 print:shadow-none print:p-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
          Observações Gerais
        </label>
        <ObservacoesGerais
          value={relatorio.observacoes_gerais ?? ""}
          disabled={finalizado}
          onSave={(v) =>
            atualizarRelatorio.mutate({
              id_relatorio: id,
              observacoes_gerais: v.trim() || null,
            })
          }
        />
      </section>

      {/* Rodapé pra impressão */}
      <p className="text-center text-[9px] text-gray-500 print:mt-4">
        Relatório de Conformidade gerado por Chabra — Segurança e Saúde do
        Trabalho ·{" "}
        {relatorio.finalizado_em
          ? `Finalizado em ${new Date(relatorio.finalizado_em).toLocaleString("pt-BR")}`
          : `Criado em ${new Date(relatorio.created_at).toLocaleString("pt-BR")}`}
        {relatorio.usuario_nome ? ` · ${relatorio.usuario_nome}` : ""}
      </p>

      {/* Lightbox de foto */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 print:hidden"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
          >
            <X className="size-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Foto ampliada"
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 1.4cm 1.2cm;
          }
        }
      `}</style>
    </div>
  );
}

// ============================================================
// Subcomponentes
// ============================================================

function DataItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

function ResumoConformidade({
  itens,
}: {
  itens: RelatorioConformidadeItem[];
}) {
  const total = itens.length;
  const conformes = itens.filter((i) => i.situacao === "CONFORME").length;
  const naoAplicaveis = itens.filter((i) => i.situacao === "NAO_APLICAVEL").length;
  const pendentes = itens.filter((i) => i.situacao === "PENDENTE").length;
  const avaliados = conformes + naoAplicaveis;
  const pct = total > 0 ? Math.round((avaliados / total) * 100) : 0;

  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 print:grid-cols-4">
      <ResumoCard label="Conformes" valor={conformes} cor="emerald" total={total} />
      <ResumoCard label="Não aplicáveis" valor={naoAplicaveis} cor="gray" total={total} />
      <ResumoCard label="Pendentes" valor={pendentes} cor="amber" total={total} />
      <ResumoCard label="Avaliação" valor={`${pct}%`} cor="teal" />
    </section>
  );
}

function ResumoCard({
  label,
  valor,
  cor,
  total,
}: {
  label: string;
  valor: string | number;
  cor: "emerald" | "gray" | "amber" | "teal";
  total?: number;
}) {
  const cores = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    gray: "border-gray-200 bg-gray-50 text-gray-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    teal: "border-teal-200 bg-teal-50 text-teal-900",
  };
  return (
    <div className={`rounded-lg border p-3 text-center ${cores[cor]}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">
        {label}
      </p>
      <p className="text-2xl font-bold">{valor}</p>
      {total != null && typeof valor === "number" && (
        <p className="text-[10px] opacity-70">de {total}</p>
      )}
    </div>
  );
}

function ItemRow({
  item,
  bloqueado,
  onChangeSituacao,
  onChangeObservacao,
  onUploadFoto,
  onRemoverFoto,
  onAmpliarFoto,
  uploadEmAndamento,
}: {
  item: RelatorioConformidadeItem;
  bloqueado: boolean;
  onChangeSituacao: (s: SituacaoConformidade) => void;
  onChangeObservacao: (obs: string) => void;
  onUploadFoto: (file: File) => void;
  onRemoverFoto: (storagePath: string) => void;
  onAmpliarFoto: (url: string) => void;
  uploadEmAndamento: boolean;
}) {
  const [obs, setObs] = useState(item.observacao ?? "");
  const [obsDirty, setObsDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const corBorda = useMemo(() => {
    switch (item.situacao) {
      case "CONFORME":
        return "border-emerald-300 bg-emerald-50/40";
      case "NAO_APLICAVEL":
        return "border-gray-300 bg-gray-50/40";
      default:
        return "border-amber-200 bg-amber-50/30";
    }
  }, [item.situacao]);

  const fotoUrls = item.foto_urls ?? [];
  const fotoPaths = item.foto_storage_paths ?? [];
  const temFotos = fotoUrls.length > 0;
  const limiteAtingido = fotoPaths.length >= 8;

  return (
    <div className={`rounded-lg border p-3 print:break-inside-avoid ${corBorda}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-block min-w-[3rem] rounded bg-teal-100 px-1.5 py-0.5 text-center font-mono text-[11px] font-bold text-teal-800">
          {item.item_codigo}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {item.item_titulo}
          </p>
          {item.item_descricao && (
            <p className="mt-0.5 text-xs text-gray-600">{item.item_descricao}</p>
          )}
        </div>
      </div>

      {/* Botões de situação */}
      <div className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
        <SitButton
          label="Conforme"
          icon={<CheckCircle2 className="size-4" />}
          ativo={item.situacao === "CONFORME"}
          cor="emerald"
          onClick={() => onChangeSituacao("CONFORME")}
          disabled={bloqueado}
        />
        <SitButton
          label="Não aplicável"
          icon={<MinusCircle className="size-4" />}
          ativo={item.situacao === "NAO_APLICAVEL"}
          cor="gray"
          onClick={() => onChangeSituacao("NAO_APLICAVEL")}
          disabled={bloqueado}
        />
        <SitButton
          label="Pendente"
          icon={<XCircle className="size-4" />}
          ativo={item.situacao === "PENDENTE"}
          cor="amber"
          onClick={() => onChangeSituacao("PENDENTE")}
          disabled={bloqueado}
        />

        {/* Botão de adicionar foto (múltiplas) */}
        {!bloqueado && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadFoto(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadEmAndamento || limiteAtingido}
              className="inline-flex items-center gap-1.5 rounded-md border border-sky-300 bg-white px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50"
              title={
                limiteAtingido
                  ? "Limite de 8 fotos por item"
                  : "Adicionar foto"
              }
            >
              {uploadEmAndamento ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
              {temFotos
                ? `Adicionar foto (${fotoUrls.length})`
                : "Adicionar foto"}
            </button>
          </>
        )}

        {bloqueado && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-gray-500">
            <Lock className="size-3" /> Finalizado
          </span>
        )}
      </div>

      {/* Indicador de situação no print */}
      <div className="mt-2 hidden print:block">
        <span className="text-xs font-bold">
          Situação:{" "}
          {item.situacao === "CONFORME"
            ? "CONFORME"
            : item.situacao === "NAO_APLICAVEL"
            ? "NÃO APLICÁVEL"
            : "PENDENTE"}
        </span>
      </div>

      {/* Fotos anexadas — grid 2 colunas centralizado quando 2+, single quando 1 */}
      {temFotos && (
        <div className="mt-3 flex justify-center">
          <div
            className={
              fotoUrls.length === 1
                ? "flex justify-center"
                : "grid grid-cols-2 gap-3 print:gap-2"
            }
          >
            {fotoUrls.map((url, idx) => {
              const path = fotoPaths[idx];
              return (
                <FotoThumb
                  key={`${url}-${idx}`}
                  url={url}
                  itemCodigo={item.item_codigo}
                  onAmpliar={onAmpliarFoto}
                  onRemover={
                    !bloqueado && path
                      ? () => onRemoverFoto(path)
                      : undefined
                  }
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Observação — fica ABAIXO das fotos */}
      {(item.observacao || !bloqueado) && (
        <div className="mt-3">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500 print:text-[11px]">
            Observação
          </label>
          <textarea
            value={obs}
            onChange={(e) => {
              setObs(e.target.value);
              setObsDirty(true);
            }}
            onBlur={() => {
              if (obsDirty) {
                onChangeObservacao(obs);
                setObsDirty(false);
              }
            }}
            placeholder={bloqueado ? "" : "Observação (opcional)"}
            disabled={bloqueado}
            rows={2}
            className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-gray-50 disabled:text-gray-600 print:resize-none print:border-gray-300"
          />
        </div>
      )}
    </div>
  );
}

function FotoThumb({
  url,
  itemCodigo,
  onAmpliar,
  onRemover,
}: {
  url: string;
  itemCodigo: string;
  onAmpliar: (url: string) => void;
  onRemover?: () => void;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onAmpliar(url)}
        className="block overflow-hidden rounded-md border border-gray-300 print:border-gray-400"
        title="Ampliar"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={`Foto do item ${itemCodigo}`}
          className="h-36 w-44 object-cover sm:h-40 sm:w-52 print:h-40 print:w-48"
        />
      </button>
      {onRemover && (
        <button
          type="button"
          onClick={onRemover}
          className="absolute -right-2 -top-2 rounded-full bg-white p-1 text-red-600 shadow-md ring-1 ring-red-200 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 print:hidden"
          title="Remover foto"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function SitButton({
  label,
  icon,
  ativo,
  cor,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  ativo: boolean;
  cor: "emerald" | "gray" | "amber";
  onClick: () => void;
  disabled?: boolean;
}) {
  const ativoCores = {
    emerald: "bg-emerald-600 text-white hover:bg-emerald-700",
    gray: "bg-gray-600 text-white hover:bg-gray-700",
    amber: "bg-amber-500 text-white hover:bg-amber-600",
  };
  const inativoCores = {
    emerald: "border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50",
    gray: "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
    amber: "border-amber-300 bg-white text-amber-700 hover:bg-amber-50",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold disabled:opacity-50 ${
        ativo ? ativoCores[cor] : inativoCores[cor]
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ObservacoesGerais({
  value,
  disabled,
  onSave,
}: {
  value: string;
  disabled: boolean;
  onSave: (v: string) => void;
}) {
  const [texto, setTexto] = useState(value);
  const [dirty, setDirty] = useState(false);
  return (
    <textarea
      value={texto}
      onChange={(e) => {
        setTexto(e.target.value);
        setDirty(true);
      }}
      onBlur={() => {
        if (dirty) {
          onSave(texto);
          setDirty(false);
        }
      }}
      placeholder={
        disabled
          ? "Nenhuma observação registrada."
          : "Considerações gerais sobre a auditoria, contexto, ações futuras..."
      }
      disabled={disabled}
      rows={3}
      className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-gray-50 print:resize-none"
    />
  );
}

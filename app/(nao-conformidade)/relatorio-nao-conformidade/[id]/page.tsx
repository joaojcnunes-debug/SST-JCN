"use client";

import { use, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  Trash2,
  Lock,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Camera,
  X,
  Plus,
  ShieldAlert,
  ListChecks,
  Check,
} from "lucide-react";
import toast from "react-hot-toast";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import RelatorioPrintHeader from "@/components/layout/RelatorioPrintHeader";
import TextosPadraoPrint from "@/components/textos-padrao/TextosPadraoPrint";
import {
  montarValoresEmpresa,
  formatarDataBR,
} from "@/lib/textos-padrao/variaveis";
import {
  useRelatorioNaoConformidade,
  useAtualizarRelatorioNaoConformidade,
  useExcluirRelatorioNaoConformidade,
  useAdicionarItemNC,
  useAtualizarItemNC,
  useExcluirItemNC,
  useUploadFotoItemNC,
  useRemoverFotoItemNC,
  MAX_FOTOS_POR_NC,
} from "@/lib/hooks/useRelatoriosNaoConformidade";
import { listarNRs, getChecklistNR } from "@/lib/conformidade/checklists";
import { useCanDelete, useCanEdit } from "@/lib/hooks/useUsuario";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type {
  CriticidadeNC,
  RelatorioNaoConformidade,
  RelatorioNaoConformidadeItem,
  StatusTratativaNC,
} from "@/lib/supabase/types";

const MAX_FOTO_MB = 8;

export default function DetalheNaoConformidadePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const canDelete = useCanDelete();
  const canEdit = useCanEdit();
  const { data, isLoading, error } = useRelatorioNaoConformidade(id);
  const { data: empresa } = useEmpresa(data?.relatorio.id_empresa ?? null);

  const atualizarRelatorio = useAtualizarRelatorioNaoConformidade();
  const excluir = useExcluirRelatorioNaoConformidade();
  const adicionarItem = useAdicionarItemNC();
  const atualizarItem = useAtualizarItemNC();
  const excluirItem = useExcluirItemNC();
  const uploadFoto = useUploadFotoItemNC();
  const removerFoto = useRemoverFotoItemNC();

  const [lightbox, setLightbox] = useState<string | null>(null);
  const [pickerAberto, setPickerAberto] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ title: string; desc?: string; fn: () => void } | null>(null);

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
        <p className="mt-3 text-sm text-gray-700">Relatório não encontrado.</p>
        <Link
          href="/relatorio-nao-conformidade"
          className="mt-4 inline-block text-sm text-red-700 hover:underline"
        >
          Voltar
        </Link>
      </div>
    );
  }

  const { relatorio, itens } = data;
  // "bloqueado" = relatório finalizado OU usuário é Visualizador (não pode editar).
  // Mantém `finalizado` puro pra renderização de badges; usa `bloqueado` pra
  // gating de inputs/botões.
  const finalizado = relatorio.status === "FINALIZADO";
  const bloqueado = finalizado || !canEdit;

  // Resumo por criticidade
  const ncsAlta = itens.filter((i) => i.criticidade === "ALTA").length;
  const ncsMedia = itens.filter((i) => i.criticidade === "MEDIA").length;
  const ncsBaixa = itens.filter((i) => i.criticidade === "BAIXA").length;

  const valoresTextosPadrao: Record<string, string> = {
    ...montarValoresEmpresa(empresa),
    titulo: relatorio.titulo,
    responsavel: relatorio.responsavel ?? "",
    responsavel_empresa: relatorio.responsavel_empresa ?? "",
    cidade: relatorio.cidade ?? "",
    setor: relatorio.setor ?? "",
    data_inspecao: formatarDataBR(relatorio.data_inspecao),
    total_ncs: String(itens.length),
    total_ncs_alta: String(ncsAlta),
    carimbo: relatorio.responsavel ?? "",
    importado: formatarDataBR(relatorio.created_at),
  };

  function handleExcluir() {
    setPendingAction({
      title: "Apagar relatório",
      desc: `Apagar o relatório "${relatorio.titulo}"? Esta ação não pode ser desfeita.`,
      fn: () => excluir.mutate(id, {
        onSuccess: () => {
          toast.success("Relatório apagado");
          router.push("/relatorio-nao-conformidade");
        },
        onError: (e: Error) => toast.error(e.message || "Falha ao apagar"),
      }),
    });
  }

  function handleFinalizar() {
    const doFinalizar = () => atualizarRelatorio.mutate(
      { id_relatorio: id, status: "FINALIZADO" },
      {
        onSuccess: () => toast.success("Relatório finalizado"),
        onError: (e: Error) => toast.error(e.message || "Falha"),
      }
    );
    if (itens.length === 0) {
      setPendingAction({
        title: "Finalizar relatório",
        desc: "Nenhuma NC registrada. Finalizar mesmo assim (vai gerar um relatório vazio)?",
        fn: doFinalizar,
      });
      return;
    }
    doFinalizar();
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

  function handleAdicionarItem() {
    adicionarItem.mutate(
      { id_relatorio: id, ordem: itens.length + 1 },
      {
        onSuccess: () => toast.success("Nova NC adicionada"),
        onError: (e: Error) =>
          toast.error(e.message || "Falha ao adicionar NC"),
      }
    );
  }

  /**
   * Insere uma NC pré-preenchida a partir de um item do catálogo da NR.
   * Descrição vem do título do item (mais detalhamento se houver), e
   * `norma_violada` vira "NR-XX item.codigo". `item_codigo_origem` guarda
   * rastreabilidade pra UI mostrar quais já foram adicionados.
   */
  function handleInserirDoChecklist(itemCodigo: string, itemTitulo: string, itemDescricao: string | null) {
    if (!relatorio.nr_codigo) return;
    const descricao = itemDescricao
      ? `${itemTitulo}\n\n${itemDescricao}`
      : itemTitulo;
    const norma = `${relatorio.nr_codigo} item ${itemCodigo}`;
    adicionarItem.mutate(
      {
        id_relatorio: id,
        ordem: itens.length + 1,
        descricao,
        norma_violada: norma,
        item_codigo_origem: itemCodigo,
      },
      {
        onSuccess: () =>
          toast.success(`NC inserida (${relatorio.nr_codigo} ${itemCodigo})`),
        onError: (e: Error) =>
          toast.error(e.message || "Falha ao inserir NC"),
      }
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 print:max-w-none print:space-y-2">
      {/* Topo — ações (oculta no print) */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href="/relatorio-nao-conformidade"
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
          {canEdit && finalizado && (
            <button
              type="button"
              onClick={handleReabrir}
              disabled={atualizarRelatorio.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              Reabrir
            </button>
          )}
          {canEdit && !finalizado && (
            <button
              type="button"
              onClick={handleFinalizar}
              disabled={atualizarRelatorio.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <ShieldAlert className="size-4" /> Finalizar
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={handleExcluir}
              disabled={excluir.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              title="Apagar relatório"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Logo Chabra (print + tela) */}
      <RelatorioPrintHeader
        titulo={`Relatório de Não Conformidade — ${relatorio.titulo}`}
        subtitulo={empresa?.nome_empresa ?? null}
        terciario={
          relatorio.data_inspecao
            ? new Date(
                relatorio.data_inspecao + "T00:00"
              ).toLocaleDateString("pt-BR")
            : null
        }
      />

      {/* Cabeçalho */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm print:border-0 print:shadow-none print:p-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-red-700">
              Relatório de Não Conformidade
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">
              {relatorio.titulo}
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
          <DataItem
            label="NR vinculada"
            value={
              relatorio.nr_codigo
                ? `${relatorio.nr_codigo} — ${relatorio.nr_titulo ?? ""}`
                : "—"
            }
          />
          <DataItem label="Setor / Local" value={relatorio.setor ?? "—"} />
          <DataItem
            label="Responsável técnico (Chabra)"
            value={relatorio.responsavel ?? "—"}
          />
          <DataItem
            label="Responsável da empresa"
            value={relatorio.responsavel_empresa ?? "—"}
          />
          <DataItem label="Cidade" value={relatorio.cidade ?? "—"} />
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

        {!bloqueado && (
          <EditarCabecalho
            relatorio={relatorio}
            onSalvar={(patch) =>
              atualizarRelatorio.mutate({ id_relatorio: id, ...patch })
            }
          />
        )}
      </section>

      {/* Resumo */}
      <ResumoNC
        total={itens.length}
        alta={ncsAlta}
        media={ncsMedia}
        baixa={ncsBaixa}
      />

      {/* Textos Padrão — só aparecem no print, antes dos itens */}
      <TextosPadraoPrint
        modulo="nao_conformidade"
        valores={valoresTextosPadrao}
        posicao="antes"
      />

      {/* Lista de NCs */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700 print:text-base">
            Não Conformidades ({itens.length})
          </h2>
          {!bloqueado && (
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              {relatorio.nr_codigo && (
                <button
                  type="button"
                  onClick={() => setPickerAberto(true)}
                  disabled={adicionarItem.isPending}
                  className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  title={`Inserir NC a partir do checklist ${relatorio.nr_codigo}`}
                >
                  <ListChecks className="size-3" />
                  Inserir do checklist {relatorio.nr_codigo}
                </button>
              )}
              <button
                type="button"
                onClick={handleAdicionarItem}
                disabled={adicionarItem.isPending}
                className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {adicionarItem.isPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Plus className="size-3" />
                )}
                Adicionar NC
              </button>
            </div>
          )}
        </div>

        {itens.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500 print:hidden">
            {bloqueado
              ? "Nenhuma NC registrada neste relatório."
              : (
                <>
                  Nenhuma NC registrada. Clique em{" "}
                  <strong>Adicionar NC</strong> para começar.
                </>
              )}
          </div>
        ) : (
          <div className="space-y-3">
            {itens.map((item, idx) => (
              <ItemNCRow
                key={item.id_item}
                item={item}
                ordem={idx + 1}
                bloqueado={bloqueado}
                onPatch={(patch) =>
                  atualizarItem.mutate({
                    id_relatorio: id,
                    id_item: item.id_item,
                    ...patch,
                  })
                }
                onExcluir={() => {
                  setPendingAction({
                    title: `Apagar NC #${idx + 1}`,
                    desc: "Apagar esta não conformidade? A ação não pode ser desfeita.",
                    fn: () => excluirItem.mutate(
                      { id_relatorio: id, id_item: item.id_item },
                      {
                        onSuccess: () => toast.success("NC apagada"),
                        onError: (e: Error) => toast.error(e.message || "Falha ao apagar"),
                      }
                    ),
                  });
                }}
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
                  setPendingAction({
                    title: "Remover foto",
                    desc: "Remover esta foto? A ação não pode ser desfeita.",
                    fn: () => removerFoto.mutate(
                      {
                        id_relatorio: id,
                        id_item: item.id_item,
                        foto_storage_path: path,
                        fotos_urls_atuais: item.foto_urls,
                        fotos_paths_atuais: item.foto_storage_paths,
                      },
                      {
                        onSuccess: () => toast.success("Foto removida"),
                        onError: (e: Error) => toast.error(e.message || "Falha ao remover"),
                      }
                    ),
                  });
                }}
                onAmpliarFoto={(url) => setLightbox(url)}
                uploadEmAndamento={uploadFoto.isPending}
              />
            ))}
          </div>
        )}
      </section>

      {/* Observações gerais */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm print:border-0 print:shadow-none print:p-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
          Observações Gerais
        </label>
        <ObservacoesGerais
          value={relatorio.observacoes_gerais ?? ""}
          disabled={bloqueado}
          onSave={(v) =>
            atualizarRelatorio.mutate({
              id_relatorio: id,
              observacoes_gerais: v.trim() || null,
            })
          }
        />
      </section>

      {/* Bloco de Assinaturas */}
      <BlocoAssinaturas relatorio={relatorio} />

      <p className="text-center text-[9px] text-gray-500 print:mt-4">
        Relatório de Não Conformidade gerado por Chabra — Segurança e Saúde do
        Trabalho ·{" "}
        {relatorio.finalizado_em
          ? `Finalizado em ${new Date(relatorio.finalizado_em).toLocaleString("pt-BR")}`
          : `Criado em ${new Date(relatorio.created_at).toLocaleString("pt-BR")}`}
        {relatorio.usuario_nome ? ` · ${relatorio.usuario_nome}` : ""}
      </p>

      {pendingAction && (
        <ConfirmDialog
          open
          title={pendingAction.title}
          description={pendingAction.desc}
          variant="danger"
          confirmLabel="Confirmar"
          loading={excluir.isPending || excluirItem.isPending || removerFoto.isPending || atualizarRelatorio.isPending}
          onCancel={() => setPendingAction(null)}
          onConfirm={() => {
            pendingAction.fn();
            setPendingAction(null);
          }}
        />
      )}

      {/* Picker do checklist da NR — só aparece se há NR vinculada */}
      {pickerAberto && relatorio.nr_codigo && (
        <ChecklistPicker
          nrCodigo={relatorio.nr_codigo}
          codigosJaInseridos={
            new Set(
              itens
                .map((i) => i.item_codigo_origem)
                .filter((c): c is string => !!c)
            )
          }
          onInserir={handleInserirDoChecklist}
          onFechar={() => setPickerAberto(false)}
          inserindo={adicionarItem.isPending}
        />
      )}

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Visualizar foto"
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
            margin: 3cm 2cm 2cm 3cm;
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

function ResumoNC({
  total,
  alta,
  media,
  baixa,
}: {
  total: number;
  alta: number;
  media: number;
  baixa: number;
}) {
  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 print:grid-cols-4">
      <ResumoCard label="Total de NCs" valor={total} cor="red" />
      <ResumoCard label="Criticidade ALTA" valor={alta} cor="red" />
      <ResumoCard label="Criticidade MÉDIA" valor={media} cor="amber" />
      <ResumoCard label="Criticidade BAIXA" valor={baixa} cor="emerald" />
    </section>
  );
}

function ResumoCard({
  label,
  valor,
  cor,
}: {
  label: string;
  valor: string | number;
  cor: "red" | "amber" | "emerald";
}) {
  const cores = {
    red: "border-red-200 bg-red-50 text-red-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return (
    <div className={`rounded-lg border p-3 text-center ${cores[cor]}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">
        {label}
      </p>
      <p className="text-2xl font-bold">{valor}</p>
    </div>
  );
}

function ItemNCRow({
  item,
  ordem,
  bloqueado,
  onPatch,
  onExcluir,
  onUploadFoto,
  onRemoverFoto,
  onAmpliarFoto,
  uploadEmAndamento,
}: {
  item: RelatorioNaoConformidadeItem;
  ordem: number;
  bloqueado: boolean;
  onPatch: (patch: {
    descricao?: string;
    norma_violada?: string | null;
    criticidade?: CriticidadeNC;
    causa_raiz?: string | null;
    acao_corretiva?: string | null;
    prazo?: string | null;
    responsavel_tratativa?: string | null;
    status_tratativa?: StatusTratativaNC;
  }) => void;
  onExcluir: () => void;
  onUploadFoto: (file: File) => void;
  onRemoverFoto: (path: string) => void;
  onAmpliarFoto: (url: string) => void;
  uploadEmAndamento: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados locais pra textareas/inputs (salva no blur)
  const [descricao, setDescricao] = useState(item.descricao);
  const [normaViolada, setNormaViolada] = useState(item.norma_violada ?? "");
  const [causaRaiz, setCausaRaiz] = useState(item.causa_raiz ?? "");
  const [acaoCorretiva, setAcaoCorretiva] = useState(
    item.acao_corretiva ?? ""
  );
  const [respTratativa, setRespTratativa] = useState(
    item.responsavel_tratativa ?? ""
  );
  const [prazo, setPrazo] = useState(item.prazo ?? "");

  const corBorda = useMemo(() => {
    switch (item.criticidade) {
      case "ALTA":
        return "border-red-300 bg-red-50/40";
      case "MEDIA":
        return "border-amber-300 bg-amber-50/40";
      default:
        return "border-emerald-300 bg-emerald-50/40";
    }
  }, [item.criticidade]);

  const fotoUrls = item.foto_urls ?? [];
  const fotoPaths = item.foto_storage_paths ?? [];
  const temFotos = fotoUrls.length > 0;
  const limiteAtingido = fotoPaths.length >= MAX_FOTOS_POR_NC;

  const labelCls =
    "block text-[10px] font-semibold uppercase tracking-wider text-gray-600 mb-0.5 print:text-[10px]";
  const inputCls =
    "w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-50 disabled:text-gray-700 print:border-gray-300";

  return (
    <article
      className={`rounded-lg border p-4 print:break-inside-avoid ${corBorda}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-block min-w-[3rem] rounded bg-red-100 px-1.5 py-0.5 text-center font-mono text-[11px] font-bold text-red-800">
          NC #{ordem}
        </span>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <CriticidadeBadge criticidade={item.criticidade} />
            <StatusTratativaBadge status={item.status_tratativa} />
            {item.prazo && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                Prazo:{" "}
                {new Date(item.prazo + "T00:00").toLocaleDateString("pt-BR")}
              </span>
            )}
          </div>
        </div>
        {!bloqueado && (
          <button
            type="button"
            onClick={onExcluir}
            className="rounded-md p-1 text-red-600 hover:bg-red-100 print:hidden"
            title="Apagar esta NC"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className={labelCls}>Descrição da não conformidade *</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            onBlur={() => {
              if (descricao !== item.descricao) onPatch({ descricao });
            }}
            disabled={bloqueado}
            rows={2}
            placeholder="Descreva o que foi encontrado, onde e em que condição..."
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Norma violada</label>
          <input
            type="text"
            value={normaViolada}
            onChange={(e) => setNormaViolada(e.target.value)}
            onBlur={() => {
              const v = normaViolada.trim() || null;
              if (v !== (item.norma_violada ?? null))
                onPatch({ norma_violada: v });
            }}
            disabled={bloqueado}
            placeholder='Ex: "NR-12 item 12.5.10"'
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Criticidade</label>
          <div className="flex gap-1.5 print:hidden">
            {(["ALTA", "MEDIA", "BAIXA"] as CriticidadeNC[]).map((c) => (
              <CritButton
                key={c}
                criticidade={c}
                ativo={item.criticidade === c}
                disabled={bloqueado}
                onClick={() => onPatch({ criticidade: c })}
              />
            ))}
          </div>
          <p className="hidden text-sm font-bold print:block">
            {item.criticidade === "MEDIA" ? "MÉDIA" : item.criticidade}
          </p>
        </div>

        <div className="md:col-span-2">
          <label className={labelCls}>Causa raiz</label>
          <textarea
            value={causaRaiz}
            onChange={(e) => setCausaRaiz(e.target.value)}
            onBlur={() => {
              const v = causaRaiz.trim() || null;
              if (v !== (item.causa_raiz ?? null))
                onPatch({ causa_raiz: v });
            }}
            disabled={bloqueado}
            rows={2}
            placeholder="Por que a NC ocorreu? Falta de treinamento, manutenção, procedimento..."
            className={inputCls}
          />
        </div>

        <div className="md:col-span-2">
          <label className={labelCls}>Ação corretiva proposta</label>
          <textarea
            value={acaoCorretiva}
            onChange={(e) => setAcaoCorretiva(e.target.value)}
            onBlur={() => {
              const v = acaoCorretiva.trim() || null;
              if (v !== (item.acao_corretiva ?? null))
                onPatch({ acao_corretiva: v });
            }}
            disabled={bloqueado}
            rows={2}
            placeholder="O que deve ser feito para tratar a não conformidade..."
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Prazo</label>
          <input
            type="date"
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
            onBlur={() => {
              const v = prazo || null;
              if (v !== (item.prazo ?? null)) onPatch({ prazo: v });
            }}
            disabled={bloqueado}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Responsável pela tratativa</label>
          <input
            type="text"
            value={respTratativa}
            onChange={(e) => setRespTratativa(e.target.value)}
            onBlur={() => {
              const v = respTratativa.trim() || null;
              if (v !== (item.responsavel_tratativa ?? null))
                onPatch({ responsavel_tratativa: v });
            }}
            disabled={bloqueado}
            placeholder="Quem vai executar a ação corretiva"
            className={inputCls}
          />
        </div>

        <div className="md:col-span-2">
          <label className={labelCls}>Status da tratativa</label>
          <div className="flex flex-wrap gap-1.5 print:hidden">
            {(
              ["ABERTA", "EM_TRATAMENTO", "ENCERRADA"] as StatusTratativaNC[]
            ).map((s) => (
              <StatusButton
                key={s}
                status={s}
                ativo={item.status_tratativa === s}
                disabled={bloqueado}
                onClick={() => onPatch({ status_tratativa: s })}
              />
            ))}
          </div>
          <p className="hidden text-sm font-bold print:block">
            {item.status_tratativa === "EM_TRATAMENTO"
              ? "EM TRATAMENTO"
              : item.status_tratativa}
          </p>
        </div>
      </div>

      {/* Fotos */}
      <div className="mt-4">
        <div className="flex items-center justify-between print:hidden">
          <label className={labelCls}>Evidência fotográfica</label>
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
                    ? `Limite de ${MAX_FOTOS_POR_NC} fotos por NC`
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
        </div>

        {temFotos && (
          <div className="mt-2 flex justify-center">
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
                    ordem={ordem}
                    onAmpliar={onAmpliarFoto}
                    onRemover={
                      !bloqueado && path ? () => onRemoverFoto(path) : undefined
                    }
                  />
                );
              })}
            </div>
          </div>
        )}

        {bloqueado && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-gray-500 print:hidden">
            <Lock className="size-3" /> Finalizado
          </p>
        )}
      </div>
    </article>
  );
}

function FotoThumb({
  url,
  ordem,
  onAmpliar,
  onRemover,
}: {
  url: string;
  ordem: number;
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
          alt={`Evidência NC #${ordem}`}
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

function CriticidadeBadge({ criticidade }: { criticidade: CriticidadeNC }) {
  const cfg = {
    ALTA: { cls: "bg-red-100 text-red-800 border-red-300", label: "ALTA" },
    MEDIA: {
      cls: "bg-amber-100 text-amber-800 border-amber-300",
      label: "MÉDIA",
    },
    BAIXA: {
      cls: "bg-emerald-100 text-emerald-800 border-emerald-300",
      label: "BAIXA",
    },
  }[criticidade];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${cfg.cls}`}
    >
      <AlertTriangle className="size-3" /> {cfg.label}
    </span>
  );
}

function StatusTratativaBadge({ status }: { status: StatusTratativaNC }) {
  const cfg = {
    ABERTA: { cls: "bg-red-100 text-red-800", label: "Aberta" },
    EM_TRATAMENTO: {
      cls: "bg-amber-100 text-amber-800",
      label: "Em tratamento",
    },
    ENCERRADA: {
      cls: "bg-emerald-100 text-emerald-800",
      label: "Encerrada",
    },
  }[status];
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}

function CritButton({
  criticidade,
  ativo,
  disabled,
  onClick,
}: {
  criticidade: CriticidadeNC;
  ativo: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const cfg = {
    ALTA: {
      ativo: "bg-red-600 text-white hover:bg-red-700",
      inativo:
        "border-red-300 bg-white text-red-700 hover:bg-red-50",
      label: "Alta",
    },
    MEDIA: {
      ativo: "bg-amber-500 text-white hover:bg-amber-600",
      inativo:
        "border-amber-300 bg-white text-amber-700 hover:bg-amber-50",
      label: "Média",
    },
    BAIXA: {
      ativo: "bg-emerald-600 text-white hover:bg-emerald-700",
      inativo:
        "border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50",
      label: "Baixa",
    },
  }[criticidade];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold disabled:opacity-50 ${
        ativo ? cfg.ativo : cfg.inativo
      }`}
    >
      {cfg.label}
    </button>
  );
}

function StatusButton({
  status,
  ativo,
  disabled,
  onClick,
}: {
  status: StatusTratativaNC;
  ativo: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const cfg = {
    ABERTA: {
      ativo: "bg-red-600 text-white hover:bg-red-700",
      inativo: "border-red-300 bg-white text-red-700 hover:bg-red-50",
      label: "Aberta",
    },
    EM_TRATAMENTO: {
      ativo: "bg-amber-500 text-white hover:bg-amber-600",
      inativo: "border-amber-300 bg-white text-amber-700 hover:bg-amber-50",
      label: "Em tratamento",
    },
    ENCERRADA: {
      ativo: "bg-emerald-600 text-white hover:bg-emerald-700",
      inativo:
        "border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50",
      label: "Encerrada",
    },
  }[status];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold disabled:opacity-50 ${
        ativo ? cfg.ativo : cfg.inativo
      }`}
    >
      {cfg.label}
    </button>
  );
}

const MESES_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function formatarDataExtenso(iso: string | null): string {
  if (!iso) return "____ de ___________ de ______";
  const d = new Date(iso + "T00:00");
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()} de ${MESES_PT[d.getMonth()]} de ${d.getFullYear()}`;
}

function BlocoAssinaturas({
  relatorio,
}: {
  relatorio: RelatorioNaoConformidade;
}) {
  const cidade = relatorio.cidade?.trim() || "_____________________";
  const dataExtenso = formatarDataExtenso(relatorio.data_inspecao);
  const responsavelTecnico = relatorio.responsavel?.trim() || "";
  const responsavelEmpresa = relatorio.responsavel_empresa?.trim() || "";

  return (
    <section className="break-inside-avoid rounded-xl border border-gray-200 bg-white p-5 shadow-sm print:border-0 print:shadow-none print:mt-8 print:p-2">
      <p className="text-sm text-gray-900 print:text-[13px]">
        {cidade}, {dataExtenso}.
      </p>

      <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 print:mt-16 print:gap-12">
        <Assinatura
          nome={responsavelTecnico}
          cargo="Responsável Técnico"
          subtitulo="Chabra Saúde e Segurança do Trabalho"
        />
        <Assinatura
          nome={responsavelEmpresa}
          cargo="Responsável pela Empresa"
          subtitulo={null}
        />
      </div>
    </section>
  );
}

function Assinatura({
  nome,
  cargo,
  subtitulo,
}: {
  nome: string;
  cargo: string;
  subtitulo: string | null;
}) {
  return (
    <div className="text-center">
      <div className="border-t border-gray-900" />
      <p className="mt-1 text-sm font-semibold text-gray-900 print:text-[13px]">
        {nome || "_____________________________"}
      </p>
      <p className="text-xs text-gray-700 print:text-[11px]">{cargo}</p>
      {subtitulo && (
        <p className="text-[11px] text-gray-500 print:text-[10px]">
          {subtitulo}
        </p>
      )}
    </div>
  );
}

function EditarCabecalho({
  relatorio,
  onSalvar,
}: {
  relatorio: RelatorioNaoConformidade;
  onSalvar: (patch: {
    titulo?: string;
    nr_codigo?: string | null;
    setor?: string | null;
    responsavel?: string | null;
    responsavel_empresa?: string | null;
    cidade?: string | null;
    data_inspecao?: string | null;
  }) => void;
}) {
  const nrsDisponiveis = useMemo(() => listarNRs(), []);
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState(relatorio.titulo);
  const [setor, setSetor] = useState(relatorio.setor ?? "");
  const [responsavel, setResponsavel] = useState(relatorio.responsavel ?? "");
  const [respEmpresa, setRespEmpresa] = useState(
    relatorio.responsavel_empresa ?? ""
  );
  const [cidade, setCidade] = useState(relatorio.cidade ?? "");
  const [dataInsp, setDataInsp] = useState(relatorio.data_inspecao ?? "");

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline print:hidden"
      >
        Editar dados do cabeçalho →
      </button>
    );
  }

  const lblCls =
    "text-[10px] font-semibold uppercase tracking-wider text-gray-600 mb-0.5 block";
  const inputCls =
    "w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

  return (
    <div className="mt-4 grid grid-cols-1 gap-3 rounded-md border border-red-200 bg-red-50/30 p-3 sm:grid-cols-2 print:hidden">
      <div className="sm:col-span-2">
        <label className={lblCls}>Título do relatório</label>
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={() => {
            const v = titulo.trim();
            if (v && v !== relatorio.titulo) onSalvar({ titulo: v });
          }}
          className={inputCls}
        />
      </div>
      <div className="sm:col-span-2">
        <label className={lblCls}>
          NR vinculada{" "}
          <span className="font-normal normal-case text-gray-400">
            (opcional)
          </span>
        </label>
        <select
          value={relatorio.nr_codigo ?? ""}
          onChange={(e) =>
            onSalvar({ nr_codigo: e.target.value || null })
          }
          className={inputCls}
        >
          <option value="">— Sem NR vinculada —</option>
          {nrsDisponiveis.map((nr) => (
            <option key={nr.codigo} value={nr.codigo}>
              {nr.codigo} — {nr.titulo}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={lblCls}>Setor / Local</label>
        <input
          type="text"
          value={setor}
          onChange={(e) => setSetor(e.target.value)}
          onBlur={() => onSalvar({ setor: setor.trim() || null })}
          className={inputCls}
        />
      </div>
      <div>
        <label className={lblCls}>Responsável técnico (Chabra)</label>
        <input
          type="text"
          value={responsavel}
          onChange={(e) => setResponsavel(e.target.value)}
          onBlur={() => onSalvar({ responsavel: responsavel.trim() || null })}
          className={inputCls}
        />
      </div>
      <div>
        <label className={lblCls}>Responsável da empresa</label>
        <input
          type="text"
          value={respEmpresa}
          onChange={(e) => setRespEmpresa(e.target.value)}
          onBlur={() =>
            onSalvar({ responsavel_empresa: respEmpresa.trim() || null })
          }
          className={inputCls}
        />
      </div>
      <div>
        <label className={lblCls}>Cidade</label>
        <input
          type="text"
          value={cidade}
          onChange={(e) => setCidade(e.target.value)}
          onBlur={() => onSalvar({ cidade: cidade.trim() || null })}
          className={inputCls}
        />
      </div>
      <div>
        <label className={lblCls}>Data da inspeção</label>
        <input
          type="date"
          value={dataInsp}
          onChange={(e) => setDataInsp(e.target.value)}
          onBlur={() => onSalvar({ data_inspecao: dataInsp || null })}
          className={inputCls}
        />
      </div>
      <div className="flex items-end justify-end sm:col-span-2">
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          Fechar edição
        </button>
      </div>
    </div>
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
      className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-50 print:resize-none"
    />
  );
}

/**
 * Modal pra inserção rápida de NCs a partir do catálogo da NR vinculada.
 * Cada item pode ser inserido individualmente (clique no "+"); itens já
 * inseridos no relatório aparecem desabilitados (identificados via
 * `item_codigo_origem`). O modal continua aberto após cada inserção pra
 * permitir múltiplas inserções sem reabrir.
 */
function ChecklistPicker({
  nrCodigo,
  codigosJaInseridos,
  onInserir,
  onFechar,
  inserindo,
}: {
  nrCodigo: string;
  codigosJaInseridos: Set<string>;
  onInserir: (
    itemCodigo: string,
    itemTitulo: string,
    itemDescricao: string | null
  ) => void;
  onFechar: () => void;
  inserindo: boolean;
}) {
  const checklist = useMemo(() => getChecklistNR(nrCodigo), [nrCodigo]);
  const [busca, setBusca] = useState("");

  const itensFiltrados = useMemo(() => {
    if (!checklist) return [];
    const termo = busca.trim().toLowerCase();
    if (!termo) return checklist.itens;
    return checklist.itens.filter(
      (it) =>
        it.codigo.toLowerCase().includes(termo) ||
        it.titulo.toLowerCase().includes(termo) ||
        (it.descricao ?? "").toLowerCase().includes(termo)
    );
  }, [checklist, busca]);

  if (!checklist) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:hidden"
        onClick={onFechar}
      >
        <div
          className="rounded-lg bg-white p-6 text-sm text-red-700"
          onClick={(e) => e.stopPropagation()}
        >
          NR {nrCodigo} não encontrada no catálogo.
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:hidden"
      onClick={onFechar}
      aria-hidden="true"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 p-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-red-700">
              Inserir NC do checklist
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-gray-900">
              {checklist.codigo} — {checklist.titulo}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Clique em um item pra criá-lo como NC com descrição e norma
              violada já pré-preenchidas. {codigosJaInseridos.size} de{" "}
              {checklist.itens.length} já inseridos.
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
            title="Fechar"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Busca */}
        <div className="border-b border-gray-100 px-4 py-3">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por código ou texto do item..."
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            autoFocus
          />
        </div>

        {/* Lista */}
        <ul className="flex-1 divide-y divide-gray-100 overflow-y-auto">
          {itensFiltrados.length === 0 && (
            <li className="p-6 text-center text-sm text-gray-500">
              Nenhum item encontrado.
            </li>
          )}
          {itensFiltrados.map((it) => {
            const jaInserido = codigosJaInseridos.has(it.codigo);
            return (
              <li
                key={it.codigo}
                className={`flex items-start gap-3 p-3 ${
                  jaInserido ? "bg-gray-50" : "hover:bg-red-50/40"
                }`}
              >
                <span className="mt-0.5 inline-block min-w-[3.5rem] rounded bg-red-100 px-1.5 py-0.5 text-center font-mono text-[11px] font-bold text-red-800">
                  {it.codigo}
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-semibold ${
                      jaInserido ? "text-gray-500 line-through" : "text-gray-900"
                    }`}
                  >
                    {it.titulo}
                  </p>
                  {it.descricao && (
                    <p
                      className={`mt-0.5 text-xs ${
                        jaInserido ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      {it.descricao}
                    </p>
                  )}
                </div>
                {jaInserido ? (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
                    title="Esta NC já foi inserida no relatório"
                  >
                    <Check className="size-3" /> Inserida
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      onInserir(it.codigo, it.titulo, it.descricao ?? null)
                    }
                    disabled={inserindo}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {inserindo ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Plus className="size-3" />
                    )}
                    Inserir
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {/* Rodapé */}
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 text-right">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

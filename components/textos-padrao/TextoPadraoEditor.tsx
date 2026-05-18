"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Save,
  Trash2,
  ChevronUp,
  ChevronDown,
  BookOpen,
  ImageIcon,
  X,
  Loader2,
  Variable,
  FileText,
  RectangleHorizontal,
} from "lucide-react";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import RichTextEditor from "@/components/drps/RichTextEditor";
import CapaEditor from "@/components/drps/CapaEditor";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CaixaTexto } from "@/lib/drps/types";
import {
  useTextosPadrao,
  useCriarCapituloTexto,
  useSalvarCapituloTexto,
  useExcluirCapituloTexto,
} from "@/lib/hooks/useTextosPadrao";
import {
  type ModuloTextoPadrao,
  type OrientacaoPagina,
  type TextoPadraoCapitulo,
  MODULO_CONFIGS,
} from "@/lib/textos-padrao/types";
import { VARIAVEIS_POR_MODULO } from "@/lib/textos-padrao/variaveis";

interface Props {
  modulo: ModuloTextoPadrao;
}

/**
 * Editor genérico de Texto Padrão. Replica a UI da página do Psicossocial,
 * mas trabalha com a tabela `textos_padrao` e recebe qual módulo via prop.
 *
 * Cada quadro (SST, Conformidade, Análise de Químicos) tem sua página fina
 * que apenas renderiza este componente passando o módulo correto.
 */
export default function TextoPadraoEditor({ modulo }: Props) {
  const config = MODULO_CONFIGS[modulo];
  const variaveis = VARIAVEIS_POR_MODULO[modulo];
  const { data: capitulos = [], isLoading } = useTextosPadrao(modulo);
  const criar = useCriarCapituloTexto(modulo);
  const salvar = useSalvarCapituloTexto(modulo);
  const excluir = useExcluirCapituloTexto(modulo);

  const [confirmExcluir, setConfirmExcluir] =
    useState<TextoPadraoCapitulo | null>(null);
  const [mostrarVars, setMostrarVars] = useState(false);

  function novoCapitulo() {
    const ordem = capitulos.length;
    criar.mutate({
      titulo: `Capítulo ${ordem + 1}`,
      conteudo: "",
      ordem,
    });
  }

  function seedTemplate() {
    const tpl = TEMPLATES_POR_MODULO[modulo];
    let ordem = capitulos.length;
    for (const t of tpl) {
      criar.mutate({ titulo: t.titulo, conteudo: t.conteudo, ordem });
      ordem++;
    }
  }

  function mover(cap: TextoPadraoCapitulo, direcao: "up" | "down") {
    const idx = capitulos.findIndex((c) => c.id_capitulo === cap.id_capitulo);
    const novoIdx = direcao === "up" ? idx - 1 : idx + 1;
    if (novoIdx < 0 || novoIdx >= capitulos.length) return;
    const outro = capitulos[novoIdx];
    salvar.mutate({ id_capitulo: cap.id_capitulo, ordem: outro.ordem });
    salvar.mutate({ id_capitulo: outro.id_capitulo, ordem: cap.ordem });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {config.titulo}
          </h1>
          <p className="max-w-2xl text-sm text-gray-600">{config.descricao}</p>
          <p className="mt-1 text-xs italic text-teal-700">{config.destino}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMostrarVars((v) => !v)}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Variable className="size-4" />
            {mostrarVars ? "Ocultar variáveis" : "Variáveis disponíveis"}
          </button>
          {capitulos.length === 0 && !isLoading && (
            <button
              type="button"
              onClick={seedTemplate}
              disabled={criar.isPending}
              className="inline-flex items-center gap-2 rounded-md border border-verde-primary bg-white px-3 py-2 text-sm font-semibold text-verde-primary hover:bg-verde-light disabled:opacity-50"
            >
              <BookOpen className="size-4" /> Carregar modelo inicial
            </button>
          )}
          <button
            type="button"
            onClick={novoCapitulo}
            disabled={criar.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent disabled:opacity-50"
          >
            <Plus className="size-4" /> Novo Capítulo
          </button>
        </div>
      </div>

      {/* Painel de variáveis disponíveis */}
      {mostrarVars && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-sky-700">
            Variáveis disponíveis neste módulo
          </p>
          <p className="mb-2 text-xs text-gray-600">
            Insira no texto do capítulo as marcações abaixo. Elas serão
            substituídas pelos valores reais ao gerar o PDF.
          </p>
          <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
            {variaveis.map((v) => (
              <div
                key={v.chave}
                className="flex items-center justify-between gap-2 rounded border border-sky-100 bg-white px-2 py-1"
              >
                <div className="min-w-0 flex-1">
                  <code className="text-[11px] text-sky-700">{`{{${v.chave}}}`}</code>
                  <p className="text-[10px] text-gray-600">{v.rotulo}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(`{{${v.chave}}}`);
                    toast.success(`{{${v.chave}}} copiado`);
                  }}
                  className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 hover:bg-sky-200"
                  title="Copiar"
                >
                  Copiar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <LoadingSkeleton rows={3} />
        </div>
      ) : capitulos.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">
          Nenhum capítulo cadastrado ainda. Clique em{" "}
          <strong>Carregar modelo inicial</strong> para popular com sugestões
          ou em <strong>Novo Capítulo</strong> para começar do zero.
        </div>
      ) : (
        <div className="space-y-3">
          {capitulos.map((cap, i) => (
            <CapituloCard
              key={cap.id_capitulo}
              capitulo={cap}
              indice={i}
              total={capitulos.length}
              salvando={salvar.isPending}
              storagePrefix={`textos-padrao/${modulo}`}
              onSalvar={(patch) =>
                salvar.mutate({ id_capitulo: cap.id_capitulo, ...patch })
              }
              onMover={(dir) => mover(cap, dir)}
              onExcluir={() => setConfirmExcluir(cap)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmExcluir}
        title="Excluir capítulo?"
        description={
          confirmExcluir
            ? `O capítulo "${confirmExcluir.titulo}" será removido permanentemente.`
            : undefined
        }
        variant="danger"
        loading={excluir.isPending}
        onConfirm={() => {
          if (!confirmExcluir) return;
          excluir.mutate(confirmExcluir.id_capitulo, {
            onSuccess: () => setConfirmExcluir(null),
          });
        }}
        onCancel={() => setConfirmExcluir(null)}
      />
    </div>
  );
}

// ============================================================
// CapituloCard — copiado do DRPS, com `storagePrefix` configurável
// ============================================================

function CapituloCard({
  capitulo,
  indice,
  total,
  salvando,
  storagePrefix,
  onSalvar,
  onMover,
  onExcluir,
}: {
  capitulo: TextoPadraoCapitulo;
  indice: number;
  total: number;
  salvando: boolean;
  storagePrefix: string;
  onSalvar: (patch: {
    titulo?: string;
    conteudo?: string | null;
    bg_imagem_url?: string | null;
    caixas_texto?: CaixaTexto[] | null;
    orientacao?: OrientacaoPagina;
  }) => void;
  onMover: (dir: "up" | "down") => void;
  onExcluir: () => void;
}) {
  const [titulo, setTitulo] = useState(capitulo.titulo);
  const [conteudo, setConteudo] = useState(capitulo.conteudo ?? "");
  const [caixas, setCaixas] = useState<CaixaTexto[]>(
    capitulo.caixas_texto ?? []
  );
  const [dirty, setDirty] = useState(false);
  const [enviandoBg, setEnviandoBg] = useState(false);
  const bgInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTitulo(capitulo.titulo);
    setConteudo(capitulo.conteudo ?? "");
    setCaixas(capitulo.caixas_texto ?? []);
    setDirty(false);
  }, [
    capitulo.id_capitulo,
    capitulo.titulo,
    capitulo.conteudo,
    capitulo.caixas_texto,
  ]);

  async function enviarBg(file: File) {
    if (enviandoBg) return;
    setEnviandoBg(true);
    const loadingId = toast.loading("Enviando imagem de fundo...");
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${storagePrefix}/bg-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("fotos")
        .upload(path, file, {
          cacheControl: "31536000",
          upsert: false,
          contentType: file.type || undefined,
        });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("fotos").getPublicUrl(path);
      if (!pub?.publicUrl) throw new Error("URL pública não retornada");
      onSalvar({ bg_imagem_url: pub.publicUrl });
      toast.success("Imagem de fundo definida", { id: loadingId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha no upload";
      toast.error(msg, { id: loadingId });
    } finally {
      setEnviandoBg(false);
    }
  }

  function removerBg() {
    onSalvar({ bg_imagem_url: null });
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-start gap-2">
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => onMover("up")}
            disabled={indice === 0}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
            title="Mover para cima"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onMover("down")}
            disabled={indice === total - 1}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
            title="Mover para baixo"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
        <div className="flex-1">
          <input
            type="text"
            value={titulo}
            onChange={(e) => {
              setTitulo(e.target.value);
              setDirty(true);
            }}
            placeholder="Título do capítulo"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          />
        </div>
        <button
          type="button"
          onClick={() =>
            onSalvar({
              titulo: titulo.trim(),
              conteudo: conteudo.trim() || null,
              caixas_texto: caixas,
            })
          }
          disabled={!dirty || salvando || !titulo.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-2 text-xs font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
        >
          <Save className="size-3.5" /> Salvar
        </button>
        <button
          type="button"
          onClick={onExcluir}
          className="rounded-md border border-gray-300 bg-white p-2 text-gray-500 hover:bg-red-50 hover:text-red-alert"
          title="Excluir"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      {/* Orientação da página */}
      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 p-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          Orientação no PDF:
        </span>
        <div className="inline-flex overflow-hidden rounded-md border border-gray-300 bg-white">
          <button
            type="button"
            onClick={() =>
              capitulo.orientacao !== "retrato" &&
              onSalvar({ orientacao: "retrato" })
            }
            disabled={salvando}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors ${
              capitulo.orientacao === "retrato"
                ? "bg-verde-primary text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            } disabled:opacity-50`}
          >
            <FileText className="size-3.5" /> Retrato
          </button>
          <button
            type="button"
            onClick={() =>
              capitulo.orientacao !== "paisagem" &&
              onSalvar({ orientacao: "paisagem" })
            }
            disabled={salvando}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors ${
              capitulo.orientacao === "paisagem"
                ? "bg-verde-primary text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            } disabled:opacity-50`}
          >
            <RectangleHorizontal className="size-3.5" /> Paisagem
          </button>
        </div>
        <span className="text-[10px] italic text-gray-500">
          {capitulo.orientacao === "paisagem"
            ? "Página A4 horizontal — útil pra tabelas/gráficos largos."
            : "Página A4 vertical — padrão ABNT."}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 p-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          Imagem de fundo (capa):
        </span>
        {capitulo.bg_imagem_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={capitulo.bg_imagem_url}
              alt="Fundo"
              className="h-10 w-16 rounded border border-gray-300 object-cover"
            />
            <span className="text-[10px] text-gray-600">
              Este capítulo sai como página inteira no PDF.
            </span>
            <button
              type="button"
              onClick={removerBg}
              disabled={salvando}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-red-50 hover:text-red-alert disabled:opacity-50"
            >
              <X className="size-3.5" /> Remover
            </button>
          </>
        ) : (
          <span className="text-[11px] italic text-gray-500">
            Sem imagem (capítulo em fluxo normal).
          </span>
        )}
        <input
          ref={bgInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) enviarBg(f);
            if (bgInputRef.current) bgInputRef.current.value = "";
          }}
        />
        {!capitulo.bg_imagem_url && (
          <button
            type="button"
            onClick={() => bgInputRef.current?.click()}
            disabled={enviandoBg || salvando}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-verde-primary bg-white px-2 py-1 text-xs font-semibold text-verde-primary hover:bg-verde-light disabled:opacity-50"
          >
            {enviandoBg ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ImageIcon className="size-3.5" />
            )}
            Enviar imagem
          </button>
        )}
      </div>

      {capitulo.bg_imagem_url ? (
        <CapaEditor
          bgImagemUrl={capitulo.bg_imagem_url}
          caixas={caixas}
          onChange={(novas) => {
            setCaixas(novas);
            setDirty(true);
          }}
        />
      ) : (
        <RichTextEditor
          value={conteudo}
          onChange={(html) => {
            setConteudo(html);
            setDirty(true);
          }}
          placeholder="Conteúdo do capítulo... use {{empresa_nome}}, {{cnpj}} etc. pra inserir variáveis."
        />
      )}
    </div>
  );
}

// ============================================================
// Templates iniciais por módulo (botão "Carregar modelo inicial")
// ============================================================

const TEMPLATES_POR_MODULO: Record<
  ModuloTextoPadrao,
  Array<{ titulo: string; conteudo: string }>
> = {
  sst: [
    {
      titulo: "1. Introdução",
      conteudo:
        '<p style="text-align: justify">Este relatório de Inspeção de Segurança e Saúde do Trabalho foi elaborado conforme a <strong>NR-01</strong> (Disposições Gerais e Gerenciamento de Riscos Ocupacionais), para a empresa <strong>{{empresa_nome}}</strong> (CNPJ {{cnpj}}).</p>',
    },
    {
      titulo: "2. Metodologia",
      conteudo:
        '<p style="text-align: justify">Inspeção realizada in loco em {{data_inspecao}}, com observação direta dos postos de trabalho, entrevistas com trabalhadores e análise documental dos programas de segurança vigentes.</p>',
    },
    {
      titulo: "3. Considerações Finais",
      conteudo:
        '<p style="text-align: justify">Recomenda-se o cumprimento dos prazos do plano de ação, monitoramento periódico dos riscos identificados e revisão anual do PGR conforme NR-1.</p>',
    },
  ],
  conformidade: [
    {
      titulo: "1. Introdução",
      conteudo:
        '<p style="text-align: justify">O presente Relatório de Conformidade tem por objetivo verificar o atendimento da empresa <strong>{{empresa_nome}}</strong> (CNPJ {{cnpj}}) aos requisitos da <strong>{{nr_codigo}} — {{nr_titulo}}</strong>, no setor {{setor}}, em {{data_inspecao}}.</p>',
    },
    {
      titulo: "2. Fundamentação Legal",
      conteudo:
        '<p style="text-align: justify">A auditoria foi conduzida com base na redação vigente da {{nr_codigo}}, publicada pela Subsecretaria de Inspeção do Trabalho do Ministério do Trabalho e Emprego.</p>',
    },
    {
      titulo: "3. Considerações Finais",
      conteudo:
        '<p style="text-align: justify">Os itens marcados como CONFORMES atendem aos requisitos da norma; itens NÃO APLICÁVEIS foram avaliados quanto à pertinência ao setor auditado. Recomenda-se manutenção das condições verificadas e reavaliação periódica.</p>',
    },
  ],
  analise_quimicos: [
    {
      titulo: "1. Introdução",
      conteudo:
        '<p style="text-align: justify">Análise de Agente Químico realizada com base nas informações da Ficha de Informações de Segurança de Produto Químico (FISPQ/FDS) do produto <strong>{{titulo}}</strong>, para a empresa <strong>{{empresa_nome}}</strong>.</p>',
    },
    {
      titulo: "2. Base Normativa",
      conteudo:
        '<p style="text-align: justify">Avaliação conduzida conforme NR-15 (Atividades e Operações Insalubres), NR-16 (Atividades e Operações Perigosas), ACGIH TLV/BEI, IARC Monographs e Decreto 3.048/99 Anexo IV.</p>',
    },
    {
      titulo: "3. Considerações Finais",
      conteudo:
        '<p style="text-align: justify">O parecer é informativo e não substitui avaliação ambiental quantitativa. Recomenda-se medição de exposição quando indicado e revisão sempre que houver alteração na composição do produto ou nas condições de uso.</p>',
    },
  ],
};

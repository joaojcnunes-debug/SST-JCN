"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import {
  SLUG_TO_DEFAULT_IMAGE,
  CHECKLIST_PERGUNTAS_PADRAO,
  useAetInicializarOwasConfig,
  useAetInicializarOwasSelects,
  useAetInicializarChecklistPerguntas,
  useAetOwasConfig,
  useAetOwasSelects,
  useAetChecklistPerguntas,
  useAetSalvarOwasCategoria,
  useAetSalvarOwasSelect,
  useAetSalvarChecklistPergunta,
  useAetDeletarChecklistPergunta,
} from "@/lib/hooks/useAet";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import StorageImg from "@/components/ui/StorageImg";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AetChecklistPergunta, AetOwasCategoria, AetOwasOpcao, AetOwasSelectCampo } from "@/lib/supabase/types";

type ItemOrdem = { tipo: "pergunta" | "select"; slug: string };
type SecaoOrdem = { secao: string; items: ItemOrdem[] };

const CHECKLIST_ORDEM: SecaoOrdem[] = [
  {
    secao: "Postura",
    items: [
      { tipo: "pergunta", slug: "levantamento_acima_limite" },
      { tipo: "select",   slug: "trabalho_predominante" },
      { tipo: "pergunta", slug: "pausas_descanso" },
      { tipo: "pergunta", slug: "uso_cadeira" },
      { tipo: "pergunta", slug: "cadeira_adequada" },
      { tipo: "pergunta", slug: "monitor" },
    ],
  },
  {
    secao: "Organização do Trabalho",
    items: [{ tipo: "pergunta", slug: "organizacao_trabalho" }],
  },
  {
    secao: "Exigência de Tempo",
    items: [{ tipo: "pergunta", slug: "exigencia_levantamento" }],
  },
  {
    secao: "Ritmo de Trabalho",
    items: [{ tipo: "pergunta", slug: "ritmo_por_demanda" }],
  },
  {
    secao: "Adoção de Rodízios — Ergonômico",
    items: [
      { tipo: "pergunta", slug: "pausas_formais" },
      { tipo: "pergunta", slug: "rodizios_sistematizados" },
    ],
  },
];

const RECOMENDACOES_CAMPOS = [
  "Parecer Técnico",
  "Recomendações",
  "Demais Condições Avaliadas",
];

export default function OwasConfigPage() {
  const { data: categorias = [], isLoading } = useAetOwasConfig();
  const inicializar = useAetInicializarOwasConfig();
  const { data: selectCampos = [] } = useAetOwasSelects();
  const inicializarSelects = useAetInicializarOwasSelects();
  const { data: checklistPerguntas = [] } = useAetChecklistPerguntas();
  const inicializarPerguntas = useAetInicializarChecklistPerguntas();
  const [restaurando, setRestaurando] = useState(false);
  const [addingSecao, setAddingSecao] = useState<string | null>(null);
  const deletar = useAetDeletarChecklistPergunta();

  async function handleRestaurarChecklist() {
    setRestaurando(true);
    try {
      await inicializarSelects.mutateAsync(undefined);
      await inicializarPerguntas.mutateAsync(undefined);
      toast.success("Padrões restaurados");
    } catch {
      toast.error("Erro ao restaurar padrões");
    } finally {
      setRestaurando(false);
    }
  }

  const isPlaceholder = categorias.length > 0 && categorias[0].id.startsWith("padrao-");

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Configuração OWAS</h1>
          <p className="text-sm text-gray-600">
            Personalize títulos, imagens de referência e opções de cada categoria.
            Usado nos Perfis OWAS e na análise de setores.
          </p>
        </div>
      </div>

      {isPlaceholder && !isLoading && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="flex-1 text-sm text-amber-900">
            As categorias ainda não foram salvas no banco. Clique em{" "}
            <strong>Inicializar</strong> para criar as 4 categorias padrão e começar a personalizar.
          </p>
          <button
            type="button"
            onClick={() =>
              inicializar.mutate(undefined, {
                onSuccess: () => toast.success("Categorias inicializadas com sucesso"),
              })
            }
            disabled={inicializar.isPending}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
          >
            {inicializar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Inicializar
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <LoadingSkeleton rows={4} />
        </div>
      ) : (
        <div className="space-y-4">
          {categorias.map((cat) => (
            <CategoriaCard key={cat.id} categoria={cat} disabled={isPlaceholder} />
          ))}
        </div>
      )}

      {/* ── Checklist: Perguntas e Campos ── */}
      <div className="pt-2">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Checklist — Perguntas e Campos</h2>
            <p className="text-sm text-gray-600">
              Edite os textos e opções de todos os campos do checklist ergonômico.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRestaurarChecklist}
            disabled={restaurando}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {restaurando ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Restaurar padrões
          </button>
        </div>

        <div className="space-y-6">
          {CHECKLIST_ORDEM.map(({ secao, items }) => {
            const fonte = checklistPerguntas.length > 0 ? checklistPerguntas : CHECKLIST_PERGUNTAS_PADRAO;
            const standardSlugs = new Set(items.map((i) => i.slug));
            const customPerguntas = fonte.filter(
              (p) => p.secao === secao && !standardSlugs.has(p.slug) && p.tipo !== "texto"
            );
            return (
              <div key={secao}>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">{secao}</p>
                <div className="space-y-2">
                  {items.map((item) => {
                    if (item.tipo === "select") {
                      const campo = selectCampos.find((c) => c.slug === item.slug);
                      if (!campo) return null;
                      return <SelectCampoCard key={item.slug} campo={campo} />;
                    }
                    const pergunta = fonte.find((p) => p.slug === item.slug);
                    if (!pergunta) return null;
                    return (
                      <PerguntaCard
                        key={item.slug}
                        pergunta={pergunta}
                        onDelete={() => deletar.mutate(pergunta.slug)}
                      />
                    );
                  })}

                  {customPerguntas.map((p) => (
                    <PerguntaCard
                      key={p.slug}
                      pergunta={p}
                      onDelete={() => deletar.mutate(p.slug)}
                    />
                  ))}

                  {addingSecao === secao && (
                    <NovaPerguntaInline secao={secao} onCancel={() => setAddingSecao(null)} />
                  )}

                  {addingSecao !== secao && (
                    <button
                      type="button"
                      onClick={() => setAddingSecao(secao)}
                      className="mt-1 inline-flex items-center gap-1 text-xs text-verde-primary hover:underline"
                    >
                      <Plus className="size-3.5" /> Adicionar pergunta
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Recomendações ── */}
      <div className="pt-2">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-gray-900">Recomendações</h2>
          <p className="text-sm text-gray-600">
            Campos de texto rico preenchidos por setor na análise ergonômica.
          </p>
        </div>
        <div className="space-y-2">
          {RECOMENDACOES_CAMPOS.map((label) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3"
            >
              <span className="flex-1 text-sm font-medium text-gray-600">{label}</span>
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-400">
                Rich text — livre por setor
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── CategoriaCard ────────────────────────────────────────────────────────────

function CategoriaCard({
  categoria,
  disabled,
}: {
  categoria: AetOwasCategoria;
  disabled: boolean;
}) {
  const salvar = useAetSalvarOwasCategoria();
  const fileRef = useRef<HTMLInputElement>(null);

  const [titulo, setTitulo] = useState(categoria.titulo);
  const [opcoes, setOpcoes] = useState<AetOwasOpcao[]>(categoria.opcoes);
  const [enviandoImg, setEnviandoImg] = useState(false);

  const defaultImage = SLUG_TO_DEFAULT_IMAGE[categoria.slug];
  const imageSrc = categoria.imagem_url ?? defaultImage;

  async function uploadImage(file: File) {
    setEnviandoImg(true);
    const toastId = toast.loading("Enviando imagem...");
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop() ?? "png";
      const path = `aet-owas-config/${categoria.slug}-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("fotos")
        .upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type || undefined });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("fotos").getPublicUrl(path);
      if (!pub?.publicUrl) throw new Error("URL pública não retornada");
      salvar.mutate(
        { id: categoria.id, imagem_url: pub.publicUrl },
        { onSuccess: () => toast.success("Imagem atualizada", { id: toastId }) }
      );
    } catch (err) {
      toast.error(mensagemErro(err, "Falha no upload"), { id: toastId });
    } finally {
      setEnviandoImg(false);
    }
  }

  function addOpcao() {
    const nextVal = opcoes.length > 0 ? Math.max(...opcoes.map((o) => o.value)) + 1 : 1;
    setOpcoes([...opcoes, { value: nextVal, label: "" }]);
  }

  function updateOpcao(idx: number, patch: Partial<AetOwasOpcao>) {
    setOpcoes((prev) => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  }

  function removeOpcao(idx: number) {
    setOpcoes((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSave() {
    salvar.mutate(
      { id: categoria.id, titulo: titulo.trim() || categoria.titulo, opcoes },
      { onSuccess: () => toast.success("Categoria salva") }
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* Título + salvar */}
      <div className="mb-4 flex items-center gap-3">
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          disabled={disabled}
          placeholder="Título da categoria"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30 disabled:bg-gray-50 disabled:text-gray-500"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || salvar.isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-2 text-xs font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
        >
          {salvar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Salvar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Opções */}
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">Opções</p>
          <div className="space-y-1.5">
            {opcoes.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="number"
                  value={opt.value}
                  onChange={(e) => updateOpcao(idx, { value: Number(e.target.value) })}
                  disabled={disabled}
                  className="w-14 rounded border border-gray-300 px-2 py-1 text-center text-xs disabled:bg-gray-50"
                />
                <input
                  type="text"
                  value={opt.label}
                  onChange={(e) => updateOpcao(idx, { label: e.target.value })}
                  disabled={disabled}
                  placeholder="Rótulo da opção"
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs disabled:bg-gray-50"
                />
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeOpcao(idx)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
            {!disabled && (
              <button
                type="button"
                onClick={addOpcao}
                className="mt-1 inline-flex items-center gap-1 text-xs text-verde-primary hover:underline"
              >
                <Plus className="size-3.5" /> Adicionar opção
              </button>
            )}
          </div>
        </div>

        {/* Imagem */}
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Imagem de Referência
          </p>
          <div className="space-y-2">
            <StorageImg
              stored={imageSrc}
              alt={`Referência OWAS: ${categoria.titulo}`}
              className="h-auto w-full max-w-[260px] rounded border border-gray-200"
            />
            {!disabled && (
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadImage(f);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={enviandoImg}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {enviandoImg ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
                  {categoria.imagem_url ? "Trocar imagem" : "Enviar imagem"}
                </button>
                {categoria.imagem_url && (
                  <button
                    type="button"
                    onClick={() =>
                      salvar.mutate(
                        { id: categoria.id, imagem_url: null },
                        { onSuccess: () => toast.success("Imagem padrão restaurada") }
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="size-3.5" /> Restaurar padrão
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SelectCampoCard ──────────────────────────────────────────────────────────

function SelectCampoCard({ campo }: { campo: AetOwasSelectCampo }) {
  const salvar = useAetSalvarOwasSelect();
  const [label, setLabel] = useState(campo.label);
  const [opcoes, setOpcoes] = useState<string[]>(campo.opcoes);

  function addOpcao() {
    setOpcoes((prev) => [...prev, ""]);
  }

  function updateOpcao(idx: number, value: string) {
    setOpcoes((prev) => prev.map((o, i) => (i === idx ? value : o)));
  }

  function removeOpcao(idx: number) {
    setOpcoes((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSave() {
    salvar.mutate(
      { slug: campo.slug, label: label.trim() || campo.label, opcoes: opcoes.filter(Boolean) },
      { onSuccess: () => toast.success("Campo salvo") }
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Rótulo do campo"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={salvar.isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-2 text-xs font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
        >
          {salvar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Salvar
        </button>
      </div>

      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">Opções</p>
      <div className="space-y-1.5">
        {opcoes.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              value={opt}
              onChange={(e) => updateOpcao(idx, e.target.value)}
              placeholder="Opção"
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={() => removeOpcao(idx)}
              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addOpcao}
          className="mt-1 inline-flex items-center gap-1 text-xs text-verde-primary hover:underline"
        >
          <Plus className="size-3.5" /> Adicionar opção
        </button>
      </div>
    </div>
  );
}

// ─── PerguntaCard ─────────────────────────────────────────────────────────────

function PerguntaCard({
  pergunta,
  onDelete,
}: {
  pergunta: AetChecklistPergunta;
  onDelete?: () => void;
}) {
  const salvar = useAetSalvarChecklistPergunta();
  const [label, setLabel] = useState(pergunta.label);
  const isTexto = pergunta.tipo === "texto";

  function handleSave() {
    salvar.mutate(
      { slug: pergunta.slug, secao: pergunta.secao, tipo: pergunta.tipo, label: label.trim() || pergunta.label },
      { onSuccess: () => toast.success(isTexto ? "Texto salvo" : "Pergunta salva") }
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        {isTexto ? (
          <textarea
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            rows={3}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30 resize-none"
          />
        ) : (
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          />
        )}
        <div className="flex shrink-0 items-center gap-2 pt-1">
          {!isTexto && <span className="text-[11px] text-gray-400">Sim / Não / N.A.</span>}
          <button
            type="button"
            onClick={handleSave}
            disabled={salvar.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-2 text-xs font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
          >
            {salvar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Salvar
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md border border-gray-200 p-2 text-gray-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500"
              title="Excluir pergunta"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── NovaPerguntaInline ───────────────────────────────────────────────────────

function NovaPerguntaInline({ secao, onCancel }: { secao: string; onCancel: () => void }) {
  const salvar = useAetSalvarChecklistPergunta();
  const [label, setLabel] = useState("");

  function handleSave() {
    if (!label.trim()) return;
    const slug = `${secao.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}`;
    salvar.mutate(
      { slug, label: label.trim(), secao, tipo: "tristate" },
      {
        onSuccess: () => {
          toast.success("Pergunta adicionada");
          onCancel();
        },
      }
    );
  }

  return (
    <div className="rounded-xl border border-verde-primary/30 bg-verde-primary/5 px-4 py-3">
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}
        placeholder="Texto da nova pergunta..."
        autoFocus
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!label.trim() || salvar.isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
        >
          {salvar.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
          Salvar
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

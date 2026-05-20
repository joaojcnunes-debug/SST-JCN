"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  SLUG_TO_DEFAULT_IMAGE,
  OWAS_SELECTS_PADRAO,
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
} from "@/lib/hooks/useAet";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AetChecklistPergunta, AetOwasCategoria, AetOwasOpcao, AetOwasSelectCampo } from "@/lib/supabase/types";

export default function OwasConfigPage() {
  const { data: categorias = [], isLoading } = useAetOwasConfig();
  const inicializar = useAetInicializarOwasConfig();
  const { data: selectCampos = [] } = useAetOwasSelects();
  const inicializarSelects = useAetInicializarOwasSelects();
  const { data: checklistPerguntas = [] } = useAetChecklistPerguntas();
  const inicializarPerguntas = useAetInicializarChecklistPerguntas();

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

      {/* ── Campos de Seleção ── */}
      <div className="pt-2">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Campos de Seleção — Checklist</h2>
            <p className="text-sm text-gray-600">
              Configure as opções dos campos de seleção na seção de Postura / Organização do Trabalho.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              inicializarSelects.mutate(undefined, {
                onSuccess: () => toast.success("Padrões restaurados"),
              })
            }
            disabled={inicializarSelects.isPending}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {inicializarSelects.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Restaurar padrões
          </button>
        </div>
        <div className="space-y-3">
          {selectCampos.map((campo) => (
            <SelectCampoCard key={campo.slug} campo={campo} />
          ))}
        </div>
      </div>

      {/* ── Perguntas Sim / Não / N.A. ── */}
      <div className="pt-2">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Perguntas — Sim / Não / N.A.</h2>
            <p className="text-sm text-gray-600">
              Edite o texto das perguntas respondidas com Sim, Não ou Não se Aplica no checklist.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              inicializarPerguntas.mutate(undefined, {
                onSuccess: () => toast.success("Padrões restaurados"),
              })
            }
            disabled={inicializarPerguntas.isPending}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {inicializarPerguntas.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Restaurar padrões
          </button>
        </div>
        <div className="space-y-6">
          {(["Postura", "Organização do Trabalho", "Exigência de Tempo", "Ritmo de Trabalho", "Adoção de Rodízios - Ergonômico"] as const).map((secao) => {
            const fonte = checklistPerguntas.length > 0 ? checklistPerguntas : CHECKLIST_PERGUNTAS_PADRAO;
            const perguntas = fonte.filter((p) => p.secao === secao);
            if (perguntas.length === 0) return null;
            return (
              <div key={secao}>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">{secao}</p>
                <div className="space-y-2">
                  {perguntas.map((pergunta) => (
                    <PerguntaCard key={pergunta.slug} pergunta={pergunta} />
                  ))}
                </div>
              </div>
            );
          })}
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
      toast.error(err instanceof Error ? err.message : "Falha no upload", { id: toastId });
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc}
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

function PerguntaCard({ pergunta }: { pergunta: AetChecklistPergunta }) {
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
        </div>
      </div>
    </div>
  );
}

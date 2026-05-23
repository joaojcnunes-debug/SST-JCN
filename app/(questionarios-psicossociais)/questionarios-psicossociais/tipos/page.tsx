"use client";

import { useState } from "react";
import {
  Settings2,
  Plus,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  useQpsTipos,
  useCreateQpsTipo,
  useUpdateQpsTipo,
  useQpsCategorias,
  useCreateQpsCategoria,
  useUpdateQpsCategoria,
  useDeleteQpsCategoria,
  useQpsPerguntas,
  useCreateQpsPergunta,
  useUpdateQpsPergunta,
  useDeleteQpsPergunta,
} from "@/lib/hooks/useQuestionarios";
import type { QpsTipo, QpsCategoria, QpsPergunta } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export default function TiposPage() {
  const { data: tipos = [], isLoading } = useQpsTipos();
  const [expandido, setExpandido] = useState<string | null>(null);
  const [showNovoTipo, setShowNovoTipo] = useState(false);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Settings2 className="size-5 text-indigo-600" />
            Tipos e Perguntas
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Gerencie os tipos de questionário, suas categorias e perguntas
          </p>
        </div>
        <button
          onClick={() => setShowNovoTipo(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <Plus className="size-4" /> Novo Tipo
        </button>
      </div>

      {showNovoTipo && (
        <NovoTipoForm onClose={() => setShowNovoTipo(false)} />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin" /> Carregando tipos...
        </div>
      ) : tipos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-16 text-center text-sm text-gray-400">
          Nenhum tipo cadastrado. Crie o primeiro tipo de questionário.
        </div>
      ) : (
        <div className="space-y-3">
          {tipos.map((tipo) => (
            <TipoCard
              key={tipo.id_tipo}
              tipo={tipo}
              aberto={expandido === tipo.id_tipo}
              onToggle={() =>
                setExpandido((prev) =>
                  prev === tipo.id_tipo ? null : tipo.id_tipo
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Formulário novo tipo ─────────────────────────────────────────────────────

function NovoTipoForm({ onClose }: { onClose: () => void }) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [instrucoes, setInstrucoes] = useState("");
  const [escalaMin, setEscalaMin] = useState("1");
  const [escalaMax, setEscalaMax] = useState("5");
  const criar = useCreateQpsTipo();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    const min = parseInt(escalaMin);
    const max = parseInt(escalaMax);
    if (isNaN(min) || isNaN(max) || min >= max) {
      toast.error("Escala inválida: mínimo deve ser menor que máximo");
      return;
    }
    try {
      await criar.mutateAsync({
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        instrucoes: instrucoes.trim() || null,
        escala_min: min,
        escala_max: max,
        ativo: true,
      });
      toast.success("Tipo criado");
      onClose();
    } catch {
      toast.error("Erro ao criar tipo");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm"
    >
      <h2 className="mb-4 text-sm font-bold text-indigo-800">Novo Tipo de Questionário</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-700">Nome *</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            placeholder="Ex: DRPS – Demanda, Controle e Apoio Social"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-700">Descrição</label>
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Breve descrição"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-700">Instruções</label>
          <textarea
            value={instrucoes}
            onChange={(e) => setInstrucoes(e.target.value)}
            rows={2}
            placeholder="Instruções exibidas ao respondente"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Escala Mínima *</label>
          <input
            type="number"
            value={escalaMin}
            onChange={(e) => setEscalaMin(e.target.value)}
            min="0"
            max="10"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Escala Máxima *</label>
          <input
            type="number"
            value={escalaMax}
            onChange={(e) => setEscalaMax(e.target.value)}
            min="1"
            max="10"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={criar.isPending}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {criar.isPending && <Loader2 className="size-3.5 animate-spin" />}
          Salvar Tipo
        </button>
      </div>
    </form>
  );
}

// ─── Card de tipo (accordion) ─────────────────────────────────────────────────

function TipoCard({
  tipo,
  aberto,
  onToggle,
}: {
  tipo: QpsTipo;
  aberto: boolean;
  onToggle: () => void;
}) {
  const atualizar = useUpdateQpsTipo();
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(tipo.nome);
  const [showNovaCategoria, setShowNovaCategoria] = useState(false);

  const { data: categorias = [], isLoading: loadingCats } = useQpsCategorias(
    aberto ? tipo.id_tipo : null
  );

  async function toggleAtivo() {
    try {
      await atualizar.mutateAsync({ id: tipo.id_tipo, input: { ativo: !tipo.ativo } });
      toast.success(tipo.ativo ? "Tipo desativado" : "Tipo ativado");
    } catch {
      toast.error("Erro ao atualizar");
    }
  }

  async function salvarNome() {
    if (!nome.trim()) return;
    try {
      await atualizar.mutateAsync({ id: tipo.id_tipo, input: { nome: nome.trim() } });
      toast.success("Nome atualizado");
      setEditando(false);
    } catch {
      toast.error("Erro ao salvar");
    }
  }

  return (
    <div className={cn("rounded-xl border bg-white shadow-sm", aberto && "border-indigo-200")}>
      <div
        className="flex cursor-pointer items-center gap-3 p-4"
        onClick={onToggle}
      >
        {aberto ? (
          <ChevronDown className="size-4 text-indigo-500 shrink-0" />
        ) : (
          <ChevronRight className="size-4 text-gray-400 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          {editando ? (
            <div
              className="flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoFocus
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button onClick={salvarNome} className="text-green-600 hover:text-green-700">
                <Check className="size-4" />
              </button>
              <button
                onClick={() => { setNome(tipo.nome); setEditando(false); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <p className="truncate font-semibold text-gray-900">{tipo.nome}</p>
          )}
          {tipo.descricao && (
            <p className="truncate text-xs text-gray-500">{tipo.descricao}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold",
              tipo.ativo
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            )}
          >
            {tipo.ativo ? "Ativo" : "Inativo"}
          </span>
          <span className="text-xs text-gray-400">
            Escala {tipo.escala_min}–{tipo.escala_max}
          </span>
          <button
            onClick={() => setEditando(true)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Renomear"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={toggleAtivo}
            className="rounded px-2 py-0.5 text-xs font-medium text-gray-500 hover:bg-gray-100"
            title={tipo.ativo ? "Desativar" : "Ativar"}
          >
            {tipo.ativo ? "Desativar" : "Ativar"}
          </button>
        </div>
      </div>

      {aberto && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
          {/* Instruções */}
          {tipo.instrucoes && (
            <div className="mb-3 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
              <span className="font-semibold">Instruções: </span>{tipo.instrucoes}
            </div>
          )}

          {/* Categorias */}
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Categorias / Dimensões
            </p>
            <button
              onClick={() => setShowNovaCategoria(true)}
              className="flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100"
            >
              <Plus className="size-3" /> Categoria
            </button>
          </div>

          {showNovaCategoria && (
            <NovaCategoriaForm
              idTipo={tipo.id_tipo}
              proximaOrdem={categorias.length + 1}
              onClose={() => setShowNovaCategoria(false)}
            />
          )}

          {loadingCats ? (
            <div className="flex items-center gap-2 py-4 text-xs text-gray-400">
              <Loader2 className="size-3 animate-spin" /> Carregando...
            </div>
          ) : categorias.length === 0 ? (
            <p className="py-4 text-center text-xs text-gray-400">
              Nenhuma categoria. Adicione categorias para organizar as perguntas.
            </p>
          ) : (
            <div className="space-y-2">
              {categorias.map((cat) => (
                <CategoriaItem key={cat.id_categoria} cat={cat} idTipo={tipo.id_tipo} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Formulário nova categoria ────────────────────────────────────────────────

function NovaCategoriaForm({
  idTipo,
  proximaOrdem,
  onClose,
}: {
  idTipo: string;
  proximaOrdem: number;
  onClose: () => void;
}) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const criar = useCreateQpsCategoria();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    try {
      await criar.mutateAsync({
        id_tipo: idTipo,
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        ordem: proximaOrdem,
      });
      toast.success("Categoria criada");
      onClose();
    } catch {
      toast.error("Erro ao criar categoria");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-3 flex gap-2 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        autoFocus
        placeholder="Nome da categoria"
        className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
      <input
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder="Descrição (opcional)"
        className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
      <button
        type="submit"
        disabled={criar.isPending}
        className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {criar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
      </button>
      <button type="button" onClick={onClose} className="rounded px-2 py-1 text-gray-400 hover:text-gray-600">
        <X className="size-3.5" />
      </button>
    </form>
  );
}

// ─── Item de categoria com perguntas ─────────────────────────────────────────

function CategoriaItem({ cat, idTipo }: { cat: QpsCategoria; idTipo: string }) {
  const [aberta, setAberta] = useState(false);
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(cat.nome);
  const [showNovaPergunta, setShowNovaPergunta] = useState(false);

  const { data: perguntas = [], isLoading: loadingPergs } = useQpsPerguntas(
    aberta ? cat.id_categoria : null
  );
  const atualizar = useUpdateQpsCategoria();
  const deletar = useDeleteQpsCategoria();

  async function salvarNome() {
    if (!nome.trim()) return;
    try {
      await atualizar.mutateAsync({ id: cat.id_categoria, idTipo, input: { nome: nome.trim() } });
      toast.success("Categoria atualizada");
      setEditando(false);
    } catch {
      toast.error("Erro ao salvar");
    }
  }

  async function handleDeletar() {
    if (!confirm(`Remover categoria "${cat.nome}" e todas as suas perguntas?`)) return;
    try {
      await deletar.mutateAsync({ id: cat.id_categoria, idTipo });
      toast.success("Categoria removida");
    } catch {
      toast.error("Erro ao remover");
    }
  }

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50">
      <div
        className="flex cursor-pointer items-center gap-2 px-3 py-2.5"
        onClick={() => setAberta((v) => !v)}
      >
        {aberta ? (
          <ChevronDown className="size-3.5 text-indigo-400 shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 text-gray-400 shrink-0" />
        )}

        {editando ? (
          <div
            className="flex flex-1 items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoFocus
              className="flex-1 rounded border border-gray-300 px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button onClick={salvarNome} className="text-green-600"><Check className="size-3.5" /></button>
            <button onClick={() => { setNome(cat.nome); setEditando(false); }} className="text-gray-400"><X className="size-3.5" /></button>
          </div>
        ) : (
          <p className="flex-1 truncate text-sm font-medium text-gray-800">
            {cat.nome}
            {cat.descricao && (
              <span className="ml-2 text-xs text-gray-400">{cat.descricao}</span>
            )}
          </p>
        )}

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setEditando(true)} className="rounded p-1 text-gray-400 hover:bg-gray-200">
            <Pencil className="size-3" />
          </button>
          <button onClick={handleDeletar} className="rounded p-1 text-red-400 hover:bg-red-50">
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>

      {aberta && (
        <div className="border-t border-gray-100 px-3 pb-3 pt-2">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Perguntas
            </p>
            <button
              onClick={() => setShowNovaPergunta(true)}
              className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:underline"
            >
              <Plus className="size-3" /> Adicionar
            </button>
          </div>

          {showNovaPergunta && (
            <NovaPerguntaForm
              idCategoria={cat.id_categoria}
              proximaOrdem={perguntas.length + 1}
              onClose={() => setShowNovaPergunta(false)}
            />
          )}

          {loadingPergs ? (
            <div className="flex items-center gap-1.5 py-2 text-xs text-gray-400">
              <Loader2 className="size-3 animate-spin" /> Carregando...
            </div>
          ) : perguntas.length === 0 ? (
            <p className="py-2 text-xs text-gray-400 italic">
              Nenhuma pergunta. Adicione perguntas a esta categoria.
            </p>
          ) : (
            <div className="space-y-1">
              {perguntas.map((p, idx) => (
                <PerguntaItem
                  key={p.id_pergunta}
                  pergunta={p}
                  idx={idx + 1}
                  idCategoria={cat.id_categoria}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Formulário nova pergunta ─────────────────────────────────────────────────

function NovaPerguntaForm({
  idCategoria,
  proximaOrdem,
  onClose,
}: {
  idCategoria: string;
  proximaOrdem: number;
  onClose: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [logica, setLogica] = useState<"direta" | "invertida">("direta");
  const criar = useCreateQpsPergunta();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    try {
      await criar.mutateAsync({
        id_categoria: idCategoria,
        texto: texto.trim(),
        logica,
        ordem: proximaOrdem,
        ativo: true,
      });
      toast.success("Pergunta adicionada");
      onClose();
    } catch {
      toast.error("Erro ao adicionar pergunta");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-2 space-y-2 rounded-lg border border-indigo-100 bg-white p-3">
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        autoFocus
        rows={2}
        placeholder="Texto da pergunta"
        className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-gray-600">Lógica:</label>
        <label className="flex items-center gap-1 text-xs">
          <input type="radio" value="direta" checked={logica === "direta"} onChange={() => setLogica("direta")} />
          Direta (maior = pior)
        </label>
        <label className="flex items-center gap-1 text-xs">
          <input type="radio" value="invertida" checked={logica === "invertida"} onChange={() => setLogica("invertida")} />
          Invertida (maior = melhor)
        </label>
        <div className="ml-auto flex gap-2">
          <button
            type="submit"
            disabled={criar.isPending}
            className="rounded bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {criar.isPending ? <Loader2 className="size-3 animate-spin" /> : "Salvar"}
          </button>
          <button type="button" onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
        </div>
      </div>
    </form>
  );
}

// ─── Item de pergunta ─────────────────────────────────────────────────────────

function PerguntaItem({
  pergunta,
  idx,
  idCategoria,
}: {
  pergunta: QpsPergunta;
  idx: number;
  idCategoria: string;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(pergunta.texto);
  const atualizar = useUpdateQpsPergunta();
  const deletar = useDeleteQpsPergunta();

  async function salvar() {
    if (!texto.trim()) return;
    try {
      await atualizar.mutateAsync({
        id: pergunta.id_pergunta,
        idCategoria,
        input: { texto: texto.trim() },
      });
      toast.success("Pergunta atualizada");
      setEditando(false);
    } catch {
      toast.error("Erro ao salvar");
    }
  }

  async function handleDeletar() {
    if (!confirm("Remover esta pergunta?")) return;
    try {
      await deletar.mutateAsync({ id: pergunta.id_pergunta, idCategoria });
      toast.success("Pergunta removida");
    } catch {
      toast.error("Erro ao remover");
    }
  }

  return (
    <div className="flex items-start gap-2 rounded px-2 py-1.5 hover:bg-gray-50">
      <span className="mt-0.5 shrink-0 text-[11px] font-bold text-gray-400 w-4">{idx}.</span>
      {editando ? (
        <div className="flex flex-1 flex-col gap-1.5">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoFocus
            rows={2}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <div className="flex gap-2">
            <button onClick={salvar} className="text-xs font-medium text-green-600 hover:underline">Salvar</button>
            <button onClick={() => { setTexto(pergunta.texto); setEditando(false); }} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
          </div>
        </div>
      ) : (
        <p className="flex-1 text-xs text-gray-700 leading-relaxed">{pergunta.texto}</p>
      )}
      <span
        className={cn(
          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold",
          pergunta.logica === "direta"
            ? "bg-orange-100 text-orange-600"
            : "bg-green-100 text-green-600"
        )}
      >
        {pergunta.logica === "direta" ? "Dir" : "Inv"}
      </span>
      {!editando && (
        <div className="flex shrink-0 items-center gap-0.5">
          <button onClick={() => setEditando(true)} className="rounded p-0.5 text-gray-300 hover:bg-gray-200 hover:text-gray-600">
            <Pencil className="size-3" />
          </button>
          <button onClick={handleDeletar} className="rounded p-0.5 text-gray-300 hover:bg-red-50 hover:text-red-500">
            <Trash2 className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}

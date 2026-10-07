"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  ChevronDown,
  Crown,
  EyeOff,
  Lightbulb,
  Network,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserMinus,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import {
  gravarGrupoEmLote,
  mensagemErroGrupo,
  useCriarGrupo,
  useDefinirMatriz,
  useEditarGrupo,
  useExcluirGrupo,
  useGravarGrupoDaEmpresa,
  useGruposEmpresas,
  CHAVE_GRUPOS,
} from "@/lib/hooks/useGruposEmpresas";
import {
  ordenarMembros,
  papelPeloCnpj,
  ROTULO_PAPEL,
  sugestoesPorRaiz,
  type SugestaoRaiz,
} from "@/lib/empresas/grupos";
import { buscar } from "@/lib/busca/texto";
import { perfilEscreveNaRls } from "@/lib/hooks/useUsuario";
import { useUserStore } from "@/lib/store";
import { cn, formatCNPJ } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import type { Empresa, EmpresaGrupo, MembroGrupo, PapelGrupo } from "@/lib/supabase/types";

/**
 * Grupos de empresas (v278). Um grupo junta os CNPJs de uma mesma empresa: a
 * MATRIZ (principal) e as FILIAIS. Pode juntar empresas de unidades diferentes:
 * as de outra unidade aparecem com nome, CNPJ e unidade, mas sem link para os
 * documentos — quem cuida delas é a outra unidade.
 */
function GruposInner() {
  const searchParams = useSearchParams();
  const user = useUserStore((s) => s.user);
  const podeEditar = perfilEscreveNaRls(user?.perfil) && user?.ativo_sistema !== false;
  const { grupos, membrosPorGrupo, porEmpresa, isLoading, error } = useGruposEmpresas();
  const { data: empresas = [] } = useEmpresas();

  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(searchParams.get("grupo"));
  const [formGrupo, setFormGrupo] = useState<{ grupo: EmpresaGrupo | null } | null>(null);
  const [excluir, setExcluir] = useState<EmpresaGrupo | null>(null);
  const [verSugestoes, setVerSugestoes] = useState(false);
  const excluirGrupo = useExcluirGrupo();

  /** Abre o grupo recém-criado e rola até ele (o cartão aparece depois do refetch). */
  function mostrarGrupo(id: string) {
    setAberto(id);
    setVerSugestoes(false);
    setBusca("");
    let tentativas = 0;
    const rolar = () => {
      const el = document.getElementById(`grupo-${id}`);
      if (el) el.scrollIntoView({ block: "start", behavior: "smooth" });
      else if (tentativas++ < 20) setTimeout(rolar, 150);
    };
    setTimeout(rolar, 150);
  }

  // Deep-link: rola até o grupo pedido.
  useEffect(() => {
    const id = searchParams.get("grupo");
    if (!id || isLoading) return;
    setAberto(id);
    requestAnimationFrame(() => document.getElementById(`grupo-${id}`)?.scrollIntoView({ block: "start" }));
  }, [searchParams, isLoading]);

  // Busca pelo nome/descrição do grupo OU pelo nome/CNPJ de qualquer empresa dele.
  const filtrados = useMemo(() => {
    if (!busca.trim()) return grupos;
    return buscar(
      grupos,
      busca,
      (g) => [g.nome, g.descricao, ...(membrosPorGrupo.get(g.id_grupo) ?? []).flatMap((m) => [m.nome_empresa, m.nome_fantasia])],
      { codigos: (g) => (membrosPorGrupo.get(g.id_grupo) ?? []).map((m) => m.cnpj), manterOrdem: true },
    ).itens;
  }, [grupos, busca, membrosPorGrupo]);

  const sugestoes = useMemo(
    () => sugestoesPorRaiz(empresas.filter((e) => !porEmpresa.has(e.id_empresa))),
    [empresas, porEmpresa],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Network className="size-5 text-verde-primary" /> Grupos de empresas
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Empresas com mais de um CNPJ ficam juntas num grupo: a <strong>matriz</strong> é a principal e as demais são{" "}
          <strong>filiais</strong>.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar grupo, empresa ou CNPJ..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm transition focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20"
          />
        </div>
        {podeEditar && (
          <button
            type="button"
            onClick={() => setFormGrupo({ grupo: null })}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-verde-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-verde-accent active:scale-95"
          >
            <Plus className="size-4" /> Novo grupo
          </button>
        )}
      </div>

      {podeEditar && sugestoes.length > 0 && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 text-sm text-indigo-900">
          <button
            type="button"
            onClick={() => setVerSugestoes((v) => !v)}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
          >
            <Lightbulb className="size-4 shrink-0" />
            <span className="flex-1">
              <strong>{sugestoes.length}</strong>{" "}
              {sugestoes.length === 1 ? "conjunto de empresas divide" : "conjuntos de empresas dividem"} a mesma raiz de
              CNPJ e ainda não {sugestoes.length === 1 ? "está" : "estão"} em grupo.
            </span>
            <ChevronDown className={cn("size-4 transition-transform", verSugestoes && "rotate-180")} />
          </button>
          {verSugestoes && (
            <ul className="divide-y divide-indigo-100 border-t border-indigo-200 bg-white/60">
              {sugestoes.slice(0, 30).map((s) => (
                <SugestaoRaiz key={s.raiz} sugestao={s} onCriado={mostrarGrupo} />
              ))}
            </ul>
          )}
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-16 rounded-2xl" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Erro ao carregar os grupos: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && filtrados.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-14 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-verde-light">
            <Network className="size-7 text-verde-primary" />
          </div>
          <p className="mt-4 text-sm font-semibold text-gray-800">
            {busca ? "Nenhum grupo encontrado" : "Nenhum grupo cadastrado"}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {busca
              ? `Nenhum resultado para "${busca}"`
              : "Crie um grupo aqui ou no cadastro da empresa (campo Grupo de empresas)."}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {filtrados.map((g) => (
          <CartaoGrupo
            key={g.id_grupo}
            grupo={g}
            membros={membrosPorGrupo.get(g.id_grupo) ?? []}
            aberto={aberto === g.id_grupo}
            onAlternar={() => setAberto((a) => (a === g.id_grupo ? null : g.id_grupo))}
            podeEditar={podeEditar}
            onEditar={() => setFormGrupo({ grupo: g })}
            onExcluir={() => setExcluir(g)}
          />
        ))}
      </div>

      {formGrupo && (
        <FormGrupo
          grupo={formGrupo.grupo}
          onClose={() => setFormGrupo(null)}
          onCriado={mostrarGrupo}
        />
      )}

      <ConfirmDialog
        open={!!excluir}
        title="Excluir grupo?"
        description={
          excluir
            ? `O grupo "${excluir.nome}" deixa de existir e suas ${
                (membrosPorGrupo.get(excluir.id_grupo) ?? []).length
              } empresa(s) ficam sem grupo. Nenhuma empresa, inspeção ou documento é apagado.`
            : undefined
        }
        confirmLabel="Excluir grupo"
        variant="danger"
        loading={excluirGrupo.isPending}
        onConfirm={() =>
          excluir &&
          excluirGrupo.mutate(excluir.id_grupo, {
            onSuccess: () => {
              toast.success("Grupo excluído");
              setExcluir(null);
            },
          })
        }
        onCancel={() => setExcluir(null)}
      />
    </div>
  );
}

function CartaoGrupo({
  grupo,
  membros,
  aberto,
  onAlternar,
  podeEditar,
  onEditar,
  onExcluir,
}: {
  grupo: EmpresaGrupo;
  membros: MembroGrupo[];
  aberto: boolean;
  onAlternar: () => void;
  podeEditar: boolean;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  const ordenados = ordenarMembros(membros);
  const matriz = ordenados.find((m) => m.papel_grupo === "MATRIZ");
  const deOutraUnidade = membros.filter((m) => !m.visivel).length;

  return (
    <div id={`grupo-${grupo.id_grupo}`} className="scroll-mt-20 rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-start gap-3 p-4">
        <button type="button" onClick={onAlternar} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
            <Network className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold text-gray-900">{grupo.nome}</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {membros.length} {membros.length === 1 ? "empresa" : "empresas"}
              {" · "}
              {matriz ? (
                <>
                  Matriz: <span className="font-medium text-gray-700">{matriz.nome_empresa}</span>
                </>
              ) : (
                <span className="text-amber-700">sem matriz definida</span>
              )}
              {deOutraUnidade > 0 && ` · ${deOutraUnidade} de outra unidade`}
            </p>
            {grupo.descricao && <p className="mt-1 text-xs text-gray-600">{grupo.descricao}</p>}
          </div>
          <ChevronDown className={cn("mt-1 size-4 shrink-0 text-gray-400 transition-transform", aberto && "rotate-180")} />
        </button>
        {podeEditar && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onEditar}
              title="Editar nome e descrição"
              className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              onClick={onExcluir}
              title="Excluir grupo"
              className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        )}
      </div>

      {aberto && (
        <div className="border-t border-gray-100 px-4 pb-4">
          {ordenados.length === 0 ? (
            <p className="py-4 text-sm text-gray-500">Nenhuma empresa neste grupo ainda.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {ordenados.map((m) => (
                <LinhaMembro key={m.id_empresa} membro={m} podeEditar={podeEditar} />
              ))}
            </ul>
          )}
          {podeEditar && <AdicionarEmpresa grupo={grupo} membros={membros} />}
        </div>
      )}
    </div>
  );
}

function LinhaMembro({ membro: m, podeEditar }: { membro: MembroGrupo; podeEditar: boolean }) {
  const definirMatriz = useDefinirMatriz();
  const gravar = useGravarGrupoDaEmpresa();
  const matriz = m.papel_grupo === "MATRIZ";
  const editavel = podeEditar && m.visivel;

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <span
          className={cn(
            "mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
            matriz ? "bg-indigo-600 text-white" : "border border-indigo-200 bg-indigo-50 text-indigo-700",
          )}
        >
          {matriz && <Crown className="size-2.5" />}
          {ROTULO_PAPEL[m.papel_grupo]}
        </span>
        <div className="min-w-0">
          {m.visivel ? (
            <Link href={`/empresas/${m.id_empresa}`} className="block truncate text-sm font-medium text-gray-900 hover:text-verde-primary hover:underline">
              {m.nome_empresa}
            </Link>
          ) : (
            <span className="block truncate text-sm font-medium text-gray-700">{m.nome_empresa}</span>
          )}
          <p className="text-xs text-gray-500">
            <span className="font-mono">{formatCNPJ(m.cnpj) || "sem CNPJ"}</span>
            {m.unidade_nome && ` · ${m.unidade_nome}`}
            {m.status === "Inativa" && " · Inativa"}
          </p>
          {!m.visivel && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">
              <EyeOff className="size-3" /> Empresa de outra unidade ({m.unidade_nome ?? "sem unidade"}) — sem acesso aos
              documentos dela.
            </p>
          )}
        </div>
      </div>
      {editavel && (
        <div className="flex shrink-0 gap-2 pl-14 sm:pl-0">
          {!matriz && (
            <button
              type="button"
              disabled={definirMatriz.isPending}
              onClick={() =>
                definirMatriz.mutate(
                  { id_grupo: m.id_grupo, id_empresa: m.id_empresa },
                  { onSuccess: () => toast.success(`${m.nome_empresa} agora é a matriz`) },
                )
              }
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
            >
              <Crown className="size-3.5" /> Tornar matriz
            </button>
          )}
          <button
            type="button"
            disabled={gravar.isPending}
            onClick={() =>
              gravar.mutate(
                { id_empresa: m.id_empresa, id_grupo: null, papel: null },
                { onSuccess: () => toast.success("Empresa removida do grupo") },
              )
            }
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
          >
            <UserMinus className="size-3.5" /> Remover do grupo
          </button>
        </div>
      )}
    </li>
  );
}

function AdicionarEmpresa({ grupo, membros }: { grupo: EmpresaGrupo; membros: MembroGrupo[] }) {
  const { porEmpresa } = useGruposEmpresas();
  const { data: empresas = [] } = useEmpresas();
  const gravar = useGravarGrupoDaEmpresa();
  const [idEmpresa, setIdEmpresa] = useState<string | null>(null);
  const matrizAtual = membros.find((m) => m.papel_grupo === "MATRIZ") ?? null;
  const escolhida = empresas.find((e) => e.id_empresa === idEmpresa) ?? null;
  const [papel, setPapel] = useState<PapelGrupo>("FILIAL");
  const jaEmOutro = idEmpresa ? porEmpresa.get(idEmpresa) : undefined;

  // Sugestão do papel: sem matriz no grupo → matriz; senão pelo CNPJ não troca a matriz sozinho.
  useEffect(() => {
    if (!escolhida) return;
    setPapel(!matrizAtual && papelPeloCnpj(escolhida.cnpj) !== "FILIAL" ? "MATRIZ" : "FILIAL");
  }, [escolhida, matrizAtual]);

  function adicionar() {
    if (!idEmpresa) return;
    gravar.mutate(
      { id_empresa: idEmpresa, id_grupo: grupo.id_grupo, papel, matrizAtual: matrizAtual?.id_empresa ?? null },
      {
        onSuccess: () => {
          toast.success("Empresa adicionada ao grupo");
          setIdEmpresa(null);
        },
      },
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-dashed border-gray-200 p-3">
      <p className="mb-2 text-xs font-semibold text-gray-600">Adicionar empresa ao grupo</p>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <EmpresaSelect value={idEmpresa} onChange={setIdEmpresa} allowAll className="flex-1" />
        <div className="flex shrink-0 gap-2">
          {(["MATRIZ", "FILIAL"] as const).map((p) => (
            <label
              key={p}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 text-sm",
                papel === p ? "border-verde-primary bg-verde-light" : "border-gray-200 bg-white",
              )}
            >
              <input type="radio" checked={papel === p} onChange={() => setPapel(p)} className="text-verde-primary" />
              {ROTULO_PAPEL[p]}
            </label>
          ))}
          <button
            type="button"
            onClick={adicionar}
            disabled={!idEmpresa || gravar.isPending || jaEmOutro?.id_grupo === grupo.id_grupo}
            className="rounded-lg bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
          >
            Adicionar
          </button>
        </div>
      </div>
      {jaEmOutro && jaEmOutro.id_grupo !== grupo.id_grupo && (
        <p className="mt-2 text-xs text-amber-800">
          Esta empresa está no grupo <strong>{jaEmOutro.nome}</strong>. Ao adicionar aqui, ela sai de lá.
        </p>
      )}
      {jaEmOutro?.id_grupo === grupo.id_grupo && (
        <p className="mt-2 text-xs text-gray-500">Esta empresa já está neste grupo.</p>
      )}
      {papel === "MATRIZ" && matrizAtual && idEmpresa && (
        <p className="mt-2 text-xs text-amber-800">
          Hoje a matriz é <strong>{matrizAtual.nome_empresa}</strong>; ela passa a ser filial.
        </p>
      )}
      <p className="mt-2 text-[11px] text-gray-400">
        Só aparecem as empresas das suas unidades. Empresa de outra unidade entra no grupo pelo cadastro, feito por quem
        tem acesso a ela.
      </p>
    </div>
  );
}

function SugestaoRaiz({
  sugestao,
  onCriado,
}: {
  sugestao: SugestaoRaiz<Empresa>;
  onCriado: (id: string) => void;
}) {
  const criar = useCriarGrupo();
  const qc = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  const base = sugestao.matriz ?? sugestao.empresas[0];
  const nomeSugerido = `Grupo ${(base.nome_fantasia || base.nome_empresa).trim()}`;
  // Um chip por CNPJ (ordem /0001, /0002…); o mesmo CNPJ cadastrado mais de uma vez vira "×N".
  const porCnpj = useMemo(() => {
    const m = new Map<string, { cnpj: string; nomes: string[]; matriz: boolean }>();
    for (const e of sugestao.empresas) {
      const d = (e.cnpj ?? "").replace(/\D/g, "");
      const c = m.get(d) ?? { cnpj: d, nomes: [], matriz: false };
      c.nomes.push(e.nome_empresa);
      if (sugestao.matriz?.id_empresa === e.id_empresa) c.matriz = true;
      m.set(d, c);
    }
    return [...m.values()].sort((a, b) => a.cnpj.localeCompare(b.cnpj));
  }, [sugestao]);

  async function criarGrupo() {
    setSalvando(true);
    try {
      const id = await criar.mutateAsync({ nome: nomeSugerido });
      await gravarGrupoEmLote({
        id_grupo: id,
        matriz: sugestao.matriz?.id_empresa ?? null,
        filiais: sugestao.empresas.map((e) => e.id_empresa).filter((x) => x !== sugestao.matriz?.id_empresa),
      });
      qc.invalidateQueries({ queryKey: CHAVE_GRUPOS });
      qc.invalidateQueries({ queryKey: ["empresas"] });
      toast.success(`${nomeSugerido} criado com ${sugestao.empresas.length} empresas`);
      onCriado(id);
    } catch (e) {
      toast.error(mensagemErroGrupo(e as Error));
      qc.invalidateQueries({ queryKey: CHAVE_GRUPOS });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1 text-xs text-gray-700">
        <p className="font-mono text-[11px] text-gray-500">Raiz {sugestao.raiz.replace(/^(\d{2})(\d{3})(\d{3})$/, "$1.$2.$3")}</p>
        <p className="font-semibold text-gray-900">{(base.nome_fantasia || base.nome_empresa).trim()}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {porCnpj.slice(0, 8).map((c) => (
            <span
              key={c.cnpj}
              title={c.nomes.join(" · ")}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px]",
                c.matriz ? "border-indigo-300 bg-indigo-100 text-indigo-900" : "border-gray-200 bg-white text-gray-600",
              )}
            >
              /{c.cnpj.slice(8, 12)}
              {c.matriz && <span className="font-sans font-semibold">matriz</span>}
              {c.nomes.length > 1 && <span className="font-sans text-gray-400">×{c.nomes.length}</span>}
            </span>
          ))}
          {porCnpj.length > 8 && <span className="px-1 text-[11px] text-gray-500">+{porCnpj.length - 8} CNPJs</span>}
        </div>
        <p className="mt-1 text-[11px] text-gray-500">
          {porCnpj.length} CNPJs · {sugestao.empresas.length} cadastros
          {sugestao.empresas.length > porCnpj.length && " (há CNPJ cadastrado mais de uma vez — ×N)"}
        </p>
      </div>
      <button
        type="button"
        onClick={criarGrupo}
        disabled={salvando}
        title={`Cria "${nomeSugerido}" com estas empresas`}
        className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {salvando ? "Criando…" : "Criar grupo com estas"}
      </button>
    </li>
  );
}

function FormGrupo({
  grupo,
  onClose,
  onCriado,
}: {
  grupo: EmpresaGrupo | null;
  onClose: () => void;
  onCriado: (id: string) => void;
}) {
  const criar = useCriarGrupo();
  const editar = useEditarGrupo();
  const [nome, setNome] = useState(grupo?.nome ?? "");
  const [descricao, setDescricao] = useState(grupo?.descricao ?? "");
  const salvando = criar.isPending || editar.isPending;

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Informe o nome do grupo");
      return;
    }
    if (grupo) {
      editar.mutate(
        { id_grupo: grupo.id_grupo, nome, descricao },
        {
          onSuccess: () => {
            toast.success("Grupo atualizado");
            onClose();
          },
        },
      );
    } else {
      criar.mutate(
        { nome, descricao },
        {
          onSuccess: (id) => {
            toast.success("Grupo criado — adicione as empresas");
            onCriado(id);
            onClose();
          },
        },
      );
    }
  }

  return (
    <Modal open onClose={onClose} title={grupo ? "Editar grupo" : "Novo grupo"} size="md">
      <form onSubmit={salvar} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Nome *</label>
          <input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Grupo Mad Brew"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Descrição</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={3}
            placeholder="Opcional"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
          >
            {salvando ? "Salvando…" : grupo ? "Salvar" : "Criar grupo"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function GruposPage() {
  // useSearchParams exige Suspense boundary (padrão do projeto).
  return (
    <Suspense fallback={null}>
      <GruposInner />
    </Suspense>
  );
}

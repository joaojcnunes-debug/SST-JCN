"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Pencil, Plus, Trash2, Users, Wand2, ShieldCheck, Lock } from "lucide-react";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { TabelaSkeleton } from "@/components/ui/PageSkeletons";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUnidades } from "@/lib/hooks/useUnidades";
import { cn } from "@/lib/utils";
import {
  ROTULO_MODULO,
  TODOS_MODULOS,
  type FuncaoPainel,
  type ModuloPermitido,
  type NivelUsuario,
  type PerfilUsuario,
  type Usuario,
} from "@/lib/supabase/types";

/**
 * Sistema › Funções (v0.3.619 / v229).
 *
 * É daqui que a JCN Consultoria muda o que foi definido em 17–18/09 sem depender de
 * migration: o padrão de cada função (módulos, nível, perfil, flags, unidades)
 * e a função de cada conta. "Aplicar padrão" reescreve a conta com o padrão da
 * função — é o botão para "mudança repentina": trocou a função, aplica, pronto.
 *
 * O que esta tela NÃO faz de propósito: mexer nos módulos de uma conta
 * individualmente (isso continua em Usuários) e mudar quem é Admin de sistema
 * (perfil Admin só pela tela de Usuários, com senha de Admin).
 */

const NIVEIS: { value: NivelUsuario; label: string; ajuda: string }[] = [
  { value: "Consulta", label: "Consulta", ajuda: "lê; elabora documento no SGG" },
  { value: "Operacao", label: "Operação", ajuda: "cria e edita no módulo" },
  { value: "Aprovacao", label: "Aprovação", ajuda: "+ reabre elaboração de outro, troca responsável, configura o módulo, assina" },
  { value: "Admin", label: "Admin", ajuda: "+ administra o sistema (usuários, configurações, auditoria)" },
];

const PERFIS: PerfilUsuario[] = ["Visualizador", "Tecnico", "Admin"];

type UsuarioFuncao = Pick<
  Usuario,
  "id_usuario" | "nome" | "email" | "cargo" | "perfil" | "funcao" | "nivel" | "modulos_permitidos" | "unidades" | "ativo_sistema"
>;

/**
 * A lista fixa de cargos (v233, `cargos_painel`). Só leitura aqui: o banco
 * recusa cargo fora dela; a tela de Usuários escolhe dela (v0.3.622). Editar
 * a lista: por enquanto SQL.
 */
function useCargos() {
  return useQuery({
    queryKey: ["cargos_painel"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("cargos_painel" as never)
        .select("cargo, ordem, registro")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as { cargo: string; ordem: number; registro: string | null }[];
    },
  });
}

/** O resumo da trava por módulo no banco (v236): modo, desde quando, quantas tentativas. */
interface TravaResumo {
  modo: "log" | "trava";
  desde: string;
  revisar_em: string;
  tabelas: number;
  modulos: number;
  tentativas: number;
  contas: number;
  ultima_em: string | null;
}
interface TravaLinha {
  email: string;
  modulo: string;
  tabela: string;
  dia: string;
  vezes: number;
  bloqueado: boolean;
  ultimo_metodo: string | null;
  ultimo_path: string | null;
}
/** v240: o log agrupado por TELA × módulo (ids do caminho viram [id]). */
interface TravaTela {
  tela: string;
  modulo: string;
  vezes: number;
  contas: number;
  tabelas: number;
  ultimo_dia: string;
  bloqueado: boolean;
}
function useTravaModulo() {
  return useQuery({
    queryKey: ["rls_modulo", "resumo"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const [r, t, l] = await Promise.all([
        supabase.rpc("rls_modulo_resumo" as never),
        supabase.rpc("rls_modulo_por_tela" as never),
        supabase
          .from("rls_modulo_log" as never)
          .select("email, modulo, tabela, dia, vezes, bloqueado, ultimo_metodo, ultimo_path")
          .order("ultima_em", { ascending: false })
          .limit(5000),
      ]);
      if (r.error) throw r.error;
      if (t.error) throw t.error;
      if (l.error) throw l.error;
      const resumo = (Array.isArray(r.data) ? r.data[0] : r.data) as TravaResumo | undefined;
      return {
        resumo: resumo ?? null,
        telas: (Array.isArray(t.data) ? t.data : []) as unknown as TravaTela[],
        linhas: (l.data ?? []) as unknown as TravaLinha[],
      };
    },
    staleTime: 60_000,
  });
}

/** Nome da tela pelo caminho normalizado que a RPC devolve. O que não está aqui aparece pelo caminho mesmo. */
const ROTULO_TELA: Record<string, string> = {
  "/inicio": "Início",
  "/modulos": "Módulos",
  "/empresas": "Empresas",
  "/empresas/[id]": "Empresa (página)",
  "/psicossocial/empresas": "Psicossocial › Empresas",
  "/pendencias": "Pendências",
  "(sem tela)": "sem tela — antes da v240 ou rota do servidor",
};

function useFuncoes() {
  return useQuery({
    queryKey: ["funcoes_painel"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("funcoes_painel")
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FuncaoPainel[];
    },
  });
}

function useContasComFuncao() {
  return useQuery({
    queryKey: ["usuarios", "funcoes"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("usuarios")
        .select("id_usuario, nome, email, cargo, perfil, funcao, nivel, modulos_permitidos, unidades, ativo_sistema")
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as UsuarioFuncao[];
    },
  });
}

/** O que "aplicar padrão" grava numa conta. Unidades: só quando o padrão é "todas" e a conta não é Admin. */
function padraoParaConta(f: FuncaoPainel, u: UsuarioFuncao, todasUnidades: string[]) {
  const perfil = f.perfil_padrao;
  const patch: Record<string, unknown> = {
    funcao: f.funcao,
    nivel: f.nivel,
    perfil,
    modulos_permitidos: f.modulos_padrao,
  };
  if (f.pode_criar_padrao !== null) patch.pode_criar = f.pode_criar_padrao;
  if (f.pode_editar_padrao !== null) patch.pode_editar = f.pode_editar_padrao;
  if (f.pode_excluir_padrao !== null) patch.pode_excluir = f.pode_excluir_padrao;
  if (f.unidades_padrao === "todas" && perfil !== "Admin") patch.unidades = todasUnidades;
  if (perfil === "Admin") patch.unidades = [];
  return patch;
}

export default function FuncoesPage() {
  const qc = useQueryClient();
  const { data: funcoes = [], isLoading } = useFuncoes();
  const { data: contas = [] } = useContasComFuncao();
  const { data: unidades = [] } = useUnidades();
  const todasUnidades = useMemo(() => unidades.map((u) => u.id_unidade), [unidades]);

  const [editando, setEditando] = useState<FuncaoPainel | "nova" | null>(null);
  const [aplicar, setAplicar] = useState<{ funcao: FuncaoPainel; contas: UsuarioFuncao[] } | null>(null);
  const [apagar, setApagar] = useState<FuncaoPainel | null>(null);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["funcoes_painel"] });
    qc.invalidateQueries({ queryKey: ["usuarios"] });
  };

  const moverConta = useMutation({
    mutationFn: async ({ id, funcao }: { id: string; funcao: string | null }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("usuarios").update({ funcao } as never).eq("id_usuario", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); toast.success("Função da conta atualizada. Para trocar também os módulos, use \"Aplicar padrão\"."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const aplicarPadrao = useMutation({
    mutationFn: async ({ funcao, alvo }: { funcao: FuncaoPainel; alvo: UsuarioFuncao[] }) => {
      const supabase = createSupabaseBrowserClient();
      for (const u of alvo) {
        const { error } = await supabase
          .from("usuarios")
          .update(padraoParaConta(funcao, u, todasUnidades) as never)
          .eq("id_usuario", u.id_usuario);
        if (error) throw new Error(`${u.nome}: ${error.message}`);
      }
      return alvo.length;
    },
    onSuccess: (n) => { invalidar(); setAplicar(null); toast.success(n === 1 ? "Padrão aplicado à conta" : `Padrão aplicado a ${n} contas`); },
    onError: (e: Error) => toast.error(e.message),
  });

  const apagarFuncao = useMutation({
    mutationFn: async (f: FuncaoPainel) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("funcoes_painel").delete().eq("funcao", f.funcao);
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); setApagar(null); toast.success("Função apagada"); },
    onError: (e: Error) => toast.error(e.message.includes("violates foreign key") ? "Esta função ainda tem contas. Mova as contas antes de apagar." : e.message),
  });

  const contasPor = useMemo(() => {
    const m = new Map<string, UsuarioFuncao[]>();
    for (const c of contas) {
      const k = c.funcao ?? "";
      m.set(k, [...(m.get(k) ?? []), c]);
    }
    return m;
  }, [contas]);
  const semFuncao = contasPor.get("") ?? [];
  const { data: cargos = [] } = useCargos();

  if (isLoading) return <TabelaSkeleton />;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Funções do painel</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Cada conta pertence a uma função. A função define o <b>padrão</b> de módulos, nível e perfil —
            é o que uma conta nova recebe e o que &ldquo;Aplicar padrão&rdquo; grava numa conta existente.
            Módulos que uma conta ganhou por uso ficam nela até alguém aplicar o padrão de novo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditando("nova")}
          className="inline-flex items-center gap-2 rounded-xl bg-verde-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-verde-accent active:scale-95"
        >
          <Plus className="size-4" /> Nova função
        </button>
      </div>

      {semFuncao.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            {semFuncao.length} {semFuncao.length === 1 ? "conta ainda não tem função" : "contas ainda não têm função"}
          </p>
          <ul className="mt-2 divide-y divide-amber-200">
            {semFuncao.map((c) => (
              <LinhaConta key={c.id_usuario} conta={c} funcoes={funcoes} onMover={(funcao) => moverConta.mutate({ id: c.id_usuario, funcao })} />
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4">
        {funcoes.map((f) => {
          const suas = contasPor.get(f.funcao) ?? [];
          const nivel = NIVEIS.find((n) => n.value === f.nivel);
          return (
            <section key={f.funcao} className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
                    {f.funcao}
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      <Users className="size-3" /> {suas.length}
                    </span>
                  </h2>
                  <p className="mt-0.5 text-sm text-gray-600">{f.descricao}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    <span className="rounded-md bg-verde-primary/10 px-2 py-0.5 font-medium text-verde-primary" title={nivel?.ajuda}>
                      <ShieldCheck className="mr-1 inline size-3" />
                      {nivel?.label ?? f.nivel}
                    </span>
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-gray-700">perfil {f.perfil_padrao}</span>
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-gray-700">
                      {f.pode_criar_padrao === null ? "flags livres" : `${f.pode_criar_padrao ? "criar" : "—"} · ${f.pode_editar_padrao ? "editar" : "—"} · ${f.pode_excluir_padrao ? "excluir" : "—"}`}
                    </span>
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-gray-700">
                      unidades: {f.unidades_padrao === "todas" ? "todas" : "as da base"}
                    </span>
                    {f.ve_presenca_auditoria && (
                      <span className="rounded-md bg-sky-50 px-2 py-0.5 text-sky-800" title="Abre Sistema › Presença e Sistema › Auditoria (só leitura)">
                        vê Presença e Auditoria
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {TODOS_MODULOS.filter((m) => f.modulos_padrao.includes(m)).map((m) => (
                      <span key={m} className="rounded border border-gray-200 px-1.5 py-0.5 text-[11px] text-gray-700">
                        {ROTULO_MODULO[m].split(" – ")[0].split(" (")[0]}
                      </span>
                    ))}
                    {f.modulos_padrao.length === 0 && <span className="text-[11px] text-gray-400">nenhum módulo</span>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button type="button" onClick={() => setEditando(f)} className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    <Pencil className="size-4" /> Editar
                  </button>
                  <button
                    type="button"
                    disabled={suas.length === 0}
                    onClick={() => setAplicar({ funcao: f, contas: suas })}
                    title="Grava o padrão desta função em TODAS as contas dela (módulos, nível, perfil, flags)"
                    className="inline-flex items-center gap-1.5 rounded-md border border-verde-primary/40 px-3 py-1.5 text-sm font-medium text-verde-primary hover:bg-verde-primary/5 disabled:opacity-40"
                  >
                    <Wand2 className="size-4" /> Aplicar padrão a todas
                  </button>
                  <button type="button" disabled={suas.length > 0} onClick={() => setApagar(f)} title={suas.length ? "Mova as contas antes de apagar" : "Apagar função"} className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </header>
              {suas.length > 0 && (
                <ul className="divide-y divide-gray-100">
                  {suas.map((c) => (
                    <LinhaConta
                      key={c.id_usuario}
                      conta={c}
                      funcoes={funcoes}
                      padrao={f}
                      onMover={(funcao) => moverConta.mutate({ id: c.id_usuario, funcao })}
                      onAplicar={() => setAplicar({ funcao: f, contas: [c] })}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {editando && (
        <EditarFuncaoModal
          funcao={editando === "nova" ? null : editando}
          proximaOrdem={(funcoes.at(-1)?.ordem ?? 0) + 1}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); invalidar(); }}
        />
      )}

      <ConfirmDialog
        open={!!aplicar}
        title={aplicar?.contas.length === 1 ? `Aplicar o padrão de "${aplicar.funcao.funcao}" a ${aplicar.contas[0].nome}?` : `Aplicar o padrão de "${aplicar?.funcao.funcao}" a ${aplicar?.contas.length ?? 0} contas?`}
        description={`Vai gravar: módulos = ${aplicar?.funcao.modulos_padrao.length ?? 0} do padrão (o que a conta tinha a mais SAI), nível ${aplicar?.funcao.nivel}, perfil ${aplicar?.funcao.perfil_padrao}${aplicar?.funcao.unidades_padrao === "todas" ? ", todas as unidades" : ""}. Dá para desfazer conta a conta em Usuários.`}
        confirmLabel="Aplicar"
        onConfirm={() => aplicar && aplicarPadrao.mutate({ funcao: aplicar.funcao, alvo: aplicar.contas })}
        onCancel={() => setAplicar(null)}
        loading={aplicarPadrao.isPending}
      />
      <ConfirmDialog
        open={!!apagar}
        title={`Apagar a função "${apagar?.funcao}"?`}
        description="Só é possível quando nenhuma conta está nela. As contas não são afetadas."
        confirmLabel="Apagar"
        variant="danger"
        onConfirm={() => apagar && apagarFuncao.mutate(apagar)}
        onCancel={() => setApagar(null)}
        loading={apagarFuncao.isPending}
      />

      {cargos.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-bold text-gray-900">Cargos da lista ({cargos.length})</h2>
          <p className="mt-1 text-sm text-gray-600">
            O campo &ldquo;cargo&rdquo; da conta só aceita um destes nomes, escrito exatamente assim (o banco recusa o resto).
            O cargo sai em laudos e assinaturas — por isso a lista guarda o gênero. Para mudar a lista, fale com o suporte.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {cargos.map((c) => (
              <span key={c.cargo} className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-800" title={c.registro ? `registro profissional: ${c.registro}` : undefined}>
                {c.cargo}
                {c.registro && <span className="ml-1 text-gray-400">· {c.registro}</span>}
              </span>
            ))}
          </div>
        </section>
      )}

      <TravaModuloCard contas={contas} />
    </div>
  );
}

/**
 * v236: a trava por módulo no BANCO (as 14 que só travavam na tela) está em
 * modo LOG — anota quem leria/escreveria tabela de módulo que não tem, sem
 * barrar. Este card é o lembrete combinado com ele em 21/09: mostra o modo,
 * desde quando, quantas tentativas e a data de revisão (desde + 30 dias).
 * Virar a chave (modo trava) é operação de banco, de propósito — não tem botão.
 */
function TravaModuloCard({ contas }: { contas: UsuarioFuncao[] }) {
  const { data, isLoading, error } = useTravaModulo();
  const porConta = useMemo(() => {
    const nome = new Map(contas.map((c) => [c.email?.toLowerCase() ?? "", c.nome]));
    const acc = new Map<string, { email: string; nome: string; modulo: string; vezes: number; tabelas: Set<string>; ultimoDia: string; bloqueado: boolean }>();
    for (const l of data?.linhas ?? []) {
      const k = l.email + "|" + l.modulo;
      const g = acc.get(k) ?? { email: l.email, nome: nome.get(l.email) ?? l.email, modulo: l.modulo, vezes: 0, tabelas: new Set<string>(), ultimoDia: l.dia, bloqueado: false };
      g.vezes += l.vezes;
      g.tabelas.add(l.tabela);
      if (l.dia > g.ultimoDia) g.ultimoDia = l.dia;
      g.bloqueado = g.bloqueado || l.bloqueado;
      acc.set(k, g);
    }
    return [...acc.values()].sort((a, b) => b.vezes - a.vezes);
  }, [data, contas]);

  if (isLoading || error || !data?.resumo) return null;
  const r = data.resumo;
  const emLog = r.modo === "log";
  const fmt = (d: string) => new Date(d).toLocaleDateString("pt-BR");
  // Data "só dia" (YYYY-MM-DD) vinda do banco: new Date() lê como meia-noite UTC
  // e no fuso de São Paulo vira o dia anterior — ancora ao meio-dia local.
  const fmtDia = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
  const revisar = new Date(r.revisar_em + "T12:00:00");
  const atrasado = emLog && revisar.getTime() < Date.now();
  return (
    <section className={cn("rounded-xl border bg-white p-4 shadow-sm", atrasado ? "border-amber-300" : "border-gray-200")}>
      <div className="flex flex-wrap items-center gap-2">
        <Lock className={cn("h-4 w-4", emLog ? "text-amber-600" : "text-emerald-600")} />
        <h2 className="text-base font-bold text-gray-900">Trava por módulo no banco</h2>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", emLog ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800")}>
          {emLog ? "modo LOG — anota, não barra" : "modo TRAVA — barra"}
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        {r.tabelas} tabelas de {r.modulos} módulos conferem o módulo da conta no banco desde {fmt(r.desde)}.{" "}
        {emLog ? (
          <>
            Quem não tem o módulo ainda passa, mas fica anotado aqui.{" "}
            <strong className={atrasado ? "text-amber-700" : undefined}>Revisar em {fmtDia(r.revisar_em)}</strong>
            {atrasado && " — já passou: hora de olhar a lista e decidir se liga a trava"}.
            {" "}Ligar a trava é operação de banco (suporte), de propósito.
          </>
        ) : (
          <>Quem não tem o módulo é barrado; cada tentativa fica anotada aqui.</>
        )}
      </p>
      <p className="mt-2 text-sm text-gray-800">
        <strong>{r.tentativas}</strong> {r.tentativas === 1 ? "tentativa" : "tentativas"} de <strong>{r.contas}</strong> {r.contas === 1 ? "conta" : "contas"}
        {r.ultima_em && <span className="text-gray-500"> · última em {new Date(r.ultima_em).toLocaleString("pt-BR")}</span>}
        {r.tentativas === 0 && <span className="text-gray-500"> — ninguém bateu na porta até agora</span>}
      </p>
      {/* v240: por TELA primeiro — é o que separa "o Início lê 9 módulos para
          todo mundo" (ruído da tela) de "fulano abriu módulo que não tem". */}
      {data.telas.length > 0 && (
        <>
          <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Por tela</h3>
          <ul className="mt-1 divide-y divide-gray-100 rounded-lg border border-gray-100 text-sm">
            {data.telas.slice(0, 12).map((g) => (
              <li key={g.tela + g.modulo} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-1.5">
                <span className="min-w-[180px] font-medium text-gray-900" title={g.tela}>{ROTULO_TELA[g.tela] ?? g.tela}</span>
                <span className="text-gray-700">{ROTULO_MODULO[g.modulo as ModuloPermitido] ?? g.modulo}</span>
                <span className="text-xs text-gray-500">{g.vezes}× · {g.contas} {g.contas === 1 ? "conta" : "contas"} · {g.tabelas} {g.tabelas === 1 ? "tabela" : "tabelas"} · último dia {fmtDia(g.ultimo_dia)}</span>
                {g.bloqueado && <span className="rounded bg-red-100 px-1.5 text-xs text-red-700">barrado</span>}
              </li>
            ))}
            {data.telas.length > 12 && <li className="px-3 py-1.5 text-xs text-gray-500">e mais {data.telas.length - 12}…</li>}
          </ul>
        </>
      )}
      {porConta.length > 0 && <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Por conta</h3>}
      {porConta.length > 0 && (
        <ul className="mt-1 divide-y divide-gray-100 rounded-lg border border-gray-100 text-sm">
          {porConta.slice(0, 12).map((g) => (
            <li key={g.email + g.modulo} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-1.5">
              <span className="min-w-[180px] font-medium text-gray-900">{g.nome}</span>
              <span className="text-gray-700">{ROTULO_MODULO[g.modulo as ModuloPermitido] ?? g.modulo}</span>
              <span className="text-xs text-gray-500">{g.vezes}× · {g.tabelas.size} {g.tabelas.size === 1 ? "tabela" : "tabelas"} · último dia {fmtDia(g.ultimoDia)}</span>
              {g.bloqueado && <span className="rounded bg-red-100 px-1.5 text-xs text-red-700">barrado</span>}
            </li>
          ))}
          {porConta.length > 12 && <li className="px-3 py-1.5 text-xs text-gray-500">e mais {porConta.length - 12}…</li>}
        </ul>
      )}
    </section>
  );
}

function LinhaConta({ conta, funcoes, padrao, onMover, onAplicar }: {
  conta: UsuarioFuncao;
  funcoes: FuncaoPainel[];
  padrao?: FuncaoPainel;
  onMover: (funcao: string | null) => void;
  onAplicar?: () => void;
}) {
  const mods = conta.modulos_permitidos ?? [];
  const foraDoPadrao = padrao ? mods.filter((m) => !padrao.modulos_padrao.includes(m as ModuloPermitido)) : [];
  const faltando = padrao ? padrao.modulos_padrao.filter((m) => !mods.includes(m)) : [];
  const divergeNivel = padrao && conta.nivel !== padrao.nivel;
  const divergePerfil = padrao && conta.perfil !== padrao.perfil_padrao;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
      <div className="min-w-[200px] flex-1">
        <span className={cn("font-medium text-gray-900", !conta.ativo_sistema && "line-through opacity-60")}>{conta.nome}</span>
        <span className="ml-2 text-xs text-gray-500">{conta.cargo ?? "—"}</span>
        <div className="mt-0.5 flex flex-wrap gap-1 text-[11px]">
          <span className={cn("rounded px-1.5 py-0.5", divergePerfil ? "bg-amber-50 text-amber-800" : "bg-gray-100 text-gray-600")}>{conta.perfil}</span>
          <span className={cn("rounded px-1.5 py-0.5", divergeNivel ? "bg-amber-50 text-amber-800" : "bg-gray-100 text-gray-600")}>{conta.nivel ?? "sem nível"}</span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">{mods.length} módulos</span>
          {foraDoPadrao.length > 0 && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700" title={foraDoPadrao.join(", ")}>+{foraDoPadrao.length} além do padrão</span>}
          {faltando.length > 0 && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-800" title={faltando.join(", ")}>−{faltando.length} do padrão</span>}
        </div>
      </div>
      <select
        value={conta.funcao ?? ""}
        onChange={(e) => onMover(e.target.value || null)}
        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs focus:border-verde-primary focus:outline-none"
        aria-label={`Função de ${conta.nome}`}
      >
        <option value="">— sem função —</option>
        {funcoes.map((f) => <option key={f.funcao} value={f.funcao}>{f.funcao}</option>)}
      </select>
      {onAplicar && (
        <button type="button" onClick={onAplicar} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50" title="Grava o padrão da função nesta conta">
          <Wand2 className="size-3.5" /> Aplicar padrão
        </button>
      )}
    </li>
  );
}

function EditarFuncaoModal({ funcao, proximaOrdem, onClose, onSaved }: {
  funcao: FuncaoPainel | null;
  proximaOrdem: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const nova = funcao === null;
  const [form, setForm] = useState<FuncaoPainel>(
    funcao ?? {
      funcao: "",
      ordem: proximaOrdem,
      descricao: "",
      nivel: "Operacao",
      perfil_padrao: "Tecnico",
      pode_criar_padrao: true,
      pode_editar_padrao: true,
      pode_excluir_padrao: false,
      modulos_padrao: ["painel"],
      unidades_padrao: "da_base",
      ve_presenca_auditoria: false,
    },
  );

  const salvar = useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const nome = form.funcao.trim();
      if (!nome) throw new Error("Dê um nome à função");
      const row = { ...form, funcao: nome, descricao: form.descricao.trim() };
      const { error } = nova
        ? await supabase.from("funcoes_painel").insert(row as never)
        : await supabase.from("funcoes_painel").update(row as never).eq("funcao", funcao.funcao);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(nova ? "Função criada" : "Função salva. As contas só mudam quando você aplicar o padrão."); onSaved(); },
    onError: (e: Error) => toast.error(e.message.includes("duplicate") ? "Já existe uma função com esse nome" : e.message),
  });

  function onSubmit(e: FormEvent) { e.preventDefault(); salvar.mutate(); }
  function toggleModulo(m: ModuloPermitido) {
    setForm((f) => ({ ...f, modulos_padrao: f.modulos_padrao.includes(m) ? f.modulos_padrao.filter((x) => x !== m) : [...f.modulos_padrao, m] }));
  }
  function setNivel(n: NivelUsuario) {
    // nível sugere o perfil e as flags; quem edita pode ajustar depois
    const sug: Record<NivelUsuario, Partial<FuncaoPainel>> = {
      Consulta: { perfil_padrao: "Visualizador", pode_criar_padrao: false, pode_editar_padrao: false, pode_excluir_padrao: false },
      Operacao: { perfil_padrao: "Tecnico", pode_criar_padrao: true, pode_editar_padrao: true, pode_excluir_padrao: false },
      Aprovacao: { perfil_padrao: "Tecnico", pode_criar_padrao: true, pode_editar_padrao: true, pode_excluir_padrao: true },
      Admin: { perfil_padrao: "Admin", pode_criar_padrao: null, pode_editar_padrao: null, pode_excluir_padrao: null },
    };
    setForm((f) => ({ ...f, nivel: n, ...sug[n] }));
  }
  const input = "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20";

  return (
    <Modal
      open
      onClose={onClose}
      title={nova ? "Nova função" : `Editar função: ${funcao.funcao}`}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button type="submit" form="form-funcao" disabled={salvar.isPending} className="rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60">
            {salvar.isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      }
    >
      <form id="form-funcao" onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Nome</span>
            <input value={form.funcao} onChange={(e) => setForm({ ...form, funcao: e.target.value })} disabled={!nova} className={cn(input, !nova && "bg-gray-50 text-gray-500")} placeholder="ex.: Técnico de campo" />
            {!nova && <span className="mt-1 block text-[11px] text-gray-500">O nome é a chave das contas; para renomear, crie outra função e mova as contas.</span>}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Ordem na lista</span>
            <input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })} className={input} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">O que essa função faz</span>
          <input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className={input} placeholder="uma frase, para quem cria a conta entender" />
        </label>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Nível</span>
            <select value={form.nivel} onChange={(e) => setNivel(e.target.value as NivelUsuario)} className={input}>
              {NIVEIS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
            </select>
            <span className="mt-1 block text-[11px] text-gray-500">{NIVEIS.find((n) => n.value === form.nivel)?.ajuda}</span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Perfil (o que o banco aceita)</span>
            <select value={form.perfil_padrao} onChange={(e) => setForm({ ...form, perfil_padrao: e.target.value as PerfilUsuario })} className={input}>
              {PERFIS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Unidades da conta nova</span>
            <select value={form.unidades_padrao} onChange={(e) => setForm({ ...form, unidades_padrao: e.target.value as FuncaoPainel["unidades_padrao"] })} className={input}>
              <option value="da_base">as da base (escolhe em Usuários)</option>
              <option value="todas">todas as unidades</option>
            </select>
          </label>
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.ve_presenca_auditoria === true} onChange={(e) => setForm({ ...form, ve_presenca_auditoria: e.target.checked })} className="rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30" />
          <span className="text-gray-700">vê Sistema › Presença e Auditoria (só leitura; Admin sempre vê)</span>
        </label>
        {form.perfil_padrao !== "Admin" && (
          <div className="flex flex-wrap gap-4 text-sm">
            {([["pode_criar_padrao", "pode criar"], ["pode_editar_padrao", "pode editar"], ["pode_excluir_padrao", "pode excluir laudo inteiro"]] as const).map(([k, rot]) => (
              <label key={k} className="inline-flex items-center gap-2">
                <input type="checkbox" checked={form[k] === true} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} className="rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30" />
                <span className="text-gray-700">{rot}</span>
              </label>
            ))}
          </div>
        )}
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">Módulos do padrão ({form.modulos_padrao.length})</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {TODOS_MODULOS.map((m) => (
              <label key={m} className="inline-flex items-center gap-2">
                <input type="checkbox" checked={form.modulos_padrao.includes(m)} onChange={() => toggleModulo(m)} className="rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30" />
                <span className="text-sm text-gray-700">{ROTULO_MODULO[m]}</span>
              </label>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}

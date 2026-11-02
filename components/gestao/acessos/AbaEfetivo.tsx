"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin, Trash2, UserMinus, UserPlus } from "lucide-react";
import AvatarPessoa from "@/components/gestao/AvatarPessoa";
import { useAcessosEfetivos } from "@/lib/hooks/useGestaoAcesso";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { chaveRecurso, descreverOrigem, origensComEfeito, type NoEspaco, type TipoRecurso } from "@/lib/gestao/acessos";
import { rotuloNivel, nivelVeTodas } from "@/lib/gestao/niveis";
import { cn } from "@/lib/utils";
import BuscaUnica, { type OpcaoBusca } from "./BuscaUnica";
import TirarDaListaDialog, { type AlvoTirar } from "./TirarDaListaDialog";
import type { DadosAcessos } from "./useDadosAcessos";
import type { Passo } from "./useGravarAcessos";

const COR_EFEITO = {
  vale: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  teto: "bg-amber-50 text-amber-800 ring-amber-200",
  sem_efeito: "bg-gray-50 text-gray-400 line-through ring-gray-200",
} as const;
const DICA_EFEITO = {
  vale: "É esta regra que define o nível",
  teto: "Restritivo: limita o nível (teto)",
  sem_efeito: "Sem efeito aqui: há regra mais específica (lista > pasta > espaço)",
} as const;

function listasDaArvore(arv: NoEspaco[]) {
  const out: { id: string; caminho: string }[] = [];
  for (const e of arv) {
    const pre = e.id === "__sem_espaco__" ? "" : `${e.nome} › `;
    for (const p of e.pastas) for (const l of p.listas) out.push({ id: l.id, caminho: `${pre}${p.nome} › ${l.nome}` });
    for (const l of e.listas) out.push({ id: l.id, caminho: `${pre}${l.nome}` });
  }
  return out;
}

/**
 * O acesso que vale DE FATO (v305, RPC gestao_acessos_efetivos): por pessoa (o que ela acessa)
 * ou por lista (quem acessa — o "Compartilhar" da lista abre aqui). Cada linha mostra o nível
 * efetivo e as regras que levaram a ele, marcando a que manda, a que é teto e a que ficou sem
 * efeito por haver outra mais específica.
 * v0.3.851: busca no lugar do select; "Tirar desta lista" em cada linha e "Tirar da Gestão" na pessoa.
 */
export default function AbaEfetivo({
  d,
  modo,
  quadroInicial,
  onDarAcesso,
  pedirMotivo,
  executar,
  gravando,
}: {
  d: DadosAcessos;
  modo: "pessoa" | "lista";
  quadroInicial?: string | null;
  onDarAcesso: (idQuadro: string) => void;
  pedirMotivo: (titulo: string, resumo?: string) => Promise<string | null>;
  executar: (passos: Passo[], motivo: string, sucesso: string) => Promise<boolean>;
  gravando: boolean;
}) {
  const [email, setEmail] = useState("");
  const [quadro, setQuadro] = useState(quadroInicial ?? "");
  const [perfil, setPerfil] = useState("");
  const [tirar, setTirar] = useState<AlvoTirar | null>(null);
  const listas = useMemo(() => listasDaArvore(d.arvore), [d.arvore]);
  const caminhoLista = useMemo(() => new Map(listas.map((l) => [l.id, l.caminho])), [listas]);
  const q = useAcessosEfetivos(modo === "pessoa" ? { email } : { idQuadro: quadro });
  const linhas = q.data ?? [];
  const unidades = linhas[0]?.unidades;

  const perfis = useMemo(() => [...new Set(d.usuarios.map((u) => u.perfil).filter(Boolean))].sort(), [d.usuarios]);
  const opcoesPessoa = useMemo<OpcaoBusca[]>(
    () =>
      d.usuarios
        .filter((u) => !perfil || u.perfil === perfil)
        .map((u) => {
          const admin = u.perfil === "Admin";
          const fora = !admin && !d.membrosAtivos.has(u.email.toLowerCase());
          return {
            id: u.email,
            titulo: u.nome,
            sub: u.email,
            marca: admin ? "Admin" : fora ? "fora da Gestão" : undefined,
            marcaCls: fora ? "bg-gray-100 text-gray-500" : "bg-marca-light text-marca-primary",
          };
        }),
    [d.usuarios, d.membrosAtivos, perfil],
  );
  const opcoesLista = useMemo<OpcaoBusca[]>(() => listas.map((l) => ({ id: l.id, titulo: l.caminho })), [listas]);

  // ── Tirar da Gestão (por pessoa): sai das equipes, perde os acessos diretos e fica inativa no
  // roster (mantém o papel, para reativar igual). A conta do painel não muda. Perfil Admin vê tudo
  // pelo perfil, então não há o que tirar aqui.
  const papel = email ? d.papelPorEmail.get(email.toLowerCase()) : undefined;
  const podeTirarDaGestao = !!email && !!papel && d.perfilPorEmail.get(email.toLowerCase()) !== "Admin";
  const responsavelEm = useQuery({
    queryKey: ["gestao-acessos", "responsavel-em", email],
    enabled: podeTirarDaGestao,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { count, error } = await sb
        .from("gestao_tarefa_vinculados")
        .select("id", { count: "exact", head: true })
        .eq("usuario_email", email.toLowerCase())
        .eq("tipo", "responsavel");
      if (error) throw error;
      return count ?? 0;
    },
  });

  async function tirarDaGestao() {
    if (!podeTirarDaGestao || !papel) return;
    const k = email.toLowerCase();
    const nome = d.nomePorEmail.get(k) ?? email;
    const equipes = d.equipeMembros.filter((m) => m.usuario_email.toLowerCase() === k).map((m) => m.id_equipe);
    const diretos = d.acessos.filter(
      (a) => !a.id_equipe && (a.usuario_email ?? "").toLowerCase() === k && a.recurso_tipo && a.recurso_tipo !== "task" && a.recurso_id,
    );
    const nTarefas = responsavelEm.data ?? 0;
    const motivo = await pedirMotivo(
      "Tirar da Gestão",
      `${nome} deixa de ver a Gestão: sai de ${equipes.length} equipe(s)` +
        (equipes.length ? ` (${equipes.map((i) => d.nomeEquipe.get(i) ?? "?").join(", ")})` : "") +
        ` e perde ${diretos.length} acesso(s) direto(s). A conta do painel continua.` +
        (nTarefas ? ` Atenção: é responsável em ${nTarefas} tarefa(s), que continuam no nome dela — para deixá-las sem dono, tire-a em cada tarefa.` : ""),
    );
    if (!motivo) return;
    const passos: Passo[] = [
      ...diretos.map((a) => ({ op: "pessoa" as const, email, tipo: a.recurso_tipo as TipoRecurso, id: a.recurso_id!, nivel: null })),
      ...equipes.map((id_equipe) => ({ op: "sair_equipe" as const, id_equipe, email })),
      { op: "membro", email, papel, ativo: false },
    ];
    if (await executar(passos, motivo, `${nome} saiu da Gestão`)) setEmail("");
  }

  async function confirmarTirar(passos: Passo[], resumo: string) {
    setTirar(null);
    const motivo = await pedirMotivo("Tirar desta lista", resumo);
    if (!motivo) return;
    await executar(passos, motivo, "Acesso retirado");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {modo === "pessoa" ? (
          <>
            <BuscaUnica
              opcoes={opcoesPessoa}
              value={email}
              onChange={setEmail}
              placeholder="Buscar pessoa por nome ou e-mail…"
              filtros={
                <select value={perfil} onChange={(e) => setPerfil(e.target.value)} className="rounded-md border border-gray-200 px-2 py-1 text-sm" aria-label="Filtrar por perfil">
                  <option value="">Todos os perfis</option>
                  {perfis.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              }
            />
            {podeTirarDaGestao && (
              <button type="button" disabled={gravando} onClick={tirarDaGestao} className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                <UserMinus className="size-4" /> Tirar da Gestão
              </button>
            )}
          </>
        ) : (
          <>
            <BuscaUnica opcoes={opcoesLista} value={quadro} onChange={setQuadro} placeholder="Buscar lista pelo nome, pasta ou espaço…" />
            {quadro && (
              <button type="button" onClick={() => onDarAcesso(quadro)} className="inline-flex items-center gap-1 rounded-md border border-marca-primary px-2.5 py-1.5 text-sm font-medium text-marca-primary hover:bg-marca-light">
                <UserPlus className="size-4" /> Dar acesso a esta lista
              </button>
            )}
          </>
        )}
      </div>

      <p className="text-[11px] text-gray-500">
        Nível que vale de fato, calculado pelo banco. Regras: <span className="rounded bg-emerald-50 px-1 text-emerald-800">define o nível</span>{" "}
        <span className="rounded bg-amber-50 px-1 text-amber-800">teto (restritivo)</span>{" "}
        <span className="rounded bg-gray-50 px-1 text-gray-400 line-through">sem efeito</span> — a regra da lista vale mais que a da pasta, e a da pasta mais que a do espaço.
      </p>

      {modo === "pessoa" && email && unidades && unidades.length > 0 && (
        <p className="flex items-center gap-1 rounded-md bg-sky-50 px-2 py-1 text-xs text-sky-800">
          <MapPin className="size-3.5" /> Vê só as tarefas das unidades: {unidades.join(", ")} (e as sem unidade), mesmo nos níveis &quot;todas as tarefas&quot;.
        </p>
      )}

      {q.isLoading && (modo === "pessoa" ? email : quadro) ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500"><Loader2 className="size-4 animate-spin" /> Calculando…</div>
      ) : q.isError ? (
        <p className="py-6 text-center text-sm text-red-600">Não foi possível calcular os acessos.</p>
      ) : (modo === "pessoa" ? email : quadro) && linhas.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">{modo === "pessoa" ? "Esta pessoa não acessa nenhuma lista." : "Ninguém além dos administradores acessa esta lista."}</p>
      ) : (
        <div className="max-h-[26rem] space-y-1 overflow-auto">
          {linhas.map((l) => {
            const origens = origensComEfeito(l.origens ?? []);
            return (
              <div key={`${l.email}:${l.id_quadro}`} className="flex flex-wrap items-start gap-2 rounded-md border border-gray-100 px-2 py-1.5">
                {modo === "lista" && <AvatarPessoa nome={l.nome ?? l.email} className="size-7 text-[10px]" />}
                <div className="min-w-[180px] flex-1">
                  <p className="text-sm font-medium text-gray-800">{modo === "pessoa" ? (caminhoLista.get(l.id_quadro) ?? l.quadro) : (l.nome ?? l.email)}</p>
                  {modo === "lista" && <p className="text-[11px] text-gray-400">{l.email}</p>}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {origens.map((o, i) => (
                      <span key={i} title={DICA_EFEITO[o.efeito]} className={cn("rounded px-1.5 py-0.5 text-[10px] ring-1", COR_EFEITO[o.efeito])}>
                        {descreverOrigem(o)}{o.nivel && o.tipo !== "gestor" ? ` · ${rotuloNivel(o.nivel)}` : ""}
                      </span>
                    ))}
                  </div>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", nivelVeTodas(l.nivel) ? "bg-marca-light text-marca-primary" : "bg-gray-100 text-gray-700")}>
                  {rotuloNivel(l.nivel)}
                </span>
                <button
                  type="button"
                  disabled={gravando}
                  title="Tirar desta lista"
                  onClick={() =>
                    setTirar({
                      email: l.email,
                      nome: l.nome ?? d.nomePorEmail.get(l.email.toLowerCase()) ?? l.email,
                      idQuadro: l.id_quadro,
                      caminho: caminhoLista.get(l.id_quadro) ?? l.quadro,
                      origens: l.origens ?? [],
                    })
                  }
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-gray-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {modo === "lista" && quadro && !d.indice.has(chaveRecurso("list", quadro)) && (
        <p className="text-[11px] text-gray-400">Lista pessoal (Meu Quadro): o acesso é do dono e do supervisor da equipe dele.</p>
      )}
      <TirarDaListaDialog d={d} alvo={tirar} onClose={() => setTirar(null)} onConfirmar={confirmarTirar} />
    </div>
  );
}

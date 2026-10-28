"use client";

import { useMemo, useState } from "react";
import { Copy, Folder, LayoutGrid, List, Search, ShieldAlert, Trash2, UserPlus, Users } from "lucide-react";
import AvatarPessoa from "@/components/gestao/AvatarPessoa";
import SeletorNivel from "@/components/gestao/SeletorNivel";
import PessoasPicker from "./PessoasPicker";
import RecursoPicker from "./RecursoPicker";
import type { DadosAcessos } from "./useDadosAcessos";
import type { Passo } from "./useGravarAcessos";
import { lerChave, planoCopia, ROTULO_TIPO, type GrantPessoa, type TipoRecurso } from "@/lib/gestao/acessos";
import { rotuloNivel, type GestaoNivel } from "@/lib/gestao/niveis";

const ICONE: Record<TipoRecurso, typeof List> = { space: LayoutGrid, folder: Folder, list: List };
const ORDEM: Record<string, number> = { space: 0, folder: 1, list: 2 };

/**
 * Aba Pessoas (v305): dar acesso a VÁRIAS pessoas em espaços, pastas ou listas de uma vez;
 * copiar os acessos de outra pessoa; e as regras atuais agrupadas por recurso, com busca.
 */
export default function AbaPessoas({
  d,
  recursosIniciais,
  pedirMotivo,
  executar,
  gravando,
}: {
  d: DadosAcessos;
  recursosIniciais?: string[];
  pedirMotivo: (titulo: string, resumo?: string) => Promise<string | null>;
  executar: (passos: Passo[], motivo: string, sucesso: string) => Promise<boolean>;
  gravando: boolean;
}) {
  const [pessoas, setPessoas] = useState<string[]>([]);
  const [recursos, setRecursos] = useState<Set<string>>(() => new Set(recursosIniciais ?? []));
  const [nivel, setNivel] = useState<GestaoNivel | "">("");
  const [modoCopia, setModoCopia] = useState(false);
  const [origemCopia, setOrigemCopia] = useState("");
  const [copiarEquipes, setCopiarEquipes] = useState(true);
  const [busca, setBusca] = useState("");

  const opcoesPessoas = useMemo(() => d.usuarios.map((u) => ({ email: u.email, nome: u.nome, perfil: u.perfil })), [d.usuarios]);
  const ehAdmin = (email: string) => d.perfilPorEmail.get(email.toLowerCase()) === "Admin";

  /** Libera o módulo (roster) para quem ainda não é membro e não é Admin — nunca rebaixa gestor. */
  const liberarModulo = (emails: string[]): Passo[] =>
    emails.filter((e) => !ehAdmin(e) && !d.membrosAtivos.has(e.toLowerCase())).map((email) => ({ op: "membro", email }));

  async function conceder() {
    if (!pessoas.length || !recursos.size || !nivel) return;
    const motivo = await pedirMotivo(
      "Conceder acesso",
      `${pessoas.length} pessoa(s) × ${recursos.size} recurso(s) — ${rotuloNivel(nivel)}`,
    );
    if (!motivo) return;
    const passos: Passo[] = [...liberarModulo(pessoas)];
    for (const email of pessoas) for (const k of recursos) passos.push({ op: "pessoa", email, ...lerChave(k), nivel });
    if (await executar(passos, motivo, `Acesso concedido (${pessoas.length} pessoa(s), ${recursos.size} recurso(s))`)) {
      setPessoas([]);
      setRecursos(new Set());
      setNivel("");
    }
  }

  // ── copiar acessos de outra pessoa ──
  const grants = d.acessos as unknown as GrantPessoa[];
  const plano = useMemo(() => (origemCopia ? planoCopia(origemCopia, pessoas, grants) : []), [origemCopia, pessoas, grants]);
  const equipesDaOrigem = useMemo(
    () => d.equipeMembros.filter((m) => m.usuario_email.toLowerCase() === origemCopia.toLowerCase()),
    [d.equipeMembros, origemCopia],
  );
  const entradasEquipe = useMemo(() => {
    if (!copiarEquipes) return [];
    return pessoas.flatMap((email) =>
      equipesDaOrigem
        .filter((m) => !d.equipeMembros.some((x) => x.id_equipe === m.id_equipe && x.usuario_email.toLowerCase() === email.toLowerCase()))
        .map((m) => ({ op: "entrar_equipe" as const, id_equipe: m.id_equipe, email, papel: m.papel })),
    );
  }, [copiarEquipes, pessoas, equipesDaOrigem, d.equipeMembros]);
  const grantsDaOrigem = grants.filter((g) => !g.id_equipe && !g.restritivo && g.recurso_tipo !== "task" && g.usuario_email?.toLowerCase() === origemCopia.toLowerCase());

  async function copiar() {
    if (!origemCopia || !pessoas.length || (!plano.length && !entradasEquipe.length)) return;
    const nomeOrigem = d.nomePorEmail.get(origemCopia.toLowerCase()) ?? origemCopia;
    const motivo = await pedirMotivo(
      "Copiar acessos",
      `De ${nomeOrigem} para ${pessoas.length} pessoa(s): ${plano.length} acesso(s) e ${entradasEquipe.length} entrada(s) em equipe.`,
    );
    if (!motivo) return;
    const passos: Passo[] = [
      ...liberarModulo(pessoas),
      ...plano.map((p) => ({ op: "pessoa" as const, email: p.alvo, tipo: p.tipo, id: p.id, nivel: p.nivel })),
      ...entradasEquipe,
    ];
    if (await executar(passos, motivo, `Acessos de ${nomeOrigem} copiados`)) {
      setPessoas([]);
      setOrigemCopia("");
    }
  }

  // ── regras atuais, agrupadas por recurso ──
  const grupos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const m = new Map<string, { tipo: TipoRecurso; id: string; caminho: string; itens: typeof d.acessos }>();
    for (const a of d.acessos) {
      if (!a.recurso_tipo || a.recurso_tipo === "task" || !a.recurso_id) continue;
      const r = d.recursoDe(a.recurso_tipo, a.recurso_id);
      const nomeQuem = a.id_equipe ? `Equipe: ${d.nomeEquipe.get(a.id_equipe) ?? "?"}` : (d.nomePorEmail.get((a.usuario_email ?? "").toLowerCase()) ?? a.usuario_email ?? "");
      if (q && !r.caminho.toLowerCase().includes(q) && !nomeQuem.toLowerCase().includes(q) && !(a.usuario_email ?? "").toLowerCase().includes(q)) continue;
      const k = `${a.recurso_tipo}:${a.recurso_id}`;
      if (!m.has(k)) m.set(k, { tipo: a.recurso_tipo, id: a.recurso_id, caminho: r.caminho, itens: [] });
      m.get(k)!.itens.push(a);
    }
    return [...m.values()].sort((x, y) => ORDEM[x.tipo] - ORDEM[y.tipo] || x.caminho.localeCompare(y.caminho, "pt-BR"));
  }, [d, busca]);

  async function mudarNivel(a: (typeof d.acessos)[number], n: GestaoNivel) {
    const quem = a.id_equipe ? `equipe ${d.nomeEquipe.get(a.id_equipe) ?? ""}` : (d.nomePorEmail.get((a.usuario_email ?? "").toLowerCase()) ?? a.usuario_email);
    const motivo = await pedirMotivo("Alterar nível", `${quem}: ${rotuloNivel(a.nivel)} → ${rotuloNivel(n)}`);
    if (!motivo) return;
    const passo: Passo = a.id_equipe
      ? { op: "equipe", id_equipe: a.id_equipe, tipo: a.recurso_tipo as TipoRecurso, id: a.recurso_id!, nivel: n }
      : { op: "pessoa", email: a.usuario_email!, tipo: a.recurso_tipo as TipoRecurso, id: a.recurso_id!, nivel: n };
    await executar([passo], motivo, "Nível alterado");
  }

  async function remover(a: (typeof d.acessos)[number], caminho: string) {
    const quem = a.id_equipe ? `Equipe ${d.nomeEquipe.get(a.id_equipe) ?? ""}` : (d.nomePorEmail.get((a.usuario_email ?? "").toLowerCase()) ?? a.usuario_email ?? "");
    // o diálogo do motivo é a confirmação (Cancelar desiste)
    const motivo = await pedirMotivo("Remover acesso", `${quem} perde o acesso a ${caminho}.`);
    if (!motivo) return;
    const passo: Passo = a.id_equipe
      ? { op: "equipe", id_equipe: a.id_equipe, tipo: a.recurso_tipo as TipoRecurso, id: a.recurso_id!, nivel: null }
      : { op: "pessoa", email: a.usuario_email!, tipo: a.recurso_tipo as TipoRecurso, id: a.recurso_id!, nivel: null };
    await executar([passo], motivo, "Acesso removido");
  }

  const inputCls = "rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none";

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-dashed border-gray-300 p-3">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            {modoCopia ? <Copy className="size-3.5" /> : <UserPlus className="size-3.5" />} {modoCopia ? "Copiar acessos de outra pessoa" : "Dar acesso"}
          </p>
          <button type="button" onClick={() => setModoCopia((v) => !v)} className="text-[11px] font-medium text-verde-primary hover:underline">
            {modoCopia ? "Voltar para dar acesso" : "Copiar acessos de outra pessoa"}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-gray-500">{modoCopia ? "Para quem" : "Quem"}</p>
            <PessoasPicker pessoas={opcoesPessoas} value={pessoas} onChange={setPessoas} />
          </div>
          {modoCopia ? (
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Copiar de</p>
              <select value={origemCopia} onChange={(e) => setOrigemCopia(e.target.value)} className={`${inputCls} w-full`}>
                <option value="">Escolha a pessoa modelo…</option>
                {opcoesPessoas.map((p) => (
                  <option key={p.email} value={p.email}>{p.nome} ({p.email})</option>
                ))}
              </select>
              {origemCopia && (
                <div className="rounded-md bg-gray-50 p-2 text-xs text-gray-600">
                  <p className="font-medium text-gray-700">Acessos diretos da pessoa modelo ({grantsDaOrigem.length}):</p>
                  <ul className="mt-1 max-h-28 space-y-0.5 overflow-auto">
                    {grantsDaOrigem.map((g) => (
                      <li key={`${g.recurso_tipo}:${g.recurso_id}`}>
                        {ROTULO_TIPO[g.recurso_tipo as TipoRecurso]} {d.recursoDe(g.recurso_tipo, g.recurso_id).caminho} — {rotuloNivel(g.nivel)}
                      </li>
                    ))}
                    {grantsDaOrigem.length === 0 && <li className="text-gray-400">Nenhum acesso direto (pode ter só por equipe).</li>}
                  </ul>
                  {equipesDaOrigem.length > 0 && (
                    <label className="mt-2 flex items-center gap-1.5">
                      <input type="checkbox" checked={copiarEquipes} onChange={(e) => setCopiarEquipes(e.target.checked)} className="size-3.5" />
                      Pôr também nas mesmas equipes ({equipesDaOrigem.map((m) => d.nomeEquipe.get(m.id_equipe) ?? "?").join(", ")})
                    </label>
                  )}
                  <p className="mt-2 text-[11px] text-gray-500">
                    Restritivos e acessos a uma tarefa só não são copiados. O que a pessoa já tem igual é pulado.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-gray-500">Onde ({recursos.size})</p>
              <RecursoPicker arvore={d.arvore} value={recursos} onChange={setRecursos} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {!modoCopia && <SeletorNivel value={nivel} onChange={setNivel} className={inputCls} />}
          {modoCopia ? (
            <button type="button" onClick={copiar} disabled={!origemCopia || !pessoas.length || (!plano.length && !entradasEquipe.length) || gravando}
              className="rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50">
              Copiar {plano.length + entradasEquipe.length ? `(${plano.length + entradasEquipe.length})` : ""}
            </button>
          ) : (
            <button type="button" onClick={conceder} disabled={!pessoas.length || !recursos.size || !nivel || gravando}
              className="rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50">
              Conceder acesso
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-gray-700">Regras de acesso ({grupos.reduce((s, g) => s + g.itens.length, 0)})</p>
          <div className="relative w-64 max-w-full">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar por pessoa, equipe ou lista…" className="w-full rounded-md border border-gray-200 py-1 pl-7 pr-2 text-xs focus:border-verde-primary focus:outline-none" />
          </div>
        </div>
        <div className="max-h-[22rem] space-y-2 overflow-auto">
          {grupos.length === 0 && <p className="py-4 text-center text-sm text-gray-400">Nenhuma regra{busca ? " com esse filtro" : " ainda"}.</p>}
          {grupos.map((g) => {
            const Icone = ICONE[g.tipo];
            return (
              <div key={`${g.tipo}:${g.id}`} className="rounded-lg border border-gray-100">
                <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50/70 px-3 py-1.5">
                  <Icone className="size-3.5 text-verde-primary" />
                  <span className="text-sm font-semibold text-gray-700">{g.caminho}</span>
                  <span className="text-[10px] text-gray-400">{ROTULO_TIPO[g.tipo]}{g.tipo !== "list" ? " · vale para as listas dentro" : ""}</span>
                </div>
                <div className="space-y-1 p-2">
                  {g.itens.map((a) => {
                    const nome = a.id_equipe ? `Equipe: ${d.nomeEquipe.get(a.id_equipe) ?? "?"}` : (d.nomePorEmail.get((a.usuario_email ?? "").toLowerCase()) ?? a.usuario_email ?? "");
                    return (
                      <div key={a.id} className="flex items-center gap-2 rounded-md px-1 py-1">
                        {a.id_equipe ? (
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-verde-light text-verde-primary"><Users className="size-4" /></span>
                        ) : (
                          <AvatarPessoa nome={nome} className="size-7 text-[10px]" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-800">{nome}</p>
                          <p className="truncate text-[11px] text-gray-400">{a.id_equipe ? "acesso herdado pelos membros da equipe" : a.usuario_email}</p>
                        </div>
                        {a.restritivo && (
                          <span title="Restritivo: é um teto — a pessoa não passa deste nível aqui, mesmo com outro acesso" className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            <ShieldAlert className="size-3" /> teto
                          </span>
                        )}
                        <SeletorNivel value={a.nivel} disabled={gravando} title={rotuloNivel(a.nivel)} onChange={(n) => mudarNivel(a, n)}
                          className="shrink-0 rounded-md border border-gray-200 px-1.5 py-1 text-xs text-gray-700 focus:outline-none disabled:opacity-50" />
                        <button type="button" disabled={gravando} title="Remover acesso" onClick={() => remover(a, g.caminho)}
                          className="flex size-7 shrink-0 items-center justify-center rounded-md text-gray-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

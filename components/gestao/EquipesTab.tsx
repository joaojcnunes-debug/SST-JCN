"use client";

import { useMemo, useState } from "react";
import { Check, Folder, LayoutGrid, List, Pencil, Plus, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { confirmar } from "@/components/ui/confirm";
import { useDefinirMembroEquipe, useExcluirEquipe, useSalvarEquipe, type PapelEquipe } from "@/lib/hooks/useGestaoAcesso";
import AvatarPessoa from "@/components/gestao/AvatarPessoa";
import SeletorNivel from "@/components/gestao/SeletorNivel";
import PessoasPicker from "@/components/gestao/acessos/PessoasPicker";
import RecursoPicker from "@/components/gestao/acessos/RecursoPicker";
import type { DadosAcessos } from "@/components/gestao/acessos/useDadosAcessos";
import type { Passo } from "@/components/gestao/acessos/useGravarAcessos";
import { lerChave, ROTULO_TIPO, type TipoRecurso } from "@/lib/gestao/acessos";
import { rotuloNivel, type GestaoNivel } from "@/lib/gestao/niveis";

const inputCls = "rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none";
const ICONE: Record<TipoRecurso, typeof List> = { space: LayoutGrid, folder: Folder, list: List };

/**
 * Aba "Equipes" do modal "Membros e acessos" (GESTAO-EQUIPES-01; v305). Uma equipe carrega
 * ACESSO (a espaços, pastas ou listas); quem entra na equipe herda e já ganha entrada no módulo.
 * Papel `supervisor` = vê o Meu Quadro dos membros da equipe (edit). Várias pessoas entram de uma
 * vez; os acessos pedem motivo na hora de confirmar.
 */
export default function EquipesTab({
  d,
  pedirMotivo,
  executar,
  gravando,
}: {
  d: DadosAcessos;
  pedirMotivo: (titulo: string, resumo?: string) => Promise<string | null>;
  executar: (passos: Passo[], motivo: string, sucesso: string) => Promise<boolean>;
  gravando: boolean;
}) {
  const salvar = useSalvarEquipe();
  const excluir = useExcluirEquipe();
  const definirMembro = useDefinirMembroEquipe();

  const [sel, setSel] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [editNome, setEditNome] = useState<string | null>(null);
  const [novas, setNovas] = useState<string[]>([]);
  const [novoPapel, setNovoPapel] = useState<PapelEquipe>("membro");
  const [novoNivel, setNovoNivel] = useState<GestaoNivel | "">("");
  const [recursos, setRecursos] = useState<Set<string>>(new Set());

  const equipe = d.equipes.find((e) => e.id === sel) ?? null;
  const membrosDa = useMemo(
    () => d.equipeMembros.filter((m) => m.id_equipe === sel).sort((a, b) => (a.papel === b.papel ? a.usuario_email.localeCompare(b.usuario_email) : a.papel === "supervisor" ? -1 : 1)),
    [d.equipeMembros, sel],
  );
  const jaNaEquipe = useMemo(() => new Set(membrosDa.map((m) => m.usuario_email.toLowerCase())), [membrosDa]);
  const acessosDa = useMemo(() => d.acessos.filter((a) => a.id_equipe === sel && a.recurso_tipo && a.recurso_tipo !== "task"), [d.acessos, sel]);
  const contagem = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of d.equipeMembros) m.set(x.id_equipe, (m.get(x.id_equipe) ?? 0) + 1);
    return m;
  }, [d.equipeMembros]);
  const opcoesPessoas = useMemo(() => d.usuarios.map((u) => ({ email: u.email, nome: u.nome, perfil: u.perfil })), [d.usuarios]);
  const pendente = salvar.isPending || excluir.isPending || definirMembro.isPending || gravando;

  async function criar() {
    const nome = novoNome.trim();
    if (nome.length < 2) return;
    const id = await salvar.mutateAsync({ nome });
    setNovoNome("");
    if (id) setSel(id);
  }

  async function adicionarPessoas() {
    if (!equipe || !novas.length) return;
    // entrar na equipe não tem motivo no banco (gestao_equipe_definir_membro); já libera o módulo
    const passos: Passo[] = novas.map((email) => ({ op: "entrar_equipe", id_equipe: equipe.id, email, papel: novoPapel }));
    if (await executar(passos, "entrada na equipe", `${novas.length} pessoa(s) na equipe ${equipe.nome}`)) setNovas([]);
  }

  async function conceder() {
    if (!equipe || !recursos.size || !novoNivel) return;
    const motivo = await pedirMotivo("Dar acesso à equipe", `${equipe.nome} × ${recursos.size} recurso(s) — ${rotuloNivel(novoNivel)}`);
    if (!motivo) return;
    const passos: Passo[] = [...recursos].map((k) => ({ op: "equipe", id_equipe: equipe.id, ...lerChave(k), nivel: novoNivel }));
    if (await executar(passos, motivo, `Equipe com acesso a ${recursos.size} recurso(s)`)) {
      setRecursos(new Set());
      setNovoNivel("");
    }
  }

  async function mudarNivel(a: (typeof d.acessos)[number], n: GestaoNivel) {
    if (!equipe) return;
    const motivo = await pedirMotivo("Alterar nível da equipe", `${equipe.nome}: ${rotuloNivel(a.nivel)} → ${rotuloNivel(n)}`);
    if (!motivo) return;
    await executar([{ op: "equipe", id_equipe: equipe.id, tipo: a.recurso_tipo as TipoRecurso, id: a.recurso_id!, nivel: n }], motivo, "Nível alterado");
  }

  async function removerAcesso(a: (typeof d.acessos)[number], caminho: string) {
    if (!equipe) return;
    const motivo = await pedirMotivo("Remover acesso da equipe", `${equipe.nome} perde o acesso a ${caminho}.`);
    if (!motivo) return;
    await executar([{ op: "equipe", id_equipe: equipe.id, tipo: a.recurso_tipo as TipoRecurso, id: a.recurso_id!, nivel: null }], motivo, "Acesso removido");
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[200px_1fr]">
      {/* Lista de equipes */}
      <div className="space-y-1">
        <div className="flex gap-1">
          <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") criar(); }} placeholder="Nova equipe…" className={`${inputCls} min-w-0 flex-1`} />
          <button type="button" onClick={criar} disabled={novoNome.trim().length < 2 || pendente} title="Criar equipe" className="rounded-md bg-verde-primary px-2 text-white hover:bg-verde-accent disabled:opacity-50"><Plus className="size-4" /></button>
        </div>
        <div className="max-h-[26rem] space-y-0.5 overflow-auto">
          {d.equipes.map((e) => (
            <button key={e.id} type="button" onClick={() => setSel(e.id)} className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${sel === e.id ? "bg-verde-light text-verde-primary" : "text-gray-700 hover:bg-gray-50"} ${e.ativo ? "" : "opacity-50"}`}>
              <Users className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{e.nome}</span>
              <span className="text-[11px] text-gray-400">{contagem.get(e.id) ?? 0}</span>
            </button>
          ))}
          {d.equipes.length === 0 && <p className="px-2 py-3 text-xs text-gray-400">Nenhuma equipe ainda.</p>}
        </div>
      </div>

      {/* Detalhe da equipe */}
      {!equipe ? (
        <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">Escolha ou crie uma equipe. Quem entra numa equipe herda os acessos dela e já entra na Gestão.</div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {editNome !== null ? (
              <>
                <input autoFocus value={editNome} onChange={(e) => setEditNome(e.target.value)} className={`${inputCls} flex-1`} />
                <button type="button" onClick={async () => { await salvar.mutateAsync({ id: equipe.id, nome: editNome, descricao: equipe.descricao, ativo: equipe.ativo }); setEditNome(null); }} className="rounded-md p-1 text-verde-primary hover:bg-verde-light"><Check className="size-4" /></button>
                <button type="button" onClick={() => setEditNome(null)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><X className="size-4" /></button>
              </>
            ) : (
              <>
                <p className="flex-1 text-sm font-semibold text-gray-800">{equipe.nome} {!equipe.ativo && <span className="text-[11px] font-normal text-gray-400">(inativa)</span>}</p>
                <button type="button" onClick={() => setEditNome(equipe.nome)} title="Renomear" className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><Pencil className="size-4" /></button>
                <button type="button" onClick={() => salvar.mutate({ id: equipe.id, nome: equipe.nome, descricao: equipe.descricao, ativo: !equipe.ativo })} className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">{equipe.ativo ? "Desativar" : "Ativar"}</button>
                <button type="button" onClick={async () => { if (await confirmar({ title: `Excluir a equipe "${equipe.nome}"?`, description: "Os membros perdem o acesso herdado da equipe (o acesso ao módulo fica).", variant: "danger" })) { excluir.mutate(equipe.id); setSel(null); } }} title="Excluir" className="rounded-md p-1 text-gray-300 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button>
              </>
            )}
          </div>

          {/* Membros */}
          <div className="rounded-lg border border-gray-100">
            <div className="border-b border-gray-100 bg-gray-50/70 px-3 py-1.5 text-xs font-semibold text-gray-700">Membros ({membrosDa.length})</div>
            <div className="space-y-1 p-2">
              {membrosDa.map((m) => {
                const nome = d.nomePorEmail.get(m.usuario_email.toLowerCase()) ?? m.usuario_email;
                return (
                  <div key={m.id} className="flex items-center gap-2 rounded-md px-1 py-1">
                    <AvatarPessoa nome={nome} className="size-7 text-[10px]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800">{nome}</p>
                      <p className="truncate text-[11px] text-gray-400">{m.usuario_email}</p>
                    </div>
                    <select value={m.papel} disabled={pendente} onChange={(e) => definirMembro.mutate({ id_equipe: equipe.id, email: m.usuario_email, papel: e.target.value as PapelEquipe, ativo: true })} className="rounded-md border border-gray-200 px-1.5 py-1 text-xs text-gray-700 focus:outline-none disabled:opacity-50">
                      <option value="membro">Membro</option>
                      <option value="supervisor">Supervisor</option>
                    </select>
                    <button type="button" disabled={pendente} title="Remover da equipe" onClick={() => definirMembro.mutate({ id_equipe: equipe.id, email: m.usuario_email, papel: m.papel, ativo: false })} className="flex size-7 shrink-0 items-center justify-center rounded-md text-gray-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><Trash2 className="size-4" /></button>
                  </div>
                );
              })}
              <div className="mt-1 space-y-1.5 rounded-md border border-dashed border-gray-300 p-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Adicionar pessoas</p>
                <PessoasPicker pessoas={opcoesPessoas} value={novas} onChange={setNovas} excluir={jaNaEquipe} />
                <div className="flex items-center justify-end gap-2">
                  <select value={novoPapel} onChange={(e) => setNovoPapel(e.target.value as PapelEquipe)} className={inputCls}>
                    <option value="membro">Membro</option>
                    <option value="supervisor">Supervisor</option>
                  </select>
                  <button type="button" onClick={adicionarPessoas} disabled={!novas.length || pendente} className="rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50">
                    Adicionar {novas.length ? `(${novas.length})` : ""}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Acessos da equipe */}
          <div className="rounded-lg border border-gray-100">
            <div className="border-b border-gray-100 bg-gray-50/70 px-3 py-1.5 text-xs font-semibold text-gray-700">Acessos da equipe ({acessosDa.length})</div>
            <div className="space-y-1 p-2">
              {acessosDa.map((a) => {
                const r = d.recursoDe(a.recurso_tipo, a.recurso_id);
                const Icone = ICONE[a.recurso_tipo as TipoRecurso] ?? List;
                return (
                  <div key={a.id} className="flex items-center gap-2 rounded-md px-1 py-1">
                    <Icone className="size-3.5 shrink-0 text-verde-primary" />
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-800" title={r.caminho}>
                      {r.caminho} <span className="text-[10px] text-gray-400">{ROTULO_TIPO[a.recurso_tipo as TipoRecurso]}</span>
                    </span>
                    <SeletorNivel value={a.nivel} disabled={pendente} title={rotuloNivel(a.nivel)} onChange={(n) => mudarNivel(a, n)} className="rounded-md border border-gray-200 px-1.5 py-1 text-xs text-gray-700 focus:outline-none disabled:opacity-50" />
                    <button type="button" disabled={pendente} title="Remover acesso" onClick={() => removerAcesso(a, r.caminho)} className="flex size-7 shrink-0 items-center justify-center rounded-md text-gray-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><Trash2 className="size-4" /></button>
                  </div>
                );
              })}
              <div className="mt-1 space-y-1.5 rounded-md border border-dashed border-gray-300 p-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Dar acesso ({recursos.size})</p>
                <RecursoPicker arvore={d.arvore} value={recursos} onChange={setRecursos} altura="max-h-44" />
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <SeletorNivel value={novoNivel} onChange={setNovoNivel} className={inputCls} />
                  <button type="button" onClick={conceder} disabled={!recursos.size || !novoNivel || pendente} className="rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50">Conceder à equipe</button>
                </div>
              </div>
            </div>
          </div>
          <p className="flex items-center gap-1 text-[11px] text-gray-400"><ShieldCheck className="size-3.5" /> Supervisor vê o Meu Quadro dos membros desta equipe (e edita). Acessos pedem motivo e ficam no histórico.</p>
        </div>
      )}
    </div>
  );
}

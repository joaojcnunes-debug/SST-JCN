"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Users, ShieldCheck, X, Pencil, Check } from "lucide-react";
import toast from "react-hot-toast";
import { confirmar } from "@/components/ui/confirm";
import { iniciais, corAvatar, useQuadros, useAcessosGestao } from "@/lib/hooks/useGestao";
import {
  useEquipes, useEquipeMembros, useSalvarEquipe, useExcluirEquipe, useDefinirMembroEquipe, useAlterarAcessoEquipe,
  useUsuariosParaMembro, type GestaoNivel, type PapelEquipe,
} from "@/lib/hooks/useGestaoAcesso";

const NIVEIS: { value: GestaoNivel; label: string }[] = [
  { value: "full", label: "Visualizador total (vê todas as tarefas)" },
  { value: "view", label: "Vinculado (vê só as tarefas dele)" },
  { value: "comment", label: "Pode comentar" },
  { value: "edit", label: "Pode editar" },
];
const inputCls = "rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none";

/**
 * Aba "Equipes" do modal "Membros e acessos" (GESTAO-EQUIPES-01). Uma equipe carrega ACESSO a
 * quadros (grant por equipe, resolvido pelo banco); quem entra na equipe herda os quadros e já
 * ganha entrada no módulo. Papel `supervisor` = vê o Meu Quadro dos membros da equipe (edit).
 * Toda escrita passa pelos RPCs gestor-only (gestao_equipe_*); motivo obrigatório nos grants.
 */
export default function EquipesTab({ motivo, motivoOk }: { motivo: string; motivoOk: boolean }) {
  const { data: equipes = [] } = useEquipes();
  const { data: membros = [] } = useEquipeMembros();
  const { data: usuarios = [] } = useUsuariosParaMembro();
  const { data: quadros = [] } = useQuadros();
  const { data: acessos = [] } = useAcessosGestao();
  const salvar = useSalvarEquipe();
  const excluir = useExcluirEquipe();
  const definirMembro = useDefinirMembroEquipe();
  const alterarAcesso = useAlterarAcessoEquipe();

  const [sel, setSel] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [editNome, setEditNome] = useState<string | null>(null);
  const [buscaUsuario, setBuscaUsuario] = useState("");
  const [novoPapel, setNovoPapel] = useState<PapelEquipe>("membro");
  const [novoNivel, setNovoNivel] = useState<GestaoNivel>("full");
  const [novoQuadros, setNovoQuadros] = useState<Set<string>>(new Set());

  const equipe = equipes.find((e) => e.id === sel) ?? null;
  const nomePorEmail = useMemo(() => new Map(usuarios.map((u) => [u.email.toLowerCase(), u.nome])), [usuarios]);
  const nomeQuadro = useMemo(() => new Map(quadros.filter((q) => !q.dono_email).map((q) => [q.id_quadro, q.nome])), [quadros]);
  const membrosDa = useMemo(() => membros.filter((m) => m.id_equipe === sel).sort((a, b) => (a.papel === b.papel ? a.usuario_email.localeCompare(b.usuario_email) : a.papel === "supervisor" ? -1 : 1)), [membros, sel]);
  const acessosDa = useMemo(() => acessos.filter((a) => a.id_equipe === sel), [acessos, sel]);
  const contagem = useMemo(() => { const m = new Map<string, number>(); for (const x of membros) m.set(x.id_equipe, (m.get(x.id_equipe) ?? 0) + 1); return m; }, [membros]);
  const candidatos = useMemo(() => {
    const ja = new Set(membrosDa.map((m) => m.usuario_email.toLowerCase()));
    const q = buscaUsuario.trim().toLowerCase();
    return usuarios.filter((u) => !ja.has(u.email.toLowerCase()) && (!q || u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))).slice(0, 8);
  }, [usuarios, membrosDa, buscaUsuario]);

  async function criar() {
    const nome = novoNome.trim();
    if (nome.length < 2) return;
    const id = await salvar.mutateAsync({ nome });
    setNovoNome(""); if (id) setSel(id);
  }
  async function conceder() {
    if (!equipe || novoQuadros.size === 0 || !motivoOk) return;
    for (const q of novoQuadros) await alterarAcesso.mutateAsync({ id_equipe: equipe.id, recursoTipo: "list", recursoId: q, nivel: novoNivel, motivo: motivo.trim() });
    toast.success(`Equipe com acesso a ${novoQuadros.size} quadro${novoQuadros.size > 1 ? "s" : ""}`);
    setNovoQuadros(new Set());
  }
  const pendente = salvar.isPending || excluir.isPending || definirMembro.isPending || alterarAcesso.isPending;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[200px_1fr]">
      {/* Lista de equipes */}
      <div className="space-y-1">
        <div className="flex gap-1">
          <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") criar(); }} placeholder="Nova equipe…" className={`${inputCls} min-w-0 flex-1`} />
          <button type="button" onClick={criar} disabled={novoNome.trim().length < 2 || pendente} title="Criar equipe" className="rounded-md bg-verde-primary px-2 text-white hover:bg-verde-accent disabled:opacity-50"><Plus className="size-4" /></button>
        </div>
        <div className="max-h-[22rem] space-y-0.5 overflow-auto">
          {equipes.map((e) => (
            <button key={e.id} type="button" onClick={() => setSel(e.id)} className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${sel === e.id ? "bg-verde-light text-verde-primary" : "text-gray-700 hover:bg-gray-50"} ${e.ativo ? "" : "opacity-50"}`}>
              <Users className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{e.nome}</span>
              <span className="text-[11px] text-gray-400">{contagem.get(e.id) ?? 0}</span>
            </button>
          ))}
          {equipes.length === 0 && <p className="px-2 py-3 text-xs text-gray-400">Nenhuma equipe ainda.</p>}
        </div>
      </div>

      {/* Detalhe da equipe */}
      {!equipe ? (
        <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">Escolha ou crie uma equipe. Quem entra numa equipe herda os quadros dela e já entra na Gestão.</div>
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
                <button type="button" onClick={async () => { if (await confirmar({ title: `Excluir a equipe "${equipe.nome}"?`, description: "Os membros perdem o acesso herdado dos quadros da equipe (o acesso ao módulo fica)." , variant: "danger" })) { excluir.mutate(equipe.id); setSel(null); } }} title="Excluir" className="rounded-md p-1 text-gray-300 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button>
              </>
            )}
          </div>

          {/* Membros */}
          <div className="rounded-lg border border-gray-100">
            <div className="border-b border-gray-100 bg-gray-50/70 px-3 py-1.5 text-xs font-semibold text-gray-700">Membros ({membrosDa.length})</div>
            <div className="space-y-1 p-2">
              {membrosDa.map((m) => {
                const nome = nomePorEmail.get(m.usuario_email.toLowerCase()) ?? m.usuario_email;
                return (
                  <div key={m.id} className="flex items-center gap-2 rounded-md px-1 py-1">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: corAvatar(nome) }}>{iniciais(nome)}</span>
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
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <input value={buscaUsuario} onChange={(e) => setBuscaUsuario(e.target.value)} placeholder="Adicionar pessoa (nome ou e-mail)…" className={`${inputCls} min-w-[200px] flex-1`} />
                <select value={novoPapel} onChange={(e) => setNovoPapel(e.target.value as PapelEquipe)} className={inputCls}>
                  <option value="membro">Membro</option>
                  <option value="supervisor">Supervisor</option>
                </select>
              </div>
              {buscaUsuario.trim() && (
                <div className="max-h-40 overflow-auto rounded-md border border-gray-200 bg-white">
                  {candidatos.map((u) => (
                    <button key={u.email} type="button" disabled={pendente} onClick={() => { definirMembro.mutate({ id_equipe: equipe.id, email: u.email, papel: novoPapel, ativo: true }); setBuscaUsuario(""); }} className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-gray-50">
                      <span className="flex-1 truncate">{u.nome} <span className="text-[11px] text-gray-400">{u.email}</span></span>
                      <span className="text-[11px] text-gray-400">{u.perfil}</span>
                    </button>
                  ))}
                  {candidatos.length === 0 && <p className="px-2 py-2 text-xs text-gray-400">Ninguém encontrado (ou já é da equipe).</p>}
                </div>
              )}
            </div>
          </div>

          {/* Quadros da equipe */}
          <div className="rounded-lg border border-gray-100">
            <div className="border-b border-gray-100 bg-gray-50/70 px-3 py-1.5 text-xs font-semibold text-gray-700">Quadros da equipe ({acessosDa.length})</div>
            <div className="space-y-1 p-2">
              {acessosDa.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-md px-1 py-1">
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{nomeQuadro.get(a.id_quadro) ?? a.id_quadro}</span>
                  <select value={a.nivel} disabled={!motivoOk || pendente} title={!motivoOk ? "Preencha o motivo" : "Alterar nível"} onChange={(e) => alterarAcesso.mutate({ id_equipe: equipe.id, recursoTipo: "list", recursoId: a.id_quadro, nivel: e.target.value as GestaoNivel, motivo: motivo.trim() })} className="rounded-md border border-gray-200 px-1.5 py-1 text-xs text-gray-700 focus:outline-none disabled:opacity-50">
                    {NIVEIS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
                  </select>
                  <button type="button" disabled={!motivoOk || pendente} title={!motivoOk ? "Preencha o motivo" : "Remover acesso"} onClick={() => alterarAcesso.mutate({ id_equipe: equipe.id, recursoTipo: "list", recursoId: a.id_quadro, nivel: null, motivo: motivo.trim() })} className="flex size-7 shrink-0 items-center justify-center rounded-md text-gray-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><Trash2 className="size-4" /></button>
                </div>
              ))}
              <div className="mt-1 rounded-md border border-dashed border-gray-300 p-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Dar acesso a quadros ({novoQuadros.size})</span>
                  <span className="flex gap-2">
                    <button type="button" onClick={() => setNovoQuadros(new Set([...nomeQuadro.keys()]))} className="text-[11px] text-verde-primary hover:underline">Todos</button>
                    <button type="button" onClick={() => setNovoQuadros(new Set())} className="text-[11px] text-gray-400 hover:underline">Limpar</button>
                  </span>
                </div>
                <div className="flex max-h-28 flex-wrap gap-1.5 overflow-auto">
                  {[...nomeQuadro.entries()].map(([id, nome]) => {
                    const on = novoQuadros.has(id);
                    return <button key={id} type="button" onClick={() => setNovoQuadros((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; })} className={`rounded-full border px-2.5 py-1 text-xs transition ${on ? "border-verde-primary bg-verde-light font-medium text-verde-primary" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>{nome}</button>;
                  })}
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                  <select value={novoNivel} onChange={(e) => setNovoNivel(e.target.value as GestaoNivel)} className={inputCls}>
                    {NIVEIS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
                  </select>
                  <button type="button" onClick={conceder} disabled={novoQuadros.size === 0 || !motivoOk || pendente} title={!motivoOk ? "Preencha o motivo" : ""} className="rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50">Conceder à equipe</button>
                </div>
              </div>
            </div>
          </div>
          <p className="flex items-center gap-1 text-[11px] text-gray-400"><ShieldCheck className="size-3.5" /> Supervisor vê o Meu Quadro dos membros desta equipe (e edita). Grants exigem motivo e ficam registrados.</p>
        </div>
      )}
    </div>
  );
}

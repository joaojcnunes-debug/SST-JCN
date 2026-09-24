"use client";

import { useMemo, useState } from "react";
import { Trash2, UserPlus, ShieldCheck, Users } from "lucide-react";
import EquipesTab from "@/components/gestao/EquipesTab";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { confirmar } from "@/components/ui/confirm";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  iniciais,
  corAvatar,
  useQuadros,
  useAcessosGestao,
} from "@/lib/hooks/useGestao";
import {
  useGestaoMembros,
  useUsuariosParaMembro,
  useAlterarAcesso,
  useEquipes,
  useAlterarAcessoEquipe,
  type GestaoNivel,
} from "@/lib/hooks/useGestaoAcesso";

// Níveis do resolver v117, rotulados por VISIBILIDADE de tarefa (camada v197):
// `full` = vê TODAS as tarefas do quadro; `view` = vê o quadro mas só as tarefas em que
// está vinculado. comment/edit são avançados.
const NIVEIS: { value: GestaoNivel; label: string }[] = [
  { value: "full", label: "Visualizador total (vê todas as tarefas)" },
  { value: "view", label: "Vinculado (vê só as tarefas dele)" },
  { value: "comment", label: "Pode comentar" },
  { value: "edit", label: "Pode editar" },
];

// RPC direto (tipado à parte) para conceder em vários quadros numa ação só — 1 toast.
type GestaoRpc = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }> };

/**
 * Membros e acessos da Gestão — lugar único (v227+): concede acesso a QUADRO por
 * `[usuário] [nível] [quadros/unidades]` (seleção múltipla) e, na mesma ação, LIBERA o
 * módulo (roster) p/ quem ainda não é membro. A lista é agrupada POR QUADRO — cada quadro
 * mostra suas próprias regras, com nível ajustável e remoção por linha. owner/admin
 * (perfil Admin) veem tudo e não precisam de acesso por quadro. Toda mudança exige motivo
 * (≥5) e passa pelos RPCs logados (`gestao_alterar_acesso` / `gestao_definir_membro`).
 */
export default function MembrosModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: membros = [] } = useGestaoMembros();
  const { data: usuarios = [] } = useUsuariosParaMembro(); // email, nome, perfil (não-Cliente)
  const { data: quadros = [] } = useQuadros();
  const { data: acessos = [] } = useAcessosGestao(); // grants list-level de todos os quadros (pessoas E equipes)
  const { data: equipes = [] } = useEquipes();
  const alterar = useAlterarAcesso();
  const alterarEquipe = useAlterarAcessoEquipe();
  const [aba, setAba] = useState<"pessoas" | "equipes">("pessoas");

  const [motivo, setMotivo] = useState("");
  const motivoOk = motivo.trim().length >= 5;

  const [novoEmail, setNovoEmail] = useState("");
  const [novoNivel, setNovoNivel] = useState<GestaoNivel>("full");
  const [novoQuadros, setNovoQuadros] = useState<Set<string>>(new Set());
  const [concedendo, setConcedendo] = useState(false);

  const nomePorEmail = useMemo(() => new Map(usuarios.map((u) => [u.email.toLowerCase(), u.nome])), [usuarios]);
  const perfilPorEmail = useMemo(() => new Map(usuarios.map((u) => [u.email.toLowerCase(), u.perfil])), [usuarios]);
  // Quadros pessoais (Meu Quadro) não entram aqui: o acesso deles é por dono/supervisor, não por grant.
  const nomeQuadro = useMemo(() => new Map(quadros.filter((q) => !q.dono_email).map((q) => [q.id_quadro, q.nome])), [quadros]);
  const nomeEquipe = useMemo(() => new Map(equipes.map((e) => [e.id, e.nome])), [equipes]);
  const membrosAtivos = useMemo(
    () => new Set(membros.filter((m) => m.ativo).map((m) => m.usuario_email.toLowerCase())),
    [membros],
  );

  // Lista AGRUPADA por quadro: cada quadro com seus membros (regra própria). Linhas de EQUIPE
  // (v235, usuario_email null) aparecem como "Equipe: X" e são geridas pelo RPC da equipe.
  const porQuadro = useMemo(() => {
    const map = new Map<string, { quadroNome: string; itens: { id: string; usuario_email: string; id_equipe: string | null; nivel: GestaoNivel; nome: string }[] }>();
    for (const a of acessos) {
      const qn = nomeQuadro.get(a.id_quadro) ?? a.id_quadro;
      if (!map.has(a.id_quadro)) map.set(a.id_quadro, { quadroNome: qn, itens: [] });
      const email = a.usuario_email ?? "";
      map.get(a.id_quadro)!.itens.push({
        id: a.id,
        usuario_email: email,
        id_equipe: a.id_equipe ?? null,
        nivel: a.nivel,
        nome: a.id_equipe ? `Equipe: ${nomeEquipe.get(a.id_equipe) ?? "?"}` : (nomePorEmail.get(email.toLowerCase()) ?? email),
      });
    }
    return [...map.entries()]
      .map(([id_quadro, v]) => ({ id_quadro, ...v, itens: v.itens.sort((x, y) => x.nome.localeCompare(y.nome)) }))
      .sort((x, y) => x.quadroNome.localeCompare(y.quadroNome));
  }, [acessos, nomeQuadro, nomePorEmail, nomeEquipe]);

  function toggleQuadro(id: string) {
    setNovoQuadros((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function conceder() {
    if (!novoEmail || novoQuadros.size === 0 || !motivoOk || concedendo) return;
    setConcedendo(true);
    const emailLc = novoEmail.toLowerCase();
    const ehAdmin = perfilPorEmail.get(emailLc) === "Admin";
    const sb = createSupabaseBrowserClient() as unknown as GestaoRpc;
    try {
      // 1) Libera o módulo (roster) uma vez, se não for Admin nem já-membro (nunca rebaixa gestor).
      if (!ehAdmin && !membrosAtivos.has(emailLc)) {
        const { error } = await sb.rpc("gestao_definir_membro", { p_alvo: novoEmail, p_papel: "membro", p_ativo: true, p_motivo: motivo.trim() });
        if (error) throw new Error(error.message);
      }
      // 2) Concede em cada quadro selecionado.
      for (const q of novoQuadros) {
        const { error } = await sb.rpc("gestao_alterar_acesso", { p_alvo: novoEmail, p_acao: "concedeu", p_recurso_tipo: "list", p_recurso_id: q, p_nivel_novo: novoNivel, p_motivo: motivo.trim() });
        if (error) throw new Error(error.message);
      }
      toast.success(`Acesso concedido em ${novoQuadros.size} quadro${novoQuadros.size > 1 ? "s" : ""}`);
      setNovoEmail("");
      setNovoQuadros(new Set());
      // Reidrata os mesmos caches que os hooks invalidariam.
      qc.invalidateQueries({ queryKey: ["gestao-acessos"] });
      qc.invalidateQueries({ queryKey: ["gestao-meu-nivel"] });
      qc.invalidateQueries({ queryKey: ["gestao-meus-acessos"] });
      qc.invalidateQueries({ queryKey: ["gestao-membros"] });
      qc.invalidateQueries({ queryKey: ["gestao-meu-papel"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível conceder o acesso.");
    } finally {
      setConcedendo(false);
    }
  }

  function mudarNivel(it: { usuario_email: string; id_equipe: string | null }, quadro: string, nivel: GestaoNivel) {
    if (!motivoOk) return;
    if (it.id_equipe) alterarEquipe.mutate({ id_equipe: it.id_equipe, recursoTipo: "list", recursoId: quadro, nivel, motivo: motivo.trim() });
    else alterar.mutate({ alvo: it.usuario_email, acao: "concedeu", recursoTipo: "list", recursoId: quadro, nivel, motivo: motivo.trim() });
  }

  async function remover(it: { usuario_email: string; id_equipe: string | null }, quadro: string, nome: string) {
    if (!motivoOk) return;
    if (await confirmar({ title: "Remover acesso ao quadro?", description: `${nome} — ${nomeQuadro.get(quadro) ?? quadro}` })) {
      if (it.id_equipe) alterarEquipe.mutate({ id_equipe: it.id_equipe, recursoTipo: "list", recursoId: quadro, nivel: null, motivo: motivo.trim() });
      else alterar.mutate({ alvo: it.usuario_email, acao: "revogou", recursoTipo: "list", recursoId: quadro, nivel: "view", motivo: motivo.trim() });
    }
  }

  const pendente = concedendo || alterar.isPending || alterarEquipe.isPending;

  return (
    <Modal open={open} onClose={onClose} title="Membros e acessos da Gestão" size="lg">
      <div className="space-y-4">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm font-medium">
          <button type="button" onClick={() => setAba("pessoas")} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 ${aba === "pessoas" ? "bg-verde-primary text-white" : "text-gray-500 hover:bg-gray-100"}`}><UserPlus className="size-4" /> Pessoas</button>
          <button type="button" onClick={() => setAba("equipes")} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 ${aba === "equipes" ? "bg-verde-primary text-white" : "text-gray-500 hover:bg-gray-100"}`}><Users className="size-4" /> Equipes</button>
        </div>
        <p className="text-xs text-gray-500">
          {aba === "pessoas" ? (
            <>Escolha <strong>quem</strong>, o <strong>nível</strong> e um ou mais <strong>quadros (unidades)</strong> — concede em todos de uma vez e já libera o módulo para a pessoa. Cada quadro mantém a sua própria regra abaixo. Toda alteração exige um <strong>motivo</strong> e fica registrada.</>
          ) : (
            <>Uma <strong>equipe</strong> carrega o acesso aos quadros: quem entra nela herda os quadros e já entra na Gestão. Marque <strong>supervisores</strong> para verem o Meu Quadro dos membros. Grants exigem <strong>motivo</strong>.</>
          )}
        </p>

        {/* Motivo (obrigatório para qualquer ação — entra no log LGPD) */}
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-gray-500">Motivo da alteração *</label>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: supervisor das unidades da Região Serrana"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          />
          {!motivoOk && motivo.length > 0 && <p className="mt-0.5 text-[11px] text-amber-600">Mínimo 5 caracteres.</p>}
        </div>

        {aba === "equipes" ? <EquipesTab motivo={motivo} motivoOk={motivoOk} /> : (<>
        {/* Conceder acesso: usuário + nível + N quadros */}
        <div className="rounded-lg border border-dashed border-gray-300 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700"><UserPlus className="size-3.5" /> Dar acesso a quadros</p>
          <div className="flex flex-wrap items-center gap-2">
            <select value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} className="min-w-[180px] flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none">
              <option value="">Selecione o usuário…</option>
              {usuarios.map((u) => <option key={u.email} value={u.email}>{u.nome} ({u.email})</option>)}
            </select>
            <select value={novoNivel} onChange={(e) => setNovoNivel(e.target.value as GestaoNivel)} className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none">
              {NIVEIS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
            </select>
          </div>

          {/* Multi-seleção de quadros */}
          <div className="mt-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Quadros / unidades ({novoQuadros.size} selecionado{novoQuadros.size === 1 ? "" : "s"})</span>
              <span className="flex gap-2">
                <button type="button" onClick={() => setNovoQuadros(new Set(quadros.filter((q) => !q.dono_email).map((q) => q.id_quadro)))} className="text-[11px] text-verde-primary hover:underline">Todos</button>
                <button type="button" onClick={() => setNovoQuadros(new Set())} className="text-[11px] text-gray-400 hover:underline">Limpar</button>
              </span>
            </div>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-auto rounded-md border border-gray-200 bg-white p-2">
              {quadros.filter((q) => !q.dono_email).map((q) => {
                const on = novoQuadros.has(q.id_quadro);
                return (
                  <button
                    key={q.id_quadro}
                    type="button"
                    onClick={() => toggleQuadro(q.id_quadro)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${on ? "border-verde-primary bg-verde-light font-medium text-verde-primary" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
                  >
                    {q.nome}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex justify-end">
            <button type="button" onClick={conceder} disabled={!novoEmail || novoQuadros.size === 0 || !motivoOk || pendente}
              className="rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50">
              Conceder acesso
            </button>
          </div>
        </div>

        {/* Regras POR QUADRO */}
        <div className="max-h-[22rem] space-y-3 overflow-auto">
          {porQuadro.length === 0 && <p className="py-4 text-center text-sm text-gray-400">Nenhum quadro tem acesso concedido ainda.</p>}
          {porQuadro.map((g) => (
            <div key={g.id_quadro} className="rounded-lg border border-gray-100">
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-3 py-1.5">
                <span className="text-sm font-semibold text-gray-700">{g.quadroNome}</span>
                <span className="text-[11px] text-gray-400">{g.itens.length} pessoa{g.itens.length === 1 ? "" : "s"}</span>
              </div>
              <div className="space-y-1 p-2">
                {g.itens.map((it) => (
                  <div key={it.id} className="flex items-center gap-2 rounded-md px-1 py-1">
                    {it.id_equipe ? (
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-verde-light text-verde-primary"><Users className="size-4" /></span>
                    ) : (
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: corAvatar(it.nome) }}>{iniciais(it.nome)}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800">{it.nome}</p>
                      <p className="truncate text-[11px] text-gray-400">{it.id_equipe ? "acesso herdado pelos membros da equipe" : it.usuario_email}</p>
                    </div>
                    <select
                      value={it.nivel}
                      disabled={!motivoOk || pendente}
                      title={!motivoOk ? "Preencha o motivo" : "Alterar nível"}
                      onChange={(e) => mudarNivel(it, g.id_quadro, e.target.value as GestaoNivel)}
                      className="shrink-0 rounded-md border border-gray-200 px-1.5 py-1 text-xs text-gray-700 focus:outline-none disabled:opacity-50"
                    >
                      {NIVEIS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
                    </select>
                    <button type="button" disabled={!motivoOk || pendente}
                      title={!motivoOk ? "Preencha o motivo" : "Remover acesso"}
                      onClick={() => remover(it, g.id_quadro, it.nome)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-gray-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="flex items-center gap-1 text-[11px] text-gray-400"><ShieldCheck className="size-3.5" /> Administradores (perfil Admin) veem tudo e não precisam de acesso por quadro. Alterações ficam registradas.</p>
        </>)}
      </div>
    </Modal>
  );
}

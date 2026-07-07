"use client";

import { useMemo, useState } from "react";
import { Lock, Globe, Trash2, UserPlus, ShieldCheck } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { confirmar } from "@/components/ui/confirm";
import {
  useAcessosQuadro, useToggleRestrito, useUsuarios,
  iniciais, corAvatar, type GestaoQuadro,
} from "@/lib/hooks/useGestao";
import { useAlterarAcesso, type GestaoNivel } from "@/lib/hooks/useGestaoAcesso";

export default function CompartilharModal({
  open, onClose, quadro, podeEditar,
}: {
  open: boolean;
  onClose: () => void;
  quadro: GestaoQuadro;
  podeEditar: boolean;
}) {
  const { data: acessos = [] } = useAcessosQuadro(quadro.restrito ? quadro.id_quadro : null);
  const { data: usuarios = [] } = useUsuarios();
  const alterar = useAlterarAcesso();
  const toggle = useToggleRestrito();

  const [novoEmail, setNovoEmail] = useState("");
  const [novoPapel, setNovoPapel] = useState<"viewer" | "editor">("viewer");
  const [motivo, setMotivo] = useState("");
  const motivoOk = motivo.trim().length >= 5;

  const emailsComAcesso = useMemo(() => new Set(acessos.map((a) => a.usuario_email.toLowerCase())), [acessos]);
  const disponiveis = useMemo(() => usuarios.filter((u) => !emailsComAcesso.has(u.email.toLowerCase())), [usuarios, emailsComAcesso]);
  const nomePorEmail = useMemo(() => new Map(usuarios.map((u) => [u.email.toLowerCase(), u.nome])), [usuarios]);

  // viewer→view, editor→edit. Toda mudança passa por gestao_alterar_acesso (log + motivo).
  const nivelDe = (papel: "viewer" | "editor"): GestaoNivel => (papel === "editor" ? "edit" : "view");

  function adicionar() {
    if (!novoEmail || !motivoOk) return;
    alterar.mutate(
      { alvo: novoEmail, acao: "concedeu", recursoTipo: "list", recursoId: quadro.id_quadro, nivel: nivelDe(novoPapel), motivo: motivo.trim() },
      { onSuccess: () => { setNovoEmail(""); setMotivo(""); } },
    );
  }
  function mudarPapel(email: string, papel: "viewer" | "editor") {
    if (!motivoOk) return;
    alterar.mutate(
      { alvo: email, acao: "concedeu", recursoTipo: "list", recursoId: quadro.id_quadro, nivel: nivelDe(papel), motivo: motivo.trim() },
      { onSuccess: () => setMotivo("") },
    );
  }
  function remover(email: string) {
    if (!motivoOk) return;
    alterar.mutate(
      { alvo: email, acao: "revogou", recursoTipo: "list", recursoId: quadro.id_quadro, nivel: "view", motivo: motivo.trim() },
      { onSuccess: () => setMotivo("") },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Compartilhar lista" size="md">
      <div className="space-y-4">
        {/* Visibilidade */}
        <div className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
          <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${quadro.restrito ? "bg-amber-50 text-amber-600" : "bg-verde-light text-verde-primary"}`}>
            {quadro.restrito ? <Lock className="size-5" /> : <Globe className="size-5" />}
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800">{quadro.restrito ? "Lista restrita" : "Lista aberta"}</p>
            <p className="text-xs text-gray-500">
              {quadro.restrito
                ? "Só as pessoas abaixo veem esta lista. Edição conforme o papel."
                : "Todos os usuários internos veem. A edição segue a permissão geral do Painel."}
            </p>
          </div>
          {podeEditar && (
            <button
              type="button"
              disabled={toggle.isPending}
              onClick={async () => {
                if (quadro.restrito) {
                  if (await confirmar({ title: "Tornar lista aberta?", description: "Todos os usuários internos voltam a ver esta lista." })) toggle.mutate({ id_quadro: quadro.id_quadro, restrito: false });
                } else {
                  if (await confirmar({ title: "Restringir esta lista?", description: "Só você (como editor) e quem você adicionar verão a lista. Você não perde o acesso." })) toggle.mutate({ id_quadro: quadro.id_quadro, restrito: true });
                }
              }}
              className="shrink-0 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {quadro.restrito ? "Tornar aberta" : "Restringir"}
            </button>
          )}
        </div>

        {/* Pessoas (só quando restrita) */}
        {quadro.restrito && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Pessoas com acesso</p>

            {/* Motivo (obrigatório para conceder/alterar/remover — entra no log LGPD) */}
            {podeEditar && (
              <div className="mb-2.5">
                <input
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Motivo da alteração (ex.: entrou no projeto X) *"
                  className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
                />
                {!motivoOk && motivo.length > 0 && <p className="mt-0.5 text-[11px] text-amber-600">Mínimo 5 caracteres.</p>}
              </div>
            )}

            <ul className="space-y-1.5">
              {acessos.map((a) => {
                const nome = nomePorEmail.get(a.usuario_email.toLowerCase()) ?? a.usuario_email;
                return (
                  <li key={a.id} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/60 px-2 py-1.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: corAvatar(nome) }}>{iniciais(nome)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-gray-700">{nome}</p>
                      <p className="truncate text-[11px] text-gray-400">{a.usuario_email}</p>
                    </div>
                    {podeEditar ? (
                      <select
                        value={a.papel}
                        disabled={!motivoOk || alterar.isPending}
                        title={!motivoOk ? "Preencha o motivo para alterar" : "Alterar papel"}
                        onChange={(e) => mudarPapel(a.usuario_email, e.target.value as "viewer" | "editor")}
                        className="shrink-0 rounded-md border border-gray-200 px-1.5 py-1 text-xs text-gray-700 focus:outline-none disabled:opacity-50"
                      >
                        <option value="viewer">Pode ver</option>
                        <option value="editor">Pode editar</option>
                      </select>
                    ) : (
                      <span className="shrink-0 text-xs text-gray-500">{a.papel === "editor" ? "Pode editar" : "Pode ver"}</span>
                    )}
                    {podeEditar && (
                      <button
                        type="button"
                        disabled={!motivoOk || alterar.isPending}
                        title={!motivoOk ? "Preencha o motivo para remover" : "Remover"}
                        onClick={async () => { if (await confirmar({ title: "Remover acesso?", description: nome })) remover(a.usuario_email); }}
                        className="shrink-0 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </li>
                );
              })}
              {acessos.length === 0 && <li className="text-xs text-gray-400">Ninguém adicionado ainda.</li>}
            </ul>

            {podeEditar && (
              <div className="mt-3 flex items-center gap-2">
                <select value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none">
                  <option value="">Adicionar pessoa…</option>
                  {disponiveis.map((u) => <option key={u.email} value={u.email}>{u.nome}</option>)}
                </select>
                <select value={novoPapel} onChange={(e) => setNovoPapel(e.target.value as "viewer" | "editor")} className="shrink-0 rounded-md border border-gray-300 px-1.5 py-1.5 text-sm focus:outline-none">
                  <option value="viewer">Pode ver</option>
                  <option value="editor">Pode editar</option>
                </select>
                <button type="button" onClick={adicionar} disabled={!novoEmail || !motivoOk || alterar.isPending} title={!motivoOk ? "Preencha o motivo" : "Adicionar"} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-verde-primary px-2.5 py-1.5 text-sm font-medium text-white hover:bg-verde-dark disabled:opacity-50">
                  <UserPlus className="size-4" />
                </button>
              </div>
            )}

            <p className="mt-2 flex items-center gap-1 text-[11px] text-gray-400"><ShieldCheck className="size-3.5" /> Administradores sempre têm acesso total. Alterações ficam registradas.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

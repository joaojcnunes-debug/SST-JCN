"use client";

import { useMemo, useState } from "react";
import { Lock, Globe, Trash2, UserPlus, ShieldCheck } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { confirmar } from "@/components/ui/confirm";
import {
  useAcessosQuadro, useSalvarAcesso, useExcluirAcesso, useToggleRestrito, useUsuarios,
  iniciais, corAvatar, type GestaoQuadro,
} from "@/lib/hooks/useGestao";

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
  const salvar = useSalvarAcesso();
  const excluir = useExcluirAcesso();
  const toggle = useToggleRestrito();

  const [novoEmail, setNovoEmail] = useState("");
  const [novoPapel, setNovoPapel] = useState<"viewer" | "editor">("viewer");

  const emailsComAcesso = useMemo(() => new Set(acessos.map((a) => a.usuario_email.toLowerCase())), [acessos]);
  const disponiveis = useMemo(() => usuarios.filter((u) => !emailsComAcesso.has(u.email.toLowerCase())), [usuarios, emailsComAcesso]);
  const nomePorEmail = useMemo(() => new Map(usuarios.map((u) => [u.email.toLowerCase(), u.nome])), [usuarios]);

  function adicionar() {
    if (!novoEmail) return;
    salvar.mutate({ id_quadro: quadro.id_quadro, email: novoEmail, papel: novoPapel }, { onSuccess: () => setNovoEmail("") });
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
                      <select value={a.papel} onChange={(e) => salvar.mutate({ id_quadro: quadro.id_quadro, email: a.usuario_email, papel: e.target.value as "viewer" | "editor" })} className="shrink-0 rounded-md border border-gray-200 px-1.5 py-1 text-xs text-gray-700 focus:outline-none">
                        <option value="viewer">Pode ver</option>
                        <option value="editor">Pode editar</option>
                      </select>
                    ) : (
                      <span className="shrink-0 text-xs text-gray-500">{a.papel === "editor" ? "Pode editar" : "Pode ver"}</span>
                    )}
                    {podeEditar && (
                      <button type="button" onClick={async () => { if (await confirmar({ title: "Remover acesso?", description: nome })) excluir.mutate(a.id); }} className="shrink-0 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-600" title="Remover">
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
                <button type="button" onClick={adicionar} disabled={!novoEmail || salvar.isPending} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-verde-primary px-2.5 py-1.5 text-sm font-medium text-white hover:bg-verde-dark disabled:opacity-50">
                  <UserPlus className="size-4" />
                </button>
              </div>
            )}

            <p className="mt-2 flex items-center gap-1 text-[11px] text-gray-400"><ShieldCheck className="size-3.5" /> Administradores sempre têm acesso total.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

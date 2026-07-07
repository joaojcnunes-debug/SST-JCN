"use client";

import { useMemo, useState } from "react";
import { Crown, ShieldCheck, User, UserPlus, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { iniciais, corAvatar } from "@/lib/hooks/useGestao";
import {
  useGestaoMembros,
  useUsuariosParaMembro,
  useDefinirMembro,
  useMeuPapelGestao,
  type GestaoPapel,
  type GestaoMembro,
} from "@/lib/hooks/useGestaoAcesso";

const PAPEL_LABEL: Record<GestaoPapel, string> = { owner: "Owner", admin: "Admin", membro: "Membro" };
const PAPEL_ICON: Record<GestaoPapel, React.ReactNode> = {
  owner: <Crown className="size-3" />, admin: <ShieldCheck className="size-3" />, membro: <User className="size-3" />,
};
const PAPEL_COR: Record<GestaoPapel, string> = {
  owner: "bg-amber-100 text-amber-700", admin: "bg-blue-100 text-blue-700", membro: "bg-gray-100 text-gray-600",
};

/** Cadastro de membros da Gestão (owner/admin). Toda mudança exige motivo (≥5) e passa
 *  por gestao_definir_membro (log automático). Admin não mexe em owner. */
export default function MembrosModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: membros = [] } = useGestaoMembros();
  const { data: usuarios = [] } = useUsuariosParaMembro();
  const { data: meuPapel } = useMeuPapelGestao();
  const definir = useDefinirMembro();

  const [motivo, setMotivo] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [novoPapel, setNovoPapel] = useState<GestaoPapel>("membro");

  const souOwner = meuPapel === "owner";
  const motivoOk = motivo.trim().length >= 5;

  const ativos = useMemo(() => membros.filter((m) => m.ativo), [membros]);
  const emailsMembros = useMemo(() => new Set(ativos.map((m) => m.usuario_email.toLowerCase())), [ativos]);
  const disponiveis = useMemo(() => usuarios.filter((u) => !emailsMembros.has(u.email.toLowerCase())), [usuarios, emailsMembros]);
  const nomePorEmail = useMemo(() => new Map(usuarios.map((u) => [u.email.toLowerCase(), u.nome])), [usuarios]);
  const podeMexer = (m: GestaoMembro) => souOwner || m.papel !== "owner"; // admin não mexe em owner

  function adicionar() {
    if (!novoEmail || !motivoOk) return;
    definir.mutate({ alvo: novoEmail, papel: novoPapel, ativo: true, motivo: motivo.trim() }, { onSuccess: () => { setNovoEmail(""); setMotivo(""); } });
  }
  function aplicar(email: string, papel: GestaoPapel, ativo: boolean) {
    if (!motivoOk) return;
    definir.mutate({ alvo: email, papel, ativo, motivo: motivo.trim() }, { onSuccess: () => setMotivo("") });
  }

  return (
    <Modal open={open} onClose={onClose} title="Membros da Gestão" size="lg">
      <div className="space-y-4">
        <p className="text-xs text-gray-500">
          Owner e Admin controlam quem acessa a Gestão. Toda alteração exige um <strong>motivo</strong> e fica registrada.
        </p>

        {/* Motivo (obrigatório para qualquer ação) */}
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-gray-500">Motivo da alteração *</label>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: entrada no time comercial"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          />
          {!motivoOk && motivo.length > 0 && <p className="mt-0.5 text-[11px] text-amber-600">Mínimo 5 caracteres.</p>}
        </div>

        {/* Adicionar membro */}
        <div className="rounded-lg border border-dashed border-gray-300 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700"><UserPlus className="size-3.5" /> Adicionar membro</p>
          <div className="flex flex-wrap items-center gap-2">
            <select value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} className="min-w-[200px] flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none">
              <option value="">Selecione um usuário…</option>
              {disponiveis.map((u) => <option key={u.email} value={u.email}>{u.nome} ({u.email})</option>)}
            </select>
            <select value={novoPapel} onChange={(e) => setNovoPapel(e.target.value as GestaoPapel)} className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none">
              <option value="membro">Membro</option>
              <option value="admin">Admin</option>
              {souOwner && <option value="owner">Owner</option>}
            </select>
            <button type="button" onClick={adicionar} disabled={!novoEmail || !motivoOk || definir.isPending}
              className="rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50">
              Adicionar
            </button>
          </div>
        </div>

        {/* Lista de membros */}
        <div className="max-h-72 space-y-1.5 overflow-auto">
          {ativos.length === 0 && <p className="py-4 text-center text-sm text-gray-400">Nenhum membro.</p>}
          {ativos.map((m) => {
            const nome = nomePorEmail.get(m.usuario_email.toLowerCase()) ?? m.usuario_email;
            const mexivel = podeMexer(m);
            return (
              <div key={m.id} className="flex items-center gap-2 rounded-lg border border-gray-100 px-2 py-1.5">
                <span className="flex size-7 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: corAvatar(nome) }}>{iniciais(nome)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">{nome}</p>
                  <p className="truncate text-[11px] text-gray-400">{m.usuario_email}</p>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${PAPEL_COR[m.papel]}`}>{PAPEL_ICON[m.papel]} {PAPEL_LABEL[m.papel]}</span>
                {mexivel ? (
                  <>
                    <select value={m.papel} onChange={(e) => aplicar(m.usuario_email, e.target.value as GestaoPapel, true)} disabled={!motivoOk || definir.isPending}
                      title={!motivoOk ? "Preencha o motivo" : "Alterar papel"}
                      className="rounded-md border border-gray-300 bg-white px-1.5 py-1 text-xs focus:border-verde-primary focus:outline-none disabled:opacity-50">
                      <option value="membro">Membro</option>
                      <option value="admin">Admin</option>
                      {souOwner && <option value="owner">Owner</option>}
                    </select>
                    <button type="button" onClick={() => aplicar(m.usuario_email, m.papel, false)} disabled={!motivoOk || definir.isPending}
                      title={!motivoOk ? "Preencha o motivo" : "Remover da Gestão"}
                      className="flex size-7 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40">
                      <X className="size-4" />
                    </button>
                  </>
                ) : (
                  <span className="text-[10px] text-gray-300">—</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

"use client";

import Dica from "@/components/ui/Dica";
import { DICAS_ESCALA_SUPERVISOR } from "@/lib/dicas/escala";
import { useMemo } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import Modal from "@/components/ui/Modal";
import {
  useAtivarSupervisor,
  useContasDoPainel,
  useSalvarSupervisor,
  type SupervisorForm,
} from "@/lib/hooks/useEscalaCadastro";
import { nomeCurto } from "@/lib/escala/nomes";
import type { EscalaSupervisor } from "@/lib/escala/tipos";

/**
 * Cadastro de um supervisor pela conta do painel (regras na SupervisoresTab).
 * Saiu da aba Supervisores na 0.3.232 para o Padrão Semanal abrir o mesmo modal:
 * o João quer incluir gente direto no quadro, sem ir à Configuração.
 */

/** Formulário de um supervisor novo, com a ordem continuando a sequência. */
export function novoSupervisor(supervisores: EscalaSupervisor[]): SupervisorForm {
  const proxima = supervisores.reduce((max, s) => Math.max(max, s.ordem), 0) + 1;
  return {
    nome: "",
    nome_resumido: "",
    funcao: "",
    usuario_email: "",
    ordem: proxima,
    ativo: true,
  };
}

interface Props {
  editando: SupervisorForm | null;
  onMudar: (form: SupervisorForm | null) => void;
  /** Todos os supervisores, ativos e inativos. */
  supervisores: EscalaSupervisor[];
  /**
   * Lista os inativos com "Trazer de volta" no modal de novo. No Padrão Semanal o
   * inativo não aparece na grade, e a conta dele não está na lista (já é usada),
   * então sem isto não haveria como trazê-lo de lá.
   */
  oferecerReativar?: boolean;
}

export default function SupervisorModal({
  editando,
  onMudar,
  supervisores,
  oferecerReativar = false,
}: Props) {
  const { data: contas = [] } = useContasDoPainel();
  const salvar = useSalvarSupervisor();
  const ativar = useAtivarSupervisor();

  /**
   * As contas que ainda dá para escolher. Conta já ligada a OUTRO supervisor sai
   * da lista — cadastrar a mesma pessoa duas vezes duplicaria as linhas dela na
   * grade, e não há erro do banco para segurar isso (não existe índice único em
   * `usuario_email`). Barrar na lista é melhor do que recusar depois de salvar.
   */
  const disponiveis = useMemo(() => {
    const emUso = new Set(
      supervisores
        .filter((s) => s.id_supervisor !== editando?.id_supervisor)
        .map((s) => (s.usuario_email ?? "").toLowerCase())
        .filter(Boolean),
    );
    return contas.filter((c) => !emUso.has(c.email.toLowerCase()));
  }, [contas, supervisores, editando?.id_supervisor]);

  const inativos =
    oferecerReativar && editando && !editando.id_supervisor
      ? supervisores.filter((s) => !s.ativo)
      : [];

  /**
   * Escolher a conta preenche o resto: nome e função vêm dela, e o nome da grade
   * é derivado (com desempate quando dois primeiros nomes colidem).
   */
  function escolherConta(email: string) {
    if (!editando) return;
    const conta = contas.find((c) => c.email === email);
    if (!conta) {
      onMudar({
        ...editando,
        usuario_email: "",
        nome: "",
        funcao: "",
        nome_resumido: "",
      });
      return;
    }
    const curtosEmUso = supervisores
      .filter((s) => s.id_supervisor !== editando.id_supervisor)
      .map((s) => s.nome_resumido || s.nome);
    onMudar({
      ...editando,
      usuario_email: conta.email,
      nome: conta.nome,
      funcao: conta.cargo ?? "",
      nome_resumido: nomeCurto(conta.nome, curtosEmUso),
    });
  }

  async function gravar() {
    if (!editando || !editando.usuario_email || !editando.nome.trim()) return;
    try {
      await salvar.mutateAsync(editando);
      onMudar(null);
    } catch {
      // Erro já vira toast no `onError` do hook. O catch impede a rejeição solta
      // no handler do clique, e o modal continua aberto com o que foi digitado.
    }
  }

  async function reativar(s: EscalaSupervisor) {
    try {
      await ativar.mutateAsync({ id_supervisor: s.id_supervisor, ativo: true });
      onMudar(null);
    } catch {
      // Toast no hook; o modal fica aberto.
    }
  }

  return (
    <Modal
      open={!!editando}
      onClose={() => onMudar(null)}
      title={editando?.id_supervisor ? "Editar supervisor" : "Novo supervisor"}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onMudar(null)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={gravar}
            disabled={!editando?.usuario_email || salvar.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0891B2] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0E7490] disabled:opacity-60"
          >
            {salvar.isPending && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </button>
        </div>
      }
    >
      {editando && (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="escala-conta-supervisor"
              className="mb-1 block text-xs font-semibold text-gray-600"
            >
              Quem é
            </label>
            <select
              id="escala-conta-supervisor"
              value={editando.usuario_email ?? ""}
              onChange={(e) => escolherConta(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Escolha a conta do painel...</option>
              {disponiveis.map((c) => (
                <option key={c.email} value={c.email}>
                  {c.nome}
                  {c.cargo ? ` — ${c.cargo}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-gray-500">
              Quem já está na escala não aparece na lista. O nome e a função são copiados da conta
              ao salvar — se mudarem na conta depois, escolha a conta de novo aqui e salve para
              atualizar.
            </p>
          </div>

          {/* O que vai ser gravado, à vista. Sem isto a pessoa escolhe uma conta e
              fica sem saber o que a grade vai mostrar. */}
          {editando.usuario_email && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm">
              <dt className="text-xs font-semibold text-gray-500">Nome</dt>
              <dd className="text-gray-900">{editando.nome}</dd>
              <dt className="text-xs font-semibold text-gray-500">Na grade</dt>
              <dd className="text-gray-900">{editando.nome_resumido || editando.nome}</dd>
              <dt className="text-xs font-semibold text-gray-500">Função</dt>
              <dd className="text-gray-600">
                {editando.funcao || <span className="text-gray-400">sem cargo na conta</span>}
              </dd>
              <dt className="text-xs font-semibold text-gray-500">E-mail</dt>
              <dd className="font-mono text-[12px] text-gray-500">{editando.usuario_email}</dd>
            </dl>
          )}

          <div className="flex flex-wrap items-end gap-4">
            <div className="w-28">
              <label
                htmlFor="escala-ordem-supervisor"
                className="mb-1 block text-xs font-semibold text-gray-600"
              >
                <Dica texto={DICAS_ESCALA_SUPERVISOR.ordem}>Ordem na grade</Dica>
              </label>
              <input
                id="escala-ordem-supervisor"
                type="number"
                value={editando.ordem ?? 0}
                onChange={(e) => onMudar({ ...editando, ordem: Number(e.target.value) || 0 })}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm tabular-nums"
              />
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 pb-1.5 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={editando.ativo ?? true}
                onChange={(e) => onMudar({ ...editando, ativo: e.target.checked })}
                className="size-4 accent-[#0891B2]"
              />
              <Dica texto={DICAS_ESCALA_SUPERVISOR.ativo}>Ativo na escala</Dica>
            </label>
          </div>

          {disponiveis.length === 0 && !editando.usuario_email && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Todas as contas do painel já estão na escala. Para incluir alguém novo, crie a conta
              em Sistema › Usuários.
            </p>
          )}

          {inativos.length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <p className="mb-1.5 text-xs font-semibold text-gray-600">
                Ou traga de volta quem saiu da escala
              </p>
              <ul className="space-y-1">
                {inativos.map((s) => (
                  <li
                    key={s.id_supervisor}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-gray-700">
                      {s.nome}
                      {s.funcao && (
                        <span className="ml-1 text-[11px] text-gray-500">— {s.funcao}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => reativar(s)}
                      disabled={ativar.isPending}
                      className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      <RotateCcw className="size-3.5" />
                      Trazer de volta
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, ToggleLeft, ToggleRight, Users } from "lucide-react";
import Badge from "@/components/ui/Badge";
import SupervisorModal, { novoSupervisor } from "./SupervisorModal";
import { cn } from "@/lib/utils";
import {
  useAtivarSupervisor,
  useEscalaSupervisores,
  usePodeEditarEscala,
  type SupervisorForm,
} from "@/lib/hooks/useEscalaCadastro";
import { useEscalaStore } from "@/lib/escala/store";
import type { EscalaSupervisor } from "@/lib/escala/tipos";

/**
 * Aba Supervisores da configuração (Fase 3).
 *
 * O módulo nasceu VAZIO por decisão dele em 31/08 ("os dados da planilha foram
 * apenas um esboço"): é nesta tela que a equipe real entra pela primeira vez.
 *
 * 🔑 O CADASTRO É PELA CONTA DO PAINEL, não por nome digitado (pedido dele em
 * 02/09, ao testar: "apenas a conta do painel já basta... não precisaríamos
 * colocar outro nome"). A escala organiza gente que já existe no painel, então
 * a conta é a identidade, e nome / nome na grade / função saem dela. Isso mata
 * de vez a chance de "Julianna" e "Juliana Ribeiro" serem a mesma pessoa
 * cadastrada duas vezes com grafias diferentes.
 *
 * ⚠️ Quem não tem conta no painel não entra na escala por esta tela. É a
 * consequência aceita da simplificação — se um dia precisar, o caminho é criar
 * a conta, não reabrir o campo de nome livre.
 *
 * ⚠️ NÃO EXISTE EXCLUIR, e isso é de propósito: `escala_dias` tem
 * `on delete cascade`, então apagar um supervisor levaria junto todo o histórico
 * de escala dele, em silêncio. Inativar preserva o passado e o tira dos meses
 * novos — que é o que "saiu da equipe" significa na prática.
 */

export default function SupervisoresTab() {
  const mostrarInativos = useEscalaStore((s) => s.mostrarInativos);
  const setMostrarInativos = useEscalaStore((s) => s.setMostrarInativos);

  const { data: supervisores = [], isLoading } = useEscalaSupervisores(false);
  const ativar = useAtivarSupervisor();
  const podeEditar = usePodeEditarEscala();

  const [editando, setEditando] = useState<SupervisorForm | null>(null);

  const visiveis = mostrarInativos ? supervisores : supervisores.filter((s) => s.ativo);
  const inativos = supervisores.length - supervisores.filter((s) => s.ativo).length;

  function abrirNovo() {
    // A ordem sugerida continua a sequência, para a pessoa não ter que pensar
    // num número. Ela pode trocar.
    setEditando(novoSupervisor(supervisores));
  }

  function abrirEdicao(s: EscalaSupervisor) {
    setEditando({
      id_supervisor: s.id_supervisor,
      nome: s.nome,
      nome_resumido: s.nome_resumido ?? "",
      funcao: s.funcao ?? "",
      usuario_email: s.usuario_email ?? "",
      ordem: s.ordem,
      ativo: s.ativo,
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-gray-500">
        <Loader2 className="size-4 animate-spin" />
        Carregando supervisores...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Quem entra na escala. Escolha a <strong>conta do painel</strong> da pessoa — o
          nome, o nome curto da grade e a função vêm dela.
        </p>
        {podeEditar && (
          <button
            type="button"
            onClick={abrirNovo}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0891B2] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0E7490]"
          >
            <Plus className="size-4" />
            Novo supervisor
          </button>
        )}
      </div>

      {inativos > 0 && (
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={mostrarInativos}
            onChange={(e) => setMostrarInativos(e.target.checked)}
            className="size-4 accent-[#0891B2]"
          />
          Mostrar {inativos === 1 ? "1 inativo" : `${inativos} inativos`}
        </label>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
            <tr>
              <th className="w-16 px-3 py-2">Ordem</th>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Na grade</th>
              <th className="px-3 py-2">Função</th>
              <th className="px-3 py-2">Conta do painel</th>
              <th className="w-36 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visiveis.map((s) => (
              <tr key={s.id_supervisor} className={cn(!s.ativo && "opacity-60")}>
                <td className="px-3 py-2 tabular-nums text-gray-500">{s.ordem}</td>
                <td className="px-3 py-2">
                  <span className="font-medium text-gray-900">{s.nome}</span>
                  {!s.ativo && (
                    <Badge variant="muted" className="ml-2">
                      inativo
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-600">{s.nome_resumido || "—"}</td>
                <td className="px-3 py-2 text-gray-600">{s.funcao || "—"}</td>
                <td className="px-3 py-2 font-mono text-[12px] text-gray-500">
                  {s.usuario_email || "—"}
                </td>
                <td className="px-3 py-2">
                  {podeEditar && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => abrirEdicao(s)}
                      className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      <Pencil className="size-3.5" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        ativar.mutate({ id_supervisor: s.id_supervisor, ativo: !s.ativo })
                      }
                      className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                      title={s.ativo ? "Tirar da escala" : "Trazer de volta"}
                    >
                      {s.ativo ? (
                        <ToggleRight className="size-3.5 text-emerald-600" />
                      ) : (
                        <ToggleLeft className="size-3.5 text-gray-400" />
                      )}
                      {s.ativo ? "Inativar" : "Reativar"}
                    </button>
                  </div>
                  )}
                </td>
              </tr>
            ))}

            {visiveis.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-sm text-gray-500">
                  <Users className="mx-auto mb-2 size-6 text-gray-300" />
                  Nenhum supervisor cadastrado ainda.
                  <br />
                  <span className="text-xs">
                    {podeEditar
                      ? "A escala começa aqui: escolha as contas do painel da equipe antes de montar o padrão semanal."
                      : "A equipe ainda não foi cadastrada. Quem cadastra é um Admin ou Técnico."}
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        Supervisor não se exclui, se inativa — apagar levaria junto todo o histórico de
        escala dele.
      </p>

      <SupervisorModal editando={editando} onMudar={setEditando} supervisores={supervisores} />
    </div>
  );
}

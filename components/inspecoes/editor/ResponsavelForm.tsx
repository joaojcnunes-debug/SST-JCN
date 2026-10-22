"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useUsuariosParaAssociar } from "@/lib/hooks/useInspecaoAssociados";
import { contaDoTecnicoDigitado } from "@/lib/dashboard/vinculo-tecnicos";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import UsuarioCombobox from "@/components/gestao/UsuarioCombobox";
import AvisoRascunho from "@/components/ui/AvisoRascunho";
import { useRascunho } from "@/lib/hooks/useRascunho";
import { gravar } from "@/lib/offline/gravar";
import type { InspecaoFull } from "@/lib/hooks/useInspecao";
import { gerarId } from "@/lib/utils";
import type { Responsavel } from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onClose: () => void;
  idInspecao: string;
  idEmpresa: string;
  responsavel?: Responsavel | null;
}

export default function ResponsavelForm({
  open,
  onClose,
  idInspecao,
  idEmpresa,
  responsavel,
}: Props) {
  const qc = useQueryClient();
  const isEdit = !!responsavel;

  /**
   * O "Técnico SST" é ESCOLHIDO do cadastro, não digitado (07/10).
   *
   * Texto livre deu 43 grafias para 15 pessoas (medido em 25/08) — "Lédimo",
   * "LÉDIMO", "Estefano do Rosario silva" em sete variações. Todos os técnicos
   * têm conta no painel, inclusive o de Friburgo, então a lista cobre todo
   * mundo. Escolher grava o nome exato da conta (é ele que sai no laudo) E o
   * vínculo `id_usuario` (v204).
   *
   * Única exceção: SEM a lista — a portaria do cliente sem sinal, que é onde
   * este registro costuma ser feito — o campo volta a aceitar digitação, para
   * não travar a visita. O vínculo desse nome é resolvido pela regra antiga
   * (`contaDoTecnicoDigitado`) quando a lista estiver de volta.
   */
  const { data: usuarios } = useUsuariosParaAssociar();
  const contas = (usuarios ?? [])
    .filter((u) => (u.nome ?? "").trim() && (u.email ?? "").trim())
    .map((u) => ({ id_usuario: u.id_usuario, nome: u.nome.trim(), email: u.email.trim() }));
  const temLista = contas.length > 0;
  const [form, setForm] = useState({
    /** Conta escolhida na lista; vazio = nada escolhido (ou modo sem lista). */
    id_usuario: "",
    tecnico_responsavel: "",
    recepcionado_por: "",
    cargo: "",
    data_hora: new Date().toISOString().slice(0, 16),
  });

  useEffect(() => {
    if (open) {
      setForm({
        id_usuario: responsavel?.id_usuario ?? "",
        tecnico_responsavel: responsavel?.tecnico_responsavel ?? "",
        recepcionado_por: responsavel?.recepcionado_por ?? "",
        cargo: responsavel?.cargo ?? "",
        data_hora: responsavel?.data_hora
          ? new Date(responsavel.data_hora).toISOString().slice(0, 16)
          : new Date().toISOString().slice(0, 16),
      });
    }
  }, [open, responsavel]);

  // Registro antigo, digitado à mão ("LÉDIMO"): se a regra reconhece a conta,
  // o campo já abre com ela escolhida em vez de vazio.
  const idEfetivo =
    form.id_usuario ||
    (form.tecnico_responsavel.trim()
      ? contaDoTecnicoDigitado(form.tecnico_responsavel, usuarios ?? []) ?? ""
      : "");

  // Rascunho contra queda de luz — só ao adicionar; nada volta sem clique.
  const rascunho = useRascunho(`responsavel:${idInspecao}`, form, {
    ativo: open && !isEdit,
  });

  /**
   * O responsável é preenchido NA RECEPÇÃO do cliente, antes de a visita
   * começar — costuma ser o primeiro registro do dia e o mais provável de
   * acontecer já sem sinal, na portaria.
   */
  const mutation = useMutation({
    mutationFn: async () => {
      const nomeDigitado = form.tecnico_responsavel.trim();
      const listaContas = usuarios ?? [];
      // Escolhido na lista: a conta é FATO. Só sem escolha cai na dedução.
      const contaDoNome =
        (form.id_usuario && listaContas.some((u) => u.id_usuario === form.id_usuario)
          ? form.id_usuario
          : null) ?? contaDoTecnicoDigitado(nomeDigitado, listaContas);
      const nomeMudou =
        !isEdit ||
        (responsavel?.tecnico_responsavel ?? "").trim() !== nomeDigitado;

      /**
       * O vínculo com a conta do painel (v204, Fase B1).
       *
       * Ele é OMITIDO do payload em dois casos, e a omissão é o ponto:
       *
       *  • a lista de contas não respondeu (`listaContas` vazia) — que é
       *    justamente o cenário que este arquivo já prevê, a portaria do
       *    cliente sem sinal. Gravar `null` aí APAGARIA um vínculo bom por
       *    falta de uma consulta. Não se perde fato por falta de rede.
       *  • o nome não mudou e a regra não sabe afirmar quem é. Quem arrumou o
       *    vínculo à mão continua valendo — o form não é dono desse dado.
       *
       * Só zera de propósito quando o nome MUDOU e a regra não alcança o novo:
       * aí o vínculo antigo passou a apontar para a pessoa errada, e apontar
       * errado é pior que não apontar.
       */
      const vinculo: { id_usuario?: string | null } = contaDoNome
        ? { id_usuario: contaDoNome }
        : listaContas.length === 0
          ? {}
          : nomeMudou
            ? { id_usuario: null }
            : {};

      const payload = {
        tecnico_responsavel: nomeDigitado || null,
        ...vinculo,
        recepcionado_por: form.recepcionado_por.trim() || null,
        cargo: form.cargo.trim() || null,
        data_hora: new Date(form.data_hora).toISOString(),
      };

      if (isEdit && responsavel) {
        const resultado = await gravar({
          tabela: "responsaveis",
          tipo: "update",
          linhas: payload,
          filtro: { id_responsavel: responsavel.id_responsavel },
          modulo: "inspecoes",
          id_documento: idInspecao,
        });
        return { resultado, linha: { ...responsavel, ...payload } as Responsavel };
      }

      const row = {
        id_responsavel: gerarId("RSP"),
        id_inspecao: idInspecao,
        id_empresa: idEmpresa,
        ...payload,
      };
      const resultado = await gravar({
        tabela: "responsaveis",
        tipo: "insert",
        linhas: [row],
        filtro: null,
        modulo: "inspecoes",
        id_documento: idInspecao,
      });
      return { resultado, linha: row as unknown as Responsavel };
    },
    onSuccess: ({ resultado, linha }) => {
      rascunho.limpar();

      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
        toast.success(isEdit ? "Atualizado" : "Adicionado");
      } else {
        // Sem rede não há o que revalidar: a lista da tela é atualizada à mão.
        qc.setQueryData<InspecaoFull>(["inspecao", idInspecao], (antigo) => {
          if (!antigo) return antigo;
          return {
            ...antigo,
            responsaveis: isEdit
              ? antigo.responsaveis.map((r) =>
                  r.id_responsavel === linha.id_responsavel ? linha : r
                )
              : [...antigo.responsaveis, linha],
          };
        });
        toast.success("Guardado no aparelho", { icon: "📵" });
      }

      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar Responsável" : "Novo Responsável"}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {rascunho.pendente && (
          <AvisoRascunho
            idadeMin={rascunho.pendente.idadeMin}
            onRecuperar={() => {
              const v = rascunho.recuperar();
              if (v) setForm(v);
            }}
            onDescartar={rascunho.descartar}
          />
        )}
        <div>
          <label className={lblCls}>Técnico SST</label>
          {temLista ? (
            <UsuarioCombobox
              usuarios={contas}
              value={contas.find((c) => c.id_usuario === idEfetivo)?.email ?? ""}
              placeholder="Digite e selecione o técnico"
              incluirVazio
              vazioLabel="Nenhum técnico"
              onChange={(email) => {
                const c = contas.find((x) => x.email.toLowerCase() === email.toLowerCase());
                setForm({
                  ...form,
                  id_usuario: c?.id_usuario ?? "",
                  tecnico_responsavel: c?.nome ?? "",
                });
              }}
            />
          ) : (
            <input
              type="text"
              autoComplete="off"
              value={form.tecnico_responsavel}
              onChange={(e) =>
                setForm({ ...form, id_usuario: "", tecnico_responsavel: e.target.value })
              }
              className={inputCls}
            />
          )}
          {temLista && !idEfetivo && form.tecnico_responsavel.trim() && (
            <p className="mt-1 text-xs text-amber-700">
              Nome gravado antes da lista: <strong>{form.tecnico_responsavel}</strong>. Selecione a
              pessoa para padronizar.
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            {temLista
              ? "Digite parte do nome e escolha na lista."
              : "Sem conexão: a lista de técnicos não carregou, digite o nome."}{" "}
            Foram dois técnicos na visita? Salve este e use <strong>Adicionar</strong> de novo
            para o segundo.
          </p>
        </div>
        <div>
          <label className={lblCls}>Recepcionado por</label>
          <input
            type="text"
            value={form.recepcionado_por}
            onChange={(e) =>
              setForm({ ...form, recepcionado_por: e.target.value })
            }
            className={inputCls}
          />
        </div>
        <div>
          <label className={lblCls}>Cargo</label>
          <input
            type="text"
            value={form.cargo}
            onChange={(e) => setForm({ ...form, cargo: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={lblCls}>Data/Hora</label>
          <input
            type="datetime-local"
            value={form.data_hora}
            onChange={(e) => setForm({ ...form, data_hora: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
          >
            {mutation.isPending ? "Salvando..." : isEdit ? "Salvar" : "Adicionar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30";
const lblCls = "text-sm font-medium text-gray-700";

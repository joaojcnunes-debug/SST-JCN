"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, ToggleLeft, ToggleRight } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import {
  usePodeEditarEscala,
  useEscalaRegras,
  useEscalaSupervisores,
  useSalvarRegra,
  useUnidadesDaEscala,
  type RegraForm,
} from "@/lib/hooks/useEscalaCadastro";
import { CODIGOS_CONHECIDOS, type CodigoRegra } from "@/lib/escala/regras";
import { DIAS_UTEIS, type EscalaRegra } from "@/lib/escala/tipos";

/**
 * Aba Regras da configuração (Fase 6).
 *
 * A planilha trazia seis regras fixas, três delas citando pessoas pelo nome
 * ("Julianna escalada na quarta e na sexta"). Regra com nome de gente dentro
 * não pode ser semeada: o módulo nasceu sem supervisor, e um nome escrito no
 * código envelhece no dia em que a pessoa sai da equipe.
 *
 * Por isso aqui cada regra é um TIPO com parâmetros, e o parâmetro aponta para
 * um supervisor cadastrado. Sai da equipe, a regra passa a acusar — que é o
 * comportamento certo, em vez de continuar dizendo OK sobre alguém que não
 * está mais lá.
 *
 * O formulário é por tipo, e não um campo de JSON: quem monta escala não deve
 * precisar saber o formato interno do parâmetro.
 */

const ROTULO_CODIGO: Record<CodigoRegra, string> = {
  min_supervisores_dia: "Mínimo de supervisores por dia",
  nenhum_dia_sem_supervisor: "Nenhum dia sem supervisor",
  sede_coberta: "Sede coberta todos os dias",
  ancora_dias_fixos: "Dias fixos de um supervisor (âncora)",
  par_mesma_unidade: "Dupla que precisa coincidir",
};

const DESCRICAO_PADRAO: Record<CodigoRegra, string> = {
  min_supervisores_dia: "Todo dia útil com pelo menos N supervisores escalados",
  nenhum_dia_sem_supervisor: "Nenhum dia útil sem supervisor",
  sede_coberta: "Sede coberta em todos os dias úteis",
  ancora_dias_fixos: "Supervisor com dias fixos respeitados",
  par_mesma_unidade: "Dupla coincide na mesma unidade em pelo menos N dias",
};

export default function RegrasTab() {
  const { data: regras = [], isLoading } = useEscalaRegras();
  const { data: supervisores = [] } = useEscalaSupervisores(true);
  const { data: unidades = [] } = useUnidadesDaEscala(true);
  const salvar = useSalvarRegra();
  const podeEditar = usePodeEditarEscala();

  const [editando, setEditando] = useState<RegraForm | null>(null);

  function abrirNova() {
    const proxima = regras.reduce((max, r) => Math.max(max, r.ordem), 0) + 1;
    setEditando({
      codigo: "min_supervisores_dia",
      descricao: DESCRICAO_PADRAO.min_supervisores_dia,
      parametros: { minimo: 2 },
      ativa: true,
      ordem: proxima,
    });
  }

  function abrirEdicao(r: EscalaRegra) {
    setEditando({
      id_regra: r.id_regra,
      codigo: r.codigo,
      descricao: r.descricao,
      parametros: r.parametros ?? {},
      ativa: r.ativa,
      ordem: r.ordem,
    });
  }

  async function gravar() {
    if (!editando || !editando.descricao.trim()) return;
    try {
      await salvar.mutateAsync(editando);
      setEditando(null);
    } catch {
      // toast já saiu no hook; o modal fica aberto com o que foi preenchido
    }
  }

  async function alternarAtiva(r: EscalaRegra) {
    try {
      await salvar.mutateAsync({
        id_regra: r.id_regra,
        codigo: r.codigo,
        descricao: r.descricao,
        parametros: r.parametros ?? {},
        ativa: !r.ativa,
        ordem: r.ordem,
      });
    } catch {
      // idem
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-gray-500">
        <Loader2 className="size-4 animate-spin" />
        Carregando regras...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-gray-600">
          O que a Conferência checa a cada mês. Regra desligada não é avaliada — e não
          achar nada não é o mesmo que estar tudo certo.
        </p>
        {podeEditar && (
          <button
            type="button"
            onClick={abrirNova}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0891B2] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0E7490]"
          >
            <Plus className="size-4" />
            Nova regra
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
            <tr>
              <th className="w-12 px-3 py-2">#</th>
              <th className="px-3 py-2">Regra</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="w-24 px-3 py-2">Estado</th>
              <th className="w-36 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {regras.map((r) => {
              const conhecida = (CODIGOS_CONHECIDOS as readonly string[]).includes(r.codigo);
              return (
                <tr key={r.id_regra} className={cn(!r.ativa && "opacity-60")}>
                  <td className="px-3 py-2 tabular-nums text-gray-500">{r.ordem}</td>
                  <td className="px-3 py-2 text-gray-900">{r.descricao}</td>
                  <td className="px-3 py-2">
                    {conhecida ? (
                      <span className="text-xs text-gray-600">
                        {ROTULO_CODIGO[r.codigo as CodigoRegra]}
                      </span>
                    ) : (
                      <Badge variant="warning">tipo não avaliado</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.ativa ? (
                      <Badge variant="success">ligada</Badge>
                    ) : (
                      <Badge variant="muted">desligada</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {podeEditar && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => abrirEdicao(r)}
                          className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          <Pencil className="size-3.5" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => alternarAtiva(r)}
                          className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          {r.ativa ? (
                            <ToggleRight className="size-3.5 text-emerald-600" />
                          ) : (
                            <ToggleLeft className="size-3.5 text-gray-400" />
                          )}
                          {r.ativa ? "Desligar" : "Ligar"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}

            {regras.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-500">
                  Nenhuma regra cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editando}
        onClose={() => setEditando(null)}
        title={editando?.id_regra ? "Editar regra" : "Nova regra"}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditando(null)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={gravar}
              disabled={!editando?.descricao.trim() || salvar.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0891B2] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0E7490] disabled:opacity-60"
            >
              {salvar.isPending && <Loader2 className="size-4 animate-spin" />}
              Salvar
            </button>
          </div>
        }
      >
        {editando && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Tipo</label>
              <select
                value={editando.codigo}
                onChange={(e) => {
                  const codigo = e.target.value as CodigoRegra;
                  // Trocar o tipo zera os parâmetros: eles não são compatíveis
                  // entre tipos, e um resto do tipo anterior viraria configuração
                  // fantasma que o motor lê e ninguém vê na tela.
                  setEditando({
                    ...editando,
                    codigo,
                    descricao: DESCRICAO_PADRAO[codigo],
                    parametros: codigo === "min_supervisores_dia" ? { minimo: 2 } : {},
                  });
                }}
                disabled={!!editando.id_regra}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50"
              >
                {CODIGOS_CONHECIDOS.map((c) => (
                  <option key={c} value={c}>
                    {ROTULO_CODIGO[c]}
                  </option>
                ))}
              </select>
              {editando.id_regra && (
                <p className="mt-1 text-[11px] text-gray-500">
                  O tipo não muda depois de criado — crie outra regra em vez disso.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">
                Como aparece na conferência
              </label>
              <input
                type="text"
                value={editando.descricao}
                onChange={(e) => setEditando({ ...editando, descricao: e.target.value })}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>

            <ParametrosDaRegra
              codigo={editando.codigo as CodigoRegra}
              parametros={editando.parametros ?? {}}
              supervisores={supervisores.map((s) => ({
                id: s.id_supervisor,
                nome: s.nome_resumido || s.nome,
              }))}
              unidades={unidades.map((u) => ({ id: u.id_unidade, nome: u.nome }))}
              onMudar={(parametros) => setEditando({ ...editando, parametros })}
            />

            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={editando.ativa ?? true}
                onChange={(e) => setEditando({ ...editando, ativa: e.target.checked })}
                className="size-4 accent-[#0891B2]"
              />
              Ligada — entra na conferência do mês
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Os campos de cada tipo ─────────────────────────────────────────────────

interface ParamProps {
  codigo: CodigoRegra;
  parametros: Record<string, unknown>;
  supervisores: { id: string; nome: string }[];
  unidades: { id: string; nome: string }[];
  onMudar: (p: Record<string, unknown>) => void;
}

function ParametrosDaRegra({
  codigo,
  parametros: p,
  supervisores,
  unidades,
  onMudar,
}: ParamProps) {
  const rotulo = "mb-1 block text-xs font-semibold text-gray-600";
  const campo = "w-full rounded border border-gray-300 px-2 py-1.5 text-sm";
  const semEquipe = supervisores.length === 0;

  switch (codigo) {
    case "nenhum_dia_sem_supervisor":
      return <p className="text-xs text-gray-500">Esta regra não tem parâmetro.</p>;

    case "min_supervisores_dia":
      return (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo}>Mínimo por dia</label>
            <input
              type="number"
              min={1}
              value={typeof p.minimo === "number" ? p.minimo : 2}
              onChange={(e) => onMudar({ ...p, minimo: Number(e.target.value) || 1 })}
              className={campo}
            />
          </div>
          <div>
            <label className={rotulo}>Contar</label>
            <select
              value={typeof p.considerar === "string" ? p.considerar : "qualquer"}
              onChange={(e) => onMudar({ ...p, considerar: e.target.value })}
              className={campo}
            >
              <option value="qualquer">quem tem o dia definido</option>
              <option value="em_unidade">só quem está em unidade</option>
            </select>
            <p className="mt-1 text-[11px] text-gray-500">
              A planilha contava home office junto — é a primeira opção.
            </p>
          </div>
        </div>
      );

    case "sede_coberta":
      return (
        <div>
          <label className={rotulo}>Qual unidade é a sede</label>
          <select
            value={typeof p.id_unidade === "string" ? p.id_unidade : ""}
            onChange={(e) => onMudar({ ...p, id_unidade: e.target.value || null })}
            className={campo}
          >
            <option value="">— escolher —</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-gray-500">
            Sem isso a regra não roda, e a conferência a mostra como não configurada — nunca
            como OK.
          </p>
        </div>
      );

    case "ancora_dias_fixos": {
      const dias = Array.isArray(p.dias) ? (p.dias as number[]) : [];
      return (
        <div className="space-y-2">
          <div>
            <label className={rotulo}>Supervisor</label>
            <select
              value={typeof p.id_supervisor === "string" ? p.id_supervisor : ""}
              onChange={(e) => onMudar({ ...p, id_supervisor: e.target.value || null })}
              className={campo}
            >
              <option value="">— escolher —</option>
              {supervisores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={rotulo}>Dias fixos</label>
            <div className="flex flex-wrap gap-1.5">
              {DIAS_UTEIS.map((d) => {
                const on = dias.includes(d.valor);
                return (
                  <button
                    key={d.valor}
                    type="button"
                    onClick={() =>
                      onMudar({
                        ...p,
                        dias: on ? dias.filter((x) => x !== d.valor) : [...dias, d.valor].sort(),
                      })
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-sm",
                      on
                        ? "border-[#0891B2] bg-cyan-50 font-medium text-[#0E7490]"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    {d.curto}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              A regra cobra que a pessoa esteja <strong>em unidade</strong> nesses dias — home
              office não conta.
            </p>
          </div>
          {semEquipe && (
            <p className="text-[11px] text-amber-700">
              Nenhum supervisor cadastrado ainda. Cadastre a equipe antes desta regra.
            </p>
          )}
        </div>
      );
    }

    case "par_mesma_unidade":
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            {(["id_supervisor_a", "id_supervisor_b"] as const).map((chave, i) => (
              <div key={chave}>
                <label className={rotulo}>{i === 0 ? "Supervisor" : "Precisa coincidir com"}</label>
                <select
                  value={typeof p[chave] === "string" ? (p[chave] as string) : ""}
                  onChange={(e) => onMudar({ ...p, [chave]: e.target.value || null })}
                  className={campo}
                >
                  <option value="">— escolher —</option>
                  {supervisores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div>
            <label className={rotulo}>Em pelo menos quantos dias do mês</label>
            <input
              type="number"
              min={1}
              value={typeof p.minimo_dias === "number" ? p.minimo_dias : 1}
              onChange={(e) => onMudar({ ...p, minimo_dias: Number(e.target.value) || 1 })}
              className="w-24 rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
            <p className="mt-1 text-[11px] text-gray-500">
              Conta só quando os dois estão na <strong>mesma</strong> unidade no mesmo dia.
            </p>
          </div>
          {semEquipe && (
            <p className="text-[11px] text-amber-700">
              Nenhum supervisor cadastrado ainda. Cadastre a equipe antes desta regra.
            </p>
          )}
        </div>
      );
  }
}

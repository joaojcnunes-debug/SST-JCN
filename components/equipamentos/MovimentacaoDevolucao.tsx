"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  useAparelhosDoColaborador,
  useEstoqueDoColaborador,
  useColaboradores,
  useRegistrarDevolucao,
  urlTermo,
  type ItemDevolucaoInput,
} from "@/lib/hooks/useEquipamentosEntregas";
import { useCurrentUser } from "@/lib/hooks/useUsuario";
import type { EstadoRetorno } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * Devolução — entrada de equipamento de volta na base.
 *
 * É o caminho inverso da retirada e fecha o ciclo: sem ele o aparelho fica
 * preso à pessoa para sempre e nunca volta a aparecer como livre para entrega.
 *
 * ⚠️ ESTADO DIFERENTE DE ÍNTEGRO EXIGE DESCRIÇÃO — e quem cobra é o banco, pela
 * constraint `equip_dev_estado_exige_obs`. A tela cobra antes só para o erro
 * não chegar depois de preencher tudo. "Avariado" sem dizer a avaria é laudo
 * sem laudo: seis meses depois ninguém sabe se a tela já estava trincada.
 *
 * ⚠️ A DEVOLUÇÃO NÃO EDITA A RETIRADA. Ela é um registro novo, com termo
 * próprio — mesma disciplina append-only do resto do módulo. O termo da
 * retirada continua valendo como o que foi assinado naquele dia.
 */

const inputCls =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelCls =
  "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-600";

const ESTADOS: { valor: EstadoRetorno; rotulo: string }[] = [
  { valor: "integro", rotulo: "Íntegro" },
  { valor: "avariado", rotulo: "Avariado" },
  { valor: "inservivel", rotulo: "Inservível" },
];

const hoje = () => new Date().toISOString().slice(0, 10);

type Selecao = { estado: EstadoRetorno; observacao: string };
/** Periférico / item por quantidade: além do estado, QUANTOS voltam. */
type SelecaoEstoque = Selecao & { quantidade: number };

export default function MovimentacaoDevolucao({
  bases,
  baseInicial,
}: {
  bases: { id_unidade: string; nome: string }[];
  baseInicial?: string | null;
}) {
  const user = useCurrentUser();

  /**
   * NASCE VAZIO DE PROPÓSITO — não cai na primeira base da lista.
   *
   * Pré-selecionar a primeira em ordem alfabética faz a pessoa escolher o
   * destinatário sem reparar na unidade, e "Campos" acabava respondendo por uma
   * retirada de Teresópolis. Como colaborador e aparelhos livres são ambos
   * escopados por base, a escolha errada aqui contamina tudo abaixo — e o erro
   * só aparece no papel, depois de assinado. Ordem obrigatória: unidade, depois
   * quem recebe.
   */
  const [base, setBase] = useState<string>(
    baseInicial && baseInicial !== "TODAS" ? baseInicial : "",
  );
  const [idColaborador, setIdColaborador] = useState("");
  const [data, setData] = useState(hoje());
  const [recebidoPor, setRecebidoPor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [selecao, setSelecao] = useState<Record<string, Selecao>>({});
  const [selecaoEstoque, setSelecaoEstoque] = useState<Record<string, SelecaoEstoque>>({});
  const [termoEmitido, setTermoEmitido] = useState<string | null>(null);

  const { data: colaboradores = [] } = useColaboradores(base || null, false);
  const { data: emPosse = [], isLoading } = useAparelhosDoColaborador(idColaborador || null);
  const { data: estoqueEmPosse = [], isLoading: carregandoEstoque } = useEstoqueDoColaborador(idColaborador || null);
  const registrar = useRegistrarDevolucao();

  useEffect(() => {
    if (!recebidoPor && user?.nome) setRecebidoPor(user.nome);
  }, [user?.nome, recebidoPor]);

  useEffect(() => {
    setIdColaborador("");
    setSelecao({});
    setSelecaoEstoque({});
  }, [base]);

  useEffect(() => {
    setSelecao({});
    setSelecaoEstoque({});
  }, [idColaborador]);

  const escolhidos = useMemo(
    () => emPosse.filter((e) => selecao[e.id_equipamento]),
    [emPosse, selecao],
  );

  const escolhidosEstoque = useMemo(
    () => estoqueEmPosse.filter((e) => selecaoEstoque[e.id_catalogo]),
    [estoqueEmPosse, selecaoEstoque],
  );
  function alternarEstoque(item: { id_catalogo: string; quantidade: number }) {
    setSelecaoEstoque((s) => {
      if (!s[item.id_catalogo])
        return { ...s, [item.id_catalogo]: { estado: "integro", observacao: "", quantidade: item.quantidade } };
      const resto = { ...s };
      delete resto[item.id_catalogo];
      return resto;
    });
  }
  function ajustarEstoque(id: string, patch: Partial<SelecaoEstoque>) {
    setSelecaoEstoque((s) => (s[id] ? { ...s, [id]: { ...s[id], ...patch } } : s));
  }
  function alternar(id: string) {
    setSelecao((s) => {
      if (!s[id]) return { ...s, [id]: { estado: "integro", observacao: "" } };
      const resto = { ...s };
      delete resto[id];
      return resto;
    });
  }

  function ajustar(id: string, patch: Partial<Selecao>) {
    setSelecao((s) => (s[id] ? { ...s, [id]: { ...s[id], ...patch } } : s));
  }

  async function registrarDevolucao() {
    if (!idColaborador) return toast.error("Escolha de quem está vindo a devolução.");
    if (escolhidos.length === 0 && escolhidosEstoque.length === 0)
      return toast.error("Marque ao menos um item — aparelho ou periférico.");
    for (const e of escolhidosEstoque) {
      const s = selecaoEstoque[e.id_catalogo];
      if (!Number.isInteger(s.quantidade) || s.quantidade <= 0 || s.quantidade > e.quantidade)
        return toast.error(`"${e.nome}": a pessoa tem ${e.quantidade}; informe entre 1 e ${e.quantidade}.`);
      if (s.estado !== "integro" && !s.observacao.trim())
        return toast.error(`Descreva a avaria de "${e.nome}" — o banco recusa item avariado sem descrição.`);
    }

    const semDescricao = escolhidos.find((e) => {
      const s = selecao[e.id_equipamento];
      return s.estado !== "integro" && !s.observacao.trim();
    });
    if (semDescricao) {
      return toast.error(
        `Descreva a avaria de "${semDescricao.nome}" — o banco recusa item avariado sem descrição.`,
      );
    }

    // A base do retorno é a do colaborador, não a que está filtrando a tela: é
    // para lá que o aparelho volta, e é o que a RPC confere.
    const colaborador = colaboradores.find((c) => c.id_colaborador === idColaborador);
    const idUnidade = colaborador?.id_unidade ?? base;

    const itens: ItemDevolucaoInput[] = [
      ...escolhidos.map((e): ItemDevolucaoInput => {
        const s = selecao[e.id_equipamento];
        return {
          id_equipamento: e.id_equipamento,
          estado_retorno: s.estado,
          observacao_estado: s.observacao.trim() || null,
        };
      }),
      // Periférico volta ao SALDO da base (a RPC lança entrada com origem
      // 'devolucao'); não vira ficha, porque nunca teve uma.
      ...escolhidosEstoque.map((e): ItemDevolucaoInput => {
        const s = selecaoEstoque[e.id_catalogo];
        return {
          id_catalogo: e.id_catalogo,
          quantidade: s.quantidade,
          estado_retorno: s.estado,
          observacao_estado: s.observacao.trim() || null,
        };
      }),
    ];

    const id = await registrar.mutateAsync({
      id_unidade: idUnidade,
      id_colaborador: idColaborador,
      // A entrega de origem não é amarrada aqui: um mesmo retorno pode juntar
      // itens de retiradas diferentes, e forçar uma só falsearia o vínculo.
      id_entrega: null,
      data_devolucao: data,
      recebido_por: recebidoPor.trim() || null,
      observacao: observacao.trim() || null,
      itens,
    });

    toast.success(`Devolução registrada — ${itens.length} item(ns).`);
    setTermoEmitido(id);
    setSelecao({});
    setSelecaoEstoque({});
    setObservacao("");
  }

  if (termoEmitido) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <p className="text-sm font-semibold text-green-900">Devolução registrada.</p>
        <p className="mt-1 text-sm text-green-800">
          Os aparelhos voltaram a ficar livres na base. Item devolvido fora de{" "}
          <b>íntegro</b> continua livre no cadastro — se ele precisa parar de circular, mude o
          status do equipamento com o motivo da avaria.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={urlTermo("devolucao", termoEmitido)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
          >
            <FileText className="h-4 w-4" /> Abrir termo em PDF
          </a>
          <button
            type="button"
            onClick={() => setTermoEmitido(null)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Registrar outra devolução
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={labelCls}>Unidade / base *</label>
          <select className={inputCls} value={base} onChange={(e) => setBase(e.target.value)}>
            <option value="">Selecione…</option>
            {bases.map((b) => (
              <option key={b.id_unidade} value={b.id_unidade}>
                {b.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label className={labelCls}>Quem está devolvendo *</label>
          <select
            className={inputCls}
            value={idColaborador}
            onChange={(e) => setIdColaborador(e.target.value)}
            disabled={!base}
          >
            <option value="">
              {!base
                ? "Escolha a unidade primeiro"
                : colaboradores.length
                  ? "Selecione…"
                  : "Nenhum colaborador nesta base"}
            </option>
            {colaboradores.map((c) => (
              <option key={c.id_colaborador} value={c.id_colaborador}>
                {c.nome}
                {c.ativo ? "" : " (inativo)"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Data da devolução</label>
          <input
            type="date"
            className={inputCls}
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </div>
      </div>

      {idColaborador && (
        <div>
          <label className={labelCls}>O que está com esta pessoa</label>
          {isLoading && (
            <div className="flex items-center gap-2 px-1 py-3 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> carregando…
            </div>
          )}
          {!isLoading && !carregandoEstoque && emPosse.length === 0 && estoqueEmPosse.length === 0 && (
            <p className="rounded-md border border-gray-200 px-3 py-3 text-sm text-gray-500">
              Nada em posse desta pessoa. Se ela devolveu algo que não aparece aqui, a retirada
              nunca chegou a ser registrada no painel.
            </p>
          )}
          <div className="space-y-1">
            {emPosse.map((e) => {
              const marcado = !!selecao[e.id_equipamento];
              const s = selecao[e.id_equipamento];
              return (
                <div
                  key={e.id_equipamento}
                  className={cn(
                    "rounded-md border px-3 py-2",
                    marcado ? "border-blue-300 bg-blue-50/40" : "border-gray-200",
                  )}
                >
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => alternar(e.id_equipamento)}
                      className="h-4 w-4"
                    />
                    <span>
                      <b>{e.nome}</b>
                      <span className="text-gray-500">
                        {e.numero_patrimonio ? ` · patr. ${e.numero_patrimonio}` : ""}
                        {e.numero_serie ? ` · série ${e.numero_serie}` : ""}
                      </span>
                    </span>
                  </label>

                  {marcado && (
                    <div className="mt-2 grid grid-cols-1 gap-2 pl-6 sm:grid-cols-3">
                      <div>
                        <label className={labelCls}>Estado no retorno</label>
                        <select
                          className={inputCls}
                          value={s.estado}
                          onChange={(ev) =>
                            ajustar(e.id_equipamento, {
                              estado: ev.target.value as EstadoRetorno,
                            })
                          }
                        >
                          {ESTADOS.map((op) => (
                            <option key={op.valor} value={op.valor}>
                              {op.rotulo}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelCls}>
                          Descrição da avaria {s.estado !== "integro" && "*"}
                        </label>
                        <input
                          className={inputCls}
                          value={s.observacao}
                          onChange={(ev) =>
                            ajustar(e.id_equipamento, { observacao: ev.target.value })
                          }
                          placeholder={
                            s.estado === "integro"
                              ? "opcional"
                              : "obrigatório — o banco recusa sem isto"
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Periféricos e itens por quantidade (21/09/2026): o que a pessoa
              retirou do estoque e ainda não devolveu. */}
          {carregandoEstoque && (
            <div className="flex items-center gap-2 px-1 py-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> conferindo periféricos…
            </div>
          )}
          {estoqueEmPosse.length > 0 && (
            <div className="mt-3">
              <label className={labelCls}>Periféricos e itens por quantidade com esta pessoa</label>
              <div className="space-y-1">
                {estoqueEmPosse.map((e) => {
                  const s = selecaoEstoque[e.id_catalogo];
                  const marcado = !!s;
                  return (
                    <div
                      key={e.id_catalogo}
                      className={cn(
                        "rounded-md border px-3 py-2",
                        marcado ? "border-emerald-300 bg-emerald-50/40" : "border-gray-200",
                      )}
                    >
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input type="checkbox" checked={marcado} onChange={() => alternarEstoque(e)} className="h-4 w-4" />
                        <span>
                          <b>{e.nome}</b>
                          <span className="text-gray-500">
                            {e.tipo ? ` · ${e.tipo}` : ""} · com a pessoa: {e.quantidade} {e.unidade_medida ?? "un"}
                          </span>
                        </span>
                      </label>
                      {marcado && (
                        <div className="mt-2 grid grid-cols-1 gap-2 pl-6 sm:grid-cols-4">
                          <div>
                            <label className={labelCls}>Quantos voltam</label>
                            <input
                              type="number"
                              min={1}
                              max={e.quantidade}
                              step={1}
                              className={inputCls}
                              value={s.quantidade}
                              onChange={(ev) => ajustarEstoque(e.id_catalogo, { quantidade: Number(ev.target.value) })}
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Estado no retorno</label>
                            <select
                              className={inputCls}
                              value={s.estado}
                              onChange={(ev) => ajustarEstoque(e.id_catalogo, { estado: ev.target.value as EstadoRetorno })}
                            >
                              {ESTADOS.map((op) => (
                                <option key={op.valor} value={op.valor}>{op.rotulo}</option>
                              ))}
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <label className={labelCls}>Descrição da avaria {s.estado !== "integro" && "*"}</label>
                            <input
                              className={inputCls}
                              value={s.observacao}
                              onChange={(ev) => ajustarEstoque(e.id_catalogo, { observacao: ev.target.value })}
                              placeholder={s.estado === "integro" ? "opcional" : "obrigatório — o banco recusa sem isto"}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Quem recebeu de volta</label>
          <input
            className={inputCls}
            value={recebidoPor}
            onChange={(e) => setRecebidoPor(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Motivo / observação</label>
          <input
            className={inputCls}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="desligamento, troca de função, fim do projeto…"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-gray-200 pt-3">
        <button
          type="button"
          onClick={registrarDevolucao}
          disabled={registrar.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {registrar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Registrar devolução e emitir termo
        </button>
        <p className="text-xs text-gray-500">
          {escolhidos.length > 0
            ? `${escolhidos.length} item(ns) marcado(s).`
            : "Marque o que está voltando."}
        </p>
      </div>
    </div>
  );
}

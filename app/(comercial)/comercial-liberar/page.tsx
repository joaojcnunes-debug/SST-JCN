"use client";

// Comercial › Liberar serviços (0.3.233, banco v321). A equipe decide, serviço por serviço, o que
// vai para o vendedor. Os estados e a regra do reenvio estão em lib/comercial/liberacao.ts.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, CheckCircle2, ClipboardCheck, Hand, ListChecks, Loader2, Search, Undo2 } from "lucide-react";
import Dica from "@/components/ui/Dica";
import Modal from "@/components/ui/Modal";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { ConfirmHost, confirmar } from "@/components/ui/confirm";
import { DICAS_COMERCIAL_LIBERAR } from "@/lib/dicas/comercial";
import { useDecidirServico, useDesfazerDecisao, useFilaComercial, usePodeLiberarServicos } from "@/lib/hooks/useComercial";
import { MODALIDADES, PRODUTOS_COM_MODALIDADE, type ServicoNaFila, type StatusDecisao } from "@/lib/comercial/liberacao";
import { NOME_PRODUTO, PRODUTOS, type Produto } from "@/lib/comercial/oportunidades";
import { buscar } from "@/lib/busca/texto";
import { cn, fmtData, formatCNPJ } from "@/lib/utils";

type Aba = "fila" | "liberados" | "segurados";

const ABAS: { key: Aba; rotulo: string; vazio: string }[] = [
  { key: "fila", rotulo: "Para liberar", vazio: "Nada esperando decisão." },
  { key: "liberados", rotulo: "Liberados", vazio: "Nenhum serviço liberado." },
  { key: "segurados", rotulo: "Segurados", vazio: "Nenhum serviço segurado." },
];

const abaDe = (s: ServicoNaFila): Aba => (s.estado === "pendente" ? "fila" : s.estado === "segurado" ? "segurados" : "liberados");

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-marca-primary focus:outline-none focus:ring-2 focus:ring-marca-primary/20";

interface Janela {
  idEmpresa: string;
  nomeEmpresa: string;
  servicos: ServicoNaFila[];
  status: StatusDecisao;
}

export default function ComercialLiberarPage() {
  const { data: fila, isLoading, error } = useFilaComercial();
  const podeLiberar = usePodeLiberarServicos();
  const desfazer = useDesfazerDecisao();

  const [aba, setAba] = useState<Aba>("fila");
  const [busca, setBusca] = useState("");
  const [produto, setProduto] = useState<Produto | "">("");
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [janela, setJanela] = useState<Janela | null>(null);

  const todos = useMemo(() => fila ?? [], [fila]);
  const contagem = useMemo(() => {
    const n: Record<Aba, number> = { fila: 0, liberados: 0, segurados: 0 };
    for (const s of todos) n[abaDe(s)]++;
    return n;
  }, [todos]);

  // Um grupo por empresa; dentro da aba, a empresa com mais serviços vem primeiro.
  const grupos = useMemo(() => {
    const daAba = todos.filter((s) => abaDe(s) === aba && (!produto || s.oportunidade.produto === produto));
    const achados = busca.trim()
      ? buscar(daAba, busca, (s) => [s.empresa.empresa.nome, s.empresa.empresa.cnpj, s.empresa.empresa.municipio]).itens
      : daAba;
    const porEmpresa = new Map<string, ServicoNaFila[]>();
    for (const s of achados) {
      const id = s.empresa.empresa.idEmpresa;
      porEmpresa.set(id, [...(porEmpresa.get(id) ?? []), s]);
    }
    return [...porEmpresa.values()].sort(
      (a, b) => b.length - a.length || a[0].empresa.empresa.nome.localeCompare(b[0].empresa.empresa.nome, "pt-BR"),
    );
  }, [todos, aba, produto, busca]);

  // A marcação vale para a tela atual: trocar de aba ou decidir limpa.
  useEffect(() => setMarcados(new Set()), [aba, todos]);

  const chaveDe = (s: ServicoNaFila) => `${s.empresa.empresa.idEmpresa}|${s.oportunidade.produto}`;
  const alternar = (s: ServicoNaFila) =>
    setMarcados((m) => {
      const novo = new Set(m);
      if (!novo.delete(chaveDe(s))) novo.add(chaveDe(s));
      return novo;
    });

  const abrir = (servicos: ServicoNaFila[], status: StatusDecisao) =>
    setJanela({
      idEmpresa: servicos[0].empresa.empresa.idEmpresa,
      nomeEmpresa: servicos[0].empresa.empresa.nome,
      servicos,
      status,
    });

  async function voltarParaFila(s: ServicoNaFila) {
    const ok = await confirmar({
      title: "Voltar para a fila?",
      description: `${NOME_PRODUTO[s.oportunidade.produto]} volta a esperar decisão e o vendedor deixa de ver. A decisão atual é apagada.`,
      confirmLabel: "Voltar para a fila",
      variant: "primary",
    });
    if (ok) desfazer.mutate({ idEmpresa: s.empresa.empresa.idEmpresa, produto: s.oportunidade.produto });
  }

  if (isLoading) return <LoadingSkeleton rows={6} />;
  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">Não foi possível carregar a fila. Tente de novo.</div>;
  }
  if (!podeLiberar) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-600">
        Só quem edita pode liberar serviços. As oportunidades liberadas estão em{" "}
        <Link href="/comercial" className="font-medium text-marca-primary underline">
          Oportunidades
        </Link>
        .
      </div>
    );
  }

  const atual = ABAS.find((a) => a.key === aba)!;

  return (
    <div className="space-y-4">
      <ConfirmHost />
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <ListChecks className="size-5 text-amber-700" /> Liberar serviços
        </h1>
        <p className="max-w-3xl text-sm text-gray-500">
          Os serviços chegam aqui quando alguém envia uma inspeção concluída ou uma AEP entregue. O vendedor só vê o que você
          liberar. Se o documento for enviado de novo, o serviço volta para a fila.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {ABAS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setAba(a.key)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-semibold",
              aba === a.key ? "border-marca-primary text-marca-primary" : "border-transparent text-gray-500 hover:text-gray-800",
            )}
          >
            {a.rotulo} <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">{contagem[a.key]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="absolute left-2.5 top-2 size-4 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar empresa, CNPJ ou município"
            aria-label="Buscar empresa, CNPJ ou município"
            className={cn(inputCls, "pl-8")}
          />
        </div>
        <select value={produto} onChange={(e) => setProduto(e.target.value as Produto | "")} aria-label="Serviço" className={cn(inputCls, "w-auto")}>
          <option value="">Todos os serviços</option>
          {PRODUTOS.map((p) => (
            <option key={p} value={p}>
              {NOME_PRODUTO[p]}
            </option>
          ))}
        </select>
      </div>

      {grupos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">{atual.vazio}</div>
      ) : (
        <ul className="space-y-3">
          {grupos.map((servicos) => {
            const c = servicos[0].empresa;
            const e = c.empresa;
            const marcadosDaqui = servicos.filter((s) => marcados.has(chaveDe(s)));
            return (
              <li key={e.idEmpresa} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
                      <Building2 className="size-4 text-gray-400" /> {e.nome}
                    </h2>
                    <p className="text-xs text-gray-500">
                      {e.cnpj ? formatCNPJ(e.cnpj) : "—"}
                      {e.municipio ? ` · ${e.municipio}${e.uf ? `/${e.uf}` : ""}` : ""}
                    </p>
                  </div>
                  {aba === "fila" && marcadosDaqui.length > 1 && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => abrir(marcadosDaqui, "LIBERADO")} className={btnLiberar}>
                        <CheckCircle2 className="size-4" /> Liberar {marcadosDaqui.length}
                      </button>
                      <button type="button" onClick={() => abrir(marcadosDaqui, "SEGURADO")} className={btnNeutro}>
                        <Hand className="size-4" /> Segurar {marcadosDaqui.length}
                      </button>
                    </div>
                  )}
                </div>

                <ul className="mt-3 divide-y divide-gray-100 border-t border-gray-100">
                  {servicos.map((s) => (
                    <li key={s.oportunidade.produto} className="flex flex-wrap items-start gap-3 py-3">
                      {aba === "fila" && (
                        <input
                          type="checkbox"
                          checked={marcados.has(chaveDe(s))}
                          onChange={() => alternar(s)}
                          aria-label={`Marcar ${NOME_PRODUTO[s.oportunidade.produto]}`}
                          className="mt-1 size-4 accent-marca-primary"
                        />
                      )}
                      <LinhaServico s={s} />
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {aba !== "liberados" && (
                          <button type="button" onClick={() => abrir([s], "LIBERADO")} className={btnLiberar}>
                            <CheckCircle2 className="size-4" /> Liberar
                          </button>
                        )}
                        {aba === "liberados" && s.estado === "liberado" && (
                          <button type="button" onClick={() => abrir([s], "LIBERADO")} className={btnNeutro}>
                            Editar
                          </button>
                        )}
                        {aba !== "segurados" && (
                          <button type="button" onClick={() => abrir([s], "SEGURADO")} className={btnNeutro}>
                            <Hand className="size-4" /> Segurar
                          </button>
                        )}
                        {aba !== "fila" && s.estado !== "legado" && (
                          <button type="button" onClick={() => voltarParaFila(s)} disabled={desfazer.isPending} className={btnNeutro}>
                            <Undo2 className="size-4" /> Voltar para a fila
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}

      {janela && <JanelaDecisao key={`${janela.idEmpresa}-${janela.status}`} janela={janela} onFechar={() => setJanela(null)} />}
    </div>
  );
}

const btnLiberar =
  "inline-flex items-center gap-1.5 rounded-lg bg-marca-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-marca-accent disabled:opacity-60";
const btnNeutro =
  "inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60";

function LinhaServico({ s }: { s: ServicoNaFila }) {
  const { oportunidade: o, decisao, estado, empresa: c } = s;
  const detalhes = o.produto === "AET" ? o.setores.map((st) => `${st.nome}${st.expostos ? ` (${st.expostos})` : ""}`) : o.detalhes;
  return (
    <div className="min-w-[16rem] flex-1 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-gray-900">{NOME_PRODUTO[o.produto]}</span>
        {o.situacao === "revisao" && (
          <span className="rounded-full border border-orange-300 bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-900">Revisão</span>
        )}
        {s.reenviado && (
          <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-900">Documento reenviado</span>
        )}
      </div>
      <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-gray-500">
        <ClipboardCheck className="size-3.5" /> Indicado por {o.origens.join(" + ")}
        {s.enviadoEm ? ` · enviado em ${fmtData(s.enviadoEm)}` : ""}
        {o.produto === "AET" && c.expostosAet > 0 ? ` · ${c.expostosAet} trabalhadores expostos` : ""}
      </p>
      {detalhes.length > 0 && (
        <p className="mt-1 text-xs text-gray-700">
          {detalhes.slice(0, 6).join(" · ")}
          {detalhes.length > 6 ? ` · + ${detalhes.length - 6}` : ""}
        </p>
      )}
      {estado === "legado" && <p className="mt-1 text-xs text-gray-500">Liberado antes da fila existir, sem decisão por serviço.</p>}
      {estado === "liberado" && decisao && (
        <p className="mt-1 text-xs text-emerald-800">
          Liberado em {fmtData(decisao.decidido_em)}
          {decisao.decidido_por ? ` por ${decisao.decidido_por}` : ""}
          {decisao.modalidades?.length ? ` · ${decisao.modalidades.join(", ")}` : ""}
          {decisao.orientacao ? ` · ${decisao.orientacao}` : ""}
        </p>
      )}
      {estado === "segurado" && decisao && (
        <p className="mt-1 text-xs text-amber-800">
          Segurado em {fmtData(decisao.decidido_em)}
          {decisao.decidido_por ? ` por ${decisao.decidido_por}` : ""}: {decisao.motivo}
        </p>
      )}
    </div>
  );
}

function JanelaDecisao({ janela, onFechar }: { janela: Janela; onFechar: () => void }) {
  const decidir = useDecidirServico();
  const liberar = janela.status === "LIBERADO";
  // Um serviço só: começa com a decisão anterior, para reenvio e edição não perderem o que foi escrito.
  const anterior = janela.servicos.length === 1 ? janela.servicos[0].decisao : null;
  const [modalidades, setModalidades] = useState<string[]>(anterior?.modalidades ?? []);
  const [orientacao, setOrientacao] = useState(anterior?.orientacao ?? "");
  const [motivo, setMotivo] = useState(anterior?.motivo ?? "");

  const comModalidade = janela.servicos.some((s) => PRODUTOS_COM_MODALIDADE.includes(s.oportunidade.produto));
  const podeGravar = liberar || motivo.trim().length > 0;

  async function gravar() {
    if (!podeGravar) return;
    try {
      await decidir.mutateAsync({
        idEmpresa: janela.idEmpresa,
        produtos: janela.servicos.map((s) => s.oportunidade.produto),
        status: janela.status,
        modalidades: comModalidade ? modalidades : [],
        orientacao: orientacao.trim() || null,
        motivo: motivo.trim() || null,
      });
      onFechar();
    } catch {
      // O toast sai no hook; a janela fica aberta com o que foi digitado.
    }
  }

  return (
    <Modal
      open
      onClose={onFechar}
      title={liberar ? "Liberar para o vendedor" : "Segurar serviço"}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onFechar} className={btnNeutro}>
            Cancelar
          </button>
          <button type="button" onClick={gravar} disabled={!podeGravar || decidir.isPending} className={btnLiberar}>
            {decidir.isPending && <Loader2 className="size-4 animate-spin" />}
            {liberar ? "Liberar" : "Segurar"}
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <div>
          <p className="font-semibold text-gray-900">{janela.nomeEmpresa}</p>
          <ul className="mt-0.5 text-xs text-gray-600">
            {janela.servicos.map((s) => (
              <li key={s.oportunidade.produto}>{NOME_PRODUTO[s.oportunidade.produto]}</li>
            ))}
          </ul>
        </div>

        {liberar ? (
          <>
            {comModalidade && (
              <fieldset>
                <legend className="mb-1 text-xs font-semibold text-gray-600">
                  <Dica texto={DICAS_COMERCIAL_LIBERAR.modalidades}>Modalidades possíveis</Dica>
                </legend>
                <div className="flex flex-wrap gap-3">
                  {MODALIDADES.map((m) => (
                    <label key={m} className="inline-flex cursor-pointer items-center gap-1.5 text-gray-700">
                      <input
                        type="checkbox"
                        checked={modalidades.includes(m)}
                        onChange={(e) => setModalidades((l) => (e.target.checked ? [...l, m] : l.filter((x) => x !== m)))}
                        className="size-4 accent-marca-primary"
                      />
                      {m}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div>
              <label htmlFor="comercial-orientacao" className="mb-1 block text-xs font-semibold text-gray-600">
                <Dica texto={DICAS_COMERCIAL_LIBERAR.orientacao}>Orientação para o vendedor (opcional)</Dica>
              </label>
              <textarea id="comercial-orientacao" rows={3} value={orientacao} onChange={(e) => setOrientacao(e.target.value)} className={inputCls} />
            </div>
          </>
        ) : (
          <div>
            <label htmlFor="comercial-motivo" className="mb-1 block text-xs font-semibold text-gray-600">
              <Dica texto={DICAS_COMERCIAL_LIBERAR.motivo}>Motivo</Dica> <span className="text-red-600">*</span>
            </label>
            <textarea id="comercial-motivo" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputCls} />
          </div>
        )}
      </div>
    </Modal>
  );
}

"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { RefreshCw, Upload } from "lucide-react";
import { useCadastroDimensionamento } from "@/lib/hooks/useDimensionamento";
import { useMutacoesDimensionamento } from "@/lib/hooks/useDimensionamentoMutacoes";
import { CONDICOES, anosDisponiveis } from "@/lib/dimensionamento/mapear";
import Calculo from "@/lib/dimensionamento/calculo";
import { Cabecalho, Carregando, Modal } from "@/components/dimensionamento/ui";
import * as ImportacaoMod from "@/lib/dimensionamento/importacao";

/**
 * Empresas por Unidade — a carteira que vence, mês a mês.
 *
 * É a tela que alimenta TUDO: o Headcount não inventa demanda, ele soma o que está aqui.
 *
 * Três coisas sobre a forma dos dados, que explicam a tabela:
 *  • O lançamento é por **condição × porte**. "Todos" mostra a soma e não deixa editar —
 *    não dá para distribuir um total entre portes sem inventar.
 *  • **Clientes ativos** é informativo: não entra no cálculo. Está aqui porque é o
 *    denominador que as pessoas usam para saber se o número faz sentido.
 *  • **Atendidas** é o que SAI da fila. Sem atendidas lançadas, a fila só cresce — e hoje
 *    a origem não tinha nenhuma (as duas tabelas vieram vazias na migração).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- módulo .js, fixtures do importador são frouxos por natureza
const Imp = ImportacaoMod as any;

const MESES = Calculo.MESES;

export default function EmpresasPage() {
  const { data: cadastro, isLoading } = useCadastroDimensionamento();
  const { definirDemanda, definirUnidadeMes, substituirDemandaAno } = useMutacoesDimensionamento();

  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [unidadeId, setUnidadeId] = useState("");
  const [porte, setPorte] = useState("");
  const [importando, setImportando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);

  const anos = useMemo(() => (cadastro ? anosDisponiveis(cadastro.unidades, ano) : [ano]), [cadastro, ano]);

  if (isLoading || !cadastro) return <Carregando />;

  const unidades = unidadeId ? cadastro.unidades.filter((u) => u.id === unidadeId) : cadastro.unidades;
  const portes = cadastro.portes;
  const somandoTudo = porte === "";

  const valor = (uId: string, mes: number, condicao: string) => {
    const m = (cadastro.unidades.find((u) => u.id === uId)?.mesesPorAno?.[ano] ?? {})[mes] as
      | { demanda?: Record<string, Record<string, number>> }
      | undefined;
    const d = m?.demanda?.[condicao] ?? {};
    return somandoTudo
      ? Object.values(d).reduce((s, q) => s + (Number(q) || 0), 0)
      : Number(d[porte] ?? 0);
  };
  const informativo = (uId: string, mes: number, campo: "clientesAtivos" | "atendidas") => {
    const m = (cadastro.unidades.find((u) => u.id === uId)?.mesesPorAno?.[ano] ?? {})[mes] as
      | Record<string, unknown>
      | undefined;
    return Number(m?.[campo] ?? 0);
  };

  async function sincronizar() {
    setSincronizando(true);
    try {
      const r = await fetch("/api/dimensionamento/sincronizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ano, aplicar: false }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? `A sincronização respondeu ${r.status}`);
      const aplicaveis = (j.unidades ?? []).filter((u: { aplicar: boolean }) => u.aplicar).length;
      const texto = `Prévia de ${ano}: ${aplicaveis} unidade(s) com cobertura utilizável, ` +
        `${j.resumo?.demanda ?? 0} lançamentos de demanda. Aplicar?`;
      if (!confirm(texto)) return;

      const r2 = await fetch("/api/dimensionamento/sincronizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ano, aplicar: true }),
      });
      const j2 = await r2.json();
      if (!r2.ok) throw new Error(j2?.error ?? `A gravação respondeu ${r2.status}`);
      toast.success(`Sincronizado: ${j2.resumo?.demanda ?? 0} lançamentos em ${ano}`);
      window.location.reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSincronizando(false);
    }
  }

  return (
    <div className="space-y-5">
      <Cabecalho
        titulo="Empresas por Unidade"
        descricao="A carteira que vence em cada mês, por condição e porte. É daqui que sai toda a demanda do Headcount."
        acao={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setImportando(true)}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Upload className="size-4" /> Importar planilha
            </button>
            <button
              type="button"
              onClick={sincronizar}
              disabled={sincronizando}
              className="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            >
              <RefreshCw className={`size-4 ${sincronizando ? "animate-spin" : ""}`} />
              {sincronizando ? "Consultando…" : "Sincronizar com a API"}
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ano</span>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Unidade</span>
          <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">Todas as unidades</option>
            {cadastro.unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Porte</span>
          <select value={porte} onChange={(e) => setPorte(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">Todos (só leitura)</option>
            {portes.map((p) => <option key={p.codigo} value={p.codigo}>{p.codigo} — {p.nome} (peso {p.peso})</option>)}
          </select>
        </label>
      </div>

      {somandoTudo && (
        <p className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-600">
          Com <strong>Todos</strong> a tabela mostra a soma dos portes e não aceita edição —
          distribuir um total entre portes exigiria inventar. Escolha um porte para lançar.
        </p>
      )}

      {unidades.map((u) => (
        <section key={u.id} className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="font-semibold text-slate-900">{u.nome}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Linha</th>
                  {MESES.map((m) => <th key={m} className="px-2 py-2 text-right font-semibold">{m}</th>)}
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {CONDICOES.map((c) => {
                  const total = MESES.reduce((s, _, i) => s + valor(u.id, i + 1, c.condicao), 0);
                  return (
                    <tr key={c.condicao}>
                      <td className="px-4 py-1.5 font-medium text-slate-800" title={c.ajuda}>{c.rotulo}</td>
                      {MESES.map((_, i) => (
                        <td key={i} className="px-1 py-1 text-right">
                          <input
                            type="number" min={0} step={1}
                            disabled={somandoTudo}
                            defaultValue={valor(u.id, i + 1, c.condicao)}
                            key={`${u.id}-${ano}-${porte}-${c.condicao}-${i}-${valor(u.id, i + 1, c.condicao)}`}
                            onBlur={(e) => {
                              const q = Math.max(0, Math.round(Number(e.target.value) || 0));
                              if (q === valor(u.id, i + 1, c.condicao)) return;
                              definirDemanda.mutate({ unidadeId: u.id, ano, mes: i + 1, condicao: c.condicao, porte, quantidade: q });
                            }}
                            className="w-16 rounded border border-slate-200 px-2 py-1 text-right text-sm tabular-nums disabled:border-transparent disabled:bg-transparent disabled:text-slate-600"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{total}</td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-50/60">
                  <td className="px-4 py-1.5 text-slate-600">Clientes ativos <span className="text-xs text-slate-400">(informativo)</span></td>
                  {MESES.map((_, i) => (
                    <td key={i} className="px-1 py-1 text-right">
                      <input
                        type="number" min={0} step={1}
                        defaultValue={informativo(u.id, i + 1, "clientesAtivos")}
                        key={`ca-${u.id}-${ano}-${i}-${informativo(u.id, i + 1, "clientesAtivos")}`}
                        onBlur={(e) => {
                          const v = Math.max(0, Math.round(Number(e.target.value) || 0));
                          if (v === informativo(u.id, i + 1, "clientesAtivos")) return;
                          definirUnidadeMes.mutate({
                            unidadeId: u.id, ano, mes: i + 1, clientesAtivos: v,
                            atendidas: informativo(u.id, i + 1, "atendidas"),
                          });
                        }}
                        className="w-16 rounded border border-slate-200 px-2 py-1 text-right text-sm tabular-nums"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">
                    {MESES.reduce((s, _, i) => s + informativo(u.id, i + 1, "clientesAtivos"), 0)}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-1.5 font-medium text-slate-800">Atendidas no mês <span className="text-xs text-slate-400">(sai da fila)</span></td>
                  {MESES.map((_, i) => (
                    <td key={i} className="px-1 py-1 text-right">
                      <input
                        type="number" min={0} step={1}
                        defaultValue={informativo(u.id, i + 1, "atendidas")}
                        key={`at-${u.id}-${ano}-${i}-${informativo(u.id, i + 1, "atendidas")}`}
                        onBlur={(e) => {
                          const v = Math.max(0, Math.round(Number(e.target.value) || 0));
                          if (v === informativo(u.id, i + 1, "atendidas")) return;
                          definirUnidadeMes.mutate({
                            unidadeId: u.id, ano, mes: i + 1, atendidas: v,
                            clientesAtivos: informativo(u.id, i + 1, "clientesAtivos"),
                          });
                        }}
                        className="w-16 rounded border border-slate-200 px-2 py-1 text-right text-sm tabular-nums"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
                    {MESES.reduce((s, _, i) => s + informativo(u.id, i + 1, "atendidas"), 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {importando && (
        <ImportarPlanilha
          ano={ano}
          unidades={cadastro.unidades}
          portes={portes.map((p) => p.codigo)}
          aoFechar={() => setImportando(false)}
          aoAplicar={(linhas, condicao) =>
            substituirDemandaAno.mutate(
              { ano, linhas, condicao },
              { onSuccess: () => { setImportando(false); window.location.reload(); } },
            )}
          aplicando={substituirDemandaAno.isPending}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- importação */

function ImportarPlanilha({
  ano, unidades, portes, aoFechar, aoAplicar, aplicando,
}: {
  ano: number;
  unidades: Array<{ id: string; nome: string }>;
  portes: string[];
  aoFechar: () => void;
  aoAplicar: (linhas: unknown[], condicao: string) => void;
  aplicando: boolean;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- retorno do importador .js
  const [abas, setAbas] = useState<any[] | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [resumo, setResumo] = useState<any | null>(null);
  const [condicao, setCondicao] = useState("mensal");
  const [erro, setErro] = useState("");

  async function ler(arquivo: File) {
    setErro("");
    try {
      const buf = await arquivo.arrayBuffer();
      const { abas } = Imp.lerPlanilha(buf);
      setAbas(abas);
      const aba = abas[0];
      if (!aba?.cabecalhos?.length) throw new Error("A planilha não tem uma linha de cabeçalho reconhecível.");
      const mapa = Imp.detectarColunas(aba.cabecalhos);
      const r = Imp.resumir(aba.linhas, mapa, {
        ano, condicaoFixa: condicao, codigosPorte: portes, contarPor: "cliente",
      });
      setResumo(r);
    } catch (e) {
      setErro((e as Error).message);
      setResumo(null);
    }
  }

  const mapaUnidades = resumo ? Imp.casarUnidades(Object.keys(resumo.porUnidade ?? {}), unidades) : {};
  const semCasar = Object.entries(mapaUnidades).filter(([, id]) => !id).map(([nome]) => nome);
  const linhasRpc = resumo ? Imp.montarLinhasRpc(resumo.porUnidade, mapaUnidades) : [];

  return (
    <Modal titulo={`Importar planilha — ${ano}`} aoFechar={aoFechar}>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <p className="text-sm text-slate-600">
          A importação <strong>substitui</strong> os lançamentos da condição escolhida, no ano
          selecionado, nas unidades presentes no arquivo. O que não estiver no arquivo, nessas
          unidades, é apagado — por isso a prévia mostra o que vai entrar antes.
        </p>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Condição a substituir</span>
          <select value={condicao} onChange={(e) => setCondicao(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {CONDICOES.map((c) => <option key={c.condicao} value={c.condicao}>{c.rotulo}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Arquivo (.xlsx ou .csv)</span>
          <input
            type="file" accept=".xlsx,.xls,.csv"
            onChange={(e) => e.target.files?.[0] && ler(e.target.files[0])}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        {erro && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{erro}</p>}

        {resumo && (
          <div className="space-y-3">
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                <strong>{resumo.linhasUsadas}</strong> de {resumo.totalLinhas} linhas entram
                {resumo.anosEncontrados?.length > 1 && ` (anos no arquivo: ${resumo.anosEncontrados.join(", ")})`}.
              </p>
              {(resumo.avisos ?? []).map((a: string, i: number) => (
                <p key={i} className="mt-1 text-amber-700">⚠ {a}</p>
              ))}
              {semCasar.length > 0 && (
                <p className="mt-1 text-rose-700">
                  Sem correspondência no cadastro (serão ignoradas): {semCasar.join(", ")}
                </p>
              )}
            </div>

            <div className="overflow-hidden rounded-lg ring-1 ring-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr><th className="px-3 py-2">Unidade no arquivo</th><th className="px-3 py-2">Vai para</th><th className="px-3 py-2 text-right">Lançamentos</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.keys(resumo.porUnidade ?? {}).map((nome) => {
                    const id = mapaUnidades[nome];
                    const n = linhasRpc.filter((l: { unidade_id: string }) => l.unidade_id === id).length;
                    return (
                      <tr key={nome}>
                        <td className="px-3 py-1.5">{nome}</td>
                        <td className="px-3 py-1.5">
                          {id ? unidades.find((u) => u.id === id)?.nome : <span className="text-rose-700">— ignorada —</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{n}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={aoFechar} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancelar</button>
          <button
            type="button"
            disabled={!linhasRpc.length || aplicando}
            onClick={() => {
              if (confirm(`Substituir os lançamentos de "${CONDICOES.find((c) => c.condicao === condicao)?.rotulo}" em ${ano}?\n\n${linhasRpc.length} lançamento(s) entram; o que não estiver no arquivo, nessas unidades, sai.`)) {
                aoAplicar(linhasRpc, condicao);
              }
            }}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {aplicando ? "Aplicando…" : `Aplicar ${linhasRpc.length} lançamento(s)`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

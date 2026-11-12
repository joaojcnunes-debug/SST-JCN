"use client";

// Conciliação DRPS/QPS × AEP de UM grupo de empresas (12/11/2026, v0.3.285, banco v354).
//
// A mesma tela da conciliação por empresa, com o grupo inteiro: a AEP mais recente de cada empresa do grupo
// e o DRPS/QPS mais recente de cada empresa entram juntos, setor × fator, com a mesma régua. No mesmo
// cruzamento vale o pior nível, e cada nível diz de qual empresa veio (a parte da filial do CNPJ).
// Parecer, ligação de setores, fechamento, reabertura e PDF são do grupo (tabelas psico_conciliacao_grupo_*).
// O parecer Confirmar/AET cria a ação 5W2H em cada empresa do grupo que tem o setor.
//
// v0.3.286: a padronização de setores (aba Setores) e os fatores ignorados da Consolidação do grupo valem aqui
// também, para o relatório do grupo e o que vai ao Comercial baterem. "Ligar à mão" fica para o que faltar.
//
// Ainda sem a etapa do Comercial (intervenções e liberar): vem numa próxima versão.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarClock, CheckCircle2, ChevronRight, ClipboardCheck, Network } from "lucide-react";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { ConfirmHost } from "@/components/ui/confirm";
import { COR_CLASSE, EXPLICACAO_CLASSE } from "@/components/psico-consolidacao/ConciliacaoSelos";
import ParecerModal, { type ContextoParecer } from "@/components/psico-consolidacao/ParecerModal";
import LigacaoSetores from "@/components/psico-consolidacao/LigacaoSetores";
import FechamentosConciliacao, { type FotoFechamento } from "@/components/psico-consolidacao/FechamentosConciliacao";
import { CelulaAep, CelulasQuestionario, Colunas } from "@/components/psico-consolidacao/CelulasConciliacao";
import { TituloEtapa } from "@/components/psico-consolidacao/LiberarParaComercial";
import { useFontesConciliacao, usePsicoCatalogo, useSetoresDoGrupo } from "@/lib/hooks/usePsicoConsolidacao";
import { useRegistrosConciliacaoGrupo } from "@/lib/hooks/useConciliacaoParecer";
import { useGruposEmpresas } from "@/lib/hooks/useGruposEmpresas";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import {
  CLASSES,
  CLASSES_COMPARACAO,
  CLASSES_FONTE_UNICA,
  DIVERGENCIAS,
  chaveParecer,
  conciliarEmpresa,
  contarPareceres,
  indexarPareceres,
  situacaoParecer,
  type CelulaConciliacao,
  type ClasseConciliacao,
  type Questionario,
} from "@/lib/psico-consolidacao/conciliacao";
import {
  ORIGENS_GRUPO,
  alertasRevisaoGrupo,
  documentosDoGrupo,
  empresasDoSetorConciliado,
  itensDoFechamentoGrupo,
  padronizacaoDoGrupo,
  rotuloEmpresa,
} from "@/lib/psico-consolidacao/conciliacao-grupo";
import { hojeSP } from "@/lib/inspecoes/prioridade";
import { cn, fmtData, formatCNPJ } from "@/lib/utils";

const sel =
  "rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-800 focus:border-marca-primary focus:outline-none focus:ring-2 focus:ring-marca-primary/20";

type Ordem = "prioridade" | "setor";

export default function ConciliacaoGrupoPage() {
  const { idGrupo: bruto } = useParams<{ idGrupo: string }>();
  const idGrupo = decodeURIComponent(bruto);
  const { grupos, membrosPorGrupo, isLoading: carregandoGrupos, error: erroGrupos } = useGruposEmpresas();
  const grupo = grupos.find((g) => g.id_grupo === idGrupo) ?? null;
  const membros = useMemo(
    () => [...(membrosPorGrupo.get(idGrupo) ?? [])].sort((a, b) => a.nome_empresa.localeCompare(b.nome_empresa, "pt-BR") || (a.cnpj ?? "").localeCompare(b.cnpj ?? "")),
    [membrosPorGrupo, idGrupo],
  );
  const foraDoAcesso = membros.some((m) => !m.visivel);
  const ids = useMemo(() => membros.map((m) => m.id_empresa), [membros]);
  const fontes = useFontesConciliacao(ids, { enabled: ids.length > 0 && !foraDoAcesso });
  const catalogo = usePsicoCatalogo();
  const registros = useRegistrosConciliacaoGrupo(idGrupo);
  const setoresGrupo = useSetoresDoGrupo(idGrupo);
  const podeEditar = useCanEdit();

  const [classes, setClasses] = useState<Set<ClasseConciliacao>>(() => new Set(DIVERGENCIAS));
  const [soPendentes, setSoPendentes] = useState(false);
  const [setor, setSetor] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("prioridade");
  const [parecerAberto, setParecerAberto] = useState<ContextoParecer | null>(null);

  const rotulos = useMemo(() => new Map(membros.map((m) => [m.id_empresa, rotuloEmpresa({ nome: m.nome_empresa, cnpj: m.cnpj })])), [membros]);
  const rotulo = useMemo(() => (idEmpresa: string) => rotulos.get(idEmpresa) ?? idEmpresa, [rotulos]);

  const docs = useMemo(() => documentosDoGrupo(fontes.data?.documentos ?? [], ids), [fontes.data, ids]);
  const usados = useMemo(() => new Set(docs.map((d) => d.id)), [docs]);
  const ligacoes = useMemo(() => registros.data?.ligacoes ?? [], [registros.data]);
  const padronizacao = useMemo(
    () => padronizacaoDoGrupo(setoresGrupo.data?.canonicos ?? [], setoresGrupo.data?.depara ?? []),
    [setoresGrupo.data],
  );
  const ignorados = useMemo(() => grupo?.psico_fatores_ignorados ?? [], [grupo]);

  const resultado = useMemo(() => {
    if (!fontes.data || !catalogo.data || !setoresGrupo.data) return null;
    const doGrupo = new Set(ids);
    return conciliarEmpresa({
      linhas: fontes.data.linhas.filter((l) => doGrupo.has(l.idEmpresa)),
      pendencias: fontes.data.pendencias.filter((p) => doGrupo.has(p.idEmpresa)),
      setoresAep: fontes.data.setoresAep,
      documentos: usados,
      fatores: catalogo.data.fatores,
      depara: catalogo.data.depara,
      deparaSetores: ligacoes,
      setorPadronizado: padronizacao.setorDe,
      fatoresIgnorados: ignorados,
    });
  }, [fontes.data, catalogo.data, setoresGrupo.data, ids, usados, ligacoes, padronizacao, ignorados]);

  const ultimoFechamento = registros.data?.fechamentos[0] ?? null;
  const fechada = !!ultimoFechamento && !ultimoFechamento.reabertura;
  const alertas = useMemo(
    () => alertasRevisaoGrupo({ documentos: docs, ultimoFechamento, hoje: hojeSP(), rotulo }),
    [docs, ultimoFechamento, rotulo],
  );

  const pareceres = useMemo(() => indexarPareceres(registros.data?.pareceres ?? []), [registros.data]);
  const contagem = useMemo(
    () => (resultado ? contarPareceres(resultado, pareceres) : { pendentes: 0, semAcao: 0, desatualizados: 0, comParecer: 0 }),
    [resultado, pareceres],
  );
  const setorPorChave = useMemo(() => new Map((resultado?.setores ?? []).map((s) => [s.chave, s])), [resultado]);
  const nomeFator = useMemo(() => new Map((catalogo.data?.fatores ?? []).map((f) => [f.id_fator, f.nome_curto || f.nome])), [catalogo.data]);

  const visiveis = useMemo(() => {
    if (!resultado) return [];
    const qs = resultado.questionarios;
    const lista = resultado.celulas.filter((c) => {
      if (setor && c.chaveSetor !== setor) return false;
      if (soPendentes) {
        return qs.some((q) => {
          const s = situacaoParecer(c.classe[q], pareceres.get(chaveParecer(c.chaveSetor, c.idFator, q)));
          return s === "pendente" || s === "desatualizado" || s === "sem-acao";
        });
      }
      return qs.some((q) => c.classe[q] && classes.has(c.classe[q]!));
    });
    if (ordem === "prioridade") {
      const p = (c: CelulaConciliacao) => Math.max(...qs.map((q) => c.prioridade[q]));
      lista.sort((a, b) => p(b) - p(a));
    }
    return lista;
  }, [resultado, classes, setor, soPendentes, ordem, pareceres]);

  const alternar = (c: ClasseConciliacao) => {
    setSoPendentes(false);
    setClasses((atual) => {
      const n = new Set(atual);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  };

  const abrirParecer = (c: CelulaConciliacao, q: Questionario) => {
    const s = setorPorChave.get(c.chaveSetor);
    setParecerAberto({
      alvo: { tipo: "grupo", id: idGrupo },
      grupo: { nome: grupo?.nome ?? idGrupo, empresasAcao: s ? empresasDoSetorConciliado(s.empresas) : [], rotulo },
      celula: c,
      questionario: q,
      fator: nomeFator.get(c.idFator) ?? c.idFator,
      expostos: s?.expostos ?? null,
      necessitaAet: s?.necessitaAet ?? false,
      fonteUnica: resultado?.fonteUnica ?? false,
      documentos: docs.map((d) => d.id),
      atual: pareceres.get(chaveParecer(c.chaveSetor, c.idFator, q)),
    });
  };

  const montarFechamento = (): FotoFechamento => ({
    documentos: docs.map((d) => ({ origem: d.origem, id: d.id, titulo: d.titulo, data: d.data, id_empresa: d.idEmpresa })),
    resumo: {
      totais: resultado?.totais ?? {},
      pareceres: contagem,
      questionarios: resultado?.questionarios ?? [],
      ...(resultado?.fonteUnica ? { fonte_unica: true } : {}),
    },
    itens: resultado ? itensDoFechamentoGrupo(resultado, pareceres, (id) => nomeFator.get(id) ?? id, rotulo) : [],
    grupo: { nome: grupo?.nome ?? idGrupo, empresas: membros.map((m) => ({ id_empresa: m.id_empresa, nome: m.nome_empresa, cnpj: m.cnpj })) },
  });

  if (carregandoGrupos || (ids.length > 0 && !foraDoAcesso && fontes.isLoading) || catalogo.isLoading || registros.isLoading || setoresGrupo.isLoading) return <LoadingSkeleton />;
  const erro = erroGrupos ?? fontes.error ?? catalogo.error ?? registros.error ?? setoresGrupo.error;
  if (erro) {
    return <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Não foi possível carregar: {(erro as Error).message}</p>;
  }
  if (!grupo || membros.length === 0 || foraDoAcesso || !resultado) {
    return (
      <div className="space-y-3">
        <Voltar />
        <p className="text-sm text-gray-500">
          {!grupo ? "Grupo não encontrado." : membros.length === 0 ? "O grupo não tem empresas." : "O grupo tem empresa fora do seu acesso."}
        </p>
      </div>
    );
  }

  const podeConciliar = resultado.questionarios.length > 0;
  const { fonteUnica } = resultado;
  const tituloEtapa1 = fonteUnica ? "Avaliar" : "Comparar";
  const classesTela = fonteUnica ? CLASSES_FONTE_UNICA : CLASSES_COMPARACAO;
  const podeTrabalhar = podeEditar;

  return (
    <div className="space-y-4">
      <Voltar />
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Network className="size-5 text-indigo-600" />
          {grupo.nome}
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Grupo de {membros.length} empresa(s) · a AEP e o DRPS/QPS mais recentes de cada uma entram juntos na comparação.
        </p>
      </div>

      {podeConciliar && (
        <nav aria-label="Etapas da conciliação" className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm">
          {[
            { id: "etapa-comparar", titulo: tituloEtapa1, feita: contagem.pendentes + contagem.desatualizados === 0 },
            { id: "etapa-fechar", titulo: "Fechar", feita: fechada },
          ].map((e, i) => (
            <span key={e.id} className="inline-flex items-center gap-2">
              {i > 0 && <ChevronRight className="size-3.5 text-gray-300" />}
              <a href={`#${e.id}`} className={cn("inline-flex items-center gap-1.5 hover:underline", e.feita ? "font-medium text-emerald-700" : "text-gray-700")}>
                {e.feita ? <CheckCircle2 className="size-4" /> : <span className="flex size-4 items-center justify-center rounded-full border border-gray-300 text-[10px] text-gray-500">{i + 1}</span>}
                {e.titulo}
              </a>
            </span>
          ))}
          <span className="ml-auto rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-800">
            {fechada ? "Fechada" : ultimoFechamento?.reabertura ? "Reaberta" : "Em conciliação"}
          </span>
        </nav>
      )}

      {fonteUnica && (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          No grupo só há {resultado.temAep ? "AEP" : resultado.questionarios.join(" e ")}: não há {resultado.temAep ? "questionário" : "AEP"} para comparar.
          {!fechada && " Dê parecer no que os documentos apontam e feche."}
        </p>
      )}

      {alertas.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="mb-1 flex items-center gap-1.5 font-semibold">
            <CalendarClock className="size-4" /> Revisão
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-xs">
            {alertas.map((a) => (
              <li key={a.texto}>{a.texto}</li>
            ))}
          </ul>
        </div>
      )}

      {podeConciliar && <div id="etapa-comparar" className="scroll-mt-20"><TituloEtapa numero={1} titulo={tituloEtapa1} /></div>}

      {/* ── Empresas e documentos usados ─────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              <th className="px-4 py-2.5">Empresa do grupo</th>
              {ORIGENS_GRUPO.map((o) => (
                <th key={o} className="px-3 py-2.5">{o === "QPS" ? "QPS (questionário)" : o}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {membros.map((m) => (
              <tr key={m.id_empresa} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/consolidacao-grupo/conciliacao/${encodeURIComponent(m.id_empresa)}`} className="font-medium text-gray-900 hover:text-indigo-700 hover:underline" title="Abrir a conciliação só desta empresa">
                    {m.nome_empresa}
                  </Link>
                  <p className="text-[11px] text-gray-400">
                    {[m.cnpj ? formatCNPJ(m.cnpj) : null, m.papel_grupo === "MATRIZ" ? "Matriz" : "Filial", m.unidade_nome].filter(Boolean).join(" · ")}
                  </p>
                </td>
                {ORIGENS_GRUPO.map((o) => {
                  const d = docs.find((x) => x.idEmpresa === m.id_empresa && x.origem === o);
                  return (
                    <td key={o} className="whitespace-nowrap px-3 py-2 text-xs">
                      {d ? <span className="text-gray-700" title={d.titulo}>{d.data ? fmtData(d.data) : "sem data"}</span> : <span className="text-gray-300">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-500">
          Entra o documento concluído (DRPS/QPS: concluído ou enviado ao cliente) mais recente de cada empresa. Para comparar uma empresa sozinha,
          ou escolher outro documento, abra a empresa.
        </p>
        <p className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-500">
          Igual à Consolidação do grupo (
          <Link href="/consolidacao-grupo" className="text-indigo-700 hover:underline">Grupos de empresas</Link>
          ): {padronizacao.confirmados > 0 ? `${padronizacao.confirmados} nome(s) de setor padronizado(s) na aba Setores` : "nenhum setor padronizado na aba Setores ainda"}
          {ignorados.length > 0 ? ` e ${ignorados.length} fator(es) deixado(s) de fora` : ""}. O que mudar lá muda aqui.
        </p>
      </div>

      {!podeConciliar ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Nenhuma empresa do grupo tem AEP ou questionário concluído.
        </p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {resultado.questionarios.map((q) => (
              <div key={q} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="mb-2 text-sm font-semibold text-gray-800">{fonteUnica ? q : `${q} × AEP`}</p>
                <div className="flex flex-wrap gap-1.5">
                  {classesTela.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => alternar(c)}
                      title={EXPLICACAO_CLASSE[c]}
                      className={cn("rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition", COR_CLASSE[c], (soPendentes || !classes.has(c)) && "opacity-40")}
                    >
                      {c} <span className="font-bold">{resultado.totais[q][c]}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                <ClipboardCheck className="size-4 text-indigo-600" /> Pareceres
              </p>
              <ul className="space-y-1 text-xs text-gray-600">
                <li>
                  <b className={contagem.pendentes > 0 ? "text-amber-700" : "text-emerald-700"}>{contagem.pendentes}</b> {fonteUnica ? "apontado(s)" : "divergência(s)"} sem parecer
                </li>
                <li>
                  <b className={contagem.semAcao > 0 ? "text-amber-700" : "text-gray-700"}>{contagem.semAcao}</b> risco(s) apontado(s) sem ação no plano
                </li>
                {contagem.desatualizados > 0 && (
                  <li>
                    <b className="text-amber-700">{contagem.desatualizados}</b> parecer(es) de outra situação — rever
                  </li>
                )}
                <li>
                  <b className="text-gray-700">{contagem.comParecer}</b> com parecer
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select value={setor} onChange={(e) => setSetor(e.target.value)} className={sel}>
              <option value="">Todos os setores</option>
              {resultado.setores.map((s) => (
                <option key={s.chave} value={s.chave}>{s.setor}</option>
              ))}
            </select>
            <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} className={sel} title="Ordem da tabela">
              <option value="prioridade">Mais importantes primeiro</option>
              <option value="setor">Por setor</option>
            </select>
            <button type="button" onClick={() => { setSoPendentes(false); setClasses(new Set(DIVERGENCIAS)); }} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
              {fonteUnica ? "Só o que foi apontado" : "Só divergências"}
            </button>
            <button
              type="button"
              onClick={() => setSoPendentes((v) => !v)}
              className={cn("rounded-lg border px-2.5 py-1.5 text-xs", soPendentes ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50")}
            >
              O que falta resolver
            </button>
            <button type="button" onClick={() => { setSoPendentes(false); setClasses(new Set(CLASSES)); }} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
              Mostrar tudo
            </button>
            <span className="text-xs text-gray-400">
              {visiveis.length} de {resultado.celulas.length} cruzamentos setor × fator
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            {visiveis.length === 0 ? (
              <p className="p-10 text-center text-sm text-gray-500">
                {soPendentes ? `Nada a resolver: ${fonteUnica ? "todo item apontado" : "toda divergência"} tem parecer e ação.` : "Nenhum cruzamento nas classes marcadas."}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-3">Setor</th>
                    <th className="px-3 py-3">Fator</th>
                    {resultado.temAep && <th className="px-3 py-3">AEP (técnico)</th>}
                    {resultado.questionarios.map((q) => (
                      <Colunas key={q} q={q} fonteUnica={fonteUnica} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((c) => {
                    const s = setorPorChave.get(c.chaveSetor);
                    const emps = s ? empresasDoSetorConciliado(s.empresas) : [];
                    return (
                      <tr key={`${c.chaveSetor}|${c.idFator}`} className="border-b border-gray-50 align-top last:border-0">
                        <td className="px-4 py-2.5">
                          <span className="font-medium text-gray-900">{c.setor}</span>
                          {emps.length > 0 && (
                            <p className="text-[11px] text-gray-400" title={emps.map((e) => membros.find((m) => m.id_empresa === e)?.nome_empresa ?? e).join("\n")}>
                              {emps.length === 1 ? "empresa" : "empresas"} {emps.map(rotulo).join(", ")}
                            </p>
                          )}
                          {s?.expostos != null && <p className="text-[11px] text-gray-400">{s.expostos} expostos</p>}
                          {s?.necessitaAet && <p className="text-[11px] font-medium text-indigo-700">AEP indica AET</p>}
                        </td>
                        <td className="px-3 py-2.5 text-gray-700">{nomeFator.get(c.idFator) ?? c.idFator}</td>
                        {resultado.temAep && <td className="px-3 py-2.5"><CelulaAep c={c} rotulo={rotulo} /></td>}
                        {resultado.questionarios.map((q) => (
                          <CelulasQuestionario
                            key={q}
                            c={c}
                            q={q}
                            setor={s}
                            parecer={pareceres.get(chaveParecer(c.chaveSetor, c.idFator, q))}
                            podeEditar={podeTrabalhar && !fechada}
                            onParecer={() => abrirParecer(c, q)}
                            rotulo={rotulo}
                          />
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {podeConciliar && !fonteUnica && (
        <LigacaoSetores alvo={{ tipo: "grupo", id: idGrupo }} setores={resultado.setores} ligacoes={ligacoes} podeEditar={podeTrabalhar && !fechada} />
      )}

      {resultado.linhasSemFator > 0 && (
        <p className="text-xs text-gray-500">
          {resultado.linhasSemFator} linha(s) dos questionários ficaram fora por não terem fator correspondente no catálogo (aba Fatores da Consolidação).
        </p>
      )}

      {podeConciliar && (
        <section id="etapa-fechar" className="scroll-mt-20">
          <TituloEtapa numero={2} titulo="Fechar" />
          <FechamentosConciliacao
            alvo={{ tipo: "grupo", id: idGrupo }}
            historico={registros.data?.fechamentos ?? []}
            contagem={contagem}
            podeEditar={podeTrabalhar}
            podeReabrirConciliacao={podeEditar}
            podeFechar={(fonteUnica || resultado.setoresEmComum > 0) && !fechada}
            montar={montarFechamento}
          />
        </section>
      )}

      <details className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600 shadow-sm">
        <summary className="cursor-pointer font-semibold text-gray-800">Como comparamos no grupo (método)</summary>
        <div className="mt-3 space-y-2 text-xs leading-relaxed">
          <p>
            A régua é a mesma da conciliação por empresa (veja &quot;Como comparamos&quot; na tela de uma empresa): escala de 4 degraus,
            o questionário aponta a partir de Médio e a AEP com o fator &quot;Sim&quot; e AIHA a partir de Moderado.
          </p>
          <p>
            <b>No grupo</b> entram juntos a AEP mais recente de cada empresa e o DRPS/QPS mais recente de cada empresa. Os setores
            se juntam pela padronização da aba Setores da Consolidação do grupo (o que foi confirmado lá), pelo nome sugerido no
            resto e pelas ligações feitas aqui; os fatores deixados de fora na Consolidação também ficam fora aqui. Se o mesmo setor e fator aparecem em mais de uma empresa,
            vale o <b>pior nível</b> de cada fonte, e a tabela mostra de qual empresa ele veio. Os expostos do setor são a soma das
            AEPs; os respondentes, o maior número entre os questionários.
          </p>
          <p>
            <b>Parecer</b>: Confirmar e AET criam a ação 5W2H no Plano de Ação de cada empresa do grupo em que o setor aparece.
            <b> Fechar</b> guarda a foto do grupo (empresas, documentos de cada uma, régua, resultados e pareceres), que não muda
            mais, com o PDF para anexar ao PGR de cada empresa.
          </p>
        </div>
      </details>

      <ConfirmHost />
      {parecerAberto && <ParecerModal ctx={parecerAberto} podeEditar={podeTrabalhar && !fechada} onClose={() => setParecerAberto(null)} />}
    </div>
  );
}

function Voltar() {
  return (
    <Link href="/consolidacao-grupo/conciliacao-grupo" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline">
      <ArrowLeft className="size-3.5" /> Todos os grupos
    </Link>
  );
}

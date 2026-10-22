"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, BadgeCheck, CheckCircle2, ChevronDown, ChevronRight, Clock, FileDown, FileSpreadsheet, Loader2, Presentation, Save } from "lucide-react";
import toast from "react-hot-toast";
import { baixarApresentacao } from "./baixar-apresentacao";
import { baixarLancamento } from "./baixar-lancamento";
import { cn, fmtData, fmtDataHora, gerarId } from "@/lib/utils";
import type { DocumentoFonte } from "@/lib/psico-consolidacao/fontes";
import type { PsicoSetorCanonico } from "@/lib/supabase/types";
import {
  assinaturaResultado,
  montarRegistro,
  validacaoVigente,
  type Decisao,
  type ExecucaoLinha,
  type ValidacaoLinha,
} from "@/lib/psico-consolidacao/registro";
import { useRegistrarConsolidacao, useRegistrarValidacao, useRegistrosDoGrupo } from "@/lib/hooks/usePsicoConsolidacao";
import { chaveSetor } from "@/lib/psico-consolidacao/setores";
import { Cartao, Secao, Vazio, type Analise } from "./comum";

const ROTULO: Record<Decisao, string> = { VALIDADO: "Validado", COM_RESSALVA: "Com ressalva" };

/**
 * Fase 7 — o registro da consolidação (a versão enviada ao cliente, imutável) e a
 * validação do cliente, empresa por empresa. Nada se apaga nem se edita: um registro
 * novo fica ao lado do anterior; uma validação nova vale sobre a anterior.
 */
export default function AbaValidacao({
  a,
  idGrupo,
  documentos,
  canonicos,
  ignorados,
  incluirTrivial,
  setoresSemConfirmacao,
  podeEditar,
  grupoNome,
  nomeCurto,
}: {
  grupoNome: string;
  nomeCurto: (id: string) => string;
  a: Analise;
  idGrupo: string;
  documentos: DocumentoFonte[];
  canonicos: PsicoSetorCanonico[];
  ignorados: string[];
  incluirTrivial: boolean;
  setoresSemConfirmacao: number;
  podeEditar: boolean;
}) {
  const { r, nomeEmpresa } = a;
  const registros = useRegistrosDoGrupo(idGrupo);
  const registrar = useRegistrarConsolidacao(idGrupo);
  const [observacao, setObservacao] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);

  const assinaturaAtual = useMemo(() => assinaturaResultado(r), [r]);
  const execucoes = registros.data?.execucoes ?? [];
  const vigentes = useMemo(() => validacaoVigente(registros.data?.validacoes ?? []), [registros.data]);
  const ultimo = execucoes[0] ?? null;
  const igualAoUltimo = ultimo?.parametros.assinatura === assinaturaAtual && ultimo.parametros.incluir_trivial_baixo === incluirTrivial;

  const salvar = () => {
    const porNome = new Map(canonicos.map((c) => [chaveSetor(c.nome), c.id_setor_canonico]));
    registrar.mutate(
      montarRegistro({
        idExecucao: gerarId("PCX"),
        idGrupo,
        r,
        itens: a.itens,
        documentos,
        idSetorCanonico: (nome) => porNome.get(chaveSetor(nome)) ?? null,
        incluirTrivialBaixo: incluirTrivial,
        fatoresIgnorados: ignorados,
        setoresSemTransito: canonicos.filter((c) => !c.transita).map((c) => c.nome),
        observacao,
      }),
      { onSuccess: (id) => { setObservacao(""); setAberto(id); } },
    );
  };

  return (
    <div className="space-y-6">
      <Secao
        titulo="Registrar a consolidação atual"
        descricao="O registro guarda uma foto imutável do que está nas abas (documentos usados, perfil, lacunas e Sim/Não). É essa versão que vai ao cliente e que ele valida. Mudou algum documento? Registre de novo: o registro anterior continua guardado."
      >
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-4">
            <Cartao titulo="Empresas" valor={new Set(r.simNaoEmpresa.map((l) => l.idEmpresa)).size} />
            <Cartao titulo="Setores" valor={r.setores.length} detalhe={`${r.setores.filter((s) => s.comum).length} comuns`} />
            <Cartao titulo="Incluir" valor={r.resumo.incluir} tom="text-red-700" />
            <Cartao titulo="Revisar nível" valor={r.resumo.revisar} tom="text-amber-700" />
          </div>
          {setoresSemConfirmacao > 0 ? (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              Há {setoresSemConfirmacao} nome(s) de setor sem padronização confirmada. Confirme na aba Setores antes de registrar — a
              versão que vai ao cliente não pode depender de sugestão.
            </p>
          ) : igualAoUltimo ? (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-green-700">
              <CheckCircle2 className="size-3.5" /> A consolidação atual é igual ao último registro ({ultimo!.id_execucao}).
            </p>
          ) : podeEditar ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Observação (opcional) — ex.: versão enviada por e-mail em 20/10"
                className="min-w-[260px] flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={salvar}
                disabled={registrar.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {registrar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Registrar consolidação
              </button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-gray-500">Só quem edita registra.</p>
          )}
          {ultimo && !igualAoUltimo && setoresSemConfirmacao === 0 && (
            <p className="mt-2 text-xs text-amber-700">A consolidação atual está diferente do último registro ({ultimo.id_execucao}).</p>
          )}
        </div>
      </Secao>

      <Secao titulo="Registros e validação do cliente">
        {registros.isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
            <Loader2 className="size-4 animate-spin" /> Carregando registros…
          </div>
        ) : registros.isError ? (
          <p className="py-6 text-sm text-red-600">Erro ao carregar os registros.</p>
        ) : execucoes.length === 0 ? (
          <Vazio>Nenhuma consolidação registrada para este grupo.</Vazio>
        ) : (
          <div className="space-y-2">
            {execucoes.map((ex, i) => (
              <Registro
                key={ex.id_execucao}
                ex={ex}
                maisRecente={i === 0}
                aberto={aberto === ex.id_execucao}
                onAbrir={() => setAberto(aberto === ex.id_execucao ? null : ex.id_execucao)}
                vigentes={vigentes}
                historico={(registros.data?.validacoes ?? []).filter((v) => v.id_execucao === ex.id_execucao)}
                nomeEmpresa={nomeEmpresa}
                podeEditar={podeEditar}
                idGrupo={idGrupo}
                listaPgr={(validacao) =>
                  baixarLancamento({
                    grupo: grupoNome,
                    idExecucao: ex.id_execucao,
                    empresas: ex.parametros.empresas,
                    validacao,
                    nomeEmpresa,
                    nomeFator: a.nomeFator,
                  })
                }
                apresentar={() =>
                  baixarApresentacao({
                    grupo: grupoNome,
                    nomeEmpresa,
                    nomeFator: a.nomeFator,
                    nomeCurto,
                    registro: { id: ex.id_execucao, em: fmtDataHora(ex.criado_em) },
                  })
                }
              />
            ))}
          </div>
        )}
      </Secao>
    </div>
  );
}

function Registro({
  ex,
  maisRecente,
  aberto,
  onAbrir,
  vigentes,
  historico,
  nomeEmpresa,
  podeEditar,
  idGrupo,
  apresentar,
  listaPgr,
}: {
  apresentar: () => Promise<void>;
  listaPgr: (validacao: Map<string, Decisao>) => Promise<void>;
  ex: ExecucaoLinha;
  maisRecente: boolean;
  aberto: boolean;
  onAbrir: () => void;
  vigentes: Map<string, ValidacaoLinha>;
  historico: ValidacaoLinha[];
  nomeEmpresa: (id: string) => string;
  podeEditar: boolean;
  idGrupo: string;
}) {
  const empresas = [...ex.parametros.empresas].sort((x, y) => nomeEmpresa(x).localeCompare(nomeEmpresa(y), "pt-BR"));
  const status = empresas.map((e) => vigentes.get(`${ex.id_execucao}|${e}`) ?? null);
  const validadas = status.filter((v) => v?.decisao === "VALIDADO").length;
  const ressalvas = status.filter((v) => v?.decisao === "COM_RESSALVA").length;
  const [gerando, setGerando] = useState<"pptx" | "pgr" | null>(null);
  const rodar = async (qual: "pptx" | "pgr", fn: () => Promise<void>) => {
    setGerando(qual);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o arquivo.");
    } finally {
      setGerando(null);
    }
  };
  const pptx = () => rodar("pptx", apresentar);
  const validadasMapa = new Map(
    empresas.flatMap((e, i) => (status[i] ? [[e, status[i]!.decisao] as [string, Decisao]] : [])),
  );
  const pdf = `/api/pdf/consolidacao-grupo/${encodeURIComponent(idGrupo)}?execucao=${encodeURIComponent(ex.id_execucao)}`;

  return (
    <div className={cn("rounded-xl border bg-white shadow-sm", maisRecente ? "border-verde-primary/50" : "border-gray-200")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
        <button type="button" onClick={onAbrir} className="inline-flex items-center gap-1.5 font-medium text-gray-900">
          {aberto ? <ChevronDown className="size-4 text-gray-400" /> : <ChevronRight className="size-4 text-gray-400" />}
          {ex.id_execucao}
        </button>
        {maisRecente && <span className="rounded bg-green-100 px-1.5 py-0.5 text-[11px] font-semibold text-green-800">mais recente</span>}
        <span className="text-xs text-gray-500">
          {fmtDataHora(ex.criado_em)} · {ex.criado_por}
        </span>
        <span className="text-xs text-gray-500">
          {ex.parametros.resumo.incluir} incluir · {ex.parametros.resumo.revisar} revisar
          {!ex.parametros.incluir_trivial_baixo && " · sem AEP Trivial/Baixo"}
        </span>
        <span className={cn("ml-auto text-xs font-medium", validadas === empresas.length ? "text-green-700" : "text-gray-600")}>
          {validadas} de {empresas.length} validada(s){ressalvas ? ` · ${ressalvas} com ressalva` : ""}
        </span>
        <a
          href={pdf}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50"
        >
          <FileDown className="size-3.5" /> PDF desta versão
        </a>
        <button
          type="button"
          onClick={pptx}
          disabled={!!gerando}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {gerando === "pptx" ? <Loader2 className="size-3.5 animate-spin" /> : <Presentation className="size-3.5" />} Apresentação desta versão
        </button>
        <button
          type="button"
          onClick={() => rodar("pgr", () => listaPgr(validadasMapa))}
          disabled={!!gerando || validadasMapa.size === 0}
          title={validadasMapa.size === 0 ? "Registre a validação de ao menos uma empresa" : "Só as empresas validadas entram na lista"}
          className="inline-flex items-center gap-1 rounded-md border border-verde-primary px-2 py-0.5 text-xs font-medium text-verde-primary hover:bg-green-50 disabled:opacity-50"
        >
          {gerando === "pgr" ? <Loader2 className="size-3.5 animate-spin" /> : <FileSpreadsheet className="size-3.5" />} Lista para o PGR ({validadasMapa.size})
        </button>
      </div>
      {ex.observacao && <p className="px-3 pb-2 text-xs italic text-gray-600">{ex.observacao}</p>}
      {aberto && (
        <div className="overflow-x-auto border-t border-gray-100">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
              <tr>
                <th className="px-3 py-2">Empresa</th>
                <th className="px-3 py-2">Situação</th>
                <th className="px-3 py-2">Quem validou (cliente)</th>
                <th className="px-3 py-2">Comentário</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {empresas.map((e, i) => (
                <LinhaEmpresa
                  key={e}
                  idExecucao={ex.id_execucao}
                  idEmpresa={e}
                  nome={nomeEmpresa(e)}
                  vigente={status[i]}
                  anteriores={historico.filter((v) => v.id_empresa === e).length - (status[i] ? 1 : 0)}
                  podeEditar={podeEditar}
                  idGrupo={idGrupo}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LinhaEmpresa({
  idExecucao,
  idEmpresa,
  nome,
  vigente,
  anteriores,
  podeEditar,
  idGrupo,
}: {
  idExecucao: string;
  idEmpresa: string;
  nome: string;
  vigente: ValidacaoLinha | null;
  anteriores: number;
  podeEditar: boolean;
  idGrupo: string;
}) {
  const salvar = useRegistrarValidacao(idGrupo);
  const [form, setForm] = useState<{ decisao: Decisao; validado_por: string; validado_em: string; comentario: string } | null>(null);
  const hoje = new Date().toLocaleDateString("sv-SE");

  return (
    <>
      <tr className="align-top">
        <td className="px-3 py-2 text-gray-800">{nome}</td>
        <td className="px-3 py-2">
          {vigente ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold",
                vigente.decisao === "VALIDADO" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800",
              )}
            >
              <BadgeCheck className="size-3.5" /> {ROTULO[vigente.decisao]} em {fmtData(vigente.validado_em)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <Clock className="size-3.5" /> Pendente
            </span>
          )}
          {anteriores > 0 && <p className="mt-0.5 text-[11px] text-gray-400">{anteriores} registro(s) anterior(es)</p>}
        </td>
        <td className="px-3 py-2 text-xs text-gray-700">
          {vigente ? (
            <>
              {vigente.validado_por}
              <span className="block text-[11px] text-gray-400">registrado por {vigente.registrado_por}</span>
            </>
          ) : (
            "—"
          )}
        </td>
        <td className="px-3 py-2 text-xs text-gray-700">{vigente?.comentario ?? ""}</td>
        <td className="px-3 py-2 text-right">
          {podeEditar && !form && (
            <button
              type="button"
              onClick={() => setForm({ decisao: "VALIDADO", validado_por: "", validado_em: hoje, comentario: "" })}
              className="whitespace-nowrap rounded-md border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50"
            >
              {vigente ? "Novo registro" : "Registrar validação"}
            </button>
          )}
        </td>
      </tr>
      {form && (
        <tr className="bg-gray-50">
          <td colSpan={5} className="px-3 py-2">
            <div className="flex flex-wrap items-end gap-2 text-xs">
              <fieldset className="flex items-center gap-3">
                {(["VALIDADO", "COM_RESSALVA"] as Decisao[]).map((d) => (
                  <label key={d} className="flex items-center gap-1">
                    <input type="radio" checked={form.decisao === d} onChange={() => setForm({ ...form, decisao: d })} />
                    {ROTULO[d]}
                  </label>
                ))}
              </fieldset>
              <label className="flex flex-col gap-0.5">
                Quem validou (nome e cargo no cliente)
                <input
                  value={form.validado_por}
                  onChange={(e) => setForm({ ...form, validado_por: e.target.value })}
                  className="w-64 rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="flex flex-col gap-0.5">
                Data
                <input
                  type="date"
                  value={form.validado_em}
                  max={hoje}
                  onChange={(e) => setForm({ ...form, validado_em: e.target.value })}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="flex min-w-[220px] flex-1 flex-col gap-0.5">
                Comentário {form.decisao === "COM_RESSALVA" && <span className="text-amber-700">(diga qual é a ressalva)</span>}
                <input
                  value={form.comentario}
                  onChange={(e) => setForm({ ...form, comentario: e.target.value })}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
              </label>
              <button
                type="button"
                disabled={
                  salvar.isPending ||
                  !form.validado_por.trim() ||
                  !form.validado_em ||
                  (form.decisao === "COM_RESSALVA" && !form.comentario.trim())
                }
                onClick={() =>
                  salvar.mutate(
                    { id_execucao: idExecucao, id_empresa: idEmpresa, ...form, comentario: form.comentario || null },
                    { onSuccess: () => setForm(null) },
                  )
                }
                className="inline-flex items-center gap-1 rounded-md bg-verde-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {salvar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Salvar
              </button>
              <button type="button" onClick={() => setForm(null)} className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                Cancelar
              </button>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">O registro não pode ser editado nem apagado depois; um registro novo vale sobre o anterior.</p>
          </td>
        </tr>
      )}
    </>
  );
}

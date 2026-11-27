"use client";

// Comercial › Orçamentos, Fase 2 (0.3.340, banco v376): as seções do editor para os modelos novos — grupo de empresas
// com desconto, valor por vida, inclusão do Designado CIPA e a tabela de exames (documento próprio ou anexo). As contas
// estão em lib/orcamentos/modelo.ts (testadas); aqui só os campos e as prévias.

import { Plus, Sparkles, Trash2, Users } from "lucide-react";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useGruposEmpresas } from "@/lib/hooks/useGruposEmpresas";
import {
  CATEGORIAS_EXAME,
  categoriaDoExame,
  centavos,
  descontoGrupo,
  distribuicaoGrupo,
  faturamentoMinimo,
  fmtBRL,
  funcionariosDoGrupo,
  mensalPorVida,
  novaMensalidadeCipa,
  novoIdItem,
  somaIndividual,
  valorPorColaborador,
  vidasCobradas,
  vidasInformadas,
  type DadosCipa,
  type DadosExames,
  type DadosGrupo,
  type DadosVida,
  type EmpresaDoGrupo,
  type PrecoCatalogo,
} from "@/lib/orcamentos/modelo";
import { cn, formatCNPJ } from "@/lib/utils";
import { inp, rot } from "./estilos";

const caixa = "space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm";
const btn = "inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50";
const num = (v: string) => (v === "" ? 0 : Number(v));

function Resumo({ itens }: { itens: [string, string, boolean?][] }) {
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-gray-50 px-3 py-2 text-sm">
      {itens.map(([k, v, forte]) => (
        <div key={k} className="flex gap-1.5">
          <dt className="text-gray-500">{k}:</dt>
          <dd className={cn("tabular-nums", forte ? "font-semibold text-gray-900" : "text-gray-800")}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// ── Grupo de empresas ──

export function GrupoEditor({ g, onMudar, somenteLeitura, onNomeGrupo }: {
  g: DadosGrupo; onMudar: (g: DadosGrupo) => void; somenteLeitura: boolean; onNomeGrupo: (nome: string) => void;
}) {
  const { data: empresas = [] } = useEmpresas();
  const { grupos, membrosPorGrupo } = useGruposEmpresas();
  const m = (c: Partial<DadosGrupo>) => onMudar({ ...g, ...c });
  const mudar = (id: string, c: Partial<EmpresaDoGrupo>) => m({ empresas: g.empresas.map((e) => (e.id === id ? { ...e, ...c } : e)) });
  const ja = new Set(g.empresas.map((e) => e.idEmpresa).filter(Boolean));
  const incluir = (lista: { idEmpresa: string; nome: string; cnpj: string | null }[]) =>
    m({ empresas: [...g.empresas, ...lista.filter((x) => !ja.has(x.idEmpresa)).map((x) => ({ id: novoIdItem(), ...x, funcionarios: null, valorIndividual: 0 }))] });

  const desc = descontoGrupo(g);
  const dist = distribuicaoGrupo(g);
  const valorDe = new Map((dist ?? []).map((x) => [x.id, x.valor]));

  return (
    <section className={caixa}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Grupo de empresas · desconto de grupo</h2>
        {!somenteLeitura && (
          <div className="flex flex-wrap items-center gap-2">
            {grupos.length > 0 && (
              <select value="" className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs" onChange={(e) => {
                const gr = grupos.find((x) => x.id_grupo === e.target.value);
                if (!gr) return;
                incluir((membrosPorGrupo.get(gr.id_grupo) ?? []).map((x) => ({
                  idEmpresa: x.id_empresa, nome: x.razao_social || x.nome_empresa, cnpj: x.cnpj ? formatCNPJ(x.cnpj) : null,
                })));
                onNomeGrupo(gr.nome);
              }}>
                <option value="">Trazer de um grupo do sistema…</option>
                {grupos.map((x) => <option key={x.id_grupo} value={x.id_grupo}>{x.nome} ({membrosPorGrupo.get(x.id_grupo)?.length ?? 0})</option>)}
              </select>
            )}
            <div className="w-64">
              <EmpresaSelect value={null} placeholder="+ Empresa do sistema…" onChange={(id) => {
                const x = empresas.find((y) => y.id_empresa === id);
                if (x) incluir([{ idEmpresa: x.id_empresa, nome: x.razao_social || x.nome_empresa, cnpj: x.cnpj ? formatCNPJ(x.cnpj) : null }]);
              }} />
            </div>
            <button type="button" className={btn} onClick={() => m({ empresas: [...g.empresas, { id: novoIdItem(), idEmpresa: null, nome: "", cnpj: null, funcionarios: null, valorIndividual: 0 }] })}>
              <Plus className="size-3.5" /> Empresa digitada
            </button>
          </div>
        )}
      </div>

      {g.empresas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          <Users className="mx-auto mb-1 size-5 text-gray-400" />Inclua as empresas do grupo (ao menos duas), com o valor que cada uma pagaria sozinha.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="text-left text-xs font-semibold text-gray-500">
              <tr>
                <th className="pb-1 pr-2">Empresa</th>
                <th className="w-44 pb-1 pr-2">CNPJ</th>
                <th className="w-28 pb-1 pr-2">Funcionários</th>
                <th className="w-36 pb-1 pr-2">Valor individual (R$)</th>
                {g.anexoDistribuicao && <th className="w-28 pb-1 pr-2 text-right">Distribuição</th>}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {g.empresas.map((e) => (
                <tr key={e.id} className="border-t border-gray-100">
                  <td className="py-1.5 pr-2"><input value={e.nome} disabled={somenteLeitura} onChange={(x) => mudar(e.id, { nome: x.target.value })} className={inp} placeholder="Razão social" /></td>
                  <td className="py-1.5 pr-2"><input value={e.cnpj ?? ""} disabled={somenteLeitura} onChange={(x) => mudar(e.id, { cnpj: x.target.value || null })} className={inp} /></td>
                  <td className="py-1.5 pr-2"><input type="number" min={0} value={e.funcionarios ?? ""} disabled={somenteLeitura} onChange={(x) => mudar(e.id, { funcionarios: x.target.value ? Number(x.target.value) : null })} className={inp} /></td>
                  <td className="py-1.5 pr-2"><input type="number" min={0} step="0.01" value={e.valorIndividual || ""} disabled={somenteLeitura} onChange={(x) => mudar(e.id, { valorIndividual: num(x.target.value) })} className={cn(inp, !(e.valorIndividual > 0) && "border-amber-400 bg-amber-50")} /></td>
                  {g.anexoDistribuicao && <td className="py-1.5 pr-2 text-right tabular-nums text-gray-700">{dist ? fmtBRL(valorDe.get(e.id) ?? 0) : "—"}</td>}
                  <td className="py-1.5">
                    {!somenteLeitura && (
                      <button type="button" onClick={() => m({ empresas: g.empresas.filter((x) => x.id !== e.id) })} aria-label="Tirar a empresa" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-700"><Trash2 className="size-4" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <label className="block">
          <span className={rot}>Valor do grupo, com desconto (R$/mês)</span>
          <input type="number" min={0} step="0.01" value={g.valorGrupo || ""} disabled={somenteLeitura} onChange={(x) => m({ valorGrupo: num(x.target.value) })} className={cn(inp, "mt-1", !(g.valorGrupo > 0) && "border-amber-400 bg-amber-50")} />
        </label>
        <label className="flex items-end gap-2 pb-1.5 text-sm md:col-span-3">
          <input type="checkbox" checked={g.anexoDistribuicao} disabled={somenteLeitura} onChange={(x) => m({ anexoDistribuicao: x.target.checked })} className="mb-0.5" />
          <span>Anexo com a distribuição por empresa <span className="text-gray-500">(valor do grupo ÷ total de funcionários × funcionários da empresa)</span></span>
        </label>
      </div>
      <Resumo itens={[
        ["Soma individual", fmtBRL(somaIndividual(g))],
        ["Valor do grupo", fmtBRL(g.valorGrupo || 0), true],
        ["Desconto mensal", fmtBRL(desc.mensal)],
        ["Economia anual", fmtBRL(desc.anual)],
        ["Funcionários", String(funcionariosDoGrupo(g) || "—")],
      ]} />
    </section>
  );
}

// ── Valor por vida ──

export function VidaEditor({ v, onMudar, funcionarios, somenteLeitura }: { v: DadosVida; onMudar: (v: DadosVida) => void; funcionarios: number | null; somenteLeitura: boolean }) {
  const m = (c: Partial<DadosVida>) => onMudar({ ...v, ...c });
  return (
    <section className={caixa}>
      <h2 className="text-sm font-semibold text-gray-900">Valor por vida · contrato mensal</h2>
      <div className="grid gap-3 md:grid-cols-4">
        <label className="block">
          <span className={rot}>Valor por vida (R$/mês)</span>
          <input type="number" min={0} step="0.01" value={v.valorPorVida || ""} disabled={somenteLeitura} onChange={(x) => m({ valorPorVida: num(x.target.value) })} className={cn(inp, "mt-1", !(v.valorPorVida > 0) && "border-amber-400 bg-amber-50")} />
        </label>
        <label className="block">
          <span className={rot}>Mínimo de vidas</span>
          <input type="number" min={0} value={v.minimoVidas || ""} disabled={somenteLeitura} onChange={(x) => m({ minimoVidas: num(x.target.value) })} placeholder="Sem mínimo" className={cn(inp, "mt-1")} />
        </label>
      </div>
      <div>
        <p className={cn(rot, "mb-1.5")}>Distribuição por função (opcional; sem funções, vale o número de funcionários)</p>
        {v.funcoes.length > 0 && (
          <table className="w-full max-w-2xl text-sm">
            <thead className="text-left text-xs font-semibold text-gray-500">
              <tr><th className="pb-1 pr-2">Função</th><th className="w-32 pb-1 pr-2">Colaboradores</th><th className="w-32 pb-1 pr-2 text-right">Valor mensal</th><th className="w-8" /></tr>
            </thead>
            <tbody>
              {v.funcoes.map((f) => (
                <tr key={f.id} className="border-t border-gray-100">
                  <td className="py-1.5 pr-2"><input value={f.funcao} disabled={somenteLeitura} onChange={(x) => m({ funcoes: v.funcoes.map((y) => (y.id === f.id ? { ...y, funcao: x.target.value } : y)) })} className={inp} placeholder="Ex.: Motorista" /></td>
                  <td className="py-1.5 pr-2"><input type="number" min={0} value={f.colaboradores || ""} disabled={somenteLeitura} onChange={(x) => m({ funcoes: v.funcoes.map((y) => (y.id === f.id ? { ...y, colaboradores: num(x.target.value) } : y)) })} className={inp} /></td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-gray-700">{fmtBRL(centavos((f.colaboradores || 0) * (v.valorPorVida || 0)))}</td>
                  <td className="py-1.5">
                    {!somenteLeitura && <button type="button" onClick={() => m({ funcoes: v.funcoes.filter((y) => y.id !== f.id) })} aria-label="Tirar a função" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-700"><Trash2 className="size-4" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!somenteLeitura && (
          <button type="button" onClick={() => m({ funcoes: [...v.funcoes, { id: novoIdItem(), funcao: "", colaboradores: 0 }] })} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-marca-primary hover:underline">
            <Plus className="size-3.5" /> Função
          </button>
        )}
      </div>
      <Resumo itens={[
        ["Vidas informadas", String(vidasInformadas(v, funcionarios))],
        ["Vidas cobradas", String(vidasCobradas(v, funcionarios))],
        ...(v.minimoVidas ? [["Faturamento mínimo", fmtBRL(faturamentoMinimo(v))] as [string, string]] : []),
        ["Valor mensal", fmtBRL(mensalPorVida(v, funcionarios)), true],
      ]} />
    </section>
  );
}

// ── Inclusão do Designado CIPA ──

export function CipaEditor({ c, onMudar, somenteLeitura }: { c: DadosCipa; onMudar: (c: DadosCipa) => void; somenteLeitura: boolean }) {
  const m = (x: Partial<DadosCipa>) => onMudar({ ...c, ...x });
  return (
    <section className={caixa}>
      <h2 className="text-sm font-semibold text-gray-900">Inclusão do Designado CIPA – NR-5 · contrato vigente</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block w-48">
          <span className={rot}>Mensalidade atual (R$)</span>
          <input type="number" min={0} step="0.01" value={c.mensalidadeAtual || ""} disabled={somenteLeitura} onChange={(x) => m({ mensalidadeAtual: num(x.target.value) })} className={cn(inp, "mt-1", !(c.mensalidadeAtual > 0) && "border-amber-400 bg-amber-50")} />
        </label>
        <span className="pb-2 text-lg font-bold text-gray-400">+</span>
        <label className="block w-48">
          <span className={rot}>Acréscimo do Designado CIPA (R$)</span>
          <input type="number" min={0} step="0.01" value={c.acrescimo || ""} disabled={somenteLeitura} onChange={(x) => m({ acrescimo: num(x.target.value) })} className={cn(inp, "mt-1")} />
        </label>
        <span className="pb-2 text-lg font-bold text-gray-400">=</span>
        <div className="rounded-lg bg-marca-light px-4 py-2">
          <span className={rot}>Nova mensalidade</span>
          <strong className="block text-lg tabular-nums text-gray-900">{fmtBRL(novaMensalidadeCipa(c))}</strong>
        </div>
      </div>
      <p className="text-xs text-gray-500">O PDF (1 página) traz a conta, as 4 condições comerciais padrão, a aprovação e formalização e as assinaturas.</p>
    </section>
  );
}

// ── Tabela de exames ──

export function TabelaExamesEditor({ t, onMudar, catalogo, somenteLeitura, comPlano }: {
  t: DadosExames; onMudar: (t: DadosExames) => void; catalogo: readonly PrecoCatalogo[]; somenteLeitura: boolean; comPlano: boolean;
}) {
  const m = (c: Partial<DadosExames>) => onMudar({ ...t, ...c });
  const nomes = new Set(t.exames.map((e) => e.nome.trim().toLowerCase()));
  const doCatalogo = catalogo.filter((p) => p.ativo && p.tipo === "exame" && !nomes.has(p.nome.trim().toLowerCase()));
  const tirarExame = (id: string) => m({ exames: t.exames.filter((e) => e.id !== id), setores: t.setores.map((s) => ({ ...s, exames: s.exames.filter((x) => x !== id) })) });

  return (
    <div className="space-y-4">
      {comPlano && (
        <label className="block max-w-md">
          <span className={rot}>Plano (terceiro campo do quadro do cliente, opcional)</span>
          <input value={t.plano ?? ""} disabled={somenteLeitura} onChange={(x) => m({ plano: x.target.value })} placeholder="Ex.: Plano Essencial" className={cn(inp, "mt-1")} />
        </label>
      )}
      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <p className={rot}>Exames e valores unitários</p>
          {!somenteLeitura && (
            <div className="flex flex-wrap gap-2">
              {doCatalogo.length > 0 && (
                <button type="button" className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                  onClick={() => m({ exames: [...t.exames, ...doCatalogo.map((p) => ({ id: novoIdItem(), nome: p.nome, categoria: categoriaDoExame(p.nome), valor: p.valor, isento: false }))] })}>
                  <Sparkles className="size-3.5" /> Trazer os exames do catálogo ({doCatalogo.length})
                </button>
              )}
              <button type="button" className={btn} onClick={() => m({ exames: [...t.exames, { id: novoIdItem(), nome: "", categoria: "Complementares", valor: 0, isento: false }] })}>
                <Plus className="size-3.5" /> Exame
              </button>
            </div>
          )}
        </div>
        {t.exames.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
            Nenhum exame. {catalogo.some((p) => p.tipo === "exame") ? "Traga do catálogo ou inclua um a um." : "Cadastre os exames em Orçamentos › Catálogo (tipo Exame) ou inclua um a um."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-left text-xs font-semibold text-gray-500">
                <tr><th className="pb-1 pr-2">Exame</th><th className="w-40 pb-1 pr-2">Categoria</th><th className="w-32 pb-1 pr-2">Valor (R$)</th><th className="w-20 pb-1 pr-2">Isento</th><th className="w-8" /></tr>
              </thead>
              <tbody>
                {t.exames.map((e) => {
                  const mudar = (c: Partial<typeof e>) => m({ exames: t.exames.map((x) => (x.id === e.id ? { ...x, ...c } : x)) });
                  return (
                    <tr key={e.id} className="border-t border-gray-100">
                      <td className="py-1.5 pr-2"><input value={e.nome} disabled={somenteLeitura} onChange={(x) => mudar({ nome: x.target.value })} onBlur={() => { if (e.nome && e.categoria === "Complementares") mudar({ categoria: categoriaDoExame(e.nome) }); }} className={inp} placeholder="Ex.: Audiometria" /></td>
                      <td className="py-1.5 pr-2">
                        <select value={e.categoria} disabled={somenteLeitura} onChange={(x) => mudar({ categoria: x.target.value })} className={inp}>
                          {[...new Set([...CATEGORIAS_EXAME, e.categoria])].map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="py-1.5 pr-2"><input type="number" min={0} step="0.01" value={e.isento ? "" : e.valor || ""} disabled={somenteLeitura || e.isento} onChange={(x) => mudar({ valor: num(x.target.value) })} className={cn(inp, !e.isento && !(e.valor > 0) && "border-amber-400 bg-amber-50")} /></td>
                      <td className="py-1.5 pr-2 text-center"><input type="checkbox" checked={e.isento} disabled={somenteLeitura} onChange={(x) => mudar({ isento: x.target.checked })} aria-label="Isento (incluso no plano)" /></td>
                      <td className="py-1.5">
                        {!somenteLeitura && <button type="button" onClick={() => tirarExame(e.id)} aria-label="Tirar o exame" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-700"><Trash2 className="size-4" /></button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <p className={cn(rot, "mb-1.5")}>Exames por setor (opcional): marque os exames de cada setor; o valor por colaborador soma os que não são isentos</p>
        <ul className="space-y-2">
          {t.setores.map((s) => {
            const mudar = (c: Partial<typeof s>) => m({ setores: t.setores.map((x) => (x.id === s.id ? { ...x, ...c } : x)) });
            const v = valorPorColaborador(s, t.exames);
            return (
              <li key={s.id} className="rounded-lg border border-gray-200 p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <input value={s.setor} disabled={somenteLeitura} onChange={(x) => mudar({ setor: x.target.value })} placeholder="Setor (ex.: Motoristas)" className={cn(inp, "w-64")} />
                  <span className="text-sm text-gray-600">Por colaborador: <strong className="tabular-nums text-gray-900">{v > 0 ? fmtBRL(v) : "Isento"}</strong></span>
                  {!somenteLeitura && <button type="button" onClick={() => m({ setores: t.setores.filter((x) => x.id !== s.id) })} aria-label="Tirar o setor" className="ml-auto rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-700"><Trash2 className="size-4" /></button>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {t.exames.filter((e) => e.nome.trim()).map((e) => {
                    const tem = s.exames.includes(e.id);
                    return (
                      <button key={e.id} type="button" disabled={somenteLeitura} aria-pressed={tem}
                        onClick={() => mudar({ exames: tem ? s.exames.filter((x) => x !== e.id) : [...s.exames, e.id] })}
                        className={cn("rounded-full border px-2.5 py-0.5 text-xs", tem ? "border-marca-primary bg-marca-light font-medium text-gray-900" : "border-gray-300 text-gray-500 hover:bg-gray-50")}>
                        {e.nome}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
        {!somenteLeitura && (
          <button type="button" disabled={t.exames.length === 0} onClick={() => m({ setores: [...t.setores, { id: novoIdItem(), setor: "", exames: [] }] })} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-marca-primary hover:underline disabled:opacity-40">
            <Plus className="size-3.5" /> Setor
          </button>
        )}
      </div>
    </div>
  );
}

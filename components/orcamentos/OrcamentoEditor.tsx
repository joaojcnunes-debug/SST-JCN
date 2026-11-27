"use client";

// Comercial › Orçamentos (0.3.339, banco v375): criar e editar um orçamento — cliente (da empresa ou digitado), marca,
// modelo, itens (do catálogo ou das oportunidades da empresa) e o Plano Essencial com as regras das bases de
// conhecimento. Rascunho grava e gera o PDF; enviado/decidido fica só leitura (alterar = versão nova).

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, FileDown, Loader2, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useComercial } from "@/lib/hooks/useComercial";
import { useCatalogoPrecos, useSalvarOrcamento } from "@/lib/hooks/useOrcamentos";
import { LISTA_MARCAS, MARCAS, type MarcaOrcamento } from "@/lib/orcamentos/marcas";
import {
  A_VENDER,
  NOME_PRODUTO,
} from "@/lib/comercial/oportunidades";
import {
  PAGAMENTO_PADRAO,
  ROTULO_MODELO,
  SERVICOS_ESSENCIAL,
  TITULO_CIPA,
  essencialVazio,
  fmtBRL,
  modeloSugerido,
  novoIdItem,
  pendencias,
  subtotalItem,
  sugerirItens,
  totalOrcamento,
  type DadosEssencial,
  type DadosOrcamento,
  type ItemOrcamento,
  type ModeloOrcamento,
  type OpcaoCipa,
  type Orcamento,
  type OportunidadeSugestao,
} from "@/lib/orcamentos/modelo";
import { hojeSP } from "@/lib/inspecoes/prioridade";
import { cn, formatCNPJ } from "@/lib/utils";

const inp = "w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-marca-primary focus:outline-none focus:ring-2 focus:ring-marca-primary/20 disabled:bg-gray-50 disabled:text-gray-600";
const rot = "block text-xs font-semibold text-gray-600";

export default function OrcamentoEditor({ existente, empresaInicial }: { existente?: Orcamento | null; empresaInicial?: string | null }) {
  const router = useRouter();
  const somenteLeitura = !!existente && existente.situacao !== "rascunho";
  const { data: empresas = [] } = useEmpresas();
  const { data: comercial = [], isLoading: carregandoComercial } = useComercial();
  const { data: catalogo = [], isLoading: carregandoCatalogo } = useCatalogoPrecos();
  const salvar = useSalvarOrcamento();

  const [idEmpresa, setIdEmpresa] = useState<string | null>(existente?.id_empresa ?? empresaInicial ?? null);
  const empresa = empresas.find((e) => e.id_empresa === idEmpresa) ?? null;
  const [cliente, setCliente] = useState(existente?.cliente_nome ?? "");
  const [cnpj, setCnpj] = useState(existente?.cliente_cnpj ?? "");
  const [marca, setMarca] = useState<MarcaOrcamento>(existente?.marca ?? "chabra");
  const [cidade, setCidade] = useState(existente?.cidade ?? MARCAS[existente?.marca ?? "chabra"].cidadePadrao);
  const [data, setData] = useState(existente?.dados.data ?? hojeSP());
  const [funcionarios, setFuncionarios] = useState<number | null>(existente?.dados.funcionarios ?? null);
  const [essencial, setEssencial] = useState<DadosEssencial>(existente?.dados.essencial ?? essencialVazio());
  const [itens, setItens] = useState<ItemOrcamento[]>(existente?.dados.itens ?? []);
  const [pagamento, setPagamento] = useState<string>(existente?.dados.pagamento ?? "");
  const [observacoes, setObservacoes] = useState(existente?.dados.observacoes ?? "");

  // As oportunidades a vender da empresa (o que o Comercial já indicou).
  const oportunidades = useMemo<OportunidadeSugestao[]>(() => {
    const c = comercial.find((x) => x.empresa.idEmpresa === idEmpresa);
    return (c?.oportunidades ?? [])
      .filter((o) => A_VENDER.includes(o.situacao))
      .map((o) => ({
        produto: o.produto,
        nomeProduto: NOME_PRODUTO[o.produto],
        detalhes: o.detalhes,
        setores: o.setores,
        intervencoes: o.intervencoes?.filter((i) => !i.venda).map((i) => ({ idItem: i.idItem, setor: i.setor, risco: i.risco, intervencao: i.intervencao, modalidade: i.modalidade })),
      }));
  }, [comercial, idEmpresa]);

  const [modelo, setModelo] = useState<ModeloOrcamento>(existente?.modelo ?? "essencial");
  // Na primeira vez que a empresa vem do cartão (Oportunidades), já sugere o modelo e os itens.
  const [sugeriu, setSugeriu] = useState(!!existente);
  if (!sugeriu && empresaInicial && !carregandoComercial && !carregandoCatalogo && oportunidades.length > 0) {
    setSugeriu(true);
    const m = modeloSugerido(oportunidades);
    setModelo(m);
    setItens(sugerirItens(oportunidades, catalogo));
    setPagamento(PAGAMENTO_PADRAO[m]);
  }

  // Ao escolher a empresa, os dados do cliente vêm do cadastro (dá para editar).
  const escolherEmpresa = (id: string | null) => {
    setIdEmpresa(id);
    const e = empresas.find((x) => x.id_empresa === id);
    if (e) {
      setCliente(e.razao_social || e.nome_empresa);
      setCnpj(e.cnpj ? formatCNPJ(e.cnpj) : "");
    }
  };
  if (!existente && empresa && !cliente) {
    setCliente(empresa.razao_social || empresa.nome_empresa);
    setCnpj(empresa.cnpj ? formatCNPJ(empresa.cnpj) : "");
  }

  const trocarModelo = (m: ModeloOrcamento) => {
    setModelo(m);
    if (m !== "essencial" && !pagamento.trim()) setPagamento(PAGAMENTO_PADRAO[m]);
  };

  const dados: DadosOrcamento = {
    data,
    funcionarios,
    observacoes,
    ...(modelo === "essencial" ? { essencial } : { itens, pagamento }),
  };
  const faltam = pendencias(modelo, cliente, dados);
  const total = totalOrcamento(modelo, dados);

  const gravar = async (gerarPdf: boolean) => {
    if (gerarPdf && faltam.length) {
      toast.error(faltam[0]);
      return;
    }
    // Abre a aba já no clique (o navegador bloqueia janela aberta depois de um await).
    const aba = gerarPdf ? window.open("about:blank", "_blank") : null;
    const id = await salvar
      .mutateAsync({ id_orcamento: existente?.id_orcamento ?? null, id_empresa: idEmpresa, cliente_nome: cliente, cliente_cnpj: cnpj, cidade, marca, modelo, dados })
      .catch(() => null);
    if (!id) {
      aba?.close();
      return;
    }
    toast.success("Orçamento gravado");
    if (aba) aba.location.href = `/api/pdf/orcamento/${encodeURIComponent(id)}`;
    if (!existente) router.replace(`/comercial-orcamentos/${encodeURIComponent(id)}`);
  };

  const mudarItem = (id: string, campos: Partial<ItemOrcamento>) => setItens((l) => l.map((i) => (i.id === id ? { ...i, ...campos } : i)));
  const doCatalogo = catalogo.filter((p) => p.ativo && (modelo !== "treinamentos" || p.tipo === "treinamento"));

  return (
    <div className="space-y-5">
      {somenteLeitura && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Este orçamento já foi {existente!.situacao === "enviado" ? "enviado" : existente!.situacao === "aprovado" ? "aprovado" : "recusado"}: fica como está. Para alterar, crie uma versão nova.
        </p>
      )}

      {/* Cliente e marca */}
      <section className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <div className="md:col-span-2">
          <span className={rot}>Empresa do sistema (opcional)</span>
          <EmpresaSelect value={idEmpresa} onChange={escolherEmpresa} allowAll disabled={somenteLeitura} className="mt-1" placeholder="Escolha para preencher os dados…" />
        </div>
        <label className="block">
          <span className={rot}>Marca do PDF</span>
          <select value={marca} disabled={somenteLeitura} onChange={(e) => { const m = e.target.value as MarcaOrcamento; if (cidade === MARCAS[marca].cidadePadrao) setCidade(MARCAS[m].cidadePadrao); setMarca(m); }} className={cn(inp, "mt-1")}>
            {LISTA_MARCAS.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={rot}>Modelo</span>
          <select value={modelo} disabled={somenteLeitura} onChange={(e) => trocarModelo(e.target.value as ModeloOrcamento)} className={cn(inp, "mt-1")}>
            {(Object.keys(ROTULO_MODELO) as ModeloOrcamento[]).map((m) => <option key={m} value={m}>{ROTULO_MODELO[m]}</option>)}
          </select>
        </label>
        <label className="block md:col-span-2">
          <span className={rot}>Cliente (razão social)</span>
          <input value={cliente} disabled={somenteLeitura} onChange={(e) => setCliente(e.target.value)} className={cn(inp, "mt-1")} />
        </label>
        <label className="block">
          <span className={rot}>CNPJ</span>
          <input value={cnpj} disabled={somenteLeitura} onChange={(e) => setCnpj(e.target.value)} placeholder="Sem CNPJ: deixe em branco" className={cn(inp, "mt-1")} />
        </label>
        <label className="block">
          <span className={rot}>Funcionários (informativo)</span>
          <input type="number" min={0} value={funcionarios ?? ""} disabled={somenteLeitura} onChange={(e) => setFuncionarios(e.target.value ? Number(e.target.value) : null)} className={cn(inp, "mt-1")} />
        </label>
        <label className="block">
          <span className={rot}>Cidade da data</span>
          <input value={cidade} disabled={somenteLeitura} onChange={(e) => setCidade(e.target.value)} className={cn(inp, "mt-1")} />
        </label>
        <label className="block">
          <span className={rot}>Data do documento</span>
          <input type="date" value={data} disabled={somenteLeitura} onChange={(e) => setData(e.target.value || hojeSP())} className={cn(inp, "mt-1")} />
        </label>
      </section>

      {modelo === "essencial" ? (
        <PlanoEssencial e={essencial} onMudar={setEssencial} somenteLeitura={somenteLeitura} />
      ) : (
        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">{modelo === "treinamentos" ? "Treinamentos (valor por participante)" : "Itens"}</h2>
            {!somenteLeitura && (
              <div className="flex flex-wrap gap-2">
                {oportunidades.length > 0 && (
                  <button type="button" onClick={() => setItens((l) => [...l, ...sugerirItens(oportunidades, catalogo)])}
                    className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100">
                    <Sparkles className="size-3.5" /> Trazer das oportunidades ({oportunidades.length})
                  </button>
                )}
                <select value="" onChange={(e) => {
                  const p = catalogo.find((x) => x.id_preco === e.target.value);
                  if (p) setItens((l) => [...l, { id: novoIdItem(), descricao: p.nome, detalhe: p.descricao, quantidade: 1, unidade: p.unidade, valor: p.valor }]);
                }} className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs">
                  <option value="">+ Do catálogo…</option>
                  {doCatalogo.map((p) => <option key={p.id_preco} value={p.id_preco}>{p.nome} · {fmtBRL(p.valor)}</option>)}
                </select>
                <button type="button" onClick={() => setItens((l) => [...l, { id: novoIdItem(), descricao: "", quantidade: 1, unidade: modelo === "treinamentos" ? "por participante" : "unidade", valor: 0 }])}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
                  <Plus className="size-3.5" /> Item livre
                </button>
              </div>
            )}
          </div>
          {catalogo.length === 0 && !somenteLeitura && (
            <p className="text-xs text-gray-500">O catálogo de preços está vazio: cadastre os valores em Orçamentos › Catálogo para eles virem preenchidos.</p>
          )}
          {itens.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">Nenhum item. Use os botões acima.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead className="text-left text-xs font-semibold text-gray-500">
                  <tr>
                    <th className="pb-1 pr-2">{modelo === "treinamentos" ? "Treinamento" : "Descrição"}</th>
                    <th className="w-20 pb-1 pr-2">{modelo === "treinamentos" ? "Part." : "Qtd."}</th>
                    <th className="w-36 pb-1 pr-2">Unidade</th>
                    <th className="w-32 pb-1 pr-2">Valor unit. (R$)</th>
                    <th className="w-28 pb-1 pr-2 text-right">Subtotal</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {itens.map((i) => (
                    <tr key={i.id} className="border-t border-gray-100 align-top">
                      <td className="py-1.5 pr-2">
                        <input value={i.descricao} disabled={somenteLeitura} onChange={(e) => mudarItem(i.id, { descricao: e.target.value })} className={inp} placeholder="Descrição" />
                        <input value={i.detalhe ?? ""} disabled={somenteLeitura} onChange={(e) => mudarItem(i.id, { detalhe: e.target.value || null })} className={cn(inp, "mt-1 text-xs")} placeholder="Detalhe (opcional)" />
                        {i.produto && <span className="mt-0.5 block text-[11px] text-amber-700">Oportunidade: {i.produto}</span>}
                      </td>
                      <td className="py-1.5 pr-2"><input type="number" min={0} value={i.quantidade} disabled={somenteLeitura} onChange={(e) => mudarItem(i.id, { quantidade: Number(e.target.value) })} className={inp} /></td>
                      <td className="py-1.5 pr-2"><input value={i.unidade} disabled={somenteLeitura} onChange={(e) => mudarItem(i.id, { unidade: e.target.value })} className={inp} /></td>
                      <td className="py-1.5 pr-2"><input type="number" min={0} step="0.01" value={i.valor} disabled={somenteLeitura} onChange={(e) => mudarItem(i.id, { valor: Number(e.target.value) })} className={cn(inp, !(i.valor > 0) && "border-amber-400 bg-amber-50")} /></td>
                      <td className="py-2.5 pr-2 text-right font-semibold tabular-nums">{fmtBRL(subtotalItem(i))}</td>
                      <td className="py-1.5">
                        {!somenteLeitura && (
                          <button type="button" onClick={() => setItens((l) => l.filter((x) => x.id !== i.id))} aria-label="Tirar o item" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-700">
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <label className="block">
            <span className={rot}>Forma de pagamento</span>
            <textarea rows={2} value={pagamento} disabled={somenteLeitura} onChange={(e) => setPagamento(e.target.value)} className={cn(inp, "mt-1")} />
          </label>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="block">
          <span className={rot}>Observações (saem no fim do documento)</span>
          <textarea rows={3} value={observacoes} disabled={somenteLeitura} onChange={(e) => setObservacoes(e.target.value)} className={cn(inp, "mt-1")} />
        </label>
      </section>

      {/* Rodapé fixo: total, pendências e ações */}
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="text-sm">
          <span className="text-gray-500">{modelo === "essencial" ? "Valor mensal" : "Total"}:</span>{" "}
          <strong className="tabular-nums text-gray-900">{fmtBRL(total)}</strong>
        </div>
        {faltam.length > 0 && !somenteLeitura && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-700"><AlertTriangle className="size-3.5" />{faltam.join(" ")}</span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {existente && (
            <a href={`/api/pdf/orcamento/${encodeURIComponent(existente.id_orcamento)}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <FileDown className="size-4" /> PDF gravado
            </a>
          )}
          {!somenteLeitura && (
            <>
              <button type="button" onClick={() => gravar(false)} disabled={salvar.isPending || !cliente.trim()}
                className="inline-flex items-center gap-1.5 rounded-md border border-marca-primary px-3 py-2 text-sm font-medium text-marca-primary hover:bg-marca-light disabled:opacity-50">
                {salvar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar rascunho
              </button>
              <button type="button" onClick={() => gravar(true)} disabled={salvar.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-marca-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                <FileDown className="size-4" /> Salvar e gerar PDF
              </button>
            </>
          )}
          {!existente && <Link href="/comercial-orcamentos" className="rounded-md px-3 py-2 text-sm text-gray-600 hover:underline">Cancelar</Link>}
        </div>
      </div>
    </div>
  );
}

function PlanoEssencial({ e, onMudar, somenteLeitura }: { e: DadosEssencial; onMudar: (e: DadosEssencial) => void; somenteLeitura: boolean }) {
  const m = (c: Partial<DadosEssencial>) => onMudar({ ...e, ...c });
  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Plano Essencial · contrato mensal</h2>
      <div className="grid gap-3 md:grid-cols-4">
        <label className="block">
          <span className={rot}>Valor mensal (R$)</span>
          <input type="number" min={0} step="0.01" value={e.valorMensal || ""} disabled={somenteLeitura} onChange={(x) => m({ valorMensal: Number(x.target.value) })} className={cn(inp, "mt-1", !(e.valorMensal > 0) && "border-amber-400 bg-amber-50")} />
        </label>
        <label className="block">
          <span className={rot}>Limite de funcionários</span>
          <input type="number" min={0} value={e.limiteFuncionarios ?? ""} disabled={somenteLeitura} onChange={(x) => m({ limiteFuncionarios: x.target.value ? Number(x.target.value) : null })} placeholder="Sem limite" className={cn(inp, "mt-1")} />
        </label>
        <label className="block">
          <span className={rot}>Por colaborador excedente (R$)</span>
          <input type="number" min={0} step="0.01" value={e.valorExcedente} disabled={somenteLeitura || !e.limiteFuncionarios} onChange={(x) => m({ valorExcedente: Number(x.target.value) })} className={cn(inp, "mt-1")} />
        </label>
        <label className="block">
          <span className={rot}>Designado CIPA</span>
          <select value={e.cipa} disabled={somenteLeitura} onChange={(x) => m({ cipa: x.target.value as OpcaoCipa })} className={cn(inp, "mt-1")}>
            <option value="quando">Quando aplicável</option>
            <option value="incluido">Incluído no plano</option>
            <option value="sem">Sem CIPA (não mencionar)</option>
          </select>
        </label>
      </div>
      <div>
        <p className={cn(rot, "mb-1.5")}>Serviços inclusos (desmarque o que não entra)</p>
        <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-4">
          {SERVICOS_ESSENCIAL.filter((s) => s.titulo !== TITULO_CIPA).map((s) => {
            const marcado = !e.servicosRemovidos.includes(s.titulo);
            return (
              <label key={s.titulo} className="flex items-start gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-gray-50" title={s.descricao}>
                <input type="checkbox" checked={marcado} disabled={somenteLeitura} className="mt-0.5"
                  onChange={() => m({ servicosRemovidos: marcado ? [...e.servicosRemovidos, s.titulo] : e.servicosRemovidos.filter((x) => x !== s.titulo) })} />
                <span>{s.titulo}</span>
              </label>
            );
          })}
        </div>
      </div>
      <div>
        <p className={cn(rot, "mb-1.5")}>Serviços a mais</p>
        <ul className="space-y-1.5">
          {e.servicosExtras.map((x, k) => (
            <li key={k} className="flex gap-2">
              <input value={x.titulo} disabled={somenteLeitura} placeholder="Título (ex.: Visita técnica)" onChange={(v) => m({ servicosExtras: e.servicosExtras.map((y, j) => (j === k ? { ...y, titulo: v.target.value } : y)) })} className={cn(inp, "w-56")} />
              <input value={x.descricao} disabled={somenteLeitura} placeholder="Descrição (ex.: 1 vez ao mês)" onChange={(v) => m({ servicosExtras: e.servicosExtras.map((y, j) => (j === k ? { ...y, descricao: v.target.value } : y)) })} className={inp} />
              {!somenteLeitura && (
                <button type="button" onClick={() => m({ servicosExtras: e.servicosExtras.filter((_, j) => j !== k) })} aria-label="Tirar" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-700"><Trash2 className="size-4" /></button>
              )}
            </li>
          ))}
        </ul>
        {!somenteLeitura && (
          <button type="button" onClick={() => m({ servicosExtras: [...e.servicosExtras, { titulo: "", descricao: "" }] })} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-marca-primary hover:underline">
            <Plus className="size-3.5" /> Serviço a mais
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500">
        A página de investimento traz as 3 exclusões padrão (exames complementares, avaliações ambientais — exceto ruído e calor — e intervenções psicossociais) e, com limite, a cláusula do excedente.
      </p>
    </section>
  );
}

// Comercial › Orçamentos (0.3.339): o PDF do orçamento no padrão visual das bases de conhecimento — faixa superior na
// cor da marca com bloco de acento, logo (ou o nome da marca) à esquerda e "PROPOSTA COMERCIAL" à direita, quadro do
// cliente, etiqueta "PROPOSTA 1", serviços com check em 2 colunas, bloco de valor, alerta "Observação." e 3 cartões,
// data por extenso e assinaturas em 2 colunas. A4 retrato, páginas montadas aqui (margem zero no gerador).

import type { Marca } from "@/lib/orcamentos/marcas";
import {
  EXCLUSOES_ESSENCIAL,
  dataCurta,
  dataPorExtenso,
  doisDigitos,
  fmtValor,
  rotuloNumero,
  servicosDoEssencial,
  subtotalItem,
  totalOrcamento,
  type Orcamento,
} from "@/lib/orcamentos/modelo";

export function estiloOrcamento(m: Marca): string {
  const c = m.cores;
  return `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Poppins', Arial, Helvetica, sans-serif; color: ${c.grafite}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pg { width: 210mm; height: 297mm; position: relative; overflow: hidden; page-break-after: always; padding: 0 16mm; }
  .pg:last-child { page-break-after: auto; }
  .faixa { position: absolute; top: 0; left: 0; right: 0; height: 7mm; background: ${c.principal}; }
  .faixa i { position: absolute; top: 0; right: 0; width: 58mm; height: 7mm; background: ${c.faixaCanto}; border-left: 3px solid ${c.check}; }
  .topo { display: flex; justify-content: space-between; align-items: flex-start; padding-top: 14mm; }
  .marca .nome { font-size: 22pt; font-weight: 700; color: ${c.principal}; line-height: 1; }
  .marca .sub { font-size: 8pt; color: ${c.escura}; margin-top: 2px; }
  .marca img { height: 15mm; }
  .tit { text-align: right; }
  .tit .k { font-size: 7.5pt; letter-spacing: 1.6px; color: ${c.cinza}; }
  .tit .t { font-size: 20pt; font-weight: 700; color: ${c.principal}; line-height: 1.15; }
  .tit .s { font-size: 8.5pt; color: ${c.cinza}; }
  .cli { margin-top: 8mm; background: ${c.fundo}; border-radius: 3mm; border-left: 4px solid ${c.principal}; padding: 4mm 5mm; display: grid; gap: 4mm; }
  .cli .r { font-size: 6.8pt; letter-spacing: 1px; color: ${c.cinza}; text-transform: uppercase; }
  .cli .v { font-size: 10pt; font-weight: 600; color: ${c.grafite}; margin-top: 1px; }
  .pill { display: inline-block; background: ${c.destaque}; color: #fff; font-size: 7.5pt; font-weight: 600; letter-spacing: 1px; border-radius: 10px; padding: 3px 11px; vertical-align: middle; }
  .plano { margin-top: 7mm; display: flex; align-items: center; gap: 3mm; }
  .plano b { font-size: 15pt; font-weight: 600; }
  .plano span.c { font-size: 10pt; color: ${c.cinza}; }
  .sec { margin-top: 6mm; font-size: 8.8pt; font-weight: 600; letter-spacing: 1.2px; color: ${c.escura}; }
  .sec:after { content: ''; display: block; width: 26px; height: 2px; background: ${c.check}; margin-top: 3px; }
  .serv { margin-top: 3mm; display: grid; grid-template-columns: 1fr 1fr; column-gap: 8mm; }
  .serv div { display: flex; gap: 2.5mm; padding: 2.1mm 0; border-bottom: 0.6px solid ${c.borda}; break-inside: avoid; }
  .ck { flex: none; width: 4.4mm; height: 4.4mm; border-radius: 50%; background: ${c.check}; color: #fff; font-size: 7pt; display: flex; align-items: center; justify-content: center; margin-top: 0.6mm; }
  .serv b { display: block; font-size: 8.8pt; font-weight: 600; }
  .serv p { margin: 0.5mm 0 0; font-size: 7.4pt; color: ${c.cinza}; line-height: 1.35; }
  .valor { margin-top: 9mm; display: flex; border-radius: 3mm; overflow: hidden; background: ${c.fundo}; min-height: 44mm; }
  .valor .e { width: 56%; background: ${c.principal}; color: #fff; padding: 6mm 7mm; }
  .valor .e .k { font-size: 7pt; letter-spacing: 1.1px; opacity: .85; }
  .valor .e .n { font-size: 30pt; font-weight: 700; line-height: 1.1; margin-top: 3mm; }
  .valor .e .n small { font-size: 12pt; font-weight: 600; }
  .valor .e .n em { font-size: 10.5pt; font-style: normal; font-weight: 400; }
  .valor .e p { font-size: 8.3pt; line-height: 1.45; margin: 2mm 0 0; }
  .valor .d { flex: 1; padding: 4mm 6mm; display: flex; flex-direction: column; justify-content: center; }
  .valor .d div { display: flex; justify-content: space-between; font-size: 8.8pt; padding: 2.4mm 0; border-bottom: 0.6px dashed ${c.borda}; }
  .valor .d div:last-child { border-bottom: 0; }
  .valor .d b { color: ${c.escura}; }
  .nota { font-size: 8pt; color: ${c.cinza}; margin-top: 3mm; line-height: 1.45; }
  .alerta { margin-top: 6mm; display: flex; gap: 4mm; align-items: center; background: #FFF5F5; border: 0.8px solid #F6D2D3; border-radius: 3mm; padding: 4mm 5mm; font-size: 9pt; line-height: 1.45; }
  .alerta i { flex: none; width: 7mm; height: 7mm; border-radius: 50%; background: ${c.destaque}; color: #fff; font-style: normal; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .alerta b { color: ${c.destaque}; }
  .cards { margin-top: 5mm; display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
  .cards div { border: 0.8px solid ${c.borda}; border-top: 4px solid ${c.principal}; border-radius: 3mm; padding: 4mm; }
  .cards div:nth-child(2) { border-top-color: ${c.grafite}; }
  .cards b { display: block; font-size: 9pt; font-weight: 600; margin-bottom: 2mm; }
  .cards p { margin: 0; font-size: 7.6pt; color: ${c.cinza}; line-height: 1.45; }
  .obs { margin-top: 5mm; font-size: 8.4pt; line-height: 1.5; color: ${c.grafite}; white-space: pre-line; }
  table.it { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 3mm; font-size: 8.6pt; border-radius: 3mm; overflow: hidden; }
  table.it th { background: ${c.grafite}; color: #fff; font-size: 7.2pt; letter-spacing: .8px; text-transform: uppercase; font-weight: 600; padding: 2.4mm 3mm; text-align: left; }
  table.it td { padding: 2.4mm 3mm; border-bottom: 0.6px solid ${c.borda}; vertical-align: top; }
  table.it tr:nth-child(even) td { background: ${c.fundo}; }
  table.it .n { text-align: right; white-space: nowrap; }
  table.it td small { display: block; color: ${c.cinza}; font-size: 7.4pt; margin-top: .6mm; }
  table.it tr.tot td { background: ${c.principal}; color: #fff; font-weight: 700; border: 0; }
  .fim { margin-top: 12mm; padding-bottom: 18mm; break-inside: avoid; }
  .data { font-size: 9pt; color: ${c.cinza}; margin-bottom: 14mm; }
  .ass { display: grid; grid-template-columns: 1fr 1fr; column-gap: 14mm; row-gap: 12mm; }
  .ass div { border-top: 0.8px solid ${c.cinza}; padding-top: 2mm; text-align: center; font-size: 8.4pt; }
  .ass b { display: block; font-weight: 600; }
  .ass span { color: ${c.cinza}; font-size: 7.8pt; }
  .rod { position: absolute; left: 0; right: 0; bottom: 0; height: 13mm; background: ${c.grafite}; color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 16mm; font-size: 7pt; }
  .rod b { font-weight: 600; font-size: 7.6pt; }
  .rod .p { color: ${c.principal}; font-weight: 600; font-size: 8pt; }
  `;
}

function Topo({ m, logo, titulo, sub }: { m: Marca; logo: string | null; titulo: string; sub: string }) {
  return (
    <>
      <div className="faixa"><i /></div>
      <div className="topo">
        <div className="marca">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo ? <img src={logo} alt={m.nome} /> : (<><div className="nome">{m.nome}</div><div className="sub">{m.subtitulo}</div></>)}
        </div>
        <div className="tit">
          <div className="k">PROPOSTA COMERCIAL</div>
          <div className="t">{titulo}</div>
          <div className="s">{sub}</div>
        </div>
      </div>
    </>
  );
}

function Rodape({ m, pagina, total }: { m: Marca; pagina: number; total: number }) {
  return (
    <div className="rod">
      <div>
        <b>{m.razaoSocial}</b>
        <div>{[m.cnpj ? `CNPJ ${m.cnpj}` : null, m.contato, m.endereco].filter(Boolean).join(" · ")}</div>
      </div>
      <div className="p">{String(pagina).padStart(2, "0")} / {String(total).padStart(2, "0")}</div>
    </div>
  );
}

function Cliente({ o, extra }: { o: Orcamento; extra: [string, string] | null }) {
  const cols: [string, string][] = [["Cliente", o.cliente_nome], ["CNPJ", o.cliente_cnpj || "—"]];
  if (extra) cols.push(extra);
  return (
    <div className="cli" style={{ gridTemplateColumns: cols.length === 3 ? "1.7fr 1fr 1fr" : "1.7fr 1fr" }}>
      {cols.map(([r, v]) => (
        <div key={r}><div className="r">{r}</div><div className="v">{v}</div></div>
      ))}
    </div>
  );
}

function Assinaturas({ m, o }: { m: Marca; o: Orcamento }) {
  return (
    <div className="fim">
      <div className="data">{dataPorExtenso(o.cidade ?? m.cidadePadrao, o.dados.data)}</div>
      <div className="ass">
        <div><b>{m.razaoSocial}</b><span>{m.cnpj ? `CNPJ ${m.cnpj}` : m.subtitulo}</span></div>
        <div><b>{o.cliente_nome.toUpperCase()}</b><span>{o.cliente_cnpj ? `CNPJ ${o.cliente_cnpj}` : "Cliente"}</span></div>
      </div>
    </div>
  );
}

export function OrcamentoTemplate({ o, marca: m, logo }: { o: Orcamento; marca: Marca; logo: string | null }) {
  const emitido = `${rotuloNumero(o)} · Emitido em ${dataCurta(o.dados.data)}`;
  const funcionarios = o.dados.funcionarios ? ["Funcionários", doisDigitos(o.dados.funcionarios)] as [string, string] : null;

  if (o.modelo === "essencial") {
    const e = o.dados.essencial!;
    const servicos = servicosDoEssencial(e);
    const limite = e.limiteFuncionarios;
    const detalhes: [string, string][] = [
      ["Funcionários inclusos", limite ? `até ${doisDigitos(limite)}` : "Sem limite"],
      ...(limite ? [["Colaborador excedente", `+ R$ ${fmtValor(e.valorExcedente)}`] as [string, string]] : []),
      ["Modalidade", "Mensal"],
    ];
    return (
      <>
        <div className="pg">
          <Topo m={m} logo={logo} titulo="Orçamento" sub={emitido} />
          <Cliente o={o} extra={o.cidade ? ["Cidade", o.cidade] : funcionarios} />
          <div className="plano"><span className="pill">PROPOSTA 1</span><b>Plano Essencial</b><span className="c">· contrato mensal</span></div>
          <div className="sec">SERVIÇOS INCLUSOS</div>
          <div className="serv">
            {servicos.map((s) => (
              <div key={s.titulo}><span className="ck">✓</span><span><b>{s.titulo}</b><p>{s.descricao}</p></span></div>
            ))}
          </div>
          <Rodape m={m} pagina={1} total={2} />
        </div>
        <div className="pg">
          <Topo m={m} logo={logo} titulo="Investimento" sub={o.cliente_nome} />
          <div className="valor">
            <div className="e">
              <div className="k">PLANO ESSENCIAL · MENSAL</div>
              <div className="n"><small>R$ </small>{fmtValor(e.valorMensal)}<em> /mês</em></div>
              <p>{limite ? `Contempla até ${doisDigitos(limite)} funcionários, com todos os serviços listados nesta proposta.` : "Com todos os serviços listados nesta proposta."}</p>
            </div>
            <div className="d">
              {detalhes.map(([k, v]) => (<div key={k}><span>{k}</span><b>{v}</b></div>))}
            </div>
          </div>
          {limite ? (
            <div className="nota">
              Havendo quantitativo superior a {doisDigitos(limite)} funcionários, será acrescido o valor de R$ {fmtValor(e.valorExcedente)} por colaborador excedente.
            </div>
          ) : null}
          <div className="alerta"><i>!</i><span><b>Observação.</b> O valor mensal não inclui exames complementares, avaliações ambientais e intervenções psicossociais.</span></div>
          <div className="cards">
            {EXCLUSOES_ESSENCIAL.map((x) => (<div key={x.titulo}><b>{x.titulo}</b><p>{x.descricao}</p></div>))}
          </div>
          {o.dados.observacoes?.trim() && <div className="obs">{o.dados.observacoes.trim()}</div>}
          <Assinaturas m={m} o={o} />
          <Rodape m={m} pagina={2} total={2} />
        </div>
      </>
    );
  }

  // Treinamentos e Avulso: uma página com a tabela de itens.
  const itens = o.dados.itens ?? [];
  const total = totalOrcamento(o.modelo, o.dados);
  const treino = o.modelo === "treinamentos";
  return (
    <div className="pg">
      <Topo m={m} logo={logo} titulo="Orçamento" sub={emitido} />
      <Cliente o={o} extra={o.cidade ? ["Cidade", o.cidade] : funcionarios} />
      <div className="plano"><span className="pill">PROPOSTA 1</span><b>{treino ? "Treinamentos de SST" : "Serviços"}</b><span className="c">· {treino ? "valores por participante" : "serviço complementar ao contrato"}</span></div>
      <div className="sec">{treino ? "TREINAMENTOS" : "ITENS DA PROPOSTA"}</div>
      <table className="it">
        <thead>
          <tr><th>{treino ? "Treinamento" : "Serviço"}</th><th className="n">{treino ? "Part." : "Qtd."}</th><th className="n">Valor unit.</th><th className="n">Subtotal</th></tr>
        </thead>
        <tbody>
          {itens.map((i) => (
            <tr key={i.id}>
              <td>{i.descricao}{i.detalhe ? <small>{i.detalhe}</small> : null}</td>
              <td className="n">{i.quantidade}</td>
              <td className="n">R$ {fmtValor(i.valor)}<small>{i.unidade}</small></td>
              <td className="n">R$ {fmtValor(subtotalItem(i))}</td>
            </tr>
          ))}
          <tr className="tot"><td colSpan={3}>Total</td><td className="n">R$ {fmtValor(total)}</td></tr>
        </tbody>
      </table>
      {o.dados.pagamento?.trim() && (
        <div className="alerta"><i>!</i><span><b>Forma de pagamento.</b> {o.dados.pagamento.trim()}</span></div>
      )}
      {o.dados.observacoes?.trim() && <div className="obs">{o.dados.observacoes.trim()}</div>}
      <Assinaturas m={m} o={o} />
      <Rodape m={m} pagina={1} total={1} />
    </div>
  );
}

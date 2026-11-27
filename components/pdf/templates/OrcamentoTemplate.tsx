// Comercial › Orçamentos (0.3.339): o PDF do orçamento no padrão visual das bases de conhecimento — faixa superior na
// cor da marca com bloco de acento, logo (ou o nome da marca) à esquerda e "PROPOSTA COMERCIAL" à direita, quadro do
// cliente, etiqueta "PROPOSTA 1", serviços com check em 2 colunas, bloco de valor, alerta "Observação." e 3 cartões,
// data por extenso e assinaturas em 2 colunas. A4 retrato, páginas montadas aqui (margem zero no gerador).
// Fase 2 (0.3.340): grupo de empresas (desconto e anexo de distribuição), valor por vida, inclusão do Designado CIPA e
// tabela de exames (documento próprio ou anexo). Cada modelo monta a sua lista de páginas; a numeração sai dela.

import type { ReactNode } from "react";
import type { Marca } from "@/lib/orcamentos/marcas";
import {
  EXCLUSOES_ESSENCIAL,
  aceitaAnexoExames,
  centavos,
  condicoesCipa,
  dataCurta,
  dataPorExtenso,
  descontoGrupo,
  distribuicaoGrupo,
  doisDigitos,
  examesPorCategoria,
  faturamentoMinimo,
  fmtValor,
  funcionariosDoGrupo,
  mensalPorVida,
  novaMensalidadeCipa,
  paginarExames,
  rotuloNumero,
  servicosDoEssencial,
  somaIndividual,
  subtotalItem,
  totalOrcamento,
  valorPorColaborador,
  vidasInformadas,
  type DadosEssencial,
  type DadosExames,
  type ExameTabela,
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
  /* Fase 2 (0.3.340) */
  .valor .e .de { font-size: 10pt; opacity: .85; margin-top: 2mm; }
  .valor .e .de s { font-weight: 600; }
  .tag { display: inline-block; margin-top: 2.5mm; background: #fff; color: ${c.principal}; font-size: 7pt; font-weight: 700; letter-spacing: 1px; border-radius: 10px; padding: 2px 9px; }
  .ap { margin-top: 6mm; font-size: 9.2pt; line-height: 1.6; }
  .conta { margin-top: 6mm; display: flex; align-items: stretch; gap: 3mm; }
  .conta > div { flex: 1; border: 0.8px solid ${c.borda}; border-radius: 3mm; padding: 4mm; text-align: center; background: ${c.fundo}; }
  .conta > div.fim2 { background: ${c.principal}; border-color: ${c.principal}; color: #fff; }
  .conta .k { font-size: 7pt; letter-spacing: 1px; text-transform: uppercase; opacity: .8; }
  .conta .n { font-size: 17pt; font-weight: 700; margin-top: 1.5mm; white-space: nowrap; }
  .conta > div.op { flex: none; align-self: center; font-size: 18pt; font-weight: 700; color: ${c.escura}; border: 0; background: none; padding: 0; }
  ol.cond { margin: 3mm 0 0; padding: 0; list-style: none; counter-reset: c; }
  ol.cond li { counter-increment: c; display: flex; gap: 3mm; padding: 2.2mm 0; border-bottom: 0.6px solid ${c.borda}; font-size: 8.8pt; line-height: 1.45; }
  ol.cond li:before { content: counter(c); flex: none; width: 5mm; height: 5mm; border-radius: 50%; background: ${c.check}; color: #fff; font-size: 7.5pt; font-weight: 600; display: flex; align-items: center; justify-content: center; }
  .passos { margin-top: 3mm; display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
  .passos div { border: 0.8px solid ${c.borda}; border-radius: 3mm; padding: 4mm; }
  .passos i { display: inline-flex; width: 6mm; height: 6mm; border-radius: 50%; background: ${c.principal}; color: #fff; font-style: normal; font-weight: 700; font-size: 8pt; align-items: center; justify-content: center; }
  .passos b { display: block; font-size: 9pt; font-weight: 600; margin: 2mm 0 1mm; }
  .passos p { margin: 0; font-size: 7.8pt; color: ${c.cinza}; line-height: 1.45; }
  .chip { display: inline-block; background: ${c.fundo}; border: 0.6px solid ${c.borda}; border-radius: 8px; padding: 0.4mm 2.2mm; margin: 0.6mm 1mm 0.6mm 0; font-size: 7.2pt; }
  .isento { color: ${c.check}; font-weight: 600; }
  .cols { margin-top: 3mm; display: grid; grid-template-columns: 1fr 1fr; column-gap: 7mm; align-items: start; }
  .cat { margin-bottom: 3mm; }
  .cat h4 { margin: 0; font-size: 8pt; letter-spacing: 1px; text-transform: uppercase; color: ${c.escura}; padding: 1.6mm 0; border-bottom: 1.4px solid ${c.check}; }
  .cat div { display: flex; justify-content: space-between; gap: 3mm; font-size: 8.4pt; padding: 1.25mm 0; border-bottom: 0.6px dashed ${c.borda}; }
  .cat div b { font-weight: 600; white-space: nowrap; }
  .anexo { margin-top: 7mm; display: flex; align-items: center; gap: 3mm; }
  .anexo b { font-size: 13pt; font-weight: 600; }
  .datafim { position: absolute; left: 16mm; bottom: 19mm; font-size: 9pt; color: ${c.cinza}; }
  `;
}

function Topo({ m, logo, titulo, sub, kicker = "PROPOSTA COMERCIAL" }: { m: Marca; logo: string | null; titulo: string; sub: string; kicker?: string }) {
  return (
    <>
      <div className="faixa"><i /></div>
      <div className="topo">
        <div className="marca">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo ? <img src={logo} alt={m.nome} /> : (<><div className="nome">{m.nome}</div><div className="sub">{m.subtitulo}</div></>)}
        </div>
        <div className="tit">
          <div className="k">{kicker}</div>
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

function Cliente({ cols }: { cols: [string, string][] }) {
  return (
    <div className="cli" style={{ gridTemplateColumns: cols.length === 3 ? "1.7fr 1fr 1fr" : "1.7fr 1fr" }}>
      {cols.map(([r, v]) => (
        <div key={r}><div className="r">{r}</div><div className="v">{v}</div></div>
      ))}
    </div>
  );
}

function Assinaturas({ m, o, contratantes }: { m: Marca; o: Orcamento; contratantes?: { nome: string; cnpj: string | null }[] }) {
  const lista = contratantes ?? [{ nome: o.cliente_nome, cnpj: o.cliente_cnpj }];
  return (
    <div className="fim">
      <div className="data">{dataPorExtenso(o.cidade ?? m.cidadePadrao, o.dados.data)}</div>
      <div className="ass">
        <div><b>{m.razaoSocial}</b><span>{m.cnpj ? `CNPJ ${m.cnpj}` : m.subtitulo}</span></div>
        {lista.map((c, k) => (
          <div key={k}><b>{c.nome.toUpperCase()}</b><span>{c.cnpj ? `CNPJ ${c.cnpj}` : "Contratante"}</span></div>
        ))}
      </div>
    </div>
  );
}

/** "R$ 1.234,56" com espaço que não quebra (as bases pedem para o R$ não ficar sozinho no fim da linha). */
const brl = (v: number) => `R$ ${fmtValor(v)}`;

function Servicos({ e }: { e: DadosEssencial }) {
  return (
    <div className="serv">
      {servicosDoEssencial(e).map((s) => (
        <div key={s.titulo}><span className="ck">✓</span><span><b>{s.titulo}</b><p>{s.descricao}</p></span></div>
      ))}
    </div>
  );
}

function Exclusoes({ frase }: { frase: string }) {
  return (
    <>
      <div className="alerta"><i>!</i><span><b>Observação.</b> {frase}</span></div>
      <div className="cards">
        {EXCLUSOES_ESSENCIAL.map((x) => (<div key={x.titulo}><b>{x.titulo}</b><p>{x.descricao}</p></div>))}
      </div>
    </>
  );
}

function Observacoes({ o }: { o: Orcamento }) {
  return o.dados.observacoes?.trim() ? <div className="obs">{o.dados.observacoes.trim()}</div> : null;
}

function BlocoValor({ k, valor, sufixo, de, tag, frase, detalhes }: {
  k: string; valor: number; sufixo: string; de?: number | null; tag?: string; frase: string; detalhes: [string, string][];
}) {
  return (
    <div className="valor">
      <div className="e">
        <div className="k">{k}</div>
        {de ? <div className="de">De <s>{brl(de)}</s> por</div> : null}
        <div className="n"><small>R$ </small>{fmtValor(valor)}<em> {sufixo}</em></div>
        {tag ? <span className="tag">{tag}</span> : null}
        <p>{frase}</p>
      </div>
      <div className="d">
        {detalhes.map(([a, b]) => (<div key={a}><span>{a}</span><b>{b}</b></div>))}
      </div>
    </div>
  );
}

function SetoresExames({ t }: { t: DadosExames }) {
  const porId = new Map(t.exames.map((e) => [e.id, e]));
  return (
    <table className="it">
      <thead><tr><th>Setor</th><th>Exames</th><th className="n">Valor por colaborador</th></tr></thead>
      <tbody>
        {t.setores.map((s) => {
          const v = valorPorColaborador(s, t.exames);
          const lista = s.exames.map((id) => porId.get(id)).filter((e): e is ExameTabela => !!e);
          return (
            <tr key={s.id}>
              <td style={{ width: "28%" }}><b>{s.setor}</b></td>
              <td>{lista.map((e) => <span key={e.id} className="chip">{e.nome}</span>)}</td>
              <td className="n">{v > 0 ? brl(v) : <span className="isento">Isento</span>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ColunasExames({ colunas }: { colunas: { categoria: string; exames: ExameTabela[] }[][] }) {
  return (
    <div className="cols">
      {colunas.map((col, k) => (
        <div key={k}>
          {col.map((g, j) => (
            <div key={j} className="cat">
              <h4>{g.categoria}</h4>
              {g.exames.map((e) => (<div key={e.id}><span>{e.nome}</span>{e.isento ? <b className="isento">Isento</b> : <b>{brl(e.valor)}</b>}</div>))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

interface Pagina {
  titulo: string;
  sub: string;
  kicker?: string;
  corpo: ReactNode;
}

/** As páginas da tabela de exames (o documento próprio ou o anexo): quadro por setor na 1ª e os valores em 2 colunas. */
function paginasExames(t: DadosExames, inicio: ReactNode, fim: ReactNode, base: Omit<Pagina, "corpo">, baseDemais: Omit<Pagina, "corpo">): Pagina[] {
  // ~5,2 mm por linha; a 1ª página perde o quadro do cliente (ou o título do anexo) e o quadro por setor.
  const linhasSetores = t.setores.length ? 4 + t.setores.reduce((s, x) => s + 1.6 + Math.floor(x.exames.length / 6) * 0.9, 0) : 0;
  const capPrimeira = Math.max(6, Math.floor(30 - linhasSetores));
  const paginas = paginarExames(examesPorCategoria(t.exames), capPrimeira, 36);
  return paginas.map((colunas, k) => ({
    ...(k === 0 ? base : baseDemais),
    corpo: (
      <>
        {k === 0 && inicio}
        {k === 0 && t.setores.length > 0 && (<><div className="sec">EXAMES POR SETOR</div><SetoresExames t={t} /></>)}
        <div className="sec">VALORES UNITÁRIOS{k > 0 ? " (CONTINUAÇÃO)" : ""}</div>
        <ColunasExames colunas={colunas} />
        {k === paginas.length - 1 && fim}
      </>
    ),
  }));
}

function montarPaginas(o: Orcamento, m: Marca): Pagina[] {
  const d = o.dados;
  const emitido = `${rotuloNumero(o)} · Emitido em ${dataCurta(d.data)}`;
  const terceiro: [string, string][] = o.cidade ? [["Cidade", o.cidade]] : d.funcionarios ? [["Funcionários", doisDigitos(d.funcionarios)]] : [];
  const clientePadrao: [string, string][] = [["Cliente", o.cliente_nome], ["CNPJ", o.cliente_cnpj || "—"], ...terceiro];
  const pill = (titulo: string, comp: string) => (<div className="plano"><span className="pill">PROPOSTA 1</span><b>{titulo}</b><span className="c">· {comp}</span></div>);
  const out: Pagina[] = [];
  const e = d.essencial;

  switch (o.modelo) {
    case "essencial": {
      const ess = e!;
      const limite = ess.limiteFuncionarios;
      out.push({ titulo: "Orçamento", sub: emitido, corpo: (<><Cliente cols={clientePadrao} />{pill("Plano Essencial", "contrato mensal")}<div className="sec">SERVIÇOS INCLUSOS</div><Servicos e={ess} /></>) });
      out.push({
        titulo: "Investimento", sub: o.cliente_nome, corpo: (
          <>
            <BlocoValor k="PLANO ESSENCIAL · MENSAL" valor={ess.valorMensal} sufixo="/mês"
              frase={limite ? `Contempla até ${doisDigitos(limite)} funcionários, com todos os serviços listados nesta proposta.` : "Com todos os serviços listados nesta proposta."}
              detalhes={[["Funcionários inclusos", limite ? `até ${doisDigitos(limite)}` : "Sem limite"], ...(limite ? [["Colaborador excedente", `+ ${brl(ess.valorExcedente)}`] as [string, string]] : []), ["Modalidade", "Mensal"]]} />
            {limite ? <div className="nota">Havendo quantitativo superior a {doisDigitos(limite)} funcionários, será acrescido o valor de {brl(ess.valorExcedente)} por colaborador excedente.</div> : null}
            <Exclusoes frase="O valor mensal não inclui exames complementares, avaliações ambientais e intervenções psicossociais." />
            <Observacoes o={o} />
            <Assinaturas m={m} o={o} />
          </>
        ),
      });
      break;
    }

    case "grupo": {
      const g = d.grupo!;
      const desc = descontoGrupo(g);
      const func = funcionariosDoGrupo(g);
      // Grupo grande: o bloco do valor vai para a página do investimento (a tabela das empresas ocupa a 1ª).
      const valorNaPrimeira = g.empresas.length <= 9;
      const bloco = (
        <BlocoValor k="CONDIÇÃO EXCLUSIVA · GRUPO DE EMPRESAS" valor={g.valorGrupo} sufixo="/mês" de={somaIndividual(g)} tag="DESCONTO DE GRUPO"
          frase={`Valor mensal do grupo (${g.empresas.length} empresas), com todos os serviços listados nesta proposta para cada empresa.`}
          detalhes={[["Desconto mensal", brl(desc.mensal)], ["Economia anual", brl(desc.anual)], ["Empresas", doisDigitos(g.empresas.length)], ["Modalidade", "Mensal"]]} />
      );
      out.push({
        titulo: "Orçamento", sub: emitido, corpo: (
          <>
            <Cliente cols={[["Grupo", o.cliente_nome], ["Empresas", doisDigitos(g.empresas.length)], ["Funcionários", func ? doisDigitos(func) : "—"]]} />
            {pill("Plano Essencial", "grupo de empresas")}
            <div className="sec">EMPRESAS DO GRUPO</div>
            <table className="it">
              <thead><tr><th>Empresa</th><th>CNPJ</th><th className="n">Funcionários</th><th className="n">Valor individual</th></tr></thead>
              <tbody>
                {g.empresas.map((x) => (
                  <tr key={x.id}><td>{x.nome}</td><td>{x.cnpj || "—"}</td><td className="n">{x.funcionarios ? doisDigitos(x.funcionarios) : "—"}</td><td className="n">{brl(x.valorIndividual)}</td></tr>
                ))}
                <tr className="tot"><td colSpan={3}>Soma dos valores individuais</td><td className="n">{brl(somaIndividual(g))}</td></tr>
              </tbody>
            </table>
            {valorNaPrimeira && bloco}
          </>
        ),
      });
      out.push({ titulo: "Serviços", sub: o.cliente_nome, corpo: (<><div className="sec">SERVIÇOS INCLUSOS EM CADA EMPRESA</div><Servicos e={e!} /></>) });
      out.push({
        titulo: "Investimento", sub: o.cliente_nome, corpo: (
          <>
            {!valorNaPrimeira && bloco}
            <div className="nota" style={valorNaPrimeira ? { marginTop: "8mm" } : undefined}>Cada empresa do grupo tem os documentos de SST em nome e CNPJ próprios.</div>
            <Exclusoes frase="O valor mensal do grupo não inclui exames complementares, avaliações ambientais e intervenções psicossociais de cada empresa." />
            <Observacoes o={o} />
            <Assinaturas m={m} o={o} contratantes={g.empresas.map((x) => ({ nome: x.nome, cnpj: x.cnpj }))} />
          </>
        ),
      });
      const dist = g.anexoDistribuicao ? distribuicaoGrupo(g) : null;
      if (dist) {
        const valorDe = new Map(dist.map((x) => [x.id, x.valor]));
        out.push({
          titulo: "Anexo", sub: "Distribuição por empresa", corpo: (
            <>
              <div className="anexo"><span className="pill">ANEXO</span><b>Distribuição do valor do grupo</b></div>
              <p className="ap">O valor mensal do grupo ({brl(g.valorGrupo)}) é distribuído entre as empresas na proporção do número de funcionários: valor do grupo ÷ total de funcionários ({func}) × funcionários da empresa.</p>
              <table className="it">
                <thead><tr><th>Empresa</th><th>CNPJ</th><th className="n">Funcionários</th><th className="n">Valor mensal</th></tr></thead>
                <tbody>
                  {g.empresas.map((x) => (
                    <tr key={x.id}><td>{x.nome}</td><td>{x.cnpj || "—"}</td><td className="n">{doisDigitos(x.funcionarios ?? 0)}</td><td className="n">{brl(valorDe.get(x.id) ?? 0)}</td></tr>
                  ))}
                  <tr className="tot"><td colSpan={2}>Total do grupo</td><td className="n">{doisDigitos(func)}</td><td className="n">{brl(g.valorGrupo)}</td></tr>
                </tbody>
              </table>
            </>
          ),
        });
      }
      break;
    }

    case "vida": {
      const v = d.vida!;
      const informadas = vidasInformadas(v, d.funcionarios);
      const minimo = v.minimoVidas || 0;
      out.push({ titulo: "Orçamento", sub: emitido, corpo: (<><Cliente cols={clientePadrao} />{pill("Plano Essencial", "valor por vida")}<div className="sec">SERVIÇOS INCLUSOS</div><Servicos e={e!} /></>) });
      out.push({
        titulo: "Investimento", sub: o.cliente_nome, corpo: (
          <>
            <BlocoValor k="VALOR POR VIDA · MENSAL" valor={v.valorPorVida} sufixo="/vida"
              frase={`Por colaborador ativo ao mês, com todos os serviços listados nesta proposta.${minimo ? ` Faturamento mínimo de ${doisDigitos(minimo)} vidas.` : ""}`}
              detalhes={[
                ["Vidas informadas", doisDigitos(informadas)],
                ...(minimo ? [["Mínimo de vidas", doisDigitos(minimo)] as [string, string], ["Faturamento mínimo", brl(faturamentoMinimo(v))] as [string, string]] : []),
                ["Valor mensal", brl(mensalPorVida(v, d.funcionarios))],
              ]} />
            <div className="sec">COMO FUNCIONA A COBRANÇA</div>
            <div className="passos">
              <div><i>1</i><b>Base de precificação</b><p>{brl(v.valorPorVida)} por vida (colaborador ativo) ao mês.</p></div>
              <div><i>2</i><b>Quantitativo mínimo</b><p>{minimo ? `O faturamento mínimo é de ${doisDigitos(minimo)} vidas (${brl(faturamentoMinimo(v))}/mês), mesmo com menos colaboradores.` : "Sem quantitativo mínimo: cobra-se pelas vidas ativas no mês."}</p></div>
              <div><i>3</i><b>{minimo ? "Acima do mínimo" : "Variação no mês"}</b><p>{minimo ? `Acima de ${doisDigitos(minimo)} vidas, cada colaborador ativo soma ${brl(v.valorPorVida)} ao mês.` : `Cada colaborador ativo a mais soma ${brl(v.valorPorVida)} ao mês.`}</p></div>
            </div>
            {v.funcoes.length > 0 && (
              <>
                <div className="sec">DISTRIBUIÇÃO POR FUNÇÃO</div>
                <table className="it">
                  <thead><tr><th>Função</th><th className="n">Colaboradores</th><th className="n">Valor por vida</th><th className="n">Valor mensal</th></tr></thead>
                  <tbody>
                    {v.funcoes.map((f) => (
                      <tr key={f.id}><td>{f.funcao}</td><td className="n">{doisDigitos(f.colaboradores)}</td><td className="n">{brl(v.valorPorVida)}</td><td className="n">{brl(centavos(f.colaboradores * v.valorPorVida))}</td></tr>
                    ))}
                    <tr className="tot"><td>Total</td><td className="n">{doisDigitos(informadas)}</td><td /><td className="n">{brl(centavos(informadas * v.valorPorVida))}</td></tr>
                  </tbody>
                </table>
                {minimo > informadas && <div className="nota">Abaixo do mínimo de {doisDigitos(minimo)} vidas: vale o faturamento mínimo de {brl(faturamentoMinimo(v))} ao mês.</div>}
              </>
            )}
          </>
        ),
      });
      out.push({
        titulo: "Condições", sub: o.cliente_nome, corpo: (
          <>
            <Exclusoes frase="O valor mensal não inclui exames complementares, avaliações ambientais e intervenções psicossociais." />
            <Observacoes o={o} />
            <Assinaturas m={m} o={o} />
          </>
        ),
      });
      break;
    }

    case "cipa": {
      const c = d.cipa!;
      out.push({
        titulo: "Proposta", sub: emitido, corpo: (
          <>
            <Cliente cols={clientePadrao} />
            {pill("Inclusão do Designado CIPA – NR-5", "contrato vigente")}
            <p className="ap">
              Atualmente, o contrato prevê os serviços do Plano Essencial pelo valor mensal de <b>{brl(c.mensalidadeAtual)}</b>. Esta proposta inclui no
              contrato o Designado da CIPA (NR-5), com o acréscimo de <b>{brl(c.acrescimo)}</b> na mensalidade.
            </p>
            <div className="conta">
              <div><div className="k">Mensalidade atual</div><div className="n">{brl(c.mensalidadeAtual)}</div></div>
              <div className="op">+</div>
              <div><div className="k">Acréscimo · Designado CIPA</div><div className="n">{brl(c.acrescimo)}</div></div>
              <div className="op">=</div>
              <div className="fim2"><div className="k">Nova mensalidade</div><div className="n">{brl(novaMensalidadeCipa(c))}</div></div>
            </div>
            <div className="sec">CONDIÇÕES COMERCIAIS</div>
            <ol className="cond">{condicoesCipa(c).map((x) => <li key={x}>{x}</li>)}</ol>
            <div className="sec">APROVAÇÃO E FORMALIZAÇÃO</div>
            <p className="ap" style={{ marginTop: "3mm" }}>A aprovação pode ser feita pela assinatura desta proposta ou por e-mail. Depois da aprovação, a inclusão é formalizada no contrato e passa a valer no faturamento seguinte.</p>
            <Observacoes o={o} />
            <Assinaturas m={m} o={o} />
          </>
        ),
      });
      break;
    }

    case "exames": {
      const t = d.tabelaExames ?? { exames: [], setores: [] };
      const plano: [string, string][] = t.plano?.trim() ? [["Plano", t.plano.trim()]] : terceiro;
      return paginasExames(
        t,
        <Cliente cols={[["Cliente", o.cliente_nome], ["CNPJ", o.cliente_cnpj || "—"], ...plano]} />,
        <><Observacoes o={o} /><div className="datafim">{dataPorExtenso(o.cidade ?? m.cidadePadrao, d.data)}</div></>,
        { titulo: "Tabela de Exames", sub: `${rotuloNumero(o)} · Emitida em ${dataCurta(d.data)}`, kicker: "TABELA DE VALORES" },
        { titulo: "Tabela de Exames", sub: o.cliente_nome, kicker: "TABELA DE VALORES" },
      );
    }

    default: {
      // Treinamentos e Avulso: uma página com a tabela de itens.
      const itens = d.itens ?? [];
      const total = totalOrcamento(o.modelo, d);
      const treino = o.modelo === "treinamentos";
      out.push({
        titulo: "Orçamento", sub: emitido, corpo: (
          <>
            <Cliente cols={clientePadrao} />
            {pill(treino ? "Treinamentos de SST" : "Serviços", treino ? "valores por participante" : "serviço complementar ao contrato")}
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
            {d.pagamento?.trim() && (<div className="alerta"><i>!</i><span><b>Forma de pagamento.</b> {d.pagamento.trim()}</span></div>)}
            <Observacoes o={o} />
            <Assinaturas m={m} o={o} />
          </>
        ),
      });
    }
  }

  // Anexo: a tabela de exames complementares (faturados à parte), quando marcada.
  if (aceitaAnexoExames(o.modelo) && d.anexarExames && d.tabelaExames?.exames.length) {
    out.push(...paginasExames(
      d.tabelaExames,
      <>
        <div className="anexo"><span className="pill">ANEXO</span><b>Tabela de exames complementares</b></div>
        <p className="ap">Valores unitários dos exames complementares, cobrados por exame realizado conforme o PCMSO (fora da mensalidade).</p>
      </>,
      null,
      { titulo: "Anexo", sub: "Tabela de exames" },
      { titulo: "Anexo", sub: "Tabela de exames (continuação)" },
    ));
  }
  return out;
}

export function OrcamentoTemplate({ o, marca: m, logo }: { o: Orcamento; marca: Marca; logo: string | null }) {
  const paginas = montarPaginas(o, m);
  return (
    <>
      {paginas.map((p, k) => (
        <div key={k} className="pg">
          <Topo m={m} logo={logo} titulo={p.titulo} sub={p.sub} kicker={p.kicker} />
          {p.corpo}
          <Rodape m={m} pagina={k + 1} total={paginas.length} />
        </div>
      ))}
    </>
  );
}

import React from "react";
import { LOGO_JCN_DATA_URI } from "@/lib/pdf/logo-jcn";

/**
 * Termo de Transferência de Equipamento — patrimônio interno da JCN Consultoria.
 *
 * UM TERMO PARA TRÊS MOVIMENTOS. Retirada, devolução e transferência entre
 * bases são o mesmo documento com origem e destino trocados de lugar. Cada lado
 * é marcado como BASE ou COLABORADOR, e é só isso que muda entre os três — por
 * isso não existem três templates. Devolução não rasura o termo de retirada:
 * gera um termo novo, na mesma disciplina append-only de
 * `equipamentos_movimentacoes`.
 *
 * ⚠️ CABE EM UMA FOLHA E ISSO É REQUISITO, não estética. São duas vias por
 * movimentação, e o bloco de assinatura tem de ficar na mesma página das
 * cláusulas que ele assina. O conteúdo mede ~268 mm contra 281 mm úteis (A4
 * com margem de 8×10 mm). Quem mexer aqui precisa remedir: passar de 281 mm
 * empurra as assinaturas para uma segunda página em silêncio.
 *
 * ⚠️ A ETIQUETA DE PATRIMÔNIO É DO ITEM, não da pessoa. O formulário de papel
 * que serviu de referência trazia "Etiqueta de Patrimônio" no bloco do
 * colaborador — o que quebra assim que o termo carrega mais de um bem, e é
 * justamente o campo que amarra o documento ao inventário.
 *
 * Os valores dos itens vêm do SNAPSHOT gravado em `*_itens`, nunca de um join
 * com `equipamentos`. Um termo de 2026 tem de continuar legível depois que o
 * aparelho for editado ou baixado.
 */

export type TipoTermo = "entrega" | "devolucao" | "transferencia";

export interface LadoTermo {
  /** BASE ou COLABORADOR — é o que a caixinha marcada informa. */
  tipo: "base" | "colaborador";
  nome: string;
  unidade: string | null;
  matricula_cpf: string | null;
  setor: string | null;
  telefone: string | null;
  email: string | null;
}

export interface ItemTermo {
  patrimonio: string | null;
  descricao: string | null;
  marca_modelo: string | null;
  serie: string | null;
  nota_fiscal: string | null;
  quantidade: number | null;
  /** Novo/Bom/Regular/Avariado na entrega; íntegro/avariado/inservível na volta. */
  estado: string | null;
}

export interface AssinaturaTermo {
  /** Quem assinou: quem envia, quem recebe, quem valida. Sem isto o termo imprimia a
   *  assinatura mais recente na linha "Quem recebe", trocando os papeis. */
  papel?: "envia" | "recebe" | "valida";
  /** Necessário para o termo dizer quando entrega e validação foram a MESMA pessoa —
   *  comparar por nome casaria homônimos e erraria em documento trabalhista. */
  id_colaborador?: string | null;
  nome: string | null;
  assinatura_png: string | null;
  assinado_em: string | null;
  metodo: string | null;
  /** Vem do matcher, no servidor. Fica impresso: e o que distingue uma assinatura
   *  biometrica verificada de um nome digitado no lugar dela. */
  match_score?: number | null;
  finger_verificado?: boolean;
  /** O conteudo da retirada ainda e o mesmo de quando esta assinatura foi dada?
   *  `null` = nao da para saber (assinatura antiga, sem hash gravado). */
  conteudo_confere?: boolean | null;
  codigo: string | null;
}

export interface TermoEquipamentoProps {
  tipo: TipoTermo;
  numero: string;
  emitidoEm: string;
  unidadeEmissora: string | null;
  origem: LadoTermo;
  destino: LadoTermo;
  itens: ItemTermo[];
  acessorios: string | null;
  observacoesEstado: string | null;
  motivo: string | null;
  local: string | null;
  dataAto: string | null;
  conferente: string | null;
  assinatura: AssinaturaTermo | null;
  /** As três, quando existem (retirada). A `assinatura` acima segue para o caso de
   *  transferência, que tem aceite único. */
  assinaturas?: AssinaturaTermo[];
  /** SHA-256 do CONTEÚDO do termo (JSON canônico), não dos bytes do PDF — um
   *  documento não consegue imprimir o hash de si mesmo. Serve para o mesmo
   *  fim: reemitir o termo com os mesmos dados devolve o mesmo hash, e uma
   *  linha alterada depois da assinatura deixa de bater. Quando a
   *  transferência já tem `pdf_sha256` gravado pela v136 (aceite eletrônico),
   *  é aquele que vem — ele é mais forte. */
  sha256: string | null;
  /** A emissão virou um ATO do usuário (v192). Enquanto for `false`, o termo sai como
   *  rascunho: marca d'água, sem blocos de assinatura e sem selo. Documento que ainda vai
   *  mudar não pode circular parecendo definitivo. */
  emitido?: boolean;
  /** Documento assinado não se apaga, se cancela — o registro tem de continuar
   *  existindo, com o motivo à vista. */
  cancelado?: { em: string | null; por: string | null; motivo: string | null } | null;
  /** Alterações feitas depois da emissão. Impresso SÓ quando existe alguma: termo limpo
   *  continua limpo. */
  historico?: HistoricoTermo[];
}

export interface HistoricoTermo {
  acao: string;
  campo: string | null;
  valor_antes: string | null;
  valor_depois: string | null;
  motivo: string | null;
  usuario_email: string | null;
  criado_em: string | null;
}

/**
 * Selo "Assinado Biometricamente", no espírito do que o SGG imprime acima da linha.
 *
 * Desenhado em SVG e não copiado do PDF do fornecedor: imprime nítido em qualquer escala,
 * não cria dependência de asset e não carrega arte de terceiro.
 *
 * **O selo é uma afirmação.** Quem o vê num termo entende "esta pessoa encostou o dedo
 * neste documento". Por isso ele obedece à mesma condição da linha "digital verificada":
 * só sai com `finger_verificado` E com o hash do conteúdo ainda batendo. Selo que aparece
 * sempre não informa nada; selo que aparece quando não devia é a mentira que o resto
 * deste trabalho existe para impedir.
 */
function SeloBiometrico() {
  return (
    <div className="selo" aria-hidden="true">
      <svg viewBox="0 0 120 64" role="img">
        {/* Duas digitais = arcos CONCÊNTRICOS abertos embaixo, que é a forma real de uma
            impressão digital. A primeira versão usava curvas divergentes e saía um
            ancinho — só dava para saber renderizando, não lendo o código. */}
        {[
          { cx: 34, cy: 40, giro: -12 },
          { cx: 86, cy: 40, giro: 10 },
        ].map(({ cx, cy, giro }, lado) => (
          <g key={lado} transform={`rotate(${giro} ${cx} ${cy})`}>
            {[0, 1, 2, 3, 4].map((i) => {
              const rx = 4.5 + i * 4.2;
              const ry = 4 + i * 4.6;
              return (
                <path
                  key={i}
                  d={`M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.9}
                  strokeLinecap="round"
                />
              );
            })}
            {/* O núcleo: o tracinho central que fecha a leitura como "digital". */}
            <path
              d={`M ${cx} ${cy} L ${cx} ${cy - 4}`}
              stroke="currentColor"
              strokeWidth={1.9}
              strokeLinecap="round"
            />
          </g>
        ))}
        <text x="60" y="60" textAnchor="middle" className="selo-txt">
          ASSINADO BIOMETRICAMENTE
        </text>
      </svg>
    </div>
  );
}

/** O termo é lido por RH e, eventualmente, por advogado. `item_rem` não diz nada a
 *  eles; "Item removido" diz. */
const ROTULO_ACAO: Record<string, string> = {
  emitiu: "Emissão",
  editou: "Edição",
  item_add: "Item incluído",
  item_edit: "Item alterado",
  item_rem: "Item removido",
  cancelou: "Cancelamento",
};

const SUBTITULO: Record<TipoTermo, string> = {
  entrega: "Retirada de equipamento — saída da base para o colaborador",
  devolucao: "Devolução de equipamento — retorno do colaborador para a base",
  transferencia: "Transferência de equipamento entre bases",
};

/** Linhas em branco quando há poucos itens: quem assina não deve encontrar
 *  espaço vazio onde caberia um item acrescentado depois da assinatura. */
const MIN_LINHAS = 2;

/**
 * ⚠️ `new Date("2026-08-26")` é meia-noite UTC, que em BRT (-03) é dia 25 às 21h
 * — uma data `date` do Postgres imprimiria SEMPRE um dia a menos no termo, e
 * ninguém notaria até alguém conferir a data da retirada num processo.
 * Ancorar ao meio-dia resolve para qualquer fuso entre -11 e +12.
 */
function fmtData(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const ou = (v: string | null | undefined) => (v && String(v).trim() ? String(v) : "—");

const STYLE = `
* { box-sizing: border-box; }
body { font-family: "Segoe UI", Arial, Helvetica, sans-serif; color: #111418; font-size: 10pt; }
.termo { --verde:#00a659; --tinta:#111418; --fraca:#5b6570; --linha:#9aa3ac; --forte:#3c444c; --faixa:#eceef0; }

.cab { display: flex; align-items: stretch; border: 1.2pt solid var(--forte); }
.cab .marca { width: 38mm; flex: none; padding: 1.5mm; border-right: 1.2pt solid var(--forte); display: flex; align-items: center; justify-content: center; }
.cab .marca img { width: 30mm; height: auto; display: block; }
.cab .titulo { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 2mm 3.5mm; }
.cab .titulo h1 { margin: 0; font-size: 12pt; font-weight: 700; letter-spacing: .01em; }
.cab .titulo .sub { margin-top: .8mm; font-size: 7pt; color: var(--fraca); }
.cab .meta { width: 50mm; flex: none; border-left: 1.2pt solid var(--forte); display: flex; flex-direction: column; }
.cab .meta .cel { flex: 1; padding: .6mm 2.2mm; border-bottom: .6pt solid var(--linha); }
.cab .meta .cel:last-child { border-bottom: 0; }

.bloco { margin-top: 1.6mm; border: 1.2pt solid var(--forte); page-break-inside: avoid; }
.barra { background: var(--faixa); border-bottom: 1.2pt solid var(--forte); padding: .9mm 2.5mm; font-size: 8pt; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.barra .dica { font-weight: 400; font-size: 6.8pt; letter-spacing: 0; text-transform: none; color: var(--fraca); margin-left: 2.5mm; }

.lados { display: flex; }
.lado { flex: 1; border-right: 1.2pt solid var(--forte); }
.lado:last-child { border-right: 0; }
.lado h2 { margin: 0; padding: 1mm 2.5mm; background: #f7f8f9; border-bottom: .6pt solid var(--linha); font-size: 7.6pt; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; display: flex; align-items: center; }
.lado h2 .mk { font-weight: 400; text-transform: none; letter-spacing: 0; font-size: 7.2pt; margin-left: 6px; }
.lado h2 .mk:first-of-type { margin-left: auto; }

.linha { display: flex; }
.campo { flex: 1; padding: 1.1mm 2.2mm; border-bottom: .6pt solid var(--linha); min-height: 5.8mm; }
.linha:last-child .campo { border-bottom: 0; }
.rot { display: block; font-size: 6pt; letter-spacing: .07em; text-transform: uppercase; color: var(--fraca); margin-bottom: .3mm; }
.val { font-size: 8.8pt; min-height: 4mm; }

.cx { display: inline-block; width: 3.2mm; height: 3.2mm; border: .8pt solid var(--forte); border-radius: .5mm; vertical-align: -.6mm; margin-right: 1.2mm; position: relative; }
.cx.on::after { content: ""; position: absolute; left: .9mm; top: .1mm; width: 1mm; height: 2mm; border: solid #00794a; border-width: 0 .7mm .7mm 0; transform: rotate(42deg); }

table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th, td { border: .6pt solid var(--linha); padding: .9mm 1.6mm; vertical-align: middle; font-size: 8.2pt; }
th { background: #f7f8f9; font-size: 6.2pt; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; text-align: left; color: var(--fraca); }
td { height: 6.2mm; }
tbody tr:nth-child(even) td { background: #fcfcfd; }
.c-idx { width: 6mm; text-align: center; color: var(--fraca); font-size: 7.5pt; }
.c-pat { width: 22mm; } .c-mod { width: 34mm; } .c-ser { width: 28mm; } .c-nf { width: 19mm; }
.c-qtd { width: 11mm; text-align: center; } .c-est { width: 21mm; }

.declara { padding: 1.8mm 3mm; }
.declara p { margin: 0 0 1.1mm; font-size: 7.9pt; }
.declara ol { margin: 0; padding-left: 4.6mm; font-size: 7pt; line-height: 1.18; column-count: 2; column-gap: 6mm; column-rule: .4pt dotted #cfd5da; }
.declara ol li { margin-bottom: .8mm; break-inside: avoid; }
.nota { margin-top: 1.6mm; padding-top: 1.3mm; border-top: .5pt dotted var(--linha); font-size: 6.4pt; color: var(--fraca); }

.localdata { display: flex; gap: 6mm; padding: 1.8mm 3mm 0; }
.localdata .li { flex: 1; } .localdata .di { width: 46mm; }
.assinaturas { display: flex; gap: 6mm; padding: 3.5mm 3mm 2.5mm; }
.assina { flex: 1; text-align: center; }
.assina .traco { height: 9mm; display: flex; align-items: flex-end; justify-content: center; }
.assina .traco img { max-height: 9mm; max-width: 100%; object-fit: contain; }
.assina .rasp { border-top: .8pt solid var(--forte); padding-top: 1.2mm; }
.assina .quem { font-size: 7.6pt; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
.assina .dado { font-size: 7pt; color: var(--fraca); }
.assina .dado.alerta { color: #b91c1c; font-weight: 600; }

.rodape { margin-top: 1.6mm; display: flex; gap: 3mm; align-items: baseline; border-top: 1.2pt solid var(--forte); padding-top: 1.2mm; font-size: 6.6pt; color: var(--fraca); flex-wrap: wrap; }
.rodape .hash { font-family: Consolas, "Courier New", monospace; font-size: 6.2pt; word-break: break-all; }
.rodape .vias { margin-left: auto; text-align: right; white-space: nowrap; }

/* Selo biométrico acima da linha de assinatura. Altura fixa para as três colunas
   ficarem alinhadas mesmo quando só uma delas tem selo. */
.assina .selo { height: 9mm; display: flex; align-items: flex-end; justify-content: center; color: #0f172a; }
.assina .selo svg { height: 9mm; width: auto; }
.assina .selo .selo-txt { font-size: 7px; letter-spacing: .04em; font-weight: 700; fill: currentColor; font-family: Arial, Helvetica, sans-serif; }
.assina .selo-vazio { height: 9mm; }

/* Rascunho: a marca atravessa a folha e o documento não sai parecendo definitivo. */
.termo { position: relative; }
/* Centrada por left/top + translate, e não por flex: com inset:0 o bloco herdava a
   largura do container e a marca saía deslocada para a direita, transbordando a folha.
   Só dava para ver renderizando.
   (E este comentário não pode ter crase: o STYLE é template literal.) */
.marca-agua { position: absolute; left: 50%; top: 50%; pointer-events: none; z-index: 5; }
.marca-agua span { display: inline-block; transform: translate(-50%, -50%) rotate(-24deg);
  font-size: 46pt; font-weight: 800; letter-spacing: .08em;
  color: rgba(220, 38, 38, .13); border: 3pt solid rgba(220, 38, 38, .13); padding: 2mm 6mm; border-radius: 3mm;
  white-space: nowrap; }
.marca-agua.cancelado span { color: rgba(220, 38, 38, .18); border-color: rgba(220, 38, 38, .18); }

.aviso-rascunho { margin-top: 2mm; border: 1.2pt dashed #dc2626; border-radius: 1.5mm; padding: 1.6mm 2.2mm;
  font-size: 7.4pt; color: #991b1b; background: #fef2f2; }

.hist { margin-top: 2.4mm; border: .8pt solid var(--linha); border-radius: 1.5mm; overflow: hidden; }
.hist h3 { margin: 0; padding: 1.2mm 2mm; background: #f8fafc; border-bottom: .8pt solid var(--linha);
  font-size: 7.4pt; text-transform: uppercase; letter-spacing: .05em; }
.hist table { width: 100%; border-collapse: collapse; font-size: 6.8pt; }
.hist td { padding: .9mm 2mm; border-top: .5pt solid var(--linha); vertical-align: top; }
.hist td.q { white-space: nowrap; color: var(--fraca); width: 26mm; }
.hist td.a { white-space: nowrap; font-weight: 600; width: 20mm; }
`;

function Lado({ titulo, lado }: { titulo: string; lado: LadoTermo }) {
  return (
    <div className="lado">
      <h2>
        {titulo}
        <span className="mk">
          <span className={lado.tipo === "base" ? "cx on" : "cx"} />
          Base/Unidade
        </span>
        <span className="mk">
          <span className={lado.tipo === "colaborador" ? "cx on" : "cx"} />
          Colaborador
        </span>
      </h2>
      <div className="linha">
        <div className="campo">
          <span className="rot">Nome (pessoa ou base)</span>
          <div className="val">{ou(lado.nome)}</div>
        </div>
      </div>
      <div className="linha">
        <div className="campo">
          <span className="rot">Base / Unidade</span>
          <div className="val">{ou(lado.unidade)}</div>
        </div>
        <div className="campo">
          <span className="rot">Matrícula / CPF</span>
          <div className="val">{ou(lado.matricula_cpf)}</div>
        </div>
      </div>
      <div className="linha">
        <div className="campo">
          <span className="rot">Setor</span>
          <div className="val">{ou(lado.setor)}</div>
        </div>
        <div className="campo">
          <span className="rot">Telefone</span>
          <div className="val">{ou(lado.telefone)}</div>
        </div>
      </div>
      <div className="linha">
        <div className="campo">
          <span className="rot">E-mail</span>
          <div className="val">{ou(lado.email)}</div>
        </div>
      </div>
    </div>
  );
}

export default function TermoEquipamentoTemplate(p: TermoEquipamentoProps) {
  const linhas: (ItemTermo | null)[] = [...p.itens];
  while (linhas.length < MIN_LINHAS) linhas.push(null);

  // Retirada só é documento depois de emitida. Antes disso vale como conferência.
  // `emitido !== false` para não transformar transferência/devolução, que não têm o
  // campo, em rascunho por omissão.
  const ehRascunho = p.emitido === false;
  const cancelado = p.cancelado ?? null;
  const historico = p.historico ?? [];

  return (
    <div className="termo">
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />

      {cancelado ? (
        <div className="marca-agua cancelado">
          <span>CANCELADO</span>
        </div>
      ) : ehRascunho ? (
        <div className="marca-agua">
          <span>RASCUNHO</span>
        </div>
      ) : null}

      <div className="cab">
        <div className="marca">
          <img src={LOGO_JCN_DATA_URI} alt="JCN Consultoria — Segurança e Medicina do Trabalho" />
        </div>
        <div className="titulo">
          <h1>TERMO DE TRANSFERÊNCIA DE EQUIPAMENTO</h1>
          <div className="sub">{SUBTITULO[p.tipo]}</div>
        </div>
        <div className="meta">
          <div className="cel">
            <span className="rot">Nº do termo</span>
            <div className="val">{p.numero}</div>
          </div>
          <div className="cel">
            <span className="rot">Data de emissão</span>
            <div className="val">{fmtData(p.emitidoEm)}</div>
          </div>
          <div className="cel">
            <span className="rot">Unidade emissora</span>
            <div className="val">{ou(p.unidadeEmissora)}</div>
          </div>
        </div>
      </div>

      <div className="bloco">
        <div className="barra">Partes</div>
        <div className="lados">
          <Lado titulo="1. Quem entrega (origem)" lado={p.origem} />
          <Lado titulo="2. Quem recebe (destino)" lado={p.destino} />
        </div>
      </div>

      <div className="bloco">
        <div className="barra">
          3. Bem(ns) transferido(s)
          <span className="dica">a etiqueta de patrimônio é do item, não da pessoa</span>
        </div>
        <table>
          <thead>
            <tr>
              <th className="c-idx">#</th>
              <th className="c-pat">Nº Patrimônio</th>
              <th>Equipamento / descrição</th>
              <th className="c-mod">Marca · Modelo · Config</th>
              <th className="c-ser">Nº de série</th>
              <th className="c-nf">Nota fiscal</th>
              <th className="c-qtd">Qtd</th>
              <th className="c-est">Estado</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((it, i) => (
              <tr key={i}>
                <td className="c-idx">{i + 1}</td>
                <td>{it ? ou(it.patrimonio) : ""}</td>
                <td>{it ? ou(it.descricao) : ""}</td>
                <td>{it ? ou(it.marca_modelo) : ""}</td>
                <td>{it ? ou(it.serie) : ""}</td>
                <td>{it ? ou(it.nota_fiscal) : ""}</td>
                <td className="c-qtd">{it ? (it.quantidade ?? 1) : ""}</td>
                <td>{it ? ou(it.estado) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="linha">
          <div className="campo">
            <span className="rot">Acessórios que acompanham o(s) bem(ns)</span>
            <div className="val">{ou(p.acessorios)}</div>
          </div>
          <div className="campo">
            <span className="rot">Avarias / ressalvas registradas no ato</span>
            <div className="val">{ou(p.observacoesEstado)}</div>
          </div>
        </div>
      </div>

      <div className="bloco">
        <div className="barra">
          4. Motivo da movimentação
          <span className="dica">o mesmo motivo alimenta o histórico de status do equipamento</span>
        </div>
        <div className="linha">
          <div className="campo">
            <div className="val">{ou(p.motivo)}</div>
          </div>
        </div>
      </div>

      <div className="bloco">
        <div className="barra">5. Termo de responsabilidade</div>
        <div className="declara">
          <p>
            Declaro ter recebido, nesta data, o(s) bem(ns) descrito(s) no quadro 3, de propriedade
            da <b>JCN Consultoria</b>, em perfeito estado de conservação e funcionamento e com os acessórios
            necessários ao uso — ressalvado o que estiver anotado no campo de avarias — e assumo as
            obrigações abaixo:
          </p>
          <ol>
            <li>
              <b>Uso profissional.</b> O bem é patrimônio da empresa, cedido exclusivamente como
              ferramenta de trabalho. Não constitui salário nem vantagem de qualquer natureza
              (CLT, art. 458, §2º, I).
            </li>
            <li>
              <b>Guarda e conservação.</b> Zelo pela guarda e conservação do bem, observo as
              instruções do fabricante e as normas internas de uso.
            </li>
            <li>
              <b>Intransferibilidade.</b> Não empresto, cedo nem repasso o bem a terceiros —
              inclusive a outro colaborador — sem um novo termo registrado no inventário.
            </li>
            <li>
              <b>Comunicação de ocorrência.</b> Comunico imediatamente à TI/Patrimônio qualquer
              defeito, extravio, furto, roubo ou dano, apresentando Boletim de Ocorrência nos casos
              de furto ou roubo.
            </li>
            <li>
              <b>Software e dados.</b> Instalação de software e alteração de configuração seguem a
              política de TI. Os dados armazenados no equipamento pertencem à empresa e podem ser
              auditados; dados pessoais de terceiros seguem a LGPD (Lei 13.709/2018).
            </li>
            <li>
              <b>Devolução.</b> Devolvo o bem nas mesmas condições recebidas — ressalvado o desgaste
              natural de uso — quando solicitado pela empresa, na mudança de função ou de base, e no
              encerramento do contrato de trabalho, sempre mediante novo termo.
            </li>
            <li>
              <b>Dano por dolo ou culpa.</b> Estou ciente de que dano ou extravio decorrente de dolo,
              ou de culpa comprovada em apuração, poderá ser ressarcido à empresa nos termos do
              art. 462, §1º, da CLT. Desgaste natural de uso não gera ressarcimento.
            </li>
          </ol>
          <div className="nota">
            <b>Quem entrega declara</b> ter repassado o(s) bem(ns) nas condições descritas e dado
            baixa da posse no inventário. &nbsp;•&nbsp; Este termo admite{" "}
            <b>assinatura eletrônica</b> (Lei 14.063/2020 e MP 2.200-2/2001): a validade decorre do
            registro de aceite e do <b>hash SHA-256</b> impresso no rodapé, não do desenho da
            assinatura.
          </div>
        </div>

        <div className="localdata">
          <div className="li">
            <span className="rot">Local</span>
            <div className="val">{ou(p.local)}</div>
          </div>
          <div className="di">
            <span className="rot">Data</span>
            <div className="val">{fmtData(p.dataAto)}</div>
          </div>
        </div>

        {/* Quando a mesma pessoa entrega e valida, o termo DIZ. A entrega de equipamento
            é feita pela equipe de TI, que é a mesma que valida — esconder isso deixaria o
            documento parecendo ter três participantes quando tem dois, e quem lê daqui a
            dois anos precisa saber o que a assinatura prova e o que não prova. */}
        {(() => {
          const env = (p.assinaturas ?? []).find((a) => a.papel === "envia");
          const val = (p.assinaturas ?? []).find((a) => a.papel === "valida");
          const mesma =
            env?.id_colaborador && val?.id_colaborador && env.id_colaborador === val.id_colaborador;
          return mesma ? (
            <div className="nota">
              <b>Entrega e validação pela mesma pessoa</b> ({ou(env?.nome)}), conforme o
              procedimento interno: a movimentação de equipamento é executada pela equipe de TI,
              que responde pelas unidades. Cada papel exigiu <b>leitura biométrica própria</b> —
              a mesma captura não assina dois papéis.
            </div>
          ) : null;
        })()}

        {ehRascunho ? (
          <div className="aviso-rascunho">
            <b>Este termo ainda não foi emitido.</b> Serve para conferência antes da
            emissão — os campos de assinatura só aparecem no termo emitido, porque
            assinatura se prende a uma versão fechada do documento. Confira os itens,
            acrescente o que faltar e então emita.
          </div>
        ) : null}

        {ehRascunho ? null : (
        <div className="assinaturas">
          {(
            [
              { papel: "envia" as const, titulo: "Quem entrega", padrao: p.origem.nome, sufixo: "" },
              {
                papel: "recebe" as const,
                titulo: "Quem recebe",
                padrao: p.destino.nome,
                sufixo: p.destino.matricula_cpf ? ` · ${p.destino.matricula_cpf}` : "",
              },
              {
                papel: "valida" as const,
                titulo: "Quem valida",
                padrao: p.conferente,
                sufixo: " — registro no inventário",
              },
            ]
          ).map(({ papel, titulo, padrao, sufixo }) => {
            const a = (p.assinaturas ?? []).find((x) => x.papel === papel) ?? null;
            // O selo obedece à MESMA condição da linha "digital verificada": dedo
            // conferido E conteúdo ainda batendo. Num termo alterado depois de assinado,
            // ou numa assinatura por desenho, ele não sai.
            // FALHA FECHADO: exige `=== true`, não "diferente de false". Se o hash não
            // pôde ser recalculado (RPC fora, cache de schema velho nos primeiros minutos
            // do deploy), `conteudo_confere` vem `null` — e um selo impresso nessa hora
            // afirmaria o que ninguém verificou. Sem confirmação, sem selo.
            const selo = a?.finger_verificado === true && a.conteudo_confere === true;
            return (
              <div className="assina" key={papel}>
                {selo ? <SeloBiometrico /> : <div className="selo-vazio" />}
                <div className="traco">
                  {a?.assinatura_png ? <img src={a.assinatura_png} alt="" /> : null}
                </div>
                <div className="rasp">
                  <div className="quem">{titulo}</div>
                  <div className="dado">
                    {ou(a?.nome ?? padrao)}
                    {sufixo}
                  </div>
                  {/* Afirmar "digital verificada" num documento trabalhista exige as
                      DUAS coisas: o dedo conferiu, e o que está impresso é o que foi
                      assinado. Se a retirada mudou depois, o termo diz isso — em vez de
                      continuar afirmando validade sobre conteúdo que ninguém assinou. */}
                  {a?.finger_verificado && a.conteudo_confere === true ? (
                    <div className="dado">
                      digital verificada
                      {a.match_score != null ? ` · score ${a.match_score.toFixed(1)}` : ""}
                      {a.codigo ? ` · ${a.codigo}` : ""}
                    </div>
                  ) : a?.finger_verificado && a.conteudo_confere === null ? (
                    // Três estados, não dois: "confere", "não confere" e "não deu para
                    // conferir". Imprimir o terceiro como se fosse o primeiro é o tipo de
                    // atalho que transforma o documento em afirmação sem lastro.
                    <div className="dado">
                      digital conferida — conteúdo não confirmado nesta emissão
                      {a.codigo ? ` · ${a.codigo}` : ""}
                    </div>
                  ) : a?.finger_verificado ? (
                    <div className="dado alerta">
                      ⚠ digital conferida em {a.assinado_em ? new Date(a.assinado_em).toLocaleDateString("pt-BR") : "data anterior"},
                      mas esta retirada foi ALTERADA depois da assinatura
                      {a.codigo ? ` · ${a.codigo}` : ""}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        )}

        {cancelado ? (
          <div className="aviso-rascunho">
            <b>Termo cancelado</b>
            {cancelado.em ? ` em ${new Date(cancelado.em).toLocaleDateString("pt-BR")}` : ""}
            {cancelado.por ? ` por ${cancelado.por}` : ""}.
            {cancelado.motivo ? ` Motivo: ${cancelado.motivo}` : ""}
            {" "}As assinaturas acima continuam registradas — o cancelamento não as apaga,
            declara que este termo não vale mais.
          </div>
        ) : null}

        {/* Só sai quando existe alteração. Documento limpo continua limpo — seção vazia
            de "histórico" ensina o leitor a ignorá-la, e aí ela não serve quando importa. */}
        {historico.length > 0 ? (
          <div className="hist">
            <h3>Histórico de alterações</h3>
            <table>
              <tbody>
                {historico.map((h, i) => (
                  <tr key={i}>
                    <td className="q">
                      {h.criado_em
                        ? new Date(h.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
                        : "—"}
                    </td>
                    <td className="a">{ROTULO_ACAO[h.acao] ?? h.acao}</td>
                    <td>
                      {h.campo ? <b>{h.campo}: </b> : null}
                      {h.valor_antes ? <>{h.valor_antes} → </> : null}
                      {h.valor_depois ?? (h.valor_antes ? "(removido)" : "")}
                      {h.motivo ? <> · <i>{h.motivo}</i></> : null}
                      {h.usuario_email ? <> · {h.usuario_email}</> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="rodape">
        <div>
          <b>JCN Consultoria Segurança e Medicina do Trabalho</b> &middot; TI / Patrimônio &middot; Termo nº{" "}
          {p.numero}
        </div>
        {p.assinatura?.codigo ? (
          <div className="hash">Cód. verificação: {p.assinatura.codigo}</div>
        ) : null}
        {p.sha256 ? <div className="hash">SHA-256: {p.sha256}</div> : null}
        <div className="vias">Via 1 — TI / Patrimônio &nbsp;·&nbsp; Via 2 — Quem recebe</div>
      </div>
    </div>
  );
}

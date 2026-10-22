// Consolidação Psicossocial de Grupo — apresentação ao cliente (.pptx, fase 8).
//
// Mesmo roteiro do relatório em PDF, no padrão visual do painel (vindo do Painel SST,
// adaptado à marca JCN): 16:9, faixa diagonal azul no canto, folha lateral, logo no
// rodapé, Open Sans em azul-escuro #0C4A6E. Os dois fundos (capa/seção e tabela)
// são imagens em public/apresentacao/ — o texto e as tabelas
// vão por cima. As tabelas Sim/Não vão paginadas (até 12 linhas por slide).
//
// Montada no navegador com o resultado do motor (o mesmo da tela ou o da versão
// registrada). `pptxgenjs` é carregado só no clique.

import type { NivelPresente, ResultadoMotor } from "./motor";
import type { GlossarioItem } from "./consolidacao-grupo";

export interface DadosApresentacao {
  grupo: string;
  r: ResultadoMotor;
  nomeEmpresa: (id: string) => string;
  nomeFator: (id: string) => string;
  nomeCurto: (id: string) => string;
  glossario: GlossarioItem[];
  /** Versão registrada (fase 7), quando a apresentação sai de um registro. */
  registro?: { id: string; em: string };
  /** Fundos em data URL (o chamador carrega de public/apresentacao/). */
  fundos: { capa: string; tabela: string };
  geradoEm: string;
}

const VERDE = "0C4A6E";
const FONTE = "Open Sans";
const LINHAS_POR_SLIDE = 12;
const COR_NIVEL: Record<NivelPresente, [string, string]> = {
  Crítico: ["DC2626", "FFFFFF"],
  Alto: ["F97316", "FFFFFF"],
  Médio: ["FCD34D", "451A03"],
  Identificado: ["E0E7FF", "3730A3"],
};

// Tipos mínimos do pptxgenjs que usamos (o pacote traz os dele, mas o import é dinâmico).
type Celula = { text: string; options?: Record<string, unknown> };
type Slide = {
  addText: (t: string | Array<{ text: string; options?: Record<string, unknown> }>, o: Record<string, unknown>) => void;
  addTable: (linhas: Celula[][], o: Record<string, unknown>) => void;
};

function paginas<T>(lista: T[], n = LINHAS_POR_SLIDE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < lista.length; i += n) out.push(lista.slice(i, i + n));
  return out.length ? out : [[]];
}

/**
 * Monta a apresentação. Para gravar, use os métodos do próprio pptxgenjs COM compressão:
 * `writeFile({ fileName, compression: true })` no navegador (baixa o arquivo) ou
 * `stream({ compression: true })` no Node. NÃO use `write({ outputType, compression })`:
 * no 3.12 ele ignora a compressão (5,4 MB em vez de ~0,3 MB no caso de origem).
 */
export async function montarApresentacao(d: DadosApresentacao) {
  const { default: Pptx } = await import("pptxgenjs");
  const pptx = new Pptx();
  pptx.layout = "LAYOUT_16x9"; // 10 × 5,625 pol.
  pptx.author = "JCN Consultoria";
  pptx.title = `Consolidação Psicossocial — ${d.grupo}`;
  pptx.defineSlideMaster({ title: "CAPA", background: { data: d.fundos.capa } });
  pptx.defineSlideMaster({ title: "TABELA", background: { data: d.fundos.tabela } });

  const { r } = d;
  const fatores = r.fatores;
  const nova = (m: "CAPA" | "TABELA") => pptx.addSlide({ masterName: m }) as unknown as Slide;

  const titulo = (s: Slide, t: string, sub?: string) => {
    s.addText(t, { x: 0.4, y: 0.2, w: 7.6, h: 0.5, fontFace: FONTE, fontSize: t.length > 40 ? 15 : 20, bold: true, color: VERDE, fit: "shrink" });
    if (sub) s.addText(sub, { x: 0.4, y: 0.66, w: 7.6, h: 0.3, fontFace: FONTE, fontSize: 10, color: "4B5563", italic: true });
  };
  const secao = (t: string) =>
    nova("CAPA").addText(t, { x: 1.38, y: 2.2, w: 6.2, h: 1.0, fontFace: FONTE, fontSize: 30, italic: true, bold: true, color: VERDE });
  const conteudo = (paragrafos: string[], tituloSlide?: string) => {
    const s = nova("TABELA");
    if (tituloSlide) titulo(s, tituloSlide);
    s.addText(
      paragrafos.map((p, i) => ({ text: p, options: { breakLine: i < paragrafos.length - 1, paraSpaceAfter: 8 } })),
      { x: 0.6, y: tituloSlide ? 1.05 : 0.7, w: 8.2, h: 3.8, fontFace: FONTE, fontSize: 13, color: VERDE, valign: "top" },
    );
  };

  const cab = (t: string, o: Record<string, unknown> = {}): Celula => ({
    text: t,
    options: { bold: true, color: "FFFFFF", fill: { color: "0284C7" }, align: "center", valign: "middle", ...o },
  });
  // Palavra longa ("relacionamentos") quebraria no meio da coluna estreita: fonte menor.
  const cabFator = (t: string) =>
    cab(t, { fontSize: Math.max(...t.split(" ").map((w) => w.length)) >= 13 ? 5 : 6, margin: 0.01 });
  const simNao = (sim: boolean): Celula =>
    sim
      ? { text: "Sim", options: { bold: true, color: "991B1B", fill: { color: "FEE2E2" }, align: "center", valign: "middle" } }
      : { text: "Não", options: { color: "B0B0B0", align: "center", valign: "middle" } };
  const tabelaSimNao = (s: Slide, rot: string, linhas: Array<{ nome: string; fatores: Record<string, boolean> }>) => {
    const w1 = 1.55;
    const wf = (8.85 - w1) / fatores.length;
    s.addTable(
      [
        [cab(rot, { align: "left" }), ...fatores.map((f) => cabFator(d.nomeCurto(f.id_fator)))],
        ...linhas.map((l) => [
          { text: l.nome, options: { bold: true, color: VERDE, valign: "middle" } },
          ...fatores.map((f) => simNao(!!l.fatores[f.id_fator])),
        ]),
      ],
      {
        x: 0.35, y: 1.05, w: 8.85, colW: [w1, ...fatores.map(() => wf)],
        fontFace: FONTE, fontSize: 7, rowH: 0.27, margin: 0.03,
        border: { type: "solid", pt: 0.5, color: "D1D5DB" },
      },
    );
  };

  // 1. Capa
  const capa = nova("CAPA");
  capa.addText("Consolidação dos Riscos Psicossociais", {
    x: 1.26, y: 1.25, w: 6.0, h: 1.0, fontFace: FONTE, fontSize: 30, bold: true, color: VERDE,
  });
  capa.addText(d.grupo, { x: 1.26, y: 2.3, w: 6.0, h: 0.5, fontFace: FONTE, fontSize: 18, color: VERDE });
  capa.addText(d.registro ? `Versão registrada ${d.registro.id} — ${d.registro.em}` : `Gerado em ${d.geradoEm}`, {
    x: 1.26, y: 2.8, w: 6.0, h: 0.35, fontFace: FONTE, fontSize: 11, italic: true, color: "4B5563",
  });

  // 2. Para que serve + responsabilidades
  secao("Para que serve?");
  conteudo([
    "As empresas do grupo compartilham trabalhadores: quem atua num setor de uma empresa também atua no mesmo setor das outras.",
    "Por isso, o risco psicossocial identificado num setor de qualquer empresa do grupo passa a constar nesse mesmo setor em todas as empresas que o têm.",
    "Esta consolidação junta as AEP e os DRPS/Questionários concluídos, padroniza os setores e define, setor por setor, os fatores que devem constar no PGR de cada empresa.",
  ]);
  conteudo(
    [
      "JCN Consultoria: define os riscos de cada setor e atualiza o inventário do PGR de cada empresa.",
      "Cliente: valida a lista por setor.",
      "Médico responsável pelo PCMSO: recebe o inventário atualizado e define, dentro da sua responsabilidade técnica, como os riscos entram no PCMSO e nos ASOs.",
    ],
    "Responsabilidades",
  );

  // 3. Critério
  secao("Como o resultado vira risco no PGR?");
  conteudo(
    [
      "Crítico ou Alto no questionário: entra no PGR com prioridade máxima.",
      "Médio: entra com medidas preventivas e reavaliação em ciclo mais curto.",
      "Baixo: não entra; fica em monitoramento.",
      "Fator marcado na AEP da obra: entra como \"Identificado\".",
      "Setor presente em 2 ou mais empresas: o fator encontrado em qualquer uma delas vale para todas, no maior nível. Setor de uma empresa só (¹) mantém a própria avaliação.",
    ],
    "Critério de conversão",
  );

  // 4. Sim/Não setor × fator
  secao("Quais fatores constam em cada setor?");
  const setores = r.simNaoSetor.map((s) => ({ nome: s.setor + (s.unicaEmpresa ? " ¹" : ""), fatores: s.fatores }));
  const ps = paginas(setores);
  ps.forEach((pg, i) => {
    const s = nova("TABELA");
    titulo(s, "Fatores por setor", `"Sim" = consta no PGR das empresas que têm o setor · ¹ setor de uma empresa só${ps.length > 1 ? ` · ${i + 1}/${ps.length}` : ""}`);
    tabelaSimNao(s, "Setor", pg);
  });

  // 5. Por empresa: Sim/Não e o que fazer
  secao("O que cada empresa precisa fazer?");
  const empresas = [...new Set(r.simNaoEmpresa.map((l) => l.idEmpresa))];
  for (const e of empresas) {
    const linhas = r.simNaoEmpresa
      .filter((l) => l.idEmpresa === e)
      .map((l) => ({ nome: l.setor + (l.unicaEmpresa ? " ¹" : ""), fatores: l.fatores }));
    const ajustes = r.lacunas.filter((l) => l.idEmpresa === e && l.acao !== "OK");
    const inc = ajustes.filter((l) => l.acao === "Incluir").length;
    const rev = ajustes.length - inc;
    const pe = paginas(linhas);
    pe.forEach((pg, i) => {
      const s = nova("TABELA");
      titulo(
        s,
        d.nomeEmpresa(e),
        `Fatores que devem constar no PGR · ${inc} a incluir, ${rev} a revisar${pe.length > 1 ? ` · ${i + 1}/${pe.length}` : ""}`,
      );
      tabelaSimNao(s, "Setor", pg);
    });
    if (ajustes.length) {
      const ordem = new Map(fatores.map((f) => [f.id_fator, f.ordem]));
      ajustes.sort((a, b) => a.setor.localeCompare(b.setor, "pt-BR") || (ordem.get(a.idFator) ?? 0) - (ordem.get(b.idFator) ?? 0));
      const pa = paginas(ajustes);
      pa.forEach((pg, i) => {
        const s = nova("TABELA");
        titulo(s, `${d.nomeEmpresa(e)} — ajustes`, `Incluir = ausente na empresa · Revisar = nível abaixo do perfil${pa.length > 1 ? ` · ${i + 1}/${pa.length}` : ""}`);
        const nivel = (n: NivelPresente | null): Celula =>
          n
            ? { text: n, options: { bold: true, align: "center", valign: "middle", color: COR_NIVEL[n][1], fill: { color: COR_NIVEL[n][0] } } }
            : { text: "ausente", options: { color: "9CA3AF", align: "center", valign: "middle", italic: true } };
        s.addTable(
          [
            [cab("Setor", { align: "left" }), cab("Fator", { align: "left" }), cab("Ação"), cab("Na empresa"), cab("Perfil")],
            ...pg.map((l) => [
              { text: l.setor, options: { color: VERDE, valign: "middle" } },
              { text: d.nomeFator(l.idFator), options: { color: VERDE, valign: "middle" } },
              { text: l.acao, options: { bold: true, align: "center", valign: "middle", color: l.acao === "Incluir" ? "991B1B" : "92400E" } },
              nivel(l.situacao),
              nivel(l.perfil),
            ]),
          ],
          {
            x: 0.35, y: 1.05, w: 8.85, colW: [2.0, 3.65, 1.0, 1.1, 1.1],
            fontFace: FONTE, fontSize: 8, rowH: 0.27, margin: 0.04,
            border: { type: "solid", pt: 0.5, color: "D1D5DB" },
          },
        );
      });
    }
  }

  // 6. Glossário
  const pg = paginas(d.glossario, 10);
  pg.forEach((g, i) => {
    const s = nova("TABELA");
    titulo(s, "Glossário de siglas", pg.length > 1 ? `${i + 1}/${pg.length}` : undefined);
    s.addTable(
      [
        [cab("Sigla", { align: "left" }), cab("Significado", { align: "left" }), cab("O que é", { align: "left" })],
        ...g.map((x) => [
          { text: x.sigla, options: { bold: true, color: VERDE } },
          { text: x.significado, options: { color: VERDE } },
          { text: x.explicacao ?? "", options: { color: "374151" } },
        ]),
      ],
      {
        x: 0.35, y: 1.05, w: 8.85, colW: [0.9, 3.0, 4.95], fontFace: FONTE, fontSize: 8, margin: 0.04,
        border: { type: "solid", pt: 0.5, color: "D1D5DB" },
      },
    );
  });

  // 7. Encerramento
  nova("CAPA").addText("Obrigado", { x: 1.38, y: 2.0, w: 6.2, h: 1.2, fontFace: FONTE, fontSize: 44, bold: true, color: VERDE });

  return pptx;
}

/** Fundos de public/apresentacao/ em data URL (no navegador). */
export async function carregarFundos(): Promise<DadosApresentacao["fundos"]> {
  const ler = async (n: string) => {
    const b = await (await fetch(`/apresentacao/${n}`)).blob();
    return await new Promise<string>((ok, ko) => {
      const fr = new FileReader();
      fr.onload = () => ok(String(fr.result));
      fr.onerror = ko;
      fr.readAsDataURL(b);
    });
  };
  const [capa, tabela] = await Promise.all([ler("fundo-capa.jpg"), ler("fundo-tabela.jpg")]);
  return { capa, tabela };
}

import React from "react";
import FolhaAssinaturas, { type Signatario } from "@/components/pdf/FolhaAssinaturas";
import { SecaoIdentificacaoEmpresa } from "@/components/pdf/SecoesComuns";
import BodyMapStatic from "@/components/investigacao/BodyMapStatic";
import { ISHIKAWA_CATS } from "@/lib/investigacao/ishikawa";
import type { Empresa, InvestigacaoAcidente, InvestigacaoAcao } from "@/lib/supabase/types";

export interface InvestigacaoTemplateProps {
  inv: InvestigacaoAcidente;
  empresa?: Partial<Empresa> | null;
  signatarios: Signatario[];
  folhaEmpresa: { razaoSocial: string; cnpj: string } | null;
  dataHoraAssinatura: string;
  identificadorDocumento: string;
  /** Ações 5W2H do plano de ação (tabela investigacao_acoes). */
  acoes?: InvestigacaoAcao[];
  /** URLs absolutas ou data URIs das silhuetas (para o Puppeteer). */
  silhuetaFrente?: string;
  silhuetaCostas?: string;
}

const VERDE = "#0ea5e9";

const STYLE_BLOCK = `
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; color: #111827; }
.ia-titulo { text-align: center; margin: 0 0 4px; }
.ia-titulo h1 { font-size: 16pt; font-weight: 700; color: ${VERDE}; margin: 0; text-transform: uppercase; letter-spacing: .03em; }
.ia-titulo p { font-size: 10pt; color: #6b7280; margin: 2px 0 0; }
.ia-sec { font-size: 13pt; font-weight: 700; color: ${VERDE}; border-bottom: 2px solid ${VERDE}; padding-bottom: 4px; margin: 18px 0 10px; text-transform: uppercase; letter-spacing: .03em; }
.ia-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
.ia-campo .rot { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; margin: 0; }
.ia-campo .val { font-size: 11pt; color: #111827; margin: 1px 0 0; white-space: pre-wrap; }
.ia-full { grid-column: 1 / -1; }
.ia-bloco { margin-bottom: 8px; }
.ia-test { border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; page-break-inside: avoid; }
.ia-test .nome { font-weight: 700; font-size: 11pt; color: #111827; }
.ia-test .dep { font-size: 10pt; color: #374151; white-space: pre-wrap; margin-top: 2px; }
.ia-pq { margin: 4px 0; padding-left: 0; list-style: none; }
.ia-pq li { font-size: 11pt; color: #111827; padding: 3px 0; border-bottom: 1px dotted #d1d5db; }
.ia-pq b { color: ${VERDE}; }
section { page-break-inside: avoid; }
`;

const TIPO_LABEL: Record<string, string> = {
  TIPICO: "Típico",
  TRAJETO: "Trajeto",
  DOENCA: "Doença ocupacional",
};
const GRAV_LABEL: Record<string, string> = {
  LEVE: "Leve",
  GRAVE: "Grave",
  FATAL: "Fatal",
};
const VINCULO_LABEL: Record<string, string> = {
  equipe: "Equipe",
  chefia_direta: "Chefia direta",
  chefia_indireta: "Chefia indireta",
  comando: "Comando / organograma",
};
const TD_PESSOA = { borderBottom: "1px solid #f0f0f0", padding: "3px 6px", color: "#111827" } as const;
const FATOR_LABEL: Record<string, string> = {
  metas: "Metas / premiação",
  layout: "Layout / arranjo físico do posto",
  materiais: "Natureza dos materiais",
  instalacoes: "Uso das instalações / equipamentos",
  eps: "Suficiência dos equipamentos de segurança (EPI/EPC)",
  externas: "Condições externas",
  organizacao: "Organização do trabalho",
  manutencao: "Manutenção / limpeza / iluminação / piso",
  agentes: "Agentes de risco conhecidos e não controlados",
};
const FATOR_RESP: Record<string, string> = { sim: "Sim", nao: "Não", parcial: "Parcial", na: "N/A" };
const PRIO_COR: Record<string, { bg: string; fg: string }> = {
  Critica: { bg: "#fee2e2", fg: "#b91c1c" },
  Alta: { bg: "#ffedd5", fg: "#c2410c" },
  Media: { bg: "#fef3c7", fg: "#b45309" },
  Baixa: { bg: "#d1fae5", fg: "#047857" },
};
const STATUS_COR: Record<string, { bg: string; fg: string; bd: string }> = {
  Pendente: { bg: "#fef3c7", fg: "#b45309", bd: "#fde68a" },
  "Em Andamento": { bg: "#dbeafe", fg: "#1d4ed8", bd: "#bfdbfe" },
  Concluida: { bg: "#d1fae5", fg: "#047857", bd: "#a7f3d0" },
  Cancelada: { bg: "#f3f4f6", fg: "#6b7280", bd: "#e5e7eb" },
};

function PlanoAcaoSection({ acoes }: { acoes: InvestigacaoAcao[] }) {
  if (!acoes || acoes.length === 0) return null;
  const TH: React.CSSProperties = {
    borderBottom: `1.5px solid ${VERDE}`, borderRight: "1px solid #e5e7eb", padding: "4px 5px",
    textAlign: "left", color: VERDE, fontSize: 7.5, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: ".02em", background: "#f0fdf4",
  };
  const TD: React.CSSProperties = {
    borderBottom: "1px solid #eef0f2", borderRight: "1px solid #f3f4f6", padding: "4px 5px",
    color: "#111827", fontSize: 8, verticalAlign: "top", wordBreak: "break-word",
  };
  const cols = ["6%", "17%", "15%", "14%", "9%", "10%", "9%", "10%", "10%"];
  const heads = ["Prior.", "O quê", "Por quê", "Como", "Onde", "Quem", "Quando", "Quanto", "Status"];
  return (
    <section>
      <p className="ia-sec">Plano de ação (5W2H)</p>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", marginTop: 4 }}>
        <colgroup>{cols.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
        <thead>
          <tr>{heads.map((h) => <th key={h} style={TH}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {acoes.map((a) => {
            const cp = PRIO_COR[a.prioridade] ?? PRIO_COR.Media;
            const cs = STATUS_COR[a.status] ?? STATUS_COR.Pendente;
            const prazo = a.when_prazo ? new Date(a.when_prazo + "T00:00").toLocaleDateString("pt-BR") : "—";
            return (
              <tr key={a.id_acao} style={{ pageBreakInside: "avoid" }}>
                <td style={{ ...TD, color: cp.fg, fontWeight: 700 }}>{a.prioridade}</td>
                <td style={{ ...TD, fontWeight: 600 }}>{a.what_acao}</td>
                <td style={TD}>{a.why_justificativa || "—"}</td>
                <td style={TD}>{a.how_metodo || "—"}</td>
                <td style={TD}>{a.where_local || "—"}</td>
                <td style={TD}>{a.who_responsavel || "—"}</td>
                <td style={TD}>{prazo}</td>
                <td style={TD}>{a.how_much_custo || "—"}</td>
                <td style={{ ...TD, color: cs.fg, fontWeight: 700 }}>{a.status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = String(iso).slice(0, 10).split("-");
  return m.length === 3 ? `${m[2]}/${m[1]}/${m[0]}` : String(iso);
}

function Campo({ rot, val, full }: { rot: string; val: string | null | undefined; full?: boolean }) {
  return (
    <div className={`ia-campo${full ? " ia-full" : ""}`}>
      <p className="rot">{rot}</p>
      <p className="val">{val && String(val).trim() ? val : "—"}</p>
    </div>
  );
}

function Bloco({ rot, val }: { rot: string; val: string | null | undefined }) {
  if (!val || !val.trim()) return null;
  return (
    <div className="ia-bloco">
      <p className="rot" style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "#6b7280", margin: "0 0 2px" }}>
        {rot}
      </p>
      <p className="val" style={{ fontSize: "11pt", color: "#111827", whiteSpace: "pre-wrap", margin: 0 }}>{val}</p>
    </div>
  );
}

function IshikawaPdf({ ishikawa }: { ishikawa: Record<string, string[]> }) {
  const temAlgo = ISHIKAWA_CATS.some((c) => (ishikawa?.[c] ?? []).length > 0);
  if (!temAlgo) return null;
  const top = ISHIKAWA_CATS.slice(0, 3);
  const bot = ISHIKAWA_CATS.slice(3);
  const Box = ({ cat }: { cat: string }) => (
    <div style={{ flex: 1, minWidth: 0, border: "1px solid #d1d5db", borderRadius: 6, padding: "5px 8px" }}>
      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", color: VERDE }}>{cat}</p>
      <ul style={{ margin: "2px 0 0", paddingLeft: 13 }}>
        {(ishikawa?.[cat] ?? []).map((c, i) => (
          <li key={i} style={{ fontSize: "9.5pt", color: "#374151" }}>{c}</li>
        ))}
      </ul>
    </div>
  );
  return (
    <div style={{ marginTop: 6, pageBreakInside: "avoid" }}>
      <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "#6b7280", margin: "0 0 4px" }}>
        Diagrama de Ishikawa (6M)
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>{top.map((c) => <Box key={c} cat={c} />)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "5px 0" }}>
        <div style={{ flex: 1, height: 3, background: VERDE, borderRadius: 2 }} />
        <div style={{ background: VERDE, color: "#fff", padding: "4px 12px", borderRadius: 6, fontWeight: 700, fontSize: 10, whiteSpace: "nowrap" }}>ACIDENTE</div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>{bot.map((c) => <Box key={c} cat={c} />)}</div>
    </div>
  );
}

export default function InvestigacaoAcidenteTemplate({
  inv,
  empresa,
  signatarios,
  folhaEmpresa,
  dataHoraAssinatura,
  identificadorDocumento,
  acoes = [],
  silhuetaFrente,
  silhuetaCostas,
}: InvestigacaoTemplateProps) {
  const afast = inv.houve_afastamento
    ? `Sim${inv.dias_afastamento != null ? ` — ${inv.dias_afastamento} dia(s)` : ""}`
    : "Não";
  const porques = ((inv.cinco_porques ?? []) as unknown as (string | { pergunta?: string; resposta?: string })[])
    .map((p) => (typeof p === "string" ? { pergunta: "", resposta: p } : { pergunta: p?.pergunta ?? "", resposta: p?.resposta ?? "" }))
    .filter((p) => p.pergunta.trim() || p.resposta.trim());
  const testemunhas = (inv.testemunhas ?? []).filter((t) => (t.nome ?? "").trim() || (t.depoimento ?? "").trim());

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLE_BLOCK }} />

      <div className="ia-titulo">
        <h1>Investigação de Acidente de Trabalho</h1>
        <p>{empresa?.nome_empresa ?? ""}{inv.data_acidente ? ` · Acidente em ${fmt(inv.data_acidente)}` : ""}</p>
      </div>

      <SecaoIdentificacaoEmpresa empresa={empresa} />

      <section>
        <p className="ia-sec">1. Dados gerais</p>
        <div className="ia-grid">
          <Campo rot="Data do acidente" val={fmt(inv.data_acidente)} />
          <Campo rot="Hora" val={inv.hora_acidente} />
          <Campo rot="Local" val={inv.local_acidente} />
          <Campo rot="Setores" val={(inv.setores ?? []).join(", ")} />
          <Campo rot="Data da investigação" val={fmt(inv.data_investigacao)} />
          <Campo rot="Responsável técnico" val={inv.responsavel_tecnico} />
          <Campo rot="Nº da CAT" val={inv.numero_cat} />
          <Campo rot="Data da CAT" val={fmt(inv.data_cat)} />
        </div>
      </section>

      <section>
        <p className="ia-sec">2. Acidentado</p>
        <div className="ia-grid">
          <Campo rot="Nome" val={inv.acidentado_nome} />
          <Campo rot="Cargo / função" val={(inv.acidentado_funcoes ?? []).join(", ")} />
          <Campo rot="Admissão" val={fmt(inv.acidentado_admissao)} />
          {inv.acidentado_cpf && <Campo rot="CPF" val={inv.acidentado_cpf} />}
          {inv.acidentado_pis && <Campo rot="PIS" val={inv.acidentado_pis} />}
          {inv.acidentado_nascimento && <Campo rot="Nascimento" val={fmt(inv.acidentado_nascimento)} />}
          {inv.acidentado_estado_civil && <Campo rot="Estado civil" val={inv.acidentado_estado_civil} />}
          {inv.acidentado_escolaridade && <Campo rot="Escolaridade" val={inv.acidentado_escolaridade} />}
          {inv.acidentado_cbo && <Campo rot="CBO" val={inv.acidentado_cbo} />}
          {inv.acidentado_telefone && <Campo rot="Telefone" val={inv.acidentado_telefone} />}
          {inv.acidentado_endereco && <Campo rot="Endereço" val={inv.acidentado_endereco} full />}
          {inv.acidentado_tempo_funcao && <Campo rot="Tempo na função" val={inv.acidentado_tempo_funcao} />}
          {inv.acidentado_tempo_empresa && <Campo rot="Tempo na empresa" val={inv.acidentado_tempo_empresa} />}
          {inv.acidentado_jornada && <Campo rot="Jornada" val={inv.acidentado_jornada} />}
          {inv.acidentado_tempo_apos_inicio && <Campo rot="Tempo após início da jornada" val={inv.acidentado_tempo_apos_inicio} />}
          <Campo rot="Tipo de acidente" val={inv.tipo_acidente ? TIPO_LABEL[inv.tipo_acidente] : "—"} />
          <Campo rot="Gravidade" val={inv.gravidade ? GRAV_LABEL[inv.gravidade] : "—"} />
          <Campo rot="Houve afastamento" val={afast} />
        </div>
      </section>

      {(inv.qtd_acidentados != null || (inv.consequencias ?? []).length > 0 || (inv.fatores_morbi ?? []).length > 0) && (
        <section>
          <p className="ia-sec">Dados do acidente</p>
          <div className="ia-grid">
            {inv.qtd_acidentados != null && <Campo rot="Quantidade de acidentados" val={String(inv.qtd_acidentados)} />}
            {(inv.consequencias ?? []).length > 0 && <Campo rot="Consequência(s)" val={inv.consequencias.join(", ")} full />}
            {(inv.fatores_morbi ?? []).length > 0 && <Campo rot="Fator de morbi/mortalidade" val={inv.fatores_morbi.join(", ")} full />}
          </div>
        </section>
      )}

      <section>
        <p className="ia-sec">3. Descrição do acidente</p>
        <Bloco rot="Relato do ocorrido" val={inv.descricao} />
        <div className="ia-grid" style={{ marginTop: 8 }}>
          <Campo rot="Agente causador" val={inv.agente_causador} />
          <Campo rot="Natureza da lesão" val={inv.natureza_lesao} />
          <Campo rot="CID" val={inv.cid} />
        </div>
        {(inv.partes_corpo ?? []).length > 0 && (
          <div style={{ marginTop: 10, display: "flex", gap: 16, alignItems: "center" }}>
            {silhuetaFrente && silhuetaCostas && (
              <BodyMapStatic value={inv.partes_corpo} imgFrente={silhuetaFrente} imgCostas={silhuetaCostas} />
            )}
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "#6b7280", margin: "0 0 2px" }}>
                Partes do corpo atingidas
              </p>
              <p style={{ fontSize: "11pt", color: "#111827", margin: 0 }}>{inv.partes_corpo.join(" · ")}</p>
            </div>
          </div>
        )}
      </section>

      {testemunhas.length > 0 && (
        <section>
          <p className="ia-sec">4. Testemunhas</p>
          {testemunhas.map((t, i) => (
            <div key={i} className="ia-test">
              <div className="nome">{t.nome || "—"}</div>
              {t.depoimento && <div className="dep">{t.depoimento}</div>}
            </div>
          ))}
        </section>
      )}

      {(inv.pessoas_envolvidas ?? []).length > 0 && (
        <section>
          <p className="ia-sec">Pessoas envolvidas / organograma</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10pt", marginTop: 4 }}>
            <thead>
              <tr>
                {["Nome", "Função", "CPF", "Telefone", "E-mail", "Vínculo"].map((h) => (
                  <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #d1d5db", padding: "3px 6px", color: "#6b7280", fontSize: 8, textTransform: "uppercase", letterSpacing: ".04em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inv.pessoas_envolvidas.map((p, i) => (
                <tr key={i}>
                  <td style={TD_PESSOA}>{p.nome || "—"}</td>
                  <td style={TD_PESSOA}>{p.funcao || "—"}</td>
                  <td style={TD_PESSOA}>{p.cpf || "—"}</td>
                  <td style={TD_PESSOA}>{p.telefone || "—"}</td>
                  <td style={TD_PESSOA}>{p.email || "—"}</td>
                  <td style={TD_PESSOA}>{VINCULO_LABEL[p.vinculo] ?? p.vinculo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {inv.organizacao_trabalho && Object.values(inv.organizacao_trabalho).some((x) => x?.trim()) && (
        <section>
          <p className="ia-sec">Organização do trabalho da tarefa</p>
          <Bloco rot="Planejamento" val={inv.organizacao_trabalho.planejamento} />
          <Bloco rot="Orientação de execução" val={inv.organizacao_trabalho.orientacao} />
          <Bloco rot="Materiais, máquinas, ferramentas, EPI/EPC" val={inv.organizacao_trabalho.recursos} />
          <Bloco rot="Processos e controle de tempo" val={inv.organizacao_trabalho.processos} />
          <Bloco rot="Sinalização" val={inv.organizacao_trabalho.sinalizacao} />
          <Bloco rot="Hierarquia" val={inv.organizacao_trabalho.hierarquia} />
        </section>
      )}

      {inv.atividade_momento?.trim() && (
        <section>
          <p className="ia-sec">Atividade no momento do acidente</p>
          <Bloco rot="Atividade executada" val={inv.atividade_momento} />
        </section>
      )}

      {(inv.relatos_envolvidos ?? []).length > 0 && (
        <section>
          <p className="ia-sec">Descrição sob o ponto de vista dos envolvidos</p>
          {inv.relatos_envolvidos.map((r, i) => (
            <div key={i} className="ia-test">
              <div className="nome">{r.pessoa || "—"}</div>
              {r.relato && <div className="dep">{r.relato}</div>}
            </div>
          ))}
        </section>
      )}

      {(inv.videos ?? []).length > 0 && (
        <section>
          <p className="ia-sec">Vídeos do acidente</p>
          <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: "10pt", color: "#111827" }}>
            {inv.videos.map((v, i) => (
              <li key={i}>
                <a href={v.url} style={{ color: "#0d6b54" }}>{v.descricao?.trim() || v.url}</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <p className="ia-sec">5. Análise de causas</p>
        <Bloco rot="Causas imediatas (atos e condições inseguras)" val={inv.causas_imediatas} />
        <Bloco rot="Causas básicas (fatores pessoais e do trabalho)" val={inv.causas_basicas} />
        {porques.length > 0 && (
          <div className="ia-bloco">
            <p className="rot" style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "#6b7280", margin: "0 0 2px" }}>
              5 Porquês
            </p>
            <ul className="ia-pq">
              {porques.map((p, i) => (
                <li key={i}>
                  <b>{i + 1}º Por quê?{p.pergunta.trim() ? ` ${p.pergunta}` : ""}</b>
                  {p.resposta.trim() ? ` — ${p.resposta}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
        <IshikawaPdf ishikawa={inv.ishikawa} />
      </section>

      {inv.fatores_contribuintes && Object.values(inv.fatores_contribuintes).some((f) => f?.resposta) && (
        <section>
          <p className="ia-sec">Fatores contribuintes</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10pt", marginTop: 4 }}>
            <tbody>
              {Object.keys(FATOR_LABEL).map((k) => {
                const f = inv.fatores_contribuintes[k];
                if (!f?.resposta) return null;
                return (
                  <tr key={k}>
                    <td style={{ ...TD_PESSOA, width: "55%" }}>{FATOR_LABEL[k]}</td>
                    <td style={{ ...TD_PESSOA, fontWeight: 700, width: "12%" }}>{FATOR_RESP[f.resposta] ?? f.resposta}</td>
                    <td style={TD_PESSOA}>{f.obs || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {(inv.laudos_externos ?? []).length > 0 && (
        <section>
          <p className="ia-sec">Laudos externos</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10pt", marginTop: 4 }}>
            <thead>
              <tr>
                {["Tipo", "Número", "Data", "Observação"].map((h) => (
                  <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #d1d5db", padding: "3px 6px", color: "#6b7280", fontSize: 8, textTransform: "uppercase", letterSpacing: ".04em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inv.laudos_externos.map((l, i) => (
                <tr key={i}>
                  <td style={TD_PESSOA}>{l.tipo || "—"}{l.url ? <> · <a href={l.url} style={{ color: "#0d6b54" }}>link</a></> : null}</td>
                  <td style={TD_PESSOA}>{l.numero || "—"}</td>
                  <td style={TD_PESSOA}>{fmt(l.data)}</td>
                  <td style={TD_PESSOA}>{l.obs || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {(inv.analise_equipe?.trim() || (inv.consultores ?? []).length > 0 || (inv.analise_links ?? []).length > 0) && (
        <section>
          <p className="ia-sec">Análise da equipe técnica</p>
          <Bloco rot="Análise técnica do acidente" val={inv.analise_equipe} />
          {(inv.consultores ?? []).length > 0 && (
            <p style={{ fontSize: "10pt", color: "#111827", margin: "4px 0 0" }}>
              <b>Consultores:</b> {inv.consultores.map((c) => `${c.nome}${c.registro ? ` (${c.registro})` : ""}`).join("; ")}
            </p>
          )}
          {(inv.analise_links ?? []).length > 0 && (
            <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: "10pt", color: "#111827" }}>
              {inv.analise_links.map((v, i) => (
                <li key={i}><a href={v.url} style={{ color: "#0d6b54" }}>{v.descricao?.trim() || v.url}</a></li>
              ))}
            </ul>
          )}
        </section>
      )}

      {(inv.medidas?.trim() || inv.medidas_adotadas?.trim() || inv.conclusao?.trim()) && (
        <section>
          <p className="ia-sec">6. Medidas e conclusão</p>
          <Bloco rot="Medidas recomendadas (corretivas e preventivas)" val={inv.medidas} />
          <Bloco rot="Medidas adotadas após o acidente" val={inv.medidas_adotadas} />
          <Bloco rot="Conclusão / parecer técnico" val={inv.conclusao} />
        </section>
      )}

      <PlanoAcaoSection acoes={acoes} />

      {(inv.cronogramas ?? []).length > 0 && (
        <section>
          <p className="ia-sec">Cronograma das medidas adotadas</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10pt", marginTop: 4 }}>
            <thead>
              <tr>
                {["Tipo", "Descrição", "Prazo", "Responsável", "Status"].map((h) => (
                  <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #d1d5db", padding: "3px 6px", color: "#6b7280", fontSize: 8, textTransform: "uppercase", letterSpacing: ".04em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inv.cronogramas.map((c, i) => (
                <tr key={i}>
                  <td style={TD_PESSOA}>{c.tipo || "—"}</td>
                  <td style={TD_PESSOA}>{c.descricao || "—"}</td>
                  <td style={TD_PESSOA}>{c.prazo || "—"}</td>
                  <td style={TD_PESSOA}>{c.responsavel || "—"}</td>
                  <td style={TD_PESSOA}>{c.status || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {inv.responsavel_legal_nome?.trim() && (
        <section>
          <p className="ia-sec">Responsável legal</p>
          <p style={{ fontSize: "11pt", color: "#111827", margin: "2px 0 0" }}>
            {inv.responsavel_legal_nome}
            {inv.responsavel_legal_cargo ? ` — ${inv.responsavel_legal_cargo}` : ""}
            {inv.responsavel_legal_data ? ` · ${fmt(inv.responsavel_legal_data)}` : ""}
          </p>
        </section>
      )}

      <FolhaAssinaturas
        signatarios={signatarios}
        empresa={folhaEmpresa}
        dataHoraAssinatura={dataHoraAssinatura}
        identificadorDocumento={identificadorDocumento}
      />
    </>
  );
}

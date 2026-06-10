"use client";

import { use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import AssinaturaRelatorio from "@/components/ui/AssinaturaRelatorio";
import BotaoGerarPdf from "@/components/ui/BotaoGerarPdf";
import { useInspecao } from "@/lib/hooks/useInspecao";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import RelatorioPrintHeader from "@/components/layout/RelatorioPrintHeader";
import {
  formatCNPJ,
  formatCPF,
  formatCEI,
  formatCAEPF,
  formatCNO,
} from "@/lib/utils";

interface Props {
  params: Promise<{ id: string }>;
}

// Quantidade de linhas em branco extras (alem das ja cadastradas) para
// cada secao — o tecnico usa essas para registrar novas ocorrencias em campo.
const LINHAS_EXTRA = {
  setores: 6,
  cargos: 10,
  riscos: 14,
  epis: 12,
  treinamentos: 8,
  complementos: 6,
  responsaveis: 4,
  paeContatos: 4,
} as const;

function arrayEmpty(n: number): null[] {
  return Array.from({ length: n }, () => null);
}

export default function FichaInspecaoPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isLoading } = useInspecao(id);
  const { data: empresa } = useEmpresa(data?.inspecao?.id_empresa);

  const setorMap = useMemo(
    () => new Map((data?.setores ?? []).map((s) => [s.id_setor, s.setor_ghe])),
    [data]
  );
  const cargoMap = useMemo(
    () => new Map((data?.cargos ?? []).map((c) => [c.id_cargo, c.cargo])),
    [data]
  );

  if (isLoading) {
    return <LoadingSkeleton rows={6} />;
  }
  if (!data) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Inspeção não encontrada.
      </div>
    );
  }

  const {
    inspecao,
    setores,
    cargos,
    riscos,
    epis,
    treinamentos,
    complementos,
    responsaveis,
    paeContatos,
  } = data;

  const identificador = empresa?.cnpj
    ? `CNPJ ${formatCNPJ(empresa.cnpj)}`
    : empresa?.cpf
      ? `CPF ${formatCPF(empresa.cpf)}`
      : empresa?.cei
        ? `CEI ${formatCEI(empresa.cei)}`
        : empresa?.caepf
          ? `CAEPF ${formatCAEPF(empresa.caepf)}`
          : empresa?.cno
            ? `CNO ${formatCNO(empresa.cno)}`
            : "—";

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          @page { size: A4; margin: 1.4cm 1.2cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
          .ficha-print { padding: 0 !important; box-shadow: none !important; border: none !important; }
          .ficha-no-print { display: none !important; }
          .ficha-secao { break-inside: avoid-page; }
          .ficha-tabela tr { break-inside: avoid; }
        }
        .ficha-tabela {
          border-collapse: collapse;
          width: 100%;
          font-size: 10.5px;
        }
        .ficha-tabela th,
        .ficha-tabela td {
          border: 1px solid #94a3b8;
          padding: 5px 7px;
          vertical-align: top;
        }
        .ficha-tabela th {
          background: #f0f9f4;
          color: #1e4d28;
          font-weight: 700;
          text-align: left;
          font-size: 9.5px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .ficha-tabela td.preenchido {
          background: #fafafa;
          color: #374151;
        }
        .ficha-titulo {
          background: linear-gradient(180deg, #006B54 0%, #00563f 100%);
          color: white;
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 10px 12px;
          text-align: center;
          border-radius: 4px 4px 0 0;
        }
        .ficha-secao-titulo {
          background: #006B54;
          color: white;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          font-size: 11.5px;
          padding: 6px 10px;
          margin-top: 14px;
        }
        .ficha-secao-sub {
          font-size: 9.5px;
          color: #6b7280;
          font-style: italic;
          margin-top: 2px;
          margin-bottom: 4px;
        }
        .ficha-check-cell {
          text-align: center;
          width: 30px;
          font-size: 9px;
        }
        .ficha-linha-livre { height: 22px; }
        .ficha-linha-livre-grande { height: 32px; }
      `}</style>

      <div className="flex items-center justify-between ficha-no-print">
        <button
          type="button"
          onClick={() => router.push(`/inspecoes/${id}`)}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="size-4" /> Voltar à inspeção
        </button>
        <BotaoGerarPdf
          tabelaNome="inspecoes_ficha"
          docId={id}
          className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent"
        />
      </div>

      <div className="ficha-print rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <RelatorioPrintHeader
          titulo="Ficha de Inspeção SST · NR-01"
          subtitulo={empresa?.nome_empresa ?? null}
          terciario={
            inspecao.data_inspecao
              ? `Inspeção: ${new Date(
                  inspecao.data_inspecao + "T00:00:00"
                ).toLocaleDateString("pt-BR")}`
              : null
          }
        />
        <div className="ficha-titulo">
          Ficha de Inspeção SST · NR-01
        </div>

        {/* Cabeçalho */}
        <table className="ficha-tabela mt-0 ficha-secao">
          <tbody>
            <tr>
              <th style={{ width: "20%" }}>Empresa</th>
              <td className="preenchido" colSpan={3}>
                {empresa?.nome_empresa ?? "—"}
              </td>
            </tr>
            <tr>
              <th>Identificador</th>
              <td className="preenchido">{identificador}</td>
              <th style={{ width: "18%" }}>Inspeção · Revisão</th>
              <td className="preenchido">
                {inspecao.id_inspecao} · Rev. {inspecao.revisao}
              </td>
            </tr>
            <tr>
              <th>Data prevista</th>
              <td>
                {inspecao.data_inspecao
                  ? new Date(
                      inspecao.data_inspecao + "T00:00:00"
                    ).toLocaleDateString("pt-BR")
                  : "____/____/______"}
              </td>
              <th>Data realizada em campo</th>
              <td>____/____/______ ____:____</td>
            </tr>
            <tr>
              <th>Responsável (TST / Eng. Segurança)</th>
              <td className="preenchido">{inspecao.responsavel ?? ""}</td>
              <th>Assinatura</th>
              <td>&nbsp;</td>
            </tr>
          </tbody>
        </table>

        {/* SETORES */}
        <div className="ficha-secao">
          <div className="ficha-secao-titulo">1. Setores / GHE</div>
          <p className="ficha-secao-sub">
            Setores avaliados na inspeção. Use as linhas em branco para
            registrar novos setores identificados em campo.
          </p>
          <table className="ficha-tabela">
            <thead>
              <tr>
                <th style={{ width: "30%" }}>Setor / GHE</th>
                <th>Descrição / Atividades</th>
                <th style={{ width: "18%" }}>Conformidade</th>
                <th style={{ width: "18%" }}>Não Conformidade</th>
              </tr>
            </thead>
            <tbody>
              {setores.map((s) => (
                <tr key={s.id_setor}>
                  <td className="preenchido">{s.setor_ghe}</td>
                  <td className="preenchido">{s.descricao ?? ""}</td>
                  <td>{s.conformidade ?? ""}</td>
                  <td>{s.nao_conformidade ?? ""}</td>
                </tr>
              ))}
              {arrayEmpty(LINHAS_EXTRA.setores).map((_, i) => (
                <tr key={`empty-setor-${i}`}>
                  <td className="ficha-linha-livre">&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* CARGOS */}
        <div className="ficha-secao">
          <div className="ficha-secao-titulo">2. Cargos</div>
          <p className="ficha-secao-sub">
            Cargos por setor. Inclua quantidade de trabalhadores e
            observações em campo.
          </p>
          <table className="ficha-tabela">
            <thead>
              <tr>
                <th style={{ width: "25%" }}>Setor</th>
                <th style={{ width: "30%" }}>Cargo / Função</th>
                <th>Descrição / Observações de campo</th>
                <th style={{ width: "8%" }}>Qtd.</th>
              </tr>
            </thead>
            <tbody>
              {cargos.map((c) => (
                <tr key={c.id_cargo}>
                  <td className="preenchido">
                    {setorMap.get(c.id_setor) ?? "—"}
                  </td>
                  <td className="preenchido">{c.cargo}</td>
                  <td className="preenchido">{c.descricao ?? ""}</td>
                  <td>&nbsp;</td>
                </tr>
              ))}
              {arrayEmpty(LINHAS_EXTRA.cargos).map((_, i) => (
                <tr key={`empty-cargo-${i}`}>
                  <td className="ficha-linha-livre">&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* RISCOS */}
        <div className="ficha-secao">
          <div className="ficha-secao-titulo">3. Riscos Identificados</div>
          <p className="ficha-secao-sub">
            Tipo: Físico, Químico, Biológico, Ergonômico, Acidente,
            Psicossocial. Marque OK / NC / N/A para cada risco.
          </p>
          <table className="ficha-tabela">
            <thead>
              <tr>
                <th style={{ width: "13%" }}>Setor</th>
                <th style={{ width: "12%" }}>Cargo</th>
                <th style={{ width: "10%" }}>Tipo</th>
                <th>Agente / Fonte / Observações</th>
                <th style={{ width: "8%" }}>Sev.</th>
                <th style={{ width: "8%" }}>Prob.</th>
                <th className="ficha-check-cell">OK</th>
                <th className="ficha-check-cell">NC</th>
                <th className="ficha-check-cell">N/A</th>
              </tr>
            </thead>
            <tbody>
              {riscos.map((r) => (
                <tr key={r.id_risco}>
                  <td className="preenchido">
                    {r.id_setor ? setorMap.get(r.id_setor) ?? "—" : "—"}
                  </td>
                  <td className="preenchido">
                    {r.id_cargo ? cargoMap.get(r.id_cargo) ?? "—" : "—"}
                  </td>
                  <td className="preenchido">{r.tipo_risco}</td>
                  <td className="preenchido">
                    {[r.agente, r.fonte_geradora].filter(Boolean).join(" — ")}
                  </td>
                  <td className="preenchido">{r.severidade ?? ""}</td>
                  <td className="preenchido">{r.probabilidade ?? ""}</td>
                  <td className="ficha-check-cell">☐</td>
                  <td className="ficha-check-cell">☐</td>
                  <td className="ficha-check-cell">☐</td>
                </tr>
              ))}
              {arrayEmpty(LINHAS_EXTRA.riscos).map((_, i) => (
                <tr key={`empty-risco-${i}`}>
                  <td className="ficha-linha-livre">&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td className="ficha-check-cell">☐</td>
                  <td className="ficha-check-cell">☐</td>
                  <td className="ficha-check-cell">☐</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* EPIs / EPCs */}
        <div className="ficha-secao">
          <div className="ficha-secao-titulo">4. EPIs / EPCs</div>
          <p className="ficha-secao-sub">
            Equipamentos de proteção individual e coletiva por setor.
          </p>
          <table className="ficha-tabela">
            <thead>
              <tr>
                <th style={{ width: "15%" }}>Setor</th>
                <th style={{ width: "9%" }}>Tipo</th>
                <th>Descrição</th>
                <th style={{ width: "12%" }}>CA</th>
                <th style={{ width: "10%" }}>Recomendado</th>
                <th className="ficha-check-cell">Uso</th>
                <th className="ficha-check-cell">Falta</th>
              </tr>
            </thead>
            <tbody>
              {epis.map((e) => (
                <tr key={e.id_protecao}>
                  <td className="preenchido">
                    {e.id_setor ? setorMap.get(e.id_setor) ?? "—" : "—"}
                  </td>
                  <td className="preenchido">{e.tipo}</td>
                  <td className="preenchido">{e.descricao}</td>
                  <td className="preenchido">{e.ca ?? ""}</td>
                  <td className="preenchido">{e.recomendado ?? ""}</td>
                  <td className="ficha-check-cell">☐</td>
                  <td className="ficha-check-cell">☐</td>
                </tr>
              ))}
              {arrayEmpty(LINHAS_EXTRA.epis).map((_, i) => (
                <tr key={`empty-epi-${i}`}>
                  <td className="ficha-linha-livre">&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td className="ficha-check-cell">☐</td>
                  <td className="ficha-check-cell">☐</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* TREINAMENTOS */}
        <div className="ficha-secao">
          <div className="ficha-secao-titulo">5. Treinamentos NR</div>
          <table className="ficha-tabela">
            <thead>
              <tr>
                <th style={{ width: "8%" }}>NR</th>
                <th>Treinamento</th>
                <th style={{ width: "10%" }}>Carga</th>
                <th style={{ width: "13%" }}>Periodicidade</th>
                <th className="ficha-check-cell">Realizado</th>
                <th className="ficha-check-cell">Pendente</th>
              </tr>
            </thead>
            <tbody>
              {treinamentos.map((t) => (
                <tr key={t.id_treinamento}>
                  <td className="preenchido">{t.nr}</td>
                  <td className="preenchido">{t.titulo}</td>
                  <td className="preenchido">{t.carga_horaria ?? ""}</td>
                  <td className="preenchido">{t.periodicidade ?? ""}</td>
                  <td className="ficha-check-cell">☐</td>
                  <td className="ficha-check-cell">☐</td>
                </tr>
              ))}
              {arrayEmpty(LINHAS_EXTRA.treinamentos).map((_, i) => (
                <tr key={`empty-trein-${i}`}>
                  <td className="ficha-linha-livre">&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td className="ficha-check-cell">☐</td>
                  <td className="ficha-check-cell">☐</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* COMPLEMENTOS */}
        <div className="ficha-secao">
          <div className="ficha-secao-titulo">6. Complementos / Programas</div>
          <table className="ficha-tabela">
            <thead>
              <tr>
                <th style={{ width: "20%" }}>Tipo / Programa</th>
                <th>Descrição</th>
                <th className="ficha-check-cell">OK</th>
                <th className="ficha-check-cell">NC</th>
                <th className="ficha-check-cell">N/A</th>
              </tr>
            </thead>
            <tbody>
              {complementos.map((c) => (
                <tr key={c.id_complemento}>
                  <td className="preenchido">{c.tipo ?? c.titulo ?? ""}</td>
                  <td className="preenchido">{c.descricao ?? ""}</td>
                  <td className="ficha-check-cell">☐</td>
                  <td className="ficha-check-cell">☐</td>
                  <td className="ficha-check-cell">☐</td>
                </tr>
              ))}
              {arrayEmpty(LINHAS_EXTRA.complementos).map((_, i) => (
                <tr key={`empty-comp-${i}`}>
                  <td className="ficha-linha-livre">&nbsp;</td>
                  <td>&nbsp;</td>
                  <td className="ficha-check-cell">☐</td>
                  <td className="ficha-check-cell">☐</td>
                  <td className="ficha-check-cell">☐</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* RESPONSÁVEIS */}
        <div className="ficha-secao">
          <div className="ficha-secao-titulo">7. Responsáveis e Recepção</div>
          <table className="ficha-tabela">
            <thead>
              <tr>
                <th>Técnico Responsável</th>
                <th>Recepcionado por</th>
                <th style={{ width: "20%" }}>Cargo</th>
                <th style={{ width: "18%" }}>Data / Hora</th>
              </tr>
            </thead>
            <tbody>
              {responsaveis.map((r) => (
                <tr key={r.id_responsavel}>
                  <td className="preenchido">{r.tecnico_responsavel ?? ""}</td>
                  <td className="preenchido">{r.recepcionado_por ?? ""}</td>
                  <td className="preenchido">{r.cargo ?? ""}</td>
                  <td className="preenchido">{r.data_hora ?? ""}</td>
                </tr>
              ))}
              {arrayEmpty(LINHAS_EXTRA.responsaveis).map((_, i) => (
                <tr key={`empty-resp-${i}`}>
                  <td className="ficha-linha-livre">&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* PAE */}
        <div className="ficha-secao">
          <div className="ficha-secao-titulo">8. PAE — Contatos de Emergência</div>
          <table className="ficha-tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th style={{ width: "22%" }}>Cargo / Função</th>
                <th style={{ width: "20%" }}>Telefone</th>
                <th style={{ width: "10%" }}>Ordem</th>
              </tr>
            </thead>
            <tbody>
              {paeContatos.map((p) => (
                <tr key={p.id_contato}>
                  <td className="preenchido">{p.nome}</td>
                  <td className="preenchido">{p.cargo ?? ""}</td>
                  <td className="preenchido">{p.telefone ?? ""}</td>
                  <td className="preenchido">{p.ordem}</td>
                </tr>
              ))}
              {arrayEmpty(LINHAS_EXTRA.paeContatos).map((_, i) => (
                <tr key={`empty-pae-${i}`}>
                  <td className="ficha-linha-livre">&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* OBSERVAÇÕES */}
        <div className="ficha-secao">
          <div className="ficha-secao-titulo">9. Observações Gerais do Técnico</div>
          <table className="ficha-tabela">
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={`obs-${i}`}>
                  <td className="ficha-linha-livre-grande">&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ASSINATURAS */}
        <AssinaturaRelatorio tabelaNome="inspecoes_ficha" docId={id} />

        <p className="mt-4 text-center text-[9px] text-gray-500">
          SST JCN Consultoria · Ficha de Inspeção em Branco · gerado em{" "}
          {new Date().toLocaleDateString("pt-BR")} — preencha em campo e lance
          posteriormente no sistema.
        </p>
      </div>
    </div>
  );
}

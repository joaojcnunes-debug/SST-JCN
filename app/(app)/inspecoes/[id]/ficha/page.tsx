"use client";

import { use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { useInspecao } from "@/lib/hooks/useInspecao";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import {
  formatCNPJ,
  formatCPF,
  formatCEI,
  formatCAEPF,
  formatCNO,
} from "@/lib/utils";
import type { Risco, EpiEpc } from "@/lib/supabase/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default function FichaInspecaoPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isLoading } = useInspecao(id);
  const { data: empresa } = useEmpresa(data?.inspecao?.id_empresa);

  const porSetor = useMemo(() => {
    if (!data) return [];
    return data.setores.map((s) => {
      const cargos = data.cargos.filter((c) => c.id_setor === s.id_setor);
      const riscos = data.riscos.filter((r) => r.id_setor === s.id_setor);
      const epis = data.epis.filter((e) => e.id_setor === s.id_setor);
      return { setor: s, cargos, riscos, epis };
    });
  }, [data]);

  const riscosOrfaos = useMemo<Risco[]>(
    () =>
      data?.riscos.filter((r) => !r.id_setor) ?? [],
    [data]
  );
  const episOrfaos = useMemo<EpiEpc[]>(
    () => data?.epis.filter((e) => !e.id_setor) ?? [],
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

  const { inspecao, treinamentos, complementos } = data;

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
          .ficha-secao { break-inside: avoid; }
          .ficha-setor + .ficha-setor { break-before: page; }
        }
        .ficha-tabela {
          border-collapse: collapse;
          width: 100%;
          font-size: 11px;
        }
        .ficha-tabela th,
        .ficha-tabela td {
          border: 1px solid #94a3b8;
          padding: 6px 8px;
          vertical-align: top;
        }
        .ficha-tabela th {
          background: #f0f9f4;
          color: #1e4d28;
          font-weight: 700;
          text-align: left;
          font-size: 10px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
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
          font-size: 12px;
          padding: 6px 10px;
          margin-top: 14px;
        }
        .ficha-check-cell {
          text-align: center;
          width: 36px;
          font-size: 9px;
        }
        .ficha-linha-livre {
          height: 28px;
        }
      `}</style>

      <div className="flex items-center justify-between ficha-no-print">
        <button
          type="button"
          onClick={() => router.push(`/inspecoes/${id}`)}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="size-4" /> Voltar à inspeção
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent"
        >
          <Printer className="size-4" /> Imprimir / Salvar PDF
        </button>
      </div>

      <div className="ficha-print rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="ficha-titulo">
          Ficha de Inspeção de Campo · NR-01
        </div>

        <table className="ficha-tabela mt-0">
          <tbody>
            <tr>
              <th style={{ width: "30%" }}>Empresa</th>
              <td colSpan={3}>{empresa?.nome_empresa ?? "—"}</td>
            </tr>
            <tr>
              <th>Identificador</th>
              <td>{identificador}</td>
              <th style={{ width: "18%" }}>Inspeção</th>
              <td>
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
              <th>Data realizada</th>
              <td>____/____/______</td>
            </tr>
            <tr>
              <th>Responsável (TST/Eng. Segurança)</th>
              <td>{inspecao.responsavel ?? ""}</td>
              <th>Assinatura</th>
              <td>&nbsp;</td>
            </tr>
          </tbody>
        </table>

        {porSetor.length === 0 ? (
          <p className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Esta inspeção ainda não tem setores cadastrados. Cadastre os
            setores, cargos, riscos, EPIs e treinamentos para gerar uma
            ficha útil para o técnico em campo.
          </p>
        ) : (
          porSetor.map(({ setor, cargos, riscos, epis }) => (
            <section key={setor.id_setor} className="ficha-setor mt-4 ficha-secao">
              <div className="ficha-secao-titulo">
                Setor / GHE: {setor.setor_ghe}
              </div>

              {setor.descricao && (
                <p className="mt-1 text-[11px] italic text-gray-600">
                  {setor.descricao}
                </p>
              )}

              {cargos.length > 0 && (
                <table className="ficha-tabela mt-2">
                  <thead>
                    <tr>
                      <th style={{ width: "30%" }}>Cargo</th>
                      <th>Observações / nº de trabalhadores / EPIs em uso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cargos.map((c) => (
                      <tr key={c.id_cargo}>
                        <td>{c.cargo}</td>
                        <td className="ficha-linha-livre">&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {riscos.length > 0 && (
                <table className="ficha-tabela mt-2">
                  <thead>
                    <tr>
                      <th style={{ width: "14%" }}>Tipo</th>
                      <th style={{ width: "26%" }}>Agente</th>
                      <th>Fonte geradora / Descrição</th>
                      <th className="ficha-check-cell">OK</th>
                      <th className="ficha-check-cell">NC</th>
                      <th className="ficha-check-cell">N/A</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riscos.map((r) => (
                      <tr key={r.id_risco}>
                        <td>{r.tipo_risco}</td>
                        <td>{r.agente ?? "—"}</td>
                        <td>{r.fonte_geradora ?? "—"}</td>
                        <td className="ficha-check-cell">☐</td>
                        <td className="ficha-check-cell">☐</td>
                        <td className="ficha-check-cell">☐</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {epis.length > 0 && (
                <table className="ficha-tabela mt-2">
                  <thead>
                    <tr>
                      <th style={{ width: "10%" }}>Tipo</th>
                      <th>Descrição</th>
                      <th style={{ width: "14%" }}>CA</th>
                      <th className="ficha-check-cell">Em uso</th>
                      <th className="ficha-check-cell">Faltante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {epis.map((e) => (
                      <tr key={e.id_protecao}>
                        <td>{e.tipo}</td>
                        <td>{e.descricao}</td>
                        <td>{e.ca ?? "____"}</td>
                        <td className="ficha-check-cell">☐</td>
                        <td className="ficha-check-cell">☐</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          ))
        )}

        {(riscosOrfaos.length > 0 || episOrfaos.length > 0) && (
          <section className="mt-4 ficha-secao">
            <div className="ficha-secao-titulo">
              Itens sem setor específico
            </div>
            {riscosOrfaos.length > 0 && (
              <table className="ficha-tabela mt-2">
                <thead>
                  <tr>
                    <th style={{ width: "14%" }}>Tipo de Risco</th>
                    <th>Agente / Fonte</th>
                    <th className="ficha-check-cell">OK</th>
                    <th className="ficha-check-cell">NC</th>
                    <th className="ficha-check-cell">N/A</th>
                  </tr>
                </thead>
                <tbody>
                  {riscosOrfaos.map((r) => (
                    <tr key={r.id_risco}>
                      <td>{r.tipo_risco}</td>
                      <td>
                        {r.agente ?? "—"}
                        {r.fonte_geradora ? ` — ${r.fonte_geradora}` : ""}
                      </td>
                      <td className="ficha-check-cell">☐</td>
                      <td className="ficha-check-cell">☐</td>
                      <td className="ficha-check-cell">☐</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {episOrfaos.length > 0 && (
              <table className="ficha-tabela mt-2">
                <thead>
                  <tr>
                    <th style={{ width: "10%" }}>Tipo</th>
                    <th>Descrição</th>
                    <th style={{ width: "14%" }}>CA</th>
                    <th className="ficha-check-cell">Em uso</th>
                    <th className="ficha-check-cell">Faltante</th>
                  </tr>
                </thead>
                <tbody>
                  {episOrfaos.map((e) => (
                    <tr key={e.id_protecao}>
                      <td>{e.tipo}</td>
                      <td>{e.descricao}</td>
                      <td>{e.ca ?? "____"}</td>
                      <td className="ficha-check-cell">☐</td>
                      <td className="ficha-check-cell">☐</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {treinamentos.length > 0 && (
          <section className="mt-4 ficha-secao">
            <div className="ficha-secao-titulo">Treinamentos NR</div>
            <table className="ficha-tabela mt-2">
              <thead>
                <tr>
                  <th style={{ width: "10%" }}>NR</th>
                  <th>Treinamento</th>
                  <th style={{ width: "12%" }}>Carga</th>
                  <th style={{ width: "14%" }}>Periodicidade</th>
                  <th className="ficha-check-cell">Realizado</th>
                  <th className="ficha-check-cell">Pendente</th>
                </tr>
              </thead>
              <tbody>
                {treinamentos.map((t) => (
                  <tr key={t.id_treinamento}>
                    <td>{t.nr}</td>
                    <td>{t.titulo}</td>
                    <td>{t.carga_horaria ?? "—"}</td>
                    <td>{t.periodicidade ?? "—"}</td>
                    <td className="ficha-check-cell">☐</td>
                    <td className="ficha-check-cell">☐</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {complementos.length > 0 && (
          <section className="mt-4 ficha-secao">
            <div className="ficha-secao-titulo">Complementos / Programas</div>
            <table className="ficha-tabela mt-2">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="ficha-check-cell">OK</th>
                  <th className="ficha-check-cell">NC</th>
                  <th className="ficha-check-cell">N/A</th>
                </tr>
              </thead>
              <tbody>
                {complementos.map((c) => (
                  <tr key={c.id_complemento}>
                    <td>{c.descricao}</td>
                    <td className="ficha-check-cell">☐</td>
                    <td className="ficha-check-cell">☐</td>
                    <td className="ficha-check-cell">☐</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="mt-4 ficha-secao">
          <div className="ficha-secao-titulo">Observações gerais do técnico</div>
          <table className="ficha-tabela mt-2">
            <tbody>
              <tr>
                <td className="ficha-linha-livre">&nbsp;</td>
              </tr>
              <tr>
                <td className="ficha-linha-livre">&nbsp;</td>
              </tr>
              <tr>
                <td className="ficha-linha-livre">&nbsp;</td>
              </tr>
              <tr>
                <td className="ficha-linha-livre">&nbsp;</td>
              </tr>
            </tbody>
          </table>
        </section>

        <p className="mt-6 text-center text-[9px] text-gray-500">
          Documento gerado pelo Painel SST Chabra em{" "}
          {new Date().toLocaleDateString("pt-BR")} — preencha em campo e lance
          no sistema posteriormente.
        </p>
      </div>
    </div>
  );
}

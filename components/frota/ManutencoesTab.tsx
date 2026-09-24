"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Save, Trash2, Wrench, X } from "lucide-react";
import {
  useExcluirManutencao,
  useManutencoesDoVeiculo,
  useSalvarManutencao,
  type ManutencaoInput,
} from "@/lib/hooks/useFrotaManutencoes";
import { formatarKm, kmEfetivo } from "@/lib/frota/km";
import { dataBr, moeda } from "@/lib/frota/painel";
import {
  ROTULO_STATUS_MANUTENCAO,
  ROTULO_TIPO_MANUTENCAO,
  STATUS_MANUTENCAO,
  TIPOS_MANUTENCAO,
  type FrotaManutencao,
  type FrotaVeiculo,
  type StatusManutencao,
} from "@/lib/frota/tipos";
import { apenasDecimal, apenasDigitos, paraDecimal } from "@/lib/frota/numero";
import { cn } from "@/lib/utils";

/**
 * A aba MANUTENÇÃO. Ela responde pelo que a situação 'MANUTENCAO' do veículo
 * sempre afirmou sem provar: o quê, quando, onde, quanto, e quando é a próxima.
 *
 * O formulário é o MESMO para criar e editar de propósito. Manutenção é o
 * registro que mais muda depois de nascer: entra agendada, vira em andamento e
 * só na saída da oficina ganha data de saída, nota fiscal e valor. Duas telas
 * para isso seriam duas telas que sempre teriam de ser alteradas juntas.
 */

const STATUS_CORES: Record<StatusManutencao, string> = {
  AGENDADA: "bg-blue-100 text-blue-700",
  EM_ANDAMENTO: "bg-amber-100 text-amber-700",
  CONCLUIDA: "bg-emerald-100 text-emerald-700",
  CANCELADA: "bg-gray-100 text-gray-600",
};

const rotulo = "block text-xs font-medium text-gray-600";
const campo =
  "mt-1 w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export default function ManutencoesTab({ veiculo }: { veiculo: FrotaVeiculo }) {
  const idVeiculo = veiculo.id_veiculo;
  const { data: manutencoes = [], isLoading } = useManutencoesDoVeiculo(idVeiculo);
  const excluir = useExcluirManutencao();

  const [abrindo, setAbrindo] = useState(false);
  const [editando, setEditando] = useState<FrotaManutencao | null>(null);

  const gastoTotal = manutencoes
    .filter((m) => m.status !== "CANCELADA")
    .reduce((s, m) => s + (m.valor ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">
          {manutencoes.length} {manutencoes.length === 1 ? "registro" : "registros"}
          {gastoTotal > 0 && (
            <span className="text-gray-700"> · {moeda(gastoTotal)} no total</span>
          )}
        </p>
        <button type="button"
          onClick={() => { setEditando(null); setAbrindo((v) => !v); }}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          {abrindo && !editando ? <X className="size-4" /> : <Plus className="size-4" />}
          {abrindo && !editando ? "Cancelar" : "Registrar manutenção"}
        </button>
      </div>

      {(abrindo || editando) && (
        <ManutencaoForm
          veiculo={veiculo}
          manutencao={editando}
          onPronto={() => { setAbrindo(false); setEditando(null); }}
        />
      )}

      {isLoading ? (
        <p className="py-10 text-center text-sm text-gray-500">Carregando…</p>
      ) : manutencoes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white py-14 text-center">
          <Wrench className="mx-auto size-7 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">Nenhuma manutenção registrada</p>
          <p className="mt-1 text-sm text-gray-500">
            Registrar a revisão aqui é o que faz o painel avisar da próxima.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {manutencoes.map((m) => (
            <li key={m.id_manutencao} className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {ROTULO_TIPO_MANUTENCAO[m.tipo]}
                    </span>
                    <span className={cn(
                      "rounded px-1.5 py-0.5 text-[11px] font-semibold",
                      STATUS_CORES[m.status],
                    )}>
                      {ROTULO_STATUS_MANUTENCAO[m.status]}
                    </span>
                    {m.valor != null && (
                      <span className="text-sm tabular-nums text-gray-700">{moeda(m.valor)}</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{m.descricao}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {[
                      `entrada ${dataBr(m.data_entrada)}`,
                      m.data_saida ? `saída ${dataBr(m.data_saida)}` : "ainda na oficina",
                      m.oficina,
                      m.nota_fiscal && `NF ${m.nota_fiscal}`,
                      m.km_odometro != null && `${formatarKm(m.km_odometro)} km`,
                    ].filter(Boolean).join(" · ")}
                  </p>
                  {(m.proxima_revisao_data || m.proxima_revisao_km != null) && (
                    <p className="mt-1 inline-block rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-800">
                      Próxima revisão:{" "}
                      {[
                        m.proxima_revisao_data ? dataBr(m.proxima_revisao_data) : null,
                        m.proxima_revisao_km != null
                          ? `${formatarKm(m.proxima_revisao_km)} km`
                          : null,
                      ].filter(Boolean).join(" ou ")}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 gap-1">
                  <button type="button" aria-label="Editar manutenção"
                    onClick={() => { setAbrindo(false); setEditando(m); }}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-50 hover:text-blue-600">
                    <Pencil className="size-4" />
                  </button>
                  <button type="button" aria-label="Excluir manutenção"
                    onClick={() => {
                      if (confirm("Mover esta manutenção para a lixeira?")) {
                        excluir.mutate({ id_manutencao: m.id_manutencao, id_veiculo: idVeiculo });
                      }
                    }}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-50 hover:text-red-600">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ManutencaoForm({
  veiculo,
  manutencao,
  onPronto,
}: {
  veiculo: FrotaVeiculo;
  manutencao: FrotaManutencao | null;
  onPronto: () => void;
}) {
  const salvar = useSalvarManutencao();
  const hoje = new Date().toISOString().slice(0, 10);

  const [f, setF] = useState({
    tipo: manutencao?.tipo ?? "PREVENTIVA",
    status: manutencao?.status ?? "EM_ANDAMENTO",
    data_entrada: manutencao?.data_entrada?.slice(0, 10) ?? hoje,
    data_saida: manutencao?.data_saida?.slice(0, 10) ?? "",
    km_odometro: manutencao?.km_odometro?.toString() ?? "",
    descricao: manutencao?.descricao ?? "",
    oficina: manutencao?.oficina ?? "",
    nota_fiscal: manutencao?.nota_fiscal ?? "",
    valor: manutencao?.valor?.toString() ?? "",
    proxima_revisao_data: manutencao?.proxima_revisao_data?.slice(0, 10) ?? "",
    proxima_revisao_km: manutencao?.proxima_revisao_km?.toString() ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((a) => ({ ...a, [k]: v }));

  const erroSaida =
    f.data_saida && f.data_saida < f.data_entrada
      ? "A saída da oficina não pode ser antes da entrada."
      : null;
  const podeSalvar = f.descricao.trim().length > 0 && !!f.data_entrada && !erroSaida;

  async function enviar() {
    const input: ManutencaoInput = {
      id_veiculo: veiculo.id_veiculo,
      tipo: f.tipo as ManutencaoInput["tipo"],
      status: f.status as ManutencaoInput["status"],
      data_entrada: f.data_entrada,
      data_saida: f.data_saida || null,
      km_odometro: f.km_odometro ? Number(f.km_odometro) : null,
      descricao: f.descricao.trim(),
      oficina: f.oficina.trim() || null,
      nota_fiscal: f.nota_fiscal.trim() || null,
      valor: paraDecimal(f.valor),
      proxima_revisao_data: f.proxima_revisao_data || null,
      proxima_revisao_km: f.proxima_revisao_km ? Number(f.proxima_revisao_km) : null,
      id_sinistro_origem: manutencao?.id_sinistro_origem ?? null,
    };
    try {
      await salvar.mutateAsync({ input, id_manutencao: manutencao?.id_manutencao });
      onPronto();
    } catch {
      /* o hook já avisou; o formulário fica na tela */
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={rotulo}>Tipo</label>
          <select value={f.tipo} onChange={(e) => set("tipo", e.target.value as typeof f.tipo)}
            className={campo}>
            {TIPOS_MANUTENCAO.map((t) => (
              <option key={t} value={t}>{ROTULO_TIPO_MANUTENCAO[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={rotulo}>Situação</label>
          <select value={f.status} onChange={(e) => set("status", e.target.value as typeof f.status)}
            className={campo}>
            {STATUS_MANUTENCAO.map((s) => (
              <option key={s} value={s}>{ROTULO_STATUS_MANUTENCAO[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={rotulo}>Oficina</label>
          <input value={f.oficina} onChange={(e) => set("oficina", e.target.value)}
            placeholder="Auto Center Barbacena" className={campo} />
        </div>
      </div>

      <div>
        <label className={rotulo}>
          O que foi feito <span className="text-red-500">*</span>
        </label>
        <textarea value={f.descricao} onChange={(e) => set("descricao", e.target.value)} rows={2}
          placeholder="Revisão de 60.000 km: óleo, filtros, pastilhas dianteiras e alinhamento."
          className={campo} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <label className={rotulo}>
            Entrada <span className="text-red-500">*</span>
          </label>
          <input type="date" value={f.data_entrada}
            onChange={(e) => set("data_entrada", e.target.value)} className={campo} />
        </div>
        <div>
          <label className={rotulo}>Saída da oficina</label>
          <input type="date" value={f.data_saida}
            onChange={(e) => set("data_saida", e.target.value)}
            className={cn(campo, erroSaida && "border-red-400")} />
          {erroSaida ? (
            <p className="mt-1 text-xs text-red-600">{erroSaida}</p>
          ) : (
            <p className="mt-1 text-xs text-gray-400">Em branco = ainda lá dentro.</p>
          )}
        </div>
        <div>
          <label className={rotulo}>Odômetro na entrada</label>
          <input inputMode="numeric" value={f.km_odometro}
            onChange={(e) => set("km_odometro", apenasDigitos(e.target.value))}
            placeholder={String(kmEfetivo(veiculo))} className={cn(campo, "tabular-nums")} />
        </div>
        <div>
          <label className={rotulo}>Valor (R$)</label>
          <input inputMode="decimal" value={f.valor}
            onChange={(e) => set("valor", apenasDecimal(e.target.value))}
            placeholder="1240,00" className={cn(campo, "tabular-nums")} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={rotulo}>Nota fiscal</label>
          <input value={f.nota_fiscal} onChange={(e) => set("nota_fiscal", e.target.value)}
            className={campo} />
        </div>
        <div>
          <label className={rotulo}>Próxima revisão — data</label>
          <input type="date" value={f.proxima_revisao_data}
            onChange={(e) => set("proxima_revisao_data", e.target.value)} className={campo} />
        </div>
        <div>
          <label className={rotulo}>Próxima revisão — km</label>
          <input inputMode="numeric" value={f.proxima_revisao_km}
            onChange={(e) => set("proxima_revisao_km", apenasDigitos(e.target.value))}
            placeholder={String(kmEfetivo(veiculo) + 10000)}
            className={cn(campo, "tabular-nums")} />
        </div>
      </div>

      {/* As duas valem juntas: o painel avisa pelo que vier primeiro. Dizer isso
          aqui evita a pergunta "preencho qual das duas?". */}
      <p className="text-xs text-gray-500">
        Pode preencher as duas próximas revisões. O painel avisa pela que chegar primeiro — data ou
        quilometragem.
      </p>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onPronto}
          className="rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-white">
          Cancelar
        </button>
        <button type="button" onClick={enviar} disabled={!podeSalvar || salvar.isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {salvar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {manutencao ? "Salvar" : "Registrar"}
        </button>
      </div>
    </div>
  );
}

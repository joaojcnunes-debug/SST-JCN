"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Plus, Save, Trash2, TriangleAlert, X } from "lucide-react";
import {
  useExcluirSinistro,
  useSalvarSinistro,
  useSinistrosDoVeiculo,
  type SinistroInput,
} from "@/lib/hooks/useFrotaSinistros";
import {
  GRAVIDADES_SINISTRO,
  ROTULO_STATUS_SINISTRO,
  ROTULO_TIPO_SINISTRO,
  STATUS_SINISTRO,
  TIPOS_SINISTRO,
  type StatusSinistro,
} from "@/lib/frota/tipos";
import { apenasDecimal, paraDecimal } from "@/lib/frota/numero";
import { cn } from "@/lib/utils";

const STATUS_CORES: Record<StatusSinistro, string> = {
  ABERTO: "bg-red-100 text-red-700",
  EM_ANALISE: "bg-amber-100 text-amber-700",
  EM_REPARO: "bg-blue-100 text-blue-700",
  ENCERRADO: "bg-emerald-100 text-emerald-700",
  NEGADO: "bg-gray-100 text-gray-600",
};

const rotulo = "block text-xs font-medium text-gray-600";
const campo =
  "mt-1 w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const moeda = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dataBr = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};

export default function SinistrosTab({ idVeiculo }: { idVeiculo: string }) {
  const { data: sinistros = [], isLoading } = useSinistrosDoVeiculo(idVeiculo);
  const excluir = useExcluirSinistro();
  const [abrindo, setAbrindo] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">
          {sinistros.length} {sinistros.length === 1 ? "registro" : "registros"}
          {sinistros.some((s) => s.status === "ABERTO" || s.status === "EM_ANALISE") && (
            <span className="text-amber-700"> · há casos em aberto</span>
          )}
        </p>
        <button
          type="button"
          onClick={() => setAbrindo((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {abrindo ? <X className="size-4" /> : <Plus className="size-4" />}
          {abrindo ? "Cancelar" : "Registrar sinistro"}
        </button>
      </div>

      {abrindo && (
        <SinistroForm idVeiculo={idVeiculo} onPronto={() => setAbrindo(false)} />
      )}

      {isLoading ? (
        <p className="py-10 text-center text-sm text-gray-500">Carregando…</p>
      ) : sinistros.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white py-14 text-center">
          <TriangleAlert className="mx-auto size-7 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">Nenhum sinistro registrado</p>
          <p className="mt-1 text-sm text-gray-500">É o cenário bom. Registre se acontecer.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sinistros.map((s) => (
            <li key={s.id_sinistro} className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {ROTULO_TIPO_SINISTRO[s.tipo]}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[11px] font-semibold",
                        STATUS_CORES[s.status],
                      )}
                    >
                      {ROTULO_STATUS_SINISTRO[s.status]}
                    </span>
                    {s.com_vitima && (
                      <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-700">
                        <AlertTriangle className="size-3" />
                        com vítima
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{s.descricao}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {[
                      dataBr(s.data_ocorrencia),
                      s.hora_ocorrencia?.slice(0, 5),
                      s.condutor_nome,
                      s.local_ocorrencia,
                      s.gravidade,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {(s.seguradora || s.valor_prejuizo != null || s.boletim_ocorrencia) && (
                    <p className="mt-1 text-xs text-gray-500">
                      {[
                        s.seguradora && `Seguradora: ${s.seguradora}`,
                        s.numero_aviso_sinistro && `Aviso ${s.numero_aviso_sinistro}`,
                        s.boletim_ocorrencia && `BO ${s.boletim_ocorrencia}`,
                        s.valor_franquia != null && `Franquia ${moeda(s.valor_franquia)}`,
                        s.valor_prejuizo != null && `Prejuízo ${moeda(s.valor_prejuizo)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  aria-label="Excluir sinistro"
                  onClick={() => {
                    if (confirm("Mover este sinistro para a lixeira?")) {
                      excluir.mutate({ id_sinistro: s.id_sinistro, id_veiculo: idVeiculo });
                    }
                  }}
                  className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-gray-50 hover:text-red-600"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SinistroForm({ idVeiculo, onPronto }: { idVeiculo: string; onPronto: () => void }) {
  const salvar = useSalvarSinistro();
  const [fotos, setFotos] = useState<File[]>([]);
  const [f, setF] = useState({
    data_ocorrencia: new Date().toISOString().slice(0, 10),
    hora_ocorrencia: "",
    tipo: "COLISAO",
    gravidade: "",
    com_vitima: false,
    descricao: "",
    condutor_nome: "",
    local_ocorrencia: "",
    boletim_ocorrencia: "",
    seguradora: "",
    numero_aviso_sinistro: "",
    valor_franquia: "",
    valor_prejuizo: "",
    status: "ABERTO",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((a) => ({ ...a, [k]: v }));

  const podeSalvar = f.descricao.trim().length > 0 && !!f.data_ocorrencia;

  async function enviar() {
    const input: SinistroInput = {
      id_veiculo: idVeiculo,
      data_ocorrencia: f.data_ocorrencia,
      hora_ocorrencia: f.hora_ocorrencia || null,
      tipo: f.tipo as SinistroInput["tipo"],
      gravidade: f.gravidade ? (f.gravidade as SinistroInput["gravidade"]) : null,
      com_vitima: f.com_vitima,
      descricao: f.descricao.trim(),
      condutor_nome: f.condutor_nome.trim() || null,
      local_ocorrencia: f.local_ocorrencia.trim() || null,
      latitude: null,
      longitude: null,
      boletim_ocorrencia: f.boletim_ocorrencia.trim() || null,
      seguradora: f.seguradora.trim() || null,
      numero_aviso_sinistro: f.numero_aviso_sinistro.trim() || null,
      // paraDecimal aceita a vírgula que o campo deixa digitar; `Number` não.
      valor_franquia: paraDecimal(f.valor_franquia),
      valor_prejuizo: paraDecimal(f.valor_prejuizo),
      status: f.status as SinistroInput["status"],
      id_checklist_origem: null,
    };
    try {
      await salvar.mutateAsync({ input, fotos });
      onPronto();
    } catch {
      /* o hook já avisou; o formulário fica na tela */
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={rotulo}>Data <span className="text-red-500">*</span></label>
          <input type="date" value={f.data_ocorrencia}
            onChange={(e) => set("data_ocorrencia", e.target.value)} className={campo} />
        </div>
        <div>
          <label className={rotulo}>Hora</label>
          <input type="time" value={f.hora_ocorrencia}
            onChange={(e) => set("hora_ocorrencia", e.target.value)} className={campo} />
        </div>
        <div>
          <label className={rotulo}>Tipo</label>
          <select value={f.tipo} onChange={(e) => set("tipo", e.target.value)} className={campo}>
            {TIPOS_SINISTRO.map((t) => (
              <option key={t} value={t}>{ROTULO_TIPO_SINISTRO[t]}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={rotulo}>O que aconteceu <span className="text-red-500">*</span></label>
        <textarea value={f.descricao} onChange={(e) => set("descricao", e.target.value)} rows={2}
          placeholder="Colisão traseira na BR-116, altura de Magé, com veículo de terceiros."
          className={campo} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={rotulo}>Condutor</label>
          <input value={f.condutor_nome} onChange={(e) => set("condutor_nome", e.target.value)}
            placeholder="Nome" className={campo} />
        </div>
        <div>
          <label className={rotulo}>Local</label>
          <input value={f.local_ocorrencia} onChange={(e) => set("local_ocorrencia", e.target.value)}
            placeholder="BR-116, km 12" className={campo} />
        </div>
        <div>
          <label className={rotulo}>Gravidade</label>
          <select value={f.gravidade} onChange={(e) => set("gravidade", e.target.value)} className={campo}>
            <option value="">—</option>
            {GRAVIDADES_SINISTRO.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={f.com_vitima}
          onChange={(e) => set("com_vitima", e.target.checked)}
          className="size-4 rounded border-gray-300 text-blue-600" />
        Houve vítima
      </label>
      {f.com_vitima && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Acidente com vítima costuma exigir Investigação de Acidente de Trabalho. Este registro
          <strong> não abre a investigação automaticamente</strong> — abrir é decisão de quem conduz.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={rotulo}>Seguradora</label>
          <input value={f.seguradora} onChange={(e) => set("seguradora", e.target.value)} className={campo} />
        </div>
        <div>
          <label className={rotulo}>Nº do aviso</label>
          <input value={f.numero_aviso_sinistro}
            onChange={(e) => set("numero_aviso_sinistro", e.target.value)} className={campo} />
        </div>
        <div>
          <label className={rotulo}>Boletim de ocorrência</label>
          <input value={f.boletim_ocorrencia}
            onChange={(e) => set("boletim_ocorrencia", e.target.value)} className={campo} />
        </div>
        {/* Sem `type="number"` — ver lib/frota/numero.ts. Aqui o campo nem
            `inputMode` tinha: no celular abria o teclado de letras para digitar
            um valor em reais. */}
        <div>
          <label className={rotulo}>Franquia (R$)</label>
          <input inputMode="decimal" value={f.valor_franquia} placeholder="1500,00"
            onChange={(e) => set("valor_franquia", apenasDecimal(e.target.value))}
            className={cn(campo, "tabular-nums")} />
        </div>
        <div>
          <label className={rotulo}>Prejuízo (R$)</label>
          <input inputMode="decimal" value={f.valor_prejuizo} placeholder="3200,00"
            onChange={(e) => set("valor_prejuizo", apenasDecimal(e.target.value))}
            className={cn(campo, "tabular-nums")} />
        </div>
        <div>
          <label className={rotulo}>Situação</label>
          <select value={f.status} onChange={(e) => set("status", e.target.value)} className={campo}>
            {STATUS_SINISTRO.map((s) => (
              <option key={s} value={s}>{ROTULO_STATUS_SINISTRO[s]}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={rotulo}>Fotos</label>
        <input type="file" accept="image/*" multiple
          onChange={(e) => setFotos(Array.from(e.target.files ?? []))}
          className="mt-1 block w-full text-sm text-gray-600" />
        {fotos.length > 0 && (
          <p className="mt-1 text-xs text-gray-500">
            {fotos.length} {fotos.length === 1 ? "foto selecionada" : "fotos selecionadas"}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onPronto}
          className="rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-white">
          Cancelar
        </button>
        <button type="button" onClick={enviar} disabled={!podeSalvar || salvar.isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {salvar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Registrar
        </button>
      </div>
    </div>
  );
}

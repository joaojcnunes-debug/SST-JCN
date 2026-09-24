"use client";

import { useState } from "react";
import { Fuel, Loader2, Paperclip, Plus, Save, Trash2, X } from "lucide-react";
import StorageImg from "@/components/ui/StorageImg";
import {
  useAbastecimentoAnexos,
  useAbastecimentosDoVeiculo,
  useExcluirAbastecimento,
  useSalvarAbastecimento,
  type AbastecimentoInput,
} from "@/lib/hooks/useFrotaAbastecimentos";
import { formatarBytes, iconeAnexo } from "@/lib/frota/fotos";
import { formatarKm } from "@/lib/frota/km";
import { apenasDecimal, apenasDigitos, paraDecimal, paraInteiro } from "@/lib/frota/numero";
import {
  FORMAS_PAGAMENTO,
  ROTULO_COMBUSTIVEL,
  ROTULO_FORMA_PAGAMENTO,
  TIPOS_COMBUSTIVEL,
  type FrotaAbastecimento,
} from "@/lib/frota/tipos";
import { cn } from "@/lib/utils";

const rotulo = "block text-xs font-medium text-gray-600";
const campo =
  "mt-1 w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const moeda = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dataHoraBr = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export default function AbastecimentosTab({ idVeiculo }: { idVeiculo: string }) {
  const { data: lista = [], isLoading } = useAbastecimentosDoVeiculo(idVeiculo);
  const excluir = useExcluirAbastecimento();
  const [abrindo, setAbrindo] = useState(false);

  const totalGasto = lista.reduce((s, a) => s + (a.valor_total ?? 0), 0);
  const totalLitros = lista.reduce((s, a) => s + (a.litros ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">
          {lista.length} {lista.length === 1 ? "abastecimento" : "abastecimentos"}
          {totalLitros > 0 && (
            <span className="text-gray-400">
              {" · "}
              {totalLitros.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L
              {totalGasto > 0 && ` · ${moeda(totalGasto)}`}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => setAbrindo((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {abrindo ? <X className="size-4" /> : <Plus className="size-4" />}
          {abrindo ? "Cancelar" : "Lançar abastecimento"}
        </button>
      </div>

      {abrindo && <AbastecimentoForm idVeiculo={idVeiculo} onPronto={() => setAbrindo(false)} />}

      {isLoading ? (
        <p className="py-10 text-center text-sm text-gray-500">Carregando…</p>
      ) : lista.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white py-14 text-center">
          <Fuel className="mx-auto size-7 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">Nenhum abastecimento lançado</p>
          <p className="mt-1 text-sm text-gray-500">
            Anexe o comprovante — foto, PDF ou o que vier do posto.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {lista.map((a) => (
            <Item key={a.id_abastecimento} a={a}
              onExcluir={() => {
                if (confirm("Mover este abastecimento para a lixeira?")) {
                  excluir.mutate({ id_abastecimento: a.id_abastecimento, id_veiculo: idVeiculo });
                }
              }} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Item({
  a,
  onExcluir,
}: {
  a: FrotaAbastecimento;
  onExcluir: () => void;
}) {
  const { data: anexos = [] } = useAbastecimentoAnexos(a.id_abastecimento);

  return (
    <li className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">
              {ROTULO_COMBUSTIVEL[a.tipo_combustivel]}
            </span>
            {a.litros != null && (
              <span className="tabular-nums text-sm text-gray-600">
                {a.litros.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L
              </span>
            )}
            {a.valor_total != null && (
              <span className="tabular-nums text-sm font-medium text-gray-800">
                {moeda(a.valor_total)}
              </span>
            )}
            {!a.tanque_cheio && (
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
                tanque parcial
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-gray-500">
            {[
              dataHoraBr(a.data_hora),
              a.condutor_nome,
              a.km_odometro != null && `${formatarKm(a.km_odometro)} km`,
              a.posto,
              a.cidade_uf,
              a.forma_pagamento && ROTULO_FORMA_PAGAMENTO[a.forma_pagamento],
              a.numero_cupom && `cupom ${a.numero_cupom}`,
              a.valor_litro != null && `${moeda(a.valor_litro)}/L`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {/* Anexos: imagem mostra miniatura, o resto mostra ícone por tipo. */}
          {anexos.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {anexos.map((x) => (
                <li key={x.id_anexo}>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600"
                    title={`${x.nome_arquivo} · ${formatarBytes(x.bytes)}`}
                  >
                    {x.thumb_path ? (
                      <StorageImg
                        stored={x.thumb_path}
                        alt={x.nome_arquivo}
                        className="size-6 rounded object-cover"
                      />
                    ) : (
                      <span aria-hidden className="text-sm">{iconeAnexo(x.mime)}</span>
                    )}
                    <span className="max-w-[10rem] truncate">{x.nome_arquivo}</span>
                    <span className="tabular-nums text-gray-400">{formatarBytes(x.bytes)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          aria-label="Excluir abastecimento"
          onClick={onExcluir}
          className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-gray-50 hover:text-red-600"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}

function AbastecimentoForm({ idVeiculo, onPronto }: { idVeiculo: string; onPronto: () => void }) {
  const salvar = useSalvarAbastecimento();
  const [anexos, setAnexos] = useState<File[]>([]);
  const [f, setF] = useState({
    condutor_nome: "",
    km_odometro: "",
    tipo_combustivel: "GASOLINA",
    litros: "",
    valor_litro: "",
    valor_total: "",
    posto: "",
    cidade_uf: "",
    forma_pagamento: "",
    numero_cupom: "",
    tanque_cheio: true,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((a) => ({ ...a, [k]: v }));

  const podeSalvar = f.condutor_nome.trim().length > 0;

  async function enviar() {
    const input: AbastecimentoInput = {
      id_veiculo: idVeiculo,
      data_hora: new Date().toISOString(),
      condutor_nome: f.condutor_nome.trim(),
      km_odometro: paraInteiro(f.km_odometro),
      tipo_combustivel: f.tipo_combustivel as AbastecimentoInput["tipo_combustivel"],
      // paraDecimal, e não Number: o campo aceita vírgula, e `Number("38,5")` é
      // NaN. Um NaN entrando como litros faz a média de consumo do painel virar
      // "—" sem ninguém entender por quê.
      litros: paraDecimal(f.litros),
      valor_litro: paraDecimal(f.valor_litro),
      valor_total: paraDecimal(f.valor_total),
      posto: f.posto.trim() || null,
      cidade_uf: f.cidade_uf.trim() || null,
      forma_pagamento: f.forma_pagamento
        ? (f.forma_pagamento as AbastecimentoInput["forma_pagamento"])
        : null,
      numero_cupom: f.numero_cupom.trim() || null,
      tanque_cheio: f.tanque_cheio,
      id_checklist_origem: null,
    };
    try {
      await salvar.mutateAsync({ input, anexos });
      onPronto();
    } catch {
      /* o hook já avisou */
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={rotulo}>Quem pegou o veículo <span className="text-red-500">*</span></label>
          <input value={f.condutor_nome} onChange={(e) => set("condutor_nome", e.target.value)}
            placeholder="Nome do condutor" className={campo} />
        </div>
        <div>
          <label className={rotulo}>Km do odômetro</label>
          <input inputMode="numeric" value={f.km_odometro}
            onChange={(e) => set("km_odometro", apenasDigitos(e.target.value))}
            placeholder="84210" className={cn(campo, "tabular-nums")} />
          <p className="mt-1 text-xs text-gray-400">Sobe o registro do veículo, se for maior.</p>
        </div>
        <div>
          <label className={rotulo}>Combustível</label>
          <select value={f.tipo_combustivel} onChange={(e) => set("tipo_combustivel", e.target.value)}
            className={campo}>
            {TIPOS_COMBUSTIVEL.map((t) => (
              <option key={t} value={t}>{ROTULO_COMBUSTIVEL[t]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Três campos livres e independentes: nada é calculado.
          Sem `type="number"` nos três: além da roda do mouse alterar o valor em
          silêncio, o campo numérico nativo trata a VÍRGULA conforme o idioma do
          navegador — e os placeholders aqui ensinam vírgula ("38,5"). Dependia
          de sorte. Agora a vírgula é aceita sempre e convertida uma vez só, em
          `paraDecimal`. Ver lib/frota/numero.ts. */}
      <div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={rotulo}>Litros</label>
            <input inputMode="decimal" value={f.litros}
              onChange={(e) => set("litros", apenasDecimal(e.target.value))}
              placeholder="38,5" className={cn(campo, "tabular-nums")} />
          </div>
          <div>
            <label className={rotulo}>Valor por litro (R$)</label>
            <input inputMode="decimal" value={f.valor_litro}
              onChange={(e) => set("valor_litro", apenasDecimal(e.target.value))}
              placeholder="6,29" className={cn(campo, "tabular-nums")} />
          </div>
          <div>
            <label className={rotulo}>Valor total (R$)</label>
            <input inputMode="decimal" value={f.valor_total}
              onChange={(e) => set("valor_total", apenasDecimal(e.target.value))}
              placeholder="242,17" className={cn(campo, "tabular-nums")} />
          </div>
        </div>
        <p className="mt-1.5 text-xs text-gray-500">
          Os três são independentes e nenhum é calculado. O valor do litro varia por posto — quem
          manda é o cupom, não a conta.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <label className={rotulo}>Posto</label>
          <input value={f.posto} onChange={(e) => set("posto", e.target.value)} className={campo} />
        </div>
        <div>
          <label className={rotulo}>Cidade/UF</label>
          <input value={f.cidade_uf} onChange={(e) => set("cidade_uf", e.target.value)}
            placeholder="Magé/RJ" className={campo} />
        </div>
        <div>
          <label className={rotulo}>Pagamento</label>
          <select value={f.forma_pagamento} onChange={(e) => set("forma_pagamento", e.target.value)}
            className={campo}>
            <option value="">—</option>
            {FORMAS_PAGAMENTO.map((p) => (
              <option key={p} value={p}>{ROTULO_FORMA_PAGAMENTO[p]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={rotulo}>Nº do cupom</label>
          <input value={f.numero_cupom} onChange={(e) => set("numero_cupom", e.target.value)}
            className={cn(campo, "tabular-nums")} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={f.tanque_cheio}
          onChange={(e) => set("tanque_cheio", e.target.checked)}
          className="size-4 rounded border-gray-300 text-blue-600" />
        Encheu o tanque
        <span className="text-xs text-gray-400">— sem isso, o consumo médio não fecha</span>
      </label>

      {/* O comprovante: qualquer formato, mais de um. */}
      <div>
        <label className={rotulo}>
          <span className="inline-flex items-center gap-1">
            <Paperclip className="size-3.5" />
            Comprovante
          </span>
        </label>
        <input
          type="file"
          multiple
          onChange={(e) => setAnexos(Array.from(e.target.files ?? []))}
          className="mt-1 block w-full text-sm text-gray-600"
        />
        <p className="mt-1 text-xs text-gray-500">
          Foto, PDF ou qualquer outro formato. Pode anexar mais de um — cupom da bomba e
          comprovante do cartão, por exemplo.
        </p>
        {anexos.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {anexos.map((x, i) => (
              <li key={i}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600">
                <span aria-hidden>{iconeAnexo(x.type || "application/octet-stream")}</span>
                <span className="max-w-[12rem] truncate">{x.name}</span>
                <span className="tabular-nums text-gray-400">{formatarBytes(x.size)}</span>
              </li>
            ))}
          </ul>
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
          Lançar
        </button>
      </div>
    </div>
  );
}

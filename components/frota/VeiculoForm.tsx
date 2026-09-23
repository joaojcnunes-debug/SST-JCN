"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Camera, Loader2, Save, X } from "lucide-react";
import StorageImg from "@/components/ui/StorageImg";
import { useUnidades } from "@/lib/hooks/useUnidades";
import { useCurrentUser, useIsAdmin } from "@/lib/hooks/useUsuario";
import {
  useAtualizarVeiculo,
  useCriarVeiculo,
  type VeiculoInput,
} from "@/lib/hooks/useFrotaVeiculos";
import { erroPlaca, formatarPlaca, normalizarPlaca } from "@/lib/frota/placa";
import { formatarKm } from "@/lib/frota/km";
import { anosVeiculo, avisoAnosVeiculo, erroAnosVeiculo } from "@/lib/frota/ano";
import { apenasDigitos } from "@/lib/frota/numero";
import {
  ROTULO_STATUS_VEICULO,
  ROTULO_TIPO_VEICULO,
  STATUS_VEICULO,
  TIPOS_VEICULO,
  type FrotaVeiculo,
} from "@/lib/frota/tipos";
import { cn } from "@/lib/utils";

/**
 * Cadastro e edição de veículo.
 *
 * DUAS COISAS SÓ ACONTECEM NO CADASTRO, e a tela deixa isso explícito em vez de
 * esconder:
 *   • `avarias_padrao` — as avarias que já existem. É a linha de base contra a
 *     qual toda saída futura é comparada.
 *   • `km_cadastro` — gravado uma vez e nunca mais alterado. Na edição o campo
 *     aparece travado, com o motivo ao lado.
 */

type Props = { veiculo?: FrotaVeiculo };

const rotulo = "block text-xs font-medium text-gray-600";
const campo =
  "mt-1 w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export default function VeiculoForm({ veiculo }: Props) {
  const router = useRouter();
  const editando = !!veiculo;

  const { data: unidades = [] } = useUnidades();
  const user = useCurrentUser();
  const isAdmin = useIsAdmin();

  const criar = useCriarVeiculo();
  const atualizar = useAtualizarVeiculo();
  const salvando = criar.isPending || atualizar.isPending;

  // Só as bases do usuário — a mesma régua da RLS. Oferecer uma base fora do
  // escopo só renderia um insert que o banco recusa.
  const basesVisiveis = useMemo(() => {
    const meus = new Set(user?.unidades ?? []);
    return isAdmin ? unidades : unidades.filter((u) => meus.has(u.id_unidade));
  }, [unidades, user, isAdmin]);

  const [f, setF] = useState({
    placa: veiculo?.placa ?? "",
    modelo: veiculo?.modelo ?? "",
    marca: veiculo?.marca ?? "",
    ano_fabricacao: veiculo?.ano_fabricacao?.toString() ?? "",
    ano_modelo: veiculo?.ano_modelo?.toString() ?? "",
    cor: veiculo?.cor ?? "",
    renavam: veiculo?.renavam ?? "",
    chassi: veiculo?.chassi ?? "",
    tipo: veiculo?.tipo ?? "",
    avarias_padrao: veiculo?.avarias_padrao ?? "",
    observacoes: veiculo?.observacoes ?? "",
    km_cadastro: veiculo?.km_cadastro?.toString() ?? "",
    status: veiculo?.status ?? "ATIVO",
    id_unidade: veiculo?.id_unidade ?? "",
  });

  const [capa, setCapa] = useState<File | null>(null);
  const [tentouSalvar, setTentouSalvar] = useState(false);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((atual) => ({ ...atual, [k]: v }));

  const previaCapa = useMemo(() => (capa ? URL.createObjectURL(capa) : null), [capa]);

  /**
   * A lista de anos, MAIS o que já estiver gravado neste veículo fora dela.
   *
   * Sem esse acréscimo a edição seria destrutiva em silêncio: um veículo que
   * ficou com `-1` ou `8` gravado pela versão anterior do campo (ou um 1968
   * legítimo, abaixo do piso) abriria o select em "—", e o primeiro Salvar
   * apagaria o valor sem ninguém pedir. Aparecendo na lista, o número errado
   * fica visível para ser corrigido — que é o ponto.
   */
  const anos = useMemo(() => {
    const lista = anosVeiculo();
    const gravados = [veiculo?.ano_fabricacao, veiculo?.ano_modelo]
      .filter((a): a is number => a != null && !lista.includes(a));
    return gravados.length === 0
      ? lista
      : [...new Set([...gravados, ...lista])].sort((a, b) => b - a);
  }, [veiculo]);
  const anoFabNum = f.ano_fabricacao ? Number(f.ano_fabricacao) : null;
  const anoModNum = f.ano_modelo ? Number(f.ano_modelo) : null;
  const avisoAnos = avisoAnosVeiculo(anoFabNum, anoModNum);

  const erros = {
    placa: erroPlaca(f.placa),
    modelo: f.modelo.trim() ? null : "Informe o modelo.",
    id_unidade: f.id_unidade ? null : "Escolha a base.",
    anos: erroAnosVeiculo(anoFabNum, anoModNum),
    km_cadastro: editando
      ? null
      : f.km_cadastro.trim() === ""
        ? "Informe o km de hoje."
        : Number(f.km_cadastro) >= 0
          ? null
          : "Km inválido.",
  };
  const temErro = Object.values(erros).some(Boolean);

  async function salvar() {
    setTentouSalvar(true);
    if (temErro) return;

    const base: VeiculoInput = {
      id_unidade: f.id_unidade,
      placa: formatarPlaca(f.placa),
      modelo: f.modelo.trim(),
      marca: f.marca.trim() || null,
      ano_fabricacao: f.ano_fabricacao ? Number(f.ano_fabricacao) : null,
      ano_modelo: f.ano_modelo ? Number(f.ano_modelo) : null,
      cor: f.cor.trim() || null,
      renavam: f.renavam.trim() || null,
      chassi: f.chassi.trim() || null,
      tipo: f.tipo ? (f.tipo as VeiculoInput["tipo"]) : null,
      avarias_padrao: f.avarias_padrao.trim() || null,
      observacoes: f.observacoes.trim() || null,
      // Na edição o km do cadastro é o que já está gravado: o campo é travado,
      // mas o valor precisa ir para não virar null num update parcial.
      km_cadastro: editando ? veiculo!.km_cadastro : Number(f.km_cadastro),
      status: f.status as VeiculoInput["status"],
    };

    try {
      if (editando) {
        await atualizar.mutateAsync({ id_veiculo: veiculo!.id_veiculo, patch: base, capa });
        router.push(`/frota/${veiculo!.id_veiculo}`);
      } else {
        const novo = await criar.mutateAsync({ ...base, capa });
        router.push(`/frota/${novo.id_veiculo}`);
      }
    } catch {
      // O hook já mostrou o toast com a mensagem do banco. Fica na tela para a
      // pessoa corrigir, em vez de navegar e perder o que digitou.
    }
  }

  const mostrarErro = (k: keyof typeof erros) => tentouSalvar && erros[k];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href={editando ? `/frota/${veiculo!.id_veiculo}` : "/frota"}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="size-4" />
          {editando ? formatarPlaca(veiculo!.placa) : "Frota"}
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold text-gray-900">
          {editando ? "Editar veículo" : "Novo veículo"}
        </h1>
        <p className="text-sm text-gray-500">
          {editando
            ? "Placa, modelo e situação. O km do cadastro não muda."
            : "Placa, modelo, a base e o km de hoje. O resto é opcional."}
        </p>
      </div>

      {/* ── Identificação ─────────────────────────────────── */}
      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Identificação</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={rotulo} htmlFor="placa">
              Placa <span className="text-red-500">*</span>
            </label>
            <input
              id="placa"
              value={f.placa}
              onChange={(e) => set("placa", e.target.value.toUpperCase())}
              onBlur={() => f.placa && set("placa", formatarPlaca(f.placa))}
              placeholder="ABC1D23 ou ABC1234"
              maxLength={10}
              className={cn(
                campo,
                "font-mono font-bold tracking-widest",
                mostrarErro("placa") && "border-red-400",
              )}
            />
            {mostrarErro("placa") ? (
              <p className="mt-1 text-xs text-red-600">{erros.placa}</p>
            ) : (
              <p className="mt-1 text-xs text-gray-400">
                {normalizarPlaca(f.placa).length === 7
                  ? "Mercosul e antiga são aceitas."
                  : "Mercosul (ABC1D23) ou antiga (ABC1234)."}
              </p>
            )}
          </div>

          <div>
            <label className={rotulo} htmlFor="modelo">
              Modelo <span className="text-red-500">*</span>
            </label>
            <input
              id="modelo"
              value={f.modelo}
              onChange={(e) => set("modelo", e.target.value)}
              placeholder="Fiorino Endurance 1.4"
              className={cn(campo, mostrarErro("modelo") && "border-red-400")}
            />
            {mostrarErro("modelo") && (
              <p className="mt-1 text-xs text-red-600">{erros.modelo}</p>
            )}
          </div>

          <div>
            <label className={rotulo} htmlFor="marca">Marca</label>
            <input id="marca" value={f.marca} onChange={(e) => set("marca", e.target.value)}
              placeholder="Fiat" className={campo} />
          </div>

          <div>
            <label className={rotulo} htmlFor="tipo">Tipo</label>
            <select id="tipo" value={f.tipo} onChange={(e) => set("tipo", e.target.value)} className={campo}>
              <option value="">—</option>
              {TIPOS_VEICULO.map((t) => (
                <option key={t} value={t}>{ROTULO_TIPO_VEICULO[t]}</option>
              ))}
            </select>
          </div>

          {/* Lista fechada, não campo numérico: o `type="number"` que estava
              aqui gravava -1 e 8 (a contagem de cliques nas setinhas) e mudava
              o ano quando a roda do mouse passava por cima. Ver lib/frota/ano.ts. */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rotulo} htmlFor="ano_fab">Ano fabricação</label>
              <select id="ano_fab" value={f.ano_fabricacao}
                onChange={(e) => set("ano_fabricacao", e.target.value)}
                className={cn(campo, "tabular-nums", mostrarErro("anos") && "border-red-400")}>
                <option value="">—</option>
                {anos.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className={rotulo} htmlFor="ano_mod">Ano modelo</label>
              <select id="ano_mod" value={f.ano_modelo}
                onChange={(e) => set("ano_modelo", e.target.value)}
                className={cn(campo, "tabular-nums", mostrarErro("anos") && "border-red-400")}>
                <option value="">—</option>
                {anos.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            {mostrarErro("anos") ? (
              <p className="col-span-2 text-xs text-red-600">{erros.anos}</p>
            ) : avisoAnos ? (
              <p className="col-span-2 text-xs text-amber-700">{avisoAnos}</p>
            ) : null}
          </div>

          <div>
            <label className={rotulo} htmlFor="cor">Cor</label>
            <input id="cor" value={f.cor} onChange={(e) => set("cor", e.target.value)}
              placeholder="Branca" className={campo} />
          </div>

          <div>
            <label className={rotulo} htmlFor="renavam">Renavam</label>
            <input id="renavam" value={f.renavam} onChange={(e) => set("renavam", e.target.value)}
              className={cn(campo, "tabular-nums")} />
          </div>

          <div>
            <label className={rotulo} htmlFor="chassi">Chassi</label>
            <input id="chassi" value={f.chassi} onChange={(e) => set("chassi", e.target.value)}
              className={cn(campo, "font-mono text-xs")} />
          </div>
        </div>
      </section>

      {/* ── Base, km e situação ───────────────────────────── */}
      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Base, km e situação</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={rotulo} htmlFor="base">
              Base <span className="text-red-500">*</span>
            </label>
            <select id="base" value={f.id_unidade} onChange={(e) => set("id_unidade", e.target.value)}
              className={cn(campo, mostrarErro("id_unidade") && "border-red-400")}>
              <option value="">Escolha…</option>
              {basesVisiveis.map((u) => (
                <option key={u.id_unidade} value={u.id_unidade}>{u.nome}</option>
              ))}
            </select>
            {mostrarErro("id_unidade") && (
              <p className="mt-1 text-xs text-red-600">{erros.id_unidade}</p>
            )}
          </div>

          <div>
            <label className={rotulo} htmlFor="km_cad">
              Km do cadastro {!editando && <span className="text-red-500">*</span>}
            </label>
            {editando ? (
              <>
                <input
                  id="km_cad"
                  value={formatarKm(veiculo!.km_cadastro)}
                  disabled
                  className={cn(campo, "tabular-nums bg-gray-50 text-gray-500")}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Gravado uma vez. Sem ele, o rodado perde a referência.
                </p>
              </>
            ) : (
              <>
                {/* Sem `type="number"`: o mesmo controle que gravava -1 e 8 nos
                    campos de ano gravaria aqui um km de -1. E este campo é
                    gravado UMA vez e nunca mais alterado — errar nele estraga o
                    rodado do veículo para sempre. Ver lib/frota/numero.ts. */}
                <input
                  id="km_cad"
                  inputMode="numeric"
                  value={f.km_cadastro}
                  onChange={(e) => set("km_cadastro", apenasDigitos(e.target.value))}
                  placeholder="84210"
                  className={cn(campo, "tabular-nums", mostrarErro("km_cadastro") && "border-red-400")}
                />
                {mostrarErro("km_cadastro") ? (
                  <p className="mt-1 text-xs text-red-600">{erros.km_cadastro}</p>
                ) : (
                  <p className="mt-1 text-xs text-gray-400">O odômetro hoje. Não muda depois.</p>
                )}
              </>
            )}
          </div>

          <div>
            <label className={rotulo} htmlFor="status">Situação</label>
            <select id="status" value={f.status} onChange={(e) => set("status", e.target.value as typeof f.status)}
              className={campo}>
              {STATUS_VEICULO.map((s) => (
                <option key={s} value={s}>{ROTULO_STATUS_VEICULO[s]}</option>
              ))}
            </select>
          </div>
        </div>

        {editando && veiculo!.km_atual != null && (
          <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
            Registro atual: <strong className="tabular-nums">{formatarKm(veiculo!.km_atual)} km</strong>
            {" — sobe sozinho pelas saídas e abastecimentos, nunca por aqui."}
          </p>
        )}
      </section>

      {/* ── Avarias padrão ────────────────────────────────── */}
      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Avarias que já existem</h2>
          <p className="text-xs text-gray-500">
            A linha de base da lataria. O que já estava amassado, riscado ou trincado{" "}
            <strong>antes</strong> de qualquer saída. Toda saída mostra este texto ao condutor e
            registra à parte o que ele encontrar — é o que permite saber o que é novo.
          </p>
        </div>
        <textarea
          value={f.avarias_padrao}
          onChange={(e) => set("avarias_padrao", e.target.value)}
          rows={3}
          placeholder="Risco na porta traseira direita. Para-choque dianteiro com marca de estacionamento. Trinco do vidro esquerdo folgado."
          className={campo}
        />

        <div>
          <label className={rotulo} htmlFor="obs">Observações gerais</label>
          <textarea id="obs" value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)}
            rows={2} placeholder="Revisão em dia até 90.000 km. Chave reserva na base." className={campo} />
        </div>
      </section>

      {/* ── Foto de capa ──────────────────────────────────── */}
      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Foto de capa</h2>
          <p className="text-xs text-gray-500">
            É a imagem que aparece na lista. Reduzida no navegador antes de subir.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="size-20 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
            {previaCapa ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previaCapa} alt="Pré-visualização da capa" className="size-full object-cover" />
            ) : veiculo?.foto_capa_thumb_path ? (
              <StorageImg
                stored={veiculo.foto_capa_thumb_path}
                alt="Capa atual"
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-gray-300">
                <Camera className="size-6" />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <Camera className="size-4" />
              {capa || veiculo?.foto_capa_thumb_path ? "Trocar foto" : "Escolher foto"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setCapa(e.target.files?.[0] ?? null)}
              />
            </label>
            {capa && (
              <button
                type="button"
                onClick={() => setCapa(null)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-2 text-sm text-gray-500 hover:bg-gray-50"
              >
                <X className="size-3.5" />
                {capa.name.length > 22 ? `${capa.name.slice(0, 20)}…` : capa.name}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Ações ─────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-2 pb-4">
        <Link
          href={editando ? `/frota/${veiculo!.id_veiculo}` : "/frota"}
          className="rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          Cancelar
        </Link>
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {editando ? "Salvar" : "Cadastrar veículo"}
        </button>
      </div>
    </div>
  );
}

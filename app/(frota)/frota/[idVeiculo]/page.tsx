"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  ClipboardCheck,
  Fuel,
  History,
  Images,
  Info,
  Pencil,
  Trash2,
  TriangleAlert,
  Undo2,
  Wrench,
} from "lucide-react";
import StorageImg from "@/components/ui/StorageImg";
import GaleriaFotos from "@/components/frota/GaleriaFotos";
import SinistrosTab from "@/components/frota/SinistrosTab";
import AbastecimentosTab from "@/components/frota/AbastecimentosTab";
import HistoricoTab from "@/components/frota/HistoricoTab";
import ManutencoesTab from "@/components/frota/ManutencoesTab";
import RegistrarLotacaoModal from "@/components/frota/RegistrarLotacaoModal";
import RegistrarRetornoModal from "@/components/frota/RegistrarRetornoModal";
import {
  descreverDependencias,
  useDependenciasVeiculo,
  useExcluirVeiculo,
  useFrotaVeiculo,
} from "@/lib/hooks/useFrotaVeiculos";
import { useChecklistsDoVeiculo } from "@/lib/hooks/useFrotaChecklists";
import { useSinistrosDoVeiculo } from "@/lib/hooks/useFrotaSinistros";
import { useAbastecimentosDoVeiculo } from "@/lib/hooks/useFrotaAbastecimentos";
import { useManutencoesDoVeiculo } from "@/lib/hooks/useFrotaManutencoes";
import { useGaleriaTotal } from "@/lib/hooks/useFrotaGaleria";
import { useUnidades } from "@/lib/hooks/useUnidades";
import { formatarPlaca } from "@/lib/frota/placa";
import { formatarKm, kmEfetivo, kmRodadoDesdeCadastro, lerOrigemKm, ROTULO_ORIGEM_KM } from "@/lib/frota/km";
import { enderecoEmLinha, linkMaps } from "@/lib/frota/maps";
import { dataHoraBr, diasEntre, manutencaoEstaAberta } from "@/lib/frota/painel";
import {
  ROTULO_STATUS_VEICULO,
  ROTULO_TIPO_VEICULO,
  type FrotaChecklist,
  type FrotaVeiculo,
  type StatusVeiculo,
} from "@/lib/frota/tipos";
import { cn } from "@/lib/utils";

/**
 * Ficha do veículo.
 *
 * Nasceu com cinco abas (v177) e ganhou duas na v178:
 *   • HISTÓRICO — a linha do tempo do carro, que é a pergunta que o gestor faz
 *     de verdade e que nenhuma das outras respondia sozinha;
 *   • MANUTENÇÃO — o que sempre esteve por trás da situação 'Em manutenção'.
 *
 * O cabeçalho também mudou: ele agora diz onde o carro ESTÁ, não só como ele
 * está cadastrado. São coisas diferentes, e a diferença entre as duas é
 * justamente o que o painel aponta como divergência.
 */

const STATUS_CORES: Record<StatusVeiculo, string> = {
  ATIVO: "bg-emerald-100 text-emerald-700",
  MANUTENCAO: "bg-amber-100 text-amber-700",
  INATIVO: "bg-gray-100 text-gray-600",
  VENDIDO: "bg-red-100 text-red-700",
};

type Aba =
  | "geral"
  | "historico"
  | "fotos"
  | "sinistros"
  | "abastecimentos"
  | "manutencao"
  | "saidas";

export default function VeiculoPage({ params }: { params: Promise<{ idVeiculo: string }> }) {
  const { idVeiculo } = use(params);
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("geral");

  const { data: veiculo, isLoading } = useFrotaVeiculo(idVeiculo);
  const { data: unidades = [] } = useUnidades();
  const { data: saidas = [] } = useChecklistsDoVeiculo(idVeiculo);
  const { data: sinistros = [] } = useSinistrosDoVeiculo(idVeiculo);
  const { data: abastecimentos = [] } = useAbastecimentosDoVeiculo(idVeiculo);
  const { data: manutencoes = [] } = useManutencoesDoVeiculo(idVeiculo);
  const { data: totalFotos = 0 } = useGaleriaTotal(idVeiculo);
  const { data: dependencias } = useDependenciasVeiculo(idVeiculo);
  const excluir = useExcluirVeiculo();

  const [mudandoBase, setMudandoBase] = useState(false);
  const [fechandoViagem, setFechandoViagem] = useState<FrotaChecklist | null>(null);

  if (isLoading) {
    return <p className="py-12 text-center text-sm text-gray-500">Carregando…</p>;
  }

  if (!veiculo) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-dashed border-gray-300 bg-white py-16 text-center">
        <p className="text-sm font-medium text-gray-700">Veículo não encontrado</p>
        <p className="mt-1 text-sm text-gray-500">
          Ele pode ter sido movido para a lixeira, ou estar em uma base fora do seu acesso.
        </p>
        <Link href="/frota"
          className="mt-4 inline-block rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Voltar para a frota
        </Link>
      </div>
    );
  }

  const base = unidades.find((u) => u.id_unidade === veiculo.id_unidade)?.nome ?? "—";

  // Onde o carro ESTÁ agora, que não é a mesma coisa que a situação cadastrada.
  // A viagem em aberto é a finalizada sem retorno — rascunho não conta, porque
  // rascunho é formulário abandonado, não carro na rua.
  const viagemAberta =
    saidas.find((s) => s.status === "FINALIZADO" && !s.data_retorno) ?? null;
  const manutencaoAberta = manutencoes.find(manutencaoEstaAberta) ?? null;

  const abas: Array<{ id: Aba; label: string; contador?: number; icone: typeof Info }> = [
    { id: "geral", label: "Visão geral", icone: Info },
    { id: "historico", label: "Histórico", icone: History },
    { id: "saidas", label: "Saídas", contador: saidas.length, icone: ClipboardCheck },
    { id: "manutencao", label: "Manutenção", contador: manutencoes.length, icone: Wrench },
    { id: "abastecimentos", label: "Abastecimentos", contador: abastecimentos.length, icone: Fuel },
    { id: "sinistros", label: "Sinistros", contador: sinistros.length, icone: TriangleAlert },
    { id: "fotos", label: "Fotos", contador: totalFotos, icone: Images },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link href="/frota" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="size-4" />
        Frota
      </Link>

      {/* ── Cabeçalho ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-start gap-4 rounded-lg border border-gray-200 bg-white p-4">
        <div className="size-20 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
          {veiculo.foto_capa_thumb_path ? (
            <StorageImg stored={veiculo.foto_capa_thumb_path} alt={`Veículo ${veiculo.placa}`}
              className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-gray-300">
              <Images className="size-6" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-xl font-bold tracking-widest text-gray-900">
              {formatarPlaca(veiculo.placa)}
            </h1>
            <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", STATUS_CORES[veiculo.status])}>
              {ROTULO_STATUS_VEICULO[veiculo.status]}
            </span>
          </div>
          <p className="text-sm text-gray-700">{veiculo.modelo}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {[veiculo.marca, veiculo.ano_modelo, veiculo.cor,
              veiculo.tipo ? ROTULO_TIPO_VEICULO[veiculo.tipo] : null, base]
              .filter(Boolean).join(" · ")}
          </p>

          {/* ONDE O CARRO ESTÁ — a informação que a ficha nunca deu. A situação
              acima é a cadastrada; esta é a que a operação produziu. */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {viagemAberta ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-900">
                <ClipboardCheck className="size-3.5" />
                Na rua com <strong>{viagemAberta.condutor_nome}</strong> desde{" "}
                {dataHoraBr(viagemAberta.data_saida)}
                {diasEntre(viagemAberta.data_saida, new Date()) >= 1 &&
                  ` (${diasEntre(viagemAberta.data_saida, new Date())} dias)`}
              </span>
            ) : manutencaoAberta ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                <Wrench className="size-3.5" />
                Na oficina — {manutencaoAberta.descricao.slice(0, 60)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-900">
                <Building2 className="size-3.5" />
                Na base {base}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {viagemAberta ? (
            <button type="button" onClick={() => setFechandoViagem(viagemAberta)}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              <Undo2 className="size-4" />
              Registrar retorno
            </button>
          ) : (
            <Link href={`/frota/${veiculo.id_veiculo}/saida`}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              <ClipboardCheck className="size-4" />
              Registrar saída
            </Link>
          )}
          <button type="button" onClick={() => setMudandoBase(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Building2 className="size-4" />
            Mudar de base
          </button>
          <Link href={`/frota/${veiculo.id_veiculo}/editar`}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Pencil className="size-4" />
            Editar
          </Link>
          {/*
            O Excluir agora sabe se pode. Antes ele SEMPRE chamava a lixeira, e
            num veículo com saída registrada a chave estrangeira derrubava o
            DELETE — o usuário via "Não foi possível excluir" e nada mais. Com a
            contagem em mãos, o botão explica o motivo antes do clique e propõe
            o caminho certo, que é mudar a situação para Vendido ou Inativo.
          */}
          <button type="button" disabled={excluir.isPending}
            title={
              dependencias && dependencias.total > 0
                ? `Tem ${descreverDependencias(dependencias)} no histórico`
                : "Mover para a lixeira"
            }
            onClick={() => {
              if (dependencias && dependencias.total > 0) {
                alert(
                  `${formatarPlaca(veiculo.placa)} não pode ser excluído.\n\n` +
                    `Há ${descreverDependencias(dependencias)} no histórico deste veículo, e é ` +
                    `esse histórico que prova avaria, km rodado e custo.\n\n` +
                    `Para tirar o carro de operação sem perder nada, edite o veículo e mude a ` +
                    `situação para Vendido ou Inativo — ele sai da lista do dia a dia e o ` +
                    `histórico continua consultável.`,
                );
                return;
              }
              if (
                confirm(
                  `Mover o veículo ${formatarPlaca(veiculo.placa)} para a lixeira?\n\n` +
                    `Este cadastro ainda não tem histórico nenhum. Fica registrado quem apagou, ` +
                    `e o veículo pode ser restaurado.`,
                )
              ) {
                excluir.mutate(veiculo.id_veiculo, { onSuccess: () => router.push("/frota") });
              }
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm",
              dependencias && dependencias.total > 0
                ? "border-gray-200 text-gray-400 hover:bg-gray-50"
                : "border-gray-300 text-gray-600 hover:bg-red-50 hover:text-red-700",
            )}>
            <Trash2 className="size-4" />
            Excluir
          </button>
        </div>
      </div>

      {mudandoBase && (
        <RegistrarLotacaoModal aberto idVeiculoInicial={veiculo.id_veiculo}
          onFechar={() => setMudandoBase(false)} />
      )}
      {fechandoViagem && (
        <RegistrarRetornoModal saida={fechandoViagem} placa={veiculo.placa} aberto
          onFechar={() => setFechandoViagem(null)} />
      )}

      {/* ── Abas ──────────────────────────────────────────── */}
      <div className="flex gap-0 overflow-x-auto border-b border-gray-200">
        {abas.map((a) => (
          <button key={a.id} type="button" onClick={() => setAba(a.id)}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm",
              aba === a.id
                ? "border-blue-600 font-semibold text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-800",
            )}>
            <a.icone className="size-4" />
            {a.label}
            {a.contador != null && a.contador > 0 && (
              <span className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[10px] tabular-nums text-gray-500">
                {a.contador}
              </span>
            )}
          </button>
        ))}
      </div>

      {aba === "geral" && <AbaGeral veiculo={veiculo} />}
      {aba === "historico" && <HistoricoTab veiculo={veiculo} />}
      {aba === "fotos" && <GaleriaFotos idVeiculo={veiculo.id_veiculo} />}
      {aba === "sinistros" && <SinistrosTab idVeiculo={veiculo.id_veiculo} />}
      {aba === "abastecimentos" && <AbastecimentosTab idVeiculo={veiculo.id_veiculo} />}
      {aba === "manutencao" && <ManutencoesTab veiculo={veiculo} />}
      {aba === "saidas" && (
        <AbaSaidas idVeiculo={veiculo.id_veiculo} placa={veiculo.placa} />
      )}
    </div>
  );
}

function AbaGeral({ veiculo }: { veiculo: FrotaVeiculo }) {
  const rodado = kmRodadoDesdeCadastro(veiculo);
  const origem = lerOrigemKm(veiculo.km_atual_origem);

  return (
    <div className="space-y-3">
      {/* Os dois registros de km, o pedido central */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Quilometragem</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-gray-50 p-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500">No cadastro</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-gray-900">
              {formatarKm(veiculo.km_cadastro)}
            </p>
            <p className="text-xs text-gray-400">gravado uma vez</p>
          </div>
          <div className="rounded-md bg-blue-50 p-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-blue-700">Registro atual</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-blue-900">
              {formatarKm(kmEfetivo(veiculo))}
            </p>
            <p className="text-xs text-blue-700/70">
              {veiculo.km_atual_em
                ? `atualizado em ${new Date(veiculo.km_atual_em).toLocaleDateString("pt-BR")}${
                    origem ? ` pela ${ROTULO_ORIGEM_KM[origem.origem]}` : ""
                  }`
                : "sem atualização ainda"}
            </p>
          </div>
          <div className="rounded-md bg-gray-50 p-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500">Rodado desde o cadastro</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-gray-900">
              {rodado > 0 ? `+${formatarKm(rodado)}` : "—"}
            </p>
            <p className="text-xs text-gray-400">calculado, não digitado</p>
          </div>
        </div>
      </section>

      {/* Avarias padrão — a linha de base */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Avarias que já existem</h2>
        <p className="text-xs text-gray-500">
          A linha de base da lataria, preenchida no cadastro. Toda saída compara com isto.
        </p>
        <p className="mt-2 whitespace-pre-line text-sm text-gray-700">
          {veiculo.avarias_padrao?.trim() || (
            <span className="text-gray-400">Nenhuma avaria registrada no cadastro.</span>
          )}
        </p>
      </section>

      {/*
        A ficha do veículo, SEMPRE visível.
        Antes esta seção só aparecia quando havia renavam, chassi ou observação —
        e um cadastro incompleto ficava sem nenhum lugar que mostrasse o que
        falta. Campo vazio agora aparece como "—", que é informação: quem
        precisa do renavam descobre que ele não foi cadastrado, em vez de
        procurar numa seção que não existe.
      */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Documentação e ficha</h2>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Campo titulo="Renavam" valor={veiculo.renavam} mono />
          <Campo titulo="Chassi" valor={veiculo.chassi} mono />
          <Campo titulo="Ano de fabricação" valor={veiculo.ano_fabricacao} />
          <Campo titulo="Ano do modelo" valor={veiculo.ano_modelo} />
          <Campo titulo="Marca" valor={veiculo.marca} />
          <Campo titulo="Cor" valor={veiculo.cor} />
          <Campo titulo="Tipo" valor={veiculo.tipo ? ROTULO_TIPO_VEICULO[veiculo.tipo] : null} />
          <Campo titulo="Cadastrado em"
            valor={new Date(veiculo.criado_em).toLocaleDateString("pt-BR")} />
        </dl>
        {veiculo.observacoes && (
          <p className="mt-3 whitespace-pre-line border-t border-gray-100 pt-3 text-sm text-gray-700">
            {veiculo.observacoes}
          </p>
        )}
      </section>
    </div>
  );
}

/** Um campo da ficha. Vazio vira "—" em vez de sumir: ausência é informação. */
function Campo({
  titulo, valor, mono,
}: {
  titulo: string; valor: string | number | null | undefined; mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{titulo}</dt>
      <dd className={cn(
        valor == null || valor === "" ? "text-gray-300" : "text-gray-800",
        mono ? "font-mono text-xs" : "tabular-nums",
      )}>
        {valor == null || valor === "" ? "—" : valor}
      </dd>
    </div>
  );
}

function AbaSaidas({ idVeiculo, placa }: { idVeiculo: string; placa: string }) {
  const { data: saidas = [], isLoading } = useChecklistsDoVeiculo(idVeiculo);
  const [fechando, setFechando] = useState<FrotaChecklist | null>(null);

  if (isLoading) return <p className="py-10 text-center text-sm text-gray-500">Carregando…</p>;

  if (saidas.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white py-14 text-center">
        <ClipboardCheck className="mx-auto size-7 text-gray-300" />
        <p className="mt-2 text-sm font-medium text-gray-700">Nenhuma saída registrada</p>
        <p className="mt-1 text-sm text-gray-500">
          A saída pede quatro fotos do veículo e o destino.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {saidas.map((s) => {
          const url = linkMaps(s);
          const naRua = s.status === "FINALIZADO" && !s.data_retorno;
          const rodado =
            s.data_retorno && s.km_retorno != null ? s.km_retorno - s.km_saida : null;

          return (
            <li key={s.id_checklist}
              className={cn(
                "rounded-lg border bg-white p-3",
                naRua ? "border-blue-200" : "border-gray-200",
              )}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/frota/${idVeiculo}/saida/${s.id_checklist}`}
                      className="text-sm font-semibold text-gray-900 hover:text-blue-700">
                      {s.condutor_nome}
                    </Link>
                    {s.status === "RASCUNHO" ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
                        rascunho
                      </span>
                    ) : naRua ? (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">
                        ainda na rua
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                        voltou
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">{enderecoEmLinha(s) || "sem destino"}</p>
                  {s.avarias_retorno && (
                    <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                      Na volta: {s.avarias_retorno}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-xs tabular-nums text-gray-500">
                    {new Date(s.data_saida).toLocaleDateString("pt-BR")} · {formatarKm(s.km_saida)} km
                  </p>
                  {s.data_retorno && (
                    <p className="font-mono text-xs tabular-nums text-gray-400">
                      voltou {new Date(s.data_retorno).toLocaleDateString("pt-BR")}
                      {rodado != null && ` · ${formatarKm(rodado)} km rodados`}
                    </p>
                  )}
                  {naRua && (
                    <button type="button" onClick={() => setFechando(s)}
                      className="mt-1 inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">
                      <Undo2 className="size-3" />
                      Registrar retorno
                    </button>
                  )}
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      className="mt-1 block text-xs font-medium text-emerald-700 hover:underline">
                      ↗ Abrir rota no Maps
                    </a>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {fechando && (
        <RegistrarRetornoModal saida={fechando} placa={placa} aberto
          onFechar={() => setFechando(null)} />
      )}
    </>
  );
}

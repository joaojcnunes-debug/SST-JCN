"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  MapPin,
  Route,
  Search,
  Undo2,
} from "lucide-react";
import DetalheViagemModal from "@/components/frota/DetalheViagemModal";
import RegistrarLotacaoModal from "@/components/frota/RegistrarLotacaoModal";
import RegistrarRetornoModal from "@/components/frota/RegistrarRetornoModal";
import { useChecklists } from "@/lib/hooks/useFrotaChecklists";
import { useLotacoes } from "@/lib/hooks/useFrotaLotacoes";
import { useFrotaVeiculosLista } from "@/lib/hooks/useFrotaVeiculos";
import { useUnidades } from "@/lib/hooks/useUnidades";
import { formatarPlaca } from "@/lib/frota/placa";
import { formatarKm } from "@/lib/frota/km";
import { enderecoEmLinha } from "@/lib/frota/maps";
import { dataHoraBr, diasEntre } from "@/lib/frota/painel";
import type { FrotaChecklist } from "@/lib/frota/tipos";
import { buscar } from "@/lib/busca/texto";
import AvisoBuscaAproximada from "@/components/ui/AvisoBuscaAproximada";
import { cn } from "@/lib/utils";

/**
 * MOVIMENTAÇÃO — tudo que tirou um veículo do lugar, num lugar só.
 *
 * São duas coisas diferentes, e a tela não as mistura numa lista única de
 * propósito:
 *
 *   • VIAGEM (aba Viagens) — a saída registrada com as quatro fotos, que agora
 *     tem volta. Aqui é onde o gestor fecha o que ficou aberto: a coluna da
 *     direita ou mostra o retorno, ou mostra há quantos dias o carro está fora
 *     com um botão para encerrar.
 *
 *   • MUDANÇA DE BASE (aba Bases) — o veículo passa a pertencer a outra
 *     unidade. Evento raro, de outra natureza, com outros campos.
 *
 * Juntar as duas numa linha do tempo só pareceria mais moderno e seria pior:
 * quem abre esta tela está fazendo uma das duas coisas, nunca as duas ao mesmo
 * tempo. A linha do tempo unificada existe — mas na ficha do VEÍCULO, que é
 * onde a pergunta é "o que já aconteceu com este carro".
 *
 * ESTA TELA ABSORVEU /frota/saidas (decisão dele, 2026-08-18)
 *   As duas liam o mesmo `useChecklists()`, com a mesma busca e o mesmo card.
 *   A antiga listava rascunho e não sabia nada de retorno; esta sabia do
 *   retorno e escondia rascunho. Em vez de duas telas meio certas, a aba
 *   Viagens ganhou o filtro "Rascunhos" e o endereço antigo passou a
 *   redirecionar para cá.
 */

type Aba = "viagens" | "bases";
type FiltroViagem = "ABERTAS" | "FECHADAS" | "RASCUNHOS" | "TODAS";

export default function MovimentacoesPage() {
  const [aba, setAba] = useState<Aba>("viagens");
  const [abrindoLotacao, setAbrindoLotacao] = useState(false);

  const { data: veiculos = [] } = useFrotaVeiculosLista();

  const placaDe = useMemo(() => {
    const m = new Map(veiculos.map((v) => [v.id_veiculo, v.placa]));
    return (id: string) => formatarPlaca(m.get(id) ?? "—");
  }, [veiculos]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Movimentação de veículos</h1>
          <p className="text-sm text-gray-500">
            As viagens que saíram e voltaram, e as mudanças de base.
          </p>
        </div>
        <button type="button" onClick={() => setAbrindoLotacao(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          <Building2 className="size-4" />
          Registrar mudança de base
        </button>
      </div>

      <div className="flex gap-0 border-b border-gray-200">
        {([
          ["viagens", "Viagens", Route],
          ["bases", "Mudanças de base", Building2],
        ] as const).map(([id, label, Icone]) => (
          <button key={id} type="button" onClick={() => setAba(id)}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm",
              aba === id
                ? "border-blue-600 font-semibold text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-800",
            )}>
            <Icone className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {aba === "viagens" ? <AbaViagens placaDe={placaDe} /> : <AbaBases placaDe={placaDe} />}

      {abrindoLotacao && (
        <RegistrarLotacaoModal aberto onFechar={() => setAbrindoLotacao(false)} />
      )}
    </div>
  );
}

// ─── Viagens ────────────────────────────────────────────────────────────────

function AbaViagens({ placaDe }: { placaDe: (id: string) => string }) {
  const { data: saidas = [], isLoading } = useChecklists();
  const [filtro, setFiltro] = useState<FiltroViagem>("ABERTAS");
  const [busca, setBusca] = useState("");
  const [fechando, setFechando] = useState<FrotaChecklist | null>(null);
  const [abrindo, setAbrindo] = useState<FrotaChecklist | null>(null);
  const [hoje] = useState(() => new Date());

  const { itens: lista, aproximado } = useMemo(() => {
    const doFiltro = saidas.filter((s) => {
      // Rascunho é registro que ninguém terminou — não é viagem. Ele aparece
      // só no filtro próprio, e some dos outros três: quem pergunta "quem está
      // na rua" não quer contar carro cuja saída nem foi finalizada.
      if (filtro === "RASCUNHOS") return s.status === "RASCUNHO";
      if (s.status !== "FINALIZADO") return false;
      if (filtro === "ABERTAS" && s.data_retorno) return false;
      if (filtro === "FECHADAS" && !s.data_retorno) return false;
      return true;
    });
    // A placa entra SEM separador ("rjp2a45" acha "RJP-2A45"). Condutor e
    // endereço tolerantes a acento e erro de digitação; mantém a ordem por data.
    return buscar(
      doFiltro,
      busca,
      (s) => [
        placaDe(s.id_veiculo).replace(/[^a-z0-9]/gi, ""),
        s.condutor_nome,
        s.endereco_cidade,
        s.endereco_logradouro,
      ],
      { manterOrdem: true },
    );
  }, [saidas, filtro, busca, placaDe]);

  const abertas = saidas.filter((s) => s.status === "FINALIZADO" && !s.data_retorno).length;
  const rascunhos = saidas.filter((s) => s.status === "RASCUNHO").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Placa, condutor, cidade…"
            className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div className="flex overflow-hidden rounded-md border border-gray-300">
          {([
            ["ABERTAS", `Na rua${abertas > 0 ? ` (${abertas})` : ""}`],
            ["FECHADAS", "Voltaram"],
            ["RASCUNHOS", `Rascunhos${rascunhos > 0 ? ` (${rascunhos})` : ""}`],
            ["TODAS", "Todas"],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFiltro(id)}
              className={cn(
                "px-3 py-2 text-sm",
                filtro === id
                  ? "bg-blue-600 font-semibold text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50",
              )}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-gray-500">Carregando…</p>
      ) : lista.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white py-14 text-center">
          <Route className="mx-auto size-7 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">
            {filtro === "ABERTAS"
              ? "Nenhum veículo na rua"
              : filtro === "RASCUNHOS"
                ? "Nenhuma saída pela metade"
                : "Nenhuma viagem aqui"}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {filtro === "ABERTAS"
              ? "Toda viagem registrada já voltou."
              : filtro === "RASCUNHOS"
                ? "Toda saída começada foi finalizada com as quatro fotos."
                : "A viagem começa pela saída, no card do veículo."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {aproximado && (
            <li>
              <AvisoBuscaAproximada aproximado={aproximado} busca={busca} total={lista.length} />
            </li>
          )}
          {lista.map((s) => {
            const rascunho = s.status === "RASCUNHO";
            const dias = s.data_retorno || rascunho ? null : diasEntre(s.data_saida, hoje);
            const rodado =
              s.data_retorno && s.km_retorno != null ? s.km_retorno - s.km_saida : null;

            return (
              <li key={s.id_checklist}
                className={cn(
                  "rounded-lg border bg-white p-3",
                  rascunho
                    ? "border-amber-300"
                    : s.data_retorno
                      ? "border-gray-200"
                      : "border-blue-200",
                )}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {/* A CAIXA INTEIRA é o que abre a viagem, não só a placa —
                      pedido dele: o alvo é a área de dados, e um alvo do
                      tamanho de uma placa é alvo de mouse, não de dedo.
                      Rascunho leva ao assistente (é formulário por terminar);
                      viagem finalizada abre o modal, que devolve para esta
                      mesma linha da lista sem perder busca nem rolagem. */}
                  <CaixaDaViagem
                    rascunho={rascunho}
                    href={`/frota/${s.id_veiculo}/saida/${s.id_checklist}`}
                    onAbrir={() => setAbrindo(s)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold tracking-wider text-gray-900 group-hover:text-blue-700">
                        {placaDe(s.id_veiculo)}
                      </span>
                      <span className="text-sm text-gray-700">{s.condutor_nome}</span>
                      {rascunho ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
                          rascunho
                        </span>
                      ) : s.data_retorno ? (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                          voltou
                        </span>
                      ) : (
                        <span className={cn(
                          "rounded px-1.5 py-0.5 text-[11px] font-semibold",
                          (dias ?? 0) >= 3
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700",
                        )}>
                          na rua{(dias ?? 0) >= 1 ? ` há ${dias} ${dias === 1 ? "dia" : "dias"}` : ""}
                        </span>
                      )}
                    </div>

                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-gray-500">
                      <MapPin className="size-3 shrink-0" />
                      {enderecoEmLinha(s) || "sem destino registrado"}
                    </p>

                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-gray-400">
                      <span>{dataHoraBr(s.data_saida)}</span>
                      <span className="tabular-nums">{formatarKm(s.km_saida)} km</span>
                      {s.data_retorno && (
                        <>
                          <ArrowRight className="size-3" />
                          <span>{dataHoraBr(s.data_retorno)}</span>
                          {s.km_retorno != null && (
                            <span className="tabular-nums">{formatarKm(s.km_retorno)} km</span>
                          )}
                        </>
                      )}
                    </p>

                    {s.avarias_retorno && (
                      <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                        Na volta: {s.avarias_retorno}
                      </p>
                    )}
                  </CaixaDaViagem>

                  <div className="shrink-0 text-right">
                    {rascunho ? (
                      <Link href={`/frota/${s.id_veiculo}/saida/${s.id_checklist}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800 hover:bg-amber-100">
                        <ClipboardCheck className="size-4" />
                        Continuar o registro
                      </Link>
                    ) : rodado != null ? (
                      <>
                        <p className="text-lg font-bold tabular-nums text-gray-900">
                          {formatarKm(rodado)}
                        </p>
                        <p className="text-[11px] text-gray-400">km na viagem</p>
                      </>
                    ) : s.data_retorno ? (
                      <p className="text-[11px] text-gray-400">voltou sem km</p>
                    ) : (
                      <button type="button" onClick={() => setFechando(s)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100">
                        <Undo2 className="size-4" />
                        Registrar retorno
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {fechando && (
        <RegistrarRetornoModal saida={fechando} placa={placaDe(fechando.id_veiculo)} aberto
          onFechar={() => setFechando(null)} />
      )}

      {abrindo && (
        <DetalheViagemModal saida={abrindo} aberto onFechar={() => setAbrindo(null)} />
      )}
    </div>
  );
}

/**
 * A área de dados do card, clicável inteira.
 *
 * Existe como componente só para não repetir a classe em dois ramos do
 * ternário: `button` quando abre o modal, `Link` quando leva ao assistente do
 * rascunho. O que não pode é ser um `div` com `onClick` — quem navega por
 * teclado não alcançaria a viagem, e o card é o único caminho para ela.
 */
function CaixaDaViagem({
  rascunho,
  href,
  onAbrir,
  children,
}: {
  rascunho: boolean;
  href: string;
  onAbrir: () => void;
  children: React.ReactNode;
}) {
  const cls =
    "group min-w-0 flex-1 rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";
  return rascunho ? (
    <Link href={href} className={cls}>{children}</Link>
  ) : (
    <button type="button" onClick={onAbrir} className={cls}>{children}</button>
  );
}

// ─── Mudanças de base ───────────────────────────────────────────────────────

function AbaBases({ placaDe }: { placaDe: (id: string) => string }) {
  const { data: lotacoes = [], isLoading } = useLotacoes();
  const { data: unidades = [] } = useUnidades();

  const nomeBase = useMemo(() => {
    const m = new Map(unidades.map((u) => [u.id_unidade, u.nome]));
    return (id: string | null) => (id ? m.get(id) ?? "—" : "primeira lotação");
  }, [unidades]);

  if (isLoading) return <p className="py-12 text-center text-sm text-gray-500">Carregando…</p>;

  if (lotacoes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white py-14 text-center">
        <Building2 className="mx-auto size-7 text-gray-300" />
        <p className="mt-2 text-sm font-medium text-gray-700">Nenhuma mudança de base registrada</p>
        <p className="mt-1 text-sm text-gray-500">
          Cada veículo continua na base em que foi cadastrado.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {lotacoes.map((l) => (
        <li key={l.id_lotacao} className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/frota/${l.id_veiculo}`}
                  className="font-mono text-sm font-bold tracking-wider text-gray-900 hover:text-blue-700">
                  {placaDe(l.id_veiculo)}
                </Link>
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                  {nomeBase(l.id_unidade_origem)}
                  <ArrowRight className="size-3.5 text-gray-400" />
                  <strong className="font-semibold">{nomeBase(l.id_unidade_destino)}</strong>
                </span>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                {[l.motivo, l.responsavel_nome && `por ${l.responsavel_nome}`]
                  .filter(Boolean).join(" · ") || "sem motivo registrado"}
              </p>
              {l.observacao && <p className="text-xs text-gray-400">{l.observacao}</p>}
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-xs tabular-nums text-gray-500">
                {dataHoraBr(l.data_movimentacao)}
              </p>
              {l.km_percorrido != null && (
                <p className="text-xs tabular-nums text-gray-400">
                  {formatarKm(l.km_percorrido)} km no trecho
                </p>
              )}
              {l.km_odometro != null && (
                <p className="text-xs tabular-nums text-gray-400">
                  odômetro {formatarKm(l.km_odometro)}
                </p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

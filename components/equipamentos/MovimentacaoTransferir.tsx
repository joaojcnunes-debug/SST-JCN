"use client";

import { useMemo, useState } from "react";
import { Loader2, ArrowLeftRight, Boxes, HardDrive, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  useEquipamentosCatalogo,
  useEquipamentosSaldo,
  useTransferirEstoque,
} from "@/lib/hooks/useEquipamentosEstoque";
import { useEquipamentosCompleto } from "@/lib/hooks/useEquipamentos";
import {
  useCriarTransferenciaEquipamento,
  useUsuariosDestino,
} from "@/lib/hooks/useTransferencias";
import { useCurrentUser, useIsAdmin } from "@/lib/hooks/useUsuario";
import AvisoBuscaAproximada from "@/components/ui/AvisoBuscaAproximada";
import { buscar } from "@/lib/busca/texto";
import { cn } from "@/lib/utils";

/**
 * Registrar transferência entre bases — nos DOIS modelos, na mesma tela.
 *
 * A escolha do modelo não é uma preferência de quem opera: ela vem do item.
 * Computador é ficha individual porque cada um tem suas especificações; fone é
 * quantidade porque dez fones são dez fones. Por isso a tela pergunta primeiro
 * O QUE está sendo transferido, e o resto do formulário se ajusta.
 *
 * ⚠️ O AVISO DA SAÍDA IMEDIATA é a parte que não pode faltar. Como a saída é
 * lançada no registro (e não no aceite), quem registra precisa saber que o
 * material já deixou o saldo da origem naquele instante. Sem esse aviso, a
 * pessoa registra "para ver como fica", desiste, e fica achando que o estoque
 * está errado.
 */

const inputCls =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelCls =
  "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-600";

type Modelo = "quantidade" | "individual";

export default function MovimentacaoTransferir({
  bases,
}: {
  bases: { id_unidade: string; nome: string }[];
}) {
  const { data: catalogo = [] } = useEquipamentosCatalogo();
  const { data: saldo } = useEquipamentosSaldo();
  const transferir = useTransferirEstoque();

  const [modelo, setModelo] = useState<Modelo>("quantidade");
  const [idCatalogo, setIdCatalogo] = useState("");
  const [deUnidade, setDeUnidade] = useState("");
  const [paraUnidade, setParaUnidade] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [paraEmail, setParaEmail] = useState("");
  const [motivo, setMotivo] = useState("");
  const [transportador, setTransportador] = useState("");

  // ── Aparelho identificado ────────────────────────────────────────────────
  // Registro COMPLETO, não a lista enxuta: o termo em PDF guarda um retrato do
  // aparelho (série, plaqueta, fabricante) e a lista da visão geral não traz
  // tudo isso. São ~100 linhas e a consulta só sai quando esta aba é aberta.
  const { data: aparelhos = [], isLoading: carregandoAparelhos } =
    useEquipamentosCompleto(modelo === "individual");
  const criarIndividual = useCriarTransferenciaEquipamento();

  /**
   * ⚠️ OS DOIS MODELOS TÊM RÉGUAS DIFERENTES, E A DIFERENÇA É DO BANCO.
   *
   * Por quantidade passa pela RPC `equipamento_transferir_estoque`, que é
   * `security definer` e cobra `caller_pode_editar` + `caller_pode_equipamentos`
   * — a régua que ele fechou em 11/08 ("quem dá entrada é quem transfere").
   *
   * Aparelho identificado grava direto em `transferencias`, então cai na RLS da
   * v136, que cobra `caller_pode_transferir()` — o módulo `transferencias`. Era
   * exatamente o que a tela antiga já exigia, então isto não é régua nova: é a
   * mesma de sempre, agora dita antes e não depois.
   *
   * Sem esta checagem a pessoa preencheria o formulário inteiro e levaria um
   * erro de permissão no fim — o pior momento possível para descobrir.
   */
  const user = useCurrentUser();
  const isAdmin = useIsAdmin();
  const podeTransferirAparelho =
    isAdmin || (user?.modulos_permitidos ?? []).includes("transferencias");

  const [busca, setBusca] = useState("");
  const [idEquipamento, setIdEquipamento] = useState("");
  const [paraLocal, setParaLocal] = useState("");
  const [paraResponsavel, setParaResponsavel] = useState("");
  const [obs, setObs] = useState("");

  const aparelho = useMemo(
    () => aparelhos.find((e) => e.id_equipamento === idEquipamento) ?? null,
    [aparelhos, idEquipamento]
  );

  const nomeBase = useMemo(
    () => new Map(bases.map((b) => [b.id_unidade, b.nome])),
    [bases]
  );

  const { itens: encontrados, aproximado } = useMemo(() => {
    if (!busca.trim()) return { itens: [], aproximado: false };
    // Busca tolerante (acento, ordem das palavras, erro de digitação), ranqueada
    // por semelhança — os 8 mais parecidos.
    const r = buscar(aparelhos, busca, (e) => [
      e.nome, e.numero_patrimonio, e.codigo_interno, e.tag, e.modelo, e.numero_serie,
    ]);
    return { ...r, itens: r.itens.slice(0, 8) };
  }, [aparelhos, busca]);

  const porQuantidade = useMemo(
    () => catalogo.filter((c) => c.ativo && !c.controla_individual),
    [catalogo]
  );

  const saldoNaOrigem =
    idCatalogo && deUnidade ? (saldo?.get(`${deUnidade}|${idCatalogo}`) ?? 0) : null;

  /** Destinatários possíveis. O hook já exclui quem está registrando (criador
   *  nunca é destinatário) e já deixa admin receber em qualquer base — a mesma
   *  régua da transferência que já existe. A RPC confere tudo de novo no banco. */
  const { data: destinatarios = [] } = useUsuariosDestino(paraUnidade || null);

  function limparIndividual() {
    setIdEquipamento("");
    setBusca("");
    setParaUnidade("");
    setParaEmail("");
    setParaLocal("");
    setParaResponsavel("");
    setMotivo("");
    setObs("");
  }

  function registrarIndividual() {
    if (!aparelho) return toast.error("Escolha o aparelho a transferir.");
    if (!paraUnidade) return toast.error("Escolha a base de destino.");
    if (paraUnidade === aparelho.id_unidade)
      return toast.error("O aparelho já está nessa base.");
    if (!paraEmail) return toast.error("Escolha quem vai receber e assinar.");
    const dest = destinatarios.find((u) => (u.email ?? "").toLowerCase() === paraEmail);
    if (!dest?.email) return toast.error("Escolha quem vai receber e assinar.");

    criarIndividual.mutate(
      {
        equipamento: aparelho,
        de_unidade: nomeBase.get(aparelho.id_unidade) ?? null,
        para_id_unidade: paraUnidade,
        para_unidade: nomeBase.get(paraUnidade) ?? "",
        para_usuario_email: dest.email,
        para_usuario_nome: dest.nome ?? dest.email,
        para_localizacao: paraLocal.trim() || null,
        para_responsavel: paraResponsavel.trim() || null,
        motivo: motivo.trim() || null,
        observacoes: obs.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("Transferência enviada — aguardando o aceite no destino");
          limparIndividual();
        },
      }
    );
  }

  function registrar() {
    if (modelo === "individual") return registrarIndividual();
    if (!idCatalogo) return toast.error("Escolha o produto.");
    if (!deUnidade) return toast.error("Escolha a base de origem.");
    if (!paraUnidade) return toast.error("Escolha a base de destino.");
    if (deUnidade === paraUnidade)
      return toast.error("A base de destino tem de ser diferente da de origem.");
    if (!paraEmail) return toast.error("Escolha quem vai receber e assinar.");

    const q = Number(String(quantidade).replace(",", "."));
    if (!(q > 0)) return toast.error("A quantidade precisa ser maior que zero.");
    if (saldoNaOrigem !== null && q > saldoNaOrigem)
      return toast.error(
        `A base de origem tem ${saldoNaOrigem}; não dá para transferir ${q}.`
      );

    transferir.mutate(
      {
        id_catalogo: idCatalogo,
        de_unidade: deUnidade,
        para_unidade: paraUnidade,
        quantidade: q,
        para_email: paraEmail,
        motivo: motivo.trim() || null,
        transportado_por: transportador.trim() || null,
      },
      {
        onSuccess: () => {
          setQuantidade("");
          setMotivo("");
          setTransportador("");
        },
      }
    );
  }

  return (
    <div className="space-y-4">
      {/* Modelo */}
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setModelo("quantidade")}
          className={cn(
            "rounded-lg border p-3 text-left transition-colors",
            modelo === "quantidade"
              ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
              : "border-gray-200 bg-white hover:border-gray-300"
          )}
        >
          <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <Boxes className="size-4" /> Material por quantidade
          </span>
          <span className="mt-1 block text-xs text-gray-600">
            Fone, mouse, cabo. Sai do saldo de uma base e entra na outra.
          </span>
        </button>
        <button
          type="button"
          onClick={() => setModelo("individual")}
          className={cn(
            "rounded-lg border p-3 text-left transition-colors",
            modelo === "individual"
              ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
              : "border-gray-200 bg-white hover:border-gray-300"
          )}
        >
          <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <HardDrive className="size-4" /> Aparelho identificado
          </span>
          <span className="mt-1 block text-xs text-gray-600">
            Computador, notebook. Move aquele aparelho, com série e plaqueta.
          </span>
        </button>
      </div>

      {modelo === "individual" && !podeTransferirAparelho ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Transferir aparelho identificado exige a permissão “Transferências”
          </p>
          <p className="mt-1 text-sm text-amber-800">
            O teu cadastro não tem esse módulo, e o banco recusa a gravação — não
            é a tela que está travando. Um administrador libera em{" "}
            <strong>Usuários</strong>, marcando <em>Transferências</em>. Material
            por quantidade continua liberado para você.
          </p>
        </div>
      ) : modelo === "individual" ? (
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
          {/* ── Qual aparelho ─────────────────────────────────────────── */}
          {!aparelho ? (
            <div>
              <label className={labelCls}>Qual aparelho *</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  className={`${inputCls} pl-9`}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome, plaqueta, código, TAG, modelo ou nº de série…"
                />
              </div>
              {carregandoAparelhos ? (
                <p className="mt-2 text-xs text-gray-500">Carregando os aparelhos…</p>
              ) : busca.trim() ? (
                <ul className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-200">
                  {aproximado && encontrados.length > 0 && (
                    <li>
                      <AvisoBuscaAproximada aproximado busca={busca} total={encontrados.length} compacto />
                    </li>
                  )}
                  {encontrados.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-gray-500">
                      Nenhum aparelho encontrado.
                    </li>
                  ) : (
                    encontrados.map((e) => (
                      <li key={e.id_equipamento}>
                        <button
                          type="button"
                          onClick={() => setIdEquipamento(e.id_equipamento)}
                          className="flex w-full flex-wrap items-baseline gap-x-2 px-3 py-2 text-left text-sm hover:bg-blue-50"
                        >
                          <span className="font-medium text-gray-900">{e.nome}</span>
                          <span className="text-xs text-gray-500">
                            {[e.numero_patrimonio && `plaqueta ${e.numero_patrimonio}`, e.modelo, e.numero_serie]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                          <span className="ml-auto text-xs text-gray-400">
                            {nomeBase.get(e.id_unidade) ?? "—"}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : (
                <p className="mt-1 text-[11px] text-gray-500">
                  {aparelhos.length} aparelhos cadastrados no módulo.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{aparelho.nome}</p>
                  <p className="text-xs text-gray-600">
                    {[
                      aparelho.numero_patrimonio && `Plaqueta ${aparelho.numero_patrimonio}`,
                      aparelho.codigo_interno && `Cód. ${aparelho.codigo_interno}`,
                      aparelho.tag && `TAG ${aparelho.tag}`,
                      aparelho.modelo,
                      aparelho.numero_serie && `Série ${aparelho.numero_serie}`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "sem identificação registrada"}
                  </p>
                  {/* A ORIGEM NÃO É DIGITADA: ela é lida do cadastro. Deixar a
                      pessoa escolher permitiria gravar "saiu de Campos" para um
                      aparelho que está em Teresópolis, e o extrato viraria ficção. */}
                  <p className="mt-1 text-xs text-gray-500">
                    <strong>Está em:</strong> {nomeBase.get(aparelho.id_unidade) ?? "base não definida"}
                    {aparelho.localizacao ? ` · ${aparelho.localizacao}` : ""}
                    {aparelho.responsavel ? ` · com ${aparelho.responsavel}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setIdEquipamento(""); setBusca(""); }}
                  aria-label="Escolher outro aparelho"
                  className="shrink-0 rounded p-1 text-gray-400 hover:bg-white hover:text-gray-600"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Vai para *</label>
                  <select
                    className={inputCls}
                    value={paraUnidade}
                    onChange={(e) => { setParaUnidade(e.target.value); setParaEmail(""); }}
                  >
                    <option value="">Selecione…</option>
                    {bases
                      .filter((u) => u.id_unidade !== aparelho.id_unidade)
                      .map((u) => (
                        <option key={u.id_unidade} value={u.id_unidade}>{u.nome}</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Quem recebe e assina *</label>
                  <select
                    className={inputCls}
                    value={paraEmail}
                    onChange={(e) => setParaEmail(e.target.value)}
                    disabled={!paraUnidade}
                  >
                    <option value="">
                      {paraUnidade ? "Selecione…" : "escolha a base de destino antes"}
                    </option>
                    {destinatarios.map((u) => (
                      <option key={u.email ?? ""} value={(u.email ?? "").toLowerCase()}>
                        {u.nome ?? u.email}
                      </option>
                    ))}
                  </select>
                  {paraUnidade && destinatarios.length === 0 && (
                    <p className="mt-1 text-[11px] text-amber-700">
                      Ninguém cadastrado nessa base além de você. Um admin pode aceitar.
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelCls}>Localização no destino</label>
                  <input
                    className={inputCls}
                    value={paraLocal}
                    onChange={(e) => setParaLocal(e.target.value)}
                    placeholder="ex.: sala técnica"
                  />
                </div>

                <div>
                  <label className={labelCls}>Fica com</label>
                  <input
                    className={inputCls}
                    value={paraResponsavel}
                    onChange={(e) => setParaResponsavel(e.target.value)}
                    placeholder="responsável no destino"
                  />
                </div>

                <div>
                  <label className={labelCls}>Motivo</label>
                  <input
                    className={inputCls}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="ex.: realocação, empréstimo…"
                  />
                </div>

                <div>
                  <label className={labelCls}>Observações</label>
                  <input
                    className={inputCls}
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                    placeholder="detalhes adicionais"
                  />
                </div>
              </div>

              {/* A ASSIMETRIA ENTRE OS DOIS MODELOS, dita em voz alta.
                  Quantidade sai do saldo no REGISTRO; aparelho identificado só
                  muda de base no ACEITE. Quem opera os dois no mesmo dia precisa
                  saber que a regra é diferente — senão procura o notebook na
                  base errada. */}
              <div className="flex gap-2 rounded-md border border-blue-200 bg-blue-50 p-3">
                <ArrowLeftRight className="mt-0.5 size-4 shrink-0 text-blue-700" />
                <p className="text-xs text-blue-900">
                  Diferente do material por quantidade, o aparelho{" "}
                  <strong>continua na base de origem</strong> até alguém assinar o
                  recebimento — ele é um só, e some de verdade se ninguém souber
                  onde está. Enquanto isso, a transferência fica em{" "}
                  <strong>Aguardando aceite</strong>, e quem registrou pode cancelar.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={limparIndividual}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={registrar}
                  disabled={criarIndividual.isPending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {criarIndividual.isPending && <Loader2 className="size-4 animate-spin" />}
                  Enviar para aceite
                </button>
              </div>
            </>
          )}
        </div>
      ) : porQuantidade.length === 0 ? (
        <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-6 text-center">
          <Boxes className="mx-auto size-7 text-amber-500" />
          <p className="mt-2 text-sm font-semibold text-amber-900">
            Nenhum produto por quantidade no catálogo
          </p>
          <p className="mt-1 text-sm text-amber-800">
            Cadastre o produto na aba <strong>Catálogo</strong>, marcando
            &ldquo;por quantidade&rdquo;, e dê entrada nele antes de transferir.
          </p>
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls}>Produto *</label>
              <select
                className={inputCls}
                value={idCatalogo}
                onChange={(e) => setIdCatalogo(e.target.value)}
              >
                <option value="">Selecione…</option>
                {porQuantidade.map((c) => (
                  <option key={c.id_catalogo} value={c.id_catalogo}>
                    {c.nome}
                    {c.fabricante ? ` · ${c.fabricante}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Sai de *</label>
              <select
                className={inputCls}
                value={deUnidade}
                onChange={(e) => setDeUnidade(e.target.value)}
              >
                <option value="">Selecione…</option>
                {bases.map((u) => (
                  <option key={u.id_unidade} value={u.id_unidade}>
                    {u.nome}
                  </option>
                ))}
              </select>
              {saldoNaOrigem !== null && (
                <p className="mt-1 text-[11px] text-gray-500">
                  Disponível nesta base: <strong>{saldoNaOrigem}</strong>
                </p>
              )}
            </div>

            <div>
              <label className={labelCls}>Vai para *</label>
              <select
                className={inputCls}
                value={paraUnidade}
                onChange={(e) => {
                  setParaUnidade(e.target.value);
                  setParaEmail("");
                }}
              >
                <option value="">Selecione…</option>
                {bases
                  .filter((u) => u.id_unidade !== deUnidade)
                  .map((u) => (
                    <option key={u.id_unidade} value={u.id_unidade}>
                      {u.nome}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Quantidade *</label>
              <input
                className={inputCls}
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                inputMode="decimal"
                placeholder="ex.: 2"
              />
            </div>

            <div>
              <label className={labelCls}>Quem recebe e assina *</label>
              <select
                className={inputCls}
                value={paraEmail}
                onChange={(e) => setParaEmail(e.target.value)}
                disabled={!paraUnidade}
              >
                <option value="">
                  {paraUnidade ? "Selecione…" : "escolha a base de destino antes"}
                </option>
                {destinatarios.map((u) => (
                  <option key={u.email ?? ""} value={u.email ?? ""}>
                    {u.nome ?? u.email}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-gray-500">
                Só essa pessoa (ou um admin) pode aceitar. Quem registra não aceita.
              </p>
            </div>

            <div>
              <label className={labelCls}>Transportado por</label>
              <input
                className={inputCls}
                value={transportador}
                onChange={(e) => setTransportador(e.target.value)}
                placeholder="quem leva"
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Motivo</label>
              <input
                className={inputCls}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="ex.: reposição da base, remanejamento…"
              />
            </div>
          </div>

          {/* O aviso que evita o susto */}
          <div className="flex gap-2 rounded-md border border-blue-200 bg-blue-50 p-3">
            <ArrowLeftRight className="mt-0.5 size-4 shrink-0 text-blue-700" />
            <p className="text-xs text-blue-900">
              Ao registrar, a quantidade <strong>sai imediatamente do saldo da
              base de origem</strong> e fica em trânsito — é o que evita alguém
              prometer material que já está no carro. Ela só entra no destino
              quando a pessoa escolhida assinar o recebimento. Se a transferência
              for recusada ou cancelada, o material <strong>volta sozinho</strong>
              para a origem.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={registrar}
              disabled={transferir.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {transferir.isPending && <Loader2 className="size-4 animate-spin" />}
              Registrar transferência
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

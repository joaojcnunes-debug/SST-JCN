"use client";

import { useEffect, useMemo, useState } from "react";
import { Boxes, FileText, HardDrive, Loader2, Plus, Search, UserPlus, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  useAparelhosLivres,
  useColaboradores,
  useGarantirColaborador,
  useRegistrarEntrega,
  urlTermo,
  useUsuariosPlataforma,
  type AparelhoPosse,
  type ItemEntregaInput,
} from "@/lib/hooks/useEquipamentosEntregas";
import {
  useEquipamentosCatalogo,
  useEquipamentosSaldo,
  type EquipamentoCatalogo,
} from "@/lib/hooks/useEquipamentosEstoque";
import { useCurrentUser } from "@/lib/hooks/useUsuario";
import ColaboradoresChabra from "@/components/equipamentos/ColaboradoresChabra";
import AvisoBuscaAproximada from "@/components/ui/AvisoBuscaAproximada";
import { buscar } from "@/lib/busca/texto";
import { cn } from "@/lib/utils";

/**
 * Retirada — saída de equipamento da base para um colaborador.
 *
 * É a porta que faltava. As tabelas e a RPC estão em produção desde a v166 e
 * nada no frontend as chamava: `equipamentos` tinha 115 linhas e
 * `equipamentos_entregas`, zero. Não era desuso, era ausência de tela.
 *
 * ⚠️ O QUE APARECE PARA ESCOLHER SÃO OS APARELHOS LIVRES DA BASE — `id_colaborador
 * is null`. Um aparelho que já está com alguém não some da lista por gentileza:
 * a RPC recusa entregá-lo de novo, e a mensagem que ela devolve ("já está com
 * outra pessoa — registre a devolução antes") é melhor que qualquer filtro de
 * tela. O filtro existe para a pessoa não chegar até lá.
 *
 * ⚠️ A ENTREGA VALE DA ASSINATURA NO PAPEL. Esta tela registra e emite o termo;
 * o traço no canvas (`equipamentos_entrega_assinaturas`, também pronta na v166)
 * ainda não tem captura. Até lá o fluxo é: registrar → imprimir duas vias →
 * colher assinatura → arquivar. O termo já reserva o espaço.
 */

const inputCls =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelCls =
  "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-600";

const hoje = () => new Date().toISOString().slice(0, 10);

/**
 * De onde sai o item (pedido de 21/09/2026 — "aba para transferência de itens
 * sem patrimônio, os periféricos"):
 *   • aparelho → ficha já existente, livre na base (`equipamentos`).
 *   • estoque  → produto do catálogo com saldo na base. A RPC dá baixa no saldo
 *                e, se o produto for "um a um", cria a ficha na hora.
 */
/** "tudo" é o padrão (prova dele em 21/09: abrir em "Aparelhos" escondia o
 *  headset que ele acabara de dar entrada — o mesmo sintoma de antes). */
type Fonte = "tudo" | "aparelho" | "estoque";

type Escolhido =
  | { fonte: "aparelho"; aparelho: AparelhoPosse }
  | { fonte: "estoque"; produto: EquipamentoCatalogo; quantidade: number; saldo: number; seriais: string };

const chaveDe = (e: Escolhido) =>
  e.fonte === "aparelho" ? `a:${e.aparelho.id_equipamento}` : `e:${e.produto.id_catalogo}`;

export default function MovimentacaoEntrega({
  bases,
  baseInicial,
}: {
  bases: { id_unidade: string; nome: string }[];
  baseInicial?: string | null;
}) {
  const user = useCurrentUser();

  /**
   * NASCE VAZIO DE PROPÓSITO — não cai na primeira base da lista.
   *
   * Pré-selecionar a primeira em ordem alfabética faz a pessoa escolher o
   * destinatário sem reparar na unidade, e "Campos" acabava respondendo por uma
   * retirada de Teresópolis. Como colaborador e aparelhos livres são ambos
   * escopados por base, a escolha errada aqui contamina tudo abaixo — e o erro
   * só aparece no papel, depois de assinado. Ordem obrigatória: unidade, depois
   * quem recebe.
   */
  const [base, setBase] = useState<string>(
    baseInicial && baseInicial !== "TODAS" ? baseInicial : "",
  );
  /** Valor do seletor de destinatário, prefixado pela origem do cadastro:
   *  `c:<id>` = já está no roster da base · `u:<id>` = usuário da plataforma,
   *  que ganha a linha de roster no momento do registro. */
  const [destinatario, setDestinatario] = useState("");
  const [data, setData] = useState(hoje());
  const [responsavel, setResponsavel] = useState("");
  const [observacao, setObservacao] = useState("");
  const [busca, setBusca] = useState("");
  const [fonte, setFonte] = useState<Fonte>("tudo");
  const [escolhidos, setEscolhidos] = useState<Escolhido[]>([]);
  const [cadastrando, setCadastrando] = useState(false);
  const [termoEmitido, setTermoEmitido] = useState<string | null>(null);

  const { data: colaboradores = [] } = useColaboradores(base || null);
  const { data: usuarios = [] } = useUsuariosPlataforma();
  const { data: livres = [], isLoading: carregandoLivres } = useAparelhosLivres(base || null);
  const { data: catalogo = [] } = useEquipamentosCatalogo();
  const { data: saldo } = useEquipamentosSaldo();
  const registrar = useRegistrarEntrega();
  const garantirColaborador = useGarantirColaborador();

  // Nome de quem está registrando é o responsável provável pela entrega —
  // preenchido, não travado: quem opera o painel nem sempre é quem entrega.
  useEffect(() => {
    if (!responsavel && user?.nome) setResponsavel(user.nome);
  }, [user?.nome, responsavel]);

  // Trocar de base invalida a escolha inteira: colaborador e aparelhos são
  // ambos escopados por base, e a RPC recusa a mistura.
  useEffect(() => {
    setDestinatario("");
    setEscolhidos([]);
    setBusca("");
  }, [base]);

  /** Usuários que ainda não têm linha de roster nesta base. Casados por e-mail
   *  e, na falta dele, por nome — o mesmo par que a ponte usa ao registrar, para
   *  a lista não oferecer duas vezes a mesma pessoa. */
  const usuariosSemRoster = useMemo(() => {
    const emails = new Set(
      colaboradores.map((c) => (c.email ?? "").trim().toLowerCase()).filter(Boolean),
    );
    const nomes = new Set(colaboradores.map((c) => c.nome.trim().toLowerCase()));
    return usuarios.filter(
      (u) =>
        !emails.has((u.email ?? "").trim().toLowerCase()) &&
        !nomes.has(u.nome.trim().toLowerCase()),
    );
  }, [usuarios, colaboradores]);

  /** Quem vai sair impresso no termo, venha de onde vier. */
  const destino = useMemo(() => {
    if (destinatario.startsWith("c:")) {
      const c = colaboradores.find((x) => x.id_colaborador === destinatario.slice(2));
      return c
        ? { nome: c.nome, cargo: c.cargo, setor: c.setor, matricula: c.matricula, cpf: c.cpf }
        : null;
    }
    if (destinatario.startsWith("u:")) {
      const u = usuarios.find((x) => x.id_usuario === destinatario.slice(2));
      return u ? { nome: u.nome, cargo: u.cargo, setor: null, matricula: null, cpf: u.cpf } : null;
    }
    return null;
  }, [destinatario, colaboradores, usuarios]);

  const jaEscolhido = useMemo(() => new Set(escolhidos.map(chaveDe)), [escolhidos]);

  const { itens: encontrados, aproximado } = useMemo(() => {
    const base0 = livres.filter((e) => !jaEscolhido.has(`a:${e.id_equipamento}`));
    // Busca tolerante (acento, ordem das palavras, erro de digitação), ranqueada
    // por semelhança — os 8 mais parecidos.
    const r = buscar(base0, busca, (e) => [
      e.nome, e.numero_patrimonio, e.numero_serie, e.modelo, e.fabricante, e.tipo,
    ]);
    return { ...r, itens: r.itens.slice(0, 8) };
  }, [livres, busca, jaEscolhido]);

  /** Produtos com saldo nesta base — o que dá para tirar da prateleira. */
  const emEstoque = useMemo(() => {
    if (!base) return [] as { produto: EquipamentoCatalogo; saldo: number }[];
    return catalogo
      .filter((c) => c.ativo)
      .map((c) => ({ produto: c, saldo: saldo?.get(`${base}|${c.id_catalogo}`) ?? 0 }))
      .filter((x) => x.saldo > 0)
      .sort((a, b) => a.produto.nome.localeCompare(b.produto.nome, "pt-BR"));
  }, [catalogo, saldo, base]);

  const { itens: estoqueEncontrado, aproximado: estoqueAproximado } = useMemo(() => {
    const base0 = emEstoque.filter((x) => !jaEscolhido.has(`e:${x.produto.id_catalogo}`));
    const r = buscar(base0, busca, (x) => [x.produto.nome, x.produto.tipo, x.produto.fabricante, x.produto.modelo]);
    return { ...r, itens: r.itens.slice(0, 8) };
  }, [emEstoque, busca, jaEscolhido]);

  function alterarEscolhido(chave: string, patch: Partial<Extract<Escolhido, { fonte: "estoque" }>>) {
    setEscolhidos((l) => l.map((e) => (chaveDe(e) === chave && e.fonte === "estoque" ? { ...e, ...patch } : e)));
  }

  function limpar() {
    setDestinatario("");
    setEscolhidos([]);
    setBusca("");
    setObservacao("");
    setData(hoje());
  }

  async function registrarEntrega() {
    if (!base) return toast.error("Escolha a base de onde o equipamento sai.");
    if (!destinatario) return toast.error("Escolha quem vai receber.");
    if (escolhidos.length === 0) return toast.error("Adicione ao menos um item — aparelho ou periférico.");

    // A RPC só aceita destinatário que exista em `colaboradores_chabra` nesta
    // base. Quem veio da lista de usuários ganha a linha de roster agora, com a
    // base já decidida na tela — nunca adivinhada.
    let idColaborador: string;
    if (destinatario.startsWith("c:")) {
      idColaborador = destinatario.slice(2);
    } else {
      const usuario = usuarios.find((u) => u.id_usuario === destinatario.slice(2));
      if (!usuario) return toast.error("Usuário não encontrado. Recarregue a página.");
      try {
        idColaborador = await garantirColaborador.mutateAsync({ id_unidade: base, usuario });
      } catch (e) {
        return toast.error(
          e instanceof Error ? e.message : "Não foi possível vincular a pessoa a esta base.",
        );
      }
    }

    // Quantidade de estoque: inteira, positiva e dentro do saldo (a RPC confere
    // de novo; aqui é para a pessoa não descobrir o erro só no fim).
    for (const e of escolhidos) {
      if (e.fonte !== "estoque") continue;
      if (!Number.isInteger(e.quantidade) || e.quantidade <= 0)
        return toast.error(`Quantidade inválida para "${e.produto.nome}".`);
      if (e.quantidade > e.saldo)
        return toast.error(`"${e.produto.nome}": só há ${e.saldo} na base, pedido ${e.quantidade}.`);
    }
    const itens: ItemEntregaInput[] = escolhidos.map((e) =>
      e.fonte === "aparelho"
        ? { id_equipamento: e.aparelho.id_equipamento }
        : {
            id_catalogo: e.produto.id_catalogo,
            quantidade: e.quantidade,
            // Séries (opcional, separadas por vírgula). No "um a um" viram o número
            // de série de cada ficha que nasce; no item por quantidade ficam na
            // linha do termo (v238) — headset e webcam também têm série.
            ...(e.seriais.trim()
              ? { seriais: e.seriais.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean) }
              : {}),
          },
    );
    const totalUnidades = escolhidos.reduce((n, e) => n + (e.fonte === "estoque" ? e.quantidade : 1), 0);
    const id = await registrar.mutateAsync({
      id_unidade: base,
      id_colaborador: idColaborador,
      data_entrega: data,
      responsavel: responsavel.trim() || null,
      observacao: observacao.trim() || null,
      itens,
    });

    toast.success(`Retirada registrada — ${totalUnidades} item(ns).`);
    setTermoEmitido(id);
    limpar();
  }

  if (termoEmitido) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-semibold text-green-900">Retirada registrada.</p>
          <p className="mt-1 text-sm text-green-800">
            O saldo já saiu da base e os itens passaram para a posse do colaborador. Falta
            a assinatura no papel: imprima <b>duas vias</b> — uma para a TI/Patrimônio, outra
            para quem recebeu.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={urlTermo("entrega", termoEmitido)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
            >
              <FileText className="h-4 w-4" /> Abrir termo em PDF
            </a>
            <button
              type="button"
              onClick={() => setTermoEmitido(null)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Registrar outra retirada
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={labelCls}>Unidade / base de origem *</label>
          <select className={inputCls} value={base} onChange={(e) => setBase(e.target.value)}>
            <option value="">Selecione…</option>
            {bases.map((b) => (
              <option key={b.id_unidade} value={b.id_unidade}>
                {b.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className={labelCls}>Quem recebe *</label>
          <div className="flex gap-2">
            <select
              className={inputCls}
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
              disabled={!base}
            >
              <option value="">
                {base ? "Selecione…" : "Escolha a unidade primeiro"}
              </option>
              {colaboradores.length > 0 && (
                <optgroup label="Já cadastrados nesta base">
                  {colaboradores.map((c) => (
                    <option key={c.id_colaborador} value={`c:${c.id_colaborador}`}>
                      {c.nome}
                      {c.matricula ? ` — ${c.matricula}` : ""}
                    </option>
                  ))}
                </optgroup>
              )}
              {usuariosSemRoster.length > 0 && (
                <optgroup label="Usuários da plataforma">
                  {usuariosSemRoster.map((u) => (
                    <option key={u.id_usuario} value={`u:${u.id_usuario}`}>
                      {u.nome}
                      {u.cargo ? ` — ${u.cargo}` : ""}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <button
              type="button"
              onClick={() => setCadastrando((v) => !v)}
              title="Cadastrar quem não tem login no painel"
              className="flex-none rounded-md border border-gray-300 px-2.5 text-gray-700 hover:bg-gray-50"
            >
              <UserPlus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div>
          <label className={labelCls}>Data da retirada</label>
          <input
            type="date"
            className={inputCls}
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </div>
      </div>

      {cadastrando && (
        <div className="rounded-lg border border-gray-200 p-3">
          <ColaboradoresChabra
            bases={bases}
            baseInicial={base}
            aoCadastrar={(id) => {
              setDestinatario(`c:${id}`);
              setCadastrando(false);
            }}
          />
        </div>
      )}

      {destino && (
        <p className="text-xs text-gray-600">
          Sairá impresso no termo: <b>{destino.nome}</b>
          {destino.cargo ? ` · ${destino.cargo}` : ""}
          {destino.setor ? ` · ${destino.setor}` : ""}
          {[destino.matricula, destino.cpf].filter(Boolean).length
            ? ` · ${[destino.matricula, destino.cpf].filter(Boolean).join(" / ")}`
            : " · sem matrícula/CPF cadastrados"}
          {destinatario.startsWith("u:") && (
            <>
              {" "}
              — vindo dos usuários da plataforma; será vinculado a esta base ao registrar.
            </>
          )}
        </p>
      )}

      <div>
        <label className={labelCls}>Equipamentos a entregar *</label>
        {/* A "aba" pedida em 21/09: aparelho com plaqueta OU periférico/item por
            quantidade. As duas fontes podem ir no mesmo termo. */}
        <div className="mb-2 flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
          {(
            [
              { v: "tudo", label: "Tudo", icon: Search },
              { v: "aparelho", label: "Aparelhos com patrimônio", icon: HardDrive },
              { v: "estoque", label: "Periféricos e itens por quantidade", icon: Boxes },
            ] as const
          ).map((m) => {
            const Icone = m.icon;
            return (
              <button
                key={m.v}
                type="button"
                onClick={() => { setFonte(m.v); setBusca(""); }}
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  fonte === m.v ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-900",
                )}
              >
                <Icone className="size-4" />
                {m.label}
              </button>
            );
          })}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
          <input
            className={cn(inputCls, "pl-8")}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={
              !base
                ? "escolha a base primeiro"
                : fonte === "aparelho"
                  ? "buscar por nome, patrimônio, série, modelo…"
                  : fonte === "estoque"
                    ? "buscar produto no estoque desta base…"
                    : "buscar aparelho (nome, patrimônio, série) ou item do estoque…"
            }
            disabled={!base}
          />
        </div>

        {base && fonte !== "aparelho" && (emEstoque.length > 0 || fonte === "estoque") && (
          <div className="mt-2 space-y-1">
            {fonte === "tudo" && estoqueEncontrado.length > 0 && (
              <p className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                Periféricos e itens por quantidade · {emEstoque.length} no estoque desta base
              </p>
            )}
            {fonte === "estoque" && emEstoque.length === 0 && (
              <p className="px-1 py-2 text-sm text-gray-500">
                Nada em estoque nesta base. O saldo entra por <b>Dar entrada</b> (ou pela NF-e).
              </p>
            )}
            {fonte === "estoque" && emEstoque.length > 0 && estoqueEncontrado.length === 0 && (
              <p className="px-1 py-2 text-sm text-gray-500">Nada encontrado com esse termo.</p>
            )}
            <AvisoBuscaAproximada aproximado={estoqueAproximado} busca={busca} total={estoqueEncontrado.length} compacto className="rounded" />
            {estoqueEncontrado.map(({ produto, saldo: s }) => (
              <button
                key={produto.id_catalogo}
                type="button"
                onClick={() => {
                  setEscolhidos((l) => [...l, { fonte: "estoque", produto, quantidade: 1, saldo: s, seriais: "" }]);
                  setBusca("");
                }}
                className="flex w-full items-center justify-between rounded-md border border-gray-200 px-3 py-1.5 text-left text-sm hover:border-blue-300 hover:bg-blue-50"
              >
                <span>
                  <b>{produto.nome}</b>
                  <span className="text-gray-500">
                    {produto.tipo ? ` · ${produto.tipo}` : ""}
                    {` · ${s} ${produto.unidade_medida ?? "un"} na base`}
                    {produto.controla_individual ? " · um a um (nasce ficha)" : ""}
                  </span>
                </span>
                <Plus className="h-4 w-4 flex-none text-blue-600" />
              </button>
            ))}
          </div>
        )}

        {base && fonte !== "estoque" && (
          <div className="mt-2 space-y-1">
            {fonte === "tudo" && encontrados.length > 0 && (
              <p className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Aparelhos com patrimônio · {livres.length} livre{livres.length === 1 ? "" : "s"} nesta base
              </p>
            )}
            {carregandoLivres && (
              <div className="flex items-center gap-2 px-1 py-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> carregando o que está livre…
              </div>
            )}
            {!carregandoLivres && encontrados.length === 0 && (fonte === "aparelho" || estoqueEncontrado.length === 0) && (
              <p className="px-1 py-2 text-sm text-gray-500">
                {livres.length === 0 && (fonte === "aparelho" || emEstoque.length === 0)
                  ? "Nenhum equipamento livre nesta base — todos já estão com alguém, ou foram baixados."
                  : "Nada encontrado com esse termo."}
              </p>
            )}
            <AvisoBuscaAproximada aproximado={aproximado} busca={busca} total={encontrados.length} compacto className="rounded" />
            {encontrados.map((e) => (
              <button
                key={e.id_equipamento}
                type="button"
                onClick={() => {
                  setEscolhidos((l) => [...l, { fonte: "aparelho", aparelho: e }]);
                  setBusca("");
                }}
                className="flex w-full items-center justify-between rounded-md border border-gray-200 px-3 py-1.5 text-left text-sm hover:border-blue-300 hover:bg-blue-50"
              >
                <span>
                  <b>{e.nome}</b>
                  <span className="text-gray-500">
                    {e.numero_patrimonio ? ` · patr. ${e.numero_patrimonio}` : ""}
                    {e.numero_serie ? ` · série ${e.numero_serie}` : ""}
                    {e.status !== "OPERANTE" ? ` · ${e.status}` : ""}
                  </span>
                </span>
                <Plus className="h-4 w-4 flex-none text-blue-600" />
              </button>
            ))}
          </div>
        )}
      </div>

      {escolhidos.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-left">Patrimônio / série</th>
                <th className="px-3 py-2 text-left">Qtd.</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {escolhidos.map((e) => {
                const chave = chaveDe(e);
                const remover = () => setEscolhidos((l) => l.filter((x) => chaveDe(x) !== chave));
                if (e.fonte === "aparelho") {
                  const a = e.aparelho;
                  return (
                    <tr key={chave}>
                      <td className="px-3 py-2 font-medium">{a.nome}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {a.numero_patrimonio ? `patr. ${a.numero_patrimonio}` : "—"}
                        {a.numero_serie ? ` · série ${a.numero_serie}` : ""}
                      </td>
                      <td className="px-3 py-2">1</td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={remover} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                }
                const p = e.produto;
                return (
                  <tr key={chave} className="bg-emerald-50/40">
                    <td className="px-3 py-2">
                      <span className="font-medium">{p.nome}</span>
                      <span className="block text-xs text-gray-500">
                        {p.controla_individual
                          ? `um a um — ${e.quantidade} ficha(s) nasce(m) na retirada`
                          : `por quantidade${p.tipo ? ` · ${p.tipo}` : ""} · ${e.saldo} ${p.unidade_medida ?? "un"} na base`}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className={cn(inputCls, "min-w-[12rem]")}
                        value={e.seriais}
                        onChange={(ev) => alterarEscolhido(chave, { seriais: ev.target.value })}
                        placeholder={e.quantidade > 1 ? "nº de série de cada um, separados por vírgula" : "nº de série (opcional)"}
                      />
                      {e.seriais.trim() && (() => {
                        const n = e.seriais.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean).length;
                        return n !== e.quantidade ? (
                          <span className="mt-0.5 block text-[11px] text-amber-700">
                            {n} série{n === 1 ? "" : "s"} para {e.quantidade} unidade{e.quantidade === 1 ? "" : "s"}
                          </span>
                        ) : null;
                      })()}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        max={e.saldo}
                        step={1}
                        className={cn(inputCls, "w-20")}
                        value={e.quantidade}
                        onChange={(ev) => alterarEscolhido(chave, { quantidade: Number(ev.target.value) })}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={remover} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Responsável pela entrega</label>
          <input
            className={inputCls}
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Motivo / observação</label>
          <input
            className={inputCls}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="nova alocação, troca de função, substituição…"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-gray-200 pt-3">
        <button
          type="button"
          onClick={registrarEntrega}
          disabled={registrar.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {registrar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Registrar retirada e emitir termo
        </button>
        <p className="text-xs text-gray-500">
          O registro é imediato: aparelhos e periféricos passam para a posse do colaborador na hora. Erro
          de preenchimento se corrige por devolução, não apagando a linha.
        </p>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Fingerprint, Loader2, Plus, Search, ShieldCheck, UserCheck, UserX } from "lucide-react";
import toast from "react-hot-toast";
import {
  useAtualizarColaborador,
  useColaboradores,
  useCriarColaborador,
  type ColaboradorInput,
} from "@/lib/hooks/useEquipamentosEntregas";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import BiometriaCadastroModal from "./BiometriaCadastroModal";
import { buscar } from "@/lib/busca/texto";
import AvisoBuscaAproximada from "@/components/ui/AvisoBuscaAproximada";

/**
 * Roster de quem pode receber equipamento — a tabela `colaboradores_chabra`.
 *
 * POR QUE NÃO REUSAR UM CADASTRO QUE JÁ EXISTE. Foram avaliadas as duas
 * candidatas e nenhuma serve:
 *
 *  · `usuarios` são as credenciais do painel. A maioria de quem retira
 *    equipamento não tem login — era exatamente por isso que a RPC de entrega
 *    não podia reaproveitar o aceite da v136, que exige o destinatário logado.
 *    Além disso, dos 55 usuários ativos, NENHUM tem CPF preenchido e 40 têm
 *    zero ou mais de uma unidade — e a entrega exige base única.
 *
 *  · o antigo `prod_colaboradores` parecia um roster pelo nome, mas era planejamento de
 *    capacidade do módulo Produtividade: as colunas são
 *    `capacidade_docs_mes`/`capacidade_visitas_mes`, o `tipo` só assume
 *    `documentos` ou `tecnico_campo`, não há CPF nem matrícula, e o
 *    `id_unidade` era uuid de `prod_unidades` — outra dimensão, não a `unidades`.
 *    As `prod_*` saíram em 2026-09-23 (DIM-01); quem faz esse papel hoje é `dim_colaboradores`
 *    que a entrega usa.
 *
 * Daí o cadastro próprio. É de propósito enxuto: nome e base bastam para
 * registrar uma retirada; CPF e matrícula existem porque saem impressos no
 * termo e são o que identifica quem assinou.
 */

const inputCls =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelCls =
  "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-600";

const VAZIO: ColaboradorInput = {
  id_unidade: "",
  nome: "",
  cpf: "",
  matricula: "",
  cargo: "",
  setor: "",
  email: "",
};

/** O mesmo sentinela que a área de Movimentação usa no filtro de base. */
const TODAS = "TODAS";

export default function ColaboradoresChabra({
  bases,
  baseInicial,
  aoCadastrar,
}: {
  bases: { id_unidade: string; nome: string }[];
  baseInicial?: string | null;
  /** Chamado com o id do recém-criado — a tela de entrega usa para já deixar
   *  a pessoa selecionada, em vez de obrigar a procurar na lista. */
  aoCadastrar?: (idColaborador: string) => void;
}) {
  const [base, setBase] = useState<string>(baseInicial ?? bases[0]?.id_unidade ?? TODAS);
  /** ⚠️ O sentinela de "todas as bases" no painel é a string "TODAS" — é o que a
   *  área de Movimentação guarda em `baseFiltro` e passa em `baseInicial`. Tratar
   *  "" como o sentinela (o primeiro desenho desta opção) deixava `base` valendo
   *  "TODAS" de verdade: o botão de cadastrar não desligava, a dica dizia "base —",
   *  e a lista só não vinha vazia porque `useColaboradores` guarda `null` e "TODAS"
   *  na MESMA chave de cache — ou seja, funcionava por carona, até o refetch. */
  const todasBases = !base || base === TODAS;
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState<ColaboradorInput>({ ...VAZIO, id_unidade: base });
  const [abrindo, setAbrindo] = useState(false);
  const [bioAlvo, setBioAlvo] = useState<{ id: string; nome: string; em: string | null } | null>(null);
  const [equipe, setEquipe] = useState<string[]>([]);

  const { data: lista = [], isLoading } = useColaboradores(todasBases ? null : base, false);
  const criar = useCriarColaborador();
  const atualizar = useAtualizarColaborador();

  /**
   * A EQUIPE DE ENTREGA — quem pode assinar `envia` e `valida`, em qualquer base.
   *
   * Substituiu o validador fixo por unidade, que não sobreviveu ao primeiro teste real:
   * a entrega é feita só pela TI, que atende as 7 bases e é a mesma equipe que entrega e
   * valida. A lista é cross-base de propósito, então NÃO é filtrada pela base da tela.
   */
  const carregarEquipe = useCallback(async () => {
    const sb = createSupabaseBrowserClient() as unknown as {
      rpc(fn: string, args?: Record<string, unknown>): Promise<{ data: unknown }>;
    };
    const { data } = await sb.rpc("equip_equipe_entrega_listar");
    setEquipe(
      Array.isArray(data)
        ? (data as { id_colaborador: string }[]).map((m) => m.id_colaborador)
        : [],
    );
  }, []);

  useEffect(() => {
    void carregarEquipe();
  }, [carregarEquipe]);

  async function alternarEquipe(idColaborador: string, incluir: boolean) {
    // Escrita por RPC, nunca `insert`/`delete` direto: quem entrega é controle de
    // segurança, a RPC exige Admin e digital já cadastrada, e grava quem incluiu.
    const sb = createSupabaseBrowserClient() as unknown as {
      rpc(fn: string, args: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
    };
    const { error } = await sb.rpc("equip_definir_equipe_entrega", {
      p_id_colaborador: idColaborador,
      p_incluir: incluir,
    });
    if (error) return toast.error(error.message);
    toast.success(incluir ? "Incluído na equipe de entrega." : "Removido da equipe de entrega.");
    await carregarEquipe();
  }

  const nomeBase = useMemo(
    () => new Map(bases.map((b) => [b.id_unidade, b.nome])),
    [bases],
  );

  // Busca tolerante (acento, ordem das palavras, erro de digitação); CPF e matrícula pelos dígitos.
  const { itens: filtrados, aproximado } = useMemo(
    () =>
      buscar(lista, busca, (c) => [c.nome, c.matricula, c.cargo, c.setor, nomeBase.get(c.id_unidade)], {
        codigos: (c) => [c.cpf, c.matricula],
        manterOrdem: true,
      }),
    [lista, busca, nomeBase],
  );

  /** Quem aparece em mais de uma base. Só faz sentido com o recorte "todas". */
  const repetidos = useMemo(() => {
    if (!todasBases) return [];
    const porChave = new Map<string, Set<string>>();
    for (const c of lista) {
      const chave = (c.email?.trim() || c.nome.trim()).toLowerCase();
      const bases = porChave.get(chave) ?? new Set<string>();
      bases.add(c.id_unidade);
      porChave.set(chave, bases);
    }
    const nomes = new Set<string>();
    for (const c of lista) {
      const chave = (c.email?.trim() || c.nome.trim()).toLowerCase();
      if ((porChave.get(chave)?.size ?? 0) > 1) nomes.add(c.nome.trim());
    }
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [lista, todasBases]);

  async function salvar() {
    const nome = form.nome.trim();
    if (!nome) return toast.error("Informe o nome do colaborador.");
    if (todasBases) return toast.error("Escolha a base antes de cadastrar.");
    // Limpa string vazia para NULL: coluna opcional com "" atrapalha busca e
    // sai como campo em branco travado no termo.
    const limpo = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
    const id = await criar.mutateAsync({
      id_unidade: base,
      nome,
      cpf: limpo(form.cpf),
      matricula: limpo(form.matricula),
      cargo: limpo(form.cargo),
      setor: limpo(form.setor),
      email: limpo(form.email),
    });
    setForm({ ...VAZIO, id_unidade: base });
    setAbrindo(false);
    aoCadastrar?.(id);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[190px]">
          <label className={labelCls}>Base</label>
          <select
            className={inputCls}
            value={base}
            onChange={(e) => {
              setBase(e.target.value);
              setForm((f) => ({
                ...f,
                id_unidade: e.target.value === TODAS ? "" : e.target.value,
              }));
            }}
          >
            {/* "Todas as bases" existe por um motivo medido: o roster é POR BASE, e
                a tela mostrava uma base por vez. Em 22/09/2026 havia duas fichas do
                mesmo Leandro Salles — uma em Teresópolis, outra em Guapimirim — e
                quem procurava a segunda, de dentro da primeira, simplesmente não a
                encontrava. Sem esta opção, duplicata entre bases é invisível. */}
            <option value={TODAS}>Todas as bases</option>
            {bases.map((b) => (
              <option key={b.id_unidade} value={b.id_unidade}>
                {b.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[220px] flex-1">
          <label className={labelCls}>Buscar</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
            <input
              className={cn(inputCls, "pl-8")}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="nome, CPF, matrícula…"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAbrindo((v) => !v)}
          // Cadastrar exige base única — "todas" é recorte de leitura, não de escrita.
          disabled={todasBases}
          title={todasBases ? "Escolha uma base para cadastrar" : undefined}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Novo colaborador
        </button>
      </div>

      {abrindo && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <label className={labelCls}>Nome *</label>
              <input
                className={inputCls}
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                autoFocus
              />
            </div>
            <div>
              <label className={labelCls}>CPF</label>
              <input
                className={inputCls}
                value={form.cpf ?? ""}
                onChange={(e) => setForm({ ...form, cpf: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Matrícula</label>
              <input
                className={inputCls}
                value={form.matricula ?? ""}
                onChange={(e) => setForm({ ...form, matricula: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Cargo</label>
              <input
                className={inputCls}
                value={form.cargo ?? ""}
                onChange={(e) => setForm({ ...form, cargo: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Setor</label>
              <input
                className={inputCls}
                value={form.setor ?? ""}
                onChange={(e) => setForm({ ...form, setor: e.target.value })}
              />
            </div>
            <div className="lg:col-span-2">
              <label className={labelCls}>E-mail (opcional — só para aviso)</label>
              <input
                className={inputCls}
                value={form.email ?? ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={salvar}
              disabled={criar.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {criar.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
            </button>
            <button
              type="button"
              onClick={() => setAbrindo(false)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <span className="text-xs text-gray-500">
              A pessoa fica vinculada à base <b>{nomeBase.get(base) ?? "—"}</b>. A entrega
              recusa colaborador de outra base — a regra é do banco.
            </span>
          </div>
        </div>
      )}

      {/* A duplicata entre bases deixa de ser invisível: quem abre "Todas as bases"
          vê, em uma linha, quem tem ficha em mais de uma. A conta é pelo e-mail
          quando existe, e pelo nome quando não — é assim que o roster identifica
          a mesma pessoa. */}
      {todasBases && repetidos.length > 0 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {repetidos.length === 1 ? "1 pessoa tem" : `${repetidos.length} pessoas têm`} ficha em
          mais de uma base: {repetidos.join(", ")}. Duas fichas são duas pessoas para o painel —
          digital, equipe de entrega e equipamentos ficam em uma só.
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <AvisoBuscaAproximada aproximado={aproximado} busca={busca} total={filtrados.length} className="m-3" />
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Base</th>
              <th className="px-3 py-2 text-left">Matrícula / CPF</th>
              <th className="px-3 py-2 text-left">Cargo · Setor</th>
              <th className="px-3 py-2 text-left">Situação</th>
              <th className="px-3 py-2 text-left">Digital</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            )}
            {!isLoading && filtrados.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  {todasBases ? "Nenhum colaborador cadastrado." : "Nenhum colaborador cadastrado nesta base."}
                </td>
              </tr>
            )}
            {filtrados.map((c) => (
              <tr key={c.id_colaborador} className={cn(!c.ativo && "bg-gray-50 text-gray-400")}>
                <td className="px-3 py-2 font-medium">{c.nome}</td>
                <td className="px-3 py-2 text-gray-600">{nomeBase.get(c.id_unidade) ?? "—"}</td>
                <td className="px-3 py-2">
                  {[c.matricula, c.cpf].filter(Boolean).join(" / ") || "—"}
                </td>
                <td className="px-3 py-2">
                  {[c.cargo, c.setor].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-3 py-2">{c.ativo ? "Ativo" : "Inativo"}</td>
                <td className="px-3 py-2">
                  {c.biometria_em ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                      <Fingerprint className="h-3.5 w-3.5" />
                      {c.biometria_dedo ?? "cadastrada"}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">sem digital</span>
                  )}
                  {equipe.includes(c.id_colaborador) ? (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                      <ShieldCheck className="h-3 w-3" /> entrega e valida
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => setBioAlvo({ id: c.id_colaborador, nome: c.nome, em: c.biometria_em })}
                    className="mr-1 inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    <Fingerprint className="h-3.5 w-3.5" />
                    {c.biometria_em ? "Refazer" : "Cadastrar"}
                  </button>
                  {c.biometria_em ? (
                    <button
                      type="button"
                      onClick={() => alternarEquipe(c.id_colaborador, !equipe.includes(c.id_colaborador))}
                      className="mr-1 inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {equipe.includes(c.id_colaborador) ? "Tirar da equipe" : "Equipe de entrega"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      atualizar.mutate({
                        id_colaborador: c.id_colaborador,
                        patch: { ativo: !c.ativo },
                      })
                    }
                    className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    {c.ativo ? (
                      <>
                        <UserX className="h-3.5 w-3.5" /> Desativar
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-3.5 w-3.5" /> Reativar
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {bioAlvo ? (


        <BiometriaCadastroModal


          open


          onClose={() => setBioAlvo(null)}


          idColaborador={bioAlvo.id}


          nome={bioAlvo.nome}


          jaCadastrouEm={bioAlvo.em}


          onCadastrado={() => window.location.reload()}


        />


      ) : null}


      <p className="text-xs text-gray-500">
        Desativar não apaga: entregas e devoluções já registradas continuam apontando para a
        pessoa, e os termos emitidos seguem válidos. Inativo apenas deixa de aparecer na hora
        de registrar uma retirada nova.
      </p>
    </div>
  );
}

"use client";

import Dica from "@/components/ui/Dica";
import { DICAS_EPI } from "@/lib/dicas/inspecao-editor";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import AvisoRascunho from "@/components/ui/AvisoRascunho";
import FotoSlots, { prepararFotoSlots, type FotoSlot } from "@/components/ui/FotoSlots";
import { useRascunho } from "@/lib/hooks/useRascunho";
import ComboTagInline from "@/components/drps/ComboTagInline";
import { gravar } from "@/lib/offline/gravar";
import { operacaoPendenteQueCria } from "@/lib/offline/operacoes";
import type { InspecaoFull } from "@/lib/hooks/useInspecao";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { useTipoIcone } from "@/lib/hooks/useV3";
import { useEpiSugestoes } from "@/lib/hooks/useEpiSugestoes";
import type { EpiEpc, Risco, Setor } from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onClose: () => void;
  idInspecao: string;
  idEmpresa: string;
  setores: Setor[];
  riscos: Risco[];
  epi?: EpiEpc | null;
}

function buildSlots(urls: string[], paths: string[]): (FotoSlot | null)[] {
  const base: (FotoSlot | null)[] = [null, null, null, null];
  urls.forEach((url, i) => {
    if (i < 4) base[i] = { type: "existing", url, path: paths[i] ?? "" };
  });
  return base;
}

export default function EpiForm({
  open,
  onClose,
  idInspecao,
  idEmpresa,
  setores,
  riscos,
  epi,
}: Props) {
  const qc = useQueryClient();
  const iconeDe = useTipoIcone();
  const isEdit = !!epi;

  // Setor filtro — afeta só a lista de riscos exibida, não é persistido
  const [idSetorFiltro, setIdSetorFiltro] = useState<string>("");

  // ── Vários setores de uma vez (só ao ADICIONAR) ───────────────────────────
  // O EPI aponta para um RISCO, e o risco é de um setor: "Ruído" do Corte e
  // "Ruído" da Expedição são linhas diferentes. Por isso a escolha é de riscos,
  // agrupados por setor — cada risco marcado recebe os equipamentos escolhidos.
  // `setoresSel` só filtra a lista (vazio = todos); quem vale são `riscosSel`.
  const [setoresSel, setSetoresSel] = useState<string[]>([]);
  const [riscosSel, setRiscosSel] = useState<string[]>([]);

  const [form, setForm] = useState({
    id_risco: "",
    tipo: "EPI" as "EPI" | "EPC",
    descricao: "",
    ca: "",
    recomendado: "Sim" as "Sim" | "Não",
  });
  const [slots, setSlots] = useState<(FotoSlot | null)[]>([null, null, null, null]);

  // ── Multi-seleção (só ao ADICIONAR) ───────────────────────────────────────
  // Ao editar, o formulário continua sendo de um item só — mexer nisso mudaria
  // o comportamento de um registro que já existe.
  // `escolhidos` vêm da lista de sugestões; `extras` são digitados na hora e
  // aparecem com chip âmbar. A lista sugere, não trava.
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [extras, setExtras] = useState<string[]>([]);
  const [novoValor, setNovoValor] = useState("");
  const { data: sugestoes = [] } = useEpiSugestoes(form.tipo);

  // Ordem preservada e sem repetir o mesmo nome duas vezes (ignora maiúscula).
  const itens = useMemo(() => {
    const vistos = new Set<string>();
    const out: string[] = [];
    for (const d of [...escolhidos, ...extras]) {
      const v = d.trim();
      const k = v.toLowerCase();
      if (!v || vistos.has(k)) continue;
      vistos.add(k);
      out.push(v);
    }
    return out;
  }, [escolhidos, extras]);

  // Riscos que valem de fato: ao editar é o do select; ao adicionar, os marcados.
  const riscosAlvo = isEdit ? (form.id_risco ? [form.id_risco] : []) : riscosSel;
  const totalLinhas = isEdit ? 1 : itens.length * riscosAlvo.length;

  // CA é de CADA equipamento: com vários equipamentos não há valor único que
  // sirva. O mesmo equipamento em vários setores pode levar o mesmo CA.
  const varios = !isEdit && itens.length > 1;
  // Foto sobe uma vez para UMA linha: com 2+ linhas o mesmo arquivo seria
  // apontado por vários registros, e excluir um levaria a foto dos outros.
  const semFotos = !isEdit && totalLinhas > 1;

  // Riscos agrupados por setor, na ordem dos setores da inspeção.
  const nomeSetor = useMemo(
    () => new Map(setores.map((s) => [s.id_setor, s.setor_ghe])),
    [setores],
  );
  const grupos = useMemo(() => {
    const porSetor = new Map<string, Risco[]>();
    for (const r of riscos) {
      const k = r.id_setor ?? "";
      const arr = porSetor.get(k) ?? [];
      arr.push(r);
      porSetor.set(k, arr);
    }
    const ordem = [...setores.map((s) => s.id_setor), ""];
    return ordem
      .filter((k) => porSetor.has(k))
      .map((k) => ({
        idSetor: k,
        nome: k ? nomeSetor.get(k) ?? "Setor" : "Sem setor",
        riscos: porSetor.get(k)!,
      }));
  }, [riscos, setores, nomeSetor]);
  const gruposVisiveis = useMemo(
    () =>
      setoresSel.length ? grupos.filter((g) => setoresSel.includes(g.idSetor)) : grupos,
    [grupos, setoresSel],
  );

  const gemeosPendentes = useMemo(() => {
    const marcadas = new Set(
      riscos.filter((r) => riscosSel.includes(r.id_risco)).map(chaveRisco),
    );
    return gruposVisiveis
      .flatMap((g) => g.riscos)
      .filter((r) => !riscosSel.includes(r.id_risco) && marcadas.has(chaveRisco(r)))
      .map((r) => r.id_risco);
  }, [riscos, riscosSel, gruposVisiveis]);
  const setoresComRisco = new Set(
    riscos.filter((r) => riscosSel.includes(r.id_risco)).map((r) => r.id_setor ?? ""),
  ).size;

  function alternarRisco(id: string) {
    setRiscosSel((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  }

  // Rascunho contra queda de luz — guarda também o que já foi escolhido/digitado.
  const rascunhoValor = useMemo(
    () => ({ form, escolhidos, extras, setoresSel, riscosSel }),
    [form, escolhidos, extras, setoresSel, riscosSel],
  );
  const rascunho = useRascunho(`epi:${idInspecao}`, rascunhoValor, {
    ativo: open && !isEdit,
  });

  useEffect(() => {
    if (!open) return;
    setEscolhidos([]);
    setExtras([]);
    setNovoValor("");
    setSetoresSel([]);
    setRiscosSel([]);
    // Inicializa o setor filtro a partir do risco vinculado (ou do EPI)
    const riscoDoEpi = riscos.find((r) => r.id_risco === epi?.id_risco);
    setIdSetorFiltro(riscoDoEpi?.id_setor ?? epi?.id_setor ?? "");
    setForm({
      id_risco: epi?.id_risco ?? "",
      tipo: (epi?.tipo as "EPI" | "EPC") ?? "EPI",
      descricao: epi?.descricao ?? "",
      ca: epi?.ca ?? "",
      recomendado: (epi?.recomendado as "Sim" | "Não") ?? "Sim",
    });
    setSlots(buildSlots(epi?.fotos_urls ?? [], epi?.fotos_storage_paths ?? []));
  }, [open, epi, riscos]);

  // Riscos filtrados pelo setor selecionado
  const riscosFiltrados = useMemo(
    () =>
      idSetorFiltro
        ? riscos.filter((r) => r.id_setor === idSetorFiltro)
        : riscos,
    [riscos, idSetorFiltro],
  );

  // Quando muda o setor, limpa o risco se ele não pertence ao novo setor
  function handleSetorChange(novoSetor: string) {
    setIdSetorFiltro(novoSetor);
    const riscoAtual = riscos.find((r) => r.id_risco === form.id_risco);
    if (novoSetor && riscoAtual?.id_setor !== novoSetor) {
      setForm((f) => ({ ...f, id_risco: "" }));
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const setorDoRisco = (id: string) =>
        riscos.find((x) => x.id_risco === id)?.id_setor ?? null;

      // Com vários itens não há foto a subir: o upload só acontece quando o
      // registro é único, senão a mesma foto iria parar em N equipamentos.
      //
      // `prepararFotoSlots` decide os caminhos sem subir nada — quem sobe é o
      // `gravar()`, no momento certo, tenha rede ou não.
      const preparado = semFotos
        ? { urls: [] as string[], paths: [] as string[], imagens: [], paraRemover: [] }
        : prepararFotoSlots(
            supabase,
            slots,
            epi?.fotos_storage_paths ?? [],
            "fotos",
            `epi_epc/${idEmpresa}/${idInspecao}`,
            gerarId,
          );
      const { urls, paths, imagens, paraRemover } = preparado;

      // O EPI aponta para um risco, que pode ter sido criado offline e ainda
      // estar na fila. Enquanto o RiscoForm não entrar no offline isto devolve
      // sempre null — mas já fica certo para quando entrar.
      const criadores = await Promise.all(
        riscosAlvo.map((id) => operacaoPendenteQueCria("riscos", "id_risco", id)),
      );
      const pendentes = [...new Set(criadores.filter((c): c is string => !!c))];
      const depende_de = pendentes.length ? pendentes : undefined;

      const comum = {
        tipo: form.tipo,
        recomendado: form.recomendado,
      };

      let resultado;
      let linhas: EpiEpc[];

      if (isEdit && epi) {
        const payload = {
          ...comum,
          id_risco: form.id_risco,
          id_setor: setorDoRisco(form.id_risco),
          descricao: form.descricao.trim(),
          ca: form.ca.trim() || null,
          fotos_urls: urls,
          fotos_storage_paths: paths,
        };
        resultado = await gravar({
          tabela: "epi_epc",
          tipo: "update",
          linhas: payload,
          filtro: { id_protecao: epi.id_protecao },
          modulo: "inspecoes",
          id_documento: idInspecao,
          imagens,
          depende_de,
        });
        linhas = [{ ...epi, ...payload } as EpiEpc];
      } else {
        // Uma linha por equipamento × risco marcado, num insert só — se algo
        // falhar, não fica meia lista gravada (nem metade dos setores).
        const rows = riscosAlvo.flatMap((idRisco) =>
          itens.map((descricao) => ({
            id_protecao: gerarId("EPI"),
            id_inspecao: idInspecao,
            id_empresa: idEmpresa,
            ...comum,
            id_risco: idRisco,
            id_setor: setorDoRisco(idRisco),
            descricao,
            ca: varios ? null : form.ca.trim() || null,
            fotos_urls: urls,
            fotos_storage_paths: paths,
          })),
        );
        resultado = await gravar({
          tabela: "epi_epc",
          tipo: "insert",
          linhas: rows,
          filtro: null,
          modulo: "inspecoes",
          id_documento: idInspecao,
          imagens,
          depende_de,
        });
        linhas = rows as unknown as EpiEpc[];
      }

      // Faxina das fotos trocadas: só com rede, e sem deixar a gravação cair por
      // causa dela. Arquivo órfão no MinIO é desperdício de espaço, não erro —
      // já a gravação perdida seria trabalho perdido.
      if (resultado.destino === "SERVIDOR" && paraRemover.length > 0) {
        try {
          await supabase.storage.from("fotos").remove(paraRemover);
        } catch {
          /* silencioso de propósito */
        }
      }

      return { resultado, linhas };
    },
    onSuccess: ({ resultado, linhas }) => {
      rascunho.limpar();
      const n = linhas.length;

      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
        // A lista de sugestões passa a considerar o que acabou de ser cadastrado.
        qc.invalidateQueries({ queryKey: ["epi-sugestoes"] });
        toast.success(
          isEdit
            ? "Atualizado"
            : setoresComRisco > 1
            ? `${n} registros adicionados em ${setoresComRisco} setores`
            : n > 1
            ? `${n} equipamentos adicionados`
            : "Adicionado",
        );
      } else {
        // Sem rede não há o que revalidar: a lista da tela é atualizada à mão.
        qc.setQueryData<InspecaoFull>(["inspecao", idInspecao], (antigo) => {
          if (!antigo) return antigo;
          return {
            ...antigo,
            epis: isEdit
              ? antigo.epis.map((e) =>
                  e.id_protecao === linhas[0].id_protecao ? linhas[0] : e,
                )
              : [...antigo.epis, ...linhas],
          };
        });
        toast.success(
          n > 1 ? `${n} equipamentos guardados no aparelho` : "Guardado no aparelho",
          { icon: "📵" },
        );
      }

      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (isEdit && !form.descricao.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }
    if (!isEdit && itens.length === 0) {
      toast.error("Escolha ao menos um equipamento — ou digite um que não esteja na lista");
      return;
    }
    if (riscosAlvo.length === 0) {
      toast.error(isEdit ? "Vincule a um risco" : "Marque ao menos um risco");
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar Proteção" : "Adicionar EPI/EPC"}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {rascunho.pendente && (
          <AvisoRascunho
            idadeMin={rascunho.pendente.idadeMin}
            onRecuperar={() => {
              const v = rascunho.recuperar();
              if (!v) return;
              setForm(v.form);
              setEscolhidos(v.escolhidos);
              setExtras(v.extras);
              // Rascunho de antes desta mudança só tinha `form.id_risco`.
              const ids = new Set(riscos.map((r) => r.id_risco));
              setSetoresSel(v.setoresSel ?? []);
              setRiscosSel(
                (v.riscosSel ?? (v.form.id_risco ? [v.form.id_risco] : [])).filter((id) =>
                  ids.has(id),
                ),
              );
            }}
            onDescartar={rascunho.descartar}
          />
        )}
        {!isEdit ? (
          <>
            {/* 1. Setores — filtram a lista de riscos abaixo (nenhum = todos) */}
            <div>
              <label className={lblCls}>
                <Dica texto={DICAS_EPI.setores}>Setores</Dica>
                <span className="ml-1 text-xs font-normal text-gray-500">
                  (marque um ou vários; nenhum = todos)
                </span>
              </label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {grupos.map((g) => {
                  const ativo = setoresSel.includes(g.idSetor);
                  const marcados = g.riscos.filter((r) => riscosSel.includes(r.id_risco)).length;
                  return (
                    <button
                      key={g.idSetor || "_sem"}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() =>
                        setSetoresSel((v) =>
                          ativo ? v.filter((x) => x !== g.idSetor) : [...v, g.idSetor],
                        )
                      }
                      className={
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors " +
                        (ativo
                          ? "border-marca-primary bg-marca-light text-marca-primary"
                          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50")
                      }
                    >
                      {g.nome}
                      {marcados > 0 && (
                        <span className="ml-1 rounded-full bg-marca-primary px-1.5 text-[10px] text-white">
                          {marcados}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Riscos — agrupados por setor; cada marcado recebe os equipamentos */}
            <div>
              <label className={lblCls}>
                <Dica texto={DICAS_EPI.riscos}>Riscos vinculados</Dica> *
                {riscosSel.length > 0 && (
                  <span className="ml-1 text-xs font-normal text-gray-500">
                    ({riscosSel.length} marcado{riscosSel.length !== 1 ? "s" : ""} em{" "}
                    {setoresComRisco} setor{setoresComRisco !== 1 ? "es" : ""})
                  </span>
                )}
              </label>
              <div className="mt-1 max-h-64 space-y-2 overflow-y-auto rounded-md border border-gray-300 p-2">
                {gruposVisiveis.map((g) => (
                  <fieldset key={g.idSetor || "_sem"}>
                    <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {g.nome}
                    </legend>
                    {g.riscos.map((r) => (
                      <label
                        key={r.id_risco}
                        className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-gray-800 hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={riscosSel.includes(r.id_risco)}
                          onChange={() => alternarRisco(r.id_risco)}
                          className="size-4 accent-marca-primary"
                        />
                        <span>
                          {iconeDe(r.tipo_risco)} {r.tipo_risco} — {r.agente ?? r.id_risco}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                ))}
              </div>
              {gemeosPendentes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRiscosSel((v) => [...v, ...gemeosPendentes])}
                  className="mt-1 text-xs font-medium text-marca-primary hover:underline"
                >
                  + Marcar o mesmo risco nos outros setores ({gemeosPendentes.length})
                </button>
              )}
            </div>
          </>
        ) : (
          <>
        {/* 1. Setor — filtra os riscos abaixo */}
        <div>
          <label className={lblCls}><Dica texto={DICAS_EPI.setor}>Setor</Dica></label>
          <select
            value={idSetorFiltro}
            onChange={(e) => handleSetorChange(e.target.value)}
            className={inputCls}
          >
            <option value="">— Todos os setores —</option>
            {setores.map((s) => (
              <option key={s.id_setor} value={s.id_setor}>
                {s.setor_ghe}
              </option>
            ))}
          </select>
          {idSetorFiltro && riscosFiltrados.length === 0 && (
            <p className="mt-1 text-xs text-amber-700">
              Nenhum risco cadastrado para este setor.
            </p>
          )}
        </div>

        {/* 2. Risco vinculado — filtrado pelo setor */}
        <div>
          <label className={lblCls}>
            <Dica texto={DICAS_EPI.risco}>Risco vinculado</Dica> *
            {idSetorFiltro && riscosFiltrados.length > 0 && (
              <span className="ml-1 text-xs font-normal text-gray-500">
                ({riscosFiltrados.length} risco{riscosFiltrados.length !== 1 ? "s" : ""} neste setor)
              </span>
            )}
          </label>
          <select
            value={form.id_risco}
            onChange={(e) => setForm({ ...form, id_risco: e.target.value })}
            className={inputCls}
            required
          >
            <option value="">Selecione...</option>
            {riscosFiltrados.map((r) => (
              <option key={r.id_risco} value={r.id_risco}>
                {iconeDe(r.tipo_risco)} {r.tipo_risco} —{" "}
                {r.agente ?? r.id_risco}
              </option>
            ))}
          </select>
        </div>
          </>
        )}

        {/* 3. Tipo + Recomendado */}
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={lblCls}><Dica texto={DICAS_EPI.tipo}>Tipo</Dica></label>
            <select
              value={form.tipo}
              onChange={(e) =>
                setForm({ ...form, tipo: e.target.value as "EPI" | "EPC" })
              }
              className={inputCls}
            >
              <option value="EPI">EPI</option>
              <option value="EPC">EPC</option>
            </select>
          </div>
          <div>
            <label className={lblCls}><Dica texto={DICAS_EPI.recomendado}>Recomendado</Dica></label>
            <select
              value={form.recomendado}
              onChange={(e) =>
                setForm({
                  ...form,
                  recomendado: e.target.value as "Sim" | "Não",
                })
              }
              className={inputCls}
            >
              <option value="Sim">Sim</option>
              <option value="Não">Não</option>
            </select>
          </div>
        </div>

        {/* 4. Equipamento(s) — lista ao adicionar, campo único ao editar */}
        <div>
          <label className={lblCls}>
            {isEdit ? <><Dica texto={DICAS_EPI.descricao}>Descrição</Dica> *</> : "Equipamentos *"}
            {!isEdit && (
              <span className="ml-1 text-xs font-normal text-gray-500">
                (escolha da lista ou digite um novo)
              </span>
            )}
          </label>
          {isEdit ? (
            <input
              type="text"
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              className={inputCls}
              required
            />
          ) : (
            <div className="mt-1">
              <ComboTagInline
                tamanho="normal"
                opcoes={sugestoes}
                selecionados={escolhidos}
                extras={extras}
                novoValor={novoValor}
                onToggle={(item) =>
                  setEscolhidos((v) =>
                    v.includes(item) ? v.filter((x) => x !== item) : [...v, item],
                  )
                }
                onAdd={() => {
                  const v = novoValor.trim();
                  if (!v) return;
                  setExtras((e) => [...e, v]);
                  setNovoValor("");
                }}
                onRemoveExtra={(i) => setExtras((e) => e.filter((_, j) => j !== i))}
                onNovoValor={setNovoValor}
                placeholder={`Buscar ${form.tipo}...`}
                vazioLabel="Nenhuma sugestão ainda — digite para cadastrar o equipamento."
              />
              <p className="mt-1 text-xs text-gray-500">
                As sugestões saem do que já foi cadastrado. O de cor âmbar é novo e
                será gravado do jeito que você escreveu.
              </p>
            </div>
          )}
        </div>

        {/* 5 e 6. CA é de cada equipamento; foto é de cada registro */}
        {!isEdit && totalLinhas > 1 && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <strong>
              Serão criados {totalLinhas} registros
              {riscosAlvo.length > 1 &&
                ` (${itens.length} equipamento${itens.length !== 1 ? "s" : ""} × ${riscosAlvo.length} riscos)`}
              .
            </strong>{" "}
            {varios ? "CA e fotos" : "Fotos"} não aparecem aqui — adicione e depois
            edite item a item para preencher.
          </p>
        )}
        {!varios && (
          <div>
            <label className={lblCls}><Dica texto={DICAS_EPI.ca}>Certificado de Aprovação (CA)</Dica></label>
            <input
              type="text"
              value={form.ca}
              onChange={(e) => setForm({ ...form, ca: e.target.value })}
              className={inputCls}
            />
          </div>
        )}
        {!semFotos && (
          <>
            <div>
              <label className={lblCls}>
                Fotos{" "}
                <span className="text-xs font-normal text-gray-500">(até 4)</span>
              </label>
              <div className="mt-1">
                <FotoSlots slots={slots} onChange={setSlots} max={4} />
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-md bg-marca-primary px-4 py-2 text-sm font-semibold text-white hover:bg-marca-accent disabled:opacity-60"
          >
            {mutation.isPending
              ? "Salvando..."
              : isEdit
              ? "Salvar"
              : totalLinhas > 1
              ? `Adicionar ${totalLinhas}`
              : "Adicionar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// "Mesmo risco" = mesmo tipo + mesmo agente (sem ligar para maiúscula).
const chaveRisco = (r: Risco) =>
  `${r.tipo_risco}|${(r.agente ?? "").trim().toLowerCase()}`;

const inputCls =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-marca-primary focus:outline-none focus:ring-2 focus:ring-marca-primary/30";
const lblCls = "text-sm font-medium text-gray-700";

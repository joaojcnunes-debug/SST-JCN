"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import AvisoRascunho from "@/components/ui/AvisoRascunho";
import { gravar } from "@/lib/offline/gravar";
import type { InspecaoFull } from "@/lib/hooks/useInspecao";
import { gerarId } from "@/lib/utils";
import { useTipoIcone } from "@/lib/hooks/useV3";
import { useRascunho } from "@/lib/hooks/useRascunho";
import type {
  Cargo,
  Risco,
  Setor,
  TreinamentoNR,
} from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onClose: () => void;
  idInspecao: string;
  idEmpresa: string;
  editing: TreinamentoNR | null;
  setores: Setor[];
  cargos: Cargo[];
  riscos: Risco[];
  /**
   * Ids dos setores/cargos/riscos JÁ vinculados ao treinamento em edição.
   * Vazio quando criando novo.
   */
  vinculados: {
    setores: string[];
    cargos: string[];
    riscos: string[];
  };
}

/** Lista de NRs comuns pra autocompletar no campo. */
const NRS_COMUNS = [
  "NR-01 — Disposições Gerais e GRO",
  "NR-04 — SESMT",
  "NR-05 — CIPA",
  "NR-06 — EPI",
  "NR-07 — PCMSO",
  "NR-09 — Avaliação e Controle de Exposições",
  "NR-10 — Segurança em Instalações Elétricas",
  "NR-11 — Transporte e Movimentação de Materiais",
  "NR-12 — Máquinas e Equipamentos",
  "NR-13 — Caldeiras, Vasos de Pressão",
  "NR-15 — Insalubridade",
  "NR-16 — Periculosidade",
  "NR-17 — Ergonomia",
  "NR-18 — Construção Civil",
  "NR-20 — Inflamáveis e Combustíveis",
  "NR-23 — Proteção Contra Incêndios",
  "NR-26 — Sinalização de Segurança",
  "NR-31 — Trabalho Rural",
  "NR-33 — Espaços Confinados",
  "NR-35 — Trabalho em Altura",
  "NR-36 — Frigoríficos",
];

const PERIODICIDADES = [
  "Inicial",
  "Periódico",
  "Reciclagem anual",
  "Reciclagem bienal",
  "Eventual",
];

export default function TreinamentoForm({
  open,
  onClose,
  idInspecao,
  idEmpresa,
  editing,
  setores,
  cargos,
  riscos,
  vinculados,
}: Props) {
  const qc = useQueryClient();
  const iconeDe = useTipoIcone();

  const [nr, setNr] = useState("");
  const [titulo, setTitulo] = useState("");
  // Rastreia o último auto-fill — permite re-replicar a descrição ao
  // trocar de NR, sem sobrescrever um título que o usuário editou
  // manualmente.
  const ultimoAutofillRef = useRef<string>("");
  const [cargaHoraria, setCargaHoraria] = useState("");
  const [periodicidade, setPeriodicidade] = useState("");
  const [descricao, setDescricao] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [ordem, setOrdem] = useState(99);
  const [idsSetores, setIdsSetores] = useState<string[]>([]);
  const [idsCargos, setIdsCargos] = useState<string[]>([]);
  const [idsRiscos, setIdsRiscos] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setNr(editing?.nr ?? "");
    setTitulo(editing?.titulo ?? "");
    setCargaHoraria(editing?.carga_horaria ?? "");
    setPeriodicidade(editing?.periodicidade ?? "");
    setDescricao(editing?.descricao ?? "");
    setObservacoes(editing?.observacoes ?? "");
    setOrdem(editing?.ordem ?? 99);
    setIdsSetores(vinculados.setores);
    setIdsCargos(vinculados.cargos);
    setIdsRiscos(vinculados.riscos);
  }, [open, editing, vinculados]);

  // Rascunho contra queda de luz — só ao criar; nada volta sem clique.
  const rascunhoValor = useMemo(
    () => ({ nr, titulo, cargaHoraria, periodicidade, descricao, observacoes,
             ordem, idsSetores, idsCargos, idsRiscos }),
    [nr, titulo, cargaHoraria, periodicidade, descricao, observacoes,
     ordem, idsSetores, idsCargos, idsRiscos],
  );
  const rascunho = useRascunho(`treinamento:${idInspecao}`, rascunhoValor, {
    ativo: open && !editing,
  });

  function recuperarRascunho() {
    const v = rascunho.recuperar();
    if (!v) return;
    setNr(v.nr);
    setTitulo(v.titulo);
    setCargaHoraria(v.cargaHoraria);
    setPeriodicidade(v.periodicidade);
    setDescricao(v.descricao);
    setObservacoes(v.observacoes);
    setOrdem(v.ordem);
    setIdsSetores(v.idsSetores);
    setIdsCargos(v.idsCargos);
    setIdsRiscos(v.idsRiscos);
  }

  // Risco precisa de nome legível — montamos label "Tipo · Agente · Setor"
  const riscosLabels = useMemo(() => {
    const setorPorId = new Map(setores.map((s) => [s.id_setor, s.setor_ghe]));
    return riscos.map((r) => ({
      id: r.id_risco,
      label: `${iconeDe(r.tipo_risco)} ${r.tipo_risco} — ${r.agente ?? "(sem agente)"}${
        r.id_setor ? ` · ${setorPorId.get(r.id_setor) ?? ""}` : ""
      }`,
    }));
  }, [riscos, setores, iconeDe]);

  const save = useMutation({
    mutationFn: async () => {
      if (!nr.trim()) throw new Error("NR é obrigatória");
      if (!titulo.trim()) throw new Error("Título é obrigatório");

      const idTreinamento = editing?.id_treinamento ?? gerarId("TRE");
      const payload: Partial<TreinamentoNR> & { id_treinamento: string } = {
        id_treinamento: idTreinamento,
        id_inspecao: idInspecao,
        id_empresa: idEmpresa,
        nr: nr.trim(),
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        carga_horaria: cargaHoraria.trim() || null,
        periodicidade: periodicidade.trim() || null,
        observacoes: observacoes.trim() || null,
        ordem,
        ativo: editing?.ativo ?? true,
        updated_at: new Date().toISOString(),
      };

      /**
       * Sete operações no pior caso: o treinamento, três limpezas de relação e
       * três reinserções. Encadeadas por dependência, e não só pela ordem.
       *
       * A ordem sozinha já colocaria cada uma no lugar certo — a fila é
       * sequencial. O que a cascata evita é o caso feio: se a limpeza de setores
       * for recusada, a reinserção NÃO pode ser tentada, senão o treinamento
       * termina com os setores antigos e os novos juntos. Melhor segurar e
       * mostrar uma pendência do que gravar um vínculo que ninguém pediu.
       */
      const anteriores: string[] = [];
      const passo = async (pedido: Parameters<typeof gravar>[0]) => {
        const r = await gravar({
          ...pedido,
          depende_de: anteriores.length > 0 ? [...anteriores] : undefined,
        });
        if (r.destino === "APARELHO") anteriores.push(r.idOperacao);
        return r;
      };

      const principal = await passo({
        tabela: "treinamentos_nr",
        tipo: "upsert",
        linhas: payload as Record<string, unknown>,
        filtro: null,
        conflito: "id_treinamento",
        modulo: "inspecoes",
        id_documento: idInspecao,
      });

      // Reseta relações M:N do treinamento (delete-all → reinsert-novas)
      if (editing) {
        for (const tabela of [
          "treinamentos_setor",
          "treinamentos_cargo",
          "treinamentos_risco",
        ]) {
          await passo({
            tabela,
            tipo: "delete",
            linhas: null,
            filtro: { id_treinamento: idTreinamento },
            modulo: "inspecoes",
            id_documento: idInspecao,
          });
        }
      }

      const relacoes: { tabela: string; coluna: string; ids: string[] }[] = [
        { tabela: "treinamentos_setor", coluna: "id_setor", ids: idsSetores },
        { tabela: "treinamentos_cargo", coluna: "id_cargo", ids: idsCargos },
        { tabela: "treinamentos_risco", coluna: "id_risco", ids: idsRiscos },
      ];

      for (const { tabela, coluna, ids } of relacoes) {
        if (ids.length === 0) continue;
        await passo({
          tabela,
          tipo: "insert",
          linhas: ids.map((id) => ({ id_treinamento: idTreinamento, [coluna]: id })),
          filtro: null,
          modulo: "inspecoes",
          id_documento: idInspecao,
        });
      }

      return {
        destino: principal.destino,
        linha: payload as unknown as TreinamentoNR,
        idTreinamento,
      };
    },
    onSuccess: ({ destino, linha, idTreinamento }) => {
      rascunho.limpar();

      if (destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
        toast.success(editing ? "Treinamento atualizado" : "Treinamento criado");
      } else {
        // Sem rede não há o que revalidar: a lista da tela é atualizada à mão,
        // relações inclusive — senão o treinamento apareceria sem os setores e
        // cargos que o técnico acabou de marcar.
        qc.setQueryData<InspecaoFull>(["inspecao", idInspecao], (antigo) => {
          if (!antigo) return antigo;
          const jaExiste = antigo.treinamentos.some(
            (t) => t.id_treinamento === idTreinamento,
          );
          const semAsAntigas = <T extends { id_treinamento: string }>(lista: T[]) =>
            lista.filter((x) => x.id_treinamento !== idTreinamento);
          return {
            ...antigo,
            treinamentos: jaExiste
              ? antigo.treinamentos.map((t) =>
                  t.id_treinamento === idTreinamento ? linha : t,
                )
              : [...antigo.treinamentos, linha],
            treinamentosSetor: [
              ...semAsAntigas(antigo.treinamentosSetor),
              ...idsSetores.map(
                (id) =>
                  ({ id_treinamento: idTreinamento, id_setor: id }) as unknown as
                    (typeof antigo.treinamentosSetor)[number],
              ),
            ],
            treinamentosCargo: [
              ...semAsAntigas(antigo.treinamentosCargo),
              ...idsCargos.map(
                (id) =>
                  ({ id_treinamento: idTreinamento, id_cargo: id }) as unknown as
                    (typeof antigo.treinamentosCargo)[number],
              ),
            ],
            treinamentosRisco: [
              ...semAsAntigas(antigo.treinamentosRisco),
              ...idsRiscos.map(
                (id) =>
                  ({ id_treinamento: idTreinamento, id_risco: id }) as unknown as
                    (typeof antigo.treinamentosRisco)[number],
              ),
            ],
          };
        });
        toast.success("Treinamento guardado no aparelho", { icon: "📵" });
      }

      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  function toggleItem(lista: string[], setLista: (v: string[]) => void, id: string) {
    setLista(
      lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar Treinamento" : "Novo Treinamento"}
      size="xl"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {rascunho.pendente && (
          <AvisoRascunho
            idadeMin={rascunho.pendente.idadeMin}
            onRecuperar={recuperarRascunho}
            onDescartar={rascunho.descartar}
          />
        )}
        {/* Linha 1: NR + Título */}
        <div className="grid gap-3 md:grid-cols-[200px_1fr]">
          <div>
            <label className="text-sm font-medium text-gray-700">NR *</label>
            <input
              type="text"
              list="nrs-comuns"
              value={nr}
              onChange={(e) => {
                const valor = e.target.value;
                // Se o valor tem " — " (formato da datalist), divide
                // em código + descrição e preenche o título.
                if (valor.includes(" — ")) {
                  const [codigo, ...descParts] = valor.split(" — ");
                  const desc = descParts.join(" — ").trim();
                  setNr(codigo.trim());
                  // Só sobrescreve o título se estiver vazio OU se
                  // ainda for o auto-fill anterior (não manualmente
                  // editado).
                  if (titulo === "" || titulo === ultimoAutofillRef.current) {
                    setTitulo(desc);
                    ultimoAutofillRef.current = desc;
                  }
                } else {
                  setNr(valor);
                }
              }}
              required
              placeholder="Ex: NR-06"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            />
            <datalist id="nrs-comuns">
              {NRS_COMUNS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Título *</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              placeholder="Ex: Treinamento inicial em EPI"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            />
          </div>
        </div>

        {/* Linha 2: Carga Horária + Periodicidade + Ordem */}
        <div className="grid gap-3 md:grid-cols-[160px_1fr_100px]">
          <div>
            <label className="text-sm font-medium text-gray-700">Carga horária</label>
            <input
              type="text"
              value={cargaHoraria}
              onChange={(e) => setCargaHoraria(e.target.value)}
              placeholder="Ex: 8h, 20h"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Periodicidade</label>
            <input
              type="text"
              list="periodicidades"
              value={periodicidade}
              onChange={(e) => setPeriodicidade(e.target.value)}
              placeholder="Ex: Reciclagem anual"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            />
            <datalist id="periodicidades">
              {PERIODICIDADES.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Ordem</label>
            <input
              type="number"
              value={ordem}
              onChange={(e) => setOrdem(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Descrição */}
        <div>
          <label className="text-sm font-medium text-gray-700">Descrição</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={2}
            placeholder="Detalhes do treinamento (opcional)"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          />
        </div>

        {/* Direcionamento — Setores */}
        <Section
          titulo="Setores aplicáveis"
          desc="Marque os setores que precisam deste treinamento."
          cor="amber"
        >
          {setores.length === 0 ? (
            <p className="text-[11px] text-gray-500">Nenhum setor cadastrado.</p>
          ) : (
            <CheckPills
              items={setores.map((s) => ({
                id: s.id_setor,
                label: s.setor_ghe,
              }))}
              selecionados={idsSetores}
              onToggle={(id) => toggleItem(idsSetores, setIdsSetores, id)}
            />
          )}
        </Section>

        {/* Direcionamento — Cargos */}
        <Section
          titulo="Cargos aplicáveis"
          desc="Marque os cargos que devem participar."
          cor="blue"
        >
          {cargos.length === 0 ? (
            <p className="text-[11px] text-gray-500">Nenhum cargo cadastrado.</p>
          ) : (
            <CheckPills
              items={cargos.map((c) => ({ id: c.id_cargo, label: c.cargo }))}
              selecionados={idsCargos}
              onToggle={(id) => toggleItem(idsCargos, setIdsCargos, id)}
            />
          )}
        </Section>

        {/* Direcionamento — Riscos */}
        <Section
          titulo="Riscos aplicáveis"
          desc="Riscos que justificam este treinamento."
          cor="red"
        >
          {riscos.length === 0 ? (
            <p className="text-[11px] text-gray-500">Nenhum risco cadastrado.</p>
          ) : (
            <CheckPills
              items={riscosLabels}
              selecionados={idsRiscos}
              onToggle={(id) => toggleItem(idsRiscos, setIdsRiscos, id)}
            />
          )}
        </Section>

        {/* Observações */}
        <div>
          <label className="text-sm font-medium text-gray-700">Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          />
        </div>

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
            disabled={save.isPending}
            className="rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
          >
            {save.isPending ? "Salvando..." : editing ? "Salvar" : "Criar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Section({
  titulo,
  desc,
  cor,
  children,
}: {
  titulo: string;
  desc: string;
  cor: "amber" | "blue" | "red";
  children: React.ReactNode;
}) {
  const cfg = {
    amber: "border-amber-200 bg-amber-50/30 text-amber-800",
    blue: "border-blue-200 bg-blue-50/30 text-blue-800",
    red: "border-red-200 bg-red-50/30 text-red-800",
  }[cor];
  return (
    <section className={`space-y-2 rounded-lg border p-3 ${cfg}`}>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider">{titulo}</p>
        <p className="text-[11px] text-gray-600">{desc}</p>
      </div>
      {children}
    </section>
  );
}

function CheckPills({
  items,
  selecionados,
  onToggle,
}: {
  items: Array<{ id: string; label: string }>;
  selecionados: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => {
        const checked = selecionados.includes(it.id);
        return (
          <label
            key={it.id}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${
              checked
                ? "border-verde-primary bg-verde-light text-verde-primary"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(it.id)}
              className="rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30"
            />
            {it.label}
          </label>
        );
      })}
    </div>
  );
}

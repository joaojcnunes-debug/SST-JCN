"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, Trash2, Upload, Pencil, Check, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import NivelBadge from "@/components/riscos/NivelBadge";
import SetorMultiSelect from "./SetorMultiSelect";
import MeiosPropagacaoMultiSelect from "./MeiosPropagacaoMultiSelect";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId, parseMedidas, stringifyMedidas } from "@/lib/utils";
import { calcularNivelComMatriz } from "@/lib/calc";
import {
  useMatrizAtiva,
  useMatrizes,
  useTiposRisco,
  usePerguntasPorTipo,
  useCatalogoPorTipo,
  useModelosPorTipo,
  useItensModelo,
  usePerguntasDoModelo,
  useTriagensPorTipo,
  useRelacoesDeTriagens,
} from "@/lib/hooks/useV3";
import {
  PERGUNTAS_QUIMICAS,
  FATORES_ERGONOMICOS,
  FATORES_PSICOSSOCIAIS,
  MEIOS_PROPAGACAO_DEFAULT,
  SITUACOES_DEFAULT,
  TEMPOS_EXPOSICAO_DEFAULT,
  TECNICAS_DEFAULT,
} from "@/lib/constants";
import type {
  CategoriaCatalogo,
  ItemCatalogoTipo,
  ItemModeloRisco,
  PerguntaModeloRisco,
  PerguntaTipoRisco,
} from "@/lib/supabase/types";
import type {
  Cargo,
  EpiEpc,
  Risco,
  Setor,
  TipoRisco,
} from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onClose: () => void;
  idInspecao: string;
  idEmpresa: string;
  setores: Setor[];
  cargos: Cargo[];
  risco?: Risco | null;
}

interface FormState {
  tipo_risco: string;
  id_modelo: string;
  // V8: triagem escolhida (cascata Tipo → Triagem → Modelos vinculados).
  // Vazio = sem triagem (usuário preenche agente livre).
  id_triagem_selecionada: string;
  // IDs dos modelos marcados via checkbox dentro da triagem escolhida.
  // Cada modelo marcado vira 1 risco no save (cross-product com setores).
  triagem_modelos_ids: string[];
  id_matriz: string;
  agente: string;
  // V6: lista de fontes geradoras (parallel a medidas/EPIs).
  // Persistida como JSON.stringify em risco.fonte_geradora (texto único).
  fontes_geradoras_lista: string[];
  ids_setores: string[];
  id_cargo: string;
  probabilidade: string;
  severidade: string;
  meio_propagacao: string[];
  situacao: string;
  tempo_exposicao: string;
  tecnica_utilizada: string;
  concentracao_exposicao: string;
  limite_tolerancia: string;
  insalubridade: string;
  periculosidade: string;
  numero_cas: string;
  via_absorcao: string;
  tipo_agente_biologico: string;
  fator_ergonomico: string;
  fator_psicossocial: string;
  pontuacao_iapat: string;
  fisico_necessita_medicao: string;
  fisico_qual_medicao: string;
  fisico_motivo_medicao: string;
  quim_q1: string;
  quim_q2: string;
  quim_q3: string;
  quim_q4: string;
  quim_q5: string;
  quim_q6: string;
  uso_processo: string;
  foto_quim_url: string;
  medidas_adotadas_lista: string[];
  medidas_recomendadas_lista: string[];
  observacoes_risco: string;
  respostas_custom: Record<string, string>;
  /**
   * EPIs/EPCs adicionados durante a CRIAÇÃO do risco. Ficam em buffer
   * local até o risco ser salvo; depois são inseridos em batch
   * (replicados pra cada setor selecionado em multi-setor).
   * Ignorado em modo edit — lá usamos persistência imediata via EpiInline.
   */
  epis_pendentes: EpiPendente[];
}

interface EpiPendente {
  tipo: "EPI" | "EPC";
  descricao: string;
  ca: string | null;
  recomendado: "Sim" | "Não";
}

function emptyForm(): FormState {
  return {
    tipo_risco: "Físico",
    id_modelo: "",
    id_triagem_selecionada: "",
    triagem_modelos_ids: [],
    id_matriz: "",
    agente: "",
    fontes_geradoras_lista: [],
    ids_setores: [],
    id_cargo: "",
    probabilidade: "Ocasional",
    severidade: "Marginal",
    meio_propagacao: [],
    situacao: "",
    tempo_exposicao: "",
    tecnica_utilizada: "",
    concentracao_exposicao: "",
    limite_tolerancia: "",
    insalubridade: "",
    periculosidade: "",
    numero_cas: "",
    via_absorcao: "",
    tipo_agente_biologico: "",
    fator_ergonomico: "",
    fator_psicossocial: "",
    pontuacao_iapat: "",
    fisico_necessita_medicao: "",
    fisico_qual_medicao: "",
    fisico_motivo_medicao: "",
    quim_q1: "",
    quim_q2: "",
    quim_q3: "",
    quim_q4: "",
    quim_q5: "",
    quim_q6: "",
    uso_processo: "",
    foto_quim_url: "",
    medidas_adotadas_lista: [],
    medidas_recomendadas_lista: [],
    observacoes_risco: "",
    respostas_custom: {},
    epis_pendentes: [],
  };
}

export default function RiscoForm({
  open,
  onClose,
  idInspecao,
  idEmpresa,
  setores,
  cargos,
  risco,
}: Props) {
  const qc = useQueryClient();
  const isEdit = !!risco;
  const [form, setForm] = useState<FormState>(emptyForm);

  // V3: matriz, tipos e perguntas vêm do banco (admin edita pela UI).
  const { data: matrizAtiva } = useMatrizAtiva();
  const { data: matrizes = [] } = useMatrizes();
  const { data: tiposCustom = [] } = useTiposRisco();
  const idTipoSelecionado = useMemo(
    () => tiposCustom.find((t) => t.nome === form.tipo_risco)?.id_tipo,
    [tiposCustom, form.tipo_risco]
  );
  const { data: perguntasCustom = [] } =
    usePerguntasPorTipo(idTipoSelecionado);

  // V4: catálogo do tipo selecionado popula sugestões dos selects/datalists
  // (usado quando NÃO há modelo escolhido).
  const { data: catalogo = [] } = useCatalogoPorTipo(idTipoSelecionado);

  // V5: modelos do tipo. Cada modelo é um "kit" centrado num agente.
  const { data: modelos = [] } = useModelosPorTipo(idTipoSelecionado);
  const modeloSelecionado = useMemo(
    () => modelos.find((m) => m.id_modelo === form.id_modelo) ?? null,
    [modelos, form.id_modelo]
  );
  const itensModeloQ = useItensModelo(form.id_modelo || null);
  const itensModelo = useMemo(
    () => itensModeloQ.data ?? [],
    [itensModeloQ.data]
  );
  const perguntasModeloQ = usePerguntasDoModelo(form.id_modelo || null, {
    somenteAtivas: true,
  });
  const perguntasModelo = useMemo(
    () => perguntasModeloQ.data ?? [],
    [perguntasModeloQ.data]
  );

  // V8: triagens do tipo + relações triagem→modelo (carregadas em batch via .in)
  const { data: triagens = [] } = useTriagensPorTipo(idTipoSelecionado);
  const idsTriagens = useMemo(
    () => triagens.map((t) => t.id_triagem),
    [triagens]
  );
  const { data: relacoesTriagem = [] } = useRelacoesDeTriagens(idsTriagens);
  /** Map<id_triagem, ModeloRisco[]> — modelos associados a cada triagem. */
  const modelosPorTriagem = useMemo(() => {
    const acc = new Map<string, typeof modelos>();
    for (const r of relacoesTriagem) {
      const m = modelos.find((x) => x.id_modelo === r.id_modelo);
      if (!m) continue;
      const arr = acc.get(r.id_triagem) ?? [];
      arr.push(m);
      acc.set(r.id_triagem, arr);
    }
    return acc;
  }, [relacoesTriagem, modelos]);

  // Sugestões: se há modelo escolhido, usa itens do modelo como datalist.
  // Senão, fallback pra biblioteca compartilhada (V4).
  const sugestoesPorCategoria = useMemo(() => {
    const acc = {} as Record<CategoriaCatalogo, string[]>;
    if (form.id_modelo && itensModelo.length > 0) {
      for (const i of itensModelo) {
        const arr = acc[i.categoria as CategoriaCatalogo] ?? [];
        arr.push(i.texto);
        acc[i.categoria as CategoriaCatalogo] = arr;
      }
      // Mesmo com modelo, agente/fonte ainda vêm da biblioteca pra dar
      // autocomplete de outros modelos do mesmo tipo.
      for (const i of catalogo) {
        if (i.categoria === "agente" || i.categoria === "fonte_geradora") {
          const arr = acc[i.categoria] ?? [];
          arr.push(i.texto);
          acc[i.categoria] = arr;
        }
      }
    } else {
      for (const i of catalogo) {
        const arr = acc[i.categoria] ?? [];
        arr.push(i.texto);
        acc[i.categoria] = arr;
      }
    }
    return acc;
  }, [catalogo, itensModelo, form.id_modelo]);

  // V3.1: cada risco pode ter sua própria matriz. Se não tiver,
  // cai no fallback global (matriz ativa).
  const matrizSelecionada = useMemo(() => {
    if (form.id_matriz) {
      return matrizes.find((m) => m.id_matriz === form.id_matriz) ?? null;
    }
    return matrizAtiva ?? null;
  }, [form.id_matriz, matrizes, matrizAtiva]);

  // Listas dinâmicas vindas da matriz SELECIONADA (não mais da ativa global).
  const probsLista = matrizSelecionada?.probabilidades ?? [
    "Improvável",
    "Remoto",
    "Ocasional",
    "Provável",
    "Frequente",
  ];
  const sevsLista = matrizSelecionada?.severidades ?? [
    "Insignificante",
    "Marginal",
    "Crítico",
    "Catastrófico",
  ];

  useEffect(() => {
    if (!open) return;
    if (risco) {
      setForm({
        tipo_risco: risco.tipo_risco ?? "Físico",
        id_modelo: risco.id_modelo ?? "",
        // Edit não preserva seleção de triagem — campo é só pra create flow
        id_triagem_selecionada: "",
        triagem_modelos_ids: [],
        id_matriz: risco.id_matriz ?? "",
        agente: risco.agente ?? "",
        fontes_geradoras_lista: parseMedidas(risco.fonte_geradora),
        ids_setores: risco.id_setor ? [risco.id_setor] : [],
        id_cargo: risco.id_cargo ?? "",
        probabilidade: risco.probabilidade ?? probsLista[Math.floor(probsLista.length / 2)] ?? "",
        severidade: risco.severidade ?? sevsLista[Math.floor(sevsLista.length / 2)] ?? "",
        meio_propagacao: risco.meio_propagacao ?? [],
        situacao: risco.situacao ?? "",
        tempo_exposicao: risco.tempo_exposicao ?? "",
        tecnica_utilizada: risco.tecnica_utilizada ?? "",
        concentracao_exposicao: risco.concentracao_exposicao ?? "",
        limite_tolerancia: risco.limite_tolerancia ?? "",
        insalubridade: risco.insalubridade ?? "",
        periculosidade: risco.periculosidade ?? "",
        numero_cas: risco.numero_cas ?? "",
        via_absorcao: risco.via_absorcao ?? "",
        tipo_agente_biologico: risco.tipo_agente_biologico ?? "",
        fator_ergonomico: risco.fator_ergonomico ?? "",
        fator_psicossocial: risco.fator_psicossocial ?? "",
        pontuacao_iapat: risco.pontuacao_iapat ?? "",
        fisico_necessita_medicao: risco.fisico_necessita_medicao ?? "",
        fisico_qual_medicao: risco.fisico_qual_medicao ?? "",
        fisico_motivo_medicao: risco.fisico_motivo_medicao ?? "",
        quim_q1: risco.quim_q1 ?? "",
        quim_q2: risco.quim_q2 ?? "",
        quim_q3: risco.quim_q3 ?? "",
        quim_q4: risco.quim_q4 ?? "",
        quim_q5: risco.quim_q5 ?? "",
        quim_q6: risco.quim_q6 ?? "",
        uso_processo: risco.uso_processo ?? "",
        foto_quim_url: risco.foto_quim_url ?? "",
        medidas_adotadas_lista: parseMedidas(risco.medidas_adotadas),
        medidas_recomendadas_lista: parseMedidas(risco.medidas_recomendadas),
        observacoes_risco: risco.observacoes_risco ?? "",
        respostas_custom: (risco.respostas_custom ?? {}) as Record<
          string,
          string
        >,
        epis_pendentes: [],
      });
    } else {
      setForm(emptyForm());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, risco]);

  const cargosDoSetor = useMemo(() => {
    const primSetor = form.ids_setores[0];
    if (!primSetor) return [];
    return cargos.filter((c) => c.id_setor === primSetor);
  }, [cargos, form.ids_setores]);

  const nivel = calcularNivelComMatriz(
    form.probabilidade,
    form.severidade,
    matrizSelecionada
  );

  /**
   * V8: liga/desliga um modelo via triagem (multi-select).
   *
   * Regras:
   *   - 0 marcados: comportamento livre (usuário digita agente).
   *   - 1 marcado: aplica o modelo (autofill agente/fonte/EPIs/medidas).
   *   - 2+ marcados: limpa agente/modelo (cada um vira 1 risco no save).
   */
  function toggleModeloTriagem(idModelo: string) {
    const isChecked = form.triagem_modelos_ids.includes(idModelo);
    const novaLista = isChecked
      ? form.triagem_modelos_ids.filter((x) => x !== idModelo)
      : [...form.triagem_modelos_ids, idModelo];

    if (novaLista.length === 1) {
      const m = modelos.find((x) => x.id_modelo === novaLista[0]);
      setForm((f) => ({
        ...f,
        triagem_modelos_ids: novaLista,
        id_modelo: novaLista[0],
        agente: m?.agente ?? "",
      }));
      return;
    }

    // 0 ou 2+: limpa modelo/agente, só atualiza a lista
    setForm((f) => ({
      ...f,
      triagem_modelos_ids: novaLista,
      id_modelo: "",
      agente: novaLista.length === 0 ? f.agente : "",
    }));
  }

  /**
   * Reage ao input do campo Agente: se o texto bater com o nome de
   * algum modelo (case-insensitive), aplica o kit do modelo. Senão,
   * fica em modo livre (id_modelo zerado).
   */
  function onAgenteChange(valor: string) {
    const match = modelos.find(
      (m) => m.agente.toLowerCase() === valor.trim().toLowerCase()
    );
    if (match) {
      aplicarModelo(match.id_modelo);
    } else {
      setForm((f) => ({ ...f, agente: valor, id_modelo: "" }));
    }
  }

  /**
   * Quando o usuário escolhe um modelo, pré-preenche o form com os
   * dados do modelo. Em modo CRIAR substitui também o buffer de
   * EPIs/EPCs (seguro porque ainda não foi salvo). Em modo EDITAR,
   * preserva EPIs já persistidos no servidor — o usuário pode
   * adicionar manualmente os do modelo se quiser.
   */
  function aplicarModelo(idModelo: string) {
    if (!idModelo) {
      setForm((f) => ({ ...f, id_modelo: "" }));
      return;
    }
    const m = modelos.find((x) => x.id_modelo === idModelo);
    if (!m) {
      setForm((f) => ({ ...f, id_modelo: idModelo }));
      return;
    }
    // Itens da resposta atual de itensModelo podem estar desatualizados
    // se idModelo acabou de mudar (a query ainda não reagiu). Por isso,
    // buscamos do query cache na próxima renderização. Por enquanto,
    // aplicamos só agente/fonte e deixamos os itens autopreencher quando
    // a query de itensModelo terminar (vide useEffect mais abaixo).
    setForm((f) => ({
      ...f,
      id_modelo: idModelo,
      agente: m.agente,
      // fonte_geradora é populada pelo autofill effect quando os itens
      // do modelo (categoria='fonte_geradora') chegarem da query.
    }));
  }

  // Quando os itens do modelo carregam, preenche os campos de lista
  // (medidas/EPIs). Só faz isso em modo CRIAR — edit preserva o que
  // já está persistido.
  //
  // IMPORTANTE: itens e perguntas vêm de queries independentes que podem
  // chegar fora de ordem. Antes de marcar como "aplicado", esperamos que
  // AMBAS tenham terminado o primeiro fetch (isFetched). Senão, perguntas
  // chegando primeiro com dados mas itens ainda zerados marcaria o ref e
  // bloquearia o autofill quando os itens chegassem.
  const aplicouItensRef = useRef<string>("");
  useEffect(() => {
    if (!form.id_modelo) {
      aplicouItensRef.current = "";
      return;
    }
    if (aplicouItensRef.current === form.id_modelo) return;
    if (!itensModeloQ.isFetched || !perguntasModeloQ.isFetched) return;

    aplicouItensRef.current = form.id_modelo;

    if (isEdit) return; // em edit, não sobrescreve listas existentes

    // Fonte Geradora: NÃO autopreencher — usuário escolhe quais aplicar
    // a partir dos chips de sugestão no FonteBlocoLista. EPI/EPC/medidas
    // continuam autopreenchidos como antes.
    const epis: EpiPendente[] = [];
    const adotadas: string[] = [];
    const recomendadas: string[] = [];
    for (const i of itensModelo) {
      switch (i.categoria) {
        case "epi_utilizado":
          epis.push({ tipo: "EPI", descricao: i.texto, ca: null, recomendado: "Não" });
          break;
        case "epi_recomendado":
          epis.push({ tipo: "EPI", descricao: i.texto, ca: null, recomendado: "Sim" });
          break;
        case "epc_utilizado":
          epis.push({ tipo: "EPC", descricao: i.texto, ca: null, recomendado: "Não" });
          break;
        case "epc_recomendado":
          epis.push({ tipo: "EPC", descricao: i.texto, ca: null, recomendado: "Sim" });
          break;
        case "medida_adotada":
          adotadas.push(i.texto);
          break;
        case "medida_recomendada":
          recomendadas.push(i.texto);
          break;
      }
    }
    setForm((f) => ({
      ...f,
      epis_pendentes: epis,
      medidas_adotadas_lista: adotadas,
      medidas_recomendadas_lista: recomendadas,
    }));
  }, [
    form.id_modelo,
    itensModelo,
    perguntasModelo,
    itensModeloQ.isFetched,
    perguntasModeloQ.isFetched,
    isEdit,
  ]);

  // Perguntas combinadas: tipo + modelo (modelo depois pra preservar
  // ordem do tipo primeiro). Exibido na seção de Perguntas Customizadas.
  const perguntasCombinadas = useMemo(() => {
    const lista: Array<PerguntaTipoRisco | PerguntaModeloRisco> = [
      ...perguntasCustom,
      ...perguntasModelo,
    ];
    return lista;
  }, [perguntasCustom, perguntasModelo]);

  const isFisico = form.tipo_risco === "Físico";
  const isQuimico = form.tipo_risco === "Químico";
  const isBiologico = form.tipo_risco === "Biológico";
  const isErgo = form.tipo_risco === "Ergonômico";
  const isPsico = form.tipo_risco === "Psicossocial";
  const isIapat = form.tipo_risco.startsWith("IAPAT");

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();

      const baseRisco: Partial<Risco> = {
        tipo_risco: form.tipo_risco as TipoRisco,
        id_modelo: form.id_modelo || null,
        id_matriz: form.id_matriz || matrizAtiva?.id_matriz || null,
        agente: form.agente.trim() || null,
        fonte_geradora: stringifyMedidas(form.fontes_geradoras_lista),
        id_cargo: form.id_cargo || null,
        probabilidade: form.probabilidade,
        severidade: form.severidade,
        nivel_risco: nivel,
        meio_propagacao: form.meio_propagacao.length > 0 ? form.meio_propagacao : null,
        situacao: form.situacao || null,
        tempo_exposicao: form.tempo_exposicao || null,
        tecnica_utilizada: form.tecnica_utilizada || null,
        concentracao_exposicao: form.concentracao_exposicao.trim() || null,
        limite_tolerancia: form.limite_tolerancia.trim() || null,
        insalubridade: form.insalubridade.trim() || null,
        periculosidade: form.periculosidade.trim() || null,
        numero_cas: form.numero_cas.trim() || null,
        via_absorcao: form.via_absorcao.trim() || null,
        tipo_agente_biologico: form.tipo_agente_biologico.trim() || null,
        fator_ergonomico: form.fator_ergonomico.trim() || null,
        fator_psicossocial: form.fator_psicossocial.trim() || null,
        pontuacao_iapat: form.pontuacao_iapat.trim() || null,
        fisico_necessita_medicao: form.fisico_necessita_medicao || null,
        fisico_qual_medicao: form.fisico_qual_medicao.trim() || null,
        fisico_motivo_medicao: form.fisico_motivo_medicao.trim() || null,
        quim_q1: form.quim_q1 || null,
        quim_q2: form.quim_q2 || null,
        quim_q3: form.quim_q3 || null,
        quim_q4: form.quim_q4 || null,
        quim_q5: form.quim_q5 || null,
        quim_q6: form.quim_q6 || null,
        uso_processo: form.uso_processo.trim() || null,
        foto_quim_url: form.foto_quim_url || null,
        medidas_adotadas: stringifyMedidas(form.medidas_adotadas_lista),
        medidas_recomendadas: stringifyMedidas(form.medidas_recomendadas_lista),
        observacoes_risco: form.observacoes_risco.trim() || null,
        respostas_custom:
          Object.keys(form.respostas_custom).length > 0
            ? form.respostas_custom
            : null,
        updated_at: new Date().toISOString(),
      };

      if (isEdit && risco) {
        // Atualiza o risco original com o primeiro setor.
        const primeiroSetor = form.ids_setores[0] || null;
        const { error: errUpdate } = await supabase
          .from("riscos")
          .update({ ...baseRisco, id_setor: primeiroSetor } as never)
          .eq("id_risco", risco.id_risco);
        if (errUpdate) throw errUpdate;

        // Setores adicionais → cria riscos novos clonados.
        const extras = form.ids_setores.slice(1);
        if (extras.length > 0) {
          const novos = extras.map((idSetor) => ({
            ...baseRisco,
            id_risco: gerarId("RSC"),
            id_inspecao: idInspecao,
            id_empresa: idEmpresa,
            id_setor: idSetor,
            created_at: new Date().toISOString(),
          }));
          const { error: errExtra } = await supabase
            .from("riscos")
            .insert(novos as never);
          if (errExtra) throw errExtra;
        }
        await semearCatalogoFormSnapshot(supabase, idTipoSelecionado, catalogo, itensModelo, form);
        return { criados: 1, extras: extras.length };
      }

      // Criação nova: cross-product entre modelos da triagem × setores.
      // - Sem triagem marcada: 1 risco por setor (comportamento original).
      // - Com triagem marcada: 1 risco por (modelo × setor), com agente
      //   e id_modelo override por modelo.
      const setoresParaCriar =
        form.ids_setores.length > 0 ? form.ids_setores : [null];

      const opcoesParaCriar: Array<{
        agente: string | null;
        id_modelo: string | null;
      }> = form.triagem_modelos_ids.length > 0
        ? form.triagem_modelos_ids.map((idModelo) => {
            const m = modelos.find((x) => x.id_modelo === idModelo);
            return {
              agente: m?.agente ?? null,
              id_modelo: idModelo,
            };
          })
        : [
            {
              agente: baseRisco.agente ?? null,
              id_modelo: baseRisco.id_modelo ?? null,
            },
          ];

      const novos = opcoesParaCriar.flatMap((opc) =>
        setoresParaCriar.map((idSetor) => ({
          ...baseRisco,
          agente: opc.agente,
          id_modelo: opc.id_modelo,
          id_risco: gerarId("RSC"),
          id_inspecao: idInspecao,
          id_empresa: idEmpresa,
          id_setor: idSetor,
          created_at: new Date().toISOString(),
        }))
      );

      const { error } = await supabase.from("riscos").insert(novos as never);
      if (error) throw error;

      // Insere EPIs/EPCs pendentes — replicados pra cada risco criado
      if (form.epis_pendentes.length > 0) {
        const linhasEpi = novos.flatMap((r) =>
          form.epis_pendentes.map((ep) => ({
            id_protecao: gerarId("EPI"),
            id_risco: r.id_risco,
            id_inspecao: idInspecao,
            id_empresa: idEmpresa,
            id_setor: r.id_setor,
            tipo: ep.tipo,
            descricao: ep.descricao,
            ca: ep.ca,
            recomendado: ep.recomendado,
          }))
        );
        const { error: errEpi } = await supabase
          .from("epi_epc")
          .insert(linhasEpi as never);
        if (errEpi) throw errEpi;
      }

      await semearCatalogoFormSnapshot(supabase, idTipoSelecionado, catalogo, itensModelo, form);
      return { criados: novos.length, extras: 0 };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
      if (idTipoSelecionado) {
        qc.invalidateQueries({ queryKey: ["catalogo-tipo", idTipoSelecionado] });
      }
      if (form.id_modelo) {
        qc.invalidateQueries({ queryKey: ["itens-modelo", form.id_modelo] });
      }
      const total = res.criados + res.extras;
      if (total > 1) {
        toast.success(`${total} risco(s) criado(s), um por setor ✓`);
      } else {
        toast.success(isEdit ? "Risco atualizado" : "Risco adicionado");
      }
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    // Triagem com 1+ opções marcadas dispensa preencher agente —
    // cada opção vira um risco com seu próprio agente/modelo.
    const temTriagem = form.triagem_modelos_ids.length > 0;
    if (!temTriagem && !form.agente.trim()) {
      toast.error("Informe o agente do risco ou marque opções da triagem");
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar Risco" : "Novo Risco"}
      size="xl"
    >
      <form onSubmit={onSubmit} className="space-y-5">
        {/* Linha 1: Tipo + Setores */}
        <div className="grid gap-3 md:grid-cols-2">
          {(() => {
            const corTipo = corNR09(form.tipo_risco);
            const cfgTipo = SUBGRID_CORES[corTipo];
            return (
              <div className={`rounded-lg border-l-4 p-2 ${cfgTipo.border} ${cfgTipo.bg}`}>
                <label className={`${lblCls} ${cfgTipo.text}`}>
                  Tipo de Risco * <span className="text-[10px] font-normal opacity-70">(cor NR-09)</span>
                </label>
                <select
                  value={form.tipo_risco}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      tipo_risco: e.target.value,
                      // Modelo e triagem são escopados por tipo —
                      // trocar tipo zera tudo.
                      id_modelo: "",
                      id_triagem_selecionada: "",
                      triagem_modelos_ids: [],
                    })
                  }
                  className={inputCls}
                >
                  {tiposCustom.map((t) => (
                    <option key={t.id_tipo} value={t.nome}>
                      {t.icone ?? "•"} {t.nome}
                    </option>
                  ))}
                </select>
              </div>
            );
          })()}
          <div>
            <label className={lblCls}>Setor(es) / GHE</label>
            <SetorMultiSelect
              setores={setores}
              value={form.ids_setores}
              onChange={(ids) =>
                setForm({ ...form, ids_setores: ids, id_cargo: "" })
              }
            />
          </div>
        </div>

        {/* V8.3: Triagem — só o select da pergunta. Os riscos vinculados
            aparecem como sugestões NO CAMPO AGENTE abaixo (filtrado pela
            triagem escolhida). Sem triagem = agente mostra todos os
            modelos do tipo como sugestão. */}
        {triagens.length > 0 && (
          <section className="rounded-lg border-l-4 border-amber-300 bg-amber-50/30 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-800">
              Triagem
            </p>
            <p className="mb-2 text-[11px] text-gray-600">
              Escolha a pergunta que descreve a condição investigada. Os
              riscos vinculados ficam disponíveis como opções no campo
              <strong> Agente</strong> abaixo.
            </p>

            <select
              value={form.id_triagem_selecionada}
              onChange={(e) => {
                const novaTriagem = e.target.value;
                setForm((f) => ({
                  ...f,
                  id_triagem_selecionada: novaTriagem,
                  // Trocar de triagem zera o agente/modelo (eram da
                  // triagem anterior).
                  triagem_modelos_ids: [],
                  id_modelo: "",
                  agente: "",
                }));
              }}
              className="w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-300/30"
            >
              <option value="">— Sem triagem (preencher agente livre) —</option>
              {triagens.map((t) => (
                <option key={t.id_triagem} value={t.id_triagem}>
                  {t.texto}
                </option>
              ))}
            </select>

            {form.id_triagem_selecionada && (() => {
              const modelosDaTriagem =
                modelosPorTriagem.get(form.id_triagem_selecionada) ?? [];
              if (modelosDaTriagem.length === 0) {
                return (
                  <p className="mt-2 rounded border border-dashed border-amber-300 bg-white px-2 py-1.5 text-[11px] text-amber-700">
                    ⚠ Nenhum risco/modelo vinculado a esta pergunta. Vá em{" "}
                    <em>Configurações → Tipos de Risco → Catálogo</em>, expanda
                    esta triagem e cadastre os modelos que ela cobre.
                  </p>
                );
              }
              return (
                <p className="mt-2 text-[11px] text-amber-700">
                  ✓ {modelosDaTriagem.length} risco(s) vinculado(s) — disponíveis
                  no campo Agente abaixo.
                </p>
              );
            })()}
          </section>
        )}

        {/* Linha 2: Agente (full width) — fonte virou bloco lista abaixo */}
        <div>
          <div>
            <label className={lblCls}>Agente / Risco *</label>
            <input
              list="catalogo-agente"
              type="text"
              value={form.agente}
              onChange={(e) => onAgenteChange(e.target.value)}
              className={inputCls}
              required
              placeholder="Escolha um modelo da lista ou digite um agente novo"
            />
            <datalist id="catalogo-agente">
              {(() => {
                // Quando uma triagem está escolhida, só mostra os modelos
                // vinculados a ela. Senão, todos os modelos do tipo
                // (e a biblioteca livre como fallback).
                const modelosVisiveis = form.id_triagem_selecionada
                  ? modelosPorTriagem.get(form.id_triagem_selecionada) ?? []
                  : modelos;
                return (
                  <>
                    {modelosVisiveis.map((m) => (
                      <option
                        key={`mod-${m.id_modelo}`}
                        value={m.agente}
                        label={m.fonte_geradora ?? undefined}
                      />
                    ))}
                    {/* Biblioteca livre só quando NÃO há triagem (manter o
                        escopo da triagem limpo) */}
                    {!form.id_triagem_selecionada &&
                      (sugestoesPorCategoria.agente ?? [])
                        .filter(
                          (s) =>
                            !modelos.some(
                              (m) =>
                                m.agente.toLowerCase() === s.toLowerCase()
                            )
                        )
                        .map((s) => (
                          <option key={`sug-${s}`} value={s} />
                        ))}
                  </>
                );
              })()}
            </datalist>
            {modeloSelecionado && (() => {
              const nFonte = itensModelo.filter((i) => i.categoria === "fonte_geradora").length;
              const nEpiUti = itensModelo.filter((i) => i.categoria === "epi_utilizado").length;
              const nEpiRec = itensModelo.filter((i) => i.categoria === "epi_recomendado").length;
              const nEpcUti = itensModelo.filter((i) => i.categoria === "epc_utilizado").length;
              const nEpcRec = itensModelo.filter((i) => i.categoria === "epc_recomendado").length;
              const nMedAdo = itensModelo.filter((i) => i.categoria === "medida_adotada").length;
              const nMedRec = itensModelo.filter((i) => i.categoria === "medida_recomendada").length;
              const nPerg = perguntasModelo.length;
              const total = itensModelo.length + nPerg;
              const kitVazio = total === 0;

              if (kitVazio) {
                return (
                  <p className="mt-1 text-[11px] text-amber-700">
                    ⚠ Modelo &ldquo;{modeloSelecionado.agente}&rdquo; aplicado,
                    mas o <strong>kit está vazio</strong>. Adicione fontes,
                    EPIs, EPCs, medidas e perguntas em <em>Configurações →
                    Tipos de Risco → Catálogo</em> (expanda o card do modelo).
                  </p>
                );
              }

              return (
                <p className="mt-1 text-[11px] text-verde-primary">
                  ✓ Modelo &ldquo;{modeloSelecionado.agente}&rdquo;{" "}
                  {isEdit ? "vinculado" : "aplicado"}:{" "}
                  {nEpiUti + nEpiRec} EPI(s), {nEpcUti + nEpcRec} EPC(s),{" "}
                  {nMedAdo + nMedRec} medida(s)
                  {nPerg > 0 ? `, ${nPerg} pergunta(s)` : ""}
                  {nFonte > 0 && !isEdit
                    ? ` · ${nFonte} fonte(s) sugerida(s) — selecione abaixo`
                    : ""}
                  {!isEdit && nFonte === 0 && " — edite à vontade"}.
                </p>
              );
            })()}
          </div>
        </div>

        {/* V6: Fonte Geradora como lista (parallel a medidas/EPIs) */}
        <FonteBlocoLista
          items={form.fontes_geradoras_lista}
          onChange={(items) =>
            setForm({ ...form, fontes_geradoras_lista: items })
          }
          sugestoes={sugestoesPorCategoria.fonte_geradora ?? []}
        />

        {/* Cargo (opcional, baseado no 1º setor) */}
        {cargosDoSetor.length > 0 && (
          <div>
            <label className={lblCls}>Cargo (opcional)</label>
            <select
              value={form.id_cargo}
              onChange={(e) => setForm({ ...form, id_cargo: e.target.value })}
              className={inputCls}
            >
              <option value="">— Aplica a todos os cargos do setor —</option>
              {cargosDoSetor.map((c) => (
                <option key={c.id_cargo} value={c.id_cargo}>
                  {c.cargo}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Caracterização da exposição */}
        <SubGrid title="Caracterização da Exposição" cor="stone">
          <Field label="Meio de Propagação">
            <MeiosPropagacaoMultiSelect
              options={MEIOS_PROPAGACAO_DEFAULT}
              value={form.meio_propagacao}
              onChange={(meios) =>
                setForm({ ...form, meio_propagacao: meios })
              }
            />
          </Field>
          <Field label="Situação">
            <select
              value={form.situacao}
              onChange={(e) => setForm({ ...form, situacao: e.target.value })}
              className={inputCls}
            >
              <option value="">—</option>
              {SITUACOES_DEFAULT.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tempo de Exposição">
            <select
              value={form.tempo_exposicao}
              onChange={(e) =>
                setForm({ ...form, tempo_exposicao: e.target.value })
              }
              className={inputCls}
            >
              <option value="">—</option>
              {TEMPOS_EXPOSICAO_DEFAULT.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Técnica Utilizada">
            <select
              value={form.tecnica_utilizada}
              onChange={(e) =>
                setForm({ ...form, tecnica_utilizada: e.target.value })
              }
              className={inputCls}
            >
              <option value="">—</option>
              {TECNICAS_DEFAULT.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </SubGrid>

        {/* Avaliação (matriz) */}
        <section className="rounded-lg border border-rose-200 bg-rose-50/40 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-800">
              Avaliação (Matriz de Risco)
            </p>
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-medium text-gray-600">
                Matriz:
              </label>
              <select
                value={form.id_matriz}
                onChange={(e) => {
                  const novaId = e.target.value;
                  const nova = matrizes.find((m) => m.id_matriz === novaId);
                  // Reseta prob/sev se não existirem na nova matriz.
                  setForm((f) => ({
                    ...f,
                    id_matriz: novaId,
                    probabilidade:
                      nova?.probabilidades.includes(f.probabilidade)
                        ? f.probabilidade
                        : nova?.probabilidades[
                            Math.floor(nova.probabilidades.length / 2)
                          ] ?? f.probabilidade,
                    severidade: nova?.severidades.includes(f.severidade)
                      ? f.severidade
                      : nova?.severidades[
                          Math.floor(nova.severidades.length / 2)
                        ] ?? f.severidade,
                  }));
                }}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
              >
                <option value="">
                  Padrão (ativa: {matrizAtiva?.nome ?? "—"})
                </option>
                {matrizes.map((m) => (
                  <option key={m.id_matriz} value={m.id_matriz}>
                    {m.nome}
                    {m.ativa ? " ⭐" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3 md:items-end">
            <Field label="Probabilidade">
              <select
                value={form.probabilidade}
                onChange={(e) =>
                  setForm({ ...form, probabilidade: e.target.value })
                }
                className={inputCls}
              >
                {probsLista.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Severidade">
              <select
                value={form.severidade}
                onChange={(e) =>
                  setForm({ ...form, severidade: e.target.value })
                }
                className={inputCls}
              >
                {sevsLista.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nível Calculado">
              <div className="mt-1 flex h-[38px] items-center">
                <NivelBadge nivel={nivel} />
              </div>
            </Field>
          </div>
        </section>

        {/* Perguntas Customizadas (V3) — definidas pelo Admin em /config */}
        {perguntasCombinadas.length > 0 && (
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-verde-primary">
              Perguntas — {form.tipo_risco}
            </p>
            <div className="space-y-2 rounded-lg border border-verde-primary/30 bg-verde-light/30 p-3">
              {perguntasCombinadas.map((p) => {
                const valor = form.respostas_custom[p.chave] ?? "";
                const setVal = (v: string) =>
                  setForm({
                    ...form,
                    respostas_custom: {
                      ...form.respostas_custom,
                      [p.chave]: v,
                    },
                  });
                return (
                  <div
                    key={p.id_pergunta}
                    className={
                      p.input_type === "select"
                        ? "grid grid-cols-[1fr_auto] items-center gap-3"
                        : "space-y-1"
                    }
                  >
                    <label className="text-sm text-gray-700">
                      {p.texto}
                      {p.obrigatoria && (
                        <span className="ml-1 text-red-alert">*</span>
                      )}
                    </label>
                    {p.input_type === "select" ? (
                      <select
                        value={valor}
                        onChange={(e) => setVal(e.target.value)}
                        className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
                      >
                        <option value="">—</option>
                        {p.opcoes.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : p.input_type === "textarea" ? (
                      <textarea
                        value={valor}
                        onChange={(e) => setVal(e.target.value)}
                        rows={2}
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
                      />
                    ) : (
                      <input
                        type="text"
                        value={valor}
                        onChange={(e) => setVal(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Específico FÍSICO */}
        {isFisico && (
          <SubGrid title="Detalhes — Físico" cor="green">
            <Field label="Necessita medição?">
              <select
                value={form.fisico_necessita_medicao}
                onChange={(e) =>
                  setForm({
                    ...form,
                    fisico_necessita_medicao: e.target.value,
                  })
                }
                className={inputCls}
              >
                <option value="">—</option>
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
                <option value="N/A">N/A</option>
              </select>
            </Field>
            <Field label="Qual medição">
              <input
                value={form.fisico_qual_medicao}
                onChange={(e) =>
                  setForm({ ...form, fisico_qual_medicao: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Motivo">
              <input
                value={form.fisico_motivo_medicao}
                onChange={(e) =>
                  setForm({ ...form, fisico_motivo_medicao: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Concentração / Nível medido">
              <input
                value={form.concentracao_exposicao}
                onChange={(e) =>
                  setForm({
                    ...form,
                    concentracao_exposicao: e.target.value,
                  })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Limite de Tolerância (LT)">
              <input
                value={form.limite_tolerancia}
                onChange={(e) =>
                  setForm({ ...form, limite_tolerancia: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Insalubridade (NR-15)">
              <input
                value={form.insalubridade}
                onChange={(e) =>
                  setForm({ ...form, insalubridade: e.target.value })
                }
                className={inputCls}
                placeholder="Grau ou %"
              />
            </Field>
          </SubGrid>
        )}

        {/* Específico QUÍMICO */}
        {isQuimico && (
          <>
            <SubGrid title="Detalhes — Químico" cor="red">
              <Field label="Número CAS">
                <input
                  value={form.numero_cas}
                  onChange={(e) =>
                    setForm({ ...form, numero_cas: e.target.value })
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Via de absorção">
                <input
                  value={form.via_absorcao}
                  onChange={(e) =>
                    setForm({ ...form, via_absorcao: e.target.value })
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Concentração / Exposição">
                <input
                  value={form.concentracao_exposicao}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      concentracao_exposicao: e.target.value,
                    })
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Uso / Processo">
                <input
                  value={form.uso_processo}
                  onChange={(e) =>
                    setForm({ ...form, uso_processo: e.target.value })
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Periculosidade (NR-16)">
                <input
                  value={form.periculosidade}
                  onChange={(e) =>
                    setForm({ ...form, periculosidade: e.target.value })
                  }
                  className={inputCls}
                />
              </Field>
            </SubGrid>

            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Avaliação Qualitativa
              </p>
              <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
                {PERGUNTAS_QUIMICAS.map((q) => (
                  <div
                    key={q.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-3"
                  >
                    <span className="text-sm text-gray-700">{q.texto}</span>
                    <select
                      value={form[q.id as keyof FormState] as string}
                      onChange={(e) =>
                        setForm({ ...form, [q.id]: e.target.value })
                      }
                      className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
                    >
                      <option value="">—</option>
                      <option value="Sim">Sim</option>
                      <option value="Não">Não</option>
                      <option value="Parcial">Parcial</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                ))}
              </div>
            </section>

            <FotoQuimUpload
              value={form.foto_quim_url}
              idInspecao={idInspecao}
              idEmpresa={idEmpresa}
              onChange={(url) => setForm({ ...form, foto_quim_url: url })}
            />
          </>
        )}

        {/* Específico BIOLÓGICO */}
        {isBiologico && (
          <SubGrid title="Detalhes — Biológico" cor="amber">
            <Field label="Tipo de agente biológico">
              <input
                value={form.tipo_agente_biologico}
                onChange={(e) =>
                  setForm({ ...form, tipo_agente_biologico: e.target.value })
                }
                className={inputCls}
                placeholder="Ex: Vírus, Bactéria, Fungo..."
              />
            </Field>
          </SubGrid>
        )}

        {/* Específico ERGONÔMICO */}
        {isErgo && (
          <SubGrid title="Detalhes — Ergonômico" cor="yellow">
            <Field label="Fator ergonômico">
              <input
                list="fatores-ergo"
                value={form.fator_ergonomico}
                onChange={(e) =>
                  setForm({ ...form, fator_ergonomico: e.target.value })
                }
                className={inputCls}
              />
              <datalist id="fatores-ergo">
                {FATORES_ERGONOMICOS.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </Field>
          </SubGrid>
        )}

        {/* Específico PSICOSSOCIAL */}
        {isPsico && (
          <SubGrid title="Detalhes — Psicossocial" cor="purple">
            <Field label="Fator psicossocial">
              <input
                list="fatores-psico"
                value={form.fator_psicossocial}
                onChange={(e) =>
                  setForm({ ...form, fator_psicossocial: e.target.value })
                }
                className={inputCls}
              />
              <datalist id="fatores-psico">
                {FATORES_PSICOSSOCIAIS.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </Field>
          </SubGrid>
        )}

        {/* IAPAT */}
        {isIapat && (
          <SubGrid title="Detalhes — IAPAT" cor="slate">
            <Field label="Pontuação IAPAT">
              <input
                value={form.pontuacao_iapat}
                onChange={(e) =>
                  setForm({ ...form, pontuacao_iapat: e.target.value })
                }
                className={inputCls}
                placeholder="Pontuação ou nota IAPAT"
              />
            </Field>
          </SubGrid>
        )}

        {/* EPIs e EPCs vinculados — sempre visível */}
        {isEdit && risco ? (
          <EpiInline
            mode="server"
            idRisco={risco.id_risco}
            idInspecao={idInspecao}
            idEmpresa={idEmpresa}
            idSetor={risco.id_setor}
            sugestoes={sugestoesPorCategoria}
            idTipo={idTipoSelecionado}
            idModelo={form.id_modelo || undefined}
          />
        ) : (
          <EpiInline
            mode="local"
            items={form.epis_pendentes}
            onChange={(items) =>
              setForm({ ...form, epis_pendentes: items })
            }
            sugestoes={sugestoesPorCategoria}
            idTipo={idTipoSelecionado}
            idModelo={form.id_modelo || undefined}
          />
        )}

        {/* Medidas (5º e 6º) — agora em listas com Adicionar/Editar/Excluir */}
        <MedidasInline
          adotadas={form.medidas_adotadas_lista}
          recomendadas={form.medidas_recomendadas_lista}
          onChangeAdotadas={(items) =>
            setForm({ ...form, medidas_adotadas_lista: items })
          }
          onChangeRecomendadas={(items) =>
            setForm({ ...form, medidas_recomendadas_lista: items })
          }
          sugestoesAdotadas={sugestoesPorCategoria.medida_adotada ?? []}
          sugestoesRecomendadas={sugestoesPorCategoria.medida_recomendada ?? []}
        />

        <section className="rounded-lg border border-slate-200 bg-slate-50/40 p-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Observações
          </label>
          <textarea
            value={form.observacoes_risco}
            onChange={(e) =>
              setForm({ ...form, observacoes_risco: e.target.value })
            }
            rows={2}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          />
        </section>

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
            className="rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
          >
            {mutation.isPending
              ? "Salvando..."
              : isEdit
              ? "Salvar"
              : `💾 Adicionar ${
                  form.ids_setores.length > 1
                    ? `(${form.ids_setores.length} riscos)`
                    : ""
                }`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// =============================================================
// SUBCOMPONENTE: Upload de Foto Química (FDS)
// =============================================================

function FotoQuimUpload({
  value,
  idInspecao,
  idEmpresa,
  onChange,
}: {
  value: string;
  idInspecao: string;
  idEmpresa: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${idEmpresa}/${idInspecao}/quim_${gerarId("FDS")}.${ext}`;
      const { error } = await supabase.storage
        .from("fotos")
        .upload(path, file, { upsert: false });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("fotos").getPublicUrl(path);
      onChange(pub.publicUrl);
      toast.success("Foto FDS enviada");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar foto";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className={lblCls}>Foto da FDS / Rótulo (opcional)</label>
      <div className="mt-1 flex items-center gap-3">
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="FDS"
            className="size-16 rounded-md border border-gray-200 object-cover"
          />
        )}
        <label
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 ${
            uploading ? "opacity-50" : ""
          }`}
        >
          <Upload className="size-4" />
          {uploading ? "Enviando..." : value ? "Trocar foto" : "Enviar foto"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={handleFile}
          />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs text-red-alert hover:underline"
          >
            Remover
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================
// SUBCOMPONENTE: EPIs/EPCs em 4 blocos separados
//   - 1º EPI Utilizado     (tipo=EPI, recomendado=Não)
//   - 2º EPI Recomendado   (tipo=EPI, recomendado=Sim)
//   - 3º EPC Utilizado     (tipo=EPC, recomendado=Não)
//   - 4º EPC Recomendado   (tipo=EPC, recomendado=Sim)
// 2 modos: server (persistência imediata) e local (buffer pra novos riscos)
// =============================================================

type EpiInlineProps = (
  | {
      mode: "server";
      idRisco: string;
      idInspecao: string;
      idEmpresa: string;
      idSetor: string | null;
    }
  | {
      mode: "local";
      items: EpiPendente[];
      onChange: (items: EpiPendente[]) => void;
    }
) & {
  /**
   * Sugestões do catálogo do tipo de risco — chave por categoria.
   * Cada bloco abaixo lê apenas a sua categoria correspondente.
   */
  sugestoes: Partial<Record<CategoriaCatalogo, string[]>>;
  /**
   * Id do tipo selecionado no form. Usado em modo server para
   * alimentar o catálogo automaticamente quando o usuário adiciona
   * um EPI/EPC novo durante a edição de um risco existente.
   */
  idTipo?: string;
  /**
   * Id do modelo selecionado, se houver. Quando setado, EPIs/EPCs
   * adicionados inline vão pra `itens_modelo_risco` desse modelo
   * em vez de `itens_catalogo_tipo`.
   */
  idModelo?: string;
};

function EpiInline(props: EpiInlineProps) {
  // Modo server: busca lista uma vez; cada bloco filtra
  const idRiscoServer = props.mode === "server" ? props.idRisco : null;
  const { data: serverLista = [] } = useQuery({
    queryKey: ["epi-risco", idRiscoServer],
    enabled: props.mode === "server",
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("epi_epc")
        .select("*")
        .eq("id_risco", idRiscoServer!);
      if (error) throw error;
      return (data ?? []) as unknown as EpiEpc[];
    },
  });

  return (
    <section className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        EPIs e EPCs vinculados a este risco
      </p>
      <EpiBloco
        ordem={1}
        titulo="EPI Utilizado"
        descricao="EPI que o trabalhador já utiliza atualmente neste risco"
        tipoFixo="EPI"
        recomendadoFixo="Não"
        cor="blue"
        props={props}
        serverLista={serverLista}
        sugestoes={props.sugestoes.epi_utilizado ?? []}
      />
      <EpiBloco
        ordem={2}
        titulo="EPI Recomendado"
        descricao="EPI sugerido como medida de proteção (pode não estar em uso ainda)"
        tipoFixo="EPI"
        recomendadoFixo="Sim"
        cor="indigo"
        props={props}
        serverLista={serverLista}
        sugestoes={props.sugestoes.epi_recomendado ?? []}
      />
      <EpiBloco
        ordem={3}
        titulo="EPC Utilizado"
        descricao="EPC já instalado no setor para este risco"
        tipoFixo="EPC"
        recomendadoFixo="Não"
        cor="emerald"
        props={props}
        serverLista={serverLista}
        sugestoes={props.sugestoes.epc_utilizado ?? []}
      />
      <EpiBloco
        ordem={4}
        titulo="EPC Recomendado"
        descricao="EPC sugerido como melhoria de proteção coletiva"
        tipoFixo="EPC"
        recomendadoFixo="Sim"
        cor="teal"
        props={props}
        serverLista={serverLista}
        sugestoes={props.sugestoes.epc_recomendado ?? []}
      />
    </section>
  );
}

// =============================================================
// Bloco individual (1 dos 4)
// =============================================================

const CORES_BLOCO: Record<
  "blue" | "indigo" | "emerald" | "teal",
  { border: string; bg: string; text: string; tag: string }
> = {
  blue: {
    border: "border-blue-200",
    bg: "bg-blue-50/30",
    text: "text-blue-800",
    tag: "bg-blue-100 text-blue-800",
  },
  indigo: {
    border: "border-indigo-200",
    bg: "bg-indigo-50/30",
    text: "text-indigo-800",
    tag: "bg-indigo-100 text-indigo-800",
  },
  emerald: {
    border: "border-emerald-200",
    bg: "bg-emerald-50/30",
    text: "text-emerald-800",
    tag: "bg-emerald-100 text-emerald-800",
  },
  teal: {
    border: "border-teal-200",
    bg: "bg-teal-50/30",
    text: "text-teal-800",
    tag: "bg-teal-100 text-teal-800",
  },
};

function EpiBloco({
  ordem,
  titulo,
  descricao,
  tipoFixo,
  recomendadoFixo,
  cor,
  props,
  serverLista,
  sugestoes,
}: {
  ordem: number;
  titulo: string;
  descricao: string;
  tipoFixo: "EPI" | "EPC";
  recomendadoFixo: "Sim" | "Não";
  cor: keyof typeof CORES_BLOCO;
  props: EpiInlineProps;
  serverLista: EpiEpc[];
  sugestoes: string[];
}) {
  const qc = useQueryClient();
  const cfg = CORES_BLOCO[cor];
  const [novo, setNovo] = useState({ descricao: "", ca: "" });
  const datalistId = `cat-${tipoFixo.toLowerCase()}-${recomendadoFixo === "Sim" ? "rec" : "uti"}`;

  // Estado de edição inline (1 item por vez)
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editFields, setEditFields] = useState({ descricao: "", ca: "" });

  // Filtra lista pelos critérios deste bloco
  const lista =
    props.mode === "server"
      ? serverLista
          .filter(
            (e) => e.tipo === tipoFixo && e.recomendado === recomendadoFixo
          )
          .map((e) => ({
            key: e.id_protecao,
            descricao: e.descricao,
            ca: e.ca,
            localIdx: -1,
          }))
      : props.items
          .map((e, i) => ({ ...e, idx: i }))
          .filter(
            (e) => e.tipo === tipoFixo && e.recomendado === recomendadoFixo
          )
          .map((e) => ({
            key: `local-${e.idx}`,
            descricao: e.descricao,
            ca: e.ca,
            localIdx: e.idx,
          }));

  const addServer = useMutation({
    mutationFn: async () => {
      if (props.mode !== "server") throw new Error("Modo inválido");
      if (!novo.descricao.trim()) throw new Error("Descrição obrigatória");
      const supabase = createSupabaseBrowserClient();
      const descricaoLimpa = novo.descricao.trim();
      const row = {
        id_protecao: gerarId("EPI"),
        id_risco: props.idRisco,
        id_inspecao: props.idInspecao,
        id_empresa: props.idEmpresa,
        id_setor: props.idSetor,
        tipo: tipoFixo,
        descricao: descricaoLimpa,
        ca: novo.ca.trim() || null,
        recomendado: recomendadoFixo,
      };
      const { error } = await supabase.from("epi_epc").insert(row as never);
      if (error) throw error;

      // V4/V5: alimenta catálogo do tipo OU itens do modelo (se houver
      // modelo escolhido). Conflito (já existe) é silenciado pelo índice
      // único; outros erros são apenas logados.
      const categoria =
        tipoFixo === "EPI"
          ? recomendadoFixo === "Sim"
            ? "epi_recomendado"
            : "epi_utilizado"
          : recomendadoFixo === "Sim"
          ? "epc_recomendado"
          : "epc_utilizado";
      const jaExiste = sugestoes.some(
        (s) => s.toLowerCase() === descricaoLimpa.toLowerCase()
      );

      if (!jaExiste && props.idModelo) {
        const { error: errMod } = await supabase
          .from("itens_modelo_risco")
          .insert({
            id_item: gerarId("ITM"),
            id_modelo: props.idModelo,
            categoria,
            texto: descricaoLimpa,
            ordem: sugestoes.length,
            ativo: true,
          } as never);
        if (errMod && errMod.code !== "23505") {
          console.warn("[modelo] semeadura EPI falhou:", errMod.message);
        }
      } else if (!jaExiste && props.idTipo) {
        const { error: errCat } = await supabase
          .from("itens_catalogo_tipo")
          .insert({
            id_item: gerarId("CAT"),
            id_tipo: props.idTipo,
            categoria: categoria as CategoriaCatalogo,
            texto: descricaoLimpa,
            ordem: sugestoes.length,
            ativo: true,
          } as never);
        if (errCat && errCat.code !== "23505") {
          console.warn("[catalogo] semeadura EPI falhou:", errCat.message);
        }
      }
    },
    onSuccess: () => {
      if (props.mode === "server") {
        qc.invalidateQueries({ queryKey: ["epi-risco", props.idRisco] });
        qc.invalidateQueries({ queryKey: ["inspecao", props.idInspecao] });
        if (props.idModelo) {
          qc.invalidateQueries({ queryKey: ["itens-modelo", props.idModelo] });
        }
        if (props.idTipo) {
          qc.invalidateQueries({ queryKey: ["catalogo-tipo", props.idTipo] });
        }
      }
      setNovo({ descricao: "", ca: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateServer = useMutation({
    mutationFn: async ({
      id,
      descricao,
      ca,
    }: {
      id: string;
      descricao: string;
      ca: string | null;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("epi_epc")
        .update({ descricao, ca } as never)
        .eq("id_protecao", id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (props.mode === "server") {
        qc.invalidateQueries({ queryKey: ["epi-risco", props.idRisco] });
        qc.invalidateQueries({ queryKey: ["inspecao", props.idInspecao] });
      }
      setEditingKey(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delServer = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("epi_epc")
        .delete()
        .eq("id_protecao", id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (props.mode === "server") {
        qc.invalidateQueries({ queryKey: ["epi-risco", props.idRisco] });
        qc.invalidateQueries({ queryKey: ["inspecao", props.idInspecao] });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleAdd() {
    if (!novo.descricao.trim()) {
      toast.error("Descrição obrigatória");
      return;
    }
    if (props.mode === "server") {
      addServer.mutate();
    } else {
      props.onChange([
        ...props.items,
        {
          tipo: tipoFixo,
          descricao: novo.descricao.trim(),
          ca: novo.ca.trim() || null,
          recomendado: recomendadoFixo,
        },
      ]);
      setNovo({ descricao: "", ca: "" });
    }
  }

  function handleDel(key: string, localIdx: number) {
    if (props.mode === "server") {
      delServer.mutate(key);
    } else {
      props.onChange(props.items.filter((_, i) => i !== localIdx));
    }
  }

  function abrirEdit(item: { key: string; descricao: string; ca: string | null }) {
    setEditingKey(item.key);
    setEditFields({ descricao: item.descricao, ca: item.ca ?? "" });
  }

  function salvarEdit(key: string, localIdx: number) {
    const desc = editFields.descricao.trim();
    if (!desc) {
      toast.error("Descrição não pode ficar vazia");
      return;
    }
    const caClean = editFields.ca.trim() || null;
    if (props.mode === "server") {
      updateServer.mutate({ id: key, descricao: desc, ca: caClean });
    } else {
      props.onChange(
        props.items.map((it, i) =>
          i === localIdx ? { ...it, descricao: desc, ca: caClean } : it
        )
      );
      setEditingKey(null);
    }
  }

  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.bg} p-3`}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div>
          <p
            className={`text-xs font-bold uppercase tracking-wider ${cfg.text}`}
          >
            {ordem}º {titulo}
          </p>
          <p className="text-[11px] text-gray-600">{descricao}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.tag}`}
        >
          {lista.length}
        </span>
      </div>

      {lista.length > 0 && (
        <ul className="mb-2 divide-y divide-gray-100 rounded-md bg-white">
          {lista.map((e) => {
            const editando = editingKey === e.key;
            return (
              <li
                key={e.key}
                className="flex items-center gap-2 px-2 py-1.5"
              >
                {editando ? (
                  <>
                    <div className="grid flex-1 grid-cols-[1fr_120px] gap-2">
                      <input
                        type="text"
                        value={editFields.descricao}
                        onChange={(ev) =>
                          setEditFields({
                            ...editFields,
                            descricao: ev.target.value,
                          })
                        }
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                        autoFocus
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter") {
                            ev.preventDefault();
                            salvarEdit(e.key, e.localIdx);
                          }
                          if (ev.key === "Escape") {
                            ev.preventDefault();
                            setEditingKey(null);
                          }
                        }}
                      />
                      <input
                        type="text"
                        value={editFields.ca}
                        onChange={(ev) =>
                          setEditFields({ ...editFields, ca: ev.target.value })
                        }
                        placeholder="CA"
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => salvarEdit(e.key, e.localIdx)}
                      disabled={updateServer.isPending}
                      className="rounded p-1 text-verde-primary hover:bg-verde-light disabled:opacity-50"
                      title="Salvar"
                    >
                      <Check className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingKey(null)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100"
                      title="Cancelar"
                    >
                      <X className="size-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex flex-1 flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-gray-900">
                        {e.descricao}
                      </span>
                      {e.ca && (
                        <span className="text-xs text-gray-500">
                          CA: {e.ca}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        abrirEdit({
                          key: e.key,
                          descricao: e.descricao,
                          ca: e.ca,
                        })
                      }
                      className="rounded p-1 text-gray-400 hover:bg-verde-light hover:text-verde-primary"
                      title="Editar"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDel(e.key, e.localIdx)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-alert"
                      title="Remover"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid grid-cols-[1fr_120px_auto] items-center gap-2">
        <input
          type="text"
          list={sugestoes.length > 0 ? datalistId : undefined}
          value={novo.descricao}
          onChange={(ev) => setNovo({ ...novo, descricao: ev.target.value })}
          placeholder={`Descrição do ${tipoFixo}`}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
          onKeyDown={(ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              handleAdd();
            }
          }}
        />
        {sugestoes.length > 0 && (
          <datalist id={datalistId}>
            {sugestoes.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
        <input
          type="text"
          value={novo.ca}
          onChange={(ev) => setNovo({ ...novo, ca: ev.target.value })}
          placeholder="CA"
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={addServer.isPending}
          className="inline-flex items-center gap-1 rounded-md bg-verde-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-verde-accent disabled:opacity-50"
        >
          <Plus className="size-3.5" /> Adicionar
        </button>
      </div>
    </div>
  );
}

// =============================================================
// SUBCOMPONENTE: Fontes Geradoras inline (V6)
//
// Mesma UX dos blocos de medidas. String única por item, persistido
// como JSON.stringify em risco.fonte_geradora.
// =============================================================

function FonteBlocoLista({
  items,
  onChange,
  sugestoes,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  sugestoes: string[];
}) {
  const [novo, setNovo] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const datalistId = "cat-fonte-form";

  function handleAdd() {
    const txt = novo.trim();
    if (!txt) return;
    onChange([...items, txt]);
    setNovo("");
  }

  function handleDel(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  function abrirEdit(idx: number, valor: string) {
    setEditingIdx(idx);
    setEditText(valor);
  }

  function salvarEdit(idx: number) {
    const txt = editText.trim();
    if (!txt) {
      toast.error("Texto não pode ficar vazio");
      return;
    }
    onChange(items.map((it, i) => (i === idx ? txt : it)));
    setEditingIdx(null);
  }

  const sugestoesDisponiveis = sugestoes.filter((s) => !items.includes(s));

  return (
    <section className="rounded-lg border border-sky-200 bg-sky-50/30 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-sky-800">
            Fonte Geradora
          </p>
          <p className="text-[11px] text-gray-600">
            Origens do agente neste risco (uma ou mais).
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
          {items.length}
        </span>
      </div>

      {sugestoesDisponiveis.length > 0 && (
        <div className="mb-2 rounded-md border border-sky-100 bg-white p-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sky-700">
            Sugestões do modelo — clique para adicionar
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sugestoesDisponiveis.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange([...items, s])}
                className="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] text-sky-800 transition-colors hover:bg-sky-100"
                title="Adicionar esta fonte"
              >
                <Plus className="size-3" />
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {items.length > 0 && (
        <ul className="mb-2 divide-y divide-gray-100 rounded-md bg-white">
          {items.map((it, idx) => {
            const editando = editingIdx === idx;
            return (
              <li key={idx} className="flex items-center gap-2 px-2 py-1.5">
                {editando ? (
                  <>
                    <input
                      type="text"
                      value={editText}
                      onChange={(ev) => setEditText(ev.target.value)}
                      className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                      autoFocus
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") {
                          ev.preventDefault();
                          salvarEdit(idx);
                        }
                        if (ev.key === "Escape") {
                          ev.preventDefault();
                          setEditingIdx(null);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => salvarEdit(idx)}
                      className="rounded p-1 text-verde-primary hover:bg-verde-light"
                      title="Salvar"
                    >
                      <Check className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingIdx(null)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100"
                      title="Cancelar"
                    >
                      <X className="size-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-gray-900">{it}</span>
                    <button
                      type="button"
                      onClick={() => abrirEdit(idx, it)}
                      className="rounded p-1 text-gray-400 hover:bg-verde-light hover:text-verde-primary"
                      title="Editar"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDel(idx)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-alert"
                      title="Remover"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid grid-cols-[1fr_auto] items-center gap-2">
        <input
          type="text"
          list={sugestoes.length > 0 ? datalistId : undefined}
          value={novo}
          onChange={(ev) => setNovo(ev.target.value)}
          placeholder="Ex: Compressor industrial em operação"
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
          onKeyDown={(ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              handleAdd();
            }
          }}
        />
        {sugestoes.length > 0 && (
          <datalist id={datalistId}>
            {sugestoes.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1 rounded-md bg-verde-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-verde-accent"
        >
          <Plus className="size-3.5" /> Adicionar
        </button>
      </div>
    </section>
  );
}

// =============================================================
// SUBCOMPONENTE: Medidas (Adotadas + Recomendadas) inline
//
// Mesma UX dos blocos EPI/EPC: lista com Adicionar/Editar/Excluir.
// Diferente: medidas são apenas strings (campo único). Persistidas
// como JSON.stringify no campo TEXT do risco (medidas_adotadas e
// medidas_recomendadas). Edit inline e adição/remoção são imediatos
// no array local — o save do form persiste tudo de uma vez.
// =============================================================

function MedidasInline({
  adotadas,
  recomendadas,
  onChangeAdotadas,
  onChangeRecomendadas,
  sugestoesAdotadas,
  sugestoesRecomendadas,
}: {
  adotadas: string[];
  recomendadas: string[];
  onChangeAdotadas: (items: string[]) => void;
  onChangeRecomendadas: (items: string[]) => void;
  sugestoesAdotadas: string[];
  sugestoesRecomendadas: string[];
}) {
  return (
    <section className="space-y-3">
      <MedidaBloco
        ordem={5}
        titulo="Medidas Já Adotadas"
        descricao="Ações administrativas/operacionais já em prática"
        cor="green"
        items={adotadas}
        onChange={onChangeAdotadas}
        placeholder="Ex: Treinamento NR-06 anual"
        sugestoes={sugestoesAdotadas}
      />
      <MedidaBloco
        ordem={6}
        titulo="Medidas Recomendadas"
        descricao="Ações que precisam ser implementadas"
        cor="amber"
        items={recomendadas}
        onChange={onChangeRecomendadas}
        placeholder="Ex: Sinalizar pisos escorregadios"
        sugestoes={sugestoesRecomendadas}
      />
    </section>
  );
}

const CORES_MEDIDA: Record<
  "green" | "amber",
  { border: string; bg: string; text: string; tag: string }
> = {
  green: {
    border: "border-green-200",
    bg: "bg-green-50/30",
    text: "text-green-800",
    tag: "bg-green-100 text-green-800",
  },
  amber: {
    border: "border-amber-200",
    bg: "bg-amber-50/30",
    text: "text-amber-800",
    tag: "bg-amber-100 text-amber-800",
  },
};

function MedidaBloco({
  ordem,
  titulo,
  descricao,
  cor,
  items,
  onChange,
  placeholder,
  sugestoes,
}: {
  ordem: number;
  titulo: string;
  descricao: string;
  cor: keyof typeof CORES_MEDIDA;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  sugestoes: string[];
}) {
  const cfg = CORES_MEDIDA[cor];
  const [novo, setNovo] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const datalistId = `cat-medida-${ordem}`;

  function handleAdd() {
    const txt = novo.trim();
    if (!txt) {
      toast.error("Texto não pode ficar vazio");
      return;
    }
    onChange([...items, txt]);
    setNovo("");
  }

  function handleDel(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  function abrirEdit(idx: number, valor: string) {
    setEditingIdx(idx);
    setEditText(valor);
  }

  function salvarEdit(idx: number) {
    const txt = editText.trim();
    if (!txt) {
      toast.error("Texto não pode ficar vazio");
      return;
    }
    onChange(items.map((it, i) => (i === idx ? txt : it)));
    setEditingIdx(null);
  }

  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.bg} p-3`}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div>
          <p
            className={`text-xs font-bold uppercase tracking-wider ${cfg.text}`}
          >
            {ordem}º {titulo}
          </p>
          <p className="text-[11px] text-gray-600">{descricao}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.tag}`}
        >
          {items.length}
        </span>
      </div>

      {items.length > 0 && (
        <ul className="mb-2 divide-y divide-gray-100 rounded-md bg-white">
          {items.map((it, idx) => {
            const editando = editingIdx === idx;
            return (
              <li key={idx} className="flex items-center gap-2 px-2 py-1.5">
                {editando ? (
                  <>
                    <input
                      type="text"
                      value={editText}
                      onChange={(ev) => setEditText(ev.target.value)}
                      className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                      autoFocus
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") {
                          ev.preventDefault();
                          salvarEdit(idx);
                        }
                        if (ev.key === "Escape") {
                          ev.preventDefault();
                          setEditingIdx(null);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => salvarEdit(idx)}
                      className="rounded p-1 text-verde-primary hover:bg-verde-light"
                      title="Salvar"
                    >
                      <Check className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingIdx(null)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100"
                      title="Cancelar"
                    >
                      <X className="size-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-gray-900">{it}</span>
                    <button
                      type="button"
                      onClick={() => abrirEdit(idx, it)}
                      className="rounded p-1 text-gray-400 hover:bg-verde-light hover:text-verde-primary"
                      title="Editar"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDel(idx)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-alert"
                      title="Remover"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid grid-cols-[1fr_auto] items-center gap-2">
        <input
          type="text"
          list={sugestoes.length > 0 ? datalistId : undefined}
          value={novo}
          onChange={(ev) => setNovo(ev.target.value)}
          placeholder={placeholder}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
          onKeyDown={(ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              handleAdd();
            }
          }}
        />
        {sugestoes.length > 0 && (
          <datalist id={datalistId}>
            {sugestoes.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1 rounded-md bg-verde-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-verde-accent"
        >
          <Plus className="size-3.5" /> Adicionar
        </button>
      </div>
    </div>
  );
}

// =============================================================
// SEMEADURA DO CATÁLOGO (V4)
//
// Ao salvar um risco, alimenta `itens_catalogo_tipo` com os valores
// digitados (agente, fonte, EPIs/EPCs, medidas) — só insere os que
// ainda não existem no catálogo do tipo. Idempotente: o índice único
// (id_tipo, categoria, lower(texto)) protege contra race conditions.
// Falhas aqui são logadas mas não derrubam o save do risco.
// =============================================================

async function semearCatalogoFormSnapshot(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  idTipo: string | undefined,
  catalogo: ItemCatalogoTipo[],
  itensModelo: ItemModeloRisco[],
  form: FormState
) {
  // Se há modelo escolhido: semeia EPIs/EPCs/medidas em itens_modelo_risco.
  // Agente/fonte NÃO são semeados (são atributos do modelo, não listas).
  // Senão: comportamento V4 — semeia tudo em itens_catalogo_tipo.
  if (form.id_modelo) {
    await semearItensModelo(supabase, form.id_modelo, itensModelo, form);
    return;
  }

  if (!idTipo) return;

  const novos: Array<{ categoria: CategoriaCatalogo; texto: string }> = [];

  if (form.agente.trim()) {
    novos.push({ categoria: "agente", texto: form.agente.trim() });
  }
  for (const f of form.fontes_geradoras_lista) {
    const t = f.trim();
    if (t) novos.push({ categoria: "fonte_geradora", texto: t });
  }
  for (const ep of form.epis_pendentes) {
    const desc = ep.descricao.trim();
    if (!desc) continue;
    const cat: CategoriaCatalogo =
      ep.tipo === "EPI"
        ? ep.recomendado === "Sim"
          ? "epi_recomendado"
          : "epi_utilizado"
        : ep.recomendado === "Sim"
        ? "epc_recomendado"
        : "epc_utilizado";
    novos.push({ categoria: cat, texto: desc });
  }
  for (const m of form.medidas_adotadas_lista) {
    const t = m.trim();
    if (t) novos.push({ categoria: "medida_adotada", texto: t });
  }
  for (const m of form.medidas_recomendadas_lista) {
    const t = m.trim();
    if (t) novos.push({ categoria: "medida_recomendada", texto: t });
  }

  if (novos.length === 0) return;

  const existentes = new Set(
    catalogo.map((i) => `${i.categoria}::${i.texto.toLowerCase()}`)
  );
  const maxOrdem = new Map<CategoriaCatalogo, number>();
  for (const i of catalogo) {
    const cur = maxOrdem.get(i.categoria) ?? -1;
    if (i.ordem > cur) maxOrdem.set(i.categoria, i.ordem);
  }

  const seen = new Set<string>();
  const inserir: Array<{
    id_item: string;
    id_tipo: string;
    categoria: CategoriaCatalogo;
    texto: string;
    ordem: number;
  }> = [];

  for (const { categoria, texto } of novos) {
    const k = `${categoria}::${texto.toLowerCase()}`;
    if (existentes.has(k) || seen.has(k)) continue;
    seen.add(k);
    const next = (maxOrdem.get(categoria) ?? -1) + 1;
    maxOrdem.set(categoria, next);
    inserir.push({
      id_item: gerarId("CAT"),
      id_tipo: idTipo,
      categoria,
      texto,
      ordem: next,
    });
  }

  if (inserir.length === 0) return;

  const { error } = await supabase
    .from("itens_catalogo_tipo")
    .insert(inserir as never);
  if (error) {
    console.warn("[catalogo] semeadura falhou:", error.message);
  }
}

async function semearItensModelo(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  idModelo: string,
  itensModelo: ItemModeloRisco[],
  form: FormState
) {
  type CatModelo =
    | "fonte_geradora"
    | "epi_utilizado"
    | "epi_recomendado"
    | "epc_utilizado"
    | "epc_recomendado"
    | "medida_adotada"
    | "medida_recomendada";

  const novos: Array<{ categoria: CatModelo; texto: string }> = [];

  for (const f of form.fontes_geradoras_lista) {
    const t = f.trim();
    if (t) novos.push({ categoria: "fonte_geradora", texto: t });
  }
  for (const ep of form.epis_pendentes) {
    const desc = ep.descricao.trim();
    if (!desc) continue;
    const cat: CatModelo =
      ep.tipo === "EPI"
        ? ep.recomendado === "Sim"
          ? "epi_recomendado"
          : "epi_utilizado"
        : ep.recomendado === "Sim"
        ? "epc_recomendado"
        : "epc_utilizado";
    novos.push({ categoria: cat, texto: desc });
  }
  for (const m of form.medidas_adotadas_lista) {
    const t = m.trim();
    if (t) novos.push({ categoria: "medida_adotada", texto: t });
  }
  for (const m of form.medidas_recomendadas_lista) {
    const t = m.trim();
    if (t) novos.push({ categoria: "medida_recomendada", texto: t });
  }

  if (novos.length === 0) return;

  const existentes = new Set(
    itensModelo.map((i) => `${i.categoria}::${i.texto.toLowerCase()}`)
  );
  const maxOrdem = new Map<string, number>();
  for (const i of itensModelo) {
    const cur = maxOrdem.get(i.categoria) ?? -1;
    if (i.ordem > cur) maxOrdem.set(i.categoria, i.ordem);
  }

  const seen = new Set<string>();
  const inserir: Array<{
    id_item: string;
    id_modelo: string;
    categoria: CatModelo;
    texto: string;
    ordem: number;
  }> = [];

  for (const { categoria, texto } of novos) {
    const k = `${categoria}::${texto.toLowerCase()}`;
    if (existentes.has(k) || seen.has(k)) continue;
    seen.add(k);
    const next = (maxOrdem.get(categoria) ?? -1) + 1;
    maxOrdem.set(categoria, next);
    inserir.push({
      id_item: gerarId("ITM"),
      id_modelo: idModelo,
      categoria,
      texto,
      ordem: next,
    });
  }

  if (inserir.length === 0) return;

  const { error } = await supabase
    .from("itens_modelo_risco")
    .insert(inserir as never);
  if (error) {
    console.warn("[modelo] semeadura falhou:", error.message);
  }
}

// =============================================================
// Estilos compartilhados
// =============================================================

const inputCls =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30";
const lblCls = "text-sm font-medium text-gray-700";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={lblCls}>{label}</label>
      {children}
    </div>
  );
}

/**
 * Mapeia o nome do tipo de risco pra sua cor NR-09 oficial.
 * Tipos não-padrão (Psicossocial, Ambiental, IAPAT*) usam cores
 * arbitrárias mas distintas.
 */
function corNR09(tipo: string): SubGridCor {
  if (tipo === "Acidente") return "blue";
  if (tipo === "Ergonômico") return "yellow";
  if (tipo === "Físico") return "green";
  if (tipo === "Químico") return "red";
  if (tipo === "Biológico") return "amber";
  if (tipo === "Psicossocial") return "purple";
  if (tipo === "Ambiental") return "stone";
  if (tipo.startsWith("IAPAT")) return "slate";
  return "gray";
}

// Cores das seções "Detalhes — X" seguem o padrão NR-09 / PGR brasileiro:
//   Físico=verde, Químico=vermelho, Biológico=marrom (amber escuro),
//   Ergonômico=amarelo, Acidente=azul. Psicossocial e IAPAT não têm
//   cor oficial — uso roxo e ardósia respectivamente.
type SubGridCor =
  | "green"
  | "red"
  | "amber"
  | "yellow"
  | "blue"
  | "purple"
  | "slate"
  | "stone"
  | "rose"
  | "gray";

const SUBGRID_CORES: Record<
  SubGridCor,
  { border: string; bg: string; text: string }
> = {
  green: {
    border: "border-green-300",
    bg: "bg-green-50/40",
    text: "text-green-800",
  },
  red: {
    border: "border-red-300",
    bg: "bg-red-50/40",
    text: "text-red-800",
  },
  amber: {
    border: "border-amber-400",
    bg: "bg-amber-50/40",
    text: "text-amber-900",
  },
  yellow: {
    border: "border-yellow-300",
    bg: "bg-yellow-50/40",
    text: "text-yellow-800",
  },
  blue: {
    border: "border-blue-300",
    bg: "bg-blue-50/40",
    text: "text-blue-800",
  },
  purple: {
    border: "border-purple-300",
    bg: "bg-purple-50/40",
    text: "text-purple-800",
  },
  slate: {
    border: "border-slate-200",
    bg: "bg-slate-50/40",
    text: "text-slate-700",
  },
  stone: {
    border: "border-stone-200",
    bg: "bg-stone-50/40",
    text: "text-stone-700",
  },
  rose: {
    border: "border-rose-200",
    bg: "bg-rose-50/40",
    text: "text-rose-800",
  },
  gray: {
    border: "border-gray-200",
    bg: "bg-white",
    text: "text-gray-500",
  },
};

function SubGrid({
  title,
  children,
  cor = "gray",
}: {
  title: string;
  children: React.ReactNode;
  cor?: SubGridCor;
}) {
  const cfg = SUBGRID_CORES[cor];
  return (
    <section>
      <p
        className={`mb-2 text-xs font-semibold uppercase tracking-wider ${cfg.text}`}
      >
        {title}
      </p>
      <div
        className={`grid gap-3 rounded-lg border p-3 md:grid-cols-3 ${cfg.border} ${cfg.bg}`}
      >
        {children}
      </div>
    </section>
  );
}

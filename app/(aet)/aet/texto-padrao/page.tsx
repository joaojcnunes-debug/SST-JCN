"use client";

import { useEffect, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import RichTextEditor from "@/components/drps/RichTextEditor";
import {
  useAetTextoPadrao,
  useAetCriarCapitulo,
  useAetSalvarCapitulo,
  useAetExcluirCapitulo,
} from "@/lib/hooks/useAet";
import type { AetTextoPadraoCapitulo } from "@/lib/supabase/types";

const TEMPLATE_INICIAL: { titulo: string; conteudo: string }[] = [
  {
    titulo: "1 – Caracterização da Empresa",
    conteudo: "<p>Razão Social, CNPJ, endereço e demais dados da empresa avaliada.</p>",
  },
  {
    titulo: "2 – Introdução Geral",
    conteudo:
      "<p>A ergonomia estuda a adaptação do trabalho ao homem. Envolve tanto o ambiente físico como os aspectos organizacionais e cognitivos. A ergonomia abrange atividades de planejamento e projeto, que ocorre antes do trabalho ser realizado, e aqueles de controle e avaliação, que ocorrem durante e após o trabalho.</p>" +
      "<p>A mesma pode ser ainda caracterizada como a ocupação de pessoas qualificadas em grupos de pesquisa e formação que atuam em equipes de projeto e consultoria para responder às demandas acerca da atividade de trabalho na sociedade mediante metodologias de análises e projeto de bases científicas e devidamente inseridas num universo normativo e contratual.</p>",
  },
  {
    titulo: "3 – Objetivo",
    conteudo:
      "<p>Este estudo tem como objetivo avaliar os postos de trabalho da empresa especificada, promovendo análise ergonômica das atividades e funções, sendo adotados métodos de análise aplicados para fins ergonômicos.</p>" +
      "<p><strong>BASE LEGAL:</strong> Portaria 3.214/78 do Ministério do Trabalho – NR-17</p>",
  },
  {
    titulo: "4 – Metodologia",
    conteudo:
      "<p>Durante o trabalho realizado, foram avaliadas todas as funções conforme sugerido pela Metodologia da AET, excluindo-se a metodologia por amostragem, uma vez que cada função de trabalho caracteriza um desenvolvimento laboral de forma diferenciada.</p>" +
      "<p>A AET tem por finalidade transformar as condições de trabalho e adaptar às características psicofisiológicas dos trabalhadores, buscando conciliar dois universos: saúde e produtividade.</p>" +
      "<p>A metodologia da AET utiliza-se de observações da situação de trabalho, análise da tarefa, entrevistas e verbalizações com os diferentes níveis hierárquicos, buscando compreender em detalhes as atividades nas suas diferentes dimensões (física, cognitiva, mental e social).</p>",
  },
  {
    titulo: "5 – Levantamento, Transporte e Descarga Individual de Materiais",
    conteudo:
      "<p>Deverão ser executados de forma que o esforço físico realizado pelo trabalhador seja compatível com sua capacidade de força e não comprometa a sua saúde ou sua segurança.</p>" +
      "<p>Para manipulações ocasionais, não repetitivas, o limite de 25 quilos para homens e 15 quilos para mulheres é sugerido por vários autores, desde que observadas boas práticas para a manipulação.</p>",
  },
  {
    titulo: "6 – Mobiliário dos Postos de Trabalho",
    conteudo:
      "<p>A análise ergonômica do trabalho leva em consideração que:</p>" +
      "<ul><li>Sempre que possível o trabalho deve ser executado na posição sentada;</li>" +
      "<li>O mobiliário deve prover condições para que o trabalho seja executado dentro da zona de conforto dos segmentos corporais;</li>" +
      "<li>Os comandos sejam de fácil acionamento;</li>" +
      "<li>Os assentos sejam adequados.</li></ul>",
  },
  {
    titulo: "7 – Equipamentos dos Postos de Trabalho",
    conteudo:
      "<p>A análise ergonômica do trabalho leva em consideração que o mobiliário/equipamentos devem prover condições para que o trabalho seja executado dentro da zona de conforto dos segmentos corporais, em boa condição postural e livre de reflexos.</p>",
  },
  {
    titulo: "8 – Condições Ambientais de Trabalho",
    conteudo:
      "<p>O estudo da exposição ocupacional dos trabalhadores aos agentes ambientais está contemplado no Programa de Gerenciamento de Riscos – PGR da empresa.</p>",
  },
  {
    titulo: "11 – Organização do Trabalho",
    conteudo:
      "<p>Na análise foram levados em consideração os seguintes aspectos:</p>" +
      "<ul><li>As normas de produção;</li><li>O modo operatório;</li><li>A exigência de tempo;</li>" +
      "<li>A determinação do conteúdo de tempo;</li><li>O ritmo de trabalho;</li>" +
      "<li>O conteúdo das tarefas;</li><li>Horário de trabalho.</li></ul>",
  },
  {
    titulo: "12 – Ferramentas Biomecânicas Aplicadas",
    conteudo:
      "<p>Método OWAS: O Método OWAS (Ovako Working Posture Analysing System) foi desenvolvido na Finlândia por Karhu, Kansi e Kuorinka, entre 1974 e 1978, juntamente com o Instituto Finlandês de Saúde Ocupacional, objetivando gerar informações para melhorar os métodos de trabalho pela identificação de posturas corporais prejudiciais durante a realização das atividades.</p>",
  },
];

export default function AetTextoPadraoPage() {
  const { data: capitulos = [], isLoading } = useAetTextoPadrao();
  const criar = useAetCriarCapitulo();
  const salvar = useAetSalvarCapitulo();
  const excluir = useAetExcluirCapitulo();

  const [confirmExcluir, setConfirmExcluir] = useState<AetTextoPadraoCapitulo | null>(null);

  function novoCapitulo() {
    criar.mutate({ titulo: `Seção ${capitulos.length + 1}`, conteudo: "", ordem: capitulos.length });
  }

  function seedTemplate() {
    let ordem = capitulos.length;
    for (const tpl of TEMPLATE_INICIAL) {
      criar.mutate({ titulo: tpl.titulo, conteudo: tpl.conteudo, ordem });
      ordem++;
    }
  }

  function mover(cap: AetTextoPadraoCapitulo, direcao: "up" | "down") {
    const idx = capitulos.findIndex((c) => c.id_capitulo === cap.id_capitulo);
    const novoIdx = direcao === "up" ? idx - 1 : idx + 1;
    if (novoIdx < 0 || novoIdx >= capitulos.length) return;
    const outro = capitulos[novoIdx];
    salvar.mutate({ id_capitulo: cap.id_capitulo, ordem: outro.ordem });
    salvar.mutate({ id_capitulo: outro.id_capitulo, ordem: cap.ordem });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Texto Padrão</h1>
          <p className="text-sm text-gray-600">
            Seções que compõem o laudo AET. A ordem aqui é a ordem que aparece no relatório.
            Use <strong>Carregar modelo inicial</strong> para começar com as seções da NR-17.
          </p>
        </div>
        <div className="flex gap-2">
          {capitulos.length === 0 && !isLoading && (
            <button
              type="button"
              onClick={seedTemplate}
              disabled={criar.isPending}
              className="inline-flex items-center gap-2 rounded-md border border-verde-primary bg-white px-3 py-2 text-sm font-semibold text-verde-primary hover:bg-verde-light disabled:opacity-50"
            >
              <BookOpen className="size-4" /> Carregar modelo inicial
            </button>
          )}
          <button
            type="button"
            onClick={novoCapitulo}
            disabled={criar.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent disabled:opacity-50"
          >
            <Plus className="size-4" /> Nova Seção
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <LoadingSkeleton rows={3} />
        </div>
      ) : capitulos.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">
          Nenhuma seção cadastrada ainda. Clique em{" "}
          <strong>Carregar modelo inicial</strong> para popular com as seções padrão da NR-17
          ou em <strong>Nova Seção</strong> para começar do zero.
        </div>
      ) : (
        <div className="space-y-3">
          {capitulos.map((cap, i) => (
            <SecaoCard
              key={cap.id_capitulo}
              capitulo={cap}
              indice={i}
              total={capitulos.length}
              salvando={salvar.isPending}
              onSalvar={(patch) => salvar.mutate({ id_capitulo: cap.id_capitulo, ...patch })}
              onMover={(dir) => mover(cap, dir)}
              onExcluir={() => setConfirmExcluir(cap)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmExcluir}
        title="Excluir seção?"
        description={
          confirmExcluir
            ? `A seção "${confirmExcluir.titulo}" será removida permanentemente.`
            : undefined
        }
        variant="danger"
        loading={excluir.isPending}
        onConfirm={() => {
          if (!confirmExcluir) return;
          excluir.mutate(confirmExcluir.id_capitulo, {
            onSuccess: () => setConfirmExcluir(null),
          });
        }}
        onCancel={() => setConfirmExcluir(null)}
      />
    </div>
  );
}

function SecaoCard({
  capitulo,
  indice,
  total,
  salvando,
  onSalvar,
  onMover,
  onExcluir,
}: {
  capitulo: AetTextoPadraoCapitulo;
  indice: number;
  total: number;
  salvando: boolean;
  onSalvar: (patch: { titulo?: string; conteudo?: string | null }) => void;
  onMover: (dir: "up" | "down") => void;
  onExcluir: () => void;
}) {
  const [titulo, setTitulo] = useState(capitulo.titulo);
  const [conteudo, setConteudo] = useState(capitulo.conteudo ?? "");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setTitulo(capitulo.titulo);
    setConteudo(capitulo.conteudo ?? "");
    setDirty(false);
  }, [capitulo.id_capitulo, capitulo.titulo, capitulo.conteudo]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-2">
        {/* Reordenar */}
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => onMover("up")}
            disabled={indice === 0}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onMover("down")}
            disabled={indice === total - 1}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>

        {/* Título */}
        <input
          type="text"
          value={titulo}
          onChange={(e) => { setTitulo(e.target.value); setDirty(true); }}
          placeholder="Título da seção"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
        />

        {/* Salvar */}
        <button
          type="button"
          onClick={() => { onSalvar({ titulo: titulo.trim(), conteudo: conteudo.trim() || null }); setDirty(false); }}
          disabled={!dirty || salvando || !titulo.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-2 text-xs font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
        >
          {salvando ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Salvar
        </button>

        {/* Excluir */}
        <button
          type="button"
          onClick={onExcluir}
          className="rounded-md border border-gray-300 bg-white p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <RichTextEditor
        value={conteudo}
        onChange={(html) => { setConteudo(html); setDirty(true); }}
        placeholder="Conteúdo da seção..."
        uploadPathPrefix="aet-textos"
      />
    </div>
  );
}

"use client";

import {
  BookOpen,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Users,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Info,
  Layers,
  Calculator,
} from "lucide-react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function ComoFuncionaPage() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  useEffect(() => {
    if (user && user.perfil !== "Admin") router.replace("/questionarios-psicossociais");
  }, [user, router]);

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      {/* Cabeçalho */}
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <BookOpen className="size-5 text-indigo-600" />
          Metodologia e Métricas
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Entenda como funciona a avaliação psicossocial e como interpretar os resultados
        </p>
      </div>

      {/* Visão geral */}
      <Section icon={<Info className="size-5 text-indigo-500" />} title="Visão Geral">
        <p className="text-sm text-gray-700 leading-relaxed">
          O módulo QPS / DRPS realiza a avaliação de <strong>riscos psicossociais no trabalho</strong> por meio de
          questionários estruturados. Cada questionário é composto por <strong>categorias (dimensões)</strong> e{" "}
          <strong>perguntas</strong> respondidas em uma escala numérica. Os resultados são agregados por categoria
          e por respondente para gerar uma visão de risco por setor e cargo.
        </p>
      </Section>

      {/* Estrutura do questionário */}
      <Section icon={<Layers className="size-5 text-indigo-500" />} title="Estrutura do Questionário">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card color="indigo" label="Tipo" desc="Define o questionário: nome, escala de resposta e instruções ao respondente." />
          <Card color="violet" label="Categoria / Dimensão" desc="Agrupa perguntas de um mesmo tema (ex: Demanda, Controle, Suporte Social)." />
          <Card color="blue" label="Pergunta" desc="Afirmação respondida pelo participante usando a escala definida no Tipo." />
        </div>
      </Section>

      {/* Escala de resposta */}
      <Section icon={<BarChart2 className="size-5 text-indigo-500" />} title="Escala de Resposta">
        <p className="mb-4 text-sm text-gray-700 leading-relaxed">
          Cada questionário define uma escala mínima e máxima (ex: 1 a 5). Os rótulos são atribuídos
          automaticamente de acordo com o tamanho da escala:
        </p>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left">Tamanho</th>
                <th className="px-4 py-2.5 text-left">Exemplo de escala</th>
                <th className="px-4 py-2.5 text-left">Rótulos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                { tam: "2 pontos", ex: "0 – 1", labels: "Não · Sim" },
                { tam: "3 pontos", ex: "1 – 3", labels: "Baixo · Médio · Alto" },
                { tam: "4 pontos", ex: "1 – 4", labels: "Nunca · Às vezes · Frequentemente · Sempre" },
                { tam: "5 pontos", ex: "1 – 5", labels: "Nunca · Raramente · Às vezes · Frequentemente · Sempre" },
                { tam: "6 pontos", ex: "1 – 6", labels: "Nunca · Raramente · Às vezes · Frequentemente · Muito frequentemente · Sempre" },
                { tam: "7 pontos", ex: "1 – 7", labels: "Discordo totalmente … Concordo totalmente" },
              ].map((row) => (
                <tr key={row.tam} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{row.tam}</td>
                  <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{row.ex}</td>
                  <td className="px-4 py-2.5 text-gray-600">{row.labels}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Lógica das perguntas */}
      <Section icon={<Calculator className="size-5 text-indigo-500" />} title="Lógica das Perguntas">
        <p className="mb-4 text-sm text-gray-700 leading-relaxed">
          Cada pergunta tem uma <strong>lógica</strong> que define como interpretar a pontuação:
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <LogicaCard
            tipo="direta"
            icon={<TrendingUp className="size-5 text-orange-500" />}
            cor="orange"
            titulo="Direta"
            desc="Pontuações altas indicam maior exposição ao risco. Ex: &ldquo;Meu trabalho exige esforço físico intenso&rdquo; — marcar 5 (Sempre) é ruim."
            exemplos={["Demandas excessivas", "Pressão por resultados", "Falta de tempo"]}
          />
          <LogicaCard
            tipo="invertida"
            icon={<TrendingDown className="size-5 text-green-600" />}
            cor="green"
            titulo="Invertida"
            desc="Pontuações altas indicam situação favorável. Ex: &ldquo;Tenho apoio do meu gestor&rdquo; — marcar 5 (Sempre) é bom."
            exemplos={["Apoio da chefia", "Autonomia no trabalho", "Reconhecimento"]}
          />
        </div>
        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <strong>Como funciona o cálculo:</strong> perguntas invertidas têm seus valores espelhados antes do
          cálculo da média da categoria. Assim, uma pontuação alta na pergunta invertida contribui
          positivamente (menor risco) para a média da categoria.
        </div>
      </Section>

      {/* Cálculo dos scores */}
      <Section icon={<BarChart2 className="size-5 text-indigo-500" />} title="Cálculo dos Escores">
        <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
          <p>
            O escore de cada categoria é calculado como a <strong>média das respostas</strong> às perguntas
            daquela categoria, após a inversão das perguntas com lógica invertida. O resultado é normalizado
            para uma escala de <strong>0 a 100%</strong>:
          </p>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-4 font-mono text-xs text-gray-700 space-y-1">
            <p><span className="text-indigo-600">valor_invertido</span> = escala_max + escala_min − resposta</p>
            <p><span className="text-indigo-600">media_categoria</span> = média(respostas após inversão)</p>
            <p><span className="text-indigo-600">score_%</span> = (media − escala_min) / (escala_max − escala_min) × 100</p>
          </div>
          <p>
            O <strong>score geral do respondente</strong> é a média dos escores de todas as categorias com
            pelo menos uma resposta válida.
          </p>
        </div>
      </Section>

      {/* Níveis de risco */}
      <Section icon={<AlertTriangle className="size-5 text-indigo-500" />} title="Níveis de Risco">
        <p className="mb-4 text-sm text-gray-700">
          O score normalizado (0–100%) é classificado em três níveis de risco:
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <RiscoCard nivel="Baixo" faixa="0 – 40%" cor="green" desc="Condições favoráveis. Manter e monitorar." />
          <RiscoCard nivel="Moderado" faixa="41 – 70%" cor="yellow" desc="Atenção necessária. Avaliar ações preventivas." />
          <RiscoCard nivel="Alto" faixa="71 – 100%" cor="red" desc="Exposição significativa. Intervenção prioritária." />
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Esses limiares são referências orientativas e podem ser ajustados conforme a metodologia adotada
          pela organização (ex: DRPS, Copsoq, NR-01).
        </p>
      </Section>

      {/* Coleta de dados */}
      <Section icon={<FileSpreadsheet className="size-5 text-indigo-500" />} title="Coleta e Importação de Dados">
        <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
          <p>
            As respostas podem ser coletadas de duas formas:
          </p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              <strong>Google Forms / Planilha:</strong> configure o formulário usando o <em>Guia Forms</em>{" "}
              disponível na página de Respondentes. Após a coleta, exporte as respostas como{" "}
              <strong>CSV do Google Sheets</strong> e importe diretamente no painel.
            </li>
            <li>
              <strong>Excel:</strong> use o modelo de importação Excel disponível na página de Respondentes.
              Preencha as colunas de setor, cargo e as respostas de cada pergunta (uma por coluna, na ordem
              definida no questionário).
            </li>
          </ol>
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-blue-800">
            <strong>Atenção:</strong> a ordem das colunas de resposta no arquivo importado deve seguir
            exatamente a ordem das perguntas cadastradas no sistema. Use sempre o modelo gerado pelo painel
            para garantir a correspondência correta.
          </div>
        </div>
      </Section>

      {/* Respondentes */}
      <Section icon={<Users className="size-5 text-indigo-500" />} title="Respondentes e Confidencialidade">
        <p className="text-sm text-gray-700 leading-relaxed">
          Os dados são agrupados por <strong>setor</strong> e <strong>cargo</strong>. O painel exibe
          resultados por setor somente quando há <strong>3 ou mais respondentes</strong> naquele grupo,
          preservando a confidencialidade individual. Grupos com menos de 3 participantes são consolidados
          em &ldquo;Outros&rdquo; na visualização de resultados.
        </p>
      </Section>

      {/* Base legal */}
      <Section icon={<CheckCircle2 className="size-5 text-indigo-500" />} title="Base Normativa">
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">NR-01</span>
            <span>Norma Regulamentadora nº 1 — obriga a identificação e avaliação de riscos psicossociais no Programa de Gerenciamento de Riscos (PGR) a partir de 2025.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">DRPS</span>
            <span>Diagnóstico de Riscos Psicossociais no trabalho — instrumento validado pelo INRS adaptado ao contexto brasileiro.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">Copsoq</span>
            <span>Copenhagen Psychosocial Questionnaire — referência internacional para avaliação de riscos psicossociais, adaptável ao módulo via importação de Tipos personalizados.</span>
          </li>
        </ul>
      </Section>
    </div>
  );
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2 border-b border-gray-100 pb-2">
        {icon}
        <h2 className="text-base font-bold text-gray-800">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Card({ color, label, desc }: { color: string; label: string; desc: string }) {
  const colors: Record<string, string> = {
    indigo: "border-indigo-200 bg-indigo-50",
    violet: "border-violet-200 bg-violet-50",
    blue: "border-blue-200 bg-blue-50",
  };
  const labelColors: Record<string, string> = {
    indigo: "text-indigo-700",
    violet: "text-violet-700",
    blue: "text-blue-700",
  };
  return (
    <div className={cn("rounded-xl border p-4", colors[color])}>
      <p className={cn("mb-1 text-sm font-bold", labelColors[color])}>{label}</p>
      <p className="text-xs text-gray-600 leading-relaxed">{desc}</p>
    </div>
  );
}

function LogicaCard({
  icon,
  cor,
  titulo,
  desc,
  exemplos,
}: {
  tipo: string;
  icon: React.ReactNode;
  cor: string;
  titulo: string;
  desc: string;
  exemplos: string[];
}) {
  const border = cor === "orange" ? "border-orange-200 bg-orange-50" : "border-green-200 bg-green-50";
  const badge = cor === "orange" ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700";
  const bullet = cor === "orange" ? "text-orange-400" : "text-green-500";

  return (
    <div className={cn("rounded-xl border p-4", border)}>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <span className={cn("rounded px-2 py-0.5 text-xs font-bold", badge)}>{titulo}</span>
      </div>
      <p className="mb-3 text-xs text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: desc }} />
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Exemplos:</p>
      <ul className="space-y-0.5">
        {exemplos.map((e) => (
          <li key={e} className={cn("text-xs", bullet)}>
            · {e}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RiscoCard({
  nivel,
  faixa,
  cor,
  desc,
}: {
  nivel: string;
  faixa: string;
  cor: "green" | "yellow" | "red";
  desc: string;
}) {
  const styles = {
    green: { wrap: "border-green-200 bg-green-50", badge: "bg-green-100 text-green-700", faixa: "text-green-600" },
    yellow: { wrap: "border-yellow-200 bg-yellow-50", badge: "bg-yellow-100 text-yellow-700", faixa: "text-yellow-600" },
    red: { wrap: "border-red-200 bg-red-50", badge: "bg-red-100 text-red-700", faixa: "text-red-600" },
  }[cor];

  return (
    <div className={cn("rounded-xl border p-4", styles.wrap)}>
      <div className="mb-1 flex items-center justify-between">
        <span className={cn("rounded px-2 py-0.5 text-xs font-bold", styles.badge)}>{nivel}</span>
        <span className={cn("text-xs font-mono font-semibold", styles.faixa)}>{faixa}</span>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">{desc}</p>
    </div>
  );
}

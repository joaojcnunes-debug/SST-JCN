"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, ResponsiveContainer } from "recharts";
import { CheckCircle2, AlertTriangle, ListTodo, Target, Clock } from "lucide-react";
import { PRIORIDADES, formatarDuracao, type GestaoTarefa, type GestaoStatus } from "@/lib/hooks/useGestao";

function diasAte(iso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((new Date(iso + "T00:00:00").getTime() - hoje.getTime()) / 86_400_000);
}

function Kpi({ icon, label, valor, cor }: { icon: React.ReactNode; label: string; valor: string | number; cor: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
        <span style={{ color: cor }}>{icon}</span> {label}
      </div>
      <p className="mt-1 text-2xl font-bold text-gray-900">{valor}</p>
    </div>
  );
}

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-semibold text-gray-800">{titulo}</p>
      {children}
    </div>
  );
}

export default function PainelGestao({
  tarefas,
  statuses,
  tempoPorTarefa,
}: {
  tarefas: GestaoTarefa[];
  statuses: GestaoStatus[];
  tempoPorTarefa: Map<string, number>;
}) {
  const statusMap = useMemo(() => new Map(statuses.map((s) => [s.slug, s])), [statuses]);

  const total = tarefas.length;
  const concluidas = tarefas.filter((t) => statusMap.get(t.status)?.tipo === "concluido").length;
  const atrasadas = tarefas.filter((t) => t.prazo && diasAte(t.prazo) < 0 && statusMap.get(t.status)?.tipo !== "concluido").length;
  const pontosTotal = tarefas.reduce((s, t) => s + (t.pontos ?? 0), 0);
  const tempoTotal = tarefas.reduce((s, t) => s + (tempoPorTarefa.get(t.id_tarefa) ?? 0), 0);

  const porStatus = useMemo(
    () => statuses.map((s) => ({ nome: s.nome, valor: tarefas.filter((t) => t.status === s.slug).length, cor: s.cor })).filter((d) => d.valor > 0),
    [statuses, tarefas],
  );

  const porPrioridade = useMemo(
    () => PRIORIDADES.map((p) => ({ nome: p.label, valor: tarefas.filter((t) => t.prioridade === p.value).length, cor: p.cor })).filter((d) => d.valor > 0),
    [tarefas],
  );

  const porResponsavel = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tarefas) { const k = t.responsavel?.trim() || "Sem responsável"; m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, [tarefas]);

  const tempoPorResp = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tarefas) {
      const seg = tempoPorTarefa.get(t.id_tarefa) ?? 0;
      if (seg <= 0) continue;
      const k = t.responsavel?.trim() || "Sem responsável";
      m.set(k, (m.get(k) ?? 0) + seg);
    }
    return [...m.entries()].map(([nome, seg]) => ({ nome, horas: +(seg / 3600).toFixed(1) })).sort((a, b) => b.horas - a.horas).slice(0, 10);
  }, [tarefas, tempoPorTarefa]);

  if (total === 0) {
    return <p className="mt-8 text-center text-sm text-gray-400">Nenhuma tarefa nesta lista para exibir no painel.</p>;
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icon={<ListTodo className="size-4" />} label="Total" valor={total} cor="#0ea5e9" />
        <Kpi icon={<CheckCircle2 className="size-4" />} label="Concluídas" valor={`${concluidas} (${total ? Math.round((concluidas / total) * 100) : 0}%)`} cor="#16a34a" />
        <Kpi icon={<AlertTriangle className="size-4" />} label="Atrasadas" valor={atrasadas} cor="#D32F2F" />
        <Kpi icon={<Target className="size-4" />} label="Pontos" valor={pontosTotal} cor="#6366f1" />
        <Kpi icon={<Clock className="size-4" />} label="Tempo" valor={tempoTotal > 0 ? formatarDuracao(tempoTotal) : "—"} cor="#0891b2" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card titulo="Tarefas por status">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={porStatus} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
              <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip cursor={{ fill: "#f3f4f6" }} />
              <Bar dataKey="valor" name="Tarefas" radius={[4, 4, 0, 0]}>
                {porStatus.map((d) => <Cell key={d.nome} fill={d.cor} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card titulo="Por prioridade">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={porPrioridade} dataKey="valor" nameKey="nome" innerRadius={50} outerRadius={90} paddingAngle={2}>
                {porPrioridade.map((d) => <Cell key={d.nome} fill={d.cor} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {porPrioridade.map((d) => (
              <span key={d.nome} className="flex items-center gap-1 text-xs text-gray-600">
                <span className="size-2.5 rounded-full" style={{ background: d.cor }} /> {d.nome} ({d.valor})
              </span>
            ))}
          </div>
        </Card>

        <Card titulo="Por responsável">
          <ResponsiveContainer width="100%" height={Math.max(140, porResponsavel.length * 32)}>
            <BarChart data={porResponsavel} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 11 }} />
              <Tooltip cursor={{ fill: "#f3f4f6" }} />
              <Bar dataKey="valor" name="Tarefas" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card titulo="Tempo por responsável (h)">
          {tempoPorResp.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Sem tempo registrado nesta lista.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(140, tempoPorResp.length * 32)}>
              <BarChart data={tempoPorResp} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 11 }} />
                <Tooltip cursor={{ fill: "#f3f4f6" }} formatter={(v) => [`${v} h`, "Tempo"]} />
                <Bar dataKey="horas" name="Horas" fill="#0891b2" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Grid3x3, Activity, AlertTriangle, BarChart3 } from "lucide-react";
import toast from "react-hot-toast";
import MatrizRisco from "@/components/riscos/MatrizRisco";
import { PROBABILIDADES, SEVERIDADES } from "@/lib/utils";
import {
  NIVEIS_RISCO,
  NIVEL_CONFIG,
  TIPOS_RISCO,
  TIPO_ICONE,
} from "@/lib/constants";
import { useIsAdmin } from "@/lib/hooks/useUsuario";
import { cn } from "@/lib/utils";

type TabKey = "matriz" | "probabilidades" | "efeitos" | "niveis" | "tipos";

export default function ConfigPage() {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const [tab, setTab] = useState<TabKey>("matriz");

  useEffect(() => {
    if (!isAdmin) {
      const t = setTimeout(() => {
        toast.error("Apenas administradores podem acessar Configurações");
        router.replace("/dashboard");
      }, 200);
      return () => clearTimeout(t);
    }
  }, [isAdmin, router]);

  const TABS = [
    { key: "matriz" as TabKey, label: "Matriz de Risco", icon: Grid3x3 },
    { key: "probabilidades" as TabKey, label: "Probabilidades", icon: Activity },
    { key: "efeitos" as TabKey, label: "Efeitos / Severidade", icon: AlertTriangle },
    { key: "niveis" as TabKey, label: "Níveis", icon: BarChart3 },
    { key: "tipos" as TabKey, label: "Tipos de Risco", icon: AlertTriangle },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <nav className="flex flex-wrap gap-1 border-b border-gray-200 p-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-verde-primary text-white"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <Icon className="size-4" />
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="p-5">
          {tab === "matriz" && (
            <section className="space-y-3">
              <p className="text-sm text-gray-600">
                A matriz mostra o nível de risco resultante da combinação
                Severidade × Probabilidade. O cálculo segue a lógica SGG:
                cada eixo tem peso por índice (0–4), e o nível é determinado por
                regras de pontuação.
              </p>
              <MatrizRisco />
            </section>
          )}

          {tab === "probabilidades" && (
            <ListView
              title="Probabilidades"
              description="Lista em ordem crescente de peso (índice = peso)."
              items={[...PROBABILIDADES]}
            />
          )}

          {tab === "efeitos" && (
            <ListView
              title="Efeitos / Severidade"
              description="Lista em ordem crescente de severidade."
              items={[...SEVERIDADES]}
            />
          )}

          {tab === "niveis" && (
            <section>
              <h2 className="mb-3 text-base font-semibold text-gray-900">
                Níveis de Risco
              </h2>
              <p className="mb-4 text-sm text-gray-600">
                Cada nível tem uma cor para fundo, borda e texto, usada em
                badges e na matriz.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {NIVEIS_RISCO.map((n, i) => {
                  const cfg = NIVEL_CONFIG[n];
                  return (
                    <div
                      key={n}
                      className="rounded-lg border p-3"
                      style={{
                        borderColor: cfg.borda,
                        backgroundColor: cfg.bg,
                      }}
                    >
                      <p className="text-xs text-gray-500">Grau {i + 1}</p>
                      <p
                        className="text-lg font-bold"
                        style={{ color: cfg.cor }}
                      >
                        {n}
                      </p>
                      <p
                        className="mt-1 font-mono text-[10px]"
                        style={{ color: cfg.cor }}
                      >
                        {cfg.cor}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {tab === "tipos" && (
            <section>
              <h2 className="mb-3 text-base font-semibold text-gray-900">
                Tipos de Risco
              </h2>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {TIPOS_RISCO.map((t) => (
                  <div
                    key={t}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3"
                  >
                    <span className="text-2xl">{TIPO_ICONE[t] ?? "•"}</span>
                    <span className="font-medium text-gray-900">{t}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-gray-500">
        ⓘ Listas e cores são definidas em <code className="text-verde-primary">lib/constants.ts</code> e{" "}
        <code className="text-verde-primary">lib/utils.ts</code>. Para customizar, edite o código-fonte.
      </p>
    </div>
  );
}

function ListView({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <section>
      <h2 className="mb-1 text-base font-semibold text-gray-900">{title}</h2>
      <p className="mb-4 text-sm text-gray-600">{description}</p>
      <ol className="space-y-1.5">
        {items.map((item, i) => (
          <li
            key={item}
            className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-2"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-verde-light text-xs font-bold text-verde-primary">
              {i}
            </span>
            <span className="text-sm text-gray-800">{item}</span>
            <span className="ml-auto text-xs text-gray-400">peso {i}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

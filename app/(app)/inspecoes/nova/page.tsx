"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Copy,
  Building2,
  Loader2,
  Plus,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import {
  useInspecao,
  useInspecoesByEmpresa,
} from "@/lib/hooks/useInspecao";
import { useUsuariosParaAssociar } from "@/lib/hooks/useInspecaoAssociados";
import { contaDoTecnicoDigitado } from "@/lib/dashboard/vinculo-tecnicos";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId, cn } from "@/lib/utils";
import { useUserStore } from "@/lib/store";
import type {
  Cargo,
  Inspecao,
  Risco,
  Setor,
  TipoCriacao,
} from "@/lib/supabase/types";

type Step = 1 | 2 | 3;
type Tipo = "BRANCO" | "REVISAO" | "COPIA_EMPRESA" | "RENOVACAO";

interface OpcoesCopia {
  setores: boolean;
  cargos: boolean;
  riscos: boolean;
  epis: boolean;
  responsaveis: boolean;
  fotos: boolean;
}

export default function NovaInspecaoPage() {
  return (
    <Suspense fallback={null}>
      <NovaInspecaoInner />
    </Suspense>
  );
}

function NovaInspecaoInner() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);

  // Visualizador não pode criar inspeções — bloqueia mesmo via URL direta.
  useEffect(() => {
    if (user && user.perfil === "Visualizador") {
      toast.error("Visualizadores não podem criar inspeções");
      router.replace("/inspecoes");
    }
  }, [user, router]);

  const [step, setStep] = useState<Step>(1);
  const [empresaDestinoId, setEmpresaDestinoId] = useState<string | null>(
    params.get("empresa")
  );
  const [tipo, setTipo] = useState<Tipo>("BRANCO");
  const [empresaOrigemId, setEmpresaOrigemId] = useState<string | null>(null);
  const [inspBaseId, setInspBaseId] = useState<string | null>(null);
  const [dataInsp, setDataInsp] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [obs, setObs] = useState("");

  /**
   * QUEM VAI A CAMPO — decidido com ele em 2026-08-26.
   *
   * Até aqui a inspeção nascia SEM responsável (a linha de `responsaveis` só
   * era criada ao duplicar), e por isso 127 das 430 não tinham ninguém. O
   * dashboard então contava pelo campo `inspecoes.responsavel`, que é quem
   * CADASTROU no sistema — nem sempre quem foi à empresa.
   *
   * Sugerido, não cravado: o nome de quem está criando vem preenchido, mas
   * numa caixa visível que a pessoa troca antes de criar. Preencher sozinho e
   * calado poria o nome errado num documento que vai ao cliente -- foi o que o
   * Sanmyo recusou em 25/08 ("não podemos alocar qualquer técnico no lugar").
   */
  const [tecnicos, setTecnicos] = useState<string[]>([""]);
  const [tecnicoSemeado, setTecnicoSemeado] = useState(false);
  useEffect(() => {
    // Semeia UMA vez: o `user` chega depois da primeira renderização, e sem a
    // trava um segundo render sobrescreveria o que a pessoa já tivesse digitado.
    if (tecnicoSemeado || !user?.nome) return;
    setTecnicos([user.nome]);
    setTecnicoSemeado(true);
  }, [user, tecnicoSemeado]);

  const { data: usuariosSugestao } = useUsuariosParaAssociar();
  /**
   * `datalist`, não `select`: técnico de unidade sem usuário no painel (o de
   * Friburgo) precisa continuar podendo ser digitado, e sem sinal na portaria
   * do cliente a consulta falha e o campo vira input comum, sem travar nada.
   * Mesma régua do ResponsavelForm — se mudar aqui, mudar lá.
   */
  const sugestoesTecnico = useMemo(
    () =>
      (usuariosSugestao ?? [])
        .map((u) => (u.nome ?? "").trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [usuariosSugestao]
  );

  const [opcoes, setOpcoes] = useState<OpcoesCopia>({
    setores: true,
    cargos: true,
    riscos: true,
    epis: true,
    responsaveis: false,
    fotos: false,
  });

  // Inspeções da empresa destino — usadas para calcular o próximo número de
  // revisão, sempre sequencial dentro da empresa independente do responsável
  // ou do tipo de criação (BRANCO / REVISAO / COPIA_EMPRESA).
  const { data: inspecoesDestino = [] } =
    useInspecoesByEmpresa(empresaDestinoId);

  // Inspeções da empresa origem — só relevantes para COPIA_EMPRESA, onde a
  // origem é diferente do destino. Em REVISAO, origem === destino, então
  // reusamos inspecoesDestino.
  const { data: inspecoesOrigemCopia = [] } = useInspecoesByEmpresa(
    tipo === "COPIA_EMPRESA" ? empresaOrigemId : null
  );

  const inspecoesParaBase =
    tipo === "REVISAO" ? inspecoesDestino : inspecoesOrigemCopia;

  /**
   * Os dois tipos que NÃO copiam de uma inspeção base. Renovação (23/09) é o
   * registro do administrativo que só atualiza a empresa ou a data dos
   * documentos dela — não copia nada e não conta como inspeção nos gráficos.
   */
  const semBase = tipo === "BRANCO" || tipo === "RENOVACAO";

  const { data: baseFull } = useInspecao(
    !semBase ? inspBaseId : null
  );

  const proximaRevisao = useMemo(() => {
    const max = Math.max(
      0,
      ...inspecoesDestino.map((i) => i.revisao ?? 0)
    );
    return max + 1;
  }, [inspecoesDestino]);

  const create = useMutation({
    mutationFn: async () => {
      if (!empresaDestinoId) throw new Error("Selecione a empresa");
      if (!semBase && !inspBaseId)
        throw new Error("Selecione a inspeção base");

      const supabase = createSupabaseBrowserClient();
      const novaId = gerarId("INS");

      const tipoCriacao: TipoCriacao = tipo;
      const insertInsp = {
        id_inspecao: novaId,
        id_empresa: empresaDestinoId,
        data_inspecao: dataInsp,
        status: "EM_ANDAMENTO" as const,
        revisao: proximaRevisao,
        responsavel: user?.nome ?? null,
        observacoes: obs || null,
        tipo_criacao: tipoCriacao,
        id_inspecao_base: !semBase ? inspBaseId : null,
        usuario: user?.email ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: errInsp } = await supabase
        .from("inspecoes")
        .insert(insertInsp as never);
      if (errInsp) throw errInsp;

      // Cópia de dados (REVISAO ou COPIA_EMPRESA).
      if (!semBase && baseFull) {
        const mapaSetor = new Map<string, string>();
        const mapaCargo = new Map<string, string>();
        const mapaRisco = new Map<string, string>();

        if (opcoes.setores && baseFull.setores.length > 0) {
          const novosSetores = baseFull.setores.map<Partial<Setor>>((s) => {
            const novoId = gerarId("SET");
            mapaSetor.set(s.id_setor, novoId);
            return {
              id_setor: novoId,
              id_inspecao: novaId,
              id_empresa: empresaDestinoId,
              setor_ghe: s.setor_ghe,
              descricao: s.descricao,
              conformidade: s.conformidade,
              nao_conformidade: s.nao_conformidade,
            };
          });
          const { error } = await supabase
            .from("setores")
            .insert(novosSetores as never);
          if (error) throw error;
        }

        if (opcoes.cargos && opcoes.setores && baseFull.cargos.length > 0) {
          const novosCargos = baseFull.cargos.map<Partial<Cargo>>((c) => {
            const novoId = gerarId("CGO");
            mapaCargo.set(c.id_cargo, novoId);
            return {
              id_cargo: novoId,
              id_inspecao: novaId,
              id_empresa: empresaDestinoId,
              id_setor: mapaSetor.get(c.id_setor) ?? c.id_setor,
              cargo: c.cargo,
              descricao: c.descricao,
            };
          });
          const { error } = await supabase
            .from("cargos")
            .insert(novosCargos as never);
          if (error) throw error;
        }

        if (opcoes.riscos && baseFull.riscos.length > 0) {
          const novosRiscos = baseFull.riscos.map<Partial<Risco>>((r) => {
            const novoId = gerarId("RSC");
            mapaRisco.set(r.id_risco, novoId);
            return {
              ...r,
              id_risco: novoId,
              id_inspecao: novaId,
              id_empresa: empresaDestinoId,
              id_setor: r.id_setor
                ? mapaSetor.get(r.id_setor) ?? r.id_setor
                : null,
              id_cargo: r.id_cargo
                ? mapaCargo.get(r.id_cargo) ?? r.id_cargo
                : null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          });
          const { error } = await supabase
            .from("riscos")
            .insert(novosRiscos as never);
          if (error) throw error;
        }

        if (opcoes.epis && opcoes.riscos && baseFull.epis.length > 0) {
          const novos = baseFull.epis.map((e) => ({
            id_protecao: gerarId("EPI"),
            id_risco: mapaRisco.get(e.id_risco) ?? e.id_risco,
            id_inspecao: novaId,
            id_empresa: empresaDestinoId,
            id_setor: e.id_setor
              ? mapaSetor.get(e.id_setor) ?? e.id_setor
              : null,
            tipo: e.tipo,
            descricao: e.descricao,
            ca: e.ca,
            recomendado: e.recomendado,
          }));
          const { error } = await supabase
            .from("epi_epc")
            .insert(novos as never);
          if (error) throw error;
        }

        if (opcoes.responsaveis && baseFull.responsaveis.length > 0) {
          const novos = baseFull.responsaveis.map((r) => ({
            id_responsavel: gerarId("RSP"),
            id_inspecao: novaId,
            id_empresa: empresaDestinoId,
            tecnico_responsavel: r.tecnico_responsavel,
            // Carrega o vínculo junto (v204, Fase B1): a cópia herda um fato
            // que a inspeção de origem já tinha gravado, em vez de nascer
            // vazia e voltar a depender do texto digitado.
            id_usuario: r.id_usuario ?? null,
            recepcionado_por: r.recepcionado_por,
            cargo: r.cargo,
            data_hora: r.data_hora,
          }));
          const { error } = await supabase
            .from("responsaveis")
            .insert(novos as never);
          if (error) throw error;
        }

        if (opcoes.fotos && baseFull.fotos.length > 0) {
          const novos = baseFull.fotos.map((f) => ({
            id_foto: gerarId("FOTO"),
            id_inspecao: novaId,
            id_empresa: empresaDestinoId,
            id_setor: f.id_setor
              ? mapaSetor.get(f.id_setor) ?? f.id_setor
              : null,
            categoria: f.categoria,
            legenda: f.legenda,
            arquivo_foto: f.arquivo_foto,
            storage_path: f.storage_path,
            data_upload: new Date().toISOString(),
            usuario: user?.email ?? null,
          }));
          const { error } = await supabase
            .from("fotos")
            .insert(novos as never);
          if (error) throw error;
        }
      }

      // Quem vai a campo -> uma linha de `responsaveis` por técnico nomeado.
      //
      // Roda DEPOIS da cópia de propósito: quando a pessoa duplica marcando
      // "Responsáveis", as linhas da inspeção base já entraram, e repetir o
      // mesmo nome criaria duas linhas para a mesma pessoa -- que o dashboard
      // contaria duas vezes. A comparação é por nome normalizado (sem caixa,
      // sem espaço nas pontas) porque o campo é texto livre: "LÉDIMO" e
      // "Lédimo" são a mesma pessoa. Ver lib/dashboard/tecnicos.ts.
      const jaCopiados = new Set(
        (opcoes.responsaveis && !semBase ? baseFull?.responsaveis ?? [] : [])
          .map((r) => (r.tecnico_responsavel ?? "").trim().toLocaleLowerCase("pt-BR"))
          .filter(Boolean)
      );
      const nomesTecnicos: string[] = [];
      // Renovação não tem visita, então não tem quem foi a campo: a caixa nem
      // aparece, e o nome semeado de quem está criando não vira técnico.
      for (const t of tipo === "RENOVACAO" ? [] : tecnicos) {
        const nome = t.trim();
        if (!nome) continue;
        const chave = nome.toLocaleLowerCase("pt-BR");
        if (jaCopiados.has(chave)) continue;
        jaCopiados.add(chave); // cobre também o mesmo nome digitado duas vezes
        nomesTecnicos.push(nome);
      }
      if (nomesTecnicos.length > 0) {
        const agora = new Date().toISOString();
        const novosResp = nomesTecnicos.map((nome) => ({
          id_responsavel: gerarId("RSP"),
          id_inspecao: novaId,
          id_empresa: empresaDestinoId,
          tecnico_responsavel: nome,
          // V204, Fase B1 — grava JUNTO a conta de quem foi a campo, quando o
          // nome digitado é de alguém do cadastro.
          //
          // O nome continua sendo gravado do jeito que foi escrito: é ele que
          // aparece no laudo, e técnico de unidade sem login no painel precisa
          // seguir podendo ser digitado. O `id_usuario` é o extra que tira a
          // contagem do dashboard da dependência do texto.
          //
          // A regra NÃO está reescrita aqui: `contaDoTecnicoDigitado` chama a
          // mesma função da tela e do script. Nome ambíguo devolve null, e null
          // aqui nunca quer dizer "não é técnico" -- quer dizer "não dá para
          // afirmar de qual conta é".
          id_usuario: contaDoTecnicoDigitado(nome, usuariosSugestao ?? []),
          // Recepção e cargo são de quem ATENDE na empresa: só se sabe na
          // visita. Ficam vazios e são preenchidos na aba Responsáveis.
          recepcionado_por: null,
          cargo: null,
          data_hora: agora,
        }));
        const { error: errResp } = await supabase
          .from("responsaveis")
          .insert(novosResp as never);
        // Não derruba a criação: a inspeção já existe e o técnico se corrige na
        // aba Responsáveis. Falhar aqui e abortar deixaria a inspeção órfã.
        if (errResp) {
          toast.error(
            "Inspeção criada, mas o técnico não foi gravado. Preencha na aba Responsáveis."
          );
        }
      }

      return novaId;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["inspecoes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["dashboard-recentes"] });
      toast.success(tipo === "RENOVACAO" ? "Renovação registrada" : "Inspeção criada");
      router.replace(`/inspecoes/${id}`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao criar inspeção");
    },
  });

  const podeAvancar1 = !!empresaDestinoId;
  const podeAvancar2 =
    semBase ||
    (tipo === "REVISAO" && !!inspBaseId) ||
    (tipo === "COPIA_EMPRESA" && !!empresaOrigemId && !!inspBaseId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded p-1 hover:bg-white"
        >
          <ArrowLeft className="size-4" />
        </button>
        <span>Voltar</span>
      </div>

      <Stepper step={step} />

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Empresa destino</h2>
            <p className="text-sm text-gray-600">
              Em qual empresa esta nova inspeção será criada?
            </p>
            <EmpresaSelect
              value={empresaDestinoId}
              onChange={setEmpresaDestinoId}
              modulo="sst"
            />
            <div className="flex justify-end">
              <button
                type="button"
                disabled={!podeAvancar1}
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
              >
                Próximo <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Como criar?</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <TipoCard
                ativo={tipo === "BRANCO"}
                onClick={() => {
                  setTipo("BRANCO");
                  setInspBaseId(null);
                  setEmpresaOrigemId(null);
                }}
                icon={<Sparkles className="size-5 text-verde-primary" />}
                titulo="Em Branco"
                desc="Começar do zero, sem dados prévios."
              />
              <TipoCard
                ativo={tipo === "REVISAO"}
                onClick={() => {
                  setTipo("REVISAO");
                  setInspBaseId(null);
                  setEmpresaOrigemId(null);
                }}
                icon={<Copy className="size-5 text-verde-primary" />}
                titulo="Nova Revisão"
                desc="Copia dados de uma inspeção anterior desta mesma empresa."
              />
              <TipoCard
                ativo={tipo === "COPIA_EMPRESA"}
                onClick={() => {
                  setTipo("COPIA_EMPRESA");
                  setInspBaseId(null);
                }}
                icon={<Building2 className="size-5 text-verde-primary" />}
                titulo="Cópia de Outra Empresa"
                desc="Importa dados de uma inspeção de outra empresa."
              />
              <TipoCard
                ativo={tipo === "RENOVACAO"}
                onClick={() => {
                  setTipo("RENOVACAO");
                  setInspBaseId(null);
                  setEmpresaOrigemId(null);
                }}
                icon={<RefreshCw className="size-5 text-verde-primary" />}
                titulo="Renovação de documento"
                desc="Não é visita a campo: registra a empresa ou a renovação dos documentos dela, sem contar nos gráficos de inspeção."
              />
            </div>

            {tipo === "REVISAO" && (
              <SelectInspecaoBase
                inspecoes={inspecoesParaBase}
                value={inspBaseId}
                onChange={setInspBaseId}
                proximaRevisao={proximaRevisao}
              />
            )}

            {tipo === "COPIA_EMPRESA" && (
              <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Empresa de origem
                  </label>
                  <EmpresaSelect
                    value={empresaOrigemId}
                    onChange={(id) => {
                      setEmpresaOrigemId(id);
                      setInspBaseId(null);
                    }}
                    placeholder="Buscar empresa de origem..."
                    modulo="sst"
                  />
                </div>
                {empresaOrigemId && (
                  <SelectInspecaoBase
                    inspecoes={inspecoesParaBase}
                    value={inspBaseId}
                    onChange={setInspBaseId}
                    proximaRevisao={proximaRevisao}
                  />
                )}
              </div>
            )}

            {!semBase && inspBaseId && (
              <OpcoesCopiaPanel opcoes={opcoes} setOpcoes={setOpcoes} />
            )}

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={!podeAvancar2}
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
              >
                Próximo <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">
              {tipo === "RENOVACAO" ? "Dados da renovação" : "Dados da inspeção"}
            </h2>
            <div className="rounded-md border border-verde-primary/30 bg-verde-light/50 px-3 py-2 text-sm text-gray-700">
              {tipo === "RENOVACAO" ? "Esta renovação" : "Esta inspeção"} será gravada como{" "}
              <strong>Rev. {proximaRevisao}</strong> nesta empresa.
              {tipo === "RENOVACAO" && (
                <> Não conta como inspeção nos gráficos nem na produtividade.</>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">
                {tipo === "RENOVACAO" ? "Data do documento" : "Data da inspeção"}
              </label>
              <input
                type="date"
                value={dataInsp}
                onChange={(e) => setDataInsp(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>
            {tipo !== "RENOVACAO" && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                Quem vai a campo?
              </label>
              <div className="mt-1 space-y-2">
                {tecnicos.map((t, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={t}
                      list="tecnicos-campo-sugestoes"
                      placeholder={
                        i === 0 ? "Técnico responsável" : "Segundo técnico"
                      }
                      onChange={(e) =>
                        setTecnicos((old) =>
                          old.map((v, j) => (j === i ? e.target.value : v))
                        )
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
                    />
                    {tecnicos.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setTecnicos((old) => old.filter((_, j) => j !== i))
                        }
                        aria-label="Remover este técnico"
                        className="shrink-0 rounded-md border border-gray-300 bg-white px-2 text-gray-500 hover:bg-red-50 hover:text-red-alert"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
                <datalist id="tecnicos-campo-sugestoes">
                  {sugestoesTecnico.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                <button
                  type="button"
                  onClick={() => setTecnicos((old) => [...old, ""])}
                  className="inline-flex items-center gap-1 text-sm font-medium text-verde-primary hover:text-verde-accent"
                >
                  <Plus className="size-4" /> adicionar outro técnico
                </button>
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                Sai no relatório e conta no dashboard. Dá para corrigir depois
                na aba <strong>Responsáveis</strong>.
              </p>
            </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700">
                Observações iniciais
              </label>
              <textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={4}
                placeholder="Notas iniciais (opcional)"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={create.isPending}
                onClick={() => create.mutate()}
                className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
              >
                {create.isPending && <Loader2 className="size-4 animate-spin" />}
                {tipo === "RENOVACAO" ? "Registrar Renovação →" : "Criar Inspeção →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================
// SUBCOMPONENTES
// =============================================================

function Stepper({ step }: { step: Step }) {
  const steps = [
    { n: 1, label: "Empresa" },
    { n: 2, label: "Tipo" },
    { n: 3, label: "Dados" },
  ];
  return (
    <ol className="flex items-center gap-2">
      {steps.map((s, idx) => (
        <li key={s.n} className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-full border-2 text-xs font-bold",
              s.n === step
                ? "border-verde-primary bg-verde-primary text-white"
                : s.n < step
                ? "border-verde-primary bg-verde-light text-verde-primary"
                : "border-gray-300 bg-white text-gray-400"
            )}
          >
            {s.n}
          </span>
          <span
            className={cn(
              "text-sm font-medium",
              s.n <= step ? "text-gray-900" : "text-gray-400"
            )}
          >
            {s.label}
          </span>
          {idx < steps.length - 1 && (
            <span className="mx-1 h-px w-8 bg-gray-300" />
          )}
        </li>
      ))}
    </ol>
  );
}

function TipoCard({
  ativo,
  onClick,
  icon,
  titulo,
  desc,
}: {
  ativo: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  titulo: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border-2 p-4 text-left transition-colors",
        ativo
          ? "border-verde-primary bg-verde-light"
          : "border-gray-200 bg-white hover:border-gray-300"
      )}
    >
      {icon}
      <p className="mt-2 font-semibold text-gray-900">{titulo}</p>
      <p className="text-xs text-gray-600">{desc}</p>
    </button>
  );
}

function SelectInspecaoBase({
  inspecoes,
  value,
  onChange,
  proximaRevisao,
}: {
  inspecoes: Inspecao[];
  value: string | null;
  onChange: (id: string | null) => void;
  proximaRevisao?: number;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">
        Inspeção base
      </label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
      >
        <option value="">Selecione...</option>
        {inspecoes
          .filter((i) => i.status !== "DELETADA")
          .map((i) => (
            <option key={i.id_inspecao} value={i.id_inspecao}>
              Rev. {i.revisao} — {i.id_inspecao} ({i.status})
            </option>
          ))}
      </select>
      {proximaRevisao && (
        <p className="text-xs text-gray-500">
          Próxima revisão: <strong>Rev. {proximaRevisao}</strong>
        </p>
      )}
    </div>
  );
}

function OpcoesCopiaPanel({
  opcoes,
  setOpcoes,
}: {
  opcoes: OpcoesCopia;
  setOpcoes: (o: OpcoesCopia) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-gray-700">
        O que copiar da inspeção base
      </p>
      <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 bg-white p-3">
        {(
          [
            ["setores", "Setores"],
            ["cargos", "Cargos (precisa setores)"],
            ["riscos", "Riscos"],
            ["epis", "EPIs/EPCs (precisa riscos)"],
            ["responsaveis", "Responsáveis"],
            ["fotos", "Fotos"],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50"
          >
            <input
              type="checkbox"
              checked={opcoes[key]}
              onChange={(e) =>
                setOpcoes({ ...opcoes, [key]: e.target.checked })
              }
              className="rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30"
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

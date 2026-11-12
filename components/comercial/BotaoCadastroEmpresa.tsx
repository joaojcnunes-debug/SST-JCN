"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardPlus, Loader2 } from "lucide-react";
import FormularioPublico from "@/components/gestao/FormularioPublico";
import Modal from "@/components/ui/Modal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * "Cadastrar empresa" (Painel 0.3.926 e 0.3.934; JCN 0.3.276): abre o formulário de cadastro de empresa numa janela
 * por cima da tela. Ao enviar, as listas da Gestão recarregam para o cartão novo aparecer.
 *
 * Diferença do Painel: lá o token do formulário (o da Chabra, vindo do Runrun) é fixo no código. No JCN o botão procura
 * o formulário ATIVO com este título, em qualquer lista que a pessoa veja. Sem ele, a janela explica como criar.
 *   cheio = topo de Comercial › Oportunidades
 *   barra = barra de ferramentas da lista Comercial na Gestão (ao lado de "Nova tarefa")
 */
export const TITULO_FORM_CADASTRO_EMPRESA = "Cadastro de empresa - Comercial";

/** Lista "Comercial" da Gestão do JCN (a do campo Produtos, v342). */
export const ID_QUADRO_COMERCIAL = "QDR-70A13B38";

function useFormCadastroEmpresa(ativo: boolean) {
  return useQuery({
    queryKey: ["gestao-form-cadastro-empresa"],
    enabled: ativo,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gestao_formularios")
        .select("token")
        .eq("ativo", true)
        .ilike("titulo", TITULO_FORM_CADASTRO_EMPRESA)
        .order("created_at", { ascending: true })
        .limit(1);
      if (error) throw error;
      return ((data ?? []) as unknown as { token: string | null }[])[0]?.token ?? null;
    },
  });
}

export default function BotaoCadastroEmpresa({ variante = "cheio" }: { variante?: "cheio" | "barra" }) {
  const [aberto, setAberto] = useState(false);
  const qc = useQueryClient();
  const { data: token, isLoading } = useFormCadastroEmpresa(aberto);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        title={`Abre o formulário ${TITULO_FORM_CADASTRO_EMPRESA}`}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold shadow-sm transition",
          variante === "cheio" && "bg-marca-primary text-white hover:brightness-110",
          variante === "barra" && "border border-gray-200 bg-white text-marca-primary hover:bg-gray-50",
        )}
      >
        <ClipboardPlus className="size-4 shrink-0" /> Cadastrar empresa
      </button>
      <Modal
        open={aberto}
        onClose={() => setAberto(false)}
        title={TITULO_FORM_CADASTRO_EMPRESA}
        size="lg"
        corpoClassName="flex-1 overflow-y-auto rounded-b-2xl"
      >
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-10 text-sm text-gray-500">
            <Loader2 className="size-4 animate-spin" /> Procurando o formulário…
          </div>
        ) : token ? (
          <FormularioPublico
            token={token}
            embutido
            onEnviado={() => {
              void qc.invalidateQueries({ queryKey: ["gestao-tarefas"] });
              void qc.invalidateQueries({ queryKey: ["gestao-minhas"] });
            }}
          />
        ) : (
          <div className="space-y-2 px-6 py-6 text-sm text-gray-600">
            <p>
              Ainda não há um formulário ativo chamado <strong>{TITULO_FORM_CADASTRO_EMPRESA}</strong> que você possa ver.
            </p>
            <p>
              Para usar este botão, crie o formulário em <strong>Gestão › Comercial › Configurar › Formulários</strong>, com
              esse nome, e deixe-o ativo. As respostas viram cartões na lista escolhida no formulário.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}

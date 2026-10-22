// O que as duas rotas de PDF "por empresa" do Painel SST têm em comum
// (/api/pdf/riscos-psicossociais/[idEmpresa] e /api/pdf/aep-psicossocial/[idEmpresa]):
// quem pode pedir, o cadastro da empresa e a montagem do arquivo.
//
// Os dados são RELIDOS no servidor com o client de quem pede (RLS), pelas
// mesmas funções da tela — nada chega pronto do navegador.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import { formatCNPJ } from "@/lib/utils";
import type { EmpresaPdf } from "@/components/pdf/templates/PsicossocialEmpresaTemplate";

type Supabase = ReturnType<typeof createSupabaseServerClient>;

/** Client do servidor com o usuário logado — ou a resposta de recusa.
 *  Cliente não vê estas telas (cruzam empresas atendidas); a rota segue o menu. */
export async function abrirSessao(): Promise<{ supabase: Supabase } | { recusa: NextResponse }> {
  const supabase = createSupabaseServerClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { recusa: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  const { data: usuario } = await supabase.from("usuarios").select("perfil").eq("email", user.email).maybeSingle();
  if ((usuario as { perfil?: string } | null)?.perfil === "Cliente") {
    return { recusa: NextResponse.json({ error: "Sem acesso" }, { status: 403 }) };
  }
  return { supabase };
}

/** Cadastro da empresa como a tela mostra; null se não existe (ou a RLS não deixa ver). */
export async function lerEmpresa(
  supabase: Supabase,
  idEmpresa: string,
  comUnidade = false
): Promise<EmpresaPdf | null> {
  const { data, error } = await supabase
    .from("empresas")
    .select(
      "nome_empresa, razao_social, nome_fantasia, cnpj, cnae_principal, cnae_descricao, grau_risco, logradouro, numero, complemento, bairro, municipio, uf, cep, telefone, email, id_unidade"
    )
    .eq("id_empresa", idEmpresa)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const c = data as Record<string, string | number | null>;
  const s = (k: string) => (c[k] == null ? null : String(c[k]));

  let unidade: string | null | undefined;
  if (comUnidade) {
    unidade = null;
    if (c.id_unidade) {
      const { data: u } = await supabase.from("unidades").select("nome").eq("id_unidade", String(c.id_unidade)).maybeSingle();
      unidade = (u as { nome?: string } | null)?.nome ?? null;
    }
  }

  return {
    nome: s("nome_empresa") ?? "Empresa",
    razaoSocial: s("razao_social"),
    nomeFantasia: s("nome_fantasia"),
    cnpj: c.cnpj ? formatCNPJ(String(c.cnpj)) : null,
    cnae: [s("cnae_principal"), s("cnae_descricao")].filter(Boolean).join(" — ") || null,
    grauRisco: s("grau_risco"),
    telefone: s("telefone"),
    email: s("email"),
    endereco:
      [
        [s("logradouro"), s("numero")].filter(Boolean).join(", "),
        s("complemento"),
        s("bairro"),
        c.municipio && c.uf ? `${c.municipio}/${c.uf}` : s("municipio"),
        c.cep ? `CEP ${c.cep}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
    ...(comUnidade ? { unidade, regiao: [s("municipio"), s("uf")].filter(Boolean).join("/") || null } : {}),
  };
}

export function agoraBrasilia(): string {
  return new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Nome de arquivo sem acento nem símbolo: "Padaria São João" → "padaria-sao-joao". */
function slug(texto: string): string {
  return (
    texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "empresa"
  );
}

/** HTML do template → PDF A4 retrato, com "página X / Y" no rodapé. */
export async function responderPdf(bodyHtml: string, titulo: string, prefixoArquivo: string, nomeEmpresa: string) {
  const styleMatch = bodyHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  const headStyle = styleMatch ? styleMatch[1] : "";
  const semStyle = bodyHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/, "");
  const tituloHtml = titulo.replace(/[<>&]/g, "");
  const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" /><title>${tituloHtml}</title>
<style>${headStyle}</style></head>
<body style="margin:0;padding:0;background:#fff;font-family:Calibri,Arial,Helvetica,sans-serif;color:#111827;">
${semStyle}
</body></html>`;

  const { gerarPdf } = await import("@/lib/pdf/gerar-pdf");
  const pdf = await gerarPdf(fullHtml, {
    margens: { top: "12mm", bottom: "14mm", left: "10mm", right: "10mm" },
    numeroPaginas: true,
  });

  const nomeArquivo = `${prefixoArquivo}-${slug(nomeEmpresa)}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nomeArquivo}"`,
    },
  });
}

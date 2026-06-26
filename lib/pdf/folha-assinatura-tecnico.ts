import type { Signatario } from "@/components/pdf/FolhaAssinaturas";
import { assinarUmaMidiaPdf } from "@/lib/pdf/assinar-midia";

/**
 * Monta o signatário "técnico responsável" da Folha de Assinaturas de um laudo.
 *
 * Regras:
 *  - O técnico é o RESPONSÁVEL cadastrado NO DOCUMENTO (nunca o usuário logado).
 *  - Se o documento já foi assinado digitalmente (registro em `pdfs_assinados`),
 *    renderiza o selo "ASSINADO DIGITALMENTE A1" com o ASSINANTE REAL.
 *  - Caso contrário, renderiza uma linha de assinatura MANUAL para o responsável
 *    (campo em branco para assinatura física) — `assinadoDigitalmente: false`.
 *
 * Mantém o PDF coerente com o preview na tela (que só mostra o selo quando há
 * assinatura de fato).
 */

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

function fmtDataHora(iso?: string): string {
  const dt = iso ? new Date(iso) : new Date();
  return (
    dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) +
    " " +
    dt.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" }) +
    " -03:00"
  );
}

export interface MontarSignatarioOpts {
  /** Nome da tabela usada em `pdfs_assinados` (ex: "relatorios_nao_conformidade"). */
  tabela: string;
  /** ID do documento. */
  docId: string;
  /** Nome do responsável técnico cadastrado no documento. */
  responsavelNome: string | null | undefined;
  /** Função exibida no documento. Default "Responsável Técnico — JCN Consultoria SST". */
  funcaoNoDocumento?: string;
  /** Cargo explícito do documento (ex: AEP `titulo_profissional`). Tem prioridade. */
  cargo?: string | null;
  /** Registro profissional já formatado (ex: "Reg. 12345"). */
  registroProfissional?: string | null;
  /**
   * Força o selo "ASSINADO DIGITALMENTE" mesmo sem registro em `pdfs_assinados`
   * ainda — usado ao GERAR o PDF que será assinado (a assinatura cria o registro
   * depois). Renderiza o selo com os dados do responsável do documento. Sem isto,
   * o PDF assinado sairia mostrando a linha de assinatura MANUAL (em branco).
   */
  forcarAssinado?: boolean;
}

export async function montarSignatarioTecnico(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  opts: MontarSignatarioOpts,
): Promise<{ signatario: Signatario; dataHoraAssinatura: string }> {
  const funcao = opts.funcaoNoDocumento ?? "Responsável Técnico — JCN Consultoria SST";
  const responsavelNome = (opts.responsavelNome ?? "").trim();

  const { data: rawAssinado } = await supabase
    .from("pdfs_assinados")
    .select("assinado_em, assinado_por, tipo_assinatura")
    .eq("tabela", opts.tabela)
    .eq("doc_id", opts.docId)
    .maybeSingle();
  const assinado = rawAssinado as
    | { assinado_em: string; assinado_por: string; tipo_assinatura: string | null }
    | null;

  if (assinado) {
    // Documento assinado → busca o assinante real.
    const { data: rawSigner } = await supabase
      .from("usuarios")
      .select("nome, cargo, cpf, assinatura_url, registro_mte, crp")
      .eq("email", assinado.assinado_por)
      .single();
    const signer = rawSigner as
      | {
          nome: string | null;
          cargo: string | null;
          cpf: string | null;
          assinatura_url: string | null;
          registro_mte: string | null;
          crp: string | null;
        }
      | null;
    const porImagem = assinado.tipo_assinatura === "imagem";
    // Assinatura é imagem do bucket fotos → assina p/ o Puppeteer (fallback p/ original).
    const assinaturaImagemUrl =
      porImagem && signer?.assinatura_url
        ? await assinarUmaMidiaPdf(supabase, signer.assinatura_url, "fotos")
        : undefined;
    // Registro profissional do assinante (Reg. MTE para técnicos, CRP para
    // psicólogos). Usado principalmente na assinatura por imagem.
    const registroSigner = signer?.registro_mte
      ? `Reg. MTE ${signer.registro_mte}`
      : signer?.crp
        ? `CRP ${signer.crp}`
        : null;
    return {
      signatario: {
        nomeCompleto: signer?.nome ?? assinado.assinado_por,
        cargo: opts.cargo ?? signer?.cargo ?? null,
        registroProfissional: opts.registroProfissional ?? registroSigner,
        cpf: signer?.cpf ?? null,
        funcaoNoDocumento: funcao,
        assinadoDigitalmente: true,
        // Assinatura por imagem → carimba a imagem (assinada); senão, selo A1.
        assinaturaImagemUrl,
      },
      dataHoraAssinatura: fmtDataHora(assinado.assinado_em),
    };
  }

  // Ao GERAR o PDF que será assinado: ainda não há registro em pdfs_assinados,
  // mas já sabemos quem assina (o responsável do documento). Renderiza o selo
  // digital com os dados do responsável + carimbo de agora, para o PDF assinado
  // sair com o selo (e não com a linha manual em branco).
  if (opts.forcarAssinado) {
    return {
      signatario: {
        nomeCompleto: responsavelNome,
        cargo: opts.cargo ?? null,
        registroProfissional: opts.registroProfissional ?? null,
        cpf: null,
        funcaoNoDocumento: funcao,
        assinadoDigitalmente: true,
      },
      dataHoraAssinatura: fmtDataHora(),
    };
  }

  // Não assinado → linha manual com o responsável do documento.
  let cargo: string | null = opts.cargo ?? null;
  if (!cargo && responsavelNome) {
    const primeiro = responsavelNome.split(/\s+/)[0] ?? "";
    const { data: rawCand } = await supabase
      .from("usuarios")
      .select("nome, cargo")
      .ilike("nome", `%${primeiro}%`)
      .limit(20);
    const cands = (rawCand ?? []) as { nome: string; cargo: string | null }[];
    const match =
      cands.find((u) => norm(u.nome) === norm(responsavelNome)) ??
      cands.find(
        (u) =>
          norm(u.nome).includes(norm(responsavelNome)) ||
          norm(responsavelNome).includes(norm(u.nome)),
      );
    cargo = match?.cargo ?? null;
  }

  return {
    signatario: {
      nomeCompleto: responsavelNome,
      cargo,
      registroProfissional: opts.registroProfissional ?? null,
      cpf: null,
      funcaoNoDocumento: funcao,
      assinadoDigitalmente: false,
    },
    dataHoraAssinatura: fmtDataHora(),
  };
}

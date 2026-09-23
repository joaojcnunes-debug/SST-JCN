"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useUserStore } from "@/lib/store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ModuloPermitido } from "@/lib/supabase/types";
import { ROTULO_MODULO } from "@/lib/supabase/types";

/**
 * Garante que o usuário logado tem permissão de acessar o módulo informado.
 * Aceita um módulo único ou um array — neste caso, basta ter qualquer um deles.
 * Todos os perfis (inclusive Admin) precisam ter o módulo em
 * `modulos_permitidos`. Se não tiver, redireciona pro hub de módulos /modulos.
 *
 * Funções administrativas (gestão de usuários, configurações) vivem em
 * route groups separados e checam apenas `isAdmin`, sem amarrar a módulo.
 */
/**
 * Log de LEITURA (v232): quem abriu qual módulo, em que dia. Uma chamada por
 * módulo por dia em cada navegador (sessionStorage), depois que a checagem
 * passou. Fire-and-forget: erro é silêncio — o log nunca atrapalha a tela.
 */
function registrarAbertura(modulo: ModuloPermitido) {
  const chave = `modulo_abriu:${modulo}:${new Date().toISOString().slice(0, 10)}`;
  try {
    if (sessionStorage.getItem(chave)) return;
    sessionStorage.setItem(chave, "1");
  } catch {
    /* sem sessionStorage: registra assim mesmo */
  }
  void createSupabaseBrowserClient()
    .rpc("modulo_abrir" as never, { p_modulo: modulo } as never)
    .then(() => undefined, () => undefined);
}

export function useRequireModule(modulo: ModuloPermitido | ModuloPermitido[]) {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const avisouRef = useRef(false);

  // 🪤 `modulo` entrava DIRETO na lista de dependências do efeito. Com texto
  // (`"aep"`) isso é estável, mas uma chamada com ARRAY LITERAL
  // (`["aep","psicossocial"]`) cria identidade nova a cada render e fazia o
  // efeito re-disparar sempre. Medido em 04/09, 10 renders forçados:
  //   texto → 1 disparo · array literal → 11 disparos
  // Pior que o desperdício: para quem NÃO tem a permissão, cada disparo chama
  // `router.replace("/modulos")` de novo.
  // A chave depende do CONTEÚDO, não da identidade, então o defeito morre no
  // hook e nenhuma das 18 chamadas precisou mudar. Nome de módulo não contém
  // "|", então juntar e separar é seguro.
  const chave = Array.isArray(modulo) ? modulo.join("|") : modulo;
  const modulos = useMemo(() => chave.split("|") as ModuloPermitido[], [chave]);

  useEffect(() => {
    if (!user) return; // ainda carregando — useAuth cuida do "sem sessão"
    const permitidos = user.modulos_permitidos ?? [];
    const aberto = modulos.find((m) => permitidos.includes(m));
    if (aberto) {
      registrarAbertura(aberto);
      return;
    }

    if (!avisouRef.current) {
      avisouRef.current = true;
      const rotulo = modulos.map((m) => ROTULO_MODULO[m]).join(" ou ");
      toast.error(`Sem permissão para acessar ${rotulo}`);
    }
    router.replace("/modulos");
  }, [user, modulos, router]);
}

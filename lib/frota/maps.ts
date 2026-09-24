/**
 * Link de navegação do Google Maps para o destino da saída.
 *
 * DECISÃO: a URL NÃO é gravada no banco — é montada na hora. Assim, corrigir um
 * endereço digitado errado corrige o link automaticamente, sem migration e sem
 * uma segunda verdade sobre o mesmo destino.
 *
 * `dir/?api=1&destination=` abre JÁ EM MODO ROTA, não só o alfinete. No celular
 * o navegador entrega ao aplicativo do Google Maps instalado; no desktop abre no
 * navegador. É a diferença entre o condutor ver onde é e o condutor sair
 * dirigindo.
 */

/** O mínimo que `linkMaps` precisa — aceita FrotaChecklist e o rascunho do form. */
export type DestinoNavegavel = {
  endereco_logradouro?: string | null;
  endereco_numero?: string | null;
  endereco_bairro?: string | null;
  endereco_cidade?: string | null;
  endereco_uf?: string | null;
  endereco_cep?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  maps_url?: string | null;
};

/** O endereço em uma linha, para exibir na tela e para alimentar o link. */
export function enderecoEmLinha(d: DestinoNavegavel): string {
  const rua = [d.endereco_logradouro, d.endereco_numero].filter(Boolean).join(", ");
  const cidadeUf = [d.endereco_cidade, d.endereco_uf].filter(Boolean).join("/");
  return [rua, d.endereco_bairro, cidadeUf, d.endereco_cep].filter(Boolean).join(" — ");
}

/**
 * Três precedências, nesta ordem:
 *   1. maps_url colado à mão — pin compartilhado ou plus code. Vence sempre,
 *      porque quem colou tinha o lugar exato na mão.
 *   2. latitude/longitude — coordenada é mais confiável que texto de endereço.
 *   3. endereço montado — o caso comum.
 *
 * Devolve null quando não há destino nenhum: botão de navegação sem destino é
 * botão que decepciona.
 */
export function linkMaps(d: DestinoNavegavel): string | null {
  if (d.maps_url && d.maps_url.trim()) return d.maps_url.trim();

  const destino =
    d.latitude != null && d.longitude != null
      ? `${d.latitude},${d.longitude}`
      : [
          d.endereco_logradouro,
          d.endereco_numero,
          d.endereco_bairro,
          d.endereco_cidade,
          d.endereco_uf,
          d.endereco_cep,
        ]
          .filter(Boolean)
          .join(", ");

  if (!destino.trim()) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`;
}

/** Tem destino suficiente para navegar? */
export function temDestino(d: DestinoNavegavel): boolean {
  return linkMaps(d) !== null;
}

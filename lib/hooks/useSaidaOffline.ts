"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gerarId } from "@/lib/utils";
import {
  caminhoChecklistAngulo,
  caminhoChecklistExtra,
  prepararImagem,
} from "@/lib/frota/fotos";
import { SLUG_ANGULO } from "@/lib/frota/angulos";
import {
  lerSaida,
  pedirArmazenamentoPersistente,
  salvarSaida,
  type RotaOffline,
  type SaidaOffline,
} from "@/lib/offline/db";
import { sincronizarSeOnline } from "@/lib/offline/fila";
import type { AnguloFoto, FrotaVeiculo } from "@/lib/frota/tipos";

/**
 * A saída sendo capturada SEM REDE — o espelho local do que os hooks online
 * fazem contra o banco.
 *
 * A forma da foto imita `FrotaChecklistFoto` de propósito: assim o assistente
 * renderiza os dois modos com o mesmo JSX, trocando só a origem da imagem
 * (`previewUrl` em vez do caminho no MinIO).
 */
export type FotoLocal = {
  id_foto: string;
  angulo: AnguloFoto;
  thumb_path: string;
  /** URL de objeto do Blob guardado. Só existe em memória, e é revogada ao sair. */
  previewUrl: string;
};

export function useSaidaOffline(veiculo: FrotaVeiculo) {
  const [saida, setSaida] = useState<SaidaOffline | null>(null);
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const urlsRef = useRef<string[]>([]);

  // Toda URL de objeto criada aqui vaza memória se não for revogada — e o
  // assistente cria oito por saída (thumb de cada ângulo, mais extras).
  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      for (const u of urls) URL.revokeObjectURL(u);
    };
  }, []);

  const registrarUrl = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    urlsRef.current.push(url);
    return url;
  }, []);

  const refletir = useCallback(
    (registro: SaidaOffline) => {
      setSaida(registro);
      setFotos(
        registro.fotos.map((f) => ({
          id_foto: f.id_foto,
          angulo: f.angulo,
          thumb_path: f.thumb_path,
          previewUrl: registrarUrl(f.thumb),
        }))
      );
    },
    [registrarUrl]
  );

  /**
   * Abre a saída local. O id sai do `gerarId("CHK")` — o MESMO gerador que o
   * caminho online já usava antes deste trabalho. É isso que torna o reenvio
   * seguro: o id nasce no celular, então uma resposta perdida no caminho faz o
   * reenvio bater na chave primária em vez de criar uma saída duplicada.
   */
  const iniciar = useCallback(
    async (dados: { condutor_nome: string; km_saida: number; criado_por: string | null }) => {
      const agora = new Date().toISOString();
      const registro: SaidaOffline = {
        id_checklist: gerarId("CHK"),
        id_veiculo: veiculo.id_veiculo,
        id_unidade: veiculo.id_unidade,
        placa: veiculo.placa,
        modelo: veiculo.modelo,
        criado_em: agora,
        finalizado_em: agora,
        status: "RASCUNHO",
        etapa: "CHECKLIST",
        tentativas: 0,
        ultimo_erro: null,
        ultima_tentativa: null,
        checklist: {
          condutor_nome: dados.condutor_nome,
          km_saida: dados.km_saida,
          avarias_constatadas: null,
          observacoes: null,
          endereco_cep: null,
          endereco_logradouro: "",
          endereco_numero: null,
          endereco_complemento: null,
          endereco_bairro: null,
          endereco_cidade: "",
          endereco_uf: "",
          endereco_ponto_referencia: null,
          maps_url: null,
          criado_por: dados.criado_por,
        },
        fotos: [],
        rotas: [],
      };

      // Pede persistência na primeira saída offline, não no carregamento do app:
      // é aqui que existe dado a perder, e o browser trata melhor um pedido que
      // vem junto de uma ação do usuário.
      void pedirArmazenamentoPersistente();

      await salvarSaida(registro);
      refletir(registro);
      return registro;
    },
    [veiculo, refletir]
  );

  /** Retomar um rascunho — só por ordem explícita, nunca sozinho. */
  const retomar = useCallback(
    async (idChecklist: string) => {
      const registro = await lerSaida(idChecklist);
      if (registro) refletir(registro);
      return registro;
    },
    [refletir]
  );

  /**
   * Reabre para CORRIGIR uma saída que o técnico já finalizou no aparelho e que
   * ainda não chegou ao painel — o caso de digitar o km errado e lembrar depois.
   *
   * VOLTAR PARA `RASCUNHO` É A TRAVA, não um detalhe de exibição: a fila ignora
   * esse status. Sem isso a rede poderia voltar no meio da edição e subir a
   * versão velha enquanto o técnico ainda digita — e ele terminaria de corrigir
   * uma saída que já tinha ido embora errada.
   *
   * Recusa `ENVIADO` e `ENVIANDO`. O primeiro já é registro do painel e não se
   * edita por aqui; o segundo está com as fotos subindo neste instante, e mexer
   * no registro no meio do envio deixaria a fila retomando de um estado que não
   * existe mais. A tela também esconde o botão nesses dois casos — esta é a
   * segunda camada, para o caso de o toque acontecer no instante da virada.
   */
  const abrirCorrecao = useCallback(
    async (idChecklist: string) => {
      const registro = await lerSaida(idChecklist);
      if (!registro) return null;
      if (registro.status === "ENVIADO" || registro.status === "ENVIANDO") return null;

      const emCorrecao: SaidaOffline = { ...registro, status: "RASCUNHO", ultimo_erro: null };
      await salvarSaida(emCorrecao);
      refletir(emCorrecao);
      return emCorrecao;
    },
    [refletir]
  );

  /** Grava o passo atual. Fechar o app no meio da captura não pode perder foto. */
  const salvarPasso = useCallback(
    async (patch: Partial<SaidaOffline["checklist"]>) => {
      if (!saida) return;
      const novo: SaidaOffline = { ...saida, checklist: { ...saida.checklist, ...patch } };
      await salvarSaida(novo);
      setSaida(novo);
    },
    [saida]
  );

  /**
   * A foto é reduzida AQUI, no aparelho, pela mesma `prepararImagem` do caminho
   * online: 315 kB em vez de 2,25 MB. Offline isso importa duas vezes — encolhe
   * o que ocupa o celular e o que vai ter de subir depois no 4G do pátio.
   */
  const adicionarFoto = useCallback(
    async (angulo: AnguloFoto, arquivo: File) => {
      if (!saida) return;
      setOcupado(true);
      try {
        const preparada = await prepararImagem(arquivo);
        if (!preparada) throw new Error("Não foi possível ler esta imagem. Tente outra foto.");

        const idFoto = gerarId("FOT");
        const caminhos =
          angulo === "EXTRA"
            ? {
                thumb: caminhoChecklistExtra(saida.id_checklist, idFoto, "thumb"),
                vista: caminhoChecklistExtra(saida.id_checklist, idFoto, "vista"),
              }
            : {
                thumb: caminhoChecklistAngulo(saida.id_checklist, SLUG_ANGULO[angulo], "thumb"),
                vista: caminhoChecklistAngulo(saida.id_checklist, SLUG_ANGULO[angulo], "vista"),
              };

        // Refazer um ângulo obrigatório SUBSTITUI, como no banco: o índice único
        // (id_checklist, angulo) recusaria a segunda "frente" na hora do envio.
        const mantidas =
          angulo === "EXTRA" ? saida.fotos : saida.fotos.filter((f) => f.angulo !== angulo);

        const novo: SaidaOffline = {
          ...saida,
          fotos: [
            ...mantidas,
            {
              id_foto: idFoto,
              angulo,
              thumb: preparada.thumb,
              vista: preparada.vista,
              thumb_path: caminhos.thumb,
              vista_path: caminhos.vista,
              enviada_storage: false,
              linha_criada: false,
            },
          ],
        };

        await salvarSaida(novo);
        refletir(novo);
      } finally {
        setOcupado(false);
      }
    },
    [saida, refletir]
  );

  const removerFoto = useCallback(
    async (idFoto: string) => {
      if (!saida) return;

      // Se a linha desta foto JÁ subiu (só acontece numa correção de saída que
      // sincronizou pela metade), tirar do array local não basta: ela ficaria no
      // painel para sempre, visível para todo mundo menos para quem a apagou. A
      // fila precisa saber que tem uma linha a apagar lá.
      const alvo = saida.fotos.find((f) => f.id_foto === idFoto);
      const removidas = alvo?.linha_criada
        ? [...(saida.fotos_removidas ?? []), idFoto]
        : saida.fotos_removidas;

      const novo: SaidaOffline = {
        ...saida,
        fotos: saida.fotos.filter((f) => f.id_foto !== idFoto),
        fotos_removidas: removidas,
      };
      await salvarSaida(novo);
      refletir(novo);
    },
    [saida, refletir]
  );

  /**
   * Fecha a saída e a entrega à fila.
   *
   * `finalizado_em` é carimbado AQUI, com o relógio do aparelho, e não no
   * servidor: a saída aconteceu às 7h no pátio; deixar o banco carimbar a hora
   * em que a rede voltou registraria 15h e o relatório sairia mentindo.
   */
  const finalizar = useCallback(
    async (dados: {
      checklist: Partial<SaidaOffline["checklist"]>;
      rotas: RotaOffline[];
    }) => {
      if (!saida) return null;
      setOcupado(true);
      try {
        const novo: SaidaOffline = {
          ...saida,
          checklist: { ...saida.checklist, ...dados.checklist },
          rotas: dados.rotas,
          finalizado_em: new Date().toISOString(),
          status: "PENDENTE",
          /**
           * Volta ao começo da fila. Não re-sobe nada do que já foi: os
           * marcadores por foto seguem gravados, e o passo 1 regrava os campos
           * do checklist em vez de inserir de novo. É essa volta que faz a
           * correção alcançar o painel.
           */
          etapa: "CHECKLIST",
          /**
           * Zera o placar. Uma saída recusada chega aqui com 5 tentativas
           * gastas; sem zerar, a versão CORRIGIDA teria direito a nenhuma —
           * falharia uma vez por qualquer motivo e voltaria a "recusada", como
           * se a correção não tivesse acontecido.
           */
          tentativas: 0,
          ultimo_erro: null,
        };
        await salvarSaida(novo);
        setSaida(novo);
        // Se por acaso a rede já voltou, sobe na hora. Se não, fica na fila —
        // e o evento `online` cuida do resto sem o técnico precisar lembrar.
        void sincronizarSeOnline();
        return novo;
      } finally {
        setOcupado(false);
      }
    },
    [saida]
  );

  return {
    saida,
    idChecklist: saida?.id_checklist ?? null,
    fotos,
    ocupado,
    iniciar,
    retomar,
    abrirCorrecao,
    salvarPasso,
    adicionarFoto,
    removerFoto,
    finalizar,
  };
}

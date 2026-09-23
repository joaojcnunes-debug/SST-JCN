"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CloudOff,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useSaidaOffline } from "@/lib/hooks/useSaidaOffline";
import { ehErroDeRede } from "@/lib/offline/rede";
import StorageImg from "@/components/ui/StorageImg";
import {
  useAbrirSaida,
  useChecklistFotos,
  useEnviarFotoAngulo,
  useFinalizarSaida,
  useRemoverFotoChecklist,
  useSalvarRascunho,
  useSalvarRotas,
} from "@/lib/hooks/useFrotaChecklists";
import {
  ANGULOS_OBRIGATORIOS,
  ROTULO_ANGULO,
  ROTULO_ANGULO_CURTO,
  angulosFaltando,
  podeFinalizar,
} from "@/lib/frota/angulos";
import { erroKmSaida, formatarKm, kmEfetivo } from "@/lib/frota/km";
import { apenasDigitos } from "@/lib/frota/numero";
import { linkMaps } from "@/lib/frota/maps";
import { formatarPlaca } from "@/lib/frota/placa";
import type { AnguloObrigatorio } from "@/lib/frota/angulos";
import type { AnguloFoto, FrotaChecklist, FrotaVeiculo } from "@/lib/frota/tipos";
import { cn } from "@/lib/utils";

/**
 * Assistente de saída — cinco passos, para o condutor de pé no pátio com o
 * celular numa mão e a chave na outra.
 *
 * O RASCUNHO GRAVA A CADA PASSO. Fechar o navegador no meio da captura não perde
 * as fotos já enviadas — e é por isso que o passo 1 já abre o registro no banco
 * em vez de acumular tudo em memória até o fim.
 *
 * A ORDEM NÃO É ARBITRÁRIA:
 *   1 veículo    — confirma o carro e mostra as avarias que já existiam
 *   2 condutor   — nome e km. O km vem cedo porque é obrigatório e é o que
 *                  atualiza o registro do veículo; descobrir no fim que ninguém
 *                  olhou o odômetro custa uma volta até o pátio.
 *   3 as 4 fotos — a trava. A volta no carro produz a prova.
 *   4 avarias    — DEPOIS das fotos, de propósito: o condutor acabou de dar a
 *                  volta, é quando lembra do risco na porta.
 *   5 destino    — o único passo que ele pode não saber de cabeça, então fica no
 *                  fim para não travar o registro no começo.
 */

type Props = { veiculo: FrotaVeiculo; checklist?: FrotaChecklist };

const rotulo = "block text-xs font-medium text-gray-600";
const campo =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-base text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const PASSOS = ["Veículo", "Condutor", "Fotos", "Avarias", "Destino"] as const;

type Rota = { origem: string; destino: string; km_percorrido: string; finalidade: string };

export default function ChecklistSaidaWizard({ veiculo, checklist }: Props) {
  const router = useRouter();
  const [passo, setPasso] = useState(checklist ? 2 : 1);
  const [idChecklist, setIdChecklist] = useState<string | null>(
    checklist?.id_checklist ?? null,
  );

  const abrir = useAbrirSaida();
  const salvarRascunho = useSalvarRascunho();
  const enviarFoto = useEnviarFotoAngulo();
  const removerFoto = useRemoverFotoChecklist();
  const salvarRotas = useSalvarRotas();
  const finalizar = useFinalizarSaida();

  /**
   * MODO OFFLINE — o mesmo assistente, gravando no aparelho em vez do banco.
   *
   * Ele liga em dois momentos: quando o celular já se sabe sem rede, e quando a
   * gravação falha por rede no meio da tentativa. O segundo caso é o que
   * acontece de verdade no pátio, onde o sinal existe no papel e não entrega
   * pacote — `navigator.onLine` diz "sim" e o insert morre no timeout.
   *
   * Só CRIAR funciona offline. Editar uma saída que já está no painel continua
   * exigindo rede, de propósito: duas pessoas editando o mesmo registro em
   * aparelhos diferentes é um problema de fusão que este módulo não precisa ter.
   */
  const [modoOffline, setModoOffline] = useState(false);
  const offline = useSaidaOffline(veiculo);

  /**
   * CORRIGINDO uma saída já fechada no aparelho, em vez de capturando uma nova.
   * Muda o texto do aviso e o do botão final: "finalizar" uma coisa que o
   * técnico já finalizou uma vez não descreve o que ele está fazendo.
   */
  const [corrigindo, setCorrigindo] = useState(false);

  // Retomar do aparelho. Lê da URL no cliente (e não com `useSearchParams`)
  // para não exigir uma fronteira de Suspense nesta árvore.
  //
  // Dois portões, e a diferença é de propósito:
  //   ?rascunho= — a captura parada no meio; cai no passo das fotos, que é onde
  //                ela quase sempre parou.
  //   ?corrigir= — a saída inteira, fechada e à espera de rede; cai no passo do
  //                condutor e do km, que é o erro que se lembra depois.
  useEffect(() => {
    if (checklist) return; // editar uma saída que já está no painel é sempre online

    const busca = new URLSearchParams(window.location.search);
    const idRascunho = busca.get("rascunho");
    const idCorrecao = busca.get("corrigir");
    const id = idCorrecao ?? idRascunho;
    if (!id) return;

    const abrir = idCorrecao ? offline.abrirCorrecao(id) : offline.retomar(id);

    void abrir.then((r) => {
      if (!r) {
        // Só chega aqui quem tocou em "Corrigir" no instante em que a saída
        // começou a subir (ou terminou). Dizer isso é melhor que uma tela
        // vazia: o trabalho não se perdeu, só deixou de ser editável.
        if (idCorrecao) {
          toast("Esta saída já está subindo para o painel e não pode mais ser corrigida.", {
            icon: "🔒",
          });
          router.replace("/frota/pendencias");
        }
        return;
      }

      setModoOffline(true);
      setCorrigindo(!!idCorrecao);
      setIdChecklist(r.id_checklist);

      /**
       * TODOS os campos, não só condutor e km. O registro sendo corrigido está
       * inteiro — endereço, avarias, rotas — e o "Salvar correção" regrava o
       * conjunto todo. Repor pela metade não pediria os campos de novo: apagaria
       * em silêncio o destino que o técnico já tinha digitado no pátio.
       */
      setCondutor(r.checklist.condutor_nome);
      setKm(String(r.checklist.km_saida));
      setAvarias(r.checklist.avarias_constatadas ?? "");
      setObs(r.checklist.observacoes ?? "");
      setEnd({
        cep: r.checklist.endereco_cep ?? "",
        logradouro: r.checklist.endereco_logradouro ?? "",
        numero: r.checklist.endereco_numero ?? "",
        complemento: r.checklist.endereco_complemento ?? "",
        bairro: r.checklist.endereco_bairro ?? "",
        cidade: r.checklist.endereco_cidade ?? "",
        uf: r.checklist.endereco_uf ?? "",
        referencia: r.checklist.endereco_ponto_referencia ?? "",
        maps_url: r.checklist.maps_url ?? "",
      });
      setRotas(
        r.rotas.map((x) => ({
          origem: x.origem,
          destino: x.destino,
          km_percorrido: x.km_percorrido == null ? "" : String(x.km_percorrido),
          finalidade: x.finalidade ?? "",
        })),
      );

      setPasso(idCorrecao ? 2 : 3);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checklist]);

  const { data: fotos = [] } = useChecklistFotos(modoOffline ? null : idChecklist);

  /**
   * A lista que a tela desenha, venha ela do banco ou do aparelho. As duas têm
   * a mesma forma — o que muda é a origem da imagem: caminho no MinIO quando
   * online, URL de objeto do Blob local quando offline.
   */
  const fotosExibidas = useMemo(
    () =>
      modoOffline
        ? offline.fotos.map((f) => ({
            id_foto: f.id_foto,
            angulo: f.angulo,
            thumb_path: f.thumb_path,
            previewUrl: f.previewUrl as string | undefined,
          }))
        : fotos.map((f) => ({
            id_foto: f.id_foto,
            angulo: f.angulo,
            thumb_path: f.thumb_path,
            previewUrl: undefined as string | undefined,
          })),
    [modoOffline, offline.fotos, fotos],
  );

  const angulosPresentes = useMemo(
    () => fotosExibidas.map((f) => f.angulo),
    [fotosExibidas],
  );
  const faltando = angulosFaltando(angulosPresentes);

  const [condutor, setCondutor] = useState(checklist?.condutor_nome ?? "");
  const [km, setKm] = useState(checklist?.km_saida?.toString() ?? "");
  const [avarias, setAvarias] = useState(checklist?.avarias_constatadas ?? "");
  const [obs, setObs] = useState(checklist?.observacoes ?? "");
  const [end, setEnd] = useState({
    cep: checklist?.endereco_cep ?? "",
    logradouro: checklist?.endereco_logradouro ?? "",
    numero: checklist?.endereco_numero ?? "",
    complemento: checklist?.endereco_complemento ?? "",
    bairro: checklist?.endereco_bairro ?? "",
    cidade: checklist?.endereco_cidade ?? "",
    uf: checklist?.endereco_uf ?? "",
    referencia: checklist?.endereco_ponto_referencia ?? "",
    maps_url: checklist?.maps_url ?? "",
  });
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erroCep, setErroCep] = useState<string | null>(null);
  const [tentou, setTentou] = useState(false);

  const kmNum = km === "" ? null : Number(km);
  const erroKm = erroKmSaida(veiculo, kmNum);
  const erroCondutor = condutor.trim() ? null : "Informe o nome do condutor.";

  /**
   * Passa a gravar no aparelho. `getSession` e não `getUser`: o primeiro lê a
   * sessão do armazenamento local, o segundo vai à rede — e ir à rede é
   * exatamente o que não dá para fazer aqui.
   */
  async function abrirNoAparelho() {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    const registro = await offline.iniciar({
      condutor_nome: condutor.trim(),
      km_saida: Number(km),
      criado_por: data.session?.user?.email ?? null,
    });
    setModoOffline(true);
    setIdChecklist(registro.id_checklist);
    // Apaga o aviso de erro que o hook online acabou de mostrar: dizer "não foi
    // possível abrir a saída" e em seguida abrir a saída é pior que não avisar.
    toast.dismiss();
    toast("Sem rede. A saída está sendo guardada no aparelho.", { icon: "📴" });
  }

  // Passo 1 → abre o rascunho. No banco quando há rede; no aparelho quando não.
  // Daí em diante existe id, e as fotos têm onde se pendurar.
  async function irParaPasso2() {
    setTentou(true);
    if (erroCondutor || erroKm) return;

    if (modoOffline) {
      await offline.salvarPasso({ condutor_nome: condutor.trim(), km_saida: Number(km) });
    } else if (!idChecklist) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        await abrirNoAparelho();
      } else {
        try {
          const novo = await abrir.mutateAsync({
            id_veiculo: veiculo.id_veiculo,
            id_unidade: veiculo.id_unidade,
            condutor_nome: condutor.trim(),
            km_saida: Number(km),
          });
          setIdChecklist(novo.id_checklist);
        } catch (erro) {
          // Falhou por DADO (km regressivo, permissão)? O hook já explicou e
          // insistir offline só adiaria o mesmo "não". Falhou por REDE? Aí sim
          // o aparelho assume — é o caso do pátio com sinal que não entrega.
          if (!ehErroDeRede(erro)) return;
          await abrirNoAparelho();
        }
      }
    } else {
      await salvarRascunho.mutateAsync({
        id_checklist: idChecklist,
        patch: { condutor_nome: condutor.trim(), km_saida: Number(km) },
      });
    }
    setTentou(false);
    setPasso(3);
  }

  // Um ponto só de decisão para a foto, em vez de espalhar o `if (modoOffline)`
  // por três lugares do JSX.
  function enviarFotoDoAngulo(angulo: AnguloFoto, file: File) {
    if (modoOffline) {
      void offline.adicionarFoto(angulo, file);
      return;
    }
    if (!idChecklist) return;
    enviarFoto.mutate({ id_checklist: idChecklist, angulo, file });
  }

  function removerFotoDoChecklist(idFoto: string) {
    if (modoOffline) {
      void offline.removerFoto(idFoto);
      return;
    }
    if (!idChecklist) return;
    removerFoto.mutate({ id_foto: idFoto, id_checklist: idChecklist });
  }

  async function buscarCep(valor: string) {
    const d = valor.replace(/\D/g, "");
    if (d.length !== 8) return;
    setBuscandoCep(true);
    setErroCep(null);
    try {
      const r = await fetch(`/api/frota/cep/${d}`);
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        setErroCep(j.error ?? "Não foi possível consultar o CEP. Digite o endereço.");
        return;
      }
      const e = (await r.json()) as {
        cep: string; logradouro: string; bairro: string; cidade: string; uf: string;
      };
      setEnd((a) => ({
        ...a,
        cep: e.cep,
        // Não sobrescreve o que a pessoa já digitou: quem corrigiu à mão tinha
        // razão para corrigir.
        logradouro: a.logradouro || e.logradouro,
        bairro: a.bairro || e.bairro,
        cidade: a.cidade || e.cidade,
        uf: a.uf || e.uf,
      }));
    } catch {
      setErroCep("Consulta indisponível. Digite o endereço.");
    } finally {
      setBuscandoCep(false);
    }
  }

  const destinoOk =
    end.logradouro.trim() && end.cidade.trim() && end.uf.trim().length === 2;

  async function finalizarSaida() {
    if (!idChecklist) return;
    setTentou(true);
    if (!destinoOk || !podeFinalizar(angulosPresentes)) return;

    const campos = {
      avarias_constatadas: avarias.trim() || null,
      observacoes: obs.trim() || null,
      endereco_cep: end.cep.trim() || null,
      endereco_logradouro: end.logradouro.trim(),
      endereco_numero: end.numero.trim() || null,
      endereco_complemento: end.complemento.trim() || null,
      endereco_bairro: end.bairro.trim() || null,
      endereco_cidade: end.cidade.trim(),
      endereco_uf: end.uf.trim().toUpperCase(),
      endereco_ponto_referencia: end.referencia.trim() || null,
      maps_url: end.maps_url.trim() || null,
    };

    const rotasValidas = rotas.filter((r) => r.origem.trim() && r.destino.trim());

    // Offline: fecha a saída no aparelho e entrega à fila. Nada de rede aqui —
    // a fila sobe sozinha quando houver, na ordem que o banco exige.
    if (modoOffline) {
      await offline.finalizar({
        checklist: campos,
        rotas: rotasValidas.map((r, i) => ({
          ordem: i + 1,
          origem: r.origem.trim(),
          destino: r.destino.trim(),
          km_percorrido: r.km_percorrido ? Number(r.km_percorrido) : null,
          finalidade: r.finalidade.trim() || null,
        })),
      });
      toast.success(
        corrigindo
          ? "Correção salva. A saída voltou para a fila e sobe com os dados novos."
          : "Saída guardada no aparelho. Ela sobe sozinha quando a rede voltar.",
      );
      // Leva para a lista de pendências, não para o veículo: o técnico precisa
      // ver que existe algo por subir, senão "guardado" vira "sumiu".
      router.push("/frota/pendencias");
      return;
    }

    await salvarRascunho.mutateAsync({
      id_checklist: idChecklist,
      patch: campos,
    });

    if (rotasValidas.length > 0) {
      await salvarRotas.mutateAsync({
        id_checklist: idChecklist,
        rotas: rotasValidas.map((r, i) => ({
          ordem: i + 1,
          origem: r.origem.trim(),
          destino: r.destino.trim(),
          km_percorrido: r.km_percorrido ? Number(r.km_percorrido) : null,
          data: null,
          finalidade: r.finalidade.trim() || null,
          observacao: null,
        })),
      });
    }

    try {
      await finalizar.mutateAsync({
        id_checklist: idChecklist,
        id_veiculo: veiculo.id_veiculo,
        km_saida: Number(km),
        angulosPresentes,
      });
      router.push(`/frota/${veiculo.id_veiculo}`);
    } catch {
      /* o hook já mostrou o motivo */
    }
  }

  const ocupado =
    abrir.isPending ||
    salvarRascunho.isPending ||
    finalizar.isPending ||
    salvarRotas.isPending ||
    offline.ocupado;

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-8">
      <Link href={`/frota/${veiculo.id_veiculo}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="size-4" />
        {formatarPlaca(veiculo.placa)}
      </Link>

      {/* Passos — barra, não abas: o condutor avança, não navega. */}
      <div>
        <div className="flex items-center gap-1.5">
          {PASSOS.map((_, i) => (
            <span key={i}
              className={cn(
                "h-1 flex-1 rounded-full",
                i + 1 < passo ? "bg-blue-600" : i + 1 === passo ? "bg-amber-500" : "bg-gray-200",
              )} />
          ))}
        </div>
        <p className="mt-1.5 text-xs text-gray-500">
          Passo {passo} de 5 · <span className="font-medium text-gray-700">{PASSOS[passo - 1]}</span>
          {idChecklist && (
            <span className="text-gray-400">
              {corrigindo
                ? " · corrigindo"
                : modoOffline
                  ? " · guardado no aparelho"
                  : " · rascunho salvo"}
            </span>
          )}
        </p>
      </div>

      {/* O técnico precisa SABER que está offline enquanto preenche. Descobrir
          só no fim que nada tinha subido é o susto que este aviso evita. */}
      {modoOffline && !corrigindo && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <CloudOff className="mt-0.5 size-4 shrink-0 text-amber-700" />
          <div className="text-xs text-amber-900">
            <p className="font-semibold">Sem rede — registrando no aparelho</p>
            <p className="mt-0.5 text-amber-800">
              Pode seguir normalmente, inclusive as fotos. A saída sobe sozinha para o painel
              assim que houver sinal, e você acompanha em{" "}
              <Link href="/frota/pendencias" className="font-semibold underline">
                Guardado no aparelho
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {/* Corrigindo: o técnico precisa saber DUAS coisas que não são óbvias —
          que a saída está parada enquanto ele edita, e que só o botão do fim a
          devolve para a fila. Sem isso ele fecharia o app no meio achando que
          já tinha resolvido, e a saída ficaria em "Não terminadas". */}
      {corrigindo && (
        <div className="flex items-start gap-2.5 rounded-lg border border-blue-300 bg-blue-50 p-3">
          <Pencil className="mt-0.5 size-4 shrink-0 text-blue-700" />
          <div className="text-xs text-blue-900">
            <p className="font-semibold">Corrigindo uma saída guardada</p>
            <p className="mt-0.5 text-blue-800">
              Ela fica parada enquanto você corrige — não sobe pela metade. Ajuste o que estiver
              errado, siga até o último passo e toque em <strong>Salvar correção</strong>: é isso
              que a devolve para a fila.
            </p>
          </div>
        </div>
      )}

      {/* ── 1. Veículo ────────────────────────────────────── */}
      {passo === 1 && (
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="font-mono text-lg font-bold tracking-widest text-gray-900">
              {formatarPlaca(veiculo.placa)}
            </p>
            <p className="text-sm text-gray-700">{veiculo.modelo}</p>
            <p className="mt-1 text-xs text-gray-500">
              Registro atual: <strong className="tabular-nums">{formatarKm(kmEfetivo(veiculo))} km</strong>
            </p>
          </div>

          {veiculo.avarias_padrao?.trim() && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
                Avarias que já existiam
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-gray-600">
                {veiculo.avarias_padrao}
              </p>
              <p className="mt-2 text-xs text-gray-400">
                Isto veio do cadastro. No passo 4 você registra o que encontrar hoje.
              </p>
            </div>
          )}

          <button type="button" onClick={() => setPasso(2)}
            className="w-full rounded-md bg-blue-600 px-4 py-3 text-base font-semibold text-white hover:bg-blue-700">
            Começar
          </button>
        </div>
      )}

      {/* ── 2. Condutor e km ──────────────────────────────── */}
      {passo === 2 && (
        <div className="space-y-3">
          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <div>
              <label className={rotulo} htmlFor="cond">
                Condutor <span className="text-red-500">*</span>
              </label>
              <input id="cond" value={condutor} onChange={(e) => setCondutor(e.target.value)}
                placeholder="Nome de quem está levando"
                autoComplete="off"
                className={cn(campo, tentou && erroCondutor && "border-red-400")} />
              {tentou && erroCondutor && <p className="mt-1 text-xs text-red-600">{erroCondutor}</p>}
            </div>

            <div>
              <label className={rotulo} htmlFor="km">
                Km de saída <span className="text-red-500">*</span>
              </label>
              {/* Sem `type="number"`: a roda do mouse sobre um campo numérico
                  focado altera o valor em silêncio, e este campo é preenchido no
                  celular, no pátio, com o carro ligado. Ver lib/frota/numero.ts. */}
              <input id="km" inputMode="numeric" value={km}
                onChange={(e) => setKm(apenasDigitos(e.target.value))}
                placeholder={String(kmEfetivo(veiculo))}
                className={cn(campo, "tabular-nums", tentou && erroKm && "border-red-400")} />
              {tentou && erroKm ? (
                <p className="mt-1 text-xs text-red-600">{erroKm}</p>
              ) : (
                <p className="mt-1 text-xs text-gray-400">
                  Último registro: {formatarKm(kmEfetivo(veiculo))} km. É o que atualiza o veículo.
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setPasso(1)}
              className="rounded-md border border-gray-300 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50">
              Voltar
            </button>
            <button type="button" onClick={irParaPasso2} disabled={ocupado}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-4 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {ocupado ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* ── 3. As quatro fotos ────────────────────────────── */}
      {passo === 3 && idChecklist && (
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm font-semibold text-gray-900">Dê a volta no carro</p>
            <p className="text-xs text-gray-500">
              Quatro fotos, na ordem da volta. Sem as quatro a saída não finaliza — a trava é do
              banco, não só desta tela.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {ANGULOS_OBRIGATORIOS.map((ang) => (
                <SlotAngulo
                  key={ang}
                  angulo={ang}
                  foto={fotosExibidas.find((f) => f.angulo === ang)}
                  enviando={enviarFoto.isPending || offline.ocupado}
                  onEnviar={(file) => enviarFotoDoAngulo(ang, file)}
                />
              ))}
            </div>

            <p className={cn(
              "mt-3 text-center text-sm font-medium",
              faltando.length === 0 ? "text-emerald-700" : "text-amber-700",
            )}>
              {faltando.length === 0
                ? "As quatro estão prontas."
                : `${4 - faltando.length} de 4 · faltam ${faltando.map((a) => ROTULO_ANGULO[a].toLowerCase()).join(", ")}`}
            </p>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setPasso(2)}
              className="rounded-md border border-gray-300 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50">
              Voltar
            </button>
            <button type="button" onClick={() => setPasso(4)} disabled={faltando.length > 0}
              className="flex-1 rounded-md bg-blue-600 px-4 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400">
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* ── 4. Avarias constatadas ────────────────────────── */}
      {passo === 4 && idChecklist && (
        <div className="space-y-3">
          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Achou algo novo?</p>
              <p className="text-xs text-gray-500">
                Opcional. Só o que você vê agora e não está na lista do cadastro.
              </p>
            </div>

            {veiculo.avarias_padrao?.trim() && (
              <div className="rounded-md bg-gray-50 px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
                  Já era conhecido
                </p>
                <p className="mt-0.5 whitespace-pre-line text-xs text-gray-500">
                  {veiculo.avarias_padrao}
                </p>
              </div>
            )}

            <textarea value={avarias} onChange={(e) => setAvarias(e.target.value)} rows={3}
              placeholder="Amassado novo na porta do motorista. Farol direito com trinco solto."
              className={campo} />

            <div>
              <label className={rotulo}>Fotos extras</label>
              <label className="mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <Camera className="size-4" />
                Adicionar foto
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) enviarFotoDoAngulo("EXTRA", file);
                    e.target.value = "";
                  }} />
              </label>

              {fotosExibidas.filter((f) => f.angulo === "EXTRA").length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {fotosExibidas.filter((f) => f.angulo === "EXTRA").map((f) => (
                    <li key={f.id_foto} className="relative">
                      {f.previewUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={f.previewUrl} alt="Foto extra"
                          className="size-16 rounded-md border border-gray-200 object-cover" />
                      ) : (
                        <StorageImg stored={f.thumb_path} alt="Foto extra"
                          className="size-16 rounded-md border border-gray-200 object-cover" />
                      )}
                      <button type="button" aria-label="Remover foto"
                        onClick={() => removerFotoDoChecklist(f.id_foto)}
                        className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-0.5 text-gray-400 shadow hover:text-red-600">
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className={rotulo} htmlFor="obs2">Observações</label>
              <textarea id="obs2" value={obs} onChange={(e) => setObs(e.target.value)} rows={2}
                className={campo} />
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setPasso(3)}
              className="rounded-md border border-gray-300 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50">
              Voltar
            </button>
            <button type="button" onClick={() => setPasso(5)}
              className="flex-1 rounded-md bg-blue-600 px-4 py-3 text-base font-semibold text-white hover:bg-blue-700">
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* ── 5. Destino e rotas ────────────────────────────── */}
      {passo === 5 && idChecklist && (
        <div className="space-y-3">
          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm font-semibold text-gray-900">Para onde vai</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={rotulo} htmlFor="cep">CEP</label>
                <div className="relative">
                  <input id="cep" inputMode="numeric" value={end.cep}
                    onChange={(e) => setEnd((a) => ({ ...a, cep: e.target.value }))}
                    onBlur={(e) => buscarCep(e.target.value)}
                    placeholder="25940-000"
                    className={cn(campo, "tabular-nums")} />
                  {buscandoCep && (
                    <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-gray-400" />
                  )}
                </div>
                {erroCep ? (
                  <p className="mt-1 text-xs text-amber-700">{erroCep}</p>
                ) : (
                  <p className="mt-1 text-xs text-gray-400">Completa o resto sozinho.</p>
                )}
              </div>
              <div>
                <label className={rotulo} htmlFor="num">Número</label>
                <input id="num" value={end.numero}
                  onChange={(e) => setEnd((a) => ({ ...a, numero: e.target.value }))}
                  className={campo} />
              </div>
            </div>

            <div>
              <label className={rotulo} htmlFor="log">
                Logradouro <span className="text-red-500">*</span>
              </label>
              <input id="log" value={end.logradouro}
                onChange={(e) => setEnd((a) => ({ ...a, logradouro: e.target.value }))}
                className={cn(campo, tentou && !end.logradouro.trim() && "border-red-400")} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={rotulo} htmlFor="bai">Bairro</label>
                <input id="bai" value={end.bairro}
                  onChange={(e) => setEnd((a) => ({ ...a, bairro: e.target.value }))}
                  className={campo} />
              </div>
              <div>
                <label className={rotulo} htmlFor="comp">Complemento</label>
                <input id="comp" value={end.complemento}
                  onChange={(e) => setEnd((a) => ({ ...a, complemento: e.target.value }))}
                  className={campo} />
              </div>
            </div>

            <div className="grid grid-cols-[1fr_5rem] gap-3">
              <div>
                <label className={rotulo} htmlFor="cid">
                  Cidade <span className="text-red-500">*</span>
                </label>
                <input id="cid" value={end.cidade}
                  onChange={(e) => setEnd((a) => ({ ...a, cidade: e.target.value }))}
                  className={cn(campo, tentou && !end.cidade.trim() && "border-red-400")} />
              </div>
              <div>
                <label className={rotulo} htmlFor="uf">
                  UF <span className="text-red-500">*</span>
                </label>
                <input id="uf" value={end.uf} maxLength={2}
                  onChange={(e) => setEnd((a) => ({ ...a, uf: e.target.value.toUpperCase() }))}
                  className={cn(campo, "uppercase", tentou && end.uf.trim().length !== 2 && "border-red-400")} />
              </div>
            </div>

            <div>
              <label className={rotulo} htmlFor="ref">Ponto de referência</label>
              <input id="ref" value={end.referencia}
                onChange={(e) => setEnd((a) => ({ ...a, referencia: e.target.value }))}
                placeholder="Portão azul, ao lado do posto" className={campo} />
            </div>

            <div>
              <label className={rotulo} htmlFor="maps">Link do Maps (opcional)</label>
              <input id="maps" value={end.maps_url}
                onChange={(e) => setEnd((a) => ({ ...a, maps_url: e.target.value }))}
                placeholder="Cole aqui um pin compartilhado" className={campo} />
              <p className="mt-1 text-xs text-gray-400">
                Se colar, ele tem preferência sobre o endereço digitado.
              </p>
            </div>

            {/* O link é montado na hora, então já dá para conferir antes de finalizar. */}
            {linkMaps(end.maps_url ? { maps_url: end.maps_url } : {
              endereco_logradouro: end.logradouro, endereco_numero: end.numero,
              endereco_bairro: end.bairro, endereco_cidade: end.cidade,
              endereco_uf: end.uf, endereco_cep: end.cep,
            }) && (
              <a
                href={linkMaps(end.maps_url ? { maps_url: end.maps_url } : {
                  endereco_logradouro: end.logradouro, endereco_numero: end.numero,
                  endereco_bairro: end.bairro, endereco_cidade: end.cidade,
                  endereco_uf: end.uf, endereco_cep: end.cep,
                })!}
                target="_blank" rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100">
                <MapPin className="size-4" />
                Conferir rota no Google Maps
              </a>
            )}
          </div>

          {/* Rotas do trajeto — filhas da saída */}
          <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Rotas do trajeto</p>
              <p className="text-xs text-gray-500">
                Opcional. Os trechos desta viagem, na ordem. Ficam na saída — não no abastecimento.
              </p>
            </div>

            {rotas.map((r, i) => (
              <div key={i} className="rounded-md border border-gray-200 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-gray-400">
                    Trecho {i + 1}
                  </span>
                  <button type="button" aria-label="Remover trecho"
                    onClick={() => setRotas((a) => a.filter((_, j) => j !== i))}
                    className="rounded p-1 text-gray-400 hover:text-red-600">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <input value={r.origem} placeholder="De onde"
                    onChange={(e) => setRotas((a) => a.map((x, j) => (j === i ? { ...x, origem: e.target.value } : x)))}
                    className="w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm" />
                  <input value={r.destino} placeholder="Para onde"
                    onChange={(e) => setRotas((a) => a.map((x, j) => (j === i ? { ...x, destino: e.target.value } : x)))}
                    className="w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm" />
                  <input value={r.km_percorrido} inputMode="numeric" placeholder="km do trecho"
                    onChange={(e) => setRotas((a) => a.map((x, j) => (j === i ? { ...x, km_percorrido: e.target.value } : x)))}
                    className="w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm tabular-nums" />
                  <input value={r.finalidade} placeholder="Finalidade"
                    onChange={(e) => setRotas((a) => a.map((x, j) => (j === i ? { ...x, finalidade: e.target.value } : x)))}
                    className="w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm" />
                </div>
              </div>
            ))}

            <button type="button"
              onClick={() => setRotas((a) => [...a, { origem: "", destino: "", km_percorrido: "", finalidade: "" }])}
              className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
              <Plus className="size-4" />
              Adicionar trecho
            </button>
          </div>

          {tentou && !destinoOk && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Logradouro, cidade e UF são o mínimo para o mapa achar o lugar.
            </p>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={() => setPasso(4)}
              className="rounded-md border border-gray-300 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50">
              Voltar
            </button>
            <button type="button" onClick={finalizarSaida} disabled={ocupado}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-4 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
              {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {corrigindo ? "Salvar correção" : "Finalizar saída"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SlotAngulo({
  angulo,
  foto,
  enviando,
  onEnviar,
}: {
  angulo: AnguloObrigatorio;
  /** `previewUrl` só vem no modo offline: é o Blob local, que ainda não subiu. */
  foto?: { thumb_path: string; previewUrl?: string };
  enviando: boolean;
  onEnviar: (file: File) => void;
}) {
  const feito = !!foto;

  return (
    <label
      className={cn(
        "relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-md text-center text-xs font-medium transition-colors",
        feito
          ? "border border-blue-500 bg-blue-50 text-blue-700"
          : "border-2 border-dashed border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100",
      )}
    >
      {feito ? (
        <>
          {foto!.previewUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={foto!.previewUrl} alt={ROTULO_ANGULO[angulo]}
              className="absolute inset-0 size-full object-cover" />
          ) : (
            <StorageImg stored={foto!.thumb_path} alt={ROTULO_ANGULO[angulo]}
              className="absolute inset-0 size-full object-cover" />
          )}
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-blue-600/90 py-1 text-[11px] font-semibold text-white">
            <Check className="size-3" />
            {ROTULO_ANGULO_CURTO[angulo]}
          </span>
        </>
      ) : (
        <>
          {enviando ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
          <span>{ROTULO_ANGULO_CURTO[angulo]}</span>
        </>
      )}
      <input type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onEnviar(file);
          e.target.value = "";
        }} />
    </label>
  );
}

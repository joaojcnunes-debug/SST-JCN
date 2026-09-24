"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, Trash2, ImageOff } from "lucide-react";
import toast from "react-hot-toast";
import StorageImg from "@/components/ui/StorageImg";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUnidades } from "@/lib/hooks/useUnidades";
import { useSignedUrl } from "@/lib/hooks/useSignedUrl";
import {
  useCriarEquipamento,
  useAtualizarEquipamento,
  prepararFotoEquipamento,
  removerFotoEquipamentoStorage,
  type EquipamentoInput,
} from "@/lib/hooks/useEquipamentos";
import { TIPOS_EQUIPAMENTO, TIPO_OUTRO, tipoNaLista } from "@/lib/equipamentos/tipos";
import { gerarId } from "@/lib/utils";
import type { ImagemPendente } from "@/lib/offline/gravar";
import { cn } from "@/lib/utils";
import type { Equipamento } from "@/lib/supabase/types";

/**
 * Formulário do patrimônio interno — §3.3 do briefing.
 *
 * POR QUE NÃO REUSAR O `MaquinaForm`. Aquele é um formulário de máquina
 * industrial NR-12 (659 linhas) que hoje serve também para notebook e cadeira.
 * Duas das quatro abas dele — "Capacidade" (potência, pressão, RPM) e
 * "Segurança" (proteção fixa/móvel, intertravamento, grau de risco) — não têm
 * sentido nenhum para um mouse, e a base prova: esses campos estão vazios em
 * 100% dos 99 equipamentos internos.
 *
 * DUAS DIFERENÇAS DELIBERADAS em relação ao MaquinaForm:
 *  • SETOR NÃO É OBRIGATÓRIO. Lá a mensagem é "toda máquina pertence a um
 *    setor" — atrito puro para um item que está no estoque, sem setor ainda.
 *  • BASE É OBRIGATÓRIA, e é a única obrigatória além do nome. Equipamento
 *    sempre está em algum lugar; `id_unidade` é NOT NULL no banco.
 *
 * A SITUAÇÃO (status) NÃO SE EDITA AQUI. Mudar situação exige motivo e passa
 * pela RPC da v167 — o banco recusa `update` direto no campo, inclusive de
 * admin. A tela de mudança de situação é peça separada, da fase 7.
 */

const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500";

function Campo({
  label,
  children,
  dica,
}: {
  label: string;
  children: React.ReactNode;
  dica?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-600">
        {label}
      </span>
      {children}
      {dica && <span className="mt-1 block text-[11px] text-gray-400">{dica}</span>}
    </label>
  );
}

/**
 * Teto do arquivo ESCOLHIDO — não do que sobe.
 *
 * O que sobe é reduzido a 2048 px em `prepararFotoEquipamento`: foto de celular
 * de 12 MB vira algumas centenas de kB. Este teto sobrou só para o caso extremo
 * em que decodificar a imagem derrubaria o navegador do aparelho.
 *
 * ⚠️ Ele valia 10 MB e recusava a foto ANTES de qualquer redução — era ele que
 * fazia a foto vinda da galeria ser rejeitada enquanto a tirada pela câmera do
 * próprio painel passava. Baixá-lo de volta traz o problema junto.
 */
const LIMITE_ESCOLHA_BYTES = 40 * 1024 * 1024;

const ABAS = ["Identificação", "Aquisição", "Localização", "Observações"] as const;
type Aba = (typeof ABAS)[number];

/**
 * Lê o valor de aquisição aceitando as três formas que aparecem neste campo.
 *
 * ⚠️ A TERCEIRA é a que corrompia dado. Ao EDITAR, o campo nasce de
 * `String(valor_aquisicao)` e o banco devolve ponto decimal — "3450.55". A
 * versão anterior apagava TODO ponto, como se todo ponto fosse separador de
 * milhar, então salvar de novo gravava 345055. Cem vezes o valor, em silêncio,
 * e só em quem tinha centavos: valor redondo passava ileso, e foi por isso que
 * ninguém percebeu. Medido em 25/08: 3450,5 virava 34505; 1299,9 virava 12999.
 *
 *   "3.450,55" -> 3450.55   (digitado à brasileira)
 *   "3450,55"  -> 3450.55
 *   "3450.55"  -> 3450.55   (como o valor volta do banco)
 *
 * Sem vírgula, um único ponto com uma ou duas casas é DECIMAL; qualquer outro
 * ponto é separador de milhar — "1.200" é mil e duzentos, não um vírgula dois.
 */
function paraNumero(v: string): number {
  const t = v.replace(/\s/g, "");
  if (t.includes(",")) return Number(t.replace(/\./g, "").replace(",", "."));
  if (/^-?\d+\.\d{1,2}$/.test(t)) return Number(t);
  return Number(t.replace(/\./g, ""));
}

/** Texto vazio vira NULL — string vazia colidiria consigo mesma no índice único
 *  do patrimônio, e polui os filtros com "" como se fosse um valor. */
const limpo = (v: string): string | null => {
  const t = v.trim();
  return t === "" ? null : t;
};

export default function EquipamentoForm({ equipamento }: { equipamento?: Equipamento }) {
  const router = useRouter();
  const editando = !!equipamento;

  const { data: unidades = [] } = useUnidades();
  const criar = useCriarEquipamento();
  const atualizar = useAtualizarEquipamento();

  const [aba, setAba] = useState<Aba>("Identificação");
  const [salvando, setSalvando] = useState(false);

  // ── Estado do formulário ─────────────────────────────────
  const [nome, setNome] = useState(equipamento?.nome ?? "");
  const [tipoSel, setTipoSel] = useState(() =>
    equipamento?.tipo ? (tipoNaLista(equipamento.tipo) ? equipamento.tipo : TIPO_OUTRO) : ""
  );
  // Tipo fora da lista fixa abre o campo livre JÁ PREENCHIDO, em vez de apagar
  // em silêncio o que a pessoa tinha escrito antes.
  const [tipoLivre, setTipoLivre] = useState(
    equipamento?.tipo && !tipoNaLista(equipamento.tipo) ? equipamento.tipo : ""
  );
  const [fabricante, setFabricante] = useState(equipamento?.fabricante ?? "");
  const [modelo, setModelo] = useState(equipamento?.modelo ?? "");
  const [numeroSerie, setNumeroSerie] = useState(equipamento?.numero_serie ?? "");
  const [numeroPatrimonio, setNumeroPatrimonio] = useState(equipamento?.numero_patrimonio ?? "");
  const [codigoInterno, setCodigoInterno] = useState(equipamento?.codigo_interno ?? "");
  const [tag, setTag] = useState(equipamento?.tag ?? "");

  const [fornecedor, setFornecedor] = useState(equipamento?.fornecedor ?? "");
  const [notaFiscal, setNotaFiscal] = useState(equipamento?.nota_fiscal ?? "");
  const [dataAquisicao, setDataAquisicao] = useState(equipamento?.data_aquisicao ?? "");
  const [valorAquisicao, setValorAquisicao] = useState(
    equipamento?.valor_aquisicao != null ? String(equipamento.valor_aquisicao) : ""
  );
  const [garantiaAte, setGarantiaAte] = useState(equipamento?.garantia_ate ?? "");

  const [idUnidade, setIdUnidade] = useState(equipamento?.id_unidade ?? "");
  const [setor, setSetor] = useState(equipamento?.setor ?? "");
  const [localizacao, setLocalizacao] = useState(equipamento?.localizacao ?? "");
  const [responsavel, setResponsavel] = useState(equipamento?.responsavel ?? "");

  const [observacoes, setObservacoes] = useState(equipamento?.observacoes ?? "");

  // ── Foto ─────────────────────────────────────────────────
  const inputFoto = useRef<HTMLInputElement | null>(null);
  const [arquivoFoto, setArquivoFoto] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [fotoRemovida, setFotoRemovida] = useState(false);

  const fotoAtual = fotoRemovida ? null : equipamento?.foto_thumb_path ?? equipamento?.foto_url ?? null;

  // O que a tela desenha é a MINIATURA (320 px), boa para reconhecer o item e
  // nada além disso. Para ler número de série ou plaqueta é preciso abrir a
  // imagem inteira — e até 25/08 não havia caminho nenhum para isso no módulo.
  // `foto_path` é o caminho puro no bucket, então a assinatura funciona; o
  // `foto_url` fica de reserva para as linhas antigas que só têm a URL.
  const { data: urlAssinada } = useSignedUrl(equipamento?.foto_path ?? null);
  const urlFotoInteira = urlAssinada ?? equipamento?.foto_url ?? null;

  const bases = useMemo(
    () => [...unidades].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [unidades]
  );

  function escolherFoto(file: File | null) {
    if (!file) return;
    if (file.size > LIMITE_ESCOLHA_BYTES) {
      toast.error("Esta imagem passa de 40 MB — grande demais até para reduzir. Envie uma versão menor.");
      return;
    }
    setArquivoFoto(file);
    setPrevia(URL.createObjectURL(file));
    setFotoRemovida(false);
  }

  /**
   * Patrimônio é único entre os preenchidos (índice parcial da v163). Consultar
   * antes de salvar é o que permite a mensagem amigável dizendo QUAL equipamento
   * já usa o número — o índice sozinho devolveria um erro técnico. O índice
   * continua sendo a rede de segurança para duas pessoas salvando no mesmo
   * segundo, que a tela não tem como pegar.
   */
  async function patrimonioEmUsoPor(valor: string): Promise<string | null> {
    const supabase = createSupabaseBrowserClient();
    let q = supabase
      .from("equipamentos")
      .select("id_equipamento,nome")
      .eq("numero_patrimonio", valor)
      .limit(1);
    if (equipamento) q = q.neq("id_equipamento", equipamento.id_equipamento);
    const { data } = await q;
    const achado = (data ?? [])[0] as { nome?: string } | undefined;
    return achado?.nome ?? null;
  }

  async function salvar() {
    if (!nome.trim()) {
      setAba("Identificação");
      toast.error("Informe o nome do equipamento.");
      return;
    }
    if (!idUnidade) {
      setAba("Localização");
      toast.error("Escolha a base onde o equipamento está.");
      return;
    }

    const tipoFinal =
      tipoSel === TIPO_OUTRO ? limpo(tipoLivre) : limpo(tipoSel);
    if (tipoSel === TIPO_OUTRO && !tipoFinal) {
      setAba("Identificação");
      toast.error("Escreva o tipo, ou escolha um da lista.");
      return;
    }

    const patrim = limpo(numeroPatrimonio);
    if (patrim) {
      const dono = await patrimonioEmUsoPor(patrim);
      if (dono) {
        setAba("Identificação");
        toast.error(`O patrimônio ${patrim} já está em uso por "${dono}".`);
        return;
      }
    }

    const valor = limpo(valorAquisicao);
    const valorNum = valor ? paraNumero(valor) : null;
    if (valor && Number.isNaN(valorNum)) {
      setAba("Aquisição");
      toast.error("O valor de aquisição não parece um número.");
      return;
    }

    setSalvando(true);
    try {
      // O id sai antes do upload para o caminho da foto casar com a linha.
      const id = equipamento?.id_equipamento ?? gerarId("EQP");

      let foto_url = fotoRemovida ? null : equipamento?.foto_url ?? null;
      let foto_path = fotoRemovida ? null : equipamento?.foto_path ?? null;
      let foto_thumb_path = fotoRemovida ? null : equipamento?.foto_thumb_path ?? null;
      let imagens: ImagemPendente[] | undefined;

      // Apagar do storage só com rede — sem ela o arquivo fica órfão no MinIO,
      // que é desperdício de espaço e não erro.
      if (fotoRemovida && equipamento?.foto_path && navigator.onLine) {
        await removerFotoEquipamentoStorage(equipamento.foto_path, id);
      }
      if (arquivoFoto) {
        // Decide caminhos, reduz e gera a miniatura sem subir nada: quem sobe é
        // o `gravar()`, junto da linha e na ordem certa.
        //
        // O try é PRÓPRIO porque esta etapa roda ANTES de qualquer mutação. O
        // catch lá embaixo confia em "as mutações já avisam" — e uma falha aqui
        // não passa por mutação nenhuma: o botão parava de girar e nada era dito.
        // A mensagem vem crua de propósito; ela foi escrita para o usuário e diz
        // o que fazer (trocar o formato do iPhone, mandar JPG, tirar na hora).
        try {
          const r = await prepararFotoEquipamento(id, arquivoFoto);
          foto_url = r.publicUrl;
          foto_path = r.storagePath;
          foto_thumb_path = r.thumbPath;
          imagens = r.imagens;
        } catch (e) {
          console.error(e);
          toast.error(
            e instanceof Error && e.message
              ? e.message
              : "Não foi possível preparar a foto. Tente outra imagem."
          );
          return;
        }
      }

      const input: EquipamentoInput = {
        id_unidade: idUnidade,
        nome: nome.trim(),
        tipo: tipoFinal,
        fabricante: limpo(fabricante),
        modelo: limpo(modelo),
        numero_serie: limpo(numeroSerie),
        numero_patrimonio: patrim,
        codigo_interno: limpo(codigoInterno),
        tag: limpo(tag),
        fornecedor: limpo(fornecedor),
        nota_fiscal: limpo(notaFiscal),
        data_aquisicao: limpo(dataAquisicao),
        valor_aquisicao: valorNum,
        garantia_ate: limpo(garantiaAte),
        termo_garantia_path: equipamento?.termo_garantia_path ?? null,
        setor: limpo(setor),
        localizacao: limpo(localizacao),
        responsavel: limpo(responsavel),
        foto_url,
        foto_path,
        foto_thumb_path,
        observacoes: limpo(observacoes),
      };

      // O aviso de sucesso sai das mutações quando a gravação vai para o
      // aparelho — dizer "cadastrado" ali seria mentira, porque o painel ainda
      // não sabe do equipamento.
      if (equipamento) {
        const r = await atualizar.mutateAsync({
          id_equipamento: equipamento.id_equipamento,
          patch: input,
          imagens,
        });
        if (r.resultado.destino === "SERVIDOR") toast.success("Equipamento atualizado.");
      } else {
        const r = await criar.mutateAsync({ input, idEquipamento: id, imagens });
        if (r.destino === "SERVIDOR") toast.success("Equipamento cadastrado.");
      }
      router.push("/equipamentos");
    } catch (e) {
      // As mutações já avisam; este catch cobre falha de upload.
      console.error(e);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">
          {editando ? "Editar equipamento" : "Novo equipamento"}
        </h1>
        {editando && (
          <span className="rounded bg-gray-100 px-2 py-1 font-mono text-[11px] text-gray-500">
            {equipamento.id_equipamento}
          </span>
        )}
      </div>

      {/* ── Abas ──────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-gray-200">
        {ABAS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAba(a)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              aba === a
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        {/* ── IDENTIFICAÇÃO ──────────────────────────────── */}
        {aba === "Identificação" && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 space-y-3">
                <Campo label="Nome *">
                  <input
                    className={inputClass}
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex.: Notebook do Nathan"
                    autoFocus
                  />
                </Campo>

                <Campo label="Tipo">
                  <select
                    className={inputClass}
                    value={tipoSel}
                    onChange={(e) => setTipoSel(e.target.value)}
                  >
                    <option value="">— sem tipo —</option>
                    {TIPOS_EQUIPAMENTO.map((g) => (
                      <optgroup key={g.grupo} label={g.grupo}>
                        {g.tipos.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    <option value={TIPO_OUTRO}>Outro (escrever)…</option>
                  </select>
                </Campo>

                {tipoSel === TIPO_OUTRO && (
                  <Campo
                    label="Qual tipo?"
                    dica="Se este tipo passar a ser comum, vale acrescentá-lo à lista."
                  >
                    <input
                      className={inputClass}
                      value={tipoLivre}
                      onChange={(e) => setTipoLivre(e.target.value)}
                      placeholder="Ex.: Cadeira, Furadeira…"
                    />
                  </Campo>
                )}
              </div>

              {/* Foto */}
              <div className="w-40 shrink-0">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-600">
                  Foto
                </span>
                <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                  {previa ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previa} alt="prévia" className="size-full object-cover" />
                  ) : fotoAtual ? (
                    <StorageImg stored={fotoAtual} alt={nome} className="size-full object-cover" />
                  ) : (
                    <ImageOff className="size-7 text-gray-300" />
                  )}
                </div>
                <input
                  ref={inputFoto}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => escolherFoto(e.target.files?.[0] ?? null)}
                />
                <div className="mt-1.5 flex gap-1">
                  <button
                    type="button"
                    onClick={() => inputFoto.current?.click()}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Upload className="size-3.5" />
                    {fotoAtual || previa ? "Trocar" : "Enviar"}
                  </button>
                  {(fotoAtual || previa) && (
                    <button
                      type="button"
                      onClick={() => {
                        setArquivoFoto(null);
                        setPrevia(null);
                        setFotoRemovida(true);
                      }}
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
                      title="Remover foto"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                {/* Só depois de gravada: enquanto é prévia local, a imagem
                    inteira já está na tela e ainda não existe no bucket. */}
                {!previa && fotoAtual && urlFotoInteira && (
                  <a
                    href={urlFotoInteira}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 block text-center text-[11px] font-medium text-blue-700 hover:underline"
                  >
                    Ver foto inteira
                  </a>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Fabricante">
                <input className={inputClass} value={fabricante} onChange={(e) => setFabricante(e.target.value)} />
              </Campo>
              <Campo label="Modelo">
                <input className={inputClass} value={modelo} onChange={(e) => setModelo(e.target.value)} />
              </Campo>
              <Campo label="Nº de série">
                <input className={inputClass} value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value)} />
              </Campo>
              <Campo label="Nº de patrimônio" dica="A plaqueta. Não pode repetir.">
                <input
                  className={inputClass}
                  value={numeroPatrimonio}
                  onChange={(e) => setNumeroPatrimonio(e.target.value)}
                />
              </Campo>
              <Campo label="Código interno">
                <input className={inputClass} value={codigoInterno} onChange={(e) => setCodigoInterno(e.target.value)} />
              </Campo>
              <Campo label="Etiqueta (TAG)">
                <input className={inputClass} value={tag} onChange={(e) => setTag(e.target.value)} />
              </Campo>
            </div>
          </div>
        )}

        {/* ── AQUISIÇÃO ──────────────────────────────────── */}
        {aba === "Aquisição" && (
          <div className="space-y-3">
            <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">
              Tudo aqui é opcional. Campo em branco em todos os equipamentos
              simplesmente não aparece na planilha exportada.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Fornecedor">
                <input className={inputClass} value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
              </Campo>
              <Campo label="Nota fiscal">
                <input className={inputClass} value={notaFiscal} onChange={(e) => setNotaFiscal(e.target.value)} />
              </Campo>
              <Campo label="Data de aquisição">
                <input type="date" className={inputClass} value={dataAquisicao ?? ""} onChange={(e) => setDataAquisicao(e.target.value)} />
              </Campo>
              <Campo label="Valor de aquisição" dica="Só o número. Ex.: 3450,00">
                <input className={inputClass} value={valorAquisicao} onChange={(e) => setValorAquisicao(e.target.value)} inputMode="decimal" />
              </Campo>
              <Campo label="Garantia até">
                <input type="date" className={inputClass} value={garantiaAte ?? ""} onChange={(e) => setGarantiaAte(e.target.value)} />
              </Campo>
            </div>
          </div>
        )}

        {/* ── LOCALIZAÇÃO ────────────────────────────────── */}
        {aba === "Localização" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Base *" dica="Onde o equipamento está hoje.">
              <select className={inputClass} value={idUnidade} onChange={(e) => setIdUnidade(e.target.value)}>
                <option value="">— escolha a base —</option>
                {bases.map((u) => (
                  <option key={u.id_unidade} value={u.id_unidade}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Setor" dica="Opcional — item em estoque pode não ter setor.">
              <input className={inputClass} value={setor} onChange={(e) => setSetor(e.target.value)} />
            </Campo>
            <Campo label="Localização">
              <input className={inputClass} value={localizacao} onChange={(e) => setLocalizacao(e.target.value)} placeholder="Ex.: Sala 2, armário" />
            </Campo>
            <Campo label="Responsável">
              <input className={inputClass} value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
            </Campo>
          </div>
        )}

        {/* ── OBSERVAÇÕES ────────────────────────────────── */}
        {aba === "Observações" && (
          <Campo label="Observações">
            <textarea
              className={cn(inputClass, "min-h-[10rem] resize-y")}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Qualquer coisa que ajude a identificar ou cuidar deste item."
            />
          </Campo>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push("/equipamentos")}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {salvando && <Loader2 className="size-4 animate-spin" />}
          {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Cadastrar"}
        </button>
      </div>
    </div>
  );
}

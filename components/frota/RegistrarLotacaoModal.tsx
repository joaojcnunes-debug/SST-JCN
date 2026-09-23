"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Building2, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useRegistrarLotacao } from "@/lib/hooks/useFrotaLotacoes";
import { useFrotaVeiculosLista } from "@/lib/hooks/useFrotaVeiculos";
import { useUnidades } from "@/lib/hooks/useUnidades";
import { useCurrentUser, useIsAdmin } from "@/lib/hooks/useUsuario";
import { formatarPlaca } from "@/lib/frota/placa";
import { formatarKm, kmEfetivo } from "@/lib/frota/km";
import { apenasDigitos, paraInteiro } from "@/lib/frota/numero";
import { cn } from "@/lib/utils";

/**
 * Mudança de base — a movimentação que o módulo não sabia registrar.
 *
 * O QUE ELA NÃO É: não é viagem. Viagem tem checklist, quatro fotos e volta; a
 * base do veículo não muda. Aqui o carro muda de endereço: as saídas seguintes
 * nascem carimbadas na base nova, ele some da lista de quem cuidava dele e
 * aparece na de outra pessoa.
 *
 * A ORIGEM NÃO É CAMPO. Ela é lida do veículo e carimbada pelo banco (trigger da
 * v178). Oferecer um select de origem convidaria a registrar uma saída de onde o
 * carro não estava, e o extrato viraria ficção difícil de desfazer.
 *
 * OS DOIS KM SÃO OPCIONAIS, e a tela explica a diferença: o trecho é quanto se
 * rodou para levar o carro; o odômetro é a leitura do painel na chegada. Só o
 * segundo mexe no registro do veículo. Quem registra do escritório em geral não
 * tem nenhum dos dois — e é por isso que nenhum é obrigatório.
 */

const rotulo = "block text-xs font-medium text-gray-600";
const campo =
  "mt-1 w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function agoraLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

type Props = {
  aberto: boolean;
  onFechar: () => void;
  /** Já vem escolhido quando o modal abre pela ficha de um veículo. */
  idVeiculoInicial?: string;
};

export default function RegistrarLotacaoModal({ aberto, onFechar, idVeiculoInicial }: Props) {
  const registrar = useRegistrarLotacao();
  const { data: veiculos = [] } = useFrotaVeiculosLista();
  const { data: unidades = [] } = useUnidades();
  const user = useCurrentUser();
  const isAdmin = useIsAdmin();

  const [idVeiculo, setIdVeiculo] = useState(idVeiculoInicial ?? "");
  const [destino, setDestino] = useState("");
  const [quando, setQuando] = useState(agoraLocal);
  const [motivo, setMotivo] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [kmTrecho, setKmTrecho] = useState("");
  const [kmOdometro, setKmOdometro] = useState("");
  const [obs, setObs] = useState("");
  const [tentou, setTentou] = useState(false);

  const veiculo = veiculos.find((v) => v.id_veiculo === idVeiculo) ?? null;

  // Só as bases do usuário — a mesma régua da RLS. Oferecer base fora do escopo
  // só produziria um insert que o banco recusa, com mensagem que não ajuda.
  const basesVisiveis = useMemo(() => {
    const meus = new Set(user?.unidades ?? []);
    return isAdmin ? unidades : unidades.filter((u) => meus.has(u.id_unidade));
  }, [unidades, user, isAdmin]);

  const nomeBase = (id: string | null | undefined) =>
    unidades.find((u) => u.id_unidade === id)?.nome ?? "—";

  const kmTrechoNum = paraInteiro(kmTrecho);
  const kmOdoNum = paraInteiro(kmOdometro);

  const erros = useMemo(() => {
    const e: { veiculo?: string; destino?: string; km?: string; quando?: string } = {};
    if (!idVeiculo) e.veiculo = "Escolha o veículo.";
    // Data no futuro é armadilha aqui, e não em outros formulários: registrar a
    // mudança MOVE o veículo na hora (trigger da v178). Uma lotação marcada para
    // a semana que vem tiraria o carro da base hoje, e quem procurasse por ele
    // não o encontraria. Agendamento não existe neste fluxo — registre no dia.
    if (quando && new Date(quando).getTime() > Date.now() + 60_000) {
      e.quando =
        "A mudança é registrada quando acontece: o veículo troca de base assim que você salvar. Para uma data futura, registre no dia.";
    }
    if (!destino) e.destino = "Escolha a base de destino.";
    else if (veiculo && destino === veiculo.id_unidade) {
      e.destino = "O veículo já está nesta base.";
    }
    if (veiculo && kmOdoNum != null && kmOdoNum < kmEfetivo(veiculo)) {
      // Não bloqueia o lançamento inteiro por isso? Bloqueia: aqui o número é
      // leitura de painel, e painel não anda para trás. Diferente do
      // abastecimento lançado com atraso, que é aviso e não erro.
      e.km = `O registro do veículo está em ${formatarKm(kmEfetivo(veiculo))} km. O odômetro não volta atrás.`;
    }
    return e;
  }, [idVeiculo, destino, veiculo, kmOdoNum, quando]);

  const temErro = Object.keys(erros).length > 0;

  async function salvar() {
    setTentou(true);
    if (temErro) return;
    try {
      await registrar.mutateAsync({
        id_veiculo: idVeiculo,
        id_unidade_destino: destino,
        data_movimentacao: new Date(quando).toISOString(),
        motivo: motivo.trim() || null,
        responsavel_nome: responsavel.trim() || null,
        observacao: obs.trim() || null,
        km_percorrido: kmTrechoNum,
        km_odometro: kmOdoNum,
      });
      onFechar();
    } catch {
      /* o hook já avisou; o formulário fica na tela com o que foi digitado */
    }
  }

  return (
    <Modal
      open={aberto}
      onClose={onFechar}
      title="Registrar mudança de base"
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onFechar}
            className="rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-white">
            Cancelar
          </button>
          <button type="button" onClick={salvar} disabled={registrar.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {registrar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Building2 className="size-4" />}
            Registrar
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={rotulo} htmlFor="lot_veiculo">
            Veículo <span className="text-red-500">*</span>
          </label>
          <select id="lot_veiculo" value={idVeiculo} onChange={(e) => setIdVeiculo(e.target.value)}
            disabled={!!idVeiculoInicial}
            className={cn(campo, tentou && erros.veiculo && "border-red-400",
              idVeiculoInicial && "bg-gray-50 text-gray-600")}>
            <option value="">Escolha…</option>
            {veiculos.map((v) => (
              <option key={v.id_veiculo} value={v.id_veiculo}>
                {formatarPlaca(v.placa)} — {v.modelo}
              </option>
            ))}
          </select>
          {tentou && erros.veiculo && (
            <p className="mt-1 text-xs text-red-600">{erros.veiculo}</p>
          )}
        </div>

        {/* De → Para, sem campo de origem: ela é o que o banco sabe, não o que
            a pessoa digita. */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[9rem] flex-1">
            <span className={rotulo}>Sai de</span>
            <p className="mt-1 truncate rounded-md border border-dashed border-gray-300 bg-gray-50 px-2.5 py-2 text-sm text-gray-600">
              {veiculo ? nomeBase(veiculo.id_unidade) : "escolha o veículo"}
            </p>
          </div>
          <ArrowRight className="mb-2.5 size-4 shrink-0 text-gray-400" />
          <div className="min-w-[9rem] flex-1">
            <label className={rotulo} htmlFor="lot_destino">
              Vai para <span className="text-red-500">*</span>
            </label>
            <select id="lot_destino" value={destino} onChange={(e) => setDestino(e.target.value)}
              className={cn(campo, tentou && erros.destino && "border-red-400")}>
              <option value="">Escolha…</option>
              {basesVisiveis
                .filter((u) => !veiculo || u.id_unidade !== veiculo.id_unidade)
                .map((u) => (
                  <option key={u.id_unidade} value={u.id_unidade}>{u.nome}</option>
                ))}
            </select>
            {tentou && erros.destino && (
              <p className="mt-1 text-xs text-red-600">{erros.destino}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={rotulo} htmlFor="lot_quando">
              Quando mudou <span className="text-red-500">*</span>
            </label>
            <input id="lot_quando" type="datetime-local" value={quando}
              onChange={(e) => setQuando(e.target.value)}
              className={cn(campo, tentou && erros.quando && "border-red-400")} />
            {tentou && erros.quando ? (
              <p className="mt-1 text-xs text-red-600">{erros.quando}</p>
            ) : (
              <p className="mt-1 text-xs text-gray-400">
                A data do fato, não a de hoje. Corrija se a mudança foi antes.
              </p>
            )}
          </div>
          <div>
            <label className={rotulo} htmlFor="lot_resp">Quem levou / autorizou</label>
            <input id="lot_resp" value={responsavel} onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Nome" className={campo} />
          </div>
        </div>

        <div>
          <label className={rotulo} htmlFor="lot_motivo">Motivo</label>
          <input id="lot_motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder="Remanejamento de equipe. Base de Lafaiete ficou sem carro."
            className={campo} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={rotulo} htmlFor="lot_km_trecho">
              Km rodado no trecho <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <input id="lot_km_trecho" inputMode="numeric" value={kmTrecho}
              onChange={(e) => setKmTrecho(apenasDigitos(e.target.value))}
              placeholder="210" className={cn(campo, "tabular-nums")} />
            <p className="mt-1 text-xs text-gray-400">
              Quanto se rodou para levar o carro. Entra no km do mês.
            </p>
          </div>
          <div>
            <label className={rotulo} htmlFor="lot_km_odo">
              Odômetro na chegada <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <input id="lot_km_odo" inputMode="numeric" value={kmOdometro}
              onChange={(e) => setKmOdometro(apenasDigitos(e.target.value))}
              placeholder={veiculo ? String(kmEfetivo(veiculo)) : "84210"}
              className={cn(campo, "tabular-nums", tentou && erros.km && "border-red-400")} />
            {tentou && erros.km ? (
              <p className="mt-1 text-xs text-red-600">{erros.km}</p>
            ) : (
              <p className="mt-1 text-xs text-gray-400">
                A leitura do painel. É o único que atualiza o km do veículo.
              </p>
            )}
          </div>
        </div>

        <div>
          <label className={rotulo} htmlFor="lot_obs">Observação</label>
          <textarea id="lot_obs" value={obs} onChange={(e) => setObs(e.target.value)} rows={2}
            placeholder="Ficará em Lafaiete até o fim da obra. Chave reserva foi junto."
            className={campo} />
        </div>

        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Ao registrar, o veículo passa a aparecer na base de destino — inclusive para quem cuida
          dela. O histórico de saídas antigas <strong>não muda</strong>: elas aconteceram na base
          anterior e continuam registradas assim.
        </p>
      </div>
    </Modal>
  );
}

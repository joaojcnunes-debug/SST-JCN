"use client";

import { useMemo, useState } from "react";
import { Loader2, Undo2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useRegistrarRetorno } from "@/lib/hooks/useFrotaChecklists";
import { formatarKm } from "@/lib/frota/km";
import { formatarPlaca } from "@/lib/frota/placa";
import { enderecoEmLinha } from "@/lib/frota/maps";
import { dataHoraBr } from "@/lib/frota/painel";
import { apenasDigitos, paraInteiro } from "@/lib/frota/numero";
import type { FrotaChecklist } from "@/lib/frota/tipos";
import { cn } from "@/lib/utils";

/**
 * Fecha a viagem: o veículo voltou.
 *
 * É a tela que faltava no módulo inteiro. Sem ela, `data_retorno` ficou dois
 * meses no banco como "Fase 2 — prevista e sem uso", e o painel não tinha como
 * responder a pergunta mais simples que existe numa frota: este carro está aí?
 *
 * TRÊS DECISÕES QUE ESTÃO NA CARA DA TELA:
 *   • o km é OPCIONAL, e a tela diz isso em voz alta. Quem registra não é
 *     necessariamente quem dirigiu — foi decisão do operador. Campo obrigatório
 *     aqui produziria número inventado, que entra na conta de consumo como se
 *     fosse medição e estraga o relatório inteiro.
 *   • a data do retorno é EDITÁVEL e vem preenchida com agora. O carro chega às
 *     17h e o lançamento acontece no dia seguinte; obrigar "agora" transformaria
 *     todo retorno atrasado numa mentira de algumas horas.
 *   • as avarias da volta ficam em campo PRÓPRIO, separadas das da saída. É o
 *     mesmo par `avarias_padrao` × `avarias_constatadas` da v177, um nível
 *     adiante: só comparando os três dá para dizer o que aconteceu NESTA viagem.
 */

const rotulo = "block text-xs font-medium text-gray-600";
const campo =
  "mt-1 w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

/** "2026-08-17T14:30" no fuso de quem está olhando — o que o input espera. */
function agoraLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

type Props = {
  saida: FrotaChecklist;
  placa: string;
  aberto: boolean;
  onFechar: () => void;
};

export default function RegistrarRetornoModal({ saida, placa, aberto, onFechar }: Props) {
  const registrar = useRegistrarRetorno();

  const [quando, setQuando] = useState(agoraLocal);
  const [km, setKm] = useState("");
  const [avarias, setAvarias] = useState("");
  const [obs, setObs] = useState("");
  const [tentou, setTentou] = useState(false);

  // Só dígitos: campo de km não é `type="number"` de propósito. A setinha do
  // número é exatamente o que gravava -1 e 8 no campo de ano do cadastro, e a
  // roda do mouse sobre um número focado muda o valor sem ninguém pedir.
  const kmNum = paraInteiro(km);

  const erros = useMemo(() => {
    const e: { quando?: string; km?: string } = {};
    if (!quando) {
      e.quando = "Informe quando o veículo voltou.";
    } else if (new Date(quando).getTime() < new Date(saida.data_saida).getTime()) {
      e.quando = `A saída foi em ${dataHoraBr(saida.data_saida)}. O retorno não pode ser antes.`;
    } else if (new Date(quando).getTime() > Date.now() + 60_000) {
      // Retorno não se agenda: fechar a viagem é afirmar que o carro já está
      // aí. Data futura tiraria o veículo da lista de "na rua" antes de ele
      // voltar — exatamente o erro que este módulo existe para não cometer.
      e.quando = "O retorno é o registro de algo que já aconteceu. Não dá para marcar para depois.";
    }
    if (kmNum != null && kmNum < saida.km_saida) {
      e.km = `Menor que o km da saída (${formatarKm(saida.km_saida)}). Confira o odômetro.`;
    }
    return e;
  }, [quando, kmNum, saida.data_saida, saida.km_saida]);

  const temErro = Object.keys(erros).length > 0;
  const rodado = kmNum != null && kmNum >= saida.km_saida ? kmNum - saida.km_saida : null;

  async function salvar() {
    setTentou(true);
    if (temErro) return;
    try {
      await registrar.mutateAsync({
        id_checklist: saida.id_checklist,
        id_veiculo: saida.id_veiculo,
        data_retorno: new Date(quando).toISOString(),
        km_retorno: kmNum,
        avarias_retorno: avarias.trim() || null,
        retorno_observacao: obs.trim() || null,
      });
      onFechar();
    } catch {
      // O hook já mostrou o toast. O formulário fica na tela com o que foi
      // digitado, em vez de fechar e obrigar a redigitar tudo.
    }
  }

  return (
    <Modal
      open={aberto}
      onClose={onFechar}
      title={`Registrar retorno — ${formatarPlaca(placa)}`}
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onFechar}
            className="rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-white">
            Cancelar
          </button>
          <button type="button" onClick={salvar} disabled={registrar.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
            {registrar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
            Registrar retorno
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* O que se está fechando. Sem isto, quem abre o modal a partir do
            painel não tem como conferir se pegou a viagem certa. */}
        <div className="rounded-md bg-gray-50 px-3 py-2.5 text-sm">
          <p className="font-medium text-gray-800">{saida.condutor_nome}</p>
          <p className="text-xs text-gray-500">
            Saiu em {dataHoraBr(saida.data_saida)} com{" "}
            <span className="tabular-nums">{formatarKm(saida.km_saida)} km</span>
          </p>
          <p className="text-xs text-gray-500">{enderecoEmLinha(saida) || "sem destino registrado"}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={rotulo} htmlFor="ret_quando">
              Quando voltou <span className="text-red-500">*</span>
            </label>
            <input id="ret_quando" type="datetime-local" value={quando}
              onChange={(e) => setQuando(e.target.value)}
              className={cn(campo, tentou && erros.quando && "border-red-400")} />
            {tentou && erros.quando ? (
              <p className="mt-1 text-xs text-red-600">{erros.quando}</p>
            ) : (
              <p className="mt-1 text-xs text-gray-400">
                Vem preenchido com agora. Corrija se o carro chegou antes.
              </p>
            )}
          </div>

          <div>
            <label className={rotulo} htmlFor="ret_km">
              Km do odômetro na volta <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <input id="ret_km" inputMode="numeric" value={km}
              onChange={(e) => setKm(apenasDigitos(e.target.value))}
              placeholder={String(saida.km_saida + 100)}
              className={cn(campo, "tabular-nums", tentou && erros.km && "border-red-400")} />
            {tentou && erros.km ? (
              <p className="mt-1 text-xs text-red-600">{erros.km}</p>
            ) : rodado != null ? (
              <p className="mt-1 text-xs text-emerald-700">
                Esta viagem deu <strong className="tabular-nums">{formatarKm(rodado)} km</strong>.
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-400">
                Não sabe? Deixe em branco — a viagem fecha do mesmo jeito.
              </p>
            )}
          </div>
        </div>

        <div>
          <label className={rotulo} htmlFor="ret_avarias">
            Alguma avaria nova na volta?
          </label>
          <textarea id="ret_avarias" value={avarias} onChange={(e) => setAvarias(e.target.value)}
            rows={2} placeholder="Risco novo no para-choque traseiro. Retrovisor direito frouxo."
            className={campo} />
          {saida.avarias_constatadas?.trim() && (
            <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
              Na saída o condutor relatou: {saida.avarias_constatadas}
            </p>
          )}
        </div>

        <div>
          <label className={rotulo} htmlFor="ret_obs">Observação</label>
          <textarea id="ret_obs" value={obs} onChange={(e) => setObs(e.target.value)} rows={2}
            placeholder="Voltou com o tanque na reserva. Cliente pediu retorno na quinta."
            className={campo} />
        </div>
      </div>
    </Modal>
  );
}

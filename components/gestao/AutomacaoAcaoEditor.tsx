"use client";

import Dica from "@/components/ui/Dica";
import { DICAS_GESTAO_AUTOMACAO } from "@/lib/dicas/gestao";
import { X } from "lucide-react";
import UsuarioCombobox from "@/components/gestao/UsuarioCombobox";
import ListaSuspensaMultipla from "@/components/gestao/ListaSuspensaMultipla";
import { CAMPO_PRODUTOS_ID } from "@/lib/gestao/regiao-produtos";
import { rotuloPrimeiraEtapa } from "@/lib/gestao/automacao-descricao";
import {
  PRIORIDADES, useStatusQuadro,
  type AcaoAutomacao, type GestaoCampo, type GestaoEtiqueta, type GestaoQuadro, type GestaoStatus,
} from "@/lib/hooks/useGestao";

// Editor de UMA ação da automação (v298: a regra tem uma lista delas). Cada ramo grava só as chaves
// que o motor lê (gestao_automacao_acao); trocar o tipo zera as chaves do tipo anterior.

// 0.3.319 (pedido do João, 23/11): um tópico só, "Tarefa", com todas as ações (antes: Tarefa, Pessoas, Comunicação,
// Outros quadros e Tempo); e o tópico "Subtarefas", com as mesmas ações rodando em cada subtarefa do cartão (v367).
export const ACOES: { value: string; label: string; sub?: string }[] = [
  { value: "mover_status", label: "Mover para status" },
  { value: "concluir", label: "Concluir a tarefa", sub: "Concluir a subtarefa" },
  { value: "definir_responsavel", label: "Definir responsável" },
  { value: "definir_prioridade", label: "Definir prioridade" },
  { value: "definir_prazo", label: "Definir prazo (relativo)" },
  { value: "definir_campo", label: "Definir campo" },
  { value: "adicionar_etiqueta", label: "Adicionar etiqueta" },
  { value: "remover_etiqueta", label: "Remover etiqueta" },
  { value: "criar_subtarefas_modelo", label: "Criar subtarefas a partir de modelo" },
  { value: "criar_subtarefas_produtos", label: "Criar subtarefas a partir dos Produtos" },
  { value: "adicionar_vinculados", label: "Adicionar vinculados (responsável/seguidor)" },
  { value: "atribuir_rodizio", label: "Atribuir em rodízio / menor carga" },
  { value: "solicitar_aprovacao", label: "Solicitar aprovação" },
  { value: "notificar", label: "Notificar todos os vinculados (sino e e-mail)" },
  { value: "enviar_email", label: "Enviar e-mail" },
  { value: "comentar", label: "Comentar na tarefa", sub: "Comentar na subtarefa" },
  { value: "mover_tarefa_quadro", label: "Mover tarefa para outro quadro" },
  { value: "criar_tarefa_quadro", label: "Criar tarefa em outro quadro" },
  { value: "duplicar_tarefa", label: "Duplicar a tarefa", sub: "Duplicar a subtarefa (vira tarefa)" },
  { value: "aguardar", label: "Aguardar (o resto roda depois)" },
];

/** Ações que não fazem sentido em cada subtarefa (o motor também recusa): esperar, criar subtarefa dentro de subtarefa
 *  e mover para outro quadro (a subtarefa acompanha o quadro do cartão). */
export const FORA_DE_SUBTAREFAS = new Set(["aguardar", "criar_subtarefas_modelo", "criar_subtarefas_produtos", "mover_tarefa_quadro"]);
const ACOES_SUB = ACOES.filter((a) => !FORA_DE_SUBTAREFAS.has(a.value));
/** Valor do select: "sub:tipo" para o tópico Subtarefas. */
const PREFIXO_SUB = "sub:";

/** Destino '@unidade' (v302 = painel v313): a tarefa nova vai para o quadro da unidade dela (etiqueta da cidade). */
export const QUADRO_DA_UNIDADE = "@unidade";

const sel = "rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-marca-primary focus:outline-none";

/** Etapa no quadro destino. Os quadros de unidade têm as mesmas etapas: '@unidade' lista as do primeiro. */
function EtapaDestino({ idQuadro, value, onChange, disabled, nomeQuadro, daUnidade = false }: {
  idQuadro: string | undefined; value: string | undefined; onChange: (slug: string | undefined) => void; disabled: boolean;
  /** 11/11: a opção "sem etapa escolhida" mostra a etapa de verdade ("Empresas Novas de Guapimirim"), não "1ª etapa". */
  nomeQuadro?: string; daUnidade?: boolean;
}) {
  const { data: etapas = [] } = useStatusQuadro(idQuadro);
  if (!idQuadro) return null;
  const primeira = [...etapas].sort((a, b) => a.ordem - b.ordem)[0]?.nome;
  const rotulo = daUnidade
    ? rotuloPrimeiraEtapa("@unidade", primeira, {})
    : rotuloPrimeiraEtapa(idQuadro, primeira, { quadros: nomeQuadro ? { [idQuadro]: nomeQuadro } : {} });
  return (
    <select value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value || undefined)} className={sel}>
      <option value="">{rotulo}</option>
      {etapas.map((s) => <option key={s.slug} value={s.slug}>{s.nome}</option>)}
    </select>
  );
}

export default function AutomacaoAcaoEditor({
  acao, onChange, onTrocarTipo, statuses, campos, etiquetas, quadros, outrosQuadros, modelos, usuarios, usuariosFull, disabled,
}: {
  acao: AcaoAutomacao;
  onChange: (patch: Partial<AcaoAutomacao>) => void;
  /** alvo "subtarefas" = escolhida no tópico Subtarefas. */
  onTrocarTipo: (tipo: string, alvo?: "subtarefas") => void;
  statuses: GestaoStatus[];
  campos: GestaoCampo[];
  etiquetas: GestaoEtiqueta[];
  quadros: GestaoQuadro[];
  outrosQuadros: GestaoQuadro[];
  modelos: { slug: string; titulo: string }[];
  usuarios: string[];
  usuariosFull: { nome: string; email: string }[];
  disabled: boolean;
}) {
  const emails = acao.emails ?? [];
  const quadroDeUnidade = quadros.find((q) => q.id_unidade)?.id_quadro;
  const chipsEmails = (
    <>
      {emails.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {emails.map((em) => (
            <span key={em} className="inline-flex items-center gap-1 rounded-full bg-marca-light px-2.5 py-0.5 text-xs font-medium text-marca-primary">
              {em}
              {!disabled && (
                <button type="button" onClick={() => onChange({ emails: emails.filter((x) => x !== em) })} className="text-marca-primary/60 hover:text-red-600" aria-label={`Remover ${em}`}>
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {!disabled && (
        <div className="max-w-xs">
          <UsuarioCombobox
            usuarios={usuariosFull}
            value=""
            onChange={(email) => { if (email && !emails.includes(email)) onChange({ emails: [...emails, email] }); }}
            placeholder="Adicionar usuário…"
            className={`${sel} w-full`}
          />
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select value={acao.tipo ? `${acao.alvo === "subtarefas" ? PREFIXO_SUB : ""}${acao.tipo}` : ""} disabled={disabled}
          onChange={(e) => {
            const v = e.target.value;
            if (v.startsWith(PREFIXO_SUB)) onTrocarTipo(v.slice(PREFIXO_SUB.length), "subtarefas");
            else onTrocarTipo(v);
          }}
          className={sel}>
          <option value="">escolher ação…</option>
          <optgroup label="Tarefa">
            {ACOES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </optgroup>
          <optgroup label="Subtarefas (em cada subtarefa do cartão)">
            {ACOES_SUB.map((x) => <option key={x.value} value={`${PREFIXO_SUB}${x.value}`}>{x.sub ?? x.label}</option>)}
          </optgroup>
        </select>
        {acao.alvo === "subtarefas" && (
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-sky-200"
            title="Roda em cada subtarefa do cartão. O “só se…” desta ação é testado em cada uma (ex.: o nome da subtarefa contém PGR).">
            em cada subtarefa
          </span>
        )}

        {(acao.tipo === "mover_status") && (
          <select value={acao.valor ?? ""} disabled={disabled} onChange={(e) => onChange({ valor: e.target.value })} className={sel}>
            <option value="">status…</option>
            {statuses.map((s) => <option key={s.slug} value={s.slug}>{s.nome}</option>)}
          </select>
        )}

        {acao.tipo === "definir_responsavel" && (
          <>
            <input list="autom-usuarios" defaultValue={acao.valor ?? ""} disabled={disabled} onBlur={(e) => onChange({ valor: e.target.value.trim() })} placeholder="responsável" className={sel} />
            <datalist id="autom-usuarios">{usuarios.map((u) => <option key={u} value={u} />)}</datalist>
          </>
        )}

        {acao.tipo === "definir_prioridade" && (
          <select value={acao.valor ?? ""} disabled={disabled} onChange={(e) => onChange({ valor: e.target.value })} className={sel}>
            <option value="">prioridade…</option>
            {PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        )}

        {acao.tipo === "definir_prazo" && (
          <>
            <select value={acao.base ?? "hoje"} disabled={disabled} onChange={(e) => onChange({ base: e.target.value as AcaoAutomacao["base"] })} className={sel}>
              <option value="hoje">hoje</option>
              <option value="prazo">prazo atual</option>
              <option value="data_inicio">data de início</option>
              <option value="criacao">data de criação</option>
            </select>
            <span className="text-gray-400">+</span>
            <input type="number" defaultValue={acao.dias ?? ""} disabled={disabled} onBlur={(e) => onChange({ dias: e.target.value.trim() })} placeholder="dias" className={`${sel} w-20`} />
            <label className="inline-flex items-center gap-1 text-xs text-gray-500">
              <input type="checkbox" disabled={disabled} checked={acao.uteis === "true"} onChange={(e) => onChange({ uteis: e.target.checked ? "true" : undefined })} className="size-3.5 rounded accent-marca-primary" />
              <Dica texto={DICAS_GESTAO_AUTOMACAO.dias_uteis}>dias úteis</Dica>
            </label>
          </>
        )}

        {acao.tipo === "definir_campo" && (
          <>
            <select value={acao.campo_id ?? ""} disabled={disabled} onChange={(e) => onChange({ campo_id: e.target.value, valor: undefined })} className={sel}>
              <option value="">campo…</option>
              {campos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <input defaultValue={acao.valor ?? ""} disabled={disabled} onBlur={(e) => onChange({ valor: e.target.value.trim() })} placeholder="valor (aceita variáveis)" className={sel} />
            {campos.length === 0 && <span className="text-[11px] text-gray-400">crie um campo primeiro</span>}
          </>
        )}

        {(acao.tipo === "adicionar_etiqueta" || acao.tipo === "remover_etiqueta") && (
          <>
            <input list="autom-etiquetas" defaultValue={acao.valor ?? ""} disabled={disabled} onBlur={(e) => onChange({ valor: e.target.value.trim() })} placeholder="etiqueta" className={sel} />
            <datalist id="autom-etiquetas">{etiquetas.map((e) => <option key={e.id} value={e.nome} />)}</datalist>
          </>
        )}

        {acao.tipo === "notificar" && (
          <input defaultValue={acao.valor ?? ""} disabled={disabled} onBlur={(e) => onChange({ valor: e.target.value.trim() })} placeholder="mensagem (opcional, aceita variáveis)" className={`${sel} flex-1`} />
        )}

        {acao.tipo === "criar_subtarefas_modelo" && (
          <>
            <select value={acao.modelo_slug ?? ""} disabled={disabled} onChange={(e) => onChange({ modelo_slug: e.target.value || undefined })} className={sel}>
              <option value="">modelo…</option>
              {modelos.map((m) => <option key={m.slug} value={m.slug}>{m.titulo}</option>)}
            </select>
            {modelos.length === 0 && <span className="text-[11px] text-gray-400">crie um modelo de checklist primeiro</span>}
            {/* v315: quem fica com as subtarefas deste produto nesta unidade (é avisado ao ser alocado). */}
            <div className="min-w-[14rem]">
              <UsuarioCombobox
                usuarios={usuariosFull}
                value={acao.responsavel_email ?? ""}
                onChange={(email) => onChange({ responsavel_email: email || undefined })}
                disabled={disabled}
                incluirVazio
                vazioLabel="Sem responsável"
                placeholder="Responsável (opcional; senão, Funcionários por produto)"
                className={`${sel} w-full`}
              />
            </div>
          </>
        )}

        {acao.tipo === "criar_subtarefas_produtos" && (() => {
          // v367: uma subtarefa por valor do campo (padrão: Produtos). Só campos com lista de opções.
          const camposLista = campos.filter((c) => (c.opcoes ?? []).length > 0);
          const idCampo = acao.campo_id || CAMPO_PRODUTOS_ID;
          const campo = campos.find((c) => c.id === idCampo);
          return (
            <>
              <select value={idCampo} disabled={disabled} onChange={(e) => onChange({ campo_id: e.target.value === CAMPO_PRODUTOS_ID ? undefined : e.target.value, produtos: undefined })} className={sel}
                title="O campo cujos valores marcados viram subtarefas">
                {!campo && <option value={CAMPO_PRODUTOS_ID}>Produtos</option>}
                {camposLista.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <div className="min-w-[12rem]" title="Vazio = todos os marcados no cartão">
                <ListaSuspensaMultipla opcoes={campo?.opcoes ?? []} valor={acao.produtos ?? []} disabled={disabled}
                  onChange={(v) => onChange({ produtos: v.length ? v : undefined })} />
                <span className="text-[11px] text-gray-400">{(acao.produtos ?? []).length ? "só estes" : "todos os marcados no cartão"}</span>
              </div>
              <input defaultValue={acao.titulo_template ?? ""} disabled={disabled} onBlur={(e) => onChange({ titulo_template: e.target.value.trim() || undefined })}
                placeholder="título ({produto})" title="Nome de cada subtarefa. {produto} = o valor marcado; aceita {titulo} etc." className={`${sel} min-w-[10rem]`} />
              <div className="min-w-[14rem]">
                <UsuarioCombobox
                  usuarios={usuariosFull}
                  value={acao.responsavel_email ?? ""}
                  onChange={(email) => onChange({ responsavel_email: email || undefined })}
                  disabled={disabled}
                  incluirVazio
                  vazioLabel="Sem responsável"
                  placeholder="Responsável (opcional; senão, Funcionários por produto)"
                  className={`${sel} w-full`}
                />
              </div>
              <span className="w-full text-[11px] text-gray-400">Se o quadro tem um modelo de subtarefas com o nome do produto, cria os itens dele; senão, uma subtarefa com o título acima. Não repete subtarefa com o mesmo nome, e desmarcar um produto não apaga a subtarefa. Uma regra assim substitui as regras de checklist por produto.</span>
            </>
          );
        })()}

        {acao.tipo === "solicitar_aprovacao" && (
          <div className="min-w-[14rem]">
            <UsuarioCombobox
              usuarios={usuariosFull}
              value={acao.aprovador_email ?? ""}
              onChange={(email) => onChange({ aprovador_email: email || undefined })}
              disabled={disabled}
              incluirVazio
              vazioLabel="Qualquer gestor"
              placeholder="Aprovador (opcional)"
              className={`${sel} w-full`}
            />
          </div>
        )}

        {(acao.tipo === "mover_tarefa_quadro" || acao.tipo === "criar_tarefa_quadro") && (
          <>
            <select value={acao.id_quadro_destino ?? ""} disabled={disabled} onChange={(e) => onChange({ id_quadro_destino: e.target.value || undefined, status_destino: undefined })} className={sel}>
              <option value="">quadro destino…</option>
              {acao.tipo === "criar_tarefa_quadro" && <option value={QUADRO_DA_UNIDADE}>Quadro da unidade (etiqueta da cidade)</option>}
              {(acao.tipo === "mover_tarefa_quadro" ? outrosQuadros : quadros).map((q) => <option key={q.id_quadro} value={q.id_quadro}>{q.nome}</option>)}
            </select>
            <EtapaDestino
              idQuadro={acao.id_quadro_destino === QUADRO_DA_UNIDADE ? quadroDeUnidade : acao.id_quadro_destino}
              daUnidade={acao.id_quadro_destino === QUADRO_DA_UNIDADE}
              nomeQuadro={quadros.find((q) => q.id_quadro === acao.id_quadro_destino)?.nome}
              value={acao.status_destino}
              onChange={(slug) => onChange({ status_destino: slug })}
              disabled={disabled}
            />
          </>
        )}
        {acao.tipo === "criar_tarefa_quadro" && (
          <>
            <input defaultValue={acao.titulo_template ?? ""} disabled={disabled} onBlur={(e) => onChange({ titulo_template: e.target.value.trim() || undefined })} placeholder="título (use {titulo})" className={`${sel} min-w-[10rem]`} />
            {/* v348: etiquetas do cartão novo (ex.: o tipo do serviço), somadas às copiadas. */}
            <input
              defaultValue={(acao.etiquetas ?? []).join(", ")}
              disabled={disabled}
              onBlur={(e) => {
                const lista = [...new Set(e.target.value.split(",").map((x) => x.trim()).filter(Boolean))];
                onChange({ etiquetas: lista.length ? lista : undefined });
              }}
              placeholder="etiquetas do cartão novo (vírgula)"
              title="Etiquetas que o cartão novo recebe, além das copiadas. Ex.: Empresa nova"
              className={`${sel} min-w-[12rem]`}
            />
            <label className="inline-flex items-center gap-1 text-xs text-gray-500">
              <input type="checkbox" disabled={disabled} checked={acao.copiar_campos === "true"} onChange={(e) => onChange({ copiar_campos: e.target.checked ? "true" : undefined })} className="size-3.5 rounded accent-marca-primary" /> <Dica texto={DICAS_GESTAO_AUTOMACAO.copiar_campos}>copiar campos</Dica>
            </label>
          </>
        )}

        {acao.tipo === "duplicar_tarefa" && (
          <>
            <select value={acao.id_quadro_destino ?? ""} disabled={disabled} onChange={(e) => onChange({ id_quadro_destino: e.target.value || undefined })} className={sel}>
              <option value="">neste quadro</option>
              {outrosQuadros.map((q) => <option key={q.id_quadro} value={q.id_quadro}>{q.nome}</option>)}
            </select>
            <input defaultValue={acao.titulo_template ?? ""} disabled={disabled} onBlur={(e) => onChange({ titulo_template: e.target.value.trim() || undefined })} placeholder="título ({titulo} (cópia))" className={`${sel} min-w-[10rem]`} />
          </>
        )}

        {acao.tipo === "aguardar" && (
          <>
            <input type="number" min={1} defaultValue={acao.quantidade ?? ""} disabled={disabled} onBlur={(e) => onChange({ quantidade: e.target.value.trim() })} placeholder="quanto" className={`${sel} w-20`} />
            <select value={acao.unidade ?? "dias"} disabled={disabled} onChange={(e) => onChange({ unidade: e.target.value as "horas" | "dias" })} className={sel}>
              <option value="dias">dias</option>
              <option value="horas">horas</option>
            </select>
            <span className="text-[11px] text-gray-400">as ações seguintes rodam depois; use o “só se…” nelas (ex.: se ainda não concluída)</span>
          </>
        )}

        {acao.tipo === "enviar_email" && (
          <select value={acao.para ?? ""} disabled={disabled} onChange={(e) => onChange({ para: e.target.value as AcaoAutomacao["para"] })} className={sel}>
            <option value="">só os endereços abaixo</option>
            <option value="responsaveis">responsáveis da tarefa</option>
            <option value="vinculados">todos os vinculados</option>
          </select>
        )}
      </div>

      {acao.tipo === "comentar" && (
        <textarea defaultValue={acao.texto ?? ""} disabled={disabled} onBlur={(e) => onChange({ texto: e.target.value })} rows={2}
          placeholder="Texto do comentário — ex.: {responsavel}, revise até {prazo}." className={`${sel} w-full`} />
      )}

      {acao.tipo === "enviar_email" && (
        <div className="space-y-1.5 rounded-md border border-gray-100 bg-gray-50/60 p-2">
          <input defaultValue={acao.assunto ?? ""} disabled={disabled} onBlur={(e) => onChange({ assunto: e.target.value.trim() })} placeholder="Assunto — ex.: Revisar {titulo}" className={`${sel} w-full`} />
          <textarea defaultValue={acao.mensagem ?? ""} disabled={disabled} onBlur={(e) => onChange({ mensagem: e.target.value })} rows={3}
            placeholder="Mensagem (opcional) — o e-mail já leva a tarefa, o quadro, o prazo e o botão para abrir." className={`${sel} w-full`} />
          <p className="text-[11px] font-semibold uppercase text-gray-400"><Dica texto={DICAS_GESTAO_AUTOMACAO.tambem_enviar}>Também enviar para</Dica></p>
          {chipsEmails}
        </div>
      )}

      {acao.tipo === "atribuir_rodizio" && (
        <div className="space-y-1.5 rounded-md border border-gray-100 bg-gray-50/60 p-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <select value={acao.modo ?? "rodizio"} disabled={disabled} onChange={(e) => onChange({ modo: e.target.value as "rodizio" | "menor_carga" })} className={sel}>
              <option value="rodizio">rodízio (um de cada vez, na ordem)</option>
              <option value="menor_carga">quem tem menos tarefas abertas</option>
            </select>
            <label className="inline-flex items-center gap-1 text-xs text-gray-500">
              <input type="checkbox" disabled={disabled} checked={acao.substituir === "true"} onChange={(e) => onChange({ substituir: e.target.checked ? "true" : undefined })} className="size-3.5 rounded accent-marca-primary" />
              <Dica texto={DICAS_GESTAO_AUTOMACAO.substituir}>substituir os responsáveis atuais</Dica>
            </label>
          </div>
          <p className="text-[11px] font-semibold uppercase text-gray-400"><Dica texto={DICAS_GESTAO_AUTOMACAO.rodizio}>Pessoas (na ordem do rodízio)</Dica></p>
          {chipsEmails}
        </div>
      )}

      {acao.tipo === "criar_tarefa_quadro" && (
        <div className="space-y-1.5 rounded-md border border-gray-100 bg-gray-50/60 p-2 text-sm">
          <span className="text-[11px] font-semibold uppercase text-gray-400"><Dica texto={DICAS_GESTAO_AUTOMACAO.resp_tarefa_nova}>Responsáveis da tarefa nova (opcional)</Dica></span>
          {chipsEmails}
        </div>
      )}

      {acao.tipo === "adicionar_vinculados" && (
        <div className="space-y-1.5 rounded-md border border-gray-100 bg-gray-50/60 p-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase text-gray-400"><Dica texto={DICAS_GESTAO_AUTOMACAO.vincular_como}>Vincular como</Dica></span>
            <select value={acao.vinculo_tipo ?? "seguidor"} disabled={disabled} onChange={(e) => onChange({ vinculo_tipo: e.target.value })} className={sel}>
              <option value="seguidor">Seguidor</option>
              <option value="responsavel">Responsável</option>
            </select>
          </div>
          {chipsEmails}
        </div>
      )}
    </div>
  );
}

"use client";

import { X } from "lucide-react";
import UsuarioCombobox from "@/components/gestao/UsuarioCombobox";
import {
  PRIORIDADES,
  type AcaoAutomacao, type GestaoCampo, type GestaoEtiqueta, type GestaoQuadro, type GestaoStatus,
} from "@/lib/hooks/useGestao";

// Editor de UMA ação da automação (v298: a regra tem uma lista delas). Cada ramo grava só as chaves
// que o motor lê (gestao_automacao_acao); trocar o tipo zera as chaves do tipo anterior.

export const ACOES: { value: string; label: string; grupo: string }[] = [
  { value: "mover_status", label: "Mover para status", grupo: "Tarefa" },
  { value: "concluir", label: "Concluir a tarefa", grupo: "Tarefa" },
  { value: "definir_responsavel", label: "Definir responsável", grupo: "Tarefa" },
  { value: "definir_prioridade", label: "Definir prioridade", grupo: "Tarefa" },
  { value: "definir_prazo", label: "Definir prazo (relativo)", grupo: "Tarefa" },
  { value: "definir_campo", label: "Definir campo", grupo: "Tarefa" },
  { value: "adicionar_etiqueta", label: "Adicionar etiqueta", grupo: "Tarefa" },
  { value: "remover_etiqueta", label: "Remover etiqueta", grupo: "Tarefa" },
  { value: "criar_subtarefas_modelo", label: "Criar subtarefas a partir de modelo", grupo: "Tarefa" },
  { value: "adicionar_vinculados", label: "Adicionar vinculados (responsável/seguidor)", grupo: "Pessoas" },
  { value: "solicitar_aprovacao", label: "Solicitar aprovação", grupo: "Pessoas" },
  { value: "notificar", label: "Notificar todos os vinculados (sino)", grupo: "Comunicação" },
  { value: "enviar_email", label: "Enviar e-mail", grupo: "Comunicação" },
  { value: "comentar", label: "Comentar na tarefa", grupo: "Comunicação" },
  { value: "mover_tarefa_quadro", label: "Mover tarefa para outro quadro", grupo: "Outros quadros" },
  { value: "criar_tarefa_quadro", label: "Criar tarefa em outro quadro", grupo: "Outros quadros" },
  { value: "duplicar_tarefa", label: "Duplicar a tarefa", grupo: "Outros quadros" },
];

const GRUPOS = [...new Set(ACOES.map((a) => a.grupo))];

const sel = "rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none";

export default function AutomacaoAcaoEditor({
  acao, onChange, onTrocarTipo, statuses, campos, etiquetas, quadros, outrosQuadros, modelos, usuarios, usuariosFull, disabled,
}: {
  acao: AcaoAutomacao;
  onChange: (patch: Partial<AcaoAutomacao>) => void;
  onTrocarTipo: (tipo: string) => void;
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
  const chipsEmails = (
    <>
      {emails.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {emails.map((em) => (
            <span key={em} className="inline-flex items-center gap-1 rounded-full bg-verde-light px-2.5 py-0.5 text-xs font-medium text-verde-primary">
              {em}
              {!disabled && (
                <button type="button" onClick={() => onChange({ emails: emails.filter((x) => x !== em) })} className="text-verde-primary/60 hover:text-red-600" aria-label={`Remover ${em}`}>
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
        <select value={acao.tipo ?? ""} disabled={disabled} onChange={(e) => onTrocarTipo(e.target.value)} className={sel}>
          <option value="">escolher ação…</option>
          {GRUPOS.map((g) => (
            <optgroup key={g} label={g}>
              {ACOES.filter((x) => x.grupo === g).map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </optgroup>
          ))}
        </select>

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
              <input type="checkbox" disabled={disabled} checked={acao.uteis === "true"} onChange={(e) => onChange({ uteis: e.target.checked ? "true" : undefined })} className="size-3.5 rounded accent-verde-primary" />
              dias úteis
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
          </>
        )}

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
          <select value={acao.id_quadro_destino ?? ""} disabled={disabled} onChange={(e) => onChange({ id_quadro_destino: e.target.value || undefined })} className={sel}>
            <option value="">quadro destino…</option>
            {(acao.tipo === "mover_tarefa_quadro" ? outrosQuadros : quadros).map((q) => <option key={q.id_quadro} value={q.id_quadro}>{q.nome}</option>)}
          </select>
        )}
        {acao.tipo === "mover_tarefa_quadro" && (
          <input defaultValue={acao.status_destino ?? ""} disabled={disabled} onBlur={(e) => onChange({ status_destino: e.target.value.trim() || undefined })} placeholder="status destino (slug, opcional)" className={sel} />
        )}
        {acao.tipo === "criar_tarefa_quadro" && (
          <>
            <input defaultValue={acao.titulo_template ?? ""} disabled={disabled} onBlur={(e) => onChange({ titulo_template: e.target.value.trim() || undefined })} placeholder="título (use {titulo})" className={`${sel} min-w-[10rem]`} />
            <label className="inline-flex items-center gap-1 text-xs text-gray-500">
              <input type="checkbox" disabled={disabled} checked={acao.copiar_campos === "true"} onChange={(e) => onChange({ copiar_campos: e.target.checked ? "true" : undefined })} className="size-3.5 rounded accent-verde-primary" /> copiar campos
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
          <p className="text-[11px] font-semibold uppercase text-gray-400">Também enviar para</p>
          {chipsEmails}
        </div>
      )}

      {acao.tipo === "adicionar_vinculados" && (
        <div className="space-y-1.5 rounded-md border border-gray-100 bg-gray-50/60 p-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase text-gray-400">Vincular como</span>
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

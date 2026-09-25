"""Monta o MD completo do sistema e envia por e-mail (roda no GitHub Actions).

Chamado por .github/workflows/documentacao-email.yml a cada atualização que
entra na main (e pelo botão "Run workflow"). Junta:

  1. docs/SISTEMA-COMPLETO.md  — a especificação escrita (módulos, regras…)
  2. o que mudou nesta atualização (git log do push)
  3. telas e rotas de API encontradas no código agora
  4. migrations em supabase/historico
  5. docs/SISTEMA-BANCO.md     — estrutura do banco

e manda como anexo para os endereços do segredo EMAIL_DESTINOS, pelo Gmail
(GMAIL_USER + GMAIL_APP_PASSWORD, uma "senha de app" do Google). Sem os
segredos, só gera o arquivo (fica como artefato do workflow) e avisa.

Só biblioteca padrão do Python: nada de dependência de terceiros no CI.
"""

from __future__ import annotations

import os
import re
import smtplib
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from email.message import EmailMessage
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
BRT = timezone(timedelta(hours=-3))


def git(*args: str) -> str:
    r = subprocess.run(["git", *args], cwd=RAIZ, capture_output=True, text=True)
    return r.stdout.strip()


def rotas(pasta: str, arquivo: str) -> list[str]:
    """app/(grupo)/a/[id]/page.tsx -> /a/[id] (grupos entre parênteses somem)."""
    out = set()
    for p in (RAIZ / "app").rglob(arquivo):
        partes = [x for x in p.relative_to(RAIZ / "app").parts[:-1] if not (x.startswith("(") and x.endswith(")"))]
        caminho = "/" + "/".join(partes)
        if caminho.startswith(pasta):
            out.add(caminho)
    return sorted(out)


def mudancas() -> str:
    """Commits do push (antes..depois); no botão manual, os 15 últimos."""
    antes, depois = os.environ.get("ANTES", ""), os.environ.get("DEPOIS", "")
    faixa = f"{antes}..{depois}" if antes and set(antes) != {"0"} and depois else "-15"
    log = git("log", "--no-merges", "--pretty=format:- %h %ad — %s", "--date=format:%d/%m/%Y %H:%M", faixa)
    return log or "- (sem commits novos identificados)"


def montar() -> tuple[str, str]:
    agora = datetime.now(BRT)
    commit = git("rev-parse", "--short", "HEAD")
    spec = (RAIZ / "docs/SISTEMA-COMPLETO.md").read_text(encoding="utf-8")
    banco = (RAIZ / "docs/SISTEMA-BANCO.md").read_text(encoding="utf-8")
    telas = rotas("/", "page.tsx")
    apis = [r for r in rotas("/api", "route.ts")]
    migr = sorted(
        (p.name for p in (RAIZ / "supabase/historico").glob("v*.sql")),
        key=lambda n: [int(x) if x.isdigit() else x for x in re.split(r"(\d+)", n)],
    )
    o_que_mudou = mudancas()

    partes = [
        spec.rstrip(),
        "",
        "---",
        "",
        f"# Anexo A — Esta atualização ({agora:%d/%m/%Y %H:%M}, commit `{commit}`)",
        "",
        o_que_mudou,
        "",
        f"# Anexo B — Telas do sistema ({len(telas)})",
        "",
        "Gerado do código (`app/**/page.tsx`). Grupos de rota `(nome)` não aparecem na URL.",
        "",
        *[f"- `{t}`" for t in telas],
        "",
        f"# Anexo C — Rotas de API ({len(apis)})",
        "",
        *[f"- `{a}`" for a in apis],
        "",
        f"# Anexo D — Migrations aplicadas ({len(migr)})",
        "",
        "Arquivos em `supabase/historico/` (todas já aplicadas no banco). Rollbacks em `scripts/sql/`.",
        "",
        *[f"- `{m}`" for m in migr],
        "",
        "---",
        "",
        banco.rstrip(),
        "",
    ]
    return "\n".join(partes), o_que_mudou


def enviar(md: str, nome: str, o_que_mudou: str) -> None:
    usuario = os.environ.get("GMAIL_USER", "").strip()
    senha = os.environ.get("GMAIL_APP_PASSWORD", "").strip().replace(" ", "")
    destinos = [d.strip() for d in re.split(r"[,;\s]+", os.environ.get("EMAIL_DESTINOS", "")) if d.strip()]
    if not (usuario and senha and destinos):
        print("::warning::Segredos GMAIL_USER / GMAIL_APP_PASSWORD / EMAIL_DESTINOS ausentes — MD gerado, e-mail NÃO enviado.")
        return

    msg = EmailMessage()
    msg["Subject"] = f"[Painel SST JCN] Documentação completa do sistema — {datetime.now(BRT):%d/%m/%Y %H:%M}"
    msg["From"] = usuario
    msg["To"] = ", ".join(destinos)
    msg.set_content(
        "Olá,\n\n"
        "Segue em anexo o MD completo do Painel SST (JCN Consultoria), atualizado com a última versão do sistema.\n"
        "Ele descreve módulos, telas, regras de negócio, banco de dados e integrações — o suficiente para "
        "recriar o programa. O código-fonte está no GitHub (joaojcnunes-debug/SST-JCN).\n\n"
        "O que mudou nesta atualização:\n"
        f"{o_que_mudou}\n\n"
        "— Envio automático (GitHub Actions)\n"
    )
    msg.add_attachment(md.encode("utf-8"), maintype="text", subtype="markdown", filename=nome)

    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=60) as smtp:
        smtp.login(usuario, senha)
        smtp.send_message(msg)
    print(f"E-mail enviado para {len(destinos)} destinatário(s).")


def main() -> int:
    md, o_que_mudou = montar()
    nome = f"SISTEMA-JCN-COMPLETO-{datetime.now(BRT):%Y-%m-%d-%H%M}.md"
    saida = RAIZ / "dist-docs"
    saida.mkdir(exist_ok=True)
    (saida / nome).write_text(md, encoding="utf-8")
    print(f"MD gerado: dist-docs/{nome} ({len(md.encode('utf-8')) // 1024} KB)")
    enviar(md, nome, o_que_mudou)
    return 0


if __name__ == "__main__":
    sys.exit(main())

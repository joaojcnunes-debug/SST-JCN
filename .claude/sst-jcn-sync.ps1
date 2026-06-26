$ErrorActionPreference = 'SilentlyContinue'
$proj = 'C:\Users\PC\painel-sst'

# Commits das ultimas 4 horas
$log = git -C $proj log --oneline --since='4 hours ago' 2>$null
if (-not $log) { exit 0 }

$pkg     = Get-Content "$proj\package.json" -Raw | ConvertFrom-Json
$version = $pkg.version
$n       = ($log | Measure-Object -Line).Lines
$commits = ($log | ForEach-Object { "  $_" }) -join "`n"

# Arquivos alterados nos commits recentes
$files   = git -C $proj diff "HEAD~$n" HEAD --name-only 2>$null
$hasMig  = $null -ne ($files | Where-Object { $_ -match 'migration' })
$hasEdge = $null -ne ($files | Where-Object { $_ -match 'supabase/functions' })

$acoes = [System.Collections.Generic.List[string]]::new()
if ($hasMig)  { $acoes.Add("  - Migrations:      npx --prefix C:\Users\PC\painel-sst supabase db push --project-ref ieesssxgjzywrtiqdvmz") }
if ($hasEdge) { $acoes.Add("  - Edge Functions:  npx --prefix C:\Users\PC\painel-sst supabase functions deploy --project-ref ieesssxgjzywrtiqdvmz") }
$acoes.Add("  - Codigo Next.js:  ja sincronizado via git dual-push")

$acoesStr = $acoes -join "`n"

$msg = "SST-JCN SYNC -- Painel SST v$version ($n commit(s))`n$commits`n`nAcoes SST-JCN (Supabase: ieesssxgjzywrtiqdvmz):`n$acoesStr`n`n--- PROMPT PARA COLAR NO PROJETO SST-JCN ---`nO Painel SST foi atualizado para v$version. Sincronize o SST-JCN:`n$acoesStr"

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
@{ systemMessage = $msg } | ConvertTo-Json -Compress

# EpiBiometricAgent — instalação do companion de biometria

Serviço local que **captura e COMPARA** digitais (verificação 1:1) para o módulo de
EPI. Roda em `http://127.0.0.1:52182` e o site (https) fala com ele por CORS +
Private Network Access. Usa o **DigitalPersona U.are.U RTE** que o **SGG** já instala
— não precisa do cliente da HID nem de conexão com a internet.

## Requisitos
- Windows.
- **DigitalPersona U.are.U RTE** instalado (vem com o SGG). Fornece `dpfpdd.dll`/`dpfj.dll`
  (System32) e `DPUruNet.dll`.
- Leitor **U.are.U 4500** conectado.

## Arquivos
- `EpiBiometricAgent.exe` (compilado do `native/EpiBiometricAgent/`).
- `DPUruNet.dll` (do RTE, distribuído junto).

## Instalação (por PC, sem admin)
1. Copie `EpiBiometricAgent.exe` + `DPUruNet.dll` para
   `%LOCALAPPDATA%\EpiBiometricAgent\`.
2. Crie `start-hidden.vbs` na mesma pasta (roda o exe oculto):
   ```vbs
   CreateObject("WScript.Shell").Run """%LOCALAPPDATA%\EpiBiometricAgent\EpiBiometricAgent.exe""", 0, False
   ```
   (troque `%LOCALAPPDATA%` pelo caminho real).
3. Crie um atalho na pasta **Inicializar** (`shell:startup`) apontando para
   `wscript.exe "…\start-hidden.vbs"` — assim sobe sozinho no logon, oculto.
4. Rode uma vez (ou reinicie a sessão) e teste: abra `http://127.0.0.1:52182/status`
   → deve retornar `{"ok":true,"count":1}`.

> Um script PowerShell que faz os passos 1–3 automaticamente está no histórico do
> projeto (a mesma sequência usada no PC do balcão principal).

## Configuração
- **Porta:** 52182 (fixa).
- **Rigor do match (FAR):** variável de ambiente `EPI_FAR` (padrão `100000` = FAR 1:100000).
  Maior = mais rígido (mais falsos-rejeitos); menor = mais tolerante.

## Como funciona no fluxo
- **Cadastro:** no cadastro do colaborador, "Cadastrar digital" chama `POST /capturar`
  → template (FMD serializado) salvo no banco (sob RLS; consentimento registrado).
- **Assinatura:** ao assinar a ficha, se o colaborador tem template, o site chama
  `POST /verificar` com o template → o agente captura e compara (`Comparison.Compare`,
  limiar FAR) → só assina com **match**. A digital da assinatura é **descartada**
  (só o hash fica como evidência).

## Segurança / LGPD
- O agente **não persiste** nada em disco (nem captura, nem template).
- O template do colaborador trafega **DB → navegador → agente (localhost)** só para a
  comparação; em repouso fica no banco sob RLS + criptografia de disco do Supabase.
- É um *template* de minúcias (não a imagem da digital).

## Verificação / diagnóstico
- `GET http://127.0.0.1:52182/status` → `{ ok, count }`.
- Se o botão "Digital"/"Verificar" ficar off no site: confira se o agente está rodando
  (Gerenciador de Tarefas → `EpiBiometricAgent.exe`) e se o leitor aparece no `/status`.
- Erro `net::ERR_...`/PNA no console do Chrome: pode exigir habilitar o acesso a rede
  privada para o site, ou servir o agente em https local (evolução).

## Desinstalar
- Apague a pasta `%LOCALAPPDATA%\EpiBiometricAgent\` e o atalho em `shell:startup`.

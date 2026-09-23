# EpiFingerprint — helper nativo de biometria (EPI)

Helper de linha de comando que o app **desktop (Electron)** chama para **cadastrar** (enroll) e
**verificar** (1:1) a digital do colaborador na assinatura da ficha de EPI. O match roda **aqui**
(nativo, DigitalPersona); o servidor só guarda o template **cifrado** e registra o resultado.

## Pré-requisitos (na máquina do dev / de produção)
1. **Leitor** DigitalPersona U.are.U (ex.: 4500) + **RTE/SDK** instalado.
2. **DPUruNet.dll** (do SDK .NET da DigitalPersona) referenciado no projeto.
3. .NET Framework compatível com o SDK (tipicamente 4.x).

## Compilar
Crie um projeto Console (`EpiFingerprint.csproj`, output `EpiFingerprint.exe`), referencie o
`DPUruNet.dll`, adicione `EpiFingerprint.cs` e compile em **x86 ou x64 conforme o DLL** do SDK.
Copie o `EpiFingerprint.exe` **e o `DPUruNet.dll`** (e DLLs nativas do RTE, se exigidas) para esta
pasta `native/EpiFingerprint/` antes do `electron:build`.

## Contrato (o Electron usa via `electron/services/epiFingerprint.ts`)
- `EpiFingerprint.exe check` → `{"ok":true,"disponivel":true|false}`
- `EpiFingerprint.exe enroll` → `{"ok":true,"template":"<base64>","qualidade":N}` | `{"ok":false,"erro":"…"}`
- `EpiFingerprint.exe verify` (template base64 via **stdin**) → `{"ok":true,"match":true|false,"score":N}`

## Ajustes que o dev PRECISA validar
- **API do SDK**: confira as assinaturas (`ReaderCollection`, `Reader.Capture`, `FeatureExtraction.CreateFmdFromFid`, `Importer.ImportFmd`, `Comparison.Compare`) contra a versão instalada.
- **THRESHOLD** (`MATCH_THRESHOLD`): score de dissimilaridade — MENOR = mais parecido. Calibre por testes (FAR/FRR) com dedos reais.
- **DP_PRIORITY_EXCLUSIVE**: obrigatório — no modo cooperativo o DpHost do SGG segura o leitor e a captura dá timeout.

## Empacotamento
`electron-builder.yml` inclui esta pasta em `extraResources` → em produção o exe fica em
`resources/native/EpiFingerprint/EpiFingerprint.exe` (fora do asar), que é o caminho usado pelo serviço.

## Banco (uma vez, no .107)
A cifra do template usa a chave `app.epi_bio_key`:
```sql
ALTER DATABASE painel_sst SET app.epi_bio_key = '<segredo-forte-aleatorio>';
```
Sem essa chave, o cadastro de biometria é bloqueado com erro claro.

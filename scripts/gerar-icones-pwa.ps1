# Gera os ícones estáticos do PWA em public/.
#
# Por que estático e não o /icon dinâmico: o `app/icon.tsx` renderiza no Edge a
# cada pedido e depende de rede (lê `configuracoes.logo_url`). Ícone de app
# instalado precisa existir em disco — o Android busca no momento da instalação
# e o celular do técnico pode estar sem sinal.
#
# Rode a partir da raiz do repo:  powershell -File scripts\gerar-icones-pwa.ps1
#
# Trocar pela logo real da Chabra depois é só substituir os PNGs em public/ —
# o manifest aponta para os nomes, não para este script.

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"
$destino = Join-Path (Split-Path -Parent $PSScriptRoot) "public"
if (-not (Test-Path $destino)) { throw "Pasta public/ não encontrada em $destino" }

# Verde Chabra — o mesmo do fallback de app/icon.tsx.
$VERDE = "#006B54"

function New-Icone {
    param(
        [int]$Tamanho,
        [string]$Arquivo,
        # 0 = full bleed (maskable e iOS, que aplicam a própria máscara).
        [double]$RaioPct = 0,
        [double]$AlturaGlifoPct = 0.52
    )

    $bmp = New-Object System.Drawing.Bitmap($Tamanho, $Tamanho, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    $fundo = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($VERDE))

    if ($RaioPct -gt 0) {
        $d = [int]($Tamanho * $RaioPct * 2)
        $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
        $gp.AddArc(0, 0, $d, $d, 180, 90)
        $gp.AddArc($Tamanho - $d, 0, $d, $d, 270, 90)
        $gp.AddArc($Tamanho - $d, $Tamanho - $d, $d, $d, 0, 90)
        $gp.AddArc(0, $Tamanho - $d, $d, $d, 90, 90)
        $gp.CloseFigure()
        $g.FillPath($fundo, $gp)
        $gp.Dispose()
    } else {
        $g.FillRectangle($fundo, 0, 0, $Tamanho, $Tamanho)
    }

    # O "C" como PATH, não como texto desenhado: assim dá para medir a caixa real
    # do glifo e centrar OPTICAMENTE. Centrar pela caixa da fonte deixaria a letra
    # visivelmente alta, porque o espaço do descendente entra na conta.
    $familia = New-Object System.Drawing.FontFamily("Segoe UI")
    $letra = New-Object System.Drawing.Drawing2D.GraphicsPath
    $letra.AddString(
        "C", $familia, [int][System.Drawing.FontStyle]::Bold, 200,
        (New-Object System.Drawing.PointF(0, 0)),
        [System.Drawing.StringFormat]::GenericTypographic
    )

    $caixa = $letra.GetBounds()
    $escala = ($Tamanho * $AlturaGlifoPct) / $caixa.Height
    $m = New-Object System.Drawing.Drawing2D.Matrix
    $m.Scale($escala, $escala)
    $letra.Transform($m)

    $caixa2 = $letra.GetBounds()
    $m2 = New-Object System.Drawing.Drawing2D.Matrix
    $m2.Translate((($Tamanho - $caixa2.Width) / 2) - $caixa2.X, (($Tamanho - $caixa2.Height) / 2) - $caixa2.Y)
    $letra.Transform($m2)

    $branco = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.FillPath($branco, $letra)

    $caminho = Join-Path $destino $Arquivo
    $bmp.Save($caminho, [System.Drawing.Imaging.ImageFormat]::Png)

    $letra.Dispose(); $branco.Dispose(); $fundo.Dispose(); $g.Dispose(); $bmp.Dispose()
    "  $Arquivo  ($Tamanho x $Tamanho)"
}

"Gerando ícones do PWA em $destino"

# "any": forma própria, cantos arredondados como o favicon atual.
New-Icone -Tamanho 192 -Arquivo "icon-192.png" -RaioPct 0.1875 -AlturaGlifoPct 0.52
New-Icone -Tamanho 512 -Arquivo "icon-512.png" -RaioPct 0.1875 -AlturaGlifoPct 0.52

# "maskable": full bleed e glifo menor. O Android recorta em círculo, losango ou
# squircle conforme o launcher — o que passar de ~80% do canvas pode ser cortado.
New-Icone -Tamanho 512 -Arquivo "icon-maskable-512.png" -RaioPct 0 -AlturaGlifoPct 0.42

# iOS ignora o manifest para o ícone e usa esta tag; ele mesmo arredonda.
New-Icone -Tamanho 180 -Arquivo "apple-touch-icon.png" -RaioPct 0 -AlturaGlifoPct 0.52

"Pronto."

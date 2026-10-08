#!/usr/bin/env bash
# Instala as ferramentas do pipeline de treinamento fora do projeto (C:/Users/Usuario/ferramentas).
# Idempotente: pode rodar de novo. Ver docs/treinamento-pipeline.md (Ferramentas).
set -e
F=/c/Users/Usuario/ferramentas
mkdir -p "$F" && cd "$F"
[ -d edge-tts ] || git clone https://github.com/rany2/edge-tts.git
git -C edge-tts pull --ff-only || true
[ -d treinamento-venv ] || python -m venv treinamento-venv
PY="$F/treinamento-venv/Scripts/python.exe"
"$PY" -m pip install -q --upgrade pip
"$PY" -m pip install -q -e ./edge-tts numpy pillow imageio-ffmpeg
mkdir -p pw && cd pw
[ -f package.json ] || npm init -y > /dev/null
[ -d node_modules/playwright-core ] || npm i -s playwright-core@1.63.0
"$PY" -c "import edge_tts, imageio_ffmpeg; print('edge-tts', edge_tts.__version__); print('ffmpeg', imageio_ffmpeg.get_ffmpeg_exe())"
"$PY" -m edge_tts --list-voices | grep pt-BR

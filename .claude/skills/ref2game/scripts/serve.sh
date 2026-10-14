#!/usr/bin/env bash
# serve.sh [port] — serve the project root over http for the live preview (WebGL can't load file:// images).
# Picks the first free port from 8930 up (or the given one) and prints the live URL. Run it in the background.
P="${1:-8930}"
# [gamelab/Windows] lsof у Windows нема — перевіряємо, чи порт зайнятий, спробою підключитись через Python
port_busy() { python -c "import socket,sys; s=socket.socket(); s.settimeout(0.3); sys.exit(0 if s.connect_ex(('127.0.0.1', int(sys.argv[1]))) == 0 else 1)" "$1"; }
while port_busy "$P"; do P=$((P+1)); done
echo "LIVE: http://127.0.0.1:$P/live/index.html"
exec python -m http.server "$P" --bind 127.0.0.1

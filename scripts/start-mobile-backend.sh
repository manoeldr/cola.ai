#!/bin/zsh
set -eu
cola_root="$(cd "$(dirname "$0")/.." && pwd)"
cola_ip="$(ipconfig getifaddr en0 2>/dev/null || true)"
if [[ -z "$cola_ip" ]]; then cola_ip="$(ipconfig getifaddr en1 2>/dev/null || true)"; fi
if [[ -z "$cola_ip" ]]; then
  print 'Não encontrei o IPv4 do Wi-Fi. Conecte o Mac à rede e tente novamente.'
  exit 1
fi
export MobileApi__Enabled=true
export MobileApi__Host="$cola_ip"
print "Abra http://127.0.0.1:${LocalServer__Port:-5180}/mobile-setup no Mac para ver o endereço e o código do iPhone."
cd "$cola_root/src"
exec dotnet run --no-launch-profile --project ColaAI.Web/ColaAI.Web.csproj

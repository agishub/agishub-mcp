#!/usr/bin/env bash
# Repone en el worker `agishub` los secretos que el renombrado dejó en
# `timezone-toolkit`. Los valores NO se pueden copiar entre workers: Cloudflare
# los guarda de solo escritura y no los devuelve por ninguna vía. Hay que
# obtenerlos de cada proveedor y volver a escribirlos aquí.
#
# El valor se teclea a mano y no se muestra ni queda en el historial del shell.
# Uso:  bash scripts/migrar-secretos.sh
set -uo pipefail

WORKER=agishub

poner() {
  local nombre=$1 donde=$2
  echo
  echo "── $nombre"
  echo "   $donde"
  printf '   valor (Enter vacío = saltar): '
  local valor
  read -rs valor
  echo
  if [ -z "$valor" ]; then
    echo "   saltado"
    return
  fi
  if printf '%s' "$valor" | npx wrangler secret put "$nombre" --name "$WORKER" >/dev/null 2>&1; then
    echo "   ✓ escrito en $WORKER"
  else
    echo "   ✗ falló — reintenta con: npx wrangler secret put $nombre --name $WORKER"
  fi
}

echo "Reponiendo secretos en el worker '$WORKER'."
echo "Los valores antiguos viven solo dentro de timezone-toolkit y no son legibles."

# Orden deliberado: primero lo que afecta al cobro.
poner CDP_API_KEY_ID     "portal.cdp.coinbase.com → API Keys → Create. Devuelve x402 a Coinbase CDP."
poner CDP_API_KEY_SECRET "El secret del mismo par. Solo se muestra al crearlo."
poner ALCHEMY_KEY        "dashboard.alchemy.com → app de Base Mainnet → View Key. Esta SÍ se puede leer, no hace falta regenerarla."
poner GITHUB_TOKEN       "github.com → Settings → Developer settings → Personal access tokens. Necesita escritura en Discussions de agishub/agishub-mcp."
poner CF_API_TOKEN       "dash.cloudflare.com → My Profile → API Tokens → Create. Permiso: Account · Account Analytics · Read."
poner ANTHROPIC_API_KEY  "console.anthropic.com → API Keys → Create. Solo lo usa el test de agente de la consola."
poner PAYER_PRIVATE_KEY  "Clave de la wallet pagadora. No se regenera: solo si tienes copia o frase semilla."

# Este no es secreto y ya lo conocemos.
echo
echo "── CF_ACCOUNT_ID"
printf '4937dbd20181becf613f34959d83f0cf' | npx wrangler secret put CF_ACCOUNT_ID --name "$WORKER" >/dev/null 2>&1 \
  && echo "   ✓ escrito (valor conocido, no es secreto)" \
  || echo "   ✗ falló"

echo
echo "Hecho. Comprueba con:  npx wrangler secret list --name $WORKER"
echo "Después despliega para que el worker los tome:  npx wrangler deploy"

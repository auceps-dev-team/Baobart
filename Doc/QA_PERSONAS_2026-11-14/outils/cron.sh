#!/bin/sh
# Joue le rôle de l'ordonnanceur : appelle une tâche planifiée avec son secret,
# lu dans le .env de la copie de travail et jamais affiché.
#   sh Doc/QA_PERSONAS_2026-11-14/outils/cron.sh courriels
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)" || exit 1
secret=$(grep '^CRON_SECRET=' .env | cut -d= -f2- | tr -d '"\r')
if [ -z "$secret" ]; then
  echo "CRON_SECRET est vide dans .env : les tâches planifiées répondront « Not found »." >&2
  exit 1
fi
curl -s --max-time 90 -H "Authorization: Bearer $secret" "http://127.0.0.1:${QA_PORT:-3400}/api/cron/$1"
echo

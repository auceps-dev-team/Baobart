#!/bin/sh
# sh qa/etape.sh : appelle les tâches planifiées dans l'ordre d'une nuit, et dit ce que chacune a répondu.
cd "$(git rev-parse --show-toplevel)"
for t in commandes versements abonnements merites blog avis courriels; do printf '%-12s ' "$t"; sh qa/cron.sh "$t" | cut -c1-420; echo; done

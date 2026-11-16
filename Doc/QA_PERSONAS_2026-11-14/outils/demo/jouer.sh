#!/bin/sh
# Joue les quatre scènes de la régie EN MÊME TEMPS, une par persona.
#   sh qa/demo/jouer.sh        (les mots de passe sont lus dans qa/demo/.comptes, jamais dans les scènes)
cd "$(git rev-parse --show-toplevel)"
. qa/demo/.comptes
for qui in awa yao serge fatou; do
  cat qa/demo/commun.js "qa/demo/$qui.js" \
    | sed -e "s|__AWA_COURRIEL__|$AWA_COURRIEL|; s|__AWA_MDP__|$AWA_MDP|; s|__SERGE_COURRIEL__|$SERGE_COURRIEL|; s|__SERGE_MDP__|$SERGE_MDP|; s|__FATOU_COURRIEL__|$FATOU_COURRIEL|; s|__FATOU_MDP__|$FATOU_MDP|" \
    | node qa/c.mjs "$qui" "demo-$qui" texte=0 | sed "s/^/[$qui] /" | grep -v "capture" &
done
wait

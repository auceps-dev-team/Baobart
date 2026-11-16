#!/bin/sh
# sh qa/lire.sh <persona> "[['/chemin','Motif de début',longueur], …]"
cd "$(git rev-parse --show-toplevel)" && sed "s#__ECRANS__#$2#" qa/lire.js | node qa/c.mjs "$1" lire texte=0 | grep -v "^capture\|^\[" 

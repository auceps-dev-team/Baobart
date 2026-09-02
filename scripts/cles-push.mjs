#!/usr/bin/env node
/*
 * Tirer une paire de clés VAPID.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ON NE LA TIRE QU'UNE FOIS
 *
 * La clé publique est ce à quoi chaque navigateur s'abonne. En changer
 * n'invalide pas « quelques » abonnements : elle les rend TOUS muets, d'un
 * seul coup, sans erreur nulle part — les gens continuent de croire qu'ils
 * seront prévenus.
 *
 * Si la paire doit vraiment changer, il faut vider `PushSubscription` dans la
 * foulée, pour que chacun se réinscrive.
 */

import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log(`
Ajoute ces trois lignes à ton environnement, puis redémarre :

VAPID_PUBLIC_KEY=${publicKey}
VAPID_PRIVATE_KEY=${privateKey}
VAPID_SUBJECT=mailto:contact@ton-domaine.example

  — la PUBLIQUE part au navigateur : c'est sa nature, elle n'est pas secrète ;
  — la PRIVÉE ne quitte jamais le serveur. Qui l'a peut écrire à tous tes
    abonnés en ton nom ;
  — le SUJET doit être une vraie adresse de contact (mailto: ou https://).
    Certains services de poussée refusent la requête sans elle, et pas les
    autres : un défaut qui n'apparaîtrait que sur un navigateur sur trois.

Ne la retire jamais une fois posée en production sans vider PushSubscription :
tous les abonnements existants deviendraient muets en silence.
`);

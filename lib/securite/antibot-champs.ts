/**
 * Les noms des deux champs anti-bot.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI UN FICHIER À PART DE `antibot.ts`
 *
 * Parce que `antibot.ts` commence par `import "server-only"`, et que le
 * formulaire qui pose ces champs est un composant client. Le build l'a dit
 * franchement : « You're importing a component that needs "server-only" ».
 *
 * Ce qui traverse la frontière, c'est le **contrat** — deux chaînes de
 * caractères — et rien d'autre. Le secret reCAPTCHA, les seuils et la logique
 * de décision restent du côté serveur, où ils doivent être.
 *
 * La tentation était de recopier « societe » dans le composant. Deux
 * constantes identiques dans deux fichiers, et le jour où l'une change, le
 * leurre cesse d'être lu : le champ arrive sous un nom que le serveur
 * n'interroge pas, l'anti-bot ne voit plus jamais rien, et tout continue de
 * passer. Personne ne s'en apercevrait — c'est un contrôle qui réussit en ne
 * faisant rien.
 */

/**
 * Le nom du champ-leurre.
 *
 * Il ressemble à un champ réel. `honeypot`, `ne-pas-remplir` ou `bot-trap`
 * seraient lus par n'importe quel robot un peu écrit, qui les sauterait.
 */
export const CHAMP_LEURRE = "societe";

/** Le champ qui porte l'instant d'ouverture du formulaire. */
export const CHAMP_OUVERTURE = "ouvertLe";

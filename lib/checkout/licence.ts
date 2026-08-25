import { randomInt } from "node:crypto";

/**
 * La clé de licence remise à l'acheteur.
 *
 * Elle ne donne aucun droit par elle-même — l'accès aux fichiers se décide sur
 * la commande, pas sur la clé. Elle sert à l'acheteur qui doit prouver son
 * achat ailleurs : dans le greffon qu'il installe, auprès du support, dans sa
 * comptabilité.
 */

/**
 * Un alphabet sans ambiguïté.
 *
 * Zéro et O, un et I et L se confondent dans une police de caractères, et cette
 * clé sera recopiée à la main depuis un courriel, parfois depuis une capture
 * d'écran. Les retirer coûte un peu d'entropie et évite beaucoup de tickets de
 * support.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

const GROUPES = 4;
const PAR_GROUPE = 8;

/**
 * Une clé au format XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX.
 *
 * `randomInt` plutôt que `randomBytes(…) % 31` : la seconde forme favorise les
 * premiers caractères de l'alphabet, parce que 256 n'est pas un multiple de 31.
 * Le biais est faible, mais il n'y a aucune raison de l'accepter — la fonction
 * non biaisée est déjà dans la bibliothèque standard.
 */
export function nouvelleLicence(): string {
  const groupes: string[] = [];

  for (let g = 0; g < GROUPES; g += 1) {
    let groupe = "";
    for (let i = 0; i < PAR_GROUPE; i += 1) {
      groupe += ALPHABET[randomInt(ALPHABET.length)];
    }
    groupes.push(groupe);
  }

  return groupes.join("-");
}

const FORME = new RegExp(
  `^[${ALPHABET}]{${PAR_GROUPE}}(-[${ALPHABET}]{${PAR_GROUPE}}){${GROUPES - 1}}$`,
);

/** La forme attendue — pour les tests, et pour refuser une saisie absurde. */
export function licenceBienFormee(valeur: string): boolean {
  return FORME.test(valeur);
}

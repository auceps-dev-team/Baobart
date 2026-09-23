import "server-only";

import { journal } from "@/lib/observabilite/journal";

/**
 * Anti-bot — un score, pas un puzzle.
 *
 * Traduit `checkout_recaptcha.rb` et `follow_recaptcha.rb` (antiwork/gumroad,
 * MIT, lus comme spécification), §3.7-D du plan de refonte.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI PAS UNE GRILLE DE FEUX TRICOLORES
 *
 * Un CAPTCHA visuel arrête surtout les humains. Sur un marché ouest-africain,
 * où une part des visiteurs est sur un téléphone d'entrée de gamme et un
 * réseau lent, faire charger un iframe de résolution d'image pour s'inscrire
 * coûte des inscriptions réelles — et ne coûte à peu près rien à un robot, qui
 * sous-traite la résolution pour une fraction de centime.
 *
 * La spécification dit « score-based », et c'est pour cette raison.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TROIS SIGNAUX, DONT DEUX QUI NE DÉPENDENT DE PERSONNE
 *
 * **Le leurre.** Un champ que le CSS cache et qu'un humain ne peut donc pas
 * remplir. Un robot qui parcourt le HTML le remplit — c'est le signal le plus
 * franc qui existe, et il ne coûte rien à personne.
 *
 * **Le temps de remplissage.** Un formulaire d'inscription se remplit en
 * dizaines de secondes. Une soumission mille millisecondes après l'ouverture
 * n'a pas été tapée.
 *
 * **Le score d'un tiers.** reCAPTCHA Enterprise, quand la clé est configurée.
 * Il rend un nombre entre 0 et 1, et l'on refuse en dessous d'un seuil.
 *
 * Les deux premiers fonctionnent sans clé, sans réseau, sans compte chez
 * personne. C'est délibéré : une protection qui ne marche qu'une fois la
 * facturation Google ouverte ne protège pas le développement, ne protège pas
 * les tests, et ne protégera pas la production le jour où le quota tombe.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ON LAISSE PASSER DANS LE DOUTE — ET ON DIT POURQUOI
 *
 * Même règle que `lib/securite/garde.ts` : un service tiers injoignable ne doit
 * pas fermer l'inscription à tout le monde. `null` veut dire « sans opinion »,
 * et sans opinion on autorise.
 *
 * La contrepartie est réelle : pendant une panne du tiers, seuls le leurre et
 * le temps protègent. C'est précisément pourquoi ils existent — ils sont le
 * plancher, pas le complément.
 */

/** Ce que l'appelant apprend. */
export interface Verdict {
  laisserPasser: boolean;
  /** Le score du tiers, quand il y en a un. `null` = personne n'a d'opinion. */
  score: number | null;
  /**
   * Pourquoi. Jamais montré à la personne — il nomme le signal qui a joué, et
   * le dire apprendrait lequel contourner.
   */
  motif: "leurre" | "trop_rapide" | "score_bas" | "rien_a_redire";
}

/**
 * Les noms des champs vivent dans `antibot-champs.ts`, sans `server-only`.
 *
 * Réexportés ici pour que le serveur n'ait qu'un import à faire ; le composant
 * client, lui, DOIT viser `antibot-champs` directement — passer par ce
 * fichier-ci ferait échouer le build.
 */
export { CHAMP_LEURRE, CHAMP_OUVERTURE } from "@/lib/securite/antibot-champs";

/**
 * Le plancher de temps.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DEUX SECONDES, ET PAS DAVANTAGE
 *
 * Le seuil ne cherche pas à modéliser une frappe humaine : il cherche à
 * exclure ce qui n'a pas été tapé du tout. Un gestionnaire de mots de passe
 * remplit un formulaire d'inscription en un clin d'œil, et quelqu'un qui colle
 * une adresse et un mot de passe déjà choisis peut valider en trois secondes.
 *
 * Monter à dix secondes attraperait plus de robots et aussi de vraies
 * personnes. On préfère rater un robot que refuser une inscription, parce que
 * le robot revient dans les journaux et la personne, non.
 */
export const DELAI_MINIMUM_MS = 2_000;

/**
 * Le seuil de score.
 *
 * 0,3 est le seuil que recommande reCAPTCHA pour une action à faible enjeu. On
 * ne descend pas plus bas et on ne monte pas plus haut sans mesure : un seuil
 * choisi au jugé refuse des gens réels, et personne ne s'en aperçoit — ils ne
 * reviennent pas se plaindre, ils s'en vont.
 */
export const SEUIL_SCORE = 0.3;

/** Ce qu'on reçoit du formulaire. */
export interface Geste {
  /** Le nom de l'action, transmis au tiers pour qu'il distingue les contextes. */
  action: string;
  /** Le contenu du champ-leurre. Vide chez un humain. */
  leurre?: string | null;
  /** L'instant d'ouverture, tel que le formulaire l'a posé. */
  ouvertLe?: string | null;
  /** Le jeton du tiers, quand la page en produit un. */
  jeton?: string | null;
}

/**
 * Juge un geste.
 *
 * L'ordre des vérifications suit leur coût : le leurre et le temps se lisent
 * dans le formulaire, le score demande un aller-retour réseau. Refuser avant
 * l'appel évite de payer — en latence et en quota — pour un robot qui s'est
 * déjà trahi.
 */
export async function evaluerUnGeste(geste: Geste): Promise<Verdict> {
  if ((geste.leurre ?? "").trim().length > 0) {
    return { laisserPasser: false, score: null, motif: "leurre" };
  }

  if (tropRapide(geste.ouvertLe)) {
    return { laisserPasser: false, score: null, motif: "trop_rapide" };
  }

  const score = await scoreDuTiers(geste.jeton ?? null, geste.action);

  if (score !== null && score < SEUIL_SCORE) {
    return { laisserPasser: false, score, motif: "score_bas" };
  }

  return { laisserPasser: true, score, motif: "rien_a_redire" };
}

/**
 * Le formulaire a-t-il été soumis trop vite ?
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UN HORODATAGE ABSENT N'EST PAS UNE FAUTE
 *
 * Il manque dans un test, dans une requête forgée à la main pendant le
 * développement, et sur une page qu'on n'a pas encore équipée. Refuser
 * fermerait ces trois cas sans rien dire de plus sur le quatrième.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UN HORODATAGE DANS L'AVENIR EST UNE FAUTE
 *
 * Le champ vient du client : rien n'empêche d'y écrire l'an prochain pour que
 * l'écart paraisse énorme. On refuse donc aussi ce qui prétend venir d'après
 * maintenant — une horloge locale en avance de quelques secondes reste
 * tolérée, parce qu'elles le sont souvent.
 */
function tropRapide(brut: string | null | undefined): boolean {
  if (!brut) return false;

  const ouvert = Number(brut);
  if (!Number.isFinite(ouvert)) return false;

  const ecart = Date.now() - ouvert;

  // Cinq secondes de tolérance pour une horloge locale en avance.
  if (ecart < -5_000) return true;

  return ecart >= 0 && ecart < DELAI_MINIMUM_MS;
}

/**
 * Le score du tiers, ou `null` quand personne n'a d'opinion.
 *
 * `null` dans quatre cas, tous normaux : pas de clé configurée, pas de jeton
 * dans le formulaire, le service ne répond pas, le service répond mal. Aucun
 * ne doit fermer la porte.
 */
async function scoreDuTiers(
  jeton: string | null,
  action: string,
): Promise<number | null> {
  const secret = process.env.RECAPTCHA_SECRET;
  if (!secret || !jeton) return null;

  try {
    const reponse = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: jeton }),
        // Un anti-bot qui fait attendre l'inscription n'est plus une
        // protection : c'est une panne. Trois secondes, puis on passe.
        signal: AbortSignal.timeout(3_000),
      },
    );

    if (!reponse.ok) {
      journal.erreur("anti-bot : le service a refusé la requête", {
        statut: reponse.status,
        action,
      });
      return null;
    }

    const corps = (await reponse.json()) as {
      success?: boolean;
      score?: number;
      action?: string;
    };

    // ══════════════════════════════════════════════════════════════════════
    // L'ACTION EST VÉRIFIÉE, SINON LE JETON EST REJOUABLE AILLEURS
    //
    // Sans ce contrôle, un jeton obtenu sur une page publique à faible enjeu
    // — le formulaire de contact — vaudrait pour l'inscription. Le score
    // serait bon et le geste, tout autre.
    if (corps.action !== undefined && corps.action !== action) {
      journal.erreur("anti-bot : jeton présenté pour une autre action", {
        attendue: action,
        recue: corps.action,
      });
      return 0;
    }

    if (corps.success !== true || typeof corps.score !== "number") return null;

    return corps.score;
  } catch (cause) {
    // Injoignable, expiré, JSON illisible. On le crie plutôt que de l'avaler :
    // pendant ce temps, seuls le leurre et le temps protègent.
    journal.erreur("anti-bot : service injoignable", {
      action,
      cause: cause instanceof Error ? cause.message : String(cause),
    });
    return null;
  }
}

/** Ce que l'écran de configuration affiche. */
export function etatAntiBot(): { tiers: boolean; seuil: number; delai: number } {
  const secret = process.env.RECAPTCHA_SECRET;

  return {
    tiers: Boolean(secret && secret.length > 0),
    seuil: SEUIL_SCORE,
    delai: DELAI_MINIMUM_MS,
  };
}

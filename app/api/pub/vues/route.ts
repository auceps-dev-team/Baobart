import { journal } from "@/lib/observabilite/journal";
import { parMinute } from "@/lib/publicites/limites";
import { sousLePlafond } from "@/lib/publicites/plafond";
import { enregistrerVues, jourDe, reglagesEnCache } from "@/lib/publicites/service";
import { sujetAnonyme } from "@/lib/securite/adresse";
import { reponseTropDeGestes, verifierLimiteHttp } from "@/lib/securite/garde";

/**
 * Les bannières qu'un visiteur a vues.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUI COMPTE COMME UNE VUE
 *
 * La règle du plugin : la moitié de la bannière à l'écran. Pas son simple
 * rendu — la mosaïque en porte cinquante, et la plupart ne sont jamais
 * atteintes.
 *
 * Les vues arrivent groupées, par `navigator.sendBeacon` : un envoi toutes les
 * deux secondes au plus, et un dernier quand on quitte la page. Une requête par
 * bannière en ferait cinquante pour un défilement.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUI N'EST PAS GARDÉ
 *
 * En base : ni l'adresse, ni le compte. Le plugin gardait une ligne par vue,
 * avec l'adresse IP hachée sans sel — ce qui se retrouve en quelques minutes,
 * il n'y a que quatre milliards d'adresses. Ici, un compteur par bannière et
 * par jour.
 *
 * Hors base, depuis v1.71.2 : le plafond par visiteur garde vingt-six heures,
 * dans le compteur (Redis), une empreinte de l'adresse calculée avec le secret
 * du site et le jour. La politique de cookies le dit.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX LIMITES, RÉGLABLES DEPUIS L'ÉCRAN DES PUBLICITÉS
 *
 * Le débit par adresse ralentit un script ; le plafond par adresse, par pub et
 * par jour l'arrête — voir `lib/publicites/limites.ts`. Ce qui reste hors de
 * portée : un script qui change d'adresse à chaque envoi.
 */

const ID = /^c[a-z0-9]{20,32}$/;
/** Plus qu'il n'en tient sur une page de cent produits à l'écart le plus serré. */
const PAR_ENVOI = 60;

export async function POST(requete: Request) {
  const { limites } = await reglagesEnCache();
  const passage = await verifierLimiteHttp("pub.vues", requete, parMinute(limites.vuesParMinute));
  if (!passage.autorise) return reponseTropDeGestes(passage);

  let ids: string[] = [];
  try {
    const corps = (await requete.json()) as { ids?: unknown };
    if (Array.isArray(corps.ids)) {
      ids = corps.ids.filter((x): x is string => typeof x === "string" && ID.test(x)).slice(0, PAR_ENVOI);
    }
  } catch {
    // Un corps illisible n'est pas une erreur du visiteur qu'on doive lui
    // signaler : `sendBeacon` ne lit jamais la réponse.
  }

  if (ids.length > 0) {
    try {
      const maintenant = new Date();
      const comptees = await sousLePlafond({
        nature: "vue",
        sujet: sujetAnonyme(requete),
        ids,
        plafond: limites.vuesParVisiteurJour,
        jour: jourDe(maintenant),
      });
      await enregistrerVues(comptees, maintenant);
    } catch (cause) {
      journal.erreur("vues de publicité non comptées", {
        cause: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }

  return new Response(null, { status: 204 });
}

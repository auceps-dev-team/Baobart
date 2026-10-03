import { reponseTropDeGestes, verifierLimiteHttp } from "@/lib/securite/garde";
import { enregistrerVues } from "@/lib/publicites/service";
import { journal } from "@/lib/observabilite/journal";

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
 * Ni l'adresse, ni le compte. Le plugin gardait une ligne par vue, avec
 * l'adresse IP hachée sans sel — ce qui se retrouve en quelques minutes, il
 * n'y a que quatre milliards d'adresses. Ici, un compteur par bannière et par
 * jour, et rien d'autre.
 *
 * Ce que ça ne règle pas : un script qui gonfle les vues d'une bannière. La
 * limite par adresse le ralentit ; elle ne l'empêche pas.
 */

const ID = /^c[a-z0-9]{20,32}$/;
/** Plus qu'il n'en tient sur une page de cent produits à l'écart le plus serré. */
const PAR_ENVOI = 60;

export async function POST(requete: Request) {
  const passage = await verifierLimiteHttp("pub.vues", requete);
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
      await enregistrerVues(ids);
    } catch (cause) {
      journal.erreur("vues de publicité non comptées", {
        cause: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }

  return new Response(null, { status: 204 });
}

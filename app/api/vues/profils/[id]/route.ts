import { sessionCourante } from "@/lib/auth/session";
import { urlDuSite } from "@/lib/config/site";
import { compterUneVue } from "@/lib/createurs/vues";
import { db } from "@/lib/db";
import { adresseDe } from "@/lib/securite/adresse";
import { verifierLimiteHttp } from "@/lib/securite/garde";

/**
 * Une vue de profil public, envoyée par le navigateur après l'affichage
 * (`navigator.sendBeacon`, components/createurs/compteur-de-vue.tsx).
 *
 * Toujours 204, compté ou non : `sendBeacon` ne lit pas la réponse, et un
 * « déjà compté » ou un « ignoré » n'apprendrait qu'à un script comment
 * contourner ce qui l'arrête. Ce qui compte et ce qui ne compte pas est dit
 * dans `lib/createurs/vues.ts`.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TROIS ENVOIS QUI NE COMPTENT PAS
 *
 *   — **d'un autre site.** N'importe quelle page peut faire envoyer cette
 *     requête au navigateur de ses visiteurs : autant de vraies adresses, et
 *     le compteur d'un créateur monterait au rythme du trafic d'un tiers.
 *     L'en-tête `Origin` doit être le nôtre ;
 *   — **du créateur lui-même**, qui consulte sa propre vitrine ;
 *   — **d'un préchargement** (`Sec-Purpose: prefetch`) : personne n'a vu la
 *     page.
 */

const ID = /^c[a-z0-9]{20,32}$/;

const AUCUNE = () => new Response(null, { status: 204 });

export async function POST(requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const passage = await verifierLimiteHttp("vues.profil", requete);
  if (!passage.autorise) return AUCUNE();

  const { id } = await params;
  if (!ID.test(id)) return AUCUNE();

  const origine = requete.headers.get("origin");
  const nos = new Set([new URL(requete.url).origin, urlDuSite()].filter(Boolean));
  if (!origine || !nos.has(origine)) return AUCUNE();
  if (/prefetch/i.test(requete.headers.get("sec-purpose") ?? requete.headers.get("purpose") ?? "")) return AUCUNE();

  const profil = await db.profile.findUnique({
    where: { id },
    select: { userId: true, user: { select: { suspendedAt: true } } },
  });
  if (!profil || profil.user.suspendedAt !== null) return AUCUNE();

  const visiteur = await sessionCourante();
  if (visiteur?.id === profil.userId) return AUCUNE();

  await compterUneVue({
    profilId: id,
    visiteurId: visiteur?.id ?? null,
    adresse: adresseDe(requete),
    ua: requete.headers.get("user-agent"),
  });

  return AUCUNE();
}

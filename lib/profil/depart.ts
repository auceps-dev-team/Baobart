import type { Saisie } from "@/lib/profil/validation";
import { RESEAUX, depuisBase, type Reseau } from "@/lib/reseaux/reseaux";

/**
 * Le profil rangé, remis dans la forme du formulaire.
 *
 * Deux écrans montent le même formulaire depuis le 27/10 — Profil (identité)
 * et Profil de la boutique (vitrine) — et chacun renvoie TOUT le profil : ce
 * qu'il ne montre pas part en champs cachés. Les deux doivent donc partir du
 * même point, sans quoi l'un renverrait une valeur que l'autre n'a pas lue.
 */
export function departDuProfil(
  p:
    | {
        displayName: string;
        username: string;
        bio: string | null;
        city: string | null;
        country: string | null;
        speciality: string | null;
        portfolioUrl: string | null;
        links: Array<{ network: string; url: string }>;
        openToCommissions: string | null;
        dailyRate: number | null;
      }
    | null
    | undefined,
): Saisie {
  return {
    nomAffiche: p?.displayName ?? "",
    username: p?.username ?? "",
    bio: p?.bio ?? "",
    ville: p?.city ?? "",
    pays: p?.country ?? "",
    specialite: p?.speciality ?? "",
    portfolio: p?.portfolioUrl ?? "",
    // L'adresse rangée, telle quelle : c'est ce que le créateur a validé, et
    // ce qu'il reconnaîtra en relisant.
    reseaux: Object.fromEntries(
      RESEAUX.map((r) => [r, p?.links.find((l) => depuisBase(l.network) === r)?.url ?? ""]),
    ) as Record<Reseau, string>,
    disponibilite: p?.openToCommissions ?? "",
    tarifJournalier: p?.dailyRate ? String(p.dailyRate) : "",
  };
}

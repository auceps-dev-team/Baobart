import { describe, expect, it } from "vitest";

import { pouvoirsDe } from "@/lib/auth/administration";

import {
  MESSAGES,
  exigeUneRelecture,
  peutAgir,
  peutLire,
  peutPublier,
  pouvoirDeModeration,
  typesRelusPar,
  type Demandeur,
  type Refus,
  type TypeDeContenu,
} from "./droits";

const TYPES: TypeDeContenu[] = ["job", "service", "evenement", "article"];

/** Un inscrit ordinaire : ni vendeur, ni badgé, ni abonné. */
const MEMBRE: Demandeur = {
  role: "MEMBER",
  estVendeur: false,
  abonnementOuvert: false,
  badgeProfessionnel: false,
};

const PRESTATAIRE: Demandeur = {
  role: "MEMBER",
  estVendeur: true,
  abonnementOuvert: true,
  badgeProfessionnel: true,
};

/** L'équipe éditoriale : le pouvoir, et aucune des conditions marchandes. */
const EDITORIAL: Demandeur = { ...MEMBRE, role: "CONTENT_MANAGER" };

const avec = (p: Partial<Demandeur>): Demandeur => ({ ...PRESTATAIRE, ...p });

describe("sans compte", () => {
  it("on peut lire, et rien d'autre", () => {
    // Le resserrement du 2 septembre : voir est public, agir ne l'est pas.
    // C'est ce qui fait disparaître le formulaire public en écriture.
    expect(peutLire()).toBe(true);
    expect(peutAgir(null)).toEqual({ ok: false, motif: "CONNEXION_REQUISE" });

    for (const type of TYPES) {
      expect(peutPublier(null, type)).toEqual({
        ok: false,
        motif: "CONNEXION_REQUISE",
      });
    }
  });
});

describe("le blog", () => {
  it("est réservé à l'administration", () => {
    expect(peutPublier(MEMBRE, "article")).toEqual({
      ok: false,
      motif: "RESERVE_A_L_ADMINISTRATION",
    });
    // Même un prestataire complet n'y touche pas : un article signé du site
    // engage le site.
    expect(peutPublier(PRESTATAIRE, "article").ok).toBe(false);
    expect(peutPublier(EDITORIAL, "article").ok).toBe(true);
  });

  it("ne passe par aucune relecture", () => {
    // Son auteur portait déjà le droit de publier. Lui construire une file de
    // modération serait écrire un écran que personne n'ouvrirait.
    expect(exigeUneRelecture("article", EDITORIAL)).toBe(false);
  });
});

describe("les événements", () => {
  it("s'ouvrent à une agence badgée et à jour", () => {
    // Le changement de v1.51.0 : une agence organise ses propres ateliers sans
    // passer par l'équipe pour chaque date.
    expect(peutPublier(PRESTATAIRE, "evenement")).toEqual({ ok: true });
    expect(peutPublier(EDITORIAL, "evenement")).toEqual({ ok: true });
  });

  it("n'exigent pas d'être vendeur, contrairement aux services", () => {
    // Un service EST une vente ; un atelier n'en est pas une. Une agence qui
    // n'a jamais rien mis en vente peut tenir un atelier sérieux.
    expect(peutPublier(avec({ estVendeur: false }), "evenement")).toEqual({
      ok: true,
    });
  });

  it("restent fermés sans badge, et sans abonnement à jour", () => {
    expect(peutPublier(MEMBRE, "evenement")).toEqual({
      ok: false,
      motif: "BADGE_MANQUANT",
    });
    expect(peutPublier(avec({ abonnementOuvert: false }), "evenement")).toEqual({
      ok: false,
      motif: "ABONNEMENT_A_RENOUVELER",
    });
  });

  it("passent par une relecture quand l'auteur n'est pas de l'équipe", () => {
    // C'est ce qui rend l'ouverture sûre : le badge dit que le compte est
    // réel, pas que sa fiche est juste.
    expect(exigeUneRelecture("evenement", PRESTATAIRE)).toBe(true);
    expect(exigeUneRelecture("evenement", EDITORIAL)).toBe(false);
  });
});

describe("jobs", () => {
  it("s'ouvrent à tout inscrit, sans autre condition", () => {
    // « Ouvert à tous » distingue Jobs de Services — pas de vendeur, pas de
    // badge, pas d'abonnement. Cela ne veut pas dire « sans compte ».
    expect(peutPublier(MEMBRE, "job")).toEqual({ ok: true });
  });

  it("passent toujours par une relecture, même écrits par l'équipe", () => {
    // La seule chose qui protège : un compte gratuit se crée en deux minutes,
    // et l'authentification ne filtre pas les arnaques.
    //
    // « Même écrits par l'équipe » n'est pas un détail : un administrateur qui
    // dépanne un recruteur publie sous le nom de ce recruteur. Sa signature ne
    // vaut pas relecture.
    expect(exigeUneRelecture("job", MEMBRE)).toBe(true);
    expect(exigeUneRelecture("job", EDITORIAL)).toBe(true);
  });
});

describe("services", () => {
  it("exigent les trois conditions ensemble", () => {
    expect(peutPublier(PRESTATAIRE, "service")).toEqual({ ok: true });

    expect(peutPublier(avec({ estVendeur: false }), "service")).toEqual({
      ok: false,
      motif: "PAS_ENCORE_VENDEUR",
    });
    expect(peutPublier(avec({ badgeProfessionnel: false }), "service")).toEqual({
      ok: false,
      motif: "BADGE_MANQUANT",
    });
    expect(peutPublier(avec({ abonnementOuvert: false }), "service")).toEqual({
      ok: false,
      motif: "ABONNEMENT_A_RENOUVELER",
    });
  });

  it("annoncent d'abord le manque le plus lourd", () => {
    // Quelqu'un qui n'est pas encore vendeur n'a que faire d'apprendre qu'il
    // lui manque aussi un badge et un abonnement : on lui dit la première
    // marche, pas les trois.
    expect(peutPublier(MEMBRE, "service")).toEqual({
      ok: false,
      motif: "PAS_ENCORE_VENDEUR",
    });
  });

  it("laissent l'administration publier pour dépanner", () => {
    expect(
      peutPublier({ ...MEMBRE, role: "CONTENT_MANAGER" }, "service"),
    ).toEqual({ ok: true });
  });
});

describe("la modération", () => {
  it("demande le pouvoir qui correspond au contenu", () => {
    expect(pouvoirDeModeration("job")).toBe("moderer_le_contenu");
    expect(pouvoirDeModeration("service")).toBe("moderer_le_contenu");
    expect(pouvoirDeModeration("article")).toBe("publier_du_contenu");
    // Les événements aussi : qui relit un événement est qui le met en ligne.
    expect(pouvoirDeModeration("evenement")).toBe("publier_du_contenu");
  });

  it("ne laisse aucun contenu ouvert paraître sans relecture", () => {
    // Le lien entre les deux règles : tout ce qu'un non-administrateur peut
    // publier doit être relu. Un CMS ajouté sans y penser casserait ce test —
    // et c'est exactement ce qu'il a fait le jour où les événements se sont
    // ouverts aux agences. Il a coûté une ligne à réparer ; l'oubli aurait
    // coûté une page publique écrite sans relecture.
    for (const type of TYPES) {
      if (peutPublier(PRESTATAIRE, type).ok) {
        expect(exigeUneRelecture(type, PRESTATAIRE)).toBe(true);
      }
    }
  });
});

describe("qui relit quoi", () => {
  it("donne au modérateur les CMS ouverts, et rien d'autre", () => {
    // Jobs et Services sont ouverts à des gens dont on ne répond pas ; c'est
    // le métier du modérateur. Les événements ne sont pas à lui : les publier
    // demande `publier_du_contenu`, et il ne l'a pas.
    expect(typesRelusPar("MODERATOR")).toEqual(["job", "service"]);
  });

  it("donne à l'éditorial les événements, et rien d'autre", () => {
    // Il peut mettre un événement en ligne — c'est même le seul à pouvoir le
    // faire. Lui montrer des offres d'emploi lui promettrait des boutons qui
    // répondraient non.
    expect(typesRelusPar("CONTENT_MANAGER")).toEqual(["evenement"]);
  });

  it("donne tout à l'administrateur", () => {
    expect(typesRelusPar("ADMIN")).toEqual(["job", "service", "evenement"]);
  });

  it("ne donne rien à qui ne relit pas", () => {
    // Un membre, un comptable : la file ne leur montre rien, et la page leur
    // répond 404. Les deux doivent s'accorder.
    expect(typesRelusPar("MEMBER")).toEqual([]);
    expect(typesRelusPar("ACCOUNTANT")).toEqual([]);
  });

  it("n'y met jamais le blog", () => {
    // Rien n'y est soumis — son auteur porte déjà le droit de publier. Une
    // file qui compte un type sans dépôt promet ce qui n'arrive pas.
    for (const role of ["ADMIN", "SUPER_ADMIN", "CONTENT_MANAGER"] as const) {
      expect(typesRelusPar(role)).not.toContain("article");
    }
  });

  it("n'ouvre la file qu'à ce que la personne peut trancher", () => {
    // L'invariant, et la seule raison d'être de cette fonction : tout type
    // affiché doit être un type dont on porte le pouvoir de modération.
    for (const role of ["MEMBER", "MODERATOR", "CONTENT_MANAGER", "ADMIN"] as const) {
      for (const type of typesRelusPar(role)) {
        expect(peutModerer(role, type)).toBe(true);
      }
    }
  });
});

describe("les messages", () => {
  it("existent pour chaque refus", () => {
    // Un refus sans message afficherait « undefined » à quelqu'un qui essaie
    // de publier.
    const refus = Object.keys(MESSAGES) as Refus[];
    for (const r of refus) expect(MESSAGES[r].length).toBeGreaterThan(0);
  });

  it("disent quoi faire, pas seulement ce qui manque", () => {
    // « Badge manquant » ne sert à rien si l'on ne sait pas qu'il s'accorde.
    expect(MESSAGES.BADGE_MANQUANT).toContain("accorde");
    expect(MESSAGES.PAS_ENCORE_VENDEUR).toContain("Publie");
    // Et l'on rassure sur ce qui ne bouge pas : couper un service déjà vendu
    // pénaliserait le client, qui n'y est pour rien.
    expect(MESSAGES.ABONNEMENT_A_RENOUVELER).toContain("ne bougent pas");
  });
});

/** Relu depuis la matrice, jamais deviné. */
function peutModerer(
  role: Parameters<typeof typesRelusPar>[0],
  type: TypeDeContenu,
): boolean {
  return pouvoirsDe(role).includes(pouvoirDeModeration(type));
}

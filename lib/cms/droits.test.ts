import { describe, expect, it } from "vitest";

import {
  MESSAGES,
  exigeUneRelecture,
  peutAgir,
  peutLire,
  peutPublier,
  pouvoirDeModeration,
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

describe("blog et événements", () => {
  it("sont réservés à l'administration", () => {
    for (const type of ["article", "evenement"] as const) {
      expect(peutPublier(MEMBRE, type)).toEqual({
        ok: false,
        motif: "RESERVE_A_L_ADMINISTRATION",
      });
      // Même un prestataire complet n'y touche pas : ces contenus portent la
      // voix de Baobart.
      expect(peutPublier(PRESTATAIRE, type).ok).toBe(false);
      expect(peutPublier({ ...MEMBRE, role: "CONTENT_MANAGER" }, type).ok).toBe(true);
    }
  });

  it("ne passent par aucune relecture", () => {
    // Leur auteur portait déjà le droit de publier. Leur construire une file
    // de modération serait écrire un écran que personne n'ouvrirait.
    expect(exigeUneRelecture("article")).toBe(false);
    expect(exigeUneRelecture("evenement")).toBe(false);
  });
});

describe("jobs", () => {
  it("s'ouvrent à tout inscrit, sans autre condition", () => {
    // « Ouvert à tous » distingue Jobs de Services — pas de vendeur, pas de
    // badge, pas d'abonnement. Cela ne veut pas dire « sans compte ».
    expect(peutPublier(MEMBRE, "job")).toEqual({ ok: true });
  });

  it("passent toujours par une relecture", () => {
    // La seule chose qui protège : un compte gratuit se crée en deux minutes,
    // et l'authentification ne filtre pas les arnaques.
    expect(exigeUneRelecture("job")).toBe(true);
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
  });

  it("ne laisse aucun contenu ouvert paraître sans relecture", () => {
    // Le lien entre les deux règles : tout ce qu'un non-administrateur peut
    // publier doit être relu. Un CMS ajouté sans y penser casserait ce test.
    for (const type of TYPES) {
      const ouvertAuPublic = peutPublier(PRESTATAIRE, type).ok;
      if (ouvertAuPublic) expect(exigeUneRelecture(type)).toBe(true);
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

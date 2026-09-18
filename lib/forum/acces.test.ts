import { describe, expect, it } from "vitest";

import {
  clauseAnnuaire,
  droitsSur,
  type Communaute,
  type RoleForum,
  type Visibilite,
  type Visiteur,
} from "./acces";

const CREATEUR = "u_createur";

function communaute(over: Partial<Communaute> = {}): Communaute {
  return {
    id: "c1",
    visibilite: "PUBLIC",
    createurId: CREATEUR,
    active: true,
    ...over,
  };
}

function visiteur(
  appartenance: RoleForum | null = null,
  over: Partial<Visiteur> = {},
): Visiteur {
  return { id: "u_visiteur", role: "MEMBER", appartenance, ...over };
}

const VISIBILITES: Visibilite[] = ["PUBLIC", "PRIVATE", "INVITE_ONLY"];

describe("sans compte", () => {
  it("lit une communauté publique, et rien de plus", () => {
    const d = droitsSur(communaute({ visibilite: "PUBLIC" }), null);

    expect(d.voir).toBe(true);
    expect(d.lire).toBe(true);
    // Écrire demande toujours d'être membre, même dans un espace public :
    // c'est ce qui distingue une communauté d'un fil de commentaires.
    expect(d.ecrire).toBe(false);
    // Et on ne demande pas à adhérer sans compte.
    expect(d.demanderAAdherer).toBe(false);
  });

  it("voit une communauté privée exister, sans la lire", () => {
    // Listée exprès : c'est ce qui permet de demander à entrer. Une
    // communauté introuvable ne recrute personne.
    const d = droitsSur(communaute({ visibilite: "PRIVATE" }), null);

    expect(d.voir).toBe(true);
    expect(d.lire).toBe(false);
  });

  it("ignore jusqu'à l'existence d'une communauté sur invitation", () => {
    // Son existence même est une information : un espace d'entraide entre
    // créateurs qui traversent un litige n'a pas à figurer dans une liste.
    const d = droitsSur(communaute({ visibilite: "INVITE_ONLY" }), null);

    expect(d.voir).toBe(false);
    expect(d.lire).toBe(false);
  });
});

describe("un inscrit qui n'est pas membre", () => {
  it("peut demander à adhérer là où il voit", () => {
    for (const visibilite of ["PUBLIC", "PRIVATE"] as const) {
      const d = droitsSur(communaute({ visibilite }), visiteur());
      expect(d.demanderAAdherer).toBe(true);
    }
  });

  it("ne peut pas demander là où il ne voit rien", () => {
    const d = droitsSur(communaute({ visibilite: "INVITE_ONLY" }), visiteur());

    expect(d.voir).toBe(false);
    expect(d.demanderAAdherer).toBe(false);
  });

  it("n'écrit nulle part", () => {
    for (const visibilite of VISIBILITES) {
      expect(droitsSur(communaute({ visibilite }), visiteur()).ecrire).toBe(false);
    }
  });
});

describe("un membre", () => {
  it("lit et écrit, quelle que soit la visibilité", () => {
    for (const visibilite of VISIBILITES) {
      const d = droitsSur(communaute({ visibilite }), visiteur("MEMBER"));

      expect(d.voir).toBe(true);
      expect(d.lire).toBe(true);
      expect(d.ecrire).toBe(true);
    }
  });

  it("ne modère ni n'administre", () => {
    const d = droitsSur(communaute(), visiteur("MEMBER"));

    expect(d.moderer).toBe(false);
    expect(d.administrer).toBe(false);
  });

  it("ne demande plus à adhérer", () => {
    expect(droitsSur(communaute(), visiteur("MEMBER")).demanderAAdherer).toBe(
      false,
    );
  });
});

describe("les rôles de la communauté", () => {
  it("donnent la modération au modérateur, pas l'administration", () => {
    const d = droitsSur(communaute(), visiteur("MODERATOR"));

    expect(d.moderer).toBe(true);
    expect(d.administrer).toBe(false);
  });

  it("donnent les deux à l'administrateur de l'espace", () => {
    const d = droitsSur(communaute(), visiteur("ADMIN"));

    expect(d.moderer).toBe(true);
    expect(d.administrer).toBe(true);
  });
});

describe("le créateur", () => {
  it("administre chez lui même sans ligne d'appartenance", () => {
    // Dépendre de la ligne ferait qu'une adhésion supprimée par erreur le
    // mettrait dehors de chez lui.
    const d = droitsSur(communaute(), visiteur(null, { id: CREATEUR }));

    expect(d.administrer).toBe(true);
    expect(d.moderer).toBe(true);
    expect(d.ecrire).toBe(true);
  });

  it("voit et lit son espace sur invitation", () => {
    const d = droitsSur(
      communaute({ visibilite: "INVITE_ONLY" }),
      visiteur(null, { id: CREATEUR }),
    );

    expect(d.voir).toBe(true);
    expect(d.lire).toBe(true);
  });
});

describe("un modérateur de la plateforme", () => {
  it("n'obtient RIEN de plus qu'un visiteur ordinaire", () => {
    // Le test central de ce fichier. La tentation serait de lui donner le
    // droit de tout lire « au cas où » : c'est le dessin de la surveillance,
    // et il ne sert pas la modération — on ne modère pas ce qu'on n'a pas été
    // appelé à voir.
    //
    // Son chemin passe par le signalement, qui porte son propre droit d'accès.
    const modo = visiteur(null, { role: "MODERATOR" });

    for (const visibilite of VISIBILITES) {
      const sien = droitsSur(communaute({ visibilite }), modo);
      const quelconque = droitsSur(communaute({ visibilite }), visiteur());

      expect(sien).toEqual(quelconque);
    }
  });

  it("ne lit pas davantage même avec le pouvoir de publier", () => {
    const edito = visiteur(null, { role: "CONTENT_MANAGER" });

    expect(droitsSur(communaute({ visibilite: "PRIVATE" }), edito).lire).toBe(
      false,
    );
  });
});

describe("une communauté close", () => {
  it("est fermée à tout le monde, son créateur compris", () => {
    // Fermer veut dire fermer. Laisser la porte entrouverte pour son
    // propriétaire ferait « close » vouloir dire « cachée », et personne ne
    // saurait plus lequel des deux on a demandé.
    const close = communaute({ active: false });

    for (const qui of [
      null,
      visiteur(),
      visiteur("MEMBER"),
      visiteur("ADMIN"),
      visiteur(null, { id: CREATEUR }),
      visiteur(null, { role: "MODERATOR" }),
    ]) {
      const d = droitsSur(close, qui);
      expect(d.lire).toBe(false);
      expect(d.ecrire).toBe(false);
    }
  });

  it("reste consultable par l'exploitation, qui peut la rouvrir", () => {
    // La porte de secours, nommée pour ce qu'elle est : il faut bien que
    // quelqu'un puisse constater ce qu'on a fermé.
    const d = droitsSur(
      communaute({ active: false }),
      visiteur(null, { role: "SUPER_ADMIN" }),
    );

    expect(d.lire).toBe(true);
    expect(d.administrer).toBe(true);
    // Mais pas d'écriture : rouvrir n'est pas participer.
    expect(d.ecrire).toBe(false);
  });
});

describe("la clause d'annuaire", () => {
  it("ne montre que public et privé à un visiteur sans compte", () => {
    const clause = clauseAnnuaire(null);

    expect(clause.status).toBe("active");
    expect(clause.OR).toEqual([
      { visibility: "PUBLIC" },
      { visibility: "PRIVATE" },
    ]);
  });

  it("ajoute les espaces sur invitation dont on est membre", () => {
    const clause = clauseAnnuaire("u_visiteur");

    expect(clause.OR).toContainEqual({
      members: { some: { userId: "u_visiteur" } },
    });
    expect(clause.OR).toContainEqual({ creatorId: "u_visiteur" });
  });

  it("n'ouvre jamais les communautés closes", () => {
    // Le filtre traverse la requête plutôt que d'être rejoué après coup :
    // filtrer après la lecture rapatrierait des lignes qu'on n'a pas le droit
    // de voir, et casserait la pagination.
    expect(clauseAnnuaire(null).status).toBe("active");
    expect(clauseAnnuaire("u_visiteur").status).toBe("active");
  });
});

import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * La limitation, éprouvée là où elle vit vraiment.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE FICHIER N'EST PAS REDONDANT
 *
 * Les tests unitaires savent que la fenêtre glissante compte juste. Ils ne
 * savent pas si la garde est **appelée** par la route, ni si l'adresse est lue
 * du bon en-tête, ni si un client reçoit un 429 avec de quoi savoir quand
 * revenir.
 *
 * Une limitation écrite et non branchée ressemble en tout point à une
 * limitation qui marche — jusqu'au jour où quelqu'un essaie.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI EN RAFALES
 *
 * Le quota du rappel de paiement est de trois cents par minute, volontairement
 * large pour qu'un opérateur rattrapant un incident ne soit pas refusé. Les
 * dépasser une par une prendrait des minutes ; on les envoie donc par paquets,
 * ce qui ressemble d'ailleurs davantage à ce qu'on veut arrêter.
 */

const CHEMIN = "/api/paiements/paystack/webhook";

/**
 * Une requête locale n'a pas d'en-tête d'adresse, et la garde laisse alors
 * passer — délibérément, pour ne pas fermer le service à qui n'en a pas. Les
 * tests posent donc l'adresse eux-mêmes, comme le ferait un mandataire.
 */
function entetes(adresse: string, forwarded?: string) {
  return {
    "content-type": "application/json",
    ...(forwarded ? { "x-forwarded-for": forwarded } : { "x-real-ip": adresse }),
  };
}

/** Envoie jusqu'à trouver un 429, par paquets. Rend le statut atteint. */
async function frapperJusquAuRefus(
  request: APIRequestContext,
  faireEntetes: (i: number) => Record<string, string>,
  maximum = 400,
): Promise<{ refuse: boolean; attente: string | undefined; envoyees: number }> {
  const PAQUET = 40;

  for (let debut = 0; debut < maximum; debut += PAQUET) {
    const reponses = await Promise.all(
      Array.from({ length: PAQUET }, (_, k) =>
        request.post(CHEMIN, {
          headers: faireEntetes(debut + k),
          data: { rien: true },
        }),
      ),
    );

    const refusee = reponses.find((r) => r.status() === 429);
    if (refusee) {
      return {
        refuse: true,
        attente: refusee.headers()["retry-after"],
        envoyees: debut + PAQUET,
      };
    }
  }

  return { refuse: false, attente: undefined, envoyees: maximum };
}

test.describe("la route de rappel des paiements", () => {
  test("finit par répondre 429, avec de quoi savoir quand revenir", async ({
    request,
  }) => {
    const adresse = "10.0.0.42";

    const suite = await frapperJusquAuRefus(request, () => entetes(adresse));

    expect(
      suite.refuse,
      `aucun refus après ${suite.envoyees} requêtes — la garde n'est pas appelée par la route`,
    ).toBe(true);

    expect(
      suite.attente,
      "sans `Retry-After`, un client correct réessaie aussitôt et aggrave ce que la limite prévenait",
    ).toBeTruthy();
    expect(Number(suite.attente)).toBeGreaterThan(0);
  });

  test("ne compte pas une adresse sur le dos d'une autre", async ({ request }) => {
    await frapperJusquAuRefus(request, () => entetes("10.1.1.1"));

    // Le voisin n'a rien fait. Sa requête sera refusée pour une autre raison —
    // pas de signature — mais pas par la limite.
    const voisine = await request.post(CHEMIN, {
      headers: entetes("10.2.2.2"),
      data: { rien: true },
    });

    expect(voisine.status()).not.toBe(429);
  });
});

test.describe("le premier élément de x-forwarded-for ne doit rien décider", () => {
  test("changer de premier élément ne remet pas le compteur à zéro", async ({
    request,
  }) => {
    // Le cœur du piège. Un mandataire honnête AJOUTE l'adresse réelle à la fin
    // de ce qu'il reçoit. Si l'on lisait le premier élément, il suffirait d'en
    // changer à chaque requête pour n'être jamais compté — et la limite ne
    // limiterait rien du tout.
    const reelle = "10.3.3.3";

    const suite = await frapperJusquAuRefus(request, (i) =>
      entetes("", `203.0.113.${i % 250}, ${reelle}`),
    );

    expect(
      suite.refuse,
      "l'adresse doit être lue au DERNIER élément : sinon un attaquant change de clé à chaque requête et passe indéfiniment",
    ).toBe(true);
  });
});

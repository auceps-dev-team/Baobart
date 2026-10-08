/**
 * Le cycle d'un dossier juridique — contre la vraie base.
 *
 * ─────────────────────────────────────────────────────────────────
 * CE QUE CE FICHIER TIENT
 *
 *   — une notification incomplète est ENREGISTRÉE, avec sa date, et ne fait
 *     courir aucun délai ;
 *   — la compléter ne change ni la référence ni la date d'origine — celle qui
 *     compte devant un juge ;
 *   — « provisoire » veut dire provisoire : la remise en ligne existe et
 *     fonctionne ;
 *   — l'auteur est prévenu par COURRIEL, parce que le silence lui coûterait
 *     son travail ;
 *   — sans compte rapproché, personne n'est prévenu, et le dossier le dit.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import type { Saisie } from "@/lib/juridique/article47";
import {
  ENGAGEMENTS,
  cloreLesEcheances,
  completer,
  deposer,
  rapprocher,
  repondre,
  retirerProvisoirement,
  trancher,
} from "@/lib/juridique/dossier";
import { dossiersDeLAuteur, indicateursJuridiques } from "@/lib/juridique/queries";

let n = 0;

async function personne() {
  n += 1;
  return db.user.create({
    data: {
      email: `juridique-${n}@baobart.test`,
      profile: { create: { username: `vise-${n}`, displayName: `Visé ${n}` } },
    },
    select: { id: true, email: true },
  });
}

function saisie(modifs: Partial<Saisie> = {}): Saisie {
  return {
    qualite: "PERSONNE_PHYSIQUE",
    courriel: "awa@exemple.ci",
    nom: "Diallo",
    adresse: "12 rue des Jardins, Cocody, Abidjan",
    prenoms: "Awa",
    profession: "Illustratrice",
    nationalite: "Ivoirienne",
    naissanceDate: "1992-04-17",
    naissanceLieu: "Bouaké",
    destinataireNom: "Mensah",
    destinatairePrenoms: "Kofi",
    destinataireAdresse: "Marcory, Abidjan",
    faits: "Mon illustration est reproduite sans mon accord.",
    adressesVisees: "https://baobart.test/products/copie",
    motifs: "Droit d'auteur : je suis l'autrice de cette illustration.",
    contactPrealable: "Je lui ai écrit le 2 septembre, sans réponse.",
    contactImpossible: false,
    ...modifs,
  };
}

beforeEach(() => {
  n = 0;
});

describe("déposer", () => {
  it("enregistre une notification complète, prête à être traitée", async () => {
    const suite = await deposer({ saisie: saisie() });

    expect(suite.complete).toBe(true);
    expect(suite.reference).toMatch(/^NOT-\d{4}-\d{3}$/);

    const dossier = await db.legalNotice.findUniqueOrThrow({
      where: { reference: suite.reference },
      select: { state: true, missingElements: true, notifierName: true },
    });
    expect(dossier.state).toBe("RECUE");
    expect(dossier.missingElements).toBeNull();
    expect(dossier.notifierName).toBe("Diallo");
  });

  it("enregistre AUSSI une notification incomplète, et dit ce qui manque", async () => {
    // Refuser en bloc obligerait à tout ressaisir, et ferait perdre la date de
    // première tentative — celle qui compte si l'affaire va devant un juge.
    const suite = await deposer({
      saisie: saisie({ adressesVisees: "tout son profil", contactPrealable: "" }),
    });

    expect(suite.complete).toBe(false);
    expect(suite.reference).toMatch(/^NOT-/);

    const dossier = await db.legalNotice.findUniqueOrThrow({
      where: { reference: suite.reference },
      select: { state: true, missingElements: true },
    });
    expect(dossier.state).toBe("INCOMPLETE");
    expect(dossier.missingElements).toBe("localisation, correspondance");
  });

  it("donne des références distinctes et croissantes", async () => {
    const a = await deposer({ saisie: saisie() });
    const b = await deposer({ saisie: saisie() });

    expect(a.reference).not.toBe(b.reference);
    expect(b.reference > a.reference).toBe(true);
  });

  it("pose la date elle-même, sans rien demander au notifiant", async () => {
    // C'est elle qui fait courir l'obligation d'agir. Une date déclarée serait
    // la seule pièce du dossier que le notifiant pourrait antidater.
    const avant = Date.now();
    const suite = await deposer({ saisie: saisie() });

    const dossier = await db.legalNotice.findUniqueOrThrow({
      where: { reference: suite.reference },
      select: { notifiedAt: true },
    });
    expect(dossier.notifiedAt.getTime()).toBeGreaterThanOrEqual(avant - 1000);
  });
});

describe("compléter", () => {
  it("garde la référence ET la date d'origine", async () => {
    // LE test de ce bloc. Ce qui compte devant un juge est le jour où la
    // personne s'est manifestée, pas celui où elle a fini de remplir les cases.
    const depot = await deposer({ saisie: saisie({ contactPrealable: "" }) });
    const avant = await db.legalNotice.findUniqueOrThrow({
      where: { reference: depot.reference },
      select: { notifiedAt: true },
    });

    const suite = await completer({
      reference: depot.reference,
      saisie: saisie(),
    });

    expect(suite.ok).toBe(true);
    if (!suite.ok) return;
    expect(suite.complete).toBe(true);

    const apres = await db.legalNotice.findUniqueOrThrow({
      where: { reference: depot.reference },
      select: { state: true, notifiedAt: true, missingElements: true },
    });
    expect(apres.state).toBe("RECUE");
    expect(apres.notifiedAt.getTime()).toBe(avant.notifiedAt.getTime());
    expect(apres.missingElements).toBeNull();
  });

  it("laisse incomplet ce qui l'est encore, et met la liste à jour", async () => {
    const depot = await deposer({
      saisie: saisie({ contactPrealable: "", adressesVisees: "rien" }),
    });

    const suite = await completer({
      // On corrige les adresses, pas la correspondance.
      reference: depot.reference,
      saisie: saisie({ contactPrealable: "" }),
    });

    expect(suite.ok).toBe(true);
    if (!suite.ok) return;
    expect(suite.complete).toBe(false);

    const dossier = await db.legalNotice.findUniqueOrThrow({
      where: { reference: depot.reference },
      select: { state: true, missingElements: true },
    });
    expect(dossier.state).toBe("INCOMPLETE");
    expect(dossier.missingElements).toBe("correspondance");
  });

  it("refuse de compléter un dossier déjà complet", async () => {
    const depot = await deposer({ saisie: saisie() });

    const suite = await completer({ reference: depot.reference, saisie: saisie() });

    expect(suite).toEqual({ ok: false, motif: "ETAT" });
  });
});

describe("retirer à titre provisoire", () => {
  it("pose l'échéance de réponse, et consigne", async () => {
    const depot = await deposer({ saisie: saisie() });
    const modo = await personne();

    const suite = await retirerProvisoirement({
      reference: depot.reference,
      parId: modo.id,
    });

    expect(suite.ok).toBe(true);

    const dossier = await db.legalNotice.findUniqueOrThrow({
      where: { reference: depot.reference },
      select: { state: true, suspendedAt: true, replyDueAt: true },
    });
    expect(dossier.state).toBe("RETRAIT_PROVISOIRE");
    expect(dossier.suspendedAt).not.toBeNull();

    const jours =
      (dossier.replyDueAt!.getTime() - dossier.suspendedAt!.getTime()) / 86_400_000;
    expect(Math.round(jours)).toBe(ENGAGEMENTS.reponseJours);

    const trace = await db.auditLog.findFirstOrThrow({
      select: { action: true, resource: true },
    });
    expect(trace.action).toBe("contenu.retirer");
    expect(trace.resource).toContain("dossier-juridique");
  });

  it("refuse un dossier incomplet", async () => {
    // Tant qu'un élément manque, la connaissance n'est pas présumée :
    // l'obligation d'agir ne court pas, et le contenu reste en ligne.
    const depot = await deposer({ saisie: saisie({ contactPrealable: "" }) });
    const modo = await personne();

    const suite = await retirerProvisoirement({
      reference: depot.reference,
      parId: modo.id,
    });

    expect(suite).toEqual({ ok: false, motif: "ETAT" });
    expect(await db.auditLog.count()).toBe(0);
  });

  it("ne retire pas deux fois", async () => {
    const depot = await deposer({ saisie: saisie() });
    const modo = await personne();
    const avis = { reference: depot.reference, parId: modo.id };

    await retirerProvisoirement(avis);
    expect(await retirerProvisoirement(avis)).toEqual({ ok: false, motif: "ETAT" });
    expect(await db.auditLog.count()).toBe(1);
  });

  it("prévient l'auteur par courriel ET dans la cloche", async () => {
    // Le seul avis de la plateforme qui ouvre un délai au terme duquel quelque
    // chose est perdu. Une cloche qu'on n'ouvre pas ferait courir ces dix jours
    // dans le vide.
    const vise = await personne();
    const modo = await personne();
    const depot = await deposer({ saisie: saisie() });
    await rapprocher({ reference: depot.reference, userId: vise.id, parId: modo.id });

    const suite = await retirerProvisoirement({
      reference: depot.reference,
      parId: modo.id,
    });

    expect(suite.ok).toBe(true);
    if (!suite.ok) return;
    expect(suite.avisEnvoye).toBe(true);

    const courriel = await db.emailOutbox.findFirstOrThrow({
      where: { recipient: vise.email },
      select: { template: true, payload: true },
    });
    expect(courriel.template).toBe("RETRAIT_JURIDIQUE");
    // Le motif est repris TEL QUEL : l'auteur doit répondre à ce qui lui est
    // reproché, pas à notre reformulation.
    expect(JSON.stringify(courriel.payload)).toContain("Droit d'auteur");

    expect(
      await db.notification.count({ where: { userId: vise.id, type: "RETRAIT_JURIDIQUE" } }),
    ).toBe(1);
  });

  it("retire quand même sans compte rapproché, et le dit", async () => {
    // La loi impose d'agir dès la connaissance acquise. Deviner le compte sur
    // un nom retirerait le contenu d'un homonyme — on retire, on ne prévient
    // pas, et `avisEnvoye` ne ment pas.
    const depot = await deposer({ saisie: saisie() });
    const modo = await personne();

    const suite = await retirerProvisoirement({
      reference: depot.reference,
      parId: modo.id,
    });

    expect(suite.ok).toBe(true);
    if (!suite.ok) return;
    expect(suite.avisEnvoye).toBe(false);
    expect(await db.emailOutbox.count()).toBe(0);
  });
});

describe("répondre", () => {
  async function retire() {
    const vise = await personne();
    const modo = await personne();
    const depot = await deposer({ saisie: saisie() });
    await rapprocher({ reference: depot.reference, userId: vise.id, parId: modo.id });
    await retirerProvisoirement({ reference: depot.reference, parId: modo.id });
    return { vise, modo, reference: depot.reference };
  }

  it("fait passer le dossier en contestation", async () => {
    const d = await retire();

    const suite = await repondre({
      reference: d.reference,
      auteurId: d.vise.id,
      corps: "Cette illustration est la mienne, publiée en 2023 sous mon nom.",
    });

    expect(suite).toEqual({ ok: true });

    const dossier = await db.legalNotice.findUniqueOrThrow({
      where: { reference: d.reference },
      select: { state: true, _count: { select: { replies: true } } },
    });
    expect(dossier.state).toBe("CONTESTEE");
    expect(dossier._count.replies).toBe(1);
  });

  it("refuse la réponse d'un autre compte, et laisse le vrai auteur répondre", async () => {
    // Les références se suivent : NOT-2026-001, -002… Sans ce contrôle, un
    // inconnu faisait passer le dossier en contestation, et l'auteur visé
    // trouvait ensuite la porte fermée (« le délai est passé »).
    const d = await retire();
    const intrus = await personne();

    expect(
      await repondre({
        reference: d.reference,
        auteurId: intrus.id,
        corps: "Je réponds à la place de quelqu'un d'autre.",
      }),
    ).toEqual({ ok: false, motif: "INTROUVABLE" });

    const avant = await db.legalNotice.findUniqueOrThrow({
      where: { reference: d.reference },
      select: { state: true, _count: { select: { replies: true } } },
    });
    expect(avant.state).toBe("RETRAIT_PROVISOIRE");
    expect(avant._count.replies).toBe(0);

    expect(
      await repondre({
        reference: d.reference,
        auteurId: d.vise.id,
        corps: "Cette illustration est la mienne, publiée en 2023.",
      }),
    ).toEqual({ ok: true });
  });

  it("refuse une réponse vide", async () => {
    const d = await retire();

    expect(
      await repondre({ reference: d.reference, auteurId: d.vise.id, corps: "non" }),
    ).toEqual({ ok: false, motif: "TEXTE_COURT" });
  });

  it("refuse de répondre à un dossier qui n'est pas en retrait provisoire", async () => {
    const depot = await deposer({ saisie: saisie() });
    const vise = await personne();
    const modo = await personne();
    // Rattaché, mais pas encore retiré : c'est l'état, et lui seul, qui doit
    // refuser — pas le contrôle de l'auteur.
    await rapprocher({ reference: depot.reference, userId: vise.id, parId: modo.id });

    expect(
      await repondre({
        reference: depot.reference,
        auteurId: vise.id,
        corps: "Une réponse prématurée qui ne devrait pas passer.",
      }),
    ).toEqual({ ok: false, motif: "ETAT" });
  });
});

describe("trancher", () => {
  it("exige un motif écrit", async () => {
    const depot = await deposer({ saisie: saisie() });
    const modo = await personne();

    const suite = await trancher({
      reference: depot.reference,
      parId: modo.id,
      sens: "RETIREE",
      motif: "  ok  ",
    });

    expect(suite).toEqual({ ok: false, motif: "TEXTE_COURT" });
    const dossier = await db.legalNotice.findUniqueOrThrow({
      where: { reference: depot.reference },
      select: { state: true },
    });
    expect(dossier.state).toBe("RECUE");
  });

  it("remet en ligne — « provisoire » veut dire provisoire", async () => {
    // Le test qui donne son sens au mot. Sans ce chemin, « provisoire » serait
    // un euphémisme pour « définitif avec un délai ».
    const vise = await personne();
    const modo = await personne();
    const depot = await deposer({ saisie: saisie() });
    await rapprocher({ reference: depot.reference, userId: vise.id, parId: modo.id });
    await retirerProvisoirement({ reference: depot.reference, parId: modo.id });

    const suite = await trancher({
      reference: depot.reference,
      parId: modo.id,
      sens: "RESTAUREE",
      motif: "La notification ne démontre pas l'antériorité invoquée.",
    });

    expect(suite).toEqual({ ok: true });
    const dossier = await db.legalNotice.findUniqueOrThrow({
      where: { reference: depot.reference },
      select: { state: true, decisionReason: true, decidedById: true },
    });
    expect(dossier.state).toBe("RESTAUREE");
    expect(dossier.decisionReason).toContain("antériorité");
    expect(dossier.decidedById).toBe(modo.id);
  });

  it("ne tranche pas deux fois", async () => {
    const depot = await deposer({ saisie: saisie() });
    const modo = await personne();
    const avis = {
      reference: depot.reference,
      parId: modo.id,
      sens: "CLASSEE" as const,
      motif: "Hors sujet, le contenu visé n'existe plus.",
    };

    await trancher(avis);
    // Le second apprend que c'est déjà fait, et ce qui a été décidé — il
    // lisait « écris un motif d'au moins huit caractères » (R49, 25/09).
    expect(await trancher({ ...avis, sens: "RETIREE" })).toEqual({
      ok: false,
      motif: "DEJA_TRANCHE",
      decision: "CLASSEE",
    });
  });

  it("consigne un retrait comme un retrait, une restauration comme une publication", async () => {
    const modo = await personne();
    const a = await deposer({ saisie: saisie() });
    const b = await deposer({ saisie: saisie() });

    await trancher({
      reference: a.reference,
      parId: modo.id,
      sens: "RETIREE",
      motif: "Reproduction établie.",
    });
    await trancher({
      reference: b.reference,
      parId: modo.id,
      sens: "RESTAUREE",
      motif: "Notification non fondée.",
    });

    const traces = await db.auditLog.findMany({ select: { action: true } });
    expect(traces.map((t) => t.action).sort()).toEqual([
      "contenu.publier",
      "contenu.retirer",
    ]);
  });
});

describe("ce que l'auteur voit", () => {
  it("ne charge jamais l'identité du notifiant", async () => {
    // Ce n'est pas une décision d'affichage : la requête ne sélectionne pas
    // ces colonnes. Ce qui n'est jamais chargé ne peut pas fuir.
    const vise = await personne();
    const modo = await personne();
    const depot = await deposer({ saisie: saisie() });
    await rapprocher({ reference: depot.reference, userId: vise.id, parId: modo.id });

    const vus = await dossiersDeLAuteur(vise.id);

    expect(vus).toHaveLength(1);
    const serialise = JSON.stringify(vus[0]);
    expect(serialise).not.toContain("Diallo");
    expect(serialise).not.toContain("awa@exemple.ci");
    expect(serialise).not.toContain("Cocody");
    // En revanche, le motif y est, tel qu'il a été écrit.
    expect(vus[0]?.motifs).toContain("Droit d'auteur");
  });

  it("ne montre pas les dossiers qui visent quelqu'un d'autre", async () => {
    const moi = await personne();
    const voisin = await personne();
    const modo = await personne();
    const depot = await deposer({ saisie: saisie() });
    await rapprocher({ reference: depot.reference, userId: voisin.id, parId: modo.id });

    expect(await dossiersDeLAuteur(moi.id)).toEqual([]);
  });
});

describe("les indicateurs", () => {
  it("comptent les dossiers ouverts, les incomplets et les retraits", async () => {
    const modo = await personne();
    await deposer({ saisie: saisie() });
    await deposer({ saisie: saisie({ contactPrealable: "" }) });
    const aRetirer = await deposer({ saisie: saisie() });
    await retirerProvisoirement({ reference: aRetirer.reference, parId: modo.id });

    const chiffres = await indicateursJuridiques();

    expect(chiffres.enCours).toBe(3);
    expect(chiffres.incomplets).toBe(1);
    expect(chiffres.retraitsProvisoires).toBe(1);
    expect(chiffres.tranchesSur90Jours).toBe(0);
  });

  it("comptent les dossiers tranchés à part", async () => {
    const modo = await personne();
    const depot = await deposer({ saisie: saisie() });
    await trancher({
      reference: depot.reference,
      parId: modo.id,
      sens: "CLASSEE",
      motif: "Notification abandonnée par son auteur.",
    });

    const chiffres = await indicateursJuridiques();

    expect(chiffres.enCours).toBe(0);
    expect(chiffres.tranchesSur90Jours).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════ l'échéance ══

/**
 * La seule décision du projet qu'aucun humain ne prend.
 *
 * Elle mérite donc plus d'attention que les autres : personne ne la relira
 * avant qu'elle produise son effet.
 */
describe("clore les échéances", () => {
  /** Un dossier en retrait provisoire, dont l'échéance est déjà passée. */
  async function echu(joursDepasses = 1) {
    const vise = await personne();
    const modo = await personne();
    const depot = await deposer({ saisie: saisie() });
    await rapprocher({ reference: depot.reference, userId: vise.id, parId: modo.id });
    await retirerProvisoirement({ reference: depot.reference, parId: modo.id });

    // On recule l'échéance plutôt que d'avancer l'horloge : `cloreLesEcheances`
    // prend « maintenant » en paramètre, mais poser une date passée en base
    // éprouve aussi l'index et la comparaison SQL.
    await db.legalNotice.update({
      where: { reference: depot.reference },
      data: { replyDueAt: new Date(Date.now() - joursDepasses * 86_400_000) },
    });

    return { vise, modo, reference: depot.reference };
  }

  it("clôt ce dont le délai est passé sans réponse", async () => {
    const d = await echu();

    const bilan = await cloreLesEcheances();

    expect(bilan.clos).toBe(1);
    const dossier = await db.legalNotice.findUniqueOrThrow({
      where: { reference: d.reference },
      select: { state: true, decidedAt: true, decisionReason: true },
    });
    expect(dossier.state).toBe("RETIREE");
    expect(dossier.decidedAt).not.toBeNull();
    expect(dossier.decisionReason).toContain("Délai de réponse écoulé");
  });

  it("n'attribue la décision à personne", async () => {
    // Aucun humain n'a tranché. La consigner au nom du dernier modérateur qui
    // a touché le dossier lui attribuerait un geste qu'il n'a pas posé — et
    // c'est la trace qu'on relira si quelqu'un conteste.
    const d = await echu();

    await cloreLesEcheances();

    const dossier = await db.legalNotice.findUniqueOrThrow({
      where: { reference: d.reference },
      select: { decidedById: true, decisionReason: true },
    });
    expect(dossier.decidedById).toBeNull();
    // Et le motif le dit franchement, plutôt que de laisser croire à un examen.
    expect(dossier.decisionReason).toContain("sans examen humain");
  });

  it("épargne un dossier dont le délai court encore", async () => {
    const vise = await personne();
    const modo = await personne();
    const depot = await deposer({ saisie: saisie() });
    await rapprocher({ reference: depot.reference, userId: vise.id, parId: modo.id });
    await retirerProvisoirement({ reference: depot.reference, parId: modo.id });

    const bilan = await cloreLesEcheances();

    expect(bilan.clos).toBe(0);
    const dossier = await db.legalNotice.findUniqueOrThrow({
      where: { reference: depot.reference },
      select: { state: true },
    });
    expect(dossier.state).toBe("RETRAIT_PROVISOIRE");
  });

  it("laisse gagner une réponse arrivée avant le passage", async () => {
    // Elle est plus récente, et elle vient d'une personne. L'état d'avant est
    // dans le `WHERE` : `CONTESTEE` n'est pas `RETRAIT_PROVISOIRE`, donc rien
    // ne l'écrase.
    const d = await echu();
    await repondre({
      reference: d.reference,
      auteurId: d.vise.id,
      corps: "Cette illustration est la mienne, publiée en 2023.",
    });

    const bilan = await cloreLesEcheances();

    expect(bilan.clos).toBe(0);
    const dossier = await db.legalNotice.findUniqueOrThrow({
      where: { reference: d.reference },
      select: { state: true },
    });
    expect(dossier.state).toBe("CONTESTEE");
  });

  it("rattrape plusieurs jours de retard d'un coup", async () => {
    // La condition est « l'échéance est passée », jamais « c'est aujourd'hui ».
    // Chercher l'égalité perdrait tout dossier dont le terme tombe pendant une
    // panne — définitivement, et sans que rien ne le signale.
    await echu(1);
    await echu(9);
    await echu(40);

    const bilan = await cloreLesEcheances();

    expect(bilan.clos).toBe(3);
  });

  it("ne clôt pas deux fois", async () => {
    const d = await echu();

    await cloreLesEcheances();
    const second = await cloreLesEcheances();

    expect(second.clos).toBe(0);
    expect(d.reference).toMatch(/^NOT-/);
  });

  it("ne touche pas un dossier qui n'a jamais été retiré", async () => {
    // `replyDueAt` est nul tant qu'aucun retrait n'a eu lieu : un dossier reçu
    // et oublié ne doit pas se clore tout seul en faveur du notifiant.
    await deposer({ saisie: saisie() });

    const bilan = await cloreLesEcheances();

    expect(bilan.clos).toBe(0);
    expect(await db.legalNotice.count({ where: { state: "RECUE" } })).toBe(1);
  });
});

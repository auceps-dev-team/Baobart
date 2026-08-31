import "server-only";

import { db } from "@/lib/db";
import { formatMoney } from "@/lib/i18n/money";
import { journal } from "@/lib/observabilite/journal";
import { piloteCourant } from "@/lib/payments/encaissement/pilotes";
import {
  TransitionInterditeError,
  echouerVersement,
  marquerVersementEnvoye,
} from "@/lib/payments/versements";

/**
 * Faire partir pour de vrai l'argent que le cycle a préparé.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QUE CE MODULE NE DÉCIDE PAS
 *
 * Il ne choisit ni qui payer, ni combien : le cycle l'a fait, et les soldes
 * sont déjà réservés. Il ne fait qu'exécuter des versements en `CREATING`.
 *
 * La séparation compte. Préparer sans envoyer est sans danger — un versement
 * `CREATING` s'annule et rend ses soldes. Envoyer, non : c'est le seul geste
 * du système qui sorte de l'argent, et il vaut mieux qu'il vive seul, dans un
 * module qu'on peut lire en entier.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * L'ORDRE DES ÉCRITURES, ET POURQUOI IL EST CELUI-LÀ
 *
 * On ordonne le virement chez l'opérateur, PUIS on passe le versement en
 * `PROCESSING`. L'inverse serait plus rassurant à lire, et bien pire : un
 * versement marqué « envoyé » alors que l'appel a échoué ne repartirait jamais,
 * et le créateur attendrait un argent qui n'est pas parti.
 *
 * Dans ce sens-ci, le risque est l'inverse et il est rattrapable : l'ordre part
 * et l'écriture échoue. Le versement reste `CREATING`, un second passage
 * réessaierait — mais la référence que nous envoyons est l'identifiant du
 * versement, et Paystack refuse deux virements sous la même référence. Le
 * doublon est donc arrêté chez lui, pas seulement chez nous.
 */

/** Ce qu'un passage a produit. */
export interface Passage {
  /** Versements effectivement ordonnés. */
  envoyes: number;
  /** Refusés par l'opérateur — soldes rendus, ils repartiront au cycle suivant. */
  echoues: number;
  /** Laissés en l'état : rien n'a pu être tenté. */
  ignores: number;
  /** Le réglage bloque tout : inutile de continuer ce passage. */
  bloqueParOtp: boolean;
}

/** Un passage n'envoie pas mille virements d'un coup. */
const LOT = 50;

/**
 * Le bénéficiaire chez l'opérateur, créé une fois puis réutilisé.
 *
 * La référence est gardée sur le compte, pas sur le versement : c'est le compte
 * qui est stable. La recréer à chaque virement multiplierait les doublons chez
 * l'opérateur et rendrait illisible un virement contesté.
 */
async function beneficiairePour(input: {
  userId: string;
  rail: string;
  compte: string;
  devise: string;
  operateur: string;
}): Promise<{ ok: true; reference: string } | { ok: false; message: string }> {
  const compte = await db.payoutAccount.findFirst({
    where: {
      userId: input.userId,
      accountRef: input.compte,
      deletedAt: null,
    },
    select: {
      id: true,
      holderName: true,
      providerRecipientRef: true,
      recipientProvider: true,
    },
  });

  if (!compte) {
    return { ok: false, message: "Compte de versement introuvable." };
  }

  // La référence ne vaut que chez l'opérateur qui l'a délivrée : changer
  // d'opérateur doit la rendre caduque, sans quoi on enverrait un code Paystack
  // à quelqu'un d'autre.
  if (
    compte.providerRecipientRef &&
    compte.recipientProvider === input.operateur
  ) {
    return { ok: true, reference: compte.providerRecipientRef };
  }

  const pilote = piloteCourant();
  if (!pilote.versements) {
    return { ok: false, message: "Cet opérateur ne sait pas verser." };
  }

  const inscription = await pilote.versements.inscrire({
    // Un écart entre ce nom et celui du compte est le premier motif de rejet
    // d'un virement. Sans nom, on ne tente rien.
    nom: compte.holderName ?? "",
    compte: input.compte,
    moyen: input.rail,
    devise: input.devise,
  });

  if (!inscription.ok) return { ok: false, message: inscription.message };

  await db.payoutAccount.update({
    where: { id: compte.id },
    data: {
      providerRecipientRef: inscription.reference,
      recipientProvider: input.operateur,
    },
  });

  return { ok: true, reference: inscription.reference };
}

/**
 * Envoie les versements que le cycle a préparés.
 *
 * Un versement qui échoue n'emporte pas les suivants : chacun est traité seul,
 * et un refus rend ses soldes pour qu'ils repartent au cycle suivant.
 */
export async function envoyerLesVersements(): Promise<Passage> {
  const pilote = piloteCourant();
  const passage: Passage = {
    envoyes: 0,
    echoues: 0,
    ignores: 0,
    bloqueParOtp: false,
  };

  if (!pilote.versements) {
    // Rien à faire, et ce n'est pas une panne : le cycle continue de préparer,
    // les versements restent en CREATING et l'écran admin les fait avancer à
    // la main. C'est exactement ce qui se passait avant cette intégration.
    return passage;
  }

  const aEnvoyer = await db.payout.findMany({
    where: { status: "CREATING" },
    orderBy: { createdAt: "asc" },
    take: LOT,
    select: {
      id: true,
      userId: true,
      provider: true,
      accountRef: true,
      amount: true,
      currency: true,
    },
  });

  for (const versement of aEnvoyer) {
    const beneficiaire = await beneficiairePour({
      userId: versement.userId,
      rail: versement.provider,
      compte: versement.accountRef,
      devise: versement.currency,
      operateur: pilote.nom,
    });

    if (!beneficiaire.ok) {
      journal.erreur("bénéficiaire impossible à inscrire", {
        versement: versement.id,
        message: beneficiaire.message,
      });
      // On ne fait pas échouer le versement : le compte est peut-être
      // simplement incomplet, et l'échouer rendrait les soldes pour rien.
      passage.ignores += 1;
      continue;
    }

    const envoi = await pilote.versements.ordonner({
      reference: versement.id,
      beneficiaire: beneficiaire.reference,
      montant: versement.amount,
      devise: versement.currency,
      motif: `Baobart — vos ventes (${formatMoney(versement.amount, versement.currency)})`,
    });

    if (envoi.ok) {
      try {
        await marquerVersementEnvoye(versement.id, envoi.referenceOperateur);
        passage.envoyes += 1;
      } catch (cause) {
        // L'ordre est parti mais l'écriture a échoué. On le dit fort : un
        // second passage réessaiera, et l'opérateur refusera le doublon sur la
        // même référence — mais quelqu'un doit savoir que c'est arrivé.
        if (cause instanceof TransitionInterditeError) {
          journal.erreur("ORDRE PARTI SANS ÊTRE ENREGISTRÉ", {
            versement: versement.id,
            operateur: envoi.referenceOperateur,
          });
          passage.ignores += 1;
          continue;
        }
        throw cause;
      }
      continue;
    }

    // Le réglage bloque tout : inutile d'essayer les suivants, ils échoueront
    // pareil. On s'arrête, et le passage suivant reprendra où l'on en est.
    if (envoi.otpRequis) {
      passage.bloqueParOtp = true;
      passage.ignores += 1;
      break;
    }

    if (!envoi.definitif) {
      // Panne passagère chez l'opérateur : on laisse le versement en CREATING,
      // le prochain passage réessaiera. L'échouer rendrait les soldes et
      // repousserait le créateur d'un cycle entier pour rien.
      passage.ignores += 1;
      continue;
    }

    await echouerVersement(versement.id, envoi.message.slice(0, 200));
    passage.echoues += 1;
  }

  if (passage.envoyes > 0 || passage.echoues > 0) {
    journal.info("versements envoyés", { ...passage, operateur: pilote.nom });
  }

  if (passage.bloqueParOtp) {
    journal.erreur("passage de versement interrompu : OTP exigé", {
      remede:
        "Désactiver l'OTP sur les transferts depuis le tableau de bord de l'opérateur.",
    });
  }

  return passage;
}

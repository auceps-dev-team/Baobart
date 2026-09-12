import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { clauseDePortee } from "@/lib/evenements/acces";
import { nomDeFichier, versCsv } from "@/lib/evenements/export-csv";
import { accesAuxEvenements } from "@/lib/evenements/garde";
import { inscritsDe } from "@/lib/evenements/queries";

/**
 * La liste des inscrits, en CSV.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UNE ROUTE, PAS UNE ACTION
 *
 * Un fichier se télécharge ; une action serveur rend des données à React. On
 * passe donc par une route d'API, seule capable de poser un
 * `Content-Disposition` et de faire apparaître la boîte de sauvegarde.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA GARDE EST ICI, PAS SEULEMENT SUR L'ÉCRAN
 *
 * L'adresse est devinable — `/api/evenements/<id>/inscrits`. Si seul l'écran
 * était gardé, il suffirait de la taper pour obtenir les noms et les adresses
 * de tous les inscrits d'un événement. C'est le défaut qu'on appelle
 * **référence directe non protégée** : l'objet est accessible à qui connaît
 * son identifiant.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ET DEPUIS v1.51.0, LA GARDE COMPTE DEUX QUESTIONS
 *
 * « As-tu le droit d'être ici ? » ne suffit plus : une agence badgée l'a, et
 * ne doit pourtant lire que ses propres inscrits. La seconde question — « cet
 * événement est-il le tien ? » — vit dans la clause de la requête, à côté de
 * l'identifiant reçu.
 *
 * C'était le point le plus exposé de toute l'ouverture : une garde de rôle
 * laissée telle quelle ici aurait rendu la liste complète de n'importe quel
 * événement à n'importe quel compte badgé.
 *
 * 404 pour tout refus, jamais « accès refusé » : répondre autre chose
 * apprendrait qu'il existe bien une liste à cet identifiant.
 */
export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const acces = await accesAuxEvenements();
  if (!acces) return quatreCentQuatre();

  const evenement = await db.event.findFirst({
    where: { id, ...clauseDePortee(acces.portee) },
    select: { id: true, title: true },
  });

  if (!evenement) return quatreCentQuatre();

  const inscrits = await inscritsDe(evenement.id);

  const csv = versCsv(
    ["Nom", "Adresse", "Profil", "Ville", "Billet payé", "Inscrit le"],
    inscrits.map((i) => [
      i.nom,
      i.courriel,
      i.username ? `@${i.username}` : "",
      i.ville,
      i.billetPaye,
      // ISO plutôt que le format français : un tableur trie correctement
      // « 2026-09-11 », pas « 11/09/2026 ».
      i.inscritLe.toISOString().slice(0, 10),
    ]),
  );

  const nom = nomDeFichier(evenement.title, new Date());

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      // `filename*` en UTF-8 : sans lui, un titre accentué arrive tronqué ou
      // illisible selon le navigateur.
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nom)}`,
      // Une liste de participants n'a rien à faire dans un cache partagé.
      "cache-control": "no-store",
    },
  });
}

function quatreCentQuatre() {
  return new NextResponse("Not found", { status: 404 });
}

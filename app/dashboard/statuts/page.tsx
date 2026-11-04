import { DashboardFrame } from "@/components/dashboard/frame";
import { Intro, PiedEcran } from "@/components/systeme/bandeau";
import {
  PanneauOperations,
  type FiltreOps,
  type LegendeOps,
  type LigneOps,
} from "@/components/systeme/panneau-operations";
import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import { agirSurUnStatut } from "@/lib/badges/actions";
import { comptesPourStatuts, FILTRES_STATUTS, filtreStatutsValide } from "@/lib/badges/lecture";
import { gestesSur, nomDuStatut, statutDe, STATUTS } from "@/lib/badges/statuts";
import { BLANC, ENCRE, JAUNE, TON_ETAT } from "@/lib/systeme/charte";

export const metadata = { title: "Statuts — Baobart." };
export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

/**
 * Accorder et retirer les statuts — « Baobart Badges.dc.html », E.1.
 *
 * Hors de `/dashboard/systeme`, dont le layout exige le pouvoir de consulter
 * le système : une modératrice accorde Freelance sans avoir à lire les
 * paiements. La garde est `moderer_le_contenu`, ici et dans l'action.
 *
 * Pourquoi l'écran manquait, et ce que fait chaque statut :
 * `lib/badges/statuts.ts`.
 */
export default async function StatutsPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string; q?: string }>;
}) {
  const utilisateur = await exigerLePouvoir("moderer_le_contenu");
  const { filtre: brut, q = "" } = await searchParams;
  const filtre = filtreStatutsValide(brut);
  const { comptes, detenteurs } = await comptesPourStatuts({ filtre, q });

  const legende: LegendeOps[] = STATUTS.map((s) => ({
    code: s.nom.toUpperCase(),
    fond: s.code === "VERIFIED_CREATOR" || s.code === "VERIFIED_RECRUITER" ? JAUNE : TON_ETAT.enRoute!.fond,
    encre: ENCRE,
    nombre: detenteurs[s.code],
    sens: `${s.comment} Ouvre : ${s.droit}`,
  }));

  const adresse = (f: string) => {
    const p = new URLSearchParams();
    if (f !== "Tous") p.set("filtre", f);
    if (q) p.set("q", q);
    return p.size ? `/dashboard/statuts?${p}` : "/dashboard/statuts";
  };
  const filtres: FiltreOps[] = FILTRES_STATUTS.map((f) => ({
    code: f,
    libelle: f.toUpperCase(),
    actif: f === filtre,
    href: adresse(f),
  }));

  const lignes: LigneOps[] = comptes.map((c) => {
    const porte = c.statuts.length > 0;
    const d = c.derniere;
    return {
      id: c.id,
      colonnes: [
        c.id.slice(-8).toUpperCase(),
        c.nom,
        c.produits > 0 ? `créateur · ${c.produits} ressource(s)` : "acheteur",
        // « Identité vérifiée » se lit, ne se pose pas (`User.kycStatus`).
        c.kyc === "VERIFIED" ? "identité vérifiée" : c.kyc === "PENDING" ? "identité en cours" : "identité non vérifiée",
        c.email,
      ],
      etat: porte ? c.statuts.map((s) => statutDe(s).nom.toUpperCase()).join(" · ") : "AUCUN STATUT",
      etatFond: porte ? JAUNE : BLANC,
      etatEncre: ENCRE,
      sens: porte
        ? c.statuts.map((s) => statutDe(s).droit).join(" ")
        : "Ce compte n'a reçu aucune garantie de Baobart.",
      motif: d?.motif || null,
      trace: d
        ? `${d.action === "statut.accorder" ? "accordé" : "retiré"} · ${nomDuStatut(d.statut)} · ${d.auteur} · ${DATE.format(d.le)}`
        : "aucune décision sur les statuts de ce compte",
      actions: gestesSur(c.statuts).map((g) => ({
        cle: g.cle,
        libelle: g.libelle,
        fond: g.sens === "ACCORDER" ? JAUNE : BLANC,
        demande: {
          champ: "motif",
          etiquette: g.sens === "ACCORDER" ? "Ce qui a été vérifié" : "Pourquoi retirer ce statut",
        },
      })),
      sansAction: "Aucun geste possible.",
    };
  });

  return (
    <DashboardFrame utilisateur={utilisateur} titre="Statuts" description="Ce que Baobart garantit d'un compte.">
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Intro>
          Un statut engage Baobart : nous affirmons avoir vérifié quelqu&apos;un. Il s&apos;accorde à la main, avec ce
          qui a été vérifié, et se retire de même. Freelance et Agence s&apos;excluent : on passe de l&apos;un à
          l&apos;autre, jamais les deux.
        </Intro>

        <PanneauOperations
          legendeTitre="Les quatre statuts qui s'accordent"
          legende={legende}
          rechercherPlaceholder="Rechercher par nom, pseudo ou adresse…"
          recherche={{ valeur: q, conserver: filtre === "Tous" ? {} : { filtre } }}
          filtres={filtres}
          colonnes={["Identifiant", "Membre", "Rôle", "Identité", "Courriel"]}
          lignes={lignes}
          pied={`${comptes.length} comptes affichés${q ? ` pour « ${q} »` : ""} · les plus récents d'abord`}
          peutAgir
          executer={agirSurUnStatut}
        />

        <PiedEcran
          libelle="Ce qui ne s'accorde pas ici"
          qui="Les mérites — ventes, ancienneté, production — se calculent"
          note="Un mérite n'a pas de bouton : il se recalcule, on ne le retire pas à la main. « Identité vérifiée » suit la vérification d'identité du compte."
        />
      </div>
    </DashboardFrame>
  );
}

import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { DashboardFrame } from "@/components/dashboard/frame";
import { FormulairePublicite } from "@/components/publicites/formulaire";
import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import { LIBELLE_ETAT_PUB, etatDeLaPublicite } from "@/lib/publicites/regles";
import { pubAEditer } from "@/lib/publicites/service";
import { BLANC, CADRE, ENCRE } from "@/lib/systeme/charte";

export const metadata = { title: "Publicité — Baobart." };
export const dynamic = "force-dynamic";

export default async function EditerPublicitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const utilisateur = await exigerLePouvoir("promouvoir_du_contenu");
  const { id } = await params;
  const p = await pubAEditer(id);
  if (!p) notFound();

  // Les dates repartent au format du champ `datetime-local`, en GMT — l'heure
  // d'Abidjan, celle dans laquelle elles ont été saisies.
  const champDate = (d: Date | null) => (d ? d.toISOString().slice(0, 16) : "");

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre={p.title}
      description={`${LIBELLE_ETAT_PUB[etatDeLaPublicite(p, new Date())]} · tous les ${p.frequency} produits`}
      action={
        <Link
          href={"/dashboard/publicites" as Route}
          style={{
            padding: "10px 16px",
            border: CADRE,
            borderRadius: 13,
            background: BLANC,
            fontSize: 13,
            fontWeight: 800,
            color: ENCRE,
          }}
        >
          ← Toutes les publicités
        </Link>
      }
    >
      <div style={{ maxWidth: 1080 }}>
        <FormulairePublicite
          pubId={p.id}
          depart={{
            titre: p.title,
            lien: p.linkUrl,
            nature: p.mediaKind,
            imageUrl: p.imageUrl,
            imageLargeur: String(p.imageWidth),
            imageHauteur: String(p.imageHeight),
            videoUrl: p.videoUrl ?? "",
            frequence: String(p.frequency),
            debut: champDate(p.startsAt),
            fin: champDate(p.endsAt),
          }}
        />
      </div>
    </DashboardFrame>
  );
}

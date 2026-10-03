import Link from "next/link";
import type { Route } from "next";

import { DashboardFrame } from "@/components/dashboard/frame";
import { GestesPublicite } from "@/components/publicites/gestes";
import { ReglagesPublicites } from "@/components/publicites/reglages";
import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import { LIBELLE_ETAT_PUB, etatDeLaPublicite, tauxDeClic, type EtatPub } from "@/lib/publicites/regles";
import { listerPourAdministration, reglages } from "@/lib/publicites/service";
import { BLANC, CADRE, ENCRE, GRIS, JAUNE, LAVANDE, VERT } from "@/lib/systeme/charte";

export const metadata = { title: "Publicités — Baobart." };
export const dynamic = "force-dynamic";

const FOND_ETAT: Record<EtatPub, string> = {
  ACTIVE: VERT,
  PROGRAMMEE: LAVANDE,
  EN_PAUSE: JAUNE,
  TERMINEE: GRIS,
};

/**
 * L'ADS manager : les bannières de la mosaïque, et leurs chiffres.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TROIS CHIFFRES, ET CE QU'ILS NE DISENT PAS
 *
 * « Affichages » compte les bannières vues à moitié au moins, pas les pages
 * servies. « Clics » compte les passages par la redirection. « Ventes » ne
 * compte que les achats aboutis d'une ressource vers laquelle la bannière
 * menait — une bannière qui mène ailleurs l'affiche en toutes lettres, au lieu
 * d'un zéro qu'on lirait « cette campagne ne vend pas ».
 */
export default async function PublicitesPage() {
  const utilisateur = await exigerLePouvoir("promouvoir_du_contenu");
  const [pubs, r] = await Promise.all([listerPourAdministration(), reglages()]);
  const maintenant = new Date();

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Publicités"
      description="Les bannières intercalées dans la mosaïque de l'accueil et d'Explorer."
      action={
        <Link
          href={"/dashboard/publicites/nouvelle" as Route}
          className="sticker-press"
          style={{
            padding: "12px 20px",
            border: CADRE,
            borderRadius: 14,
            background: JAUNE,
            boxShadow: `4px 4px 0 ${ENCRE}`,
            fontSize: 13.5,
            fontWeight: 800,
            color: ENCRE,
          }}
        >
          Nouvelle publicité
        </Link>
      }
    >
      <div style={{ display: "grid", gap: 20 }}>
        <ReglagesPublicites actives={r.actives} ecartMinimal={r.ecartMinimal} />

        {pubs.length === 0 ? (
          <div
            style={{
              border: CADRE,
              borderRadius: 24,
              background: BLANC,
              boxShadow: `6px 6px 0 ${ENCRE}`,
              padding: 28,
              maxWidth: 620,
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 800 }}>Aucune publicité</div>
            <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.55, marginTop: 8 }}>
              Crée la première : une image ou une vidéo, un lien, et tous les
              combien de produits elle revient dans la mosaïque.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pubs.map((p) => {
              const etat = etatDeLaPublicite(
                { pausedAt: p.enPauseDepuis, startsAt: p.debut, endsAt: p.fin },
                maintenant,
              );
              const taux = tauxDeClic(p.vues, p.clics);
              return (
                <div
                  key={p.id}
                  data-pub={p.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "120px minmax(0,1fr)",
                    gap: 16,
                    alignItems: "start",
                    border: CADRE,
                    borderRadius: 20,
                    background: BLANC,
                    boxShadow: `4px 4px 0 ${ENCRE}`,
                    padding: 16,
                    color: ENCRE,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imageUrl}
                    alt=""
                    loading="lazy"
                    style={{
                      width: 120,
                      height: 90,
                      objectFit: "cover",
                      border: CADRE,
                      borderRadius: 12,
                      background: LAVANDE,
                    }}
                  />

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <Pastille fond={FOND_ETAT[etat]}>{LIBELLE_ETAT_PUB[etat]}</Pastille>
                      <Pastille fond={BLANC}>{p.nature === "VIDEO" ? "Vidéo" : "Image"}</Pastille>
                      <Pastille fond={BLANC}>Tous les {p.frequence} produits</Pastille>
                    </div>

                    <div style={{ fontSize: 16.5, fontWeight: 800, lineHeight: 1.3, marginTop: 8 }}>
                      {p.titre}
                    </div>

                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11.5,
                        opacity: 0.7,
                        marginTop: 4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      → {p.lien}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "6px 18px",
                        marginTop: 10,
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                      }}
                    >
                      <span>{periode(p.debut, p.fin)}</span>
                      <span>
                        <b>{p.vues.toLocaleString("fr-FR")}</b> affichage{p.vues > 1 ? "s" : ""}
                      </span>
                      <span>
                        <b>{p.clics.toLocaleString("fr-FR")}</b> clic{p.clics > 1 ? "s" : ""}
                        {taux !== null ? ` · ${taux.toLocaleString("fr-FR")} %` : ""}
                      </span>
                      <span>
                        {p.peutVendre ? (
                          <>
                            <b>{p.ventes.toLocaleString("fr-FR")}</b> vente{p.ventes > 1 ? "s" : ""}
                          </>
                        ) : (
                          <span style={{ opacity: 0.65 }}>ventes non suivies : le lien ne mène pas à une fiche</span>
                        )}
                      </span>
                    </div>

                    <GestesPublicite id={p.id} enPause={p.enPauseDepuis !== null} terminee={etat === "TERMINEE"} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardFrame>
  );
}

function periode(debut: Date | null, fin: Date | null): string {
  const jour = (d: Date) => d.toLocaleDateString("fr-FR", { timeZone: "UTC" });
  if (debut && fin) return `du ${jour(debut)} au ${jour(fin)}`;
  if (debut) return `à partir du ${jour(debut)}`;
  if (fin) return `jusqu'au ${jour(fin)}`;
  return "sans date de fin";
}

function Pastille({ children, fond }: { children: React.ReactNode; fond: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        border: `2px solid ${ENCRE}`,
        borderRadius: 999,
        background: fond,
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: ".06em",
      }}
    >
      {children}
    </span>
  );
}

import Link from "next/link";
import type { Route } from "next";

import { BoutonTraiter } from "@/components/contact/traiter";
import { DashboardFrame } from "@/components/dashboard/frame";
import { exigerUnDesPouvoirs } from "@/lib/auth/acces-administration";
import { boiteDeReception, genresLusPar } from "@/lib/contact/service";
import { BLANC, CADRE, ENCRE, GRIS, JAUNE, MAUVE } from "@/lib/systeme/charte";

export const metadata = { title: "Messages reçus — Baobart." };
export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });

/**
 * Ce que les formulaires Contact et Sponsoriser ont reçu.
 *
 * On répond depuis la messagerie de l'équipe — le lien « Répondre » ouvre un
 * courriel vers l'expéditeur — puis on marque le message traité. Baobart
 * n'envoie rien lui-même : un message de l'équipe doit pouvoir se relire dans
 * la boîte de celui qui l'a écrit.
 */
export default async function MessagesRecusPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const utilisateur = await exigerUnDesPouvoirs("traiter_les_litiges", "promouvoir_du_contenu");
  const traites = (await searchParams).vue === "traites";
  const messages = await boiteDeReception({ role: utilisateur.role, statut: traites ? "HANDLED" : "NEW" });
  const genres = genresLusPar(utilisateur.role);
  const quoi = genres.length === 2 ? "les messages et les demandes de sponsoring" : genres[0] === "SPONSOR" ? "les demandes de sponsoring" : "les messages du formulaire Contact";

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Messages reçus"
      description={`Tu vois ${quoi}. Réponds depuis ta messagerie, puis marque le message traité.`}
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[
          { label: "À traiter", href: "/dashboard/messages-recus", actif: !traites },
          { label: "Traités", href: "/dashboard/messages-recus?vue=traites", actif: traites },
        ].map((o) => (
          <Link key={o.label} href={o.href as Route} style={{ padding: "8px 14px", border: CADRE, borderRadius: 999, background: o.actif ? ENCRE : BLANC, color: o.actif ? BLANC : ENCRE, fontSize: 12.5, fontWeight: 800 }}>
            {o.label}
          </Link>
        ))}
      </div>

      {messages.length === 0 ? (
        <div style={{ border: CADRE, borderRadius: 24, background: BLANC, boxShadow: `6px 6px 0 ${ENCRE}`, padding: 28, maxWidth: 620 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{traites ? "Aucun message traité" : "Rien à traiter"}</div>
          <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.55, marginTop: 8 }}>
            Les messages arrivent des pages Contact et Sponsoriser.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 900 }}>
          {messages.map((m) => (
            <div key={m.id} data-message-recu={m.id} style={{ border: CADRE, borderRadius: 20, background: BLANC, boxShadow: `4px 4px 0 ${ENCRE}`, padding: 16, color: ENCRE }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <span style={{ padding: "3px 10px", border: `2px solid ${ENCRE}`, borderRadius: 999, background: m.genre === "SPONSOR" ? MAUVE : m.statut === "NEW" ? JAUNE : GRIS, fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" }}>
                  {m.genre === "SPONSOR" ? "Sponsoring" : "Contact"}
                </span>
                <span style={{ fontSize: 14, fontWeight: 800 }}>{m.sujet}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.55 }}>{DATE.format(m.recuLe)}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700 }}>
                {m.nom} ·{" "}
                <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re : ${m.sujet}`)}`} style={{ color: ENCRE }}>
                  {m.email}
                </a>
                {m.compte ? (
                  <>
                    {" "}·{" "}
                    <Link href={`/@${m.compte}` as Route} style={{ color: ENCRE }}>
                      @{m.compte}
                    </Link>
                  </>
                ) : (
                  <span style={{ opacity: 0.6 }}> · sans compte connecté</span>
                )}
                {m.budget ? <span> · budget : {m.budget}</span> : null}
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 14, fontWeight: 500, lineHeight: 1.55, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.corps}</p>
              {m.statut === "NEW" ? (
                <BoutonTraiter id={m.id} />
              ) : (
                <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, opacity: 0.6 }}>Traité le {m.traiteLe ? DATE.format(m.traiteLe) : "—"}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardFrame>
  );
}

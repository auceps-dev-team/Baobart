import { DashboardFrame } from "@/components/dashboard/frame";
import { EnvoiNumero, FormulaireNumero } from "@/components/infolettre/numero";
import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import { db } from "@/lib/db";
import { destinatairesPossibles, numeros } from "@/lib/infolettre/envoi";
import { BLANC, CADRE, ENCRE, GRIS, JAUNE, VERT } from "@/lib/systeme/charte";

export const metadata = { title: "Lettre d'information — Baobart." };
export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });

/**
 * La lettre d'information, côté équipe : qui la reçoit, les brouillons, ce qui
 * est parti. Décidé le 05/10 : l'envoi des numéros, aux adresses confirmées.
 */
export default async function InfolettrePage() {
  const utilisateur = await exigerLePouvoir("promouvoir_du_contenu");
  const [liste, confirmes, enAttente, desinscrits] = await Promise.all([
    numeros(),
    destinatairesPossibles(),
    db.newsletterSubscriber.count({ where: { status: "PENDING" } }),
    db.newsletterSubscriber.count({ where: { status: "UNSUBSCRIBED" } }),
  ]);

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Lettre d'information"
      description={`${confirmes} adresse${confirmes > 1 ? "s" : ""} confirmée${confirmes > 1 ? "s" : ""}, ${enAttente} en attente de confirmation, ${desinscrits} désinscrite${desinscrits > 1 ? "s" : ""}. Seules les confirmées reçoivent un numéro ; chacun porte son lien de désinscription.`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 900 }}>
        <div style={{ border: CADRE, borderRadius: 20, background: BLANC, boxShadow: `4px 4px 0 ${ENCRE}`, padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Nouveau numéro</div>
          <FormulaireNumero id={null} />
        </div>

        {liste.map((n) => (
          <div key={n.id} data-numero={n.id} style={{ border: CADRE, borderRadius: 20, background: BLANC, boxShadow: `4px 4px 0 ${ENCRE}`, padding: 16, color: ENCRE }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "baseline", marginBottom: 10 }}>
              <span style={{ padding: "3px 10px", border: `2px solid ${ENCRE}`, borderRadius: 999, background: n.status === "SENT" ? VERT : JAUNE, fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" }}>
                {n.status === "SENT" ? "Envoyé" : "Brouillon"}
              </span>
              {n.status === "SENT" ? (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, opacity: 0.65 }}>
                  {n.sentAt ? DATE.format(n.sentAt) : ""} · {n.recipients} destinataire{n.recipients > 1 ? "s" : ""}
                </span>
              ) : null}
            </div>
            {n.status === "DRAFT" ? (
              <>
                <FormulaireNumero id={n.id} sujet={n.subject} corps={n.body} />
                <EnvoiNumero id={n.id} destinataires={confirmes} />
              </>
            ) : (
              <>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{n.subject}</div>
                <p style={{ margin: "8px 0 0", fontSize: 13.5, fontWeight: 500, lineHeight: 1.55, whiteSpace: "pre-wrap", overflowWrap: "anywhere", background: GRIS + "33", padding: 10, borderRadius: 10 }}>{n.body}</p>
              </>
            )}
          </div>
        ))}
      </div>
    </DashboardFrame>
  );
}

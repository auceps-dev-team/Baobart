import Link from "next/link";
import type { Route } from "next";
import { notFound, redirect } from "next/navigation";

import { BoutonImpression } from "@/components/dashboard/bouton-impression";
import { BLANC, CADRE, DashboardFrame, ENCRE, JAUNE } from "@/components/dashboard/frame";
import { sessionCourante } from "@/lib/auth/session";
import { connexionPuis } from "@/lib/auth/suite";
import { formatPrice } from "@/lib/i18n/money";
import { lireCertificat } from "@/lib/licences/certificat-lecture";

export const metadata = { title: "Certificat de licence — Baobart." };
export const dynamic = "force-dynamic";

const DATE_LONGUE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const FOND_DOUX = "#F7F1FF";
const ROUGE_FOND = "#FCE4DF";
const ROUGE_ENCRE = "#7F1D1D";

/**
 * Certificat de licence imprimable d'un achat.
 *
 * Écart assumé avec `Doc/SPEC_LICENCES_BAOBART.md` §3 : ni QR code ni
 * empreinte cryptographique de vérification ici (aucune page publique de
 * vérification par numéro ni dépendance QR n'est ajoutée dans ce lot).
 */
export default async function CertificatLicencePage({
  params,
}: {
  params: Promise<{ orderItemId: string }>;
}) {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect(connexionPuis(`/dashboard/bibliotheque/certificat/${(await params).orderItemId}`));

  const { orderItemId } = await params;
  const cert = await lireCertificat(orderItemId, utilisateur.id);
  if (!cert) notFound();

  const estRevoque = cert.statut === "REVOQUE";

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Certificat de licence"
      action={
        <Link
          href="/dashboard/bibliotheque"
          data-print-hide="1"
          style={{
            padding: "13px 18px",
            border: CADRE,
            borderRadius: 14,
            background: BLANC,
            color: ENCRE,
            fontSize: 13.5,
            fontWeight: 800,
          }}
        >
          ← Ma bibliothèque
        </Link>
      }
    >
      <p
        data-print-hide="1"
        style={{ fontSize: 14.5, fontWeight: 500, opacity: 0.78, margin: "0 0 18px", maxWidth: 760 }}
      >
        Preuve d&apos;acquisition et étendue des droits pour cette ressource. Imprime ou enregistre cette page en PDF.
      </p>
      <div
        data-print-hide="1"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
          <BoutonImpression />
          <Link
            href={`/products/${cert.ressource.slug}` as Route}
            style={{
              padding: "13px 18px",
              border: CADRE,
              borderRadius: 14,
              background: BLANC,
              color: ENCRE,
              fontSize: 13.5,
              fontWeight: 800,
            }}
          >
            Voir la ressource
          </Link>
        </div>
        <Link
          href="/licences"
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: ENCRE,
            textDecoration: "underline",
          }}
        >
          Lire les conditions générales des licences
        </Link>
      </div>

      <article
        data-certificat="1"
        aria-label={`Certificat de licence ${cert.numero}`}
        style={{
          maxWidth: 820,
          border: `3px solid ${ENCRE}`,
          borderRadius: 22,
          background: BLANC,
          color: ENCRE,
          boxShadow: `6px 6px 0 ${ENCRE}`,
          overflow: "hidden",
        }}
      >
        {estRevoque ? (
          <div
            role="alert"
            style={{
              padding: "18px 28px",
              background: ROUGE_FOND,
              color: ROUGE_ENCRE,
              borderBottom: `3px solid ${ENCRE}`,
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  padding: "4px 10px",
                  border: `2px solid ${ROUGE_ENCRE}`,
                  borderRadius: 8,
                  background: BLANC,
                }}
              >
                RÉVOQUÉ
              </span>
              <span style={{ fontSize: 15, fontWeight: 800 }}>
                Ce certificat n&apos;est plus valable ({cert.motifsRevocation.join(", ")}).
              </span>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 13.5, fontWeight: 600 }}>
              Motif constaté : {cert.motifsRevocation.join(", ")}. Les droits d&apos;utilisation associés à cette ligne
              d&apos;achat ont pris fin.
            </p>
          </div>
        ) : null}

        <div
          style={{
            padding: "24px 28px",
            borderBottom: `3px solid ${ENCRE}`,
            background: estRevoque ? BLANC : FOND_DOUX,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Baobart. · Preuve d&apos;achat et de droits
            </div>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(22px, 2.2vw, 28px)",
                letterSpacing: "-0.5px",
                margin: "6px 0 0",
                textTransform: "uppercase",
              }}
            >
              Certificat de licence
            </h2>
          </div>

          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: "0.05em",
              }}
            >
              {cert.numero}
            </div>
            <div style={{ marginTop: 8 }}>
              <span
                style={{
                  display: "inline-block",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11.5,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  padding: "4px 12px",
                  border: `2px solid ${ENCRE}`,
                  borderRadius: 99,
                  background: estRevoque ? ROUGE_FOND : JAUNE,
                  color: estRevoque ? ROUGE_ENCRE : ENCRE,
                }}
              >
                {estRevoque ? "RÉVOQUÉ" : "VALIDE"}
              </span>
            </div>
          </div>
        </div>

        <div style={{ padding: "24px 28px", display: "grid", gap: 24 }}>
          <dl
            style={{
              margin: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            <Champ label="Ressource acquise" valeur={cert.ressource.titre} />
            <Champ
              label="Créateur / vendeur"
              valeur={cert.vendeur.username ? `${cert.vendeur.nom} (@${cert.vendeur.username})` : cert.vendeur.nom}
            />
            <Champ label="Titulaire (acheteur)" valeur={cert.acheteur.nom} precision={cert.acheteur.email} />
            <Champ label="Date d'achat" valeur={DATE_LONGUE.format(cert.acheteLe)} />
            <Champ label="Numéro de commande" valeur={cert.commande.reference} mono />
            <Champ label="Montant réglé" valeur={formatPrice(cert.montant, cert.devise)} />
          </dl>

          <section
            aria-label="Type de licence et conditions"
            style={{
              padding: "20px 22px",
              border: CADRE,
              borderRadius: 16,
              background: FOND_DOUX,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Licence accordée
            </div>
            <h3 style={{ margin: "6px 0 4px", fontSize: 19, fontWeight: 900 }}>{cert.licence.titre}</h3>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, lineHeight: 1.5 }}>{cert.licence.description}</p>

            <div
              style={{
                marginTop: 16,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 14,
              }}
            >
              {cert.licence.permises.length > 0 ? (
                <div
                  style={{
                    padding: "14px 16px",
                    border: `2px solid ${ENCRE}`,
                    borderRadius: 12,
                    background: BLANC,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 900, textTransform: "uppercase" }}>Permis</div>
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13.5, fontWeight: 600, lineHeight: 1.6 }}>
                    {cert.licence.permises.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {cert.licence.interdites.length > 0 ? (
                <div
                  style={{
                    padding: "14px 16px",
                    border: `2px solid ${ENCRE}`,
                    borderRadius: 12,
                    background: BLANC,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 900, textTransform: "uppercase" }}>Exclu / interdit</div>
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13.5, fontWeight: 600, lineHeight: 1.6 }}>
                    {cert.licence.interdites.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>

          {cert.cle ? (
            <section
              aria-label="Clé d'activation"
              style={{
                padding: "16px 20px",
                border: `2px solid ${ENCRE}`,
                borderRadius: 14,
                background: BLANC,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11.5,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Clé d&apos;activation
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontFamily: "var(--font-mono)",
                    fontSize: 15.5,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    wordBreak: "break-all",
                  }}
                >
                  {cert.cle.serial}
                </div>
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "4px 10px",
                  border: `2px solid ${ENCRE}`,
                  borderRadius: 8,
                  background: cert.cle.status === "ACTIVE" ? JAUNE : ROUGE_FOND,
                  color: cert.cle.status === "ACTIVE" ? ENCRE : ROUGE_ENCRE,
                }}
              >
                {cert.cle.status === "ACTIVE" ? "CLÉ ACTIVE" : "CLÉ DÉSACTIVÉE"}
              </span>
            </section>
          ) : null}

          <p
            style={{
              margin: 0,
              paddingTop: 14,
              borderTop: `2px dashed ${ENCRE}`,
              fontSize: 12.5,
              fontWeight: 600,
              lineHeight: 1.5,
            }}
          >
            Document généré par Baobart d&apos;après l&apos;état en base au moment de l&apos;affichage. En cas de
            remboursement intégral, de contestation bancaire ou de retrait d&apos;accès, ce certificat indique
            immédiatement l&apos;état révoqué lors d&apos;une consultation ou réimpression.
          </p>
        </div>
      </article>
    </DashboardFrame>
  );
}

function Champ({
  label,
  valeur,
  precision,
  mono = false,
}: {
  label: string;
  valeur: string;
  precision?: string;
  mono?: boolean;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <dt
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          margin: "4px 0 0",
          fontSize: 15,
          fontWeight: 800,
          fontFamily: mono ? "var(--font-mono)" : "var(--font-body)",
          overflowWrap: "anywhere",
        }}
      >
        {valeur}
      </dd>
      {precision ? (
        <dd style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 600, overflowWrap: "anywhere" }}>{precision}</dd>
      ) : null}
    </div>
  );
}

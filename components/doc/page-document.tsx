import type { ReactNode } from "react";

import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import type { UtilisateurConnecte } from "@/lib/auth/session";
import { BLANC, CADRE, ENCRE, LAVANDE } from "@/lib/systeme/charte";

/**
 * Le gabarit des pages d'information : surtitre, titre, introduction, puis des
 * sections séparées d'un filet.
 *
 * Repris de « Baobart Accueil.dc.html », bloc `PAGES DOC / LEGAL / COMMUNAUTE`
 * (`doc.kicker`, `doc.title`, `doc.intro`, `doc.sections`). La maquette en
 * dessine une dizaine — à propos, contact, support, documentation, changelog,
 * licences, règles, cookies — sur la même forme ; une seule implémentation
 * les sert toutes.
 *
 * Ce que dit chaque page vient du code, pas de la maquette : ses textes
 * annonçaient « 80 % » reversés, une validation « sous 72 h », des curateurs
 * « dans 14 pays » — rien de cela n'existe.
 */
export function PageDocument({
  visiteur,
  kicker,
  titre,
  intro,
  children,
  largeur = 1080,
}: {
  visiteur: UtilisateurConnecte | null;
  kicker: string;
  titre: string;
  intro: ReactNode;
  children: ReactNode;
  largeur?: number;
}) {
  return (
    <>
      <Header utilisateur={visiteur} />
      <main style={{ minHeight: "100vh", background: LAVANDE, paddingBottom: 40 }}>
        <div style={{ maxWidth: largeur, margin: "0 auto", padding: "44px 32px 0" }}>
          <article style={{ border: CADRE, borderRadius: 28, background: BLANC, boxShadow: `7px 7px 0 ${ENCRE}`, padding: 32 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".14em", opacity: 0.6 }}>
              {kicker}
            </div>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(30px,3.8vw,48px)",
                lineHeight: 1,
                letterSpacing: "-1.6px",
                margin: "12px 0 0",
                textTransform: "uppercase",
                overflowWrap: "anywhere",
              }}
            >
              {titre}
            </h1>
            <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.55, margin: "14px 0 0", opacity: 0.82, maxWidth: 720 }}>{intro}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 26 }}>{children}</div>
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}

export function DocSection({ titre, id, children }: { titre: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} style={{ borderTop: CADRE, paddingTop: 16, scrollMarginTop: 120 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{titre}</h2>
      {children}
    </section>
  );
}

export function DocTexte({ children }: { children: ReactNode }) {
  return (
    <p style={{ fontSize: 14.5, fontWeight: 500, lineHeight: 1.6, margin: "6px 0 0", opacity: 0.82, textWrap: "pretty" }}>{children}</p>
  );
}

export function DocListe({ elements }: { elements: ReactNode[] }) {
  return (
    <ul style={{ margin: "8px 0 0", paddingLeft: 20, display: "grid", gap: 6, fontSize: 14.5, fontWeight: 500, lineHeight: 1.55, opacity: 0.85 }}>
      {elements.map((e, i) => (
        <li key={i}>{e}</li>
      ))}
    </ul>
  );
}

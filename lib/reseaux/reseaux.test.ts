import { describe, expect, it } from "vitest";

import { GLYPHES } from "@/lib/reseaux/glyphes";
import {
  RESEAUX,
  adresseAffichable,
  identifiant,
  lireLien,
  type Reseau,
} from "@/lib/reseaux/reseaux";

function url(reseau: Reseau, saisie: string): string | null {
  const l = lireLien(reseau, saisie);
  if (!l.ok) throw new Error(`refusé : ${l.message}`);
  return l.url;
}

function refus(reseau: Reseau, saisie: string): string {
  const l = lireLien(reseau, saisie);
  if (l.ok) throw new Error(`accepté : ${l.url}`);
  return l.message;
}

describe("les douze réseaux de la maquette", () => {
  it("ont chacun un glyphe", () => {
    expect(RESEAUX).toHaveLength(12);
    for (const r of RESEAUX) expect(GLYPHES[r]).toMatch(/^M/);
  });
});

describe("un pseudo, quelle que soit la façon dont il est collé", () => {
  it("rend la même adresse pour le pseudo nu, le @ et l'adresse entière", () => {
    const attendu = "https://www.instagram.com/awa.draws/";
    expect(url("instagram", "awa.draws")).toBe(attendu);
    expect(url("instagram", "@awa.draws")).toBe(attendu);
    expect(url("instagram", "https://www.instagram.com/awa.draws/")).toBe(attendu);
  });

  it("accepte une adresse sans protocole", () => {
    expect(url("behance", "behance.net/awadiallo")).toBe("https://behance.net/awadiallo");
  });

  it("relève le http en https", () => {
    expect(url("dribbble", "http://dribbble.com/awa")).toBe("https://dribbble.com/awa");
  });

  it("retire les paramètres de suivi et le fragment", () => {
    expect(url("instagram", "https://www.instagram.com/awa.draws/?igsh=abc123&utm_source=qr#x")).toBe(
      "https://www.instagram.com/awa.draws/",
    );
  });

  it("garde l'identifiant d'un profil Facebook sans nom", () => {
    expect(url("facebook", "https://www.facebook.com/profile.php?id=1000123&ref=bookmarks")).toBe(
      "https://www.facebook.com/profile.php?id=1000123",
    );
  });

  it("donne aux numéros WhatsApp la forme que wa.me attend", () => {
    expect(url("whatsapp", "+225 07 07 07 07 07")).toBe("https://wa.me/2250707070707");
    expect(url("whatsapp", "00225 07.07.07.07.07")).toBe("https://wa.me/2250707070707");
  });

  it("range null quand le champ est vide", () => {
    expect(url("x", "   ")).toBeNull();
  });
});

describe("un logo mène sur son réseau, et nulle part ailleurs", () => {
  it("refuse une adresse d'un autre réseau, en le nommant", () => {
    expect(refus("instagram", "https://www.behance.net/awa")).toBe(
      "Cette adresse mène à Behance, pas à Instagram.",
    );
  });

  it("refuse un domaine qui imite le réseau", () => {
    expect(refus("instagram", "https://instagram.com.piege.example/awa")).toMatch(/ne mène pas à Instagram/);
    expect(refus("instagram", "https://faux-instagram.com/awa")).toMatch(/ne mène pas à Instagram/);
  });

  it("refuse une adresse qui cache sa destination derrière un @", () => {
    // Lue « l'utilisateur instagram.com, sur piege.example ».
    expect(refus("instagram", "https://instagram.com@piege.example/awa")).toMatch(/pas valable|ne mène pas/);
  });

  it("refuse ce qui n'est pas du web", () => {
    expect(refus("x", "javascript:alert(1)")).toMatch(/Colle l'adresse/);
  });

  it("refuse l'accueil du réseau, qui n'est la page de personne", () => {
    expect(refus("linkedin", "https://www.linkedin.com/")).toMatch(/l'accueil de LinkedIn/);
  });

  it("refuse un pseudo impossible", () => {
    expect(refus("x", "un pseudo avec des espaces")).toMatch(/n'est pas valable/);
    expect(refus("whatsapp", "07 07")).toMatch(/indicatif/);
  });

  it("accepte les sous-domaines du réseau", () => {
    expect(url("linkedin", "https://fr.linkedin.com/in/awa-diallo")).toBe("https://fr.linkedin.com/in/awa-diallo");
  });
});

describe("à l'affichage", () => {
  it("ignore une adresse rangée qui ne mène plus sur le réseau", () => {
    expect(adresseAffichable("instagram", "https://piege.example/awa")).toBeNull();
    expect(adresseAffichable("instagram", "http://www.instagram.com/awa")).toBeNull();
    expect(adresseAffichable("instagram", "pas une adresse")).toBeNull();
    expect(adresseAffichable("instagram", "https://www.instagram.com/awa/")).toBe("https://www.instagram.com/awa/");
  });

  it("écrit l'identifiant comme la maquette", () => {
    expect(identifiant("instagram", "https://www.instagram.com/baobart.studio/")).toBe("@baobart.studio");
    expect(identifiant("dribbble", "https://dribbble.com/baobart")).toBe("@baobart");
    expect(identifiant("behance", "https://www.behance.net/baobart")).toBe("/baobart");
    expect(identifiant("linkedin", "https://www.linkedin.com/company/baobart")).toBe("baobart");
    expect(identifiant("tiktok", "https://www.tiktok.com/@baobart")).toBe("@baobart");
    expect(identifiant("youtube", "https://www.youtube.com/@baobart")).toBe("@baobart");
    expect(identifiant("youtube", "https://www.youtube.com/channel/UC123")).toBe("Chaîne YouTube");
    expect(identifiant("whatsapp", "https://wa.me/2250707070707")).toBe("+2250707070707");
    expect(identifiant("whatsapp", "https://chat.whatsapp.com/AbCdEf")).toBe("Groupe");
    expect(identifiant("facebook", "https://www.facebook.com/profile.php?id=1")).toBe("Profil Facebook");
  });
});

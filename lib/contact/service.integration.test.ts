/**
 * Les messages reçus : qui les lit, qui les classe.
 */

import { describe, expect, it } from "vitest";

import { boiteDeReception, enregistrerMessage, marquerTraite } from "@/lib/contact/service";
import { db } from "@/lib/db";

let n = 0;
async function message(genre: "CONTACT" | "SPONSOR") {
  n += 1;
  const s = `${n}-${Math.random().toString(36).slice(2, 7)}`;
  return enregistrerMessage(
    { genre, nom: `Expéditeur ${s}`, email: `contact-${s}@baobart.test`, sujet: genre === "SPONSOR" ? "Sponsoriser" : "Un bug", corps: "Un message assez long.", budget: null },
    null,
  );
}

describe("les messages reçus", () => {
  it("le support lit les messages, le marketing les demandes de sponsoring", async () => {
    const contact = await message("CONTACT");
    const sponsor = await message("SPONSOR");

    const support = (await boiteDeReception({ role: "SUPPORT", statut: "NEW" })).map((m) => m.id);
    const marketing = (await boiteDeReception({ role: "MARKETING", statut: "NEW" })).map((m) => m.id);
    const admin = (await boiteDeReception({ role: "ADMIN", statut: "NEW" })).map((m) => m.id);

    expect(support).toContain(contact.id);
    expect(support).not.toContain(sponsor.id);
    expect(marketing).toContain(sponsor.id);
    expect(marketing).not.toContain(contact.id);
    expect(admin).toEqual(expect.arrayContaining([contact.id, sponsor.id]));
    expect(await boiteDeReception({ role: "MODERATOR", statut: "NEW" })).toEqual([]);
  });

  it("se classe une fois, et pas par qui n'en a pas la charge", async () => {
    const contact = await message("CONTACT");
    const membre = await db.user.create({ data: { email: `contact-equipe-${n}-${Date.now()}@baobart.test` }, select: { id: true } });

    // Un identifiant se recopie : le marketing ne classe pas un message du support.
    expect(await marquerTraite({ id: contact.id, parId: membre.id, role: "MARKETING" })).toEqual({ ok: false, motif: "INTERDIT" });
    expect(await marquerTraite({ id: contact.id, parId: membre.id, role: "SUPPORT" })).toEqual({ ok: true, genre: "CONTACT" });
    expect(await marquerTraite({ id: contact.id, parId: membre.id, role: "SUPPORT" })).toEqual({ ok: false, motif: "DEJA_TRAITE" });

    const traites = (await boiteDeReception({ role: "SUPPORT", statut: "HANDLED" })).map((m) => m.id);
    expect(traites).toContain(contact.id);
  });
});

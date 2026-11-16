/**
 * Le vrai traducteur de Chrome, sur la copie QA (piste 5, 14/11/2026).
 *
 * Lance le Chrome installé sur le poste avec un profil neuf réglé sur « toujours
 * traduire le français en anglais », ouvre une fiche, attend la traduction, puis
 * touche un bouton. Le texte de la page part chez le service de traduction de
 * Google : à ne lancer que sur des données de test.
 *
 *   node qa/vrai-traducteur.mjs <dossier de profil neuf>
 *   QA_COURRIEL=… QA_MDP=… node qa/vrai-traducteur.mjs <dossier>   → joue aussi les gestes d'un membre connecté
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "@playwright/test";

const profil = process.argv[2];
if (!profil) throw new Error("Donner un dossier de profil neuf.");
mkdirSync(join(profil, "Default"), { recursive: true });
writeFileSync(
  join(profil, "Default", "Preferences"),
  JSON.stringify({ translate: { enabled: true }, translate_whitelists: { fr: "en" }, intl: { accept_languages: "en-GH,en", selected_languages: "en-GH,en" } }),
);
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [`--user-data-dir=${profil}`, "--remote-debugging-port=9333", "--lang=en-GB", "--no-first-run", "--no-default-browser-check", "--window-size=1100,800", "about:blank"], { stdio: "ignore" });
const bilan = {};
try {
  let navigateur;
  for (let i = 0; i < 20 && !navigateur; i++) { await new Promise((r) => setTimeout(r, 700)); navigateur = await chromium.connectOverCDP("http://127.0.0.1:9333").catch(() => null); }
  if (!navigateur) throw new Error("Chrome ne répond pas sur le port de pilotage.");
  bilan.version = navigateur.version();
  const page = navigateur.contexts()[0].pages()[0] ?? (await navigateur.contexts()[0].newPage());
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(String(e).slice(0, 160)));
  page.on("console", (m) => { if (m.type() === "error") erreurs.push("console: " + m.text().slice(0, 160)); });
  const etat = () => page.evaluate(() => ({ lang: document.documentElement.lang, classe: document.documentElement.className.slice(0, 60), balisesFont: document.querySelectorAll("font").length, titre: (document.querySelector("h1, h2")?.innerText ?? "").slice(0, 60), debut: document.body.innerText.replace(/\s+/g, " ").slice(0, 140) }));
  await page.goto("http://127.0.0.1:3400/products/motif-wax-bleu-fond-d-ecran-offert", { waitUntil: "load" });
  for (let i = 0; i < 15; i++) { await page.waitForTimeout(1000); if ((await etat()).balisesFont > 20) break; }
  bilan.apresChargement = await etat();
  bilan.traduit = bilan.apresChargement.balisesFont > 20;
  if (bilan.traduit) {
    const boutons = await page.locator("button").evaluateAll((bs) => bs.map((b) => b.innerText.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 14));
    bilan.boutons = boutons;
    const jaime = page.locator("button", { hasText: "♥" }).first();
    await jaime.click({ timeout: 5000 }).catch((e) => { bilan.clic = String(e.message).split("\n")[0]; });
    await page.waitForTimeout(2500);
    bilan.apresClic = await etat();
    bilan.erreurs = erreurs;
  }
  // ── Deuxième temps : le compteur de la mosaïque, puis un membre connecté ──
  const traduite = async () => { for (let i = 0; i < 15; i++) { await page.waitForTimeout(1000); if ((await etat()).balisesFont > 20) return true; } return false; };
  const compteur = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").match(/.{0,30}(displayed|shown|showing|affich).{0,20}/i)?.[0] ?? null);
  await page.goto("http://127.0.0.1:3400/", { waitUntil: "load" });
  bilan.accueilTraduit = await traduite();
  bilan.compteurAvant = await compteur();
  await page.getByRole("button", { name: /^Mockups?$/i }).first().click({ timeout: 5000 }).catch((e) => { bilan.clicFiltre = String(e.message).split(String.fromCharCode(10))[0]; });
  await page.waitForTimeout(2000);
  bilan.compteurApresFiltreMockup = await compteur();
  bilan.cartesApresFiltre = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="/products/"]')].filter((a) => a.getBoundingClientRect().height > 0).map((a) => a.getAttribute("href").slice(10, 26)))]);
  if (process.env.QA_COURRIEL) {
    await page.goto("http://127.0.0.1:3400/connexion", { waitUntil: "load" });
    await traduite();
    await page.locator("input[name=email]").fill(process.env.QA_COURRIEL);
    await page.locator("input[name=motDePasse]").fill(process.env.QA_MDP);
    await page.locator("form button[type=submit]").first().click();
    await page.waitForTimeout(4000);
    bilan.connecte = new URL(page.url()).pathname;
    await page.goto("http://127.0.0.1:3400/products/motif-wax-bleu-fond-d-ecran-offert", { waitUntil: "load" });
    bilan.ficheTraduite = await traduite();
    const lire = async (motif) => (await page.locator("button").evaluateAll((bs) => bs.map((b) => b.innerText.replace(/s+/g, " ").trim()))).filter((t) => motif.test(t))[0] ?? null;
    erreurs.length = 0;
    const gestes = [];
    for (const [nom, motif] of [["J'aime", /♥/], ["J'aime (second clic)", /♥/], ["Suivre", /Follow|Subscri|Suivre|Abonn/i], ["Suivre (second clic)", /Follow|Subscri|Suivre|Abonn/i]]) {
      const avant = await lire(motif);
      await page.locator("button").filter({ hasText: motif }).first().click({ timeout: 5000 }).catch((e) => gestes.push(nom + " : clic impossible — " + String(e.message).split(String.fromCharCode(10))[0].slice(0, 80)));
      await page.waitForTimeout(2200);
      const e = await etat();
      gestes.push(`${nom} : « ${avant} » → « ${await lire(motif)} »${/error|cassé|broke|went wrong/i.test(e.debut) ? " · ÉCRAN D'ERREUR : " + e.debut.slice(0, 90) : ""}`);
    }
    bilan.gestesDuMembre = gestes;
    bilan.erreursDuMembre = [...erreurs];
    // Ce que dit la base après ces clics, pour savoir si l'écran dit vrai.
    await page.reload({ waitUntil: "load" }); await traduite();
    bilan.apresRechargement = [await lire(/♥/), await lire(/Follow|Subscri|Suivre|Abonn/i)];
  }
  await navigateur.close().catch(() => {});
} catch (e) {
  bilan.echec = String(e.message).slice(0, 200);
} finally {
  chrome.kill();
}
console.log(JSON.stringify(bilan, null, 1));

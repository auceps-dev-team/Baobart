/**
 * La salle de classe (piste 2, 14/11/2026).
 *
 * Trente élèves, chacun sur son appareil (une session de navigateur neuve par
 * élève), tous derrière la même connexion, s'inscrivent l'un après l'autre par
 * le formulaire `/inscription`. Rien n'est écrit en base par ce fichier : il ne
 * fait que remplir le formulaire, comme le ferait chaque élève.
 *
 * LE SCÉNARIO EST FIXÉ AVANT DE JOUER, pas ajusté au résultat :
 *   - 18 élèves remplissent juste du premier coup (profil A) ;
 *   - 6 tapent un mot de passe de 7 caractères, puis corrigent (B : rangs 5, 10, 15…) ;
 *   - 3 oublient la case des conditions, puis corrigent (C : rangs 3, 13, 23) ;
 *   - 3 touchent le bouton sur un formulaire vide, puis remplissent (D : rangs 7, 17, 27).
 *   Soit 12 élèves sur 30 (40 %) qui font UNE erreur — deux des quatre personas
 *   de la première campagne en avaient fait une.
 *   - Un élève bloqué lit le message. S'il est du profil B, C ou D (les
 *     impatients), il retente une fois, tout de suite.
 *
 * CE QU'ON COMPTE : les comptes créés, le rang du premier élève bloqué,
 * l'attente annoncée à chaque blocage, et si la saisie survit au blocage.
 *
 *   node qa/classe.mjs            → joue les trente
 *   node qa/classe.mjs 1 30 b     → rejoue les trente sous d'autres adresses (série « b »)
 *
 * LA FRAPPE EST À VITESSE HUMAINE (un caractère à la fois). La première passe
 * remplissait chaque formulaire en moins de deux secondes : l'anti-automate du
 * site (`lib/securite/antibot.ts`, deux secondes minimum à l'inscription) a
 * refusé ces envois, à raison. Elle a été écartée et rejouée.
 *
 * Les mots de passe sont tirés au hasard à chaque élève et ne sont écrits
 * nulle part : ces comptes ne servent qu'à être créés.
 */
import { randomUUID } from "node:crypto";

const PILOTE = `http://127.0.0.1:${process.env.QA_PILOTE_PORT ?? 3499}`;

const PRENOMS = ["Kofi", "Ama", "Kwame", "Abena", "Yaw", "Akosua", "Kojo", "Adwoa", "Kwesi", "Esi", "Mamadou", "Aïcha", "Ibrahim", "Fanta", "Ousmane", "Mariama", "Seydou", "Kadiatou", "Moussa", "Aminata", "Koffi", "Affoué", "Yao", "Adjoua", "Kouassi", "Akissi", "Konan", "Amenan", "Kouamé", "Ahou", "Issa", "Rokia", "Bakary"];
const NOMS = ["Asante", "Boateng", "Owusu", "Appiah", "Osei", "Agyeman", "Danso", "Frimpong", "Amoah", "Ofori", "Traoré", "Coulibaly", "Keïta", "Diarra", "Sangaré", "Konaté", "Sidibé", "Camara", "Touré", "Cissé", "Kouadio", "N'Guessan", "Brou", "Aka", "Yapi", "Ehui", "Tanoh", "Assi", "Gnamien", "Beugré", "Maïga", "Dembélé", "Sissoko"];

function profilDe(rang) {
  if (rang % 5 === 0) return "B";
  if (rang % 10 === 3) return "C";
  if (rang % 10 === 7) return "D";
  return "A";
}

const sansAccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z]/g, "").toLowerCase();

/** Le geste d'un élève, joué dans SA session par le pilote. */
const GESTE = `
const E = __ELEVE__;
const j = { rang: E.rang, profil: E.profil, essais: [] };
const t = (nom) => page.getByRole('textbox', { name: nom, exact: true });
const bouton = page.getByRole('button', { name: 'Créer mon compte gratuit' });
const lire = async () => {
  await page.waitForTimeout(2200);
  const alertes = (await page.getByRole('alert').allInnerTexts()).filter(a => a && !/CRÉE\\. PARTAGE/.test(a)).map(a => a.replace(/\\s+/g, ' ').slice(0, 90));
  const arrive = !/\\/inscription/.test(page.url());
  const saisie = arrive ? null : (await t('Email').inputValue().catch(() => '')).length > 0;
  return { arrive, alertes, saisieConservee: saisie };
};
const remplir = async (mdp, cocher) => {
  for (const [nom, valeur] of [['Prénom', E.prenom], ['Nom', E.nom], ["Nom d'utilisateur", E.pseudo], ['Email', E.email], ['Mot de passe', mdp]]) {
    await t(nom).fill(''); await t(nom).pressSequentially(valeur, { delay: 55 }); await page.waitForTimeout(280);
  }
  const c = page.getByRole('checkbox'); if (cocher) await c.check(); else await c.uncheck().catch(() => {});
};
const t0 = Date.now();
await page.goto('/inscription', { waitUntil: 'load' });
const refuser = page.getByRole('button', { name: 'Refuser' }); if (await refuser.count()) await refuser.click();
// Premier envoi : selon le profil.
if (E.profil === 'D') { await page.waitForTimeout(3000); /* lit la page, puis touche le bouton sans rien remplir */ }
else if (E.profil === 'B') await remplir(E.mdp.slice(0, 7), true);
else if (E.profil === 'C') await remplir(E.mdp, false);
else await remplir(E.mdp, true);
await bouton.click();
let r = await lire(); j.essais.push(r);
const bloque = (x) => x.alertes.some(a => /Trop de tentatives/i.test(a));
// Deuxième envoi : celui qui s'est trompé corrige ; l'impatient bloqué retente.
if (!r.arrive && (E.profil !== 'A')) {
  await remplir(E.mdp, true);
  await bouton.click();
  r = await lire(); j.essais.push(r);
}
j.compteCree = r.arrive;
j.arriveSur = r.arrive ? new URL(page.url()).pathname : null;
j.bloque = j.essais.some(bloque);
j.attentes = j.essais.flatMap(x => x.alertes).map(a => a.match(/(\\d+) (minutes?|secondes?|heures?)/)?.[0]).filter(Boolean);
j.ms = Date.now() - t0;
if (!E.garder) setTimeout(() => context.close().catch(() => {}), 2500);
return j;
`;

const [debut = 1, fin = 30] = process.argv.slice(2, 4).map(Number);
const SERIE = process.argv[4] ?? "";
const bilan = [];
console.log(`Début : ${new Date().toISOString().slice(11, 19)} UTC`);
for (let rang = debut; rang <= fin; rang++) {
  const prenom = PRENOMS[rang - 1];
  const nom = NOMS[rang - 1];
  const pseudo = `${sansAccent(prenom)}-${sansAccent(nom)}${SERIE ? "-" + SERIE : ""}`;
  const eleve = { rang, profil: profilDe(rang), prenom, nom, pseudo, email: `${pseudo.replace("-", ".")}@ecole-design${SERIE ? "-" + SERIE : ""}.test`, mdp: `${randomUUID().slice(0, 13)}Aa#`, garder: rang === 1 };
  const numero = String(rang).padStart(2, "0");
  const rep = await fetch(`${PILOTE}/run?persona=eleve${SERIE}${numero}&nom=classe${SERIE}&texte=0`, { method: "POST", body: GESTE.replace("__ELEVE__", JSON.stringify(eleve)) });
  const s = await rep.json();
  const j = s.resultat ?? { erreur: s.erreur };
  bilan.push(j);
  const heure = new Date().toISOString().slice(11, 19);
  console.log(`${heure} #${numero} ${eleve.profil} ${j.erreur ? "ERREUR DU GESTE " + j.erreur.slice(0, 120) : `${j.compteCree ? "COMPTE CRÉÉ → " + j.arriveSur : j.bloque ? "BLOQUÉ" : "REFUSÉ"} · envois ${j.essais.length} · ${j.essais.map((e) => (e.arrive ? "ok" : e.alertes[0] ?? "(aucun message)") + (e.saisieConservee === false ? " [saisie vidée]" : e.saisieConservee ? " [saisie gardée]" : "")).join(" | ")}`}`);
}
const crees = bilan.filter((b) => b.compteCree).length;
const premierBloque = bilan.find((b) => b.bloque)?.rang ?? null;
console.log(`\nBILAN : ${crees} compte(s) créé(s) sur ${bilan.length} élèves · premier bloqué : rang ${premierBloque} · envois au total : ${bilan.reduce((n, b) => n + (b.essais?.length ?? 0), 0)}`);
console.log(`Fin : ${new Date().toISOString().slice(11, 19)} UTC`);

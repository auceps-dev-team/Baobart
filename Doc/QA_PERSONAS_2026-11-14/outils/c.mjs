/**
 * Envoie un geste au pilote : node qa/c.mjs <persona> [nom-de-capture] [cle=valeur…] < geste.js
 * Options : texte=0 (sans l'arbre de l'écran), entier=1 (capture pleine page), max=8000.
 */
const [persona = "anonyme", nom = "pas", ...reste] = process.argv.slice(2);
let code = "";
for await (const morceau of process.stdin) code += morceau;

const parametres = new URLSearchParams({ persona, nom });
for (const paire of reste) {
  const [cle, valeur] = paire.split("=");
  parametres.set(cle, valeur);
}

const reponse = await fetch(`http://127.0.0.1:${process.env.QA_PILOTE_PORT ?? 3499}/run?${parametres}`, { method: "POST", body: code });
const s = await reponse.json();

console.log(`[${s.persona}] ${s.ok ? "OK" : "ÉCHEC"}  ${s.url ?? ""}  « ${s.titre ?? ""} »`);
if (s.erreur) console.log(`erreur : ${s.erreur}`);
if (s.resultat !== undefined) console.log(`résultat : ${typeof s.resultat === "string" ? s.resultat : JSON.stringify(s.resultat, null, 1)}`);
if (s.evenements?.length) console.log(`événements :\n  ${s.evenements.join("\n  ")}`);
if (s.ecran) console.log(`écran :\n${s.ecran}`);
if (s.capture) console.log(`capture : ${s.capture}`);

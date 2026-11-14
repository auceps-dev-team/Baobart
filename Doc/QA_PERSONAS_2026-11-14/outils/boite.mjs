/**
 * La boîte de réception du QA (Mailpit, port 8125).
 *
 *   node qa/boite.mjs                 → liste les messages
 *   node qa/boite.mjs <adresse>       → affiche le dernier message reçu par cette adresse
 */
const API = "http://127.0.0.1:8125/api/v1";
const adresse = process.argv[2];
const liste = await (await fetch(`${API}/messages?limit=100`)).json();

if (!adresse) {
  console.log(`${liste.total} message(s)`);
  for (const m of liste.messages) console.log(` - ${m.Created.slice(11, 19)}  ${m.To[0].Address}  |  ${m.Subject}`);
} else {
  const dernier = liste.messages.find((m) => m.To.some((d) => d.Address === adresse));
  if (!dernier) {
    console.log(`Aucun message pour ${adresse}.`);
  } else {
    const m = await (await fetch(`${API}/message/${dernier.ID}`)).json();
    console.log(`De : ${m.From.Address}\nÀ : ${adresse}\nSujet : ${m.Subject}\n\n${(m.Text || "(pas de version texte)").slice(0, 1800)}`);
    console.log(`\n[version HTML : ${m.HTML ? m.HTML.length + " caractères" : "absente"}]`);
  }
}

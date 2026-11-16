const publiques = ['/', '/explore', '/createurs', '/createurs/awa-diallo', '/@awa-diallo', '/products/pack-motifs-wax-12-planches', '/blog', '/communautes', '/evenements', '/jobs', '/services', '/tarifs', '/fonctionnalites', '/a-propos', '/contact', '/support', '/documentation', '/changelog', '/licences', '/conditions', '/confidentialite', '/cookies', '/regles-de-publication', '/signalement', '/signalement/deposer', '/sponsoriser', '/services/deposer', '/jobs/deposer', '/communautes/nouvelle', '/connexion', '/connexion/telephone', '/inscription', '/mot-de-passe-oublie', '/labo/animata', '/labo/explorations', '/page-qui-n-existe-pas', '/products/ressource-inexistante', '/@personne-inconnue'];
const prive = ['/dashboard', '/dashboard/apercu', '/dashboard/notifications', '/dashboard/notifications/reglages', '/dashboard/profil', '/dashboard/badges', '/dashboard/bibliotheque', '/dashboard/achats', '/dashboard/telechargements', '/dashboard/remboursements', '/dashboard/suivis', '/dashboard/collections', '/dashboard/abonnements', '/dashboard/forfait', '/dashboard/temoignage', '/dashboard/devenir-vendeur', '/dashboard/produits', '/dashboard/produits/nouveau', '/dashboard/promos', '/dashboard/gains', '/dashboard/versements', '/dashboard/commandes', '/dashboard/ventes', '/dashboard/ventes/remboursements', '/dashboard/commissions', '/dashboard/statistiques', '/dashboard/boutique', '/dashboard/avis', '/dashboard/mes-dossiers', '/jobs/mes-propositions'];
const equipe = ['/dashboard/moderation', '/dashboard/signalements', '/dashboard/statuts', '/dashboard/blog', '/dashboard/blog/nouveau', '/dashboard/evenements', '/dashboard/publicites', '/dashboard/publicites/nouvelle', '/dashboard/temoignages', '/dashboard/infolettre', '/dashboard/remboursements-a-trancher', '/dashboard/messages-recus', '/dashboard/systeme/configuration', '/dashboard/systeme/emails', '/dashboard/systeme/paiements', '/dashboard/systeme/versements', '/dashboard/systeme/membres', '/dashboard/systeme/blocklist'];
const listes = { publiques, prive, equipe };
const choisies = (globalThis.__listes ?? 'publiques').split(',').flatMap(n => listes[n]);
const releve = [];
for (const chemin of choisies) {
  const erreurs = []; const ecoute = (e) => erreurs.push(String(e).slice(0, 90)); const ecoute2 = (m) => { if (m.type() === 'error') erreurs.push('console: ' + m.text().slice(0, 90)); };
  page.on('pageerror', ecoute); page.on('console', ecoute2);
  let statut = null, t0 = Date.now();
  try { const r = await page.goto(chemin, { waitUntil: 'load' }); statut = r?.status() ?? null; await page.waitForTimeout(500); } catch (e) { statut = 'échec: ' + String(e).slice(0, 60); }
  page.off('pageerror', ecoute); page.off('console', ecoute2);
  const h1 = await page.locator('h1').first().innerText({ timeout: 1500 }).catch(() => '(pas de h1)');
  const arrivee = new URL(page.url()).pathname;
  const corps = await page.locator('body').innerText().catch(() => '');
  releve.push([statut, chemin + (arrivee !== chemin ? ' → ' + arrivee : ''), (await page.title()).replace(' — Baobart.', '').slice(0, 38), h1.replace(/\s+/g, ' ').slice(0, 34), (Date.now() - t0) + ' ms', /bientôt/i.test(corps) ? 'contient « bientôt »' : '', erreurs.length ? 'ERREURS: ' + [...new Set(erreurs)].join(' | ').slice(0, 200) : ''].filter(x => x !== '').join('  ·  '));
}
return releve;

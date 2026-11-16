const vus = new Map();
const relever = async (ou) => { const liens = await page.$$eval('a[href]', els => els.map(e => ({ href: e.getAttribute('href'), texte: e.textContent.trim().split(' ').filter(Boolean).join(' ').slice(0, 40) }))); for (const { href, texte } of liens) { const chemin = href.split('?')[0]; if (chemin.startsWith('/') && !vus.has(chemin)) vus.set(chemin, ou + ' : « ' + texte + ' »'); } };
await page.goto('/'); await page.waitForTimeout(1500); await relever('accueil');
for (const nom of ['Explorer', 'Créateurs', 'Conditions générales', 'Communauté & Blogs']) { const l = page.getByRole('navigation').first().getByRole('link', { name: nom }).first(); await l.hover().catch(() => {}); await page.waitForTimeout(700); await relever('menu ' + nom); }
const pastille = page.getByText('Serge Nkosi', { exact: true }).or(page.getByText('Invité', { exact: true })).first(); await pastille.click().catch(() => {}); await page.waitForTimeout(700); await relever('menu du compte');
for (const p of ['/explore', '/createurs', '/fonctionnalites', '/tarifs', '/blog', '/support', '/dashboard']) { await page.goto(p); await page.waitForTimeout(900); await relever('page ' + p); }
const cibles = ['/jobs', '/services', '/evenements', '/signalement', '/sponsoriser', '/contact', '/a-propos', '/documentation', '/changelog', '/licences', '/regles-de-publication', '/support', '/blog', '/communautes', '/tarifs'];
return cibles.map(c => c.padEnd(24) + (vus.get(c) ?? '— AUCUN LIEN TROUVÉ'));

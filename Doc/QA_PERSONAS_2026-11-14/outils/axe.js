const pages = (globalThis.__axePages ?? '/,/explore,/products/pack-motifs-wax-12-planches,/inscription,/connexion,/jobs,/evenements,/communautes/etudiants-design-accra-lome,/tarifs,/contact').split(',');
const total = {}; const parPage = [];
for (const chemin of pages) {
  await page.goto(chemin); await page.waitForTimeout(1800);
  const v = await h.axe();
  parPage.push(chemin.padEnd(46) + (v.length ? v.map(x => `${x.regle}(${x.gravite},${x.noeuds})`).join(' ') : 'aucune infraction'));
  for (const x of v) { const t = total[x.regle] ??= { gravite: x.gravite, noeuds: 0, pages: 0, aide: x.aide, exemple: x.exemple }; t.noeuds += x.noeuds; t.pages += 1; }
}
return { parPage, regles: Object.entries(total).map(([r, t]) => `${r} · ${t.gravite} · ${t.noeuds} élément(s) sur ${t.pages} page(s) · ${t.aide} · ex. ${String(t.exemple).slice(0, 70)}`) };

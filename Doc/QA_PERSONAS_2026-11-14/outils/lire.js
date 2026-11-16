// Lit une liste d'écrans et rend, pour chacun, le texte utile (menu et bandeau retirés).
const ecrans = __ECRANS__;
const j = {};
for (const [chemin, depuis, n] of ecrans) {
  const r = await page.goto(chemin, { waitUntil: 'load' }).catch(() => null); await page.waitForTimeout(500);
  const arrive = new URL(page.url()).pathname;
  let t = (await page.locator('body').innerText()).replace(/\s+/g, ' ').replace(/Un seul cookie facultatif.*$/, '').replace(/Baobart\. La communauté créative africaine.*$/, '');
  const i = depuis ? t.search(new RegExp(depuis)) : 0;
  j[chemin] = (arrive !== chemin ? `→ ${arrive} · ` : '') + (r ? '' : '(échec) ') + t.slice(Math.max(0, i), Math.max(0, i) + (n ?? 500));
}
return j;

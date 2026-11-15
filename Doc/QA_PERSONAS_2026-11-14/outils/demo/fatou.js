// Scène de Fatou — acheter depuis Paris.
await seConnecter('__FATOU_COURRIEL__', '__FATOU_MDP__');
h.dire('cherche « wax » dans l\'en-tête'); await page.goto('/', { waitUntil: 'load' }); await refuserCookies();
const r = page.getByRole('textbox', { name: 'Rechercher une ressource' }); await r.click(); await r.pressSequentially('wax', { delay: 220 }); await pause(3000);
h.dire('ouvre la vitrine de la créatrice'); await page.goto('/createurs/awa-diallo', { waitUntil: 'load' }); await pause(3500);
await page.mouse.wheel(0, 500); await pause(2500);
h.dire('veut acheter le pack : quel pays de facturation ?'); await page.goto('/acheter/pack-motifs-wax-12-planches', { waitUntil: 'load' }); await pause(1500);
await page.getByRole('button', { name: 'Bénin' }).scrollIntoViewIfNeeded(); await pause(1500);
h.dire('quatre pays proposés, pas la France, aucun prix en euros'); await pause(7000);
return { pays: await page.getByRole('button', { name: /Sénégal|Côte d.Ivoire|Ghana|Bénin|France/ }).allInnerTexts() };

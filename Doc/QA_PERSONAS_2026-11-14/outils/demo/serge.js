// Scène de Serge — Q-37 puis Q-10.
await seConnecter('__SERGE_COURRIEL__', '__SERGE_MDP__');
h.dire('ouvre sa bibliothèque'); await page.goto('/dashboard/bibliotheque', { waitUntil: 'load' }); await refuserCookies(); await pause(2500);
h.dire('ouvre les fichiers d\'une ressource que la créatrice a dépubliée'); await page.getByRole('link', { name: /Les \d+ fichiers/ }).first().click(); await pause(2500);
h.dire('Q-37 — « Cette page n\'existe pas » : ses fichiers payés sont introuvables'); await pause(6000);
h.dire('achète un pack avec un code promo faux'); await page.goto('/acheter/pack-motifs-wax-12-planches', { waitUntil: 'load' }); await pause(1500);
await page.locator('input[name=codePromo]').pressSequentially('WAX2026', { delay: 120 }); await page.getByRole('button', { name: 'Vérifier' }).click(); await pause(2500);
h.dire('le code est refusé ; il choisit son pays, Wave, et paie');
await page.getByRole('button', { name: "Côte d'Ivoire" }).click(); await pause(900); await page.getByRole('button', { name: /Wave/ }).click(); await pause(1500);
await page.getByRole('button', { name: /^Payer/ }).click(); await pause(3000);
h.dire('Q-10 — renvoyé sur la fiche : pays et moyen de paiement perdus'); await pause(6000);
return { url: page.url() };

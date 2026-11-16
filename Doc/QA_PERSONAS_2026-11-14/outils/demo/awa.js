// Scène d'Awa — Q-38 : la liste réaffiche l'ancien délai après un enregistrement réussi.
await seConnecter('__AWA_COURRIEL__', '__AWA_MDP__');
h.dire('ouvre ses demandes de remboursement'); await page.goto('/dashboard/ventes/remboursements', { waitUntil: 'load' }); await refuserCookies();
const liste = page.locator('select[name=jours]'); await liste.scrollIntoViewIfNeeded(); await pause(2000);
const avant = await liste.inputValue(); const choix = avant === '14' ? '7' : '14';
h.dire(`passe son délai de ${avant} à ${choix} jours, et enregistre`); await liste.selectOption(choix); await pause(1500);
await liste.locator('xpath=ancestor::form[1]').getByRole('button', { name: 'Enregistrer' }).click(); await pause(2500);
h.dire(`Q-38 — le site dit « ${choix} jours », la liste affiche encore ${await liste.inputValue()}`); await pause(6000);
h.dire('recharge la page : la bonne valeur revient'); await page.reload({ waitUntil: 'load' }); await page.locator('select[name=jours]').scrollIntoViewIfNeeded(); await pause(4000);
return { avant, choix };

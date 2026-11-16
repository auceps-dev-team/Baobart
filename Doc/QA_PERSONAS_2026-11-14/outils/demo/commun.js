// Préambule commun à chaque scène de la régie (concaténé devant la scène).
const pause = (ms) => page.waitForTimeout(ms);
const refuserCookies = async () => { const b = page.getByRole('dialog', { name: /cookie/i }).getByRole('button', { name: 'Refuser' }); if (await b.count()) { await b.click(); await pause(600); } };
const seConnecter = async (email, mdp) => {
  h.dire('se connecte');
  await page.goto('/connexion', { waitUntil: 'load' }); await refuserCookies();
  await page.getByRole('textbox', { name: /mail/i }).pressSequentially(email, { delay: 45 });
  await page.getByRole('textbox', { name: 'Mot de passe' }).pressSequentially(mdp, { delay: 45 });
  await pause(500); await page.getByRole('button', { name: 'Se connecter' }).last().click(); await pause(2500);
};

// Scène de Yao — Q-02 : une erreur vide tout le formulaire d'inscription.
const t = (nom) => page.getByRole('textbox', { name: nom, exact: true });
h.dire('ouvre l\'inscription'); await page.goto('/inscription', { waitUntil: 'load' }); await refuserCookies(); await pause(1500);
h.dire('remplit le formulaire, mot de passe de 7 caractères');
for (const [nom, valeur] of [['Prénom', 'Kwabena'], ['Nom', 'Darko'], ["Nom d'utilisateur", 'kwabena-darko'], ['Email', 'kwabena.darko@campus-accra.test'], ['Mot de passe', 'accra21']]) { await t(nom).scrollIntoViewIfNeeded(); await t(nom).pressSequentially(valeur, { delay: 90 }); await pause(300); }
await page.getByRole('checkbox').check(); await pause(1500);
h.dire('touche « Créer mon compte gratuit »'); await page.getByRole('button', { name: 'Créer mon compte gratuit' }).click(); await pause(2500);
await page.getByRole('alert').filter({ hasText: /8 caractères/ }).first().scrollIntoViewIfNeeded().catch(() => {});
h.dire('Q-02 — refusé pour un caractère : les six champs sont vidés');
await pause(6000);
return { courrielRestant: await t('Email').inputValue() };

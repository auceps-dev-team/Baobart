/**
 * Un traducteur de navigateur, réduit à son mécanisme (piste 5, 14/11/2026).
 *
 * La traduction automatique de Chrome ne change pas « le texte » : elle
 * REMPLACE chaque nœud de texte de la page par deux balises <font> emboîtées
 * qui portent la traduction, et elle recommence dès que la page ajoute du
 * texte. C'est ce remplacement, pas la qualité de la traduction, qui met une
 * application à l'épreuve : l'application croit toujours tenir ses nœuds de
 * texte, alors qu'ils ne sont plus dans la page.
 *
 * Ici la « traduction » consiste à mettre le texte entre crochets ⟦ ⟧ : on voit
 * d'un coup d'œil ce qui est passé par le traducteur et ce qui lui a échappé.
 *
 * À injecter dans une page : `await page.addScriptTag({ path: 'qa/traducteur.js' })`.
 */
(() => {
  if (window.__traducteur) return;
  const EXCLUS = "script,style,noscript,textarea,code,[translate=no],.notranslate,font[data-traduit]";
  const traduire = (racine) => {
    const marcheur = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
    const noeuds = [];
    while (marcheur.nextNode()) {
      const n = marcheur.currentNode;
      if (n.nodeValue.trim() && n.parentElement && !n.parentElement.closest(EXCLUS)) noeuds.push(n);
    }
    for (const n of noeuds) {
      const dehors = document.createElement("font");
      dehors.setAttribute("data-traduit", "1");
      dehors.style.verticalAlign = "inherit";
      const dedans = document.createElement("font");
      dedans.style.verticalAlign = "inherit";
      dedans.textContent = `⟦${n.nodeValue}⟧`;
      dehors.appendChild(dedans);
      n.parentNode.replaceChild(dehors, n);
    }
    return noeuds.length;
  };
  const premiers = traduire(document.body);
  document.documentElement.lang = "en";
  document.documentElement.classList.add("translated-ltr");
  // Comme le vrai : tout texte ajouté ensuite est traduit à son tour.
  const veilleur = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const ajoute of m.addedNodes) {
        if (ajoute.nodeType === Node.TEXT_NODE && ajoute.parentElement) traduire(ajoute.parentElement);
        else if (ajoute.nodeType === Node.ELEMENT_NODE && !ajoute.matches("font[data-traduit]")) traduire(ajoute);
      }
    }
  });
  veilleur.observe(document.body, { childList: true, subtree: true });
  window.__traducteur = { premiers };
})();

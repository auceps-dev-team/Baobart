/*
 * Le service worker de Baobart.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IL NE MET RIEN EN CACHE, ET C'EST VOLONTAIRE
 *
 * Un service worker sert deux choses : recevoir des notifications, et servir
 * hors ligne. La tentation est de faire les deux d'un coup. On ne le fait pas,
 * pour une raison qu'on regretterait sinon :
 *
 * Baobart est une application où l'argent circule. Un cache mal invalidé sert
 * une page périmée — un prix d'hier, un solde d'avant le versement, un bouton
 * « Acheter » sur une ressource retirée. Et un service worker se désinstalle
 * mal : une mauvaise version reste chez les visiteurs des semaines durant,
 * hors de portée d'un déploiement.
 *
 * Ce fichier fait donc UNE chose. Le hors-ligne viendra quand on saura
 * précisément quelles pages peuvent se permettre d'être vieilles.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IL PREND LA MAIN TOUT DE SUITE
 *
 * `skipWaiting` et `clients.claim` : sans eux, une version corrigée attendrait
 * que tous les onglets soient fermés. Comme il n'y a pas de cache, prendre la
 * main immédiatement ne peut rien casser — et c'est ce qui rend ce fichier
 * réparable à distance.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (evenement) => {
  evenement.waitUntil(self.clients.claim());
});

/**
 * Une notification arrive.
 *
 * Le corps est le JSON déposé par `lib/push/pilotes.ts`. On se garde d'un
 * message vide ou illisible : certains services de poussée envoient un
 * événement sans charge pour vérifier que l'abonnement vit, et une exception
 * ici ferait passer l'abonnement pour cassé.
 */
self.addEventListener("push", (evenement) => {
  let charge = null;
  try {
    charge = evenement.data ? evenement.data.json() : null;
  } catch {
    charge = null;
  }

  const titre = (charge && charge.titre) || "Baobart";
  const options = {
    body: (charge && charge.corps) || "",
    icon: "/icones/icone-192.png",
    // La pastille monochrome de la barre d'état Android. Sans elle, le système
    // affiche un carré gris.
    badge: "/icones/badge-96.png",
    // Regroupe : deux relances du même abonnement se remplacent au lieu de
    // s'empiler.
    tag: (charge && charge.etiquette) || undefined,
    renotify: Boolean(charge && charge.etiquette),
    data: { lien: (charge && charge.lien) || "/dashboard/abonnements" },
  };

  evenement.waitUntil(self.registration.showNotification(titre, options));
});

/**
 * Le clic sur une notification.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ON RÉUTILISE UN ONGLET OUVERT PLUTÔT QUE D'EN OUVRIR UN DE PLUS
 *
 * Quelqu'un qui a déjà Baobart ouvert et clique sur trois relances se
 * retrouverait sinon avec trois onglets. On cherche donc une fenêtre existante,
 * on la ramène au premier plan, et on la navigue.
 */
self.addEventListener("notificationclick", (evenement) => {
  evenement.notification.close();

  const lien = (evenement.notification.data && evenement.notification.data.lien) || "/";

  evenement.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((fenetres) => {
        for (const fenetre of fenetres) {
          // Même origine seulement : `navigate` échoue en travers des origines,
          // et le lien vient toujours de chez nous.
          if (new URL(fenetre.url).origin === self.location.origin) {
            return fenetre.focus().then((f) => (f.navigate ? f.navigate(lien) : f));
          }
        }
        return self.clients.openWindow(lien);
      }),
  );
});

/**
 * L'abonnement a été renouvelé par le navigateur.
 *
 * Cela arrive tout seul, sans que la personne fasse rien : le service de
 * poussée fait tourner ses endpoints. Sans ce gestionnaire, l'ancien endpoint
 * meurt en silence et les relances cessent d'arriver — sans que rien, nulle
 * part, ne le signale.
 *
 * On ne peut pas rechiffrer ici (les clés du nouvel abonnement sont dans
 * l'événement, mais la session ne l'est pas) : on prévient les onglets ouverts,
 * qui réenregistreront. Si aucun n'est ouvert, le prochain chargement de page
 * s'en chargera — `NotificationsBaobart` réenregistre à chaque montage.
 */
self.addEventListener("pushsubscriptionchange", (evenement) => {
  evenement.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((f) => {
      for (const fenetre of f) fenetre.postMessage({ type: "push-a-reinscrire" });
    }),
  );
});

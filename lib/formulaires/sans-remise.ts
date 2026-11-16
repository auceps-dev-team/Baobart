import { startTransition, type FormEvent } from "react";

/**
 * Envoyer un formulaire SANS que React le remette à zéro.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI
 *
 * Depuis React 19, un `<form action={…}>` est remis à zéro dès que son action
 * rend la main — refus compris. Tout champ que la réponse du serveur ne
 * réalimente pas se vide, et une liste `<select defaultValue>` revient à sa
 * première option même quand la réponse porte la bonne valeur.
 *
 * Mesuré par la recette du 14/11/2026 (`Doc/QA_PERSONAS_2026-11-14.md`) :
 *   — Q-02 : un mot de passe d'un caractère trop court vidait les six champs
 *     de l'inscription ;
 *   — Q-05 : une offre de « Stage » partait enregistrée en « Freelance », la
 *     liste ayant repris sa valeur par défaut après un premier refus.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * COMMENT
 *
 * La remise à zéro n'a lieu que lorsque c'est React qui déclenche l'action
 * depuis l'attribut `action`. Appelée à la main, dans une transition, la même
 * action s'exécute et le formulaire garde ce que la personne a saisi.
 *
 *     <form action={envoyer} onSubmit={sansRemiseAZero(envoyer)}>
 *
 * `action` reste : sans JavaScript, le formulaire part encore, par le chemin
 * ordinaire. Le bouton cliqué est transmis (`submitter`), pour les formulaires
 * qui en ont plusieurs.
 *
 * Après un SUCCÈS, le formulaire n'est donc plus vidé non plus : un écran qui
 * reste en place après avoir réussi (un commentaire publié, par exemple) doit
 * garder la remise à zéro de React, ou vider ses champs lui-même.
 */
export function sansRemiseAZero(envoyer: (donnees: FormData) => void) {
  return (evenement: FormEvent<HTMLFormElement>) => {
    evenement.preventDefault();
    const bouton = (evenement.nativeEvent as SubmitEvent).submitter;
    const donnees = new FormData(evenement.currentTarget, bouton);
    startTransition(() => envoyer(donnees));
  };
}

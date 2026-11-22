/**
 * Le changelog public.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * RÉDIGÉ DEPUIS L'HISTORIQUE, PAS RECOPIÉ
 *
 * Écrit le 04/10 à partir de `git log` : chaque entrée garde la version et la
 * date du commit qui l'a livrée. Les sujets de commit sont écrits pour ceux
 * qui maintiennent le code (« prouvée contre la RFC », « servis depuis MinIO
 * ») ; ceux-ci disent la même chose à ceux qui utilisent le site. Ce qui ne se
 * voit pas — la CI, la supervision, les données de démonstration — n'y figure
 * pas.
 *
 * La maquette (`DOCS.changelog`) annonçait trois entrées inventées (« Juillet
 * 2026 — Espaces d'équipe », « Juin 2026 — Filtres par type », « Mai 2026 —
 * Paiement Mobile Money ») : aucune ne correspond à une livraison.
 *
 * À compléter à chaque version mineure qui change ce qu'on voit.
 *
 * Complété le 17/10 de v1.84.0 à v1.98.0, depuis les messages de commit. Le
 * même jour, l'entrée v1.48.9 a perdu « et avatar » : aucun code n'écrivait
 * l'avatar avant v1.94.0 (relu dans lib, app, components, prisma, scripts).
 *
 * Complété le 22/11 de v1.101.0 à v1.115.1, depuis TACHES.md et les messages
 * de commit.
 */

export interface EntreeChangelog {
  /** AAAA-MM-JJ, la date du commit. */
  date: string;
  version: string;
  titre: string;
  texte: string;
}

export const CHANGELOG: readonly EntreeChangelog[] = [
  { date: "2026-11-22", version: "1.115.1", titre: "Un site plus lisible partout", texte: "Tous les textes trop pâles ont été renforcés sur l'ensemble des pages, sur ordinateur comme sur téléphone, pour rester lisibles sur chaque fond coloré." },
  { date: "2026-11-21", version: "1.115.0", titre: "La liste de tes abonnés", texte: "Un nouvel écran « Abonnés » rassemble celles et ceux qui te suivent, avec un bouton « Message » quand leur vitrine est ouverte aux messages. Chaque notification « Nouvel abonné » nomme la personne et t'emmène sur cette liste." },
  { date: "2026-11-21", version: "1.114.10", titre: "Une vraie recherche dans tes ventes", texte: "Sur ton écran Ventes, tu peux filtrer par ressource, acheteur ou référence, et ta recherche reste active quand tu changes d'état ou de page. L'écran remonte désormais jusqu'aux cinq cents dernières ventes et t'avertit s'il y en a davantage." },
  { date: "2026-11-21", version: "1.114.9", titre: "Remboursements déduits et suivi au huitième jour", texte: "Un remboursement fait juste avant un versement en est maintenant déduit, au lieu d’attendre le versement suivant, et ton écran Gains annonce le même montant. Si une demande de remboursement reste sept jours sans réponse, toi et l'équipe êtes prévenus au huitième jour, et l'acheteur voit « Transmise à l'équipe »." },
  { date: "2026-11-21", version: "1.114.7", titre: "Les graphiques lisibles sur téléphone", texte: "Sur téléphone, le graphique « par mois » de ton accueil créateur, de ton Aperçu et de Statistiques garde ses six barres côte à côte sans déborder sur la carte suivante." },
  { date: "2026-11-21", version: "1.114.5", titre: "La recherche trouve aussi les créateurs", texte: "Dans la barre de recherche de l'en-tête, les suggestions affichent l'aperçu des ressources, trouvent les créateurs par leur nom ou leur pseudo, et la touche Entrée ouvre le premier résultat." },
  { date: "2026-11-21", version: "1.114.4", titre: "Heure d'Abidjan et navigation au clavier", texte: "Les horaires des événements précisent désormais l'heure d'Abidjan (GMT), les onglets du navigateur affichent le titre exact de chaque page ou communauté, et le menu de ton compte s'ouvre au clavier." },
  { date: "2026-11-21", version: "1.114.3", titre: "Tes soldes disent la même chose partout", texte: "Le solde affiché sur ton tableau de bord suit désormais exactement l'écran Gains en précisant ce qui reste retenu. Tu es prévenu par notification et par courriel si l'équipe rembourse à ta place, et un fichier dont l'accès est retiré affiche « ACCÈS CLOS » dans l'historique." },
  { date: "2026-11-21", version: "1.114.2", titre: "Publier et remplir ton profil plus facilement", texte: "À la publication, ton délai de remboursement s'affiche et toutes les erreurs apparaissent d'un coup. Sur ton profil et tes fiches, « https:// » se complète tout seul sur les liens, l'indicatif pays est guidé pour ton numéro mobile, et le pays se choisit dans une liste de soixante-dix pays." },
  { date: "2026-11-21", version: "1.114.1", titre: "Textes, liens et cadence clarifiés", texte: "« Règles de publication » et « Support » s'ouvrent depuis le menu de compte, et les conditions pour proposer un service sont précisées. La cadence mensuelle des versements est indiquée de façon cohérente sur tous les écrans, et plusieurs libellés et accords ont été corrigés." },
  { date: "2026-11-21", version: "1.114.0", titre: "Des listes paginées dans ton tableau de bord", texte: "Dix listes de ton espace — bibliothèque, achats, commandes, remboursements, ventes… — sont paginées pour rester lisibles à côté du menu, et la légende des états se replie sur l'écran Ventes." },
  { date: "2026-11-20", version: "1.113.2", titre: "« Mes offres », déconnexion et retours de connexion", texte: "Les recruteurs retrouvent leurs missions et leurs candidatures sur la page « Mes offres ». Le tableau de bord porte un bouton « Se déconnecter », vingt-cinq écrans te ramènent où tu allais après connexion, et la touche Échap ne ferme plus la fiche ni n'efface l'état d'une collection depuis la fenêtre d'épingle." },
  { date: "2026-11-20", version: "1.113.1", titre: "Compatible avec la traduction du navigateur", texte: "Si tu actives la traduction automatique de ton navigateur, cliquer sur « J'aime » ou « Suivre » ne fait plus planter la page, et le compteur de la mosaïque suit le filtre choisi." },
  { date: "2026-11-20", version: "1.113.0", titre: "Ton certificat de licence", texte: "Dans « Ma bibliothèque », le bouton « Licence » ouvre un certificat imprimable qui prouve ton achat et précise tes droits. Il se marque révoqué avec son motif après un remboursement intégral, une contestation ou un retrait d'accès." },
  { date: "2026-11-20", version: "1.112.0", titre: "Un vrai confort sur téléphone", texte: "Sur petit écran, l'en-tête tient sur deux lignes avec un bouton « Menu », et une barre d'onglets en bas te donne Accueil, Explorer, Achats, Atelier et Profil. Les sous-menus s'ouvrent au premier toucher, le tableau de bord replie sa navigation derrière « Menu de l'espace », et le prix passe avant la discussion sur chaque fiche." },
  { date: "2026-11-20", version: "1.108.11", titre: "Écrans plus solides sur mobile et sur les textes longs", texte: "Les titres très longs et les valeurs extrêmes ne cassent plus la fiche, le catalogue ni tes listes. Les champs restent lisibles sans zoom forcé sur téléphone, chaque champ de campagne publicitaire porte son libellé, le réglage « réduire les animations » est respecté, et les limites de longueur s'appliquent dès l'inscription." },
  { date: "2026-11-20", version: "1.108.6", titre: "Inscription, ressources retirées et collections partagées", texte: "Une faute de frappe à l'inscription ne te bloque plus prématurément. Une ressource retirée de la vente reste accessible sur sa fiche à celui qui l'a obtenue, et une collection partagée s'ouvre directement depuis sa communauté." },
  { date: "2026-11-16", version: "1.108.3", titre: "Formulaires et paiements plus sûrs", texte: "Ta saisie reste en place quand un formulaire refuse ton envoi, les erreurs de ton profil apparaissent directement sous tes yeux, « Rembourser » demande confirmation, « Payer » annonce le bon montant et un code promo refusé n'est pas envoyé." },
  { date: "2026-11-14", version: "1.109.0", titre: "De nouvelles icônes partout sur le site", texte: "Les icônes dessinées pour Baobart remplacent les anciens symboles dans tous les menus, les médaillons, les cartes et les notes, avec un geste de pression net sur les boutons." },
  { date: "2026-11-14", version: "1.108.1", titre: "Noter les ressources offertes", texte: "Après avoir téléchargé une ressource gratuite, tu peux désormais lui laisser une note et un avis sur sa fiche, comme pour un achat." },
  { date: "2026-11-14", version: "1.107.1", titre: "Ton adresse e-mail reste cachée sur les pages publiques", texte: "Aucune page publique — missions, services, blog, événements ou communautés — n'affiche plus l'adresse e-mail d'un compte sans profil renseigné : « Membre Baobart » apparaît à sa place." },
  { date: "2026-11-13", version: "1.107.0", titre: "Devenir vendeur, en trois étapes", texte: "Une nouvelle page « Devenir vendeur » t'accompagne pour ouvrir ta boutique : compléter ton profil public, enregistrer ton compte de versement et publier tes premières ressources. Tu peux préparer ton « Profil de la boutique » dès ton espace acheteur." },
  { date: "2026-11-13", version: "1.106.0", titre: "Les avis notés", texte: "Chaque fiche affiche désormais sa note moyenne, la répartition par étoile et les avis de ceux qui ont obtenu la ressource. Côté créateur, l'écran « Avis & commentaires » rassemble tes avis reçus pour filtrer ceux sans réponse et y répondre un par un." },
  { date: "2026-11-09", version: "1.105.1", titre: "Les mérites et « Mes badges »", texte: "Vingt mérites constatent ton activité — ancienneté, publications, ventes, qualité et communauté — dont « Créateur du mois » calculé chaque jour. L'écran « Mes badges » sépare tes statuts et tes mérites et te montre les trois dont tu es le plus proche ; ton profil les affiche en deux rangées et tes vignettes portent ton écusson." },
  { date: "2026-11-04", version: "1.104.0", titre: "Les statuts vérifiés et la publication de services", texte: "L'équipe peut accorder et retirer les statuts vérifiés — Créateur vérifié, Freelance, Agence et Recruteur vérifié — après contrôle. Les comptes Freelance et Agence peuvent de nouveau publier leurs services." },
  { date: "2026-11-04", version: "1.103.3", titre: "Navigation plus fluide dans l'en-tête", texte: "Les menus du haut changent de page sans recharger tout le site, et un compte acheteur est renvoyé vers son Aperçu au lieu d'ouvrir des écrans vendeur vides." },
  { date: "2026-10-31", version: "1.103.0", titre: "« Ma bibliothèque »", texte: "Tout ce que tu possèdes est rassemblé au même endroit, classé par titre et non par numéro de commande, avec ce que tu n'as pas encore téléchargé en premier." },
  { date: "2026-10-31", version: "1.102.8", titre: "Remboursements au montant juste", texte: "Un remboursement partiel depuis ton écran Ventes enregistre désormais le montant exact que tu saisis au lieu de la vente entière, et le pourboire est bien inclus dans la somme remboursable." },
  { date: "2026-10-29", version: "1.102.3", titre: "Ton Aperçu acheteur", texte: "Un écran dédié rassemble ton activité du mois : téléchargements sur six mois, quota, achats récents, collections et créateurs suivis — accessible même si tu as aussi une boutique." },
  { date: "2026-10-29", version: "1.102.2", titre: "Un tableau de bord repensé", texte: "Ton espace adopte sa nouvelle mise en page : accueil créateur avec tes chiffres du mois, Profil séparé de Profil de la boutique, Statistiques, Commandes regroupées et Commissions filtrables par période. Forfait tient en deux cartes, Remboursements explique le parcours en trois étapes et Ventes se pagine." },
  { date: "2026-10-27", version: "1.100.1", titre: "Tu reviens là où tu étais", texte: "Connecte-toi depuis une vitrine, une offre ou un événement : tu y retournes, au lieu d'atterrir sur ton tableau de bord. Même chose en créant ton compte." },
  { date: "2026-10-27", version: "1.100.0", titre: "On t'écrit depuis ta vitrine", texte: "Un bouton « Contact » sur ta page publique : le message t'arrive par courriel, et ton adresse ne part que si tu réponds. Tu le fermes d'un clic depuis ton profil." },
  { date: "2026-10-24", version: "1.99.0", titre: "Ton compte de versement, confirmé par un code", texte: "Changer le compte où part ton argent demande désormais un code : celui de ton application d'authentification si tu en as une, sinon un code reçu par courriel. Il ne vaut que pour le numéro qu'il annonce, et un courriel te prévient à chaque changement." },
  { date: "2026-10-17", version: "1.98.0", titre: "Ta copie de référence", texte: "Chaque image que tu vends porte ta mention de licence, et l'écran de la ressource te garde une copie de référence en cas de litige. L'acheteur ne la voit jamais." },
  { date: "2026-10-17", version: "1.97.0", titre: "Pas d'entraînement d'IA sans accord", texte: "Le site déclare, dans le format standard que les robots savent lire, que ses œuvres ne sont pas offertes à l'entraînement d'IA." },
  { date: "2026-10-16", version: "1.96.0", titre: "Les vues de ton profil", texte: "Ta vitrine affiche combien de visiteurs elle reçoit : une vue par personne et par jour, sans cookie, et les robots ne comptent pas." },
  { date: "2026-10-16", version: "1.95.0", titre: "Les onglets du profil", texte: "Ressources, Services, Collections et À propos. On cherche dans ton portfolio, on filtre par catégorie, on trie, et les pages se numérotent." },
  { date: "2026-10-16", version: "1.94.0", titre: "Ta photo et ta bannière", texte: "Téléverse-les depuis ton profil. On publie une copie réduite, débarrassée de ce que la photo disait de l'endroit où elle a été prise." },
  { date: "2026-10-16", version: "1.93.0", titre: "Partager une ressource", texte: "Sous chaque fiche et chaque article, une rangée pour partager sur WhatsApp, Facebook, X, LinkedIn, Pinterest ou Threads, par courriel ou en copiant le lien. Le lien partagé montre la couverture de la ressource." },
  { date: "2026-10-16", version: "1.92.0", titre: "Tes réseaux sur ta vitrine", texte: "Douze réseaux, d'Instagram à WhatsApp, s'ajoutent depuis ton profil. Chaque logo mène sur son réseau, et nulle part ailleurs." },
  { date: "2026-10-15", version: "1.91.0", titre: "Une alerte quand ton compte de versement change", texte: "Un courriel te prévient dès que la destination de tes versements change : tu as le temps de réagir avant le premier départ." },
  { date: "2026-10-15", version: "1.90.0", titre: "Un fichier hébergé ailleurs", texte: "Vends un fichier qui reste sur Drive, Dropbox ou ton site : l'acheteur reçoit le lien après paiement, et la fiche dit où il est hébergé." },
  { date: "2026-10-09", version: "1.87.0", titre: "Les robots d'entraînement refusés", texte: "Les robots qui collectent des images pour entraîner des IA sont refusés, et chaque aperçu porte la réserve qui l'interdit." },
  { date: "2026-10-09", version: "1.86.0", titre: "Des aperçus filigranés", texte: "Les aperçus publics portent ton pseudo en filigrane et passent à 800 px. Le fichier que reçoit l'acheteur reste intact." },
  { date: "2026-10-08", version: "1.84.0", titre: "Se connecter par téléphone", texte: "Un code à six chiffres par SMS, une fois ton numéro prouvé depuis ton profil." },
  { date: "2026-10-08", version: "1.80.0", titre: "La lettre d'information part", texte: "L'équipe écrit et envoie ses numéros aux adresses confirmées. Chacun porte son lien de désinscription, et aucune image de suivi." },
  { date: "2026-10-08", version: "1.79.0", titre: "Demander un remboursement", texte: "Chaque créateur affiche son délai de remboursement sur ses fiches. Dans ce délai, l'acheteur demande depuis son espace ; le créateur accepte ou refuse avec un motif, et sans réponse sous sept jours l'équipe tranche." },
  { date: "2026-10-08", version: "1.78.0", titre: "Accès libre", texte: "Un forfait gratuit pour tous, activé d'un clic : toutes les ressources offertes sans limite, les collections, les communautés. Les forfaits payants sont annoncés, grisés, en attendant l'ouverture de leur paiement." },
  { date: "2026-10-08", version: "1.77.2", titre: "La recherche lit les mots-clés", texte: "Après le titre, la recherche de l'en-tête lit les mots-clés des ressources, accents et majuscules ignorés." },
  { date: "2026-10-04", version: "1.77.0", titre: "La lettre d'information", texte: "Inscris-toi depuis le pied de page : un courriel de confirmation, puis rien sans ton clic. Désinscription en un lien." },
  { date: "2026-10-04", version: "1.76.0", titre: "Les pages d'information", texte: "À propos, Fonctionnalités, Tarifs, Support, Documentation, Conditions, Confidentialité, Règles de publication, et des formulaires Contact et Sponsoriser qui écrivent à l'équipe." },
  { date: "2026-10-04", version: "1.75.0", titre: "Ta clé de licence", texte: "Chaque achat montre sa clé de licence sur la fiche de la ressource, et les créateurs peuvent la faire vérifier par leur programme. Une page Licences explique ce que chacune permet." },
  { date: "2026-10-04", version: "1.74.0", titre: "Les collections", texte: "Range des ressources dans tes collections, privées ou publiques, depuis la mosaïque ou la fiche. L'accueil montre tes espaces et tes collections." },
  { date: "2026-10-04", version: "1.73.0", titre: "Les témoignages des membres", texte: "Chaque membre peut proposer son témoignage ; il paraît sur l'accueil après relecture." },
  { date: "2026-10-03", version: "1.72.0", titre: "Ton choix sur les cookies", texte: "Une bannière te demande ton accord pour la mesure des cartes sponsorisées, et la politique de cookies dit à quoi sert chacun." },
  { date: "2026-10-03", version: "1.71.0", titre: "Les cartes sponsorisées", texte: "Des cartes sponsorisées, image ou vidéo, prennent place dans la mosaïque, au format des ressources." },
  { date: "2026-10-03", version: "1.70.0", titre: "Une vraie mosaïque", texte: "La grille se range en colonnes, chaque ressource à sa hauteur." },
  { date: "2026-09-24", version: "1.69.0", titre: "Le retrait sur notification", texte: "Une ressource retirée à la suite d'un signalement n'est plus livrée, et son créateur est prévenu avec un délai pour répondre." },
  { date: "2026-09-24", version: "1.67.0", titre: "Prix libre et pourboires", texte: "Un créateur peut laisser l'acheteur choisir son prix au-dessus d'un minimum, et l'acheteur peut ajouter un pourboire." },
  { date: "2026-09-23", version: "1.66.0", titre: "Des questions à l'achat", texte: "Un créateur peut poser des questions à l'acheteur au moment de payer." },
  { date: "2026-09-23", version: "1.65.0", titre: "Une offre après l'achat", texte: "Après un achat, le créateur peut proposer une autre de ses ressources." },
  { date: "2026-09-23", version: "1.64.0", titre: "Un paiement en attente se reprend", texte: "Un paiement mobile money resté sans réponse donne lieu à une seule relance, avec le lien pour reprendre." },
  { date: "2026-09-23", version: "1.63.0", titre: "Les codes promo", texte: "Les créateurs créent leurs codes de réduction, et la commission de Baobart baisse avec la remise." },
  { date: "2026-09-23", version: "1.62.0", titre: "Les clés d'accès", texte: "Connecte-toi avec l'empreinte ou le visage de ton téléphone, sans mot de passe." },
  { date: "2026-09-23", version: "1.61.0", titre: "Effacer son compte", texte: "Demande l'effacement de ton compte depuis ton profil : trente jours pour changer d'avis, puis tout ce qui te désigne part." },
  { date: "2026-09-23", version: "1.60.0", titre: "La double authentification", texte: "Protège ton compte avec un code à six chiffres, depuis une application d'authentification." },
  { date: "2026-09-19", version: "1.57.0", titre: "Signalement et retrait", texte: "Une procédure pour signaler un contenu qui porte atteinte à tes droits, selon la loi ivoirienne." },
  { date: "2026-09-18", version: "1.54.0", titre: "Les communautés", texte: "Des espaces où les créateurs se parlent : sujets, réponses, membres et modération, et des collections partagées." },
  { date: "2026-09-17", version: "1.53.0", titre: "Le blog", texte: "Les articles de l'équipe : coulisses, guides et portraits." },
  { date: "2026-09-14", version: "1.52.0", titre: "Les notifications", texte: "Une vente, un achat, un versement, un nouvel abonné : dans la cloche, et par courriel selon tes réglages." },
  { date: "2026-09-11", version: "1.49.0", titre: "Les événements", texte: "Ateliers, concours et expositions, avec inscription en ligne et places comptées." },
  { date: "2026-09-11", version: "1.48.9", titre: "Ton profil se modifie", texte: "Bio, ville, spécialité et liens se changent depuis ton tableau de bord." },
  { date: "2026-09-04", version: "1.48.0", titre: "Les services", texte: "Les créateurs proposent leurs prestations, et on les contacte directement." },
  { date: "2026-09-03", version: "1.46.0", titre: "Les offres de missions", texte: "Des missions à saisir, et la candidature en ligne." },
  { date: "2026-09-02", version: "1.41.0", titre: "Baobart s'installe", texte: "Ajoute Baobart à l'écran d'accueil de ton téléphone, et reçois ses notifications." },
  { date: "2026-09-01", version: "1.36.0", titre: "Le remboursement", texte: "Un créateur rembourse une vente depuis son écran Ventes, en tout ou en partie, et l'argent repart." },
  { date: "2026-08-31", version: "1.33.0", titre: "Les versements aux créateurs", texte: "Le solde des créateurs part chaque semaine, par mobile money ou virement." },
  { date: "2026-08-30", version: "1.30.0", titre: "Payer en mobile money", texte: "Le paiement passe par les opérateurs, et le mot de passe oublié se réinitialise par courriel." },
  { date: "2026-08-04", version: "1.16.0", titre: "L'écran Gains", texte: "Ce qui est disponible, en attente, et la date du prochain versement." },
  { date: "2026-08-03", version: "1.13.0", titre: "Aimer, suivre, commenter", texte: "Aime une ressource, suis un créateur, commente sur la fiche." },
  { date: "2026-08-03", version: "1.11.0", titre: "Télécharger ce qu'on a acheté", texte: "Un achat ouvre le téléchargement, depuis la fiche ou tes téléchargements." },
  { date: "2026-08-03", version: "1.8.0", titre: "Publier une ressource", texte: "Dépose tes fichiers, fixe ton prix, publie — et retire ou supprime quand tu veux." },
  { date: "2026-08-03", version: "1.3.0", titre: "Les comptes", texte: "Inscription et connexion par adresse e-mail et mot de passe." },
  { date: "2026-08-02", version: "0.8.0", titre: "La bibliothèque", texte: "La mosaïque des ressources, branchée sur la base." },
];

repo: auceps-dev-team/Baobart
branch: main
path: app/dashboard/

## Last sync
date: 2026-11-04T08:20:24Z

### Updated in this project
- Dashboard : 22 écrans ajoutés d'après le code (notifications, dossiers, candidatures, promos, messages, événements, publicités, infolettre, témoignages, blog, remboursements à trancher, liste de blocage)
- Commandes : états « en attente » et « échouée / abandonnée » alignés sur `app/dashboard/commandes`

## Screen map
| Écran | Fichiers du repo |
| --- | --- |
| Dashboard · Notifications (+ réglages) | app/dashboard/notifications/page.tsx, notifications/reglages/page.tsx, lib/notifications/catalogue.ts |
| Dashboard · Mes dossiers | app/dashboard/mes-dossiers/page.tsx |
| Dashboard · Candidatures | app/dashboard/jobs/[id]/candidatures/page.tsx |
| Dashboard · Promotions | app/dashboard/promos/page.tsx |
| Dashboard · Commandes | app/dashboard/commandes/page.tsx |
| Dashboard · Messages reçus | app/dashboard/messages-recus/page.tsx |
| Dashboard · Remboursements à trancher | app/dashboard/remboursements-a-trancher/page.tsx |
| Dashboard · Événements (liste, fiche, inscrits, nouveau) | app/dashboard/evenements/** |
| Dashboard · Publicités | app/dashboard/publicites/** |
| Dashboard · Lettre d'information | app/dashboard/infolettre/page.tsx |
| Dashboard · Témoignages | app/dashboard/temoignages/page.tsx |
| Dashboard · Blog | app/dashboard/blog/** |
| Dashboard · Système · Liste de blocage | app/dashboard/systeme/blocklist/page.tsx |
| Dashboard · Profil public / Membres | app/dashboard/boutique, systeme/membres (déjà conformes) |
| Parcours Achat · paiement, retour, erreur, chargement | Doc/MAQUETTES_A_FAIRE.md (déjà dessinés) |

## Références
- emilkowalski/skills@main → `skills/` (règles UI/animation, voir CLAUDE.md)

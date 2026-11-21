-- Q-40 (recette du 14/11/2026) : le créateur n'apprenait pas que l'équipe avait
-- remboursé à sa place une demande restée sans réponse — il le découvrait par
-- une ligne « Tu dois » sur l'écran des gains. Un courriel le lui dit.
ALTER TYPE "EmailTemplate" ADD VALUE 'REMBOURSE_PAR_EQUIPE';

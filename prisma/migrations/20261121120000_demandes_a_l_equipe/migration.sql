-- Q-39 (recette du 14/11/2026, décidé le 21/11) : au huitième jour sans
-- réponse du créateur, une demande de remboursement passait à l'équipe sans
-- que personne en soit prévenu. Le créateur apprend qu'elle est transmise ;
-- l'équipe, qu'elle l'attend.
ALTER TYPE "EmailTemplate" ADD VALUE 'DEMANDE_TRANSMISE';
ALTER TYPE "EmailTemplate" ADD VALUE 'DEMANDE_A_TRANCHER';

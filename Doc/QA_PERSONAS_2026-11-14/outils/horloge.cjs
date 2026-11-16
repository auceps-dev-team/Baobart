/**
 * L'horloge décalée du QA (piste 3, 14/11/2026).
 *
 * Chargée avant l'application (`NODE_OPTIONS=--require ./qa/horloge.cjs`), elle
 * fait croire au serveur qu'il est plus tard : `QA_DECALAGE_JOURS=8` ajoute
 * huit jours à chaque lecture de l'heure. Les données ne sont pas touchées :
 * c'est le serveur qui vieillit, pas les lignes de la base.
 *
 * CE QUE ÇA NE DÉPLACE PAS, et qu'il faut savoir en lisant un résultat :
 *   - PostgreSQL garde l'heure vraie : une ligne créée pendant le décalage
 *     reçoit sa date par défaut (`CURRENT_TIMESTAMP`) à l'heure vraie ;
 *   - MinIO aussi : un lien de fichier signé avec huit jours d'avance est
 *     refusé par le stockage. Ne rien conclure d'un téléchargement ou d'un
 *     dépôt fait sous décalage ;
 *   - le navigateur aussi : ses cookies expirent à l'heure vraie.
 */
const jours = Number(process.env.QA_DECALAGE_JOURS ?? 0);
const heures = Number(process.env.QA_DECALAGE_HEURES ?? 0);
const decalage = jours * 86_400_000 + heures * 3_600_000;

if (decalage !== 0) {
  const Vraie = Date;
  function Decalee(...a) {
    if (!new.target) return new Vraie(Vraie.now() + decalage).toString();
    return a.length === 0 ? new Vraie(Vraie.now() + decalage) : new Vraie(...a);
  }
  Decalee.prototype = Vraie.prototype;
  Decalee.now = () => Vraie.now() + decalage;
  Decalee.parse = Vraie.parse;
  Decalee.UTC = Vraie.UTC;
  globalThis.Date = Decalee;
  console.log(`[horloge] décalage de ${jours} j ${heures} h : le serveur croit être le ${new Date().toISOString()}`);
}

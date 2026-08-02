# Tests des garde-fous du grand livre

Ces règles vivent dans Postgres (triggers), pas dans Prisma : elles ne sont donc
pas couvertes par Vitest. Le script les rejoue dans une transaction annulée —
il ne laisse aucune donnée derrière lui.

```bash
docker cp prisma/tests/garde-fous-argent.sql baobart-postgres:/tmp/t.sql
MSYS_NO_PATHCONV=1 docker exec baobart-postgres psql -U baobart -d baobart -f /tmp/t.sql
```

Les cas 1, 2 et 4 doivent réussir ; les cas 3, 5, 6 et 7 doivent lever une erreur.
Un cas 3/5/6/7 qui passe silencieusement signifie qu'un trigger a été perdu lors
d'une migration — c'est un incident, pas un détail.

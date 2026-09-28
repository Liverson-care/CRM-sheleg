# Déploiement — Sheleg CRM

L'application est **un seul service** : le serveur Node sert à la fois le
frontend (React buildé) et l'API qui parle à Odoo. Il suffit donc de déployer
**un conteneur** quelque part et de renseigner les variables Odoo.

## Variables d'environnement (à définir sur l'hébergeur)

| Variable | Obligatoire | Exemple / valeur |
|---|---|---|
| `ODOO_URL` | ✅ | `https://sheleg.odoo.com` |
| `ODOO_DB` | ✅ | `sheleg` |
| `ODOO_USERNAME` | ✅ | `ymelloul@maayane.fr` |
| `ODOO_API_KEY` | ✅ | *(clé API Odoo)* |
| `JWT_SECRET` | ✅ | *(chaîne aléatoire longue — secret de session)* |
| `DEFAULT_VAT_RATE` | — | `5.5` |
| `ODOO_COMMERCIAL_FIELD` | — | `x_studio_commercial` |
| `PORT` | — | fourni automatiquement par l'hébergeur |

⚠️ Les **utilisateurs de l'app** (Admin, Yona, Laurent…) sont stockés dans
`server/data/users.json`. Pour les conserver après un redéploiement, monter un
**disque persistant** sur `/app/server/data` (déjà configuré dans `render.yaml`).

## Option A — Render (recommandé, simple)

1. Pousser le dépôt sur GitHub (déjà fait : branche de travail).
2. Sur https://render.com → **New → Blueprint**, sélectionner le dépôt.
   Render lit `render.yaml` et crée le service + le disque persistant.
3. Renseigner les 4 variables Odoo (`ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`,
   `ODOO_API_KEY`) dans l'onglet **Environment**. `JWT_SECRET` est généré
   automatiquement.
4. **Deploy**. Render build l'image Docker et publie une URL HTTPS
   (ex. `https://sheleg-crm.onrender.com`).
5. Ouvrir l'URL sur la tablette, se connecter (`admin / Sheleg2655`).

## Option B — N'importe quel hébergeur Docker (VPS, Railway, Fly.io…)

```bash
# Construire l'image
docker build -t sheleg-crm .

# Lancer (avec vos variables et un volume pour les utilisateurs)
docker run -d --name sheleg-crm -p 80:3001 \
  -e ODOO_URL=https://sheleg.odoo.com \
  -e ODOO_DB=sheleg \
  -e ODOO_USERNAME=ymelloul@maayane.fr \
  -e ODOO_API_KEY=xxxxx \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e DEFAULT_VAT_RATE=5.5 \
  -v sheleg_data:/app/server/data \
  sheleg-crm
```

Mettre un reverse-proxy HTTPS devant (Caddy, Nginx, Traefik) : **HTTPS est
indispensable** sur tablette (envoi e-mail, partage PDF, futur mode hors-ligne).

## Option C — Sans Docker (VPS avec Node 18+)

```bash
npm run install:all      # installe client + serveur
npm run build            # build du client → client/dist
# variables d'env définies dans l'environnement, puis :
npm start                # démarre le serveur (sert le client + l'API)
```
Utiliser un gestionnaire de process (PM2/systemd) pour le maintenir en vie.

## Après déploiement
- Se connecter en **admin** et créer/ajuster les comptes commerciaux.
- Vérifier une commande de test → elle doit apparaître dans Odoo avec le champ
  **Commercial** renseigné.

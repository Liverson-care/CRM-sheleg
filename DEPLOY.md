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

## Option B — VPS avec Docker Compose + HTTPS (recommandé sur serveur)

Prérequis : un VPS (Ubuntu/Debian), **Docker + Docker Compose**, et un **nom
de domaine** (ex. `commandes.sheleg.fr`) dont l'enregistrement DNS **A** pointe
vers l'IP du VPS.

```bash
# 1. Installer Docker (si besoin)
curl -fsSL https://get.docker.com | sh

# 2. Récupérer le code (branche de travail)
git clone -b claude/sheleg-odoo-orders-app-39wilc \
  https://github.com/Liverson-care/CRM-sheleg.git
cd CRM-sheleg

# 3. Créer le fichier .env à partir du modèle et le remplir
cp .env.deploy.example .env
nano .env          # renseigner DOMAIN, ODOO_API_KEY, JWT_SECRET…
#   Générer un secret : openssl rand -hex 32

# 4. Démarrer (build + lancement + HTTPS automatique)
docker compose up -d --build
```

Caddy obtient automatiquement un certificat HTTPS pour votre domaine.
L'app est alors accessible sur `https://votre-domaine`.

Mise à jour ultérieure :
```bash
git pull
docker compose up -d --build
```

**HTTPS est indispensable** sur tablette (envoi e-mail, partage PDF, futur
mode hors-ligne) — la stack Caddy s'en charge.

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

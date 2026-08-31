# Sheleg CRM — Prise de commande & intégration Odoo

Application de prise de commande en magasin (optimisée tablette) pour les
commerciaux **Sheleg**. Les clients et les produits sont importés depuis
**Odoo** via API, et les commandes créées dans l'application sont exportées
vers Odoo (création de `sale.order`).

## Architecture

```
crm-sheleg/
├── server/     API Node/Express — proxy sécurisé vers Odoo (JSON-RPC)
└── client/     Application React + Vite (tablette-first), marque Sheleg
```

- Le **frontend** ne parle jamais directement à Odoo : il passe par le
  backend, qui détient les identifiants Odoo (clé API) et évite les
  problèmes de CORS.
- Si Odoo n'est pas configuré, le backend bascule automatiquement en
  **mode démo** avec des données fictives — l'application est utilisable
  immédiatement pour tester le parcours complet.

## Démarrage rapide

Prérequis : Node.js 18+.

```bash
# 1. Installer les dépendances (client + serveur)
npm install
npm run install:all

# 2. Configurer le serveur (optionnel — sinon mode démo)
cp server/.env.example server/.env
#   puis renseigner ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY

# 3. Lancer en développement (client + serveur en parallèle)
npm run dev
```

- Frontend : http://localhost:5173
- Backend  : http://localhost:3001

**Identifiants de démonstration** (mode démo) : `sheleg` / `sheleg`.

## Connexion à Odoo (Odoo Online)

1. Dans Odoo : *Préférences > Sécurité du compte > Clés API* — créer une clé.
2. Renseigner `server/.env` :

   ```env
   ODOO_URL=https://votre-instance.odoo.com
   ODOO_DB=nom_de_la_base
   ODOO_USERNAME=votre.email@sheleg.com
   ODOO_API_KEY=la_cle_generee
   ```

3. Redémarrer le serveur. Il utilisera les modèles Odoo standard :
   - Clients  → `res.partner`
   - Produits → `product.product`
   - Commandes → `sale.order` / `sale.order.line`

Voir `server/README.md` pour le détail des appels JSON-RPC.

## Production

```bash
npm run build          # build du client (client/dist)
npm start              # démarre le serveur, qui sert aussi le client buildé
```

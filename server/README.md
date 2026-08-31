# Serveur Sheleg CRM

API Express qui sert de proxy sécurisé entre l'application tablette et Odoo.

## Modes de fonctionnement

- **Mode démo** (par défaut, si `.env` non renseigné) : données fictives en
  mémoire. Idéal pour développer/tester le parcours sans Odoo.
- **Mode Odoo** : dès que `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME` et
  `ODOO_API_KEY` sont définis.

## Endpoints

| Méthode | Route             | Auth | Description                              |
|---------|-------------------|------|------------------------------------------|
| GET     | `/api/health`     | non  | État du serveur + test connexion Odoo    |
| POST    | `/api/auth/login` | non  | Connexion commercial → jeton JWT         |
| GET     | `/api/clients`    | oui  | Liste des clients (Odoo `res.partner`)   |
| GET     | `/api/products`   | oui  | Catalogue produits (`product.product`)   |
| GET     | `/api/orders`     | oui  | Commandes récentes (`sale.order`)        |
| POST    | `/api/orders`     | oui  | Création d'une commande dans Odoo        |

Le paramètre `?search=` filtre clients et produits.

## Intégration Odoo (JSON-RPC)

Le serveur utilise l'endpoint standard `POST {ODOO_URL}/jsonrpc` :

1. `common.authenticate(db, login, apiKey, {})` → `uid` (mis en cache).
2. `object.execute_kw(db, uid, apiKey, model, method, args, kwargs)` pour
   lire/écrire les enregistrements.

Modèles utilisés :

- **Clients** : `res.partner`, filtre `customer_rank > 0`.
- **Produits** : `product.product`, filtre `sale_ok = true`.
- **Commandes** : `sale.order` (+ `order_line` avec `product_id`,
  `product_uom_qty`, `price_unit`).

### Créer une clé API Odoo

Dans Odoo : *Préférences > Sécurité du compte > Clés API > Nouvelle clé*.
Utilisez cette clé comme `ODOO_API_KEY` et l'email du compte comme
`ODOO_USERNAME`.

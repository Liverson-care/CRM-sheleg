# --- Étape 1 : build du frontend + installation des dépendances serveur ---
FROM node:22-alpine AS build
WORKDIR /app

# Dépendances (couche cache)
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm --prefix server install --no-audit --no-fund \
 && npm --prefix client install --no-audit --no-fund

# Code + build du client
COPY . .
RUN npm --prefix client run build

# --- Étape 2 : image d'exécution (serveur Node qui sert le client buildé) ---
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production

# Serveur (avec ses node_modules) + client buildé
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist

# Données persistantes (utilisateurs) — à monter sur un disque persistant
RUN mkdir -p /app/server/data
VOLUME ["/app/server/data"]

WORKDIR /app/server
# Le port est fourni par l'hébergeur via la variable PORT (défaut 3001).
EXPOSE 3001
CMD ["node", "src/index.js"]

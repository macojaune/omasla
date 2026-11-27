# Web Omasla

Le site et ses routes Auth.js et tRPC tournent dans TanStack Start. Vite construit le client et Nitro produit le serveur Node. Les routes conservent les URL utilisées par le site et l’app Expo.

Depuis la racine, préparer un [environnement local isolé](../../docs/development.md), puis lancer le site sur le port 3185.

```sh
pnpm --filter @omasla/web dev
```

Pour compiler puis tester le serveur avec les fixtures locales, libérer le port 3185 avant de lancer la recette HTTP.

```sh
pnpm --filter @omasla/web build
node scripts/smoke-web-build.mjs
```

En hébergement, définir les variables de build et de serveur de l’environnement cible, puis démarrer `node .output/server/index.mjs` depuis `apps/web`. Vite injecte uniquement les variables préfixées `NEXT_PUBLIC_` dans le client. L’origine HTTPS Auth.js et les clés de signature Convex sont lues au démarrage du serveur.

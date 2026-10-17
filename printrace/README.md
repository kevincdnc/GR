# Printrace

Transformer une trace — trek, marathon, GR20, voyage à vélo ou à moto — en **poster d'art imprimable** : lien Strava ou
fichier GPX/FIT, un choix de modèles soignés, une personnalisation simple, et un export de qualité imprimeur
(PDF vectoriel avec fonds perdus et traits de coupe, PNG 300 dpi). La commande de tirages est prévue (Stripe + imprimeur).

Architecture détaillée : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · modèle de données : [docs/data-model.sql](docs/data-model.sql)

## Démarrer

```bash
cd printrace
npm install
npm run dev          # éditeur http://localhost:5173 (+ API sur :8787)
npm test             # tests (lecture des traces, géométrie, commandes, webhooks)
npm run typecheck
```

Export de démonstration, sans API :

```bash
npm run build
CHROMIUM_PATH=/chemin/vers/chrome npm run export:sample -- nuit a3   # → .exports/*.pdf + *.png
```

En production, `npm run build && npm start` : l'API sert aussi l'éditeur et la page d'impression.
Variables : voir [`.env.example`](.env.example). Strava, Stripe et Gelato s'activent dès que leurs clés sont renseignées.

## État

| Fonction | État |
|---|---|
| Import GPX, FIT, TCX, KML/KMZ, GeoJSON, IGC (dans le navigateur) | ✅ |
| 6 modèles (Nuit, Épure, Relief, Satellite, Suisse, Plan), 6 formats, portrait/paysage | ✅ |
| Personnalisation : textes, statistiques, carte, couleur et épaisseur du tracé, profil, bordures, unités | ✅ |
| Aperçu au mur avec cadres | ✅ |
| Export PDF imprimeur (vectoriel, TrimBox/BleedBox, traits de coupe) et PNG 300 dpi | ✅ testé |
| Fonds de carte vectoriels (Nuit, Papier, Relief ombré, Encre) et satellite | ✅ code prêt — non vérifiable dans l'environnement de dev (tuiles bloquées) |
| Import par lien Strava (OAuth) | ✅ code prêt — à tester avec une app Strava |
| Commande : catalogue, Stripe Checkout, webhooks signés, machine à états, envoi Gelato | ✅ logique testée — Gelato à valider avec un compte de test |
| Comptes, base PostgreSQL, back-office, e-mails | 📐 conçu (docs), à implémenter |

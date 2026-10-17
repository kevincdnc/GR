# Printrace — architecture

> Une trace (Strava, GPX, FIT…) → un poster d'art → un fichier imprimeur ou un tirage livré.

## 1. Principe directeur : un seul moteur de rendu

Le composant React `<Poster>` (`packages/poster`) est **l'unique moteur de rendu**. Il sert à trois endroits :

| Usage | Mode | Où |
|---|---|---|
| Aperçu interactif | `preview` | éditeur (`apps/web`) |
| Vignettes des modèles | `thumb` (sans carte) | éditeur |
| Export d'impression | `print` | `apps/web/render.html`, ouvert par Chromium headless (`packages/render`) |

Comme l'aperçu et le fichier final sortent du même code, ce que l'on voit à l'écran est ce qui est imprimé.

Le poster est **toujours mis en page à sa taille physique** (mm → pixels CSS à 96 dpi), puis réduit à l'écran par une
transformation CSS. La carte a donc la même généralisation (routes, libellés) dans l'aperçu et sur le tirage, et la taille
des libellés est définie en points imprimés.

### Couches d'un poster

```
┌─────────────────────────────────┐
│ SVG : tracé, textes, chiffres   │  vectoriel dans le PDF, polices incorporées
├─────────────────────────────────┤
│ Carte MapLibre (WebGL)          │  raster, rendu à la résolution d'impression (300 dpi)
├─────────────────────────────────┤
│ Fond du modèle / bordure        │
└─────────────────────────────────┘
```

Le tracé et la carte partagent une seule projection Web Mercator (`geo.ts` : `fitProjection` + `mapViewFor`), ce qui
les superpose exactement.

## 2. Monorepo

```
printrace/
├── apps/
│   ├── web/            éditeur React (Vite) + render.html (page d'impression)
│   └── api/            Fastify : exports, Strava, catalogue, commandes, webhooks
├── packages/
│   ├── core/           lecture des traces (GPX, FIT, TCX, KML/KMZ, GeoJSON, IGC) + métriques. Sans DOM.
│   ├── poster/         spec, formats, modèles, styles de carte, <Poster>.
│   │                   « @printrace/poster/model » = partie sans DOM (serveur)
│   ├── render/         export pro : Chromium headless → PDF/PNG, prépresse, file d'exports, stockage
│   └── commerce/       catalogue, commandes (machine à états), paiement, fabrication
└── docs/
```

Dépendances : `core` ← `poster` ← `render` / `commerce` ← `api` ; `web` → `core` + `poster`.

### Le contrat : `PosterSpec`

`packages/poster/src/spec.ts` décrit entièrement un poster (modèle, format, carte, tracé, textes, statistiques,
bordure, unités, valeurs saisies, fond perdu). Elle est versionnée (`version: 1`), validée par Zod côté API, et
sérialisable : brouillon local, lien partagé, ligne `designs` en base, commande. **Même spec + même activité = même poster.**

### Ajouter un modèle

1. Ajouter ses métadonnées dans `templates/catalog.ts` (nom, fond, carte et couleur par défaut).
2. Créer `templates/<id>.tsx` : `layout()` calcule les boîtes (zone du tracé, zone de carte) et `render()` dessine le SVG.
   Repère : largeur 1000, hauteur selon le format. Le modèle s'adapte donc à tous les formats.
3. L'ajouter à `templates/index.ts`.

Les briques communes (`primitives.tsx`) sont `FitText`, `textBlock`, `statsRow`, `Track` (halo vectoriel, liseré,
départ et arrivée), `Profile`, `ScaleBar` et `Brand`.

## 3. Qualité d'impression

| Exigence | Implémentation |
|---|---|
| 300 dpi | PNG : `deviceScaleFactor = dpi/96` ; carte : `pixelRatio = dpi/96` (A3 = 3508 × 4961 px) |
| Vectoriel | Tracé, textes et chiffres restent vectoriels dans le PDF. Halo « néon » fait de traits superposés, sans filtre raster |
| Polices | Servies avec l'app (@fontsource), attendues avant mesure, incorporées en sous-ensembles dans le PDF |
| Fond perdu | 3 mm par défaut (`spec.print.bleedMm`) : les fonds débordent dans le repère |
| Boîtes PDF | `TrimBox`, `BleedBox` et `ArtBox` posées par `prepress.ts` (pdf-lib, page incorporée sans rastérisation) |
| Traits de coupe | En noir de repérage (CMJN 100 %), 0,25 pt, hors du fond perdu |
| PNG | Chunk `pHYs` : le fichier s'ouvre à la bonne taille physique |
| Carte nette | Styles vectoriels (libellés nets à toute résolution). Imagerie satellite : tuiles d'un niveau plus fin selon le `pixelRatio` |
| Limites GPU | Toile de carte plafonnée à 8192 px (MapLibre baisse alors un peu la résolution de la carte, le vectoriel n'est pas touché) |
| Robustesse | Si les tuiles échouent, le poster sort quand même (fond uni) et le job signale `mapOk: false` |

**Prochaines étapes de prépresse** :
- conversion CMJN avec profil (FOGRA39/ISO Coated v2, ou celui de l'imprimeur) par Ghostscript, en sortie PDF/X-4 ;
- carte rendue par tuiles pour les très grands formats (> 8192 px) ;
- TIFF 16 bits si un laboratoire le demande.

### Pipeline d'export

```
POST /api/exports {activity, spec, format}
  → file d'exports (concurrence limitée, interface prête pour Redis/BullMQ)
  → Chromium (contexte isolé, viewport = format physique) ouvre render.html
  → window.__PRINTRACE_JOB__ injecté → <Poster mode="print"> → attente polices + carte (idle)
  → page.pdf() → prépresse   |   page.screenshot() → pHYs
  → stockage (disque local ; S3/R2 en prod) → GET /api/exports/:id/file
```

## 4. Import des traces

- **Fichier** : lu **dans le navigateur** (`@printrace/core`), sans envoi au serveur. Altitudes rééchantillonnées et
  lissées, D+ avec hystérésis, temps en mouvement, sport deviné si absent.
- **Lien Strava** : OAuth (`activity:read_all`), puis `GET /activities/{id}` + `/streams`. Les liens courts
  `strava.app.link` sont suivis. Les chiffres officiels de Strava (distance, D+, temps) remplacent les nôtres.
  ⚠️ L'API Strava ne donne accès qu'aux activités **de l'athlète connecté**. Ses conditions d'utilisation encadrent l'usage
  des données : à relire avant le lancement commercial.
- Pistes : Garmin Connect, Komoot, Coros, Suunto (OAuth), import d'une URL de GPX.

## 5. Commerce : paiement, fabrication, commandes

### Choix recommandé : Stripe + imprimeur à la demande (Gelato ou Prodigi)

| Option | Pour | Contre |
|---|---|---|
| **Stripe Checkout + imprimeur API** (retenue) | Page de paiement hébergée (CB, Apple/Google Pay, PayPal), Stripe Tax, contrôle total du parcours, produit 100 % personnalisé | Back-office à construire |
| Shopify (headless) | Back-office, e-mails, remboursements, apps d'impression | Mal adapté à un produit unique par client (fichier par commande, variantes), abonnement + commission, front à synchroniser |

L'architecture n'enferme dans aucun des deux. `PaymentProvider` et `FulfillmentProvider` (`packages/commerce/src/providers.ts`)
sont des interfaces : Shopify peut devenir un `PaymentProvider` (draft order → checkout), ou un canal de vente en plus.
L'imprimeur est remplaçable de la même façon (Gelato, Prodigi, laboratoire local).

### Cycle de vie d'une commande

```
awaiting_payment ──webhook paid──► paid ─► rendering ─► ready ──(numérique : fin)
       │                                         │          └─► submitted ─► in_production ─► shipped ─► delivered
       └─expired─► cancelled                     └─► failed (relance depuis le back-office)        refunded ◄─ (paid/ready/delivered)
```

- Les transitions passent toutes par `transition()`, qui refuse les sauts incohérents.
- **Le paiement n'est validé que par webhook signé** (HMAC Stripe vérifié, tolérance 5 min), jamais par le retour navigateur.
- Les webhooks sont idempotents : un événement rejoué ne change rien (table `webhook_events` en prod).
- Le poster est **figé au moment de la commande** : la spec et l'activité sont copiées dans `designs`/`orders`, au format du produit.
- Le PDF imprimeur est généré après paiement par le même moteur, puis transmis à l'imprimeur via une **URL signée temporaire**.

### Catalogue

`packages/commerce/src/catalog.ts` contient les fichiers HD (numériques), les tirages d'art et les tirages encadrés, pour chaque
format. **Les prix et références imprimeur sont provisoires** et restent à fixer avec le prestataire.

### Parcours d'achat (UX)

1. L'éditeur affiche le bouton principal « **Commander le tirage** », et en secondaire « PNG HD » / « PDF imprimeur ».
2. Une fiche de commande propose Encadré / Tirage seul / Fichiers HD, puis le format et le prix. Le format choisi s'applique au poster.
3. **Payer** ouvre la page Stripe, qui collecte l'e-mail, l'adresse et le téléphone pour les tirages.
4. Le retour se fait sur `/commande/:id` : suivi en direct (payé → en fabrication → expédié + lien de suivi). Pour une
   commande numérique, cette page donne le téléchargement.
5. E-mails transactionnels (crochet `notify`) : confirmation, expédition, livraison. Prestataire prévu : Resend ou Postmark.

Le compte n'est **pas obligatoire pour acheter** : c'est l'e-mail saisi au paiement qui relie la commande.

## 6. Comptes utilisateurs

- **Connexion sans mot de passe** : lien magique par e-mail, et « Continuer avec Strava » (l'OAuth sert déjà à l'import).
- Session par cookie signé, `httpOnly`, `SameSite=Lax` (table `sessions`).
- À la première connexion, les commandes passées avec le même e-mail et le brouillon local sont rattachés au compte.
- Espace « Mes posters » (designs enregistrés, duplication, nouveau format) et « Mes commandes » (statuts, factures Stripe, re-commande).
- RGPD : export des données, suppression du compte (anonymisation des commandes gardées pour la comptabilité). Les traces
  GPS révèlent des lieux de vie : sur demande, masquer le départ et l'arrivée (zone de confidentialité, comme Strava).

Schéma de données : [`data-model.sql`](data-model.sql).

## 7. Back-office (à venir)

- Liste des commandes filtrée par statut, en priorité les `failed`. Actions : relancer le rendu, renvoyer à l'imprimeur, rembourser.
- Prévisualisation du PDF imprimeur avant envoi (contrôle manuel au lancement).
- Indicateurs : conversion éditeur → commande, panier moyen, délai de fabrication.

## 8. Déploiement cible

| Composant | Hébergement |
|---|---|
| Front (`apps/web/dist`) | CDN (Cloudflare Pages / Vercel) ou servi par l'API |
| API | Conteneur Node 22 (Fly.io, Railway, Render, Scaleway) |
| Workers d'export | Conteneur avec Chromium (image Playwright), 2 Go RAM / rendu, mise à l'échelle sur la file |
| File | Redis (BullMQ) en remplacement de `MemoryExportQueue` |
| Base | PostgreSQL managé |
| Fichiers | S3 / Cloudflare R2 (URL signées), purge des exports anonymes après 7 jours |
| Tuiles | OpenFreeMap (gratuit, attribution) ; MapTiler ou serveur PMTiles à soi pour garantir la disponibilité |

**Licences des fonds de carte** : les données OSM, OpenMapTiles et OpenFreeMap autorisent l'usage commercial, avec une
attribution imprimée (déjà sur les modèles à carte). L'imagerie satellite (Esri par défaut) exige une **licence commerciale**
pour vendre des tirages : il faut la souscrire ou changer de fournisseur (MapTiler Satellite…) via `configureTiles()`.

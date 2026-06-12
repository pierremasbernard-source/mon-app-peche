# CLAUDE.md — Carnet de pêche

Guide de référence pour toute évolution du projet. À lire avant de modifier le code.

## Objectif

Application web personnelle de suivi des sorties de pêche, couvrant deux pratiques :
- **chasse sous-marine** (spearfishing)
- **pêche à la canne** classique

Usage personnel, mono-poste (mais multi-profils en local). Pas de compte, pas de serveur.

## Stack technique

| Élément        | Choix                                                              |
|----------------|--------------------------------------------------------------------|
| Langages       | HTML, CSS, JavaScript **vanilla** (aucun framework, aucun build)    |
| Carte          | **Leaflet 1.9.4** (CDN). Fonds : **OpenStreetMap** + **cartes marines SHOM** (WMTS) — voir section dédiée |
| Météo          | API **Open-Meteo** (gratuite, sans clé) pour les prévisions par spot |
| Graphiques     | Barres en **CSS pur** (pas de librairie de charts)                 |
| Stockage       | **localStorage** du navigateur uniquement                          |
| Dépendances    | Aucune installée localement (tout en CDN) → pas de `node_modules`  |

Le code est organisé en modules JS, chacun exposant un objet global via IIFE
(`Store`, `UI`, `MapView`, `Sessions`, `Planner`, `Stats`, `Gallery`). Pas d'import/export ES modules :
les scripts sont chargés dans l'ordre dans `index.html` (`storage.js` en premier, `app.js` en dernier).

## Fonds de carte (SHOM + OpenStreetMap)

Configuré dans [`js/map.js`](js/map.js) (helper `shomLayer` + sélecteur `L.control.layers`).

Le **SHOM** (Service hydrographique et océanographique de la marine) diffuse ses données en
**WMTS**. Leaflet ne gère pas le WMTS nativement : on consomme les tuiles avec `L.tileLayer`
et une URL « KVP » `GetTile`.

- **Endpoint public** : `https://services.data.shom.fr/INSPIRE/wmts`
- **TileMatrixSet** : `3857` (EPSG:3857 / Web Mercator), niveaux `0`→`21` dont les identifiants
  correspondent **directement** au `{z}` de Leaflet. Mapping :
  `tilematrix={z}&tilerow={y}&tilecol={x}` (aucune reprojection).
- **Format** : `image/png`, **style** : `normal`.
- Les identifiants de couches ci-dessous ont été **lus dans le GetCapabilities**
  (`?service=WMTS&version=1.0.0&request=GetCapabilities`), pas devinés.

### Couches utilisées

| Rôle      | Identifiant WMTS                        | Accès             |
|-----------|-----------------------------------------|-------------------|
| Fond principal (cartes marines raster) | `RASTER_MARINE_3857_WMTS` | 🔒 **clé requise** (401 sans clé) |
| Overlay bathymétrie côtière Bretagne   | `LITTO3D_BZH_2018_2021_PYR_3857_WMTS` | ✅ public |
| Overlay bathymétrie large Atlantique   | `MNT_ATL100m_HOMONIM_PBMA_3857_WMTS` | ✅ public |
| Overlay nature des fonds (sédiments)   | `NDF_PYR-PNG_WLD_3857_WMTS` | ✅ public |
| Overlay toponymie marine               | `TOPONYMIE_PYR_PNG_3857_WMTS` | ✅ public |
| Fond alternatif                        | OpenStreetMap (XYZ)        | ✅ public |

### Clé d'API SHOM (cartes marines raster)

La couche d'**assemblage des cartes marines raster** (`RASTER_MARINE_3857_WMTS`) — celle avec
sondes et isobathes imprimées — **n'est pas publique** : sans clé elle renvoie
`HTTP 401 MissingRights`. Elle est **pré-câblée** dans `map.js` :

1. Créer une clé d'API gratuite sur <https://data.shom.fr>.
2. La coller dans la constante `SHOM_API_KEY` en haut de `js/map.js`.
3. Les tuiles passent alors par l'endpoint authentifié
   `https://services.data.shom.fr/<CLÉ>/wmts` et le fond « Cartes marines » devient
   sélectionnable (et le fond par défaut).

Sans clé, l'app utilise OpenStreetMap par défaut + les overlays SHOM publics ci-dessus
(qui suffisent à voir bathymétrie et nature des fonds, utiles pour la pêche).

> ⚠️ Ne jamais committer une vraie clé d'API dans le dépôt (CGU SHOM + sécurité).

L'attribution **« © SHOM »** est affichée sur la carte (option `attribution` des tuiles).

## Stockage des données

- **100 % localStorage**, aucune donnée ne quitte le navigateur (hors export JSON manuel et appel météo).
- **Multi-profils en local** : chaque profil a ses données isolées sous une clé dédiée.
- **Photos** : compressées (redimensionnées à 1000 px max, JPEG qualité ~0,72) puis stockées
  en **base64** dans l'objet capture, directement dans le localStorage. La compression
  (`UI.compressImage` dans `js/ui.js`) évite de saturer le quota.

### Clés localStorage (namespace versionné `carnetpeche.v1`)

| Clé                              | Contenu                                          |
|----------------------------------|--------------------------------------------------|
| `carnetpeche.v1.profiles`        | tableau des profils                              |
| `carnetpeche.v1.activeProfile`   | id du profil actif (ou `null`)                   |
| `carnetpeche.v1.data.<profileId>`| données du profil : `{ spots, sessions, settings }` |

Le namespace est **versionné** (`v1`) volontairement : un changement de structure incompatible
pourra introduire `v2` avec une migration depuis `v1`.

## Structure des données (telle qu'implémentée dans `js/storage.js`)

Toutes les entités portent `id` (uuid via `crypto.randomUUID`), et les spots/sessions ont
`createdAt` / `updatedAt` (ISO 8601) — pensé pour une future migration vers un backend.

```js
// Profil
{ id, name, createdAt }

// Spot (lieu de pêche)
{
  id, name,
  type,            // 'mer' | 'douce'   (eau de mer / eau douce)
  lat, lng,        // coordonnées (clic sur la carte)
  notes,           // texte libre
  createdAt, updatedAt
}

// Session (une sortie)
{
  id,
  type,            // 'chasse' | 'canne'
  date,            // datetime ISO (ex: "2026-05-12T09:30")
  spotId,          // id d'un spot, ou null si détaché/non listé
  conditions: {
    meteo,         // 'ensoleillé' | 'nuageux' | 'pluie' | 'vent' | ''
    etatMer,       // 'calme' | 'peu agitée' | 'agitée' | 'forte' | ''
    visibilite,    // 'excellente' | 'bonne' | 'moyenne' | 'mauvaise' | ''
    tempEau,       // nombre (°C) ou null
    coefMaree      // nombre (20–120) ou null
  },
  duree,           // minutes, ou null
  profondeurMax,   // mètres — chasse sous-marine uniquement, sinon null
  technique,       // texte (appât/leurre) — canne uniquement, sinon ''
  captures: [ Capture ],
  notes,           // ressenti libre
  createdAt, updatedAt
}

// Capture (un poisson, intégrée dans session.captures)
{
  id,
  espece,          // texte libre (ex: "Bar", "Dorade")
  taille,          // cm (nombre) ou null
  poids,           // STOCKÉ EN GRAMMES (nombre) ou null
  photo            // dataURL base64 (JPEG compressé) ou null
}
```

> ⚠️ Le **poids est toujours stocké en grammes**. L'affichage lisible (g / kg) se fait via
> `UI.formatWeight`. Ne pas changer l'unité de stockage sans migration.

> ℹ️ Supprimer un spot **ne supprime pas** ses sessions : leur `spotId` est remis à `null`
> (voir `Store.removeSpot`).

## Organisation des fichiers

```
ALaPeche/
├── index.html          Structure de toutes les vues + modale + ordre de chargement des scripts
├── css/
│   └── styles.css      Tout le style. Variables CSS (couleurs, rayons) dans :root en haut
└── js/
    ├── storage.js      Couche de données / localStorage. SEUL fichier qui touche au stockage.
    │                     → point d'entrée unique pour brancher un backend plus tard.
    ├── ui.js           Utilitaires transverses : toast, modale, compression d'images,
    │                     échappement HTML, formatage (dates, poids, durée), initiales.
    ├── map.js          Carte Leaflet, marqueurs mer/douce, popups, formulaire de spot.
    ├── sessions.js     Liste, détail et formulaire de session (champs dynamiques par type),
    │                     gestion des captures et de leurs photos.
    ├── planner.js      Vue « quand y aller ? » : reco manuelle, météo Open-Meteo,
    │                     analyse de l'historique de réussite par spot.
    ├── stats.js        Tableau de bord, badges/achievements, graphiques en barres CSS.
    ├── gallery.js      Galerie des captures photographiées + lightbox.
    └── app.js          Orchestration : écran de profil, navigation entre vues, export/import.
```

**Règle d'or** : tout accès au stockage passe par `Store` (`js/storage.js`). Aucun autre fichier
ne lit/écrit `localStorage` directement.

## Principes à respecter pour toute évolution

1. **Simplicité et robustesse avant tout.** Pas de framework, pas d'étape de build, pas de
   dépendances lourdes. Si une lib est indispensable, la charger via CDN et la justifier.
2. **Ne jamais perdre les données existantes.** Tout changement de structure de données doit
   s'accompagner d'une **migration** : lire l'ancien format et le convertir (au besoin, passer
   le namespace de `v1` à `v2` dans `storage.js` avec une étape de migration). Tester avec des
   données réelles avant de livrer.
3. **Conserver l'export/import JSON** (`Store.exportProfile` / `Store.importIntoActive`,
   boutons dans la vue Stats). C'est le seul filet de sécurité contre l'effacement du
   localStorage — toute nouvelle donnée doit être incluse dans l'export.
4. **Garder l'isolation par profil** et la compatibilité avec une future synchro backend
   (conserver `id`/`createdAt`/`updatedAt` sur les entités).
5. **Maîtriser le poids du localStorage** : continuer à compresser les images avant stockage.

## État des fonctionnalités

### ✅ Faites et fonctionnelles
- Système de **profils** multiples (création, sélection, suppression, changement).
- **Carte interactive** : ajout de spot par clic, marqueurs différenciés mer/eau douce,
  popup avec infos + sessions du spot, modification et suppression.
- **Fonds de carte marins SHOM** (WMTS) avec sélecteur de couches : OSM ou cartes marines
  raster (clé requise), + overlays bathymétrie / nature des fonds / toponymie. Voir section dédiée.
- **Log de session** : formulaire complet à champs dynamiques selon le type (profondeur pour
  la chasse, technique/appât pour la canne), conditions, captures multiples avec photos.
- **Planificateur** : recommandation basique à partir de conditions saisies, météo réelle via
  Open-Meteo pour un spot, analyse de l'historique (meilleur mois / météo la plus productive).
- **Statistiques & achievements** : chiffres clés, 8 badges, graphiques par mois/espèce/spot.
- **Galerie photos** des prises avec contexte + lightbox.
- **Export / import JSON** (remplacer ou fusionner).

### 🔧 Pistes d'amélioration (non faites)
- Table des **marées réelles** (actuellement le coefficient est saisi à la main).
- **Liste d'espèces prédéfinies** / autocomplétion (actuellement texte libre).
- Recommandations du planificateur plus fines (croiser davantage avec l'historique personnel).
- **Backend Supabase** (comptes synchronisés) — l'architecture de `storage.js` est déjà prête
  pour ça : réécrire les fonctions de `Store` en appels async en gardant les mêmes signatures.
- Filtres / recherche dans la liste des sessions.

## Lancer en local

```powershell
cd C:\Users\AnneBAUDE\Documents\ALaPeche
python -m http.server 4321
# puis http://localhost:4321
```

Un serveur local (plutôt qu'un double-clic `file://`) est recommandé pour la carte et la météo.

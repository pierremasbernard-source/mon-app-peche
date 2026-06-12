# Changelog — Carnet de pêche

> Mis à jour à la fin de chaque session de travail significative.
> Format : **[En cours]** en haut pour la session active, puis **[vX.Y]** pour les itérations validées.

---

## [En cours]

*Rien pour l'instant.*

---

## [v0.2] — 2026-06-12 — Fonds de carte marins SHOM + sélecteur toggle

### Fait
- Intégration des **cartes marines SHOM** via WMTS (endpoint public + optionnel authentifié)
  - Fond principal : `RASTER_MARINE_3857_WMTS` (sondes, isobathes) — activable avec une clé SHOM gratuite
  - 4 overlays publics cumulables : bathymétrie Bretagne (Litto3D), bathymétrie large Atlantique (MNT 100 m), nature des fonds (sédiments), toponymie marine
  - Sélecteur `L.control.layers` avec attribution « © SHOM »
- **Bouton toggle discret** en haut à droite : remplace le panneau de couches toujours ouvert par un bouton « 🗺️ Fond de carte ▾ » qui ouvre/ferme le panneau au clic, avec animation du chevron et thème sombre cohérent
- **CLAUDE.md** réécrit dans la voix du projet (plus court, centré sur les 2 moments de vérité + principes essentiels)
- **CHANGELOG.md** créé

### Décisions prises
- Les identifiants de couches SHOM ont été **lus dans le GetCapabilities** (pas devinés) : `tilematrix={z}` mappe directement au `{z}` de Leaflet via le TileMatrixSet `3857`, aucune reprojection
- La clé d'API SHOM est **pré-câblée** via la constante `SHOM_API_KEY` dans `map.js` (vide = OSM par défaut) → aucun commit de clé dans le dépôt
- Le sélecteur Leaflet est construit avec `collapsed: false` pour avoir le DOM complet, puis masqué via CSS (`cp-collapsed`) + bouton JS injecté : aucun fork de Leaflet, aucune lib supplémentaire

---

## [v0.1] — 2026-06-11 — App de base fonctionnelle

### En place
- Carte interactive (Leaflet + OpenStreetMap) : ajout de spots par clic, marqueurs mer/eau douce
- Log de session complet : type de pêche, conditions, captures avec photos compressées
- Planificateur « quand y aller ? » avec météo Open-Meteo (sans clé API)
- Statistiques & badges : chiffres clés, achievements, graphiques
- Galerie photos des prises
- Export / Import JSON pour sauvegarder les données
- Profils multiples en local, données isolées par profil

### Décisions prises
- Stack légère : HTML / CSS / JS vanilla, pas de framework
- Stockage 100 % localStorage — pas de backend pour l'instant
- Modèle de données pensé pour Supabase dès le départ (`id`, `createdAt`, `updatedAt`, futur `user_id`)
- Photos compressées en base64 avant stockage (~5–10 Mo max)
- Stratégie de partage en deux temps : export/import JSON maintenant, Supabase partagé plus tard

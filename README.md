# 🎣 Carnet de pêche

Application web pour suivre vos sorties de pêche — **chasse sous-marine** et **pêche à la canne**.
Tout est stocké **localement dans le navigateur** (localStorage), aucun serveur ni compte requis.

## Lancer l'application en local

L'app est 100 % statique (HTML/CSS/JS). Il faut juste la servir via un petit serveur local
(les navigateurs bloquent certaines fonctionnalités si on ouvre le fichier directement en `file://`).

### Option 1 — Python (déjà installé sur votre machine)

Dans un terminal, placez-vous dans le dossier du projet puis lancez :

```powershell
cd C:\Users\AnneBAUDE\Documents\ALaPeche
python -m http.server 4321
```

Puis ouvrez votre navigateur sur **http://localhost:4321**

### Option 2 — Extension VS Code

Installez l'extension *Live Server*, faites un clic droit sur `index.html` → *Open with Live Server*.

> 💡 Ouvrir directement `index.html` (double-clic) fonctionne en grande partie, mais un serveur
> local est recommandé pour que la carte et la météo fonctionnent parfaitement.

## Structure du projet

```
ALaPeche/
├── index.html          → structure des pages (vues + modales)
├── css/
│   └── styles.css      → tout le style (variables CSS en haut pour personnaliser)
└── js/
    ├── storage.js      → couche de données localStorage (← point d'entrée pour brancher Supabase)
    ├── ui.js           → utilitaires : modale, toast, compression d'images, formatage
    ├── map.js          → carte Leaflet + gestion des spots
    ├── sessions.js     → formulaire et liste des sessions
    ├── planner.js      → planificateur « quand y aller ? » + météo Open-Meteo
    ├── stats.js        → tableau de bord, badges, graphiques
    ├── gallery.js      → galerie photos
    └── app.js          → orchestration : profils, navigation, export/import
```

## Fonctionnalités

- **Profils multiples** en local, données isolées par profil.
- **Carte interactive** (Leaflet + OpenStreetMap) : ajout de spots par clic, marqueurs
  mer/eau douce, infos + sessions au clic, modification/suppression.
- **Log de session** : formulaire adaptatif selon le type de pêche, conditions complètes,
  captures avec photos (compressées avant stockage).
- **Planificateur** : recommandation manuelle, météo réelle Open-Meteo (sans clé API),
  analyse de vos meilleures conditions par spot.
- **Statistiques & badges** : chiffres clés, achievements, graphiques par mois/espèce/spot.
- **Galerie photos** des prises avec leur contexte.
- **Export / import JSON** pour sauvegarder vos données.

## Étendre l'application

### Brancher un vrai backend (Supabase)

Le modèle de données est déjà pensé pour ça (voir le gros commentaire en haut de
[`js/storage.js`](js/storage.js)) :

- Chaque entité (spot, session) porte un `id`, `createdAt`, `updatedAt`.
- Les données sont isolées par profil (= futur `user_id`).
- Pour migrer : réécrivez les fonctions internes `_read`/`_write` (et `add*`/`update*`/`remove*`)
  de `storage.js` en appels `supabase-js`, **en gardant les mêmes signatures**.
  Le reste de l'application n'a pas besoin d'être modifié.

### Personnaliser le design

Toutes les couleurs et rayons sont des variables CSS en haut de `css/styles.css` (`:root`).

## Sauvegarde

⚠️ Le localStorage peut être effacé (nettoyage du navigateur, mode privé…).
Pensez à utiliser **Stats → Exporter** régulièrement pour sauvegarder vos données en JSON,
et **Importer** pour les restaurer ou les transférer sur un autre appareil.

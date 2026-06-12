# CLAUDE.md — Carnet de pêche

> À lire au début de chaque session comme contexte de travail.
> Consulter aussi ROADMAP.md (priorités) et CHANGELOG.md (état actuel).

---

## Contexte du projet

App perso pour suivre mes sorties de pêche (chasse sous-marine + canne) et la partager avec des potes.
**Pas** un produit commercial. Pratique pour moi d'abord, agréable à partager ensuite.

### Les 2 moments de vérité (tout le reste est secondaire)

1. **AVANT la sortie** → « où et quand y aller ? » (carte, météo, marées, meilleures conditions passées)
2. **APRÈS la sortie** → « je log ma session, vite, depuis mon téléphone »

### Stack

- HTML / CSS / JS vanilla — aucun framework
- Carte : Leaflet.js + tuiles OpenStreetMap (gratuit, sans clé API)
- Stockage : 100 % localStorage (pas de backend)
- Photos : base64 compressées avant stockage (~5–10 Mo max)
- Météo : Open-Meteo (sans clé API)

### Fichiers clés

- `js/storage.js` — couche données localStorage ; point d'entrée futur Supabase
- `js/app.js` — orchestration : profils, navigation, export/import JSON
- `js/ui.js` — modale, toast, compression images, formatage
- `js/map.js` — carte Leaflet + gestion des spots
- `js/sessions.js` — formulaire et liste des sessions
- `js/planner.js` — planificateur « quand y aller ? » + météo Open-Meteo
- `js/stats.js` — tableau de bord, badges, graphiques
- `js/gallery.js` — galerie photos

### Principes à respecter

- **Une modification à la fois**, tester dans le navigateur avant la suivante
- **Avant toute modif de structure de données** : exporter le JSON (le localStorage peut être effacé)
- Pour un changement ambitieux : « ne code pas encore, explique-moi d'abord comment tu t'y prendrais »
- Débogage : coller l'erreur exacte (console F12), pas « ça marche pas »
- Modèle recommandé : **Sonnet 4.6** pour le gros du travail JS vanilla ; Opus uniquement pour les points d'architecture épineux

---

## Règle de fin de session

**À la fin de chaque session de travail significative**, mettre à jour `CHANGELOG.md` :

1. Déplacer la section `[En cours]` vers une nouvelle section `[vX.Y] — AAAA-MM-JJ — Titre court`
2. Remettre `[En cours]` vide en haut
3. Dans la section archivée, renseigner :
   - **Fait** — ce qui a été réalisé
   - **Corrigé** — bugs résolus
   - **Décisions prises** — pourquoi on a fait tel choix (c'est la vraie valeur)

Exemple de déclenchement : « Mets à jour le changelog avec ce qu'on vient de faire. »

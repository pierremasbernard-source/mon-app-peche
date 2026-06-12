# 🗺️ Roadmap — Carnet de pêche

> Ce fichier sert deux personnes : **moi** (pour savoir où j'en suis et où je vais)
> et **Claude Code** (à lire comme contexte au début de chaque session, avec `CLAUDE.md`).

---

## 🎯 Vision

Une app perso pour **suivre mes sorties de pêche** (chasse sous-marine + canne) et
**la partager avec mes potes pêcheurs**. Ce n'est **pas** un produit commercial — pas de
comptes robustes, pas de scalabilité, pas de design pour des inconnus. Ça doit être
**pratique pour moi d'abord**, agréable à partager ensuite.

### Les 2 moments de vérité

L'app doit être excellente sur ces deux instants. Tout ce qui les sert est prioritaire ;
le reste est bonus.

1. **AVANT la sortie** → « où et quand y aller ? » (carte, météo, marées, mes meilleures conditions passées)
2. **APRÈS la sortie** → « je log ma session, vite, depuis mon téléphone »

### Stratégie de partage : A puis B

- **Version A (maintenant)** — Partage léger. Chacun son app, échange via export/import JSON.
  Techniquement, c'est presque déjà en place (l'export/import existe).
- **Version B (plus tard)** — Partage vivant. Base commune (Supabase), spots et sessions
  partagés entre potes. Gros chantier, à n'attaquer que quand l'app est devenue un réflexe.

---

## 🪣 Panier 1 — Indispensable pour m'en servir pour de vrai

*Règle : on vide ce panier avant de toucher au Panier 2.*

- [ ] **Marées SHOM** — vignettes gratuites (sans clé API) dans le planificateur.
      Cœur du « quand y aller » pour la chasse sous-marine. → `js/planner.js`, `index.html`, `css/styles.css`
- [ ] **Log de session ultra-rapide sur mobile** — tester sur le vrai téléphone, dans les
      vraies conditions. Si logger prend > 30 s, je ne le ferai pas. → `js/sessions.js`, `js/ui.js`
- [ ] **Ne jamais perdre mes données** — le localStorage s'efface (nettoyage navigateur,
      mode privé). Mettre en place un rappel d'export régulier ou un export automatique.
      → `js/storage.js`, `js/app.js`

## 🪣 Panier 2 — Rendrait l'app agréable

- [ ] **Partage léger fluide** — bouton « envoyer mes spots / sessions à un pote » qui
      génère un JSON propre + import en un clic de leur côté. (La base existe, c'est du polish.)
      → `js/app.js`, `js/storage.js`
- [ ] **Planificateur plus malin** — croiser météo Open-Meteo + marées + mes meilleures
      conditions passées par spot, pour une vraie reco « vas-y demain matin ». → `js/planner.js`, `js/stats.js`
- [ ] **Ergonomie mobile** — polish général de l'expérience sur téléphone.

## 🪣 Panier 3 — Plus tard (= Version B)

*On n'y touche pas tant que l'app n'est pas un réflexe pour moi + 1 ou 2 potes.*

- [ ] Backend **Supabase** (base commune). Le modèle de données est déjà pensé pour ça
      (voir le commentaire en haut de `js/storage.js` : `id`, `createdAt`, `updatedAt`,
      isolation par profil = futur `user_id`).
- [ ] Carte et sessions **partagées en temps réel** entre potes.
- [ ] Comptes / profils synchronisés.

---

## 📝 Notes

- Quand une idée surgit, je la range dans le bon panier plutôt que de la coder tout de suite.
- Une fonctionnalité « cool à coder » n'est pas une fonctionnalité « dont je me servirai ».
  Le filtre : est-ce que ça sert un des 2 moments de vérité ?

*Dernière mise à jour : à tenir à jour au fil de l'eau.*

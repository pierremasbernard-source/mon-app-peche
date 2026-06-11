/* =================================================================
   app.js — point d'entrée et orchestration
   Gère : écran de profil, navigation entre vues, export/import,
   et l'initialisation des modules.
   ================================================================= */

(function () {

  // ---------- Démarrage ----------
  document.addEventListener('DOMContentLoaded', () => {
    UI.initModal();
    bindGlobalActions();

    // Si un profil est déjà actif, on entre directement dans l'app.
    if (Store.getActiveProfileId() && Store.getActiveProfile()) {
      enterApp();
    } else {
      showProfileGate();
    }
  });

  // =================================================================
  //  ÉCRAN DE PROFIL
  // =================================================================
  function showProfileGate() {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('profile-gate').classList.remove('hidden');
    renderProfileList();

    const nameInput = document.getElementById('new-profile-name');
    const createBtn = document.getElementById('create-profile-btn');

    createBtn.onclick = () => {
      const profile = Store.createProfile(nameInput.value);
      if (!profile) { UI.toast('Entrez un nom', true); return; }
      Store.setActiveProfile(profile.id);
      nameInput.value = '';
      enterApp();
    };
    nameInput.onkeydown = e => { if (e.key === 'Enter') createBtn.click(); };
  }

  function renderProfileList() {
    const list = document.getElementById('profile-list');
    const profiles = Store.getProfiles();
    if (!profiles.length) {
      list.innerHTML = '<p class="muted">Aucun profil. Créez-en un pour commencer.</p>';
      return;
    }
    list.innerHTML = profiles.map(p => `
      <div class="profile-item" data-id="${p.id}">
        <span class="avatar">${UI.initials(p.name)}</span>
        <span class="pname">${UI.escapeHtml(p.name)}</span>
        <button class="pdel" data-del="${p.id}" title="Supprimer ce profil">🗑</button>
      </div>
    `).join('');

    list.querySelectorAll('.profile-item').forEach(item => {
      item.onclick = e => {
        if (e.target.dataset.del) return; // clic sur la corbeille géré à part
        Store.setActiveProfile(item.dataset.id);
        enterApp();
      };
    });
    list.querySelectorAll('.pdel').forEach(btn => {
      btn.onclick = e => {
        e.stopPropagation();
        const id = btn.dataset.del;
        const p = Store.getProfiles().find(x => x.id === id);
        if (confirm(`Supprimer le profil « ${p.name} » et toutes ses données ?`)) {
          Store.deleteProfile(id);
          renderProfileList();
          UI.toast('Profil supprimé');
        }
      };
    });
  }

  // =================================================================
  //  ENTRÉE DANS L'APPLICATION
  // =================================================================
  function enterApp() {
    const profile = Store.getActiveProfile();
    if (!profile) { showProfileGate(); return; }

    document.getElementById('profile-gate').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    // Avatar / nom dans la nav
    document.getElementById('nav-avatar').textContent = UI.initials(profile.name);
    document.getElementById('nav-profile-name').textContent = profile.name;

    // Initialise la carte (priorité) et la vue par défaut
    switchView('map');
  }

  // =================================================================
  //  NAVIGATION ENTRE VUES
  // =================================================================
  function switchView(view) {
    // Onglets
    document.querySelectorAll('.nav-link').forEach(b =>
      b.classList.toggle('active', b.dataset.view === view));
    // Sections
    document.querySelectorAll('.view').forEach(v =>
      v.classList.toggle('active', v.id === 'view-' + view));

    // (Re)charge le contenu de la vue ciblée
    switch (view) {
      case 'map':
        // Leaflet doit recalculer sa taille quand le conteneur devient visible
        MapView.init();
        setTimeout(() => MapView.renderSpots(), 50);
        break;
      case 'sessions': Sessions.render(); break;
      case 'planner':  Planner.render(); break;
      case 'stats':    Stats.render(); break;
      case 'gallery':  Gallery.render(); break;
    }
  }

  // =================================================================
  //  ACTIONS GLOBALES (nav, boutons, export/import)
  // =================================================================
  function bindGlobalActions() {
    // Navigation
    document.querySelectorAll('.nav-link').forEach(btn => {
      btn.onclick = () => switchView(btn.dataset.view);
    });

    // Changer de profil
    document.getElementById('profile-switch').onclick = () => {
      Store.setActiveProfile(null);
      showProfileGate();
    };

    // Nouvelle session
    document.getElementById('new-session-btn').onclick = () => Sessions.openForm();

    // Export JSON
    document.getElementById('export-btn').onclick = exportData;

    // Import JSON
    document.getElementById('import-btn').onclick = () =>
      document.getElementById('import-file').click();
    document.getElementById('import-file').onchange = importData;
  }

  // ---------- Export ----------
  function exportData() {
    const payload = Store.exportProfile();
    const profile = Store.getActiveProfile();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `carnet-peche-${(profile ? profile.name : 'export').replace(/\s+/g, '_')}-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    UI.toast('Données exportées ⬇');
  }

  // ---------- Import ----------
  function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        const mode = confirm(
          'OK = REMPLACER les données du profil courant.\n' +
          'Annuler = FUSIONNER avec les données existantes.'
        ) ? 'replace' : 'merge';
        Store.importIntoActive(payload, mode);
        UI.toast('Données importées ✅');
        // Rafraîchit toutes les vues
        switchView('stats');
        MapView.renderSpots();
      } catch (err) {
        console.error(err);
        UI.toast('Fichier invalide', true);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // permet de réimporter le même fichier
  }

})();

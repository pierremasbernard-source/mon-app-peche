/* =================================================================
   map.js — carte interactive Leaflet + gestion des spots
   Priorité MAX du projet.
   ================================================================= */

const MapView = (() => {
  let map = null;
  let markers = {};            // id du spot -> marqueur Leaflet
  // Centre par défaut : Bretagne côte nord, secteur Penvénan / Port-Blanc
  const DEFAULT_CENTER = [48.82, -3.30];
  const DEFAULT_ZOOM = 12;

  // Crée une icône de marqueur colorée selon le type (mer / eau douce)
  function makeIcon(type) {
    return L.divIcon({
      className: '',
      html: `<div class="spot-marker ${type === 'douce' ? 'douce' : 'mer'}"></div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 26],   // pointe en bas
      popupAnchor: [0, -24],
    });
  }

  function init() {
    if (map) { map.invalidateSize(); return; }

    map = L.map('map').setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    // Tuiles OpenStreetMap (gratuites, pas de clé API)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map);

    // Clic sur la carte -> formulaire d'ajout de spot à ces coordonnées
    map.on('click', e => openSpotForm(null, e.latlng.lat, e.latlng.lng));

    renderSpots();
  }

  // (Re)dessine tous les marqueurs
  function renderSpots() {
    if (!map) return;
    Object.values(markers).forEach(m => map.removeLayer(m));
    markers = {};

    const spots = Store.getSpots();
    spots.forEach(spot => {
      const marker = L.marker([spot.lat, spot.lng], { icon: makeIcon(spot.type) })
        .addTo(map)
        .bindPopup(() => buildPopup(spot), { minWidth: 220 });
      markers[spot.id] = marker;
    });
  }

  // Contenu de la popup d'un spot : infos + sessions + actions
  function buildPopup(spot) {
    const sessions = Store.getSessionsForSpot(spot.id);
    const typeLabel = spot.type === 'douce' ? '💧 Eau douce' : '🌊 Mer';

    let sessionsHtml = '<em>Aucune session ici pour l\'instant.</em>';
    if (sessions.length) {
      sessionsHtml = '<ul class="popup-sessions">' + sessions.slice(0, 5).map(s => {
        const nb = (s.captures || []).length;
        return `<li>${UI.formatDate(s.date)} — ${s.type === 'chasse' ? '🤿' : '🎣'} ${nb} prise${nb > 1 ? 's' : ''}</li>`;
      }).join('') + '</ul>';
      if (sessions.length > 5) sessionsHtml += `<small>… et ${sessions.length - 5} autre(s)</small>`;
    }

    const container = document.createElement('div');
    container.className = 'spot-popup';
    container.innerHTML = `
      <h4>${UI.escapeHtml(spot.name)}</h4>
      <div>${typeLabel}</div>
      ${spot.notes ? `<p class="popup-notes">${UI.escapeHtml(spot.notes)}</p>` : ''}
      <strong>Sessions (${sessions.length})</strong>
      ${sessionsHtml}
      <div class="popup-actions">
        <button class="ps">+ Session</button>
        <button class="pe">Modifier</button>
        <button class="pd">Supprimer</button>
      </div>
    `;
    // Branche les actions
    container.querySelector('.ps').onclick = () => {
      map.closePopup();
      Sessions.openForm(null, spot.id);
    };
    container.querySelector('.pe').onclick = () => {
      map.closePopup();
      openSpotForm(spot);
    };
    container.querySelector('.pd').onclick = () => {
      if (confirm(`Supprimer le spot « ${spot.name} » ?`)) {
        Store.removeSpot(spot.id);
        map.closePopup();
        renderSpots();
        UI.toast('Spot supprimé');
      }
    };
    return container;
  }

  // Formulaire d'ajout / modification d'un spot (dans la modale)
  // spot = objet existant pour édition ; sinon lat/lng fournis pour création.
  function openSpotForm(spot, lat, lng) {
    const isEdit = !!spot;
    const s = spot || { name: '', type: 'mer', notes: '', lat, lng };

    UI.openModal(`
      <h3>${isEdit ? 'Modifier le spot' : 'Nouveau spot'}</h3>
      <div class="field-group">
        <label>Nom du spot</label>
        <input type="text" id="spot-name" value="${UI.escapeHtml(s.name)}" placeholder="Ex : Pointe du Château" />
      </div>
      <div class="field-group">
        <label>Type</label>
        <div class="type-toggle" id="spot-type-toggle">
          <button type="button" data-type="mer" class="${s.type !== 'douce' ? 'active' : ''}">🌊 Mer</button>
          <button type="button" data-type="douce" class="${s.type === 'douce' ? 'active' : ''}">💧 Eau douce</button>
        </div>
      </div>
      <div class="field-group">
        <label>Notes personnelles</label>
        <textarea id="spot-notes" placeholder="Ex : riche en dorades, rochers tranchants, bon en mai…">${UI.escapeHtml(s.notes)}</textarea>
      </div>
      <p class="muted">📍 ${Number(s.lat).toFixed(5)}, ${Number(s.lng).toFixed(5)}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="spot-cancel">Annuler</button>
        <button class="btn btn-primary" id="spot-save">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
      </div>
    `);

    let selectedType = s.type || 'mer';
    document.querySelectorAll('#spot-type-toggle button').forEach(btn => {
      btn.onclick = () => {
        selectedType = btn.dataset.type;
        document.querySelectorAll('#spot-type-toggle button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      };
    });

    document.getElementById('spot-cancel').onclick = UI.closeModal;
    document.getElementById('spot-save').onclick = () => {
      const name = document.getElementById('spot-name').value.trim();
      const notes = document.getElementById('spot-notes').value.trim();
      if (!name) { UI.toast('Donnez un nom au spot', true); return; }

      if (isEdit) {
        Store.updateSpot(s.id, { name, type: selectedType, notes });
        UI.toast('Spot mis à jour');
      } else {
        Store.addSpot({ name, type: selectedType, lat: s.lat, lng: s.lng, notes });
        UI.toast('Spot ajouté');
      }
      UI.closeModal();
      renderSpots();
    };
  }

  // Centre la carte sur un spot (utilisé depuis d'autres vues)
  function focusSpot(spotId) {
    const spot = Store.getSpot(spotId);
    if (spot && map) {
      map.setView([spot.lat, spot.lng], 14);
      const m = markers[spotId];
      if (m) m.openPopup();
    }
  }

  return { init, renderSpots, openSpotForm, focusSpot };
})();

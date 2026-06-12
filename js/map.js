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

  /* ---------------------------------------------------------------
     FONDS DE CARTE SHOM (cartes marines)
     ---------------------------------------------------------------
     Le SHOM diffuse ses données en WMTS (https://services.data.shom.fr).
     Leaflet ne gère pas le WMTS nativement : on consomme les tuiles via
     L.tileLayer avec une URL « KVP » GetTile. Le TileMatrixSet « 3857 »
     est en EPSG:3857 (Web Mercator) avec des niveaux 0→21 dont les
     identifiants correspondent directement au {z} de Leaflet ; on mappe
     donc tilematrix={z}, tilerow={y}, tilecol={x} sans reprojection.
     (Identifiants de couches/format/TMS lus dans le GetCapabilities,
      pas devinés — voir CLAUDE.md.)

     ⚠️ La couche d'assemblage des CARTES MARINES RASTER
     (RASTER_MARINE_3857_WMTS) n'est PAS publique : sans clé elle renvoie
     HTTP 401 « MissingRights ». Pour l'activer, créez une clé d'API
     gratuite sur https://data.shom.fr puis collez-la ci-dessous : la
     couche passe alors par l'endpoint authentifié et devient le fond
     principal. Les autres couches SHOM (bathymétrie, nature des fonds,
     toponymie) sont, elles, accessibles librement.
  --------------------------------------------------------------- */
  const SHOM_API_KEY = ''; // ← collez votre clé SHOM ici pour activer les cartes marines raster

  // Construit une couche Leaflet à partir d'un identifiant de couche WMTS SHOM.
  function shomLayer(layerId, opts = {}) {
    // Avec une clé : endpoint authentifié ; sinon : endpoint public INSPIRE.
    const base = SHOM_API_KEY
      ? `https://services.data.shom.fr/${SHOM_API_KEY}/wmts`
      : 'https://services.data.shom.fr/INSPIRE/wmts';
    const url = base
      + '?service=WMTS&version=1.0.0&request=GetTile'
      + `&layer=${layerId}&style=normal&tilematrixset=3857&format=image/png`
      + '&tilematrix={z}&tilerow={y}&tilecol={x}';
    return L.tileLayer(url, Object.assign({
      attribution: '© SHOM',
      maxZoom: 19,        // zoom max d'affichage de la carte
      maxNativeZoom: 18,  // au-delà, Leaflet agrandit la dernière tuile dispo
    }, opts));
  }

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

    // --- Fonds de carte (un seul actif à la fois) ---
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    });
    // Assemblage des cartes marines raster du SHOM (sondes, isobathes…).
    // Nécessite une clé d'API (cf. SHOM_API_KEY) ; sinon les tuiles renvoient 401.
    const shomRaster = shomLayer('RASTER_MARINE_3857_WMTS');

    const baseLayers = {
      'OpenStreetMap': osm,
      ['🌊 SHOM · Cartes marines' + (SHOM_API_KEY ? '' : ' (clé requise)')]: shomRaster,
    };

    // --- Overlays SHOM optionnels (cumulables par-dessus le fond) ---
    // Couches publiques (accessibles sans clé), utiles pour la pêche.
    const overlays = {
      // Bathymétrie côtière haute résolution Bretagne (Lidar Litto3D)
      'SHOM · Bathymétrie Bretagne': shomLayer('LITTO3D_BZH_2018_2021_PYR_3857_WMTS', { opacity: 0.85 }),
      // Bathymétrie large façade Atlantique (MNT 100 m)
      'SHOM · Bathymétrie large (MNT)': shomLayer('MNT_ATL100m_HOMONIM_PBMA_3857_WMTS', { opacity: 0.8, maxNativeZoom: 14 }),
      // Nature des fonds / sédimentologie (sable, roche, vase…)
      'SHOM · Nature des fonds': shomLayer('NDF_PYR-PNG_WLD_3857_WMTS', { opacity: 0.75, maxNativeZoom: 16 }),
      // Toponymie marine
      'SHOM · Toponymie marine': shomLayer('TOPONYMIE_PYR_PNG_3857_WMTS'),
    };

    // Fond par défaut : cartes marines SHOM si une clé est configurée,
    // sinon OpenStreetMap (le fond raster serait en 401 sans clé).
    (SHOM_API_KEY ? shomRaster : osm).addTo(map);

    // Sélecteur de couches : on le construit déplié (collapsed:false) pour que
    // tout le DOM du panneau soit présent, puis on l'encapsule derrière un bouton
    // de bascule discret (voir setupLayersToggle + styles .cp-layers* dans le CSS).
    const layersControl = L.control.layers(baseLayers, overlays, { collapsed: false }).addTo(map);
    setupLayersToggle(layersControl);

    // Clic sur la carte -> formulaire d'ajout de spot à ces coordonnées
    map.on('click', e => openSpotForm(null, e.latlng.lat, e.latlng.lng));

    renderSpots();
  }

  // Transforme le panneau de couches (toujours ouvert) en bouton « toggle » :
  // un bouton sombre et explicite ouvre/ferme le panneau au clic.
  function setupLayersToggle(control) {
    const container = control.getContainer();
    // cp-collapsed = panneau masqué au départ (seul le bouton est visible)
    container.classList.add('cp-layers', 'cp-collapsed');

    // Bouton placé en tête du contrôle
    const btn = L.DomUtil.create('button', 'cp-layers-btn');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Changer de fond de carte');
    btn.innerHTML = '🗺️ Fond de carte <span class="cp-caret">▾</span>';
    container.insertBefore(btn, container.firstChild);

    // Empêche le clic de se propager à la carte (pan/zoom) et bascule l'état
    L.DomEvent.disableClickPropagation(container);
    btn.addEventListener('click', () => container.classList.toggle('cp-collapsed'));
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

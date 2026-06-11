/* =================================================================
   sessions.js — liste + formulaire de log d'une sortie de pêche
   Le formulaire affiche dynamiquement les champs selon le type
   (chasse sous-marine vs canne).
   ================================================================= */

const Sessions = (() => {

  // État temporaire des captures pendant l'édition du formulaire
  let draftCaptures = [];

  // ---------- LISTE DES SESSIONS ----------
  function render() {
    const wrap = document.getElementById('sessions-list');
    const sessions = Store.getSessions();

    if (!sessions.length) {
      wrap.innerHTML = `
        <div class="empty">
          <span class="big">📋</span>
          Aucune session enregistrée.<br />
          Cliquez sur « + Nouvelle session » pour commencer.
        </div>`;
      return;
    }

    wrap.innerHTML = sessions.map(s => {
      const spot = s.spotId ? Store.getSpot(s.spotId) : null;
      const nb = (s.captures || []).length;
      const isChasse = s.type === 'chasse';
      return `
        <div class="session-card ${isChasse ? '' : 'canne'}" data-id="${s.id}">
          <div class="session-badge">${isChasse ? '🤿' : '🎣'}</div>
          <div class="session-info">
            <h3>${isChasse ? 'Chasse sous-marine' : 'Pêche à la canne'}${spot ? ' — ' + UI.escapeHtml(spot.name) : ''}</h3>
            <div class="session-meta">
              <span>📅 ${UI.formatDateTime(s.date)}</span>
              ${s.duree ? `<span>⏱ ${UI.formatDuration(s.duree)}</span>` : ''}
              ${s.conditions && s.conditions.meteo ? `<span>${weatherEmoji(s.conditions.meteo)} ${s.conditions.meteo}</span>` : ''}
              ${isChasse && s.profondeurMax ? `<span>⬇ ${s.profondeurMax} m</span>` : ''}
            </div>
          </div>
          <div class="session-catch-count">${nb} 🐟</div>
        </div>`;
    }).join('');

    // Clic sur une carte -> détail
    wrap.querySelectorAll('.session-card').forEach(card => {
      card.onclick = () => openDetail(card.dataset.id);
    });
  }

  function weatherEmoji(m) {
    return { 'ensoleillé': '☀️', 'nuageux': '☁️', 'pluie': '🌧️', 'vent': '💨' }[m] || '🌤️';
  }

  // ---------- DÉTAIL D'UNE SESSION ----------
  function openDetail(id) {
    const s = Store.getSession(id);
    if (!s) return;
    const spot = s.spotId ? Store.getSpot(s.spotId) : null;
    const c = s.conditions || {};
    const isChasse = s.type === 'chasse';

    const capturesHtml = (s.captures || []).length
      ? s.captures.map(cap => `
          <div class="catch-row" style="grid-template-columns: auto 1fr;">
            ${cap.photo ? `<img src="${cap.photo}" class="catch-thumb" />` : '<div class="catch-thumb" style="background:var(--bg-3);display:grid;place-items:center">🐟</div>'}
            <div>
              <strong>${UI.escapeHtml(cap.espece || 'Poisson')}</strong><br />
              <span class="muted">${cap.taille ? cap.taille + ' cm' : ''} ${cap.poids ? '· ' + UI.formatWeight(cap.poids) : ''}</span>
            </div>
          </div>`).join('')
      : '<p class="muted">Aucune capture enregistrée.</p>';

    UI.openModal(`
      <h3>${isChasse ? '🤿 Chasse sous-marine' : '🎣 Pêche à la canne'}</h3>
      <p class="muted">${UI.formatDateTime(s.date)}${spot ? ' · ' + UI.escapeHtml(spot.name) : ''}</p>

      <div class="form-grid" style="margin:1rem 0">
        ${field('Météo', c.meteo)}
        ${field('État de la mer', c.etatMer)}
        ${field('Visibilité', c.visibilite)}
        ${field('Temp. eau', c.tempEau != null && c.tempEau !== '' ? c.tempEau + ' °C' : null)}
        ${field('Coef. marée', c.coefMaree)}
        ${field('Durée', s.duree ? UI.formatDuration(s.duree) : null)}
        ${isChasse ? field('Profondeur max', s.profondeurMax ? s.profondeurMax + ' m' : null) : ''}
        ${!isChasse ? field('Technique / appât', s.technique) : ''}
      </div>

      ${s.notes ? `<div class="field-group"><label>Notes</label><p>${UI.escapeHtml(s.notes)}</p></div>` : ''}

      <h4>Captures (${(s.captures || []).length})</h4>
      ${capturesHtml}

      <div class="modal-actions">
        <button class="btn btn-danger" id="sess-del">Supprimer</button>
        <button class="btn btn-ghost" id="sess-edit">Modifier</button>
        <button class="btn btn-primary" id="sess-close">Fermer</button>
      </div>
    `);

    document.getElementById('sess-close').onclick = UI.closeModal;
    document.getElementById('sess-edit').onclick = () => openForm(s);
    document.getElementById('sess-del').onclick = () => {
      if (confirm('Supprimer cette session ?')) {
        Store.removeSession(id);
        UI.closeModal();
        render();
        UI.toast('Session supprimée');
      }
    };
  }

  // petit helper d'affichage d'un champ en lecture seule
  function field(label, value) {
    if (value == null || value === '') return '';
    return `<div><label>${label}</label><div>${UI.escapeHtml(value)}</div></div>`;
  }

  // ---------- FORMULAIRE (création / édition) ----------
  // session = objet existant (édition) | null. presetSpotId = spot pré-sélectionné.
  function openForm(session = null, presetSpotId = null) {
    const isEdit = !!session;
    const s = session || {
      type: 'chasse', date: localDatetimeNow(), spotId: presetSpotId,
      conditions: {}, captures: [],
    };
    draftCaptures = JSON.parse(JSON.stringify(s.captures || [])); // copie de travail

    const spots = Store.getSpots();
    const spotOptions = ['<option value="">— Aucun / non listé —</option>']
      .concat(spots.map(sp => `<option value="${sp.id}" ${s.spotId === sp.id ? 'selected' : ''}>${UI.escapeHtml(sp.name)}</option>`))
      .join('');
    const c = s.conditions || {};

    UI.openModal(`
      <h3>${isEdit ? 'Modifier la session' : 'Nouvelle session'}</h3>

      <div class="type-toggle" id="sess-type-toggle">
        <button type="button" data-type="chasse" class="${s.type === 'chasse' ? 'active' : ''}">🤿 Chasse sous-marine</button>
        <button type="button" data-type="canne" class="${s.type === 'canne' ? 'active' : ''}">🎣 Canne</button>
      </div>

      <div class="form-grid">
        <div>
          <label>Date &amp; heure</label>
          <input type="datetime-local" id="f-date" value="${s.date}" />
        </div>
        <div>
          <label>Spot</label>
          <select id="f-spot">${spotOptions}</select>
        </div>

        <div>
          <label>Météo</label>
          <select id="f-meteo">
            ${selOpts(['', 'ensoleillé', 'nuageux', 'pluie', 'vent'], c.meteo)}
          </select>
        </div>
        <div>
          <label>État de la mer</label>
          <select id="f-mer">
            ${selOpts(['', 'calme', 'peu agitée', 'agitée', 'forte'], c.etatMer)}
          </select>
        </div>
        <div>
          <label>Visibilité de l'eau</label>
          <select id="f-visi">
            ${selOpts(['', 'excellente', 'bonne', 'moyenne', 'mauvaise'], c.visibilite)}
          </select>
        </div>
        <div>
          <label>Temp. eau (°C)</label>
          <input type="number" id="f-temp" step="0.5" value="${c.tempEau ?? ''}" />
        </div>
        <div>
          <label>Coef. de marée</label>
          <input type="number" id="f-coef" min="20" max="120" value="${c.coefMaree ?? ''}" placeholder="20–120" />
        </div>
        <div>
          <label>Durée (minutes)</label>
          <input type="number" id="f-duree" min="0" value="${s.duree ?? ''}" />
        </div>

        <!-- Champ conditionnel : chasse sous-marine uniquement -->
        <div class="conditional" id="cond-chasse">
          <label>Profondeur max (m)</label>
          <input type="number" id="f-prof" min="0" step="0.5" value="${s.profondeurMax ?? ''}" />
        </div>
        <!-- Champ conditionnel : canne uniquement -->
        <div class="conditional full" id="cond-canne">
          <label>Technique / appât</label>
          <input type="text" id="f-tech" value="${UI.escapeHtml(s.technique || '')}" placeholder="Ex : leurre souple, ver marin, cuillère…" />
        </div>
      </div>

      <div class="field-group" style="margin-top:1rem">
        <label>Notes / ressenti</label>
        <textarea id="f-notes" placeholder="Comment s'est passée la sortie ?">${UI.escapeHtml(s.notes || '')}</textarea>
      </div>

      <h4>Captures</h4>
      <div id="captures-list"></div>
      <button type="button" class="btn btn-ghost btn-sm" id="add-catch">+ Ajouter une capture</button>

      <div class="modal-actions">
        <button class="btn btn-ghost" id="f-cancel">Annuler</button>
        <button class="btn btn-primary" id="f-save">${isEdit ? 'Enregistrer' : 'Créer la session'}</button>
      </div>
    `);

    // Gestion du type (affiche/masque les champs conditionnels)
    let selectedType = s.type;
    function applyType() {
      document.getElementById('cond-chasse').classList.toggle('show', selectedType === 'chasse');
      document.getElementById('cond-canne').classList.toggle('show', selectedType === 'canne');
    }
    document.querySelectorAll('#sess-type-toggle button').forEach(btn => {
      btn.onclick = () => {
        selectedType = btn.dataset.type;
        document.querySelectorAll('#sess-type-toggle button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyType();
      };
    });
    applyType();

    renderCaptures();
    document.getElementById('add-catch').onclick = () => {
      draftCaptures.push({ id: Store.uid(), espece: '', taille: '', poids: '', photo: null });
      renderCaptures();
    };

    document.getElementById('f-cancel').onclick = UI.closeModal;
    document.getElementById('f-save').onclick = () => save(isEdit ? s.id : null, selectedType);
  }

  // Rendu de la liste de captures éditables
  function renderCaptures() {
    const wrap = document.getElementById('captures-list');
    if (!wrap) return;
    wrap.innerHTML = draftCaptures.map((cap, i) => `
      <div class="catch-row" data-i="${i}">
        <div>
          <label>Espèce</label>
          <input type="text" class="c-espece" value="${UI.escapeHtml(cap.espece)}" placeholder="Ex : Bar, Dorade…" />
        </div>
        <div>
          <label>Taille (cm)</label>
          <input type="number" class="c-taille" value="${cap.taille ?? ''}" min="0" />
        </div>
        <div>
          <label>Poids (g)</label>
          <input type="number" class="c-poids" value="${cap.poids ?? ''}" min="0" />
        </div>
        <button type="button" class="catch-remove" title="Retirer">✕</button>
        <div class="catch-photo-cell">
          ${cap.photo ? `<img src="${cap.photo}" class="catch-thumb" />` : ''}
          <input type="file" class="c-photo" accept="image/*" />
        </div>
      </div>
    `).join('');

    // Branche les événements de chaque ligne
    wrap.querySelectorAll('.catch-row').forEach(row => {
      const i = +row.dataset.i;
      row.querySelector('.c-espece').oninput = e => draftCaptures[i].espece = e.target.value;
      row.querySelector('.c-taille').oninput = e => draftCaptures[i].taille = e.target.value;
      row.querySelector('.c-poids').oninput  = e => draftCaptures[i].poids = e.target.value;
      row.querySelector('.catch-remove').onclick = () => { draftCaptures.splice(i, 1); renderCaptures(); };
      row.querySelector('.c-photo').onchange = async e => {
        const file = e.target.files[0];
        if (!file) return;
        UI.toast('Compression de la photo…');
        draftCaptures[i].photo = await UI.compressImage(file);
        renderCaptures();
      };
    });
  }

  // Sauvegarde de la session
  function save(existingId, type) {
    const get = id => document.getElementById(id);
    // Nettoie les captures vides (sans espèce ni photo)
    const captures = draftCaptures
      .filter(c => (c.espece && c.espece.trim()) || c.photo)
      .map(c => ({
        id: c.id, espece: (c.espece || '').trim(),
        taille: c.taille === '' ? null : Number(c.taille),
        poids: c.poids === '' ? null : Number(c.poids),
        photo: c.photo || null,
      }));

    const payload = {
      type,
      date: get('f-date').value || Store.nowISO(),
      spotId: get('f-spot').value || null,
      conditions: {
        meteo: get('f-meteo').value,
        etatMer: get('f-mer').value,
        visibilite: get('f-visi').value,
        tempEau: get('f-temp').value === '' ? null : Number(get('f-temp').value),
        coefMaree: get('f-coef').value === '' ? null : Number(get('f-coef').value),
      },
      duree: get('f-duree').value === '' ? null : Number(get('f-duree').value),
      profondeurMax: type === 'chasse' && get('f-prof').value !== '' ? Number(get('f-prof').value) : null,
      technique: type === 'canne' ? get('f-tech').value.trim() : '',
      notes: get('f-notes').value.trim(),
      captures,
    };

    if (existingId) {
      Store.updateSession(existingId, payload);
      UI.toast('Session enregistrée');
    } else {
      Store.addSession(payload);
      UI.toast('Session créée 🎣');
    }
    UI.closeModal();
    render();
    // Rafraîchit les autres vues si déjà chargées
    if (window.MapView) MapView.renderSpots();
  }

  // ---------- helpers ----------
  function selOpts(values, current) {
    return values.map(v =>
      `<option value="${v}" ${v === current ? 'selected' : ''}>${v || '—'}</option>`
    ).join('');
  }
  // valeur "datetime-local" pour maintenant (au format YYYY-MM-DDTHH:mm)
  function localDatetimeNow() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }

  return { render, openForm, openDetail };
})();

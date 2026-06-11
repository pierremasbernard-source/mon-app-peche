/* =================================================================
   gallery.js — galerie de toutes les prises avec photo
   Affiche chaque capture photographiée avec son contexte.
   ================================================================= */

const Gallery = (() => {

  function render() {
    const wrap = document.getElementById('gallery-content');
    const sessions = Store.getSessions();

    // Rassemble toutes les captures qui ont une photo
    const items = [];
    sessions.forEach(s => {
      const spot = s.spotId ? Store.getSpot(s.spotId) : null;
      (s.captures || []).forEach(c => {
        if (c.photo) items.push({ capture: c, session: s, spot });
      });
    });

    if (!items.length) {
      wrap.className = '';  // retire la grille pour centrer le message vide
      wrap.innerHTML = `<div class="empty"><span class="big">📷</span>
        Aucune photo pour l'instant.<br />Ajoutez des photos à vos captures depuis le formulaire de session.</div>`;
      return;
    }

    wrap.className = 'gallery-content';
    wrap.innerHTML = items.map((it, i) => `
      <div class="gallery-item" data-i="${i}">
        <img src="${it.capture.photo}" loading="lazy" alt="${UI.escapeHtml(it.capture.espece || 'prise')}" />
        <div class="gallery-caption">
          <strong>${UI.escapeHtml(it.capture.espece || 'Poisson')}</strong>
          ${UI.formatDate(it.session.date)}${it.spot ? ' · ' + UI.escapeHtml(it.spot.name) : ''}
        </div>
      </div>
    `).join('');

    // Clic -> agrandissement dans la modale
    wrap.querySelectorAll('.gallery-item').forEach(el => {
      el.onclick = () => openLightbox(items[+el.dataset.i]);
    });
  }

  function openLightbox(it) {
    const c = it.capture;
    UI.openModal(`
      <img src="${c.photo}" style="width:100%;border-radius:10px;margin-bottom:1rem" />
      <h3>${UI.escapeHtml(c.espece || 'Poisson')}</h3>
      <div class="session-meta">
        ${c.taille ? `<span>📏 ${c.taille} cm</span>` : ''}
        ${c.poids ? `<span>⚖️ ${UI.formatWeight(c.poids)}</span>` : ''}
        <span>📅 ${UI.formatDateTime(it.session.date)}</span>
        ${it.spot ? `<span>📍 ${UI.escapeHtml(it.spot.name)}</span>` : ''}
        <span>${it.session.type === 'chasse' ? '🤿 Chasse' : '🎣 Canne'}</span>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="lb-close">Fermer</button>
      </div>
    `);
    document.getElementById('lb-close').onclick = UI.closeModal;
  }

  return { render };
})();

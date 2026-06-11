/* =================================================================
   ui.js — utilitaires d'interface réutilisables
   Modale, toast, compression d'images, helpers de formatage.
   ================================================================= */

const UI = (() => {

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(message, isError = false) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className = 'toast' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
  }

  // ---------- Modale ----------
  function openModal(html) {
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal-backdrop').classList.remove('hidden');
  }
  function closeModal() {
    document.getElementById('modal-backdrop').classList.add('hidden');
    document.getElementById('modal-body').innerHTML = '';
  }

  // ---------- Helpers de formatage ----------
  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  // poids stocké en grammes -> affichage lisible
  function formatWeight(grams) {
    if (grams == null || grams === '') return '—';
    const g = Number(grams);
    return g >= 1000 ? (g / 1000).toFixed(2).replace(/\.?0+$/, '') + ' kg' : g + ' g';
  }
  function formatDuration(min) {
    if (!min) return '—';
    const h = Math.floor(min / 60), m = min % 60;
    return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`;
  }
  // initiales pour avatar
  function initials(name) {
    return (name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  // ---------- Compression d'image (avant stockage base64) ----------
  // Redimensionne à maxDim px max et compresse en JPEG pour ne pas
  // saturer le localStorage. Renvoie une Promise<string> (dataURL).
  function compressImage(file, maxDim = 1000, quality = 0.72) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > height && width > maxDim) { height = height * maxDim / width; width = maxDim; }
          else if (height > maxDim) { width = width * maxDim / height; height = maxDim; }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Initialise la fermeture de la modale (clic backdrop / croix / Echap)
  function initModal() {
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-backdrop').addEventListener('click', e => {
      if (e.target.id === 'modal-backdrop') closeModal();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
    });
  }

  return {
    toast, openModal, closeModal, initModal,
    escapeHtml, formatDate, formatDateTime, formatWeight, formatDuration, initials,
    compressImage,
  };
})();

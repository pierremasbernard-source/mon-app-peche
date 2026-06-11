/* =================================================================
   storage.js — couche de données (localStorage)
   -----------------------------------------------------------------
   Tout passe par cette couche. Elle isole les données par profil et
   expose une API « repository » (getSpots, addSession, ...).

   >>> MIGRATION SUPABASE (plus tard) <<<
   Le modèle est volontairement « plat » et chaque entité porte :
     - id        : identifiant unique (uuid) -> clé primaire Supabase
     - createdAt / updatedAt : timestamps ISO -> colonnes timestamptz
     - (les sessions/spots seraient liés à profile_id = user_id)
   Pour brancher Supabase, il suffira de réécrire les fonctions
   _load/_save (et add/update/remove) en appels async à supabase-js,
   en gardant la même signature. Le reste de l'app n'a pas à changer.
   ================================================================= */

const Store = (() => {
  const NS = 'carnetpeche.v1';                 // namespace localStorage (versionné)
  const K_PROFILES = `${NS}.profiles`;         // liste des profils
  const K_ACTIVE   = `${NS}.activeProfile`;    // id du profil courant
  const K_DATA     = (pid) => `${NS}.data.${pid}`; // données d'un profil

  // --- utilitaires -------------------------------------------------
  // Génère un identifiant unique (compatible « uuid-like » pour Supabase).
  function uid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  const nowISO = () => new Date().toISOString();

  function _read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error('Lecture localStorage échouée', key, e);
      return fallback;
    }
  }
  function _write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      // Souvent : quota dépassé (photos base64 trop lourdes)
      console.error('Écriture localStorage échouée', key, e);
      if (e && e.name === 'QuotaExceededError') {
        UI && UI.toast && UI.toast('Stockage plein : réduisez les photos ou exportez vos données.', true);
      }
      return false;
    }
  }

  // --- structure vide d'un profil ---------------------------------
  function _emptyData() {
    return { spots: [], sessions: [], settings: {} };
  }

  // =================================================================
  //  PROFILS
  // =================================================================
  function getProfiles() { return _read(K_PROFILES, []); }

  function getActiveProfileId() { return _read(K_ACTIVE, null); }
  function getActiveProfile() {
    const id = getActiveProfileId();
    return getProfiles().find(p => p.id === id) || null;
  }
  function setActiveProfile(id) { _write(K_ACTIVE, id); }

  function createProfile(name) {
    name = (name || '').trim();
    if (!name) return null;
    const profiles = getProfiles();
    const profile = { id: uid(), name, createdAt: nowISO() };
    profiles.push(profile);
    _write(K_PROFILES, profiles);
    _write(K_DATA(profile.id), _emptyData()); // initialise le conteneur de données
    return profile;
  }

  function deleteProfile(id) {
    const profiles = getProfiles().filter(p => p.id !== id);
    _write(K_PROFILES, profiles);
    localStorage.removeItem(K_DATA(id));
    if (getActiveProfileId() === id) _write(K_ACTIVE, null);
  }

  // =================================================================
  //  DONNÉES DU PROFIL COURANT
  // =================================================================
  function _data() {
    const pid = getActiveProfileId();
    if (!pid) return _emptyData();
    return _read(K_DATA(pid), _emptyData());
  }
  function _saveData(data) {
    const pid = getActiveProfileId();
    if (!pid) return false;
    return _write(K_DATA(pid), data);
  }

  // ---------- SPOTS ----------
  function getSpots() { return _data().spots; }
  function getSpot(id) { return _data().spots.find(s => s.id === id) || null; }

  function addSpot({ name, type, lat, lng, notes }) {
    const data = _data();
    const spot = {
      id: uid(), name, type, lat, lng, notes: notes || '',
      createdAt: nowISO(), updatedAt: nowISO(),
    };
    data.spots.push(spot);
    _saveData(data);
    return spot;
  }

  function updateSpot(id, patch) {
    const data = _data();
    const spot = data.spots.find(s => s.id === id);
    if (!spot) return null;
    Object.assign(spot, patch, { updatedAt: nowISO() });
    _saveData(data);
    return spot;
  }

  function removeSpot(id) {
    const data = _data();
    data.spots = data.spots.filter(s => s.id !== id);
    // On détache les sessions liées plutôt que de les supprimer.
    data.sessions.forEach(s => { if (s.spotId === id) s.spotId = null; });
    _saveData(data);
  }

  // ---------- SESSIONS ----------
  function getSessions() {
    // triées par date décroissante
    return _data().sessions.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }
  function getSession(id) { return _data().sessions.find(s => s.id === id) || null; }
  function getSessionsForSpot(spotId) { return getSessions().filter(s => s.spotId === spotId); }

  function addSession(session) {
    const data = _data();
    const rec = {
      id: uid(),
      type: session.type,            // 'chasse' | 'canne'
      date: session.date,            // ISO datetime
      spotId: session.spotId || null,
      conditions: session.conditions || {},
      duree: session.duree || null,  // minutes
      profondeurMax: session.profondeurMax || null,
      technique: session.technique || '',
      captures: session.captures || [],
      notes: session.notes || '',
      createdAt: nowISO(), updatedAt: nowISO(),
    };
    data.sessions.push(rec);
    _saveData(data);
    return rec;
  }

  function updateSession(id, patch) {
    const data = _data();
    const s = data.sessions.find(x => x.id === id);
    if (!s) return null;
    Object.assign(s, patch, { updatedAt: nowISO() });
    _saveData(data);
    return s;
  }

  function removeSession(id) {
    const data = _data();
    data.sessions = data.sessions.filter(s => s.id !== id);
    _saveData(data);
  }

  // =================================================================
  //  EXPORT / IMPORT (sauvegarde JSON)
  // =================================================================
  function exportProfile() {
    const profile = getActiveProfile();
    return {
      app: 'carnet-de-peche',
      version: 1,
      exportedAt: nowISO(),
      profile: profile ? { name: profile.name } : null,
      data: _data(),
    };
  }

  // Importe dans le profil courant. mode 'replace' ou 'merge'.
  function importIntoActive(payload, mode = 'replace') {
    if (!payload || !payload.data) throw new Error('Fichier invalide');
    const incoming = payload.data;
    if (mode === 'merge') {
      const data = _data();
      // Évite les doublons d'id
      const existingSpotIds = new Set(data.spots.map(s => s.id));
      const existingSessIds = new Set(data.sessions.map(s => s.id));
      (incoming.spots || []).forEach(s => { if (!existingSpotIds.has(s.id)) data.spots.push(s); });
      (incoming.sessions || []).forEach(s => { if (!existingSessIds.has(s.id)) data.sessions.push(s); });
      _saveData(data);
    } else {
      _saveData({
        spots: incoming.spots || [],
        sessions: incoming.sessions || [],
        settings: incoming.settings || {},
      });
    }
  }

  // API publique
  return {
    uid, nowISO,
    getProfiles, getActiveProfile, getActiveProfileId, setActiveProfile,
    createProfile, deleteProfile,
    getSpots, getSpot, addSpot, updateSpot, removeSpot,
    getSessions, getSession, getSessionsForSpot, addSession, updateSession, removeSession,
    exportProfile, importIntoActive,
  };
})();

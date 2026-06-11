/* =================================================================
   stats.js — tableau de bord, badges et graphiques
   Graphiques en barres CSS pur (aucune dépendance externe).
   ================================================================= */

const Stats = (() => {

  function render() {
    const sessions = Store.getSessions();
    const wrap = document.getElementById('stats-content');

    if (!sessions.length) {
      wrap.innerHTML = `<div class="empty"><span class="big">📊</span>
        Pas encore de données.<br />Enregistrez des sessions pour voir vos statistiques.</div>`;
      return;
    }

    const all = computeStats(sessions);

    wrap.innerHTML = `
      <!-- Chiffres clés -->
      <div class="stats-grid">
        <div class="stat-box"><div class="stat-value">${sessions.length}</div><div class="stat-label">Sessions</div></div>
        <div class="stat-box"><div class="stat-value">${all.totalCaptures}</div><div class="stat-label">Captures</div></div>
        <div class="stat-box"><div class="stat-value">${all.biggest ? UI.formatWeight(all.biggest.poids) : '—'}</div><div class="stat-label">Plus gros poisson</div></div>
        <div class="stat-box"><div class="stat-value" style="font-size:1.2rem">${all.topSpecies || '—'}</div><div class="stat-label">Espèce la + fréquente</div></div>
        <div class="stat-box"><div class="stat-value">${all.chasse} / ${all.canne}</div><div class="stat-label">Chasse / Canne</div></div>
      </div>

      <!-- Badges -->
      <h3 class="section-title">🏅 Badges</h3>
      <div class="badges-grid">
        ${ACHIEVEMENTS.map(a => {
          const unlocked = a.check(all, sessions);
          return `<div class="badge ${unlocked ? 'unlocked' : ''}">
            <div class="badge-icon">${a.icon}</div>
            <div class="badge-name">${a.name}</div>
            <div class="badge-desc">${a.desc}</div>
          </div>`;
        }).join('')}
      </div>

      <!-- Graphiques -->
      <h3 class="section-title">📈 Captures par mois</h3>
      ${barChart(all.byMonth)}

      <h3 class="section-title">🐟 Captures par espèce</h3>
      ${barChart(all.bySpecies)}

      <h3 class="section-title">📍 Captures par spot</h3>
      ${barChart(all.bySpot)}
    `;
  }

  // Calcule toutes les stats à partir des sessions
  function computeStats(sessions) {
    let totalCaptures = 0, chasse = 0, canne = 0, biggest = null;
    const species = {}, byMonth = {}, bySpecies = {}, bySpot = {};
    const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

    sessions.forEach(s => {
      if (s.type === 'chasse') chasse++; else canne++;
      const month = MONTHS[new Date(s.date).getMonth()];
      const spot = s.spotId ? Store.getSpot(s.spotId) : null;
      const spotName = spot ? spot.name : 'Sans spot';

      (s.captures || []).forEach(c => {
        totalCaptures++;
        if (c.espece) {
          species[c.espece] = (species[c.espece] || 0) + 1;
          bySpecies[c.espece] = (bySpecies[c.espece] || 0) + 1;
        }
        byMonth[month] = (byMonth[month] || 0) + 1;
        bySpot[spotName] = (bySpot[spotName] || 0) + 1;
        if (c.poids != null && (!biggest || Number(c.poids) > Number(biggest.poids))) biggest = c;
      });
    });

    // Espèce la plus fréquente
    let topSpecies = null, topCount = 0;
    for (const sp in species) if (species[sp] > topCount) { topSpecies = sp; topCount = species[sp]; }

    return {
      totalCaptures, chasse, canne, biggest, topSpecies,
      byMonth, bySpecies, bySpot, species,
      maxStreak: computeStreak(sessions),
      hasDouce: sessions.some(s => { const sp = s.spotId ? Store.getSpot(s.spotId) : null; return sp && sp.type === 'douce'; }),
    };
  }

  // Plus longue série de jours de sortie consécutifs
  function computeStreak(sessions) {
    const days = [...new Set(sessions.map(s => s.date.slice(0, 10)))].sort();
    let max = 0, cur = 0, prev = null;
    days.forEach(day => {
      if (prev) {
        const diff = (new Date(day) - new Date(prev)) / 86400000;
        cur = diff === 1 ? cur + 1 : 1;
      } else cur = 1;
      max = Math.max(max, cur);
      prev = day;
    });
    return max;
  }

  // Graphique en barres horizontales (objet {label: valeur})
  function barChart(data) {
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (!entries.length) return '<p class="muted">Pas de données.</p>';
    const max = Math.max(...entries.map(e => e[1]));
    return '<div class="bar-chart">' + entries.map(([label, val]) => `
      <div class="bar-row">
        <span class="bar-label" title="${UI.escapeHtml(label)}">${UI.escapeHtml(label)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(val / max * 100)}%"></div></div>
        <span class="bar-val">${val}</span>
      </div>`).join('') + '</div>';
  }

  // ---------- Définition des badges ----------
  // Chaque badge a une fonction check(stats, sessions) -> bool
  const ACHIEVEMENTS = [
    { icon: '🎣', name: 'Première prise', desc: 'Enregistrer 1 capture', check: s => s.totalCaptures >= 1 },
    { icon: '🤿', name: 'Apnéiste', desc: '5 sessions de chasse sous-marine', check: s => s.chasse >= 5 },
    { icon: '💧', name: 'Eau douce', desc: 'Une prise en eau douce', check: s => s.hasDouce },
    { icon: '🐟', name: 'Belle pêche', desc: '25 captures au total', check: s => s.totalCaptures >= 25 },
    { icon: '🏆', name: 'Gros poisson', desc: 'Une prise de + de 1 kg', check: s => s.biggest && Number(s.biggest.poids) >= 1000 },
    { icon: '🔥', name: 'Assidu', desc: '3 sorties jours consécutifs', check: s => s.maxStreak >= 3 },
    { icon: '🗺️', name: 'Explorateur', desc: '5 spots différents', check: () => Store.getSpots().length >= 5 },
    { icon: '🌊', name: 'Régulier', desc: '10 sessions enregistrées', check: (s, sessions) => sessions.length >= 10 },
  ];

  return { render };
})();

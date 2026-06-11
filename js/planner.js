/* =================================================================
   planner.js — « Quand y aller ? »
   - Saisie manuelle des conditions prévues -> reco basique.
   - Météo réelle via Open-Meteo (gratuit, sans clé) pour un spot.
   - Analyse de l'historique : meilleures périodes/conditions par spot.
   ================================================================= */

const Planner = (() => {

  function render() {
    const wrap = document.getElementById('planner-content');
    const spots = Store.getSpots();
    const spotOptions = spots.map(sp => `<option value="${sp.id}">${UI.escapeHtml(sp.name)}</option>`).join('');

    wrap.innerHTML = `
      <div class="planner-grid">
        <!-- Recommandation manuelle -->
        <div class="card">
          <h3>Estimer les conditions</h3>
          <p class="muted">Saisissez les conditions prévues pour obtenir une recommandation.</p>
          <div class="field-group">
            <label>Météo prévue</label>
            <select id="p-meteo">
              <option value="ensoleillé">☀️ Ensoleillé</option>
              <option value="nuageux">☁️ Nuageux</option>
              <option value="pluie">🌧️ Pluie</option>
              <option value="vent">💨 Vent</option>
            </select>
          </div>
          <div class="field-group">
            <label>État de la mer prévu</label>
            <select id="p-mer">
              <option value="calme">Calme</option>
              <option value="peu agitée">Peu agitée</option>
              <option value="agitée">Agitée</option>
              <option value="forte">Forte</option>
            </select>
          </div>
          <div class="field-group">
            <label>Coefficient de marée</label>
            <input type="number" id="p-coef" min="20" max="120" value="70" />
          </div>
          <button class="btn btn-primary btn-block" id="p-eval">Évaluer</button>
          <div id="p-reco"></div>
        </div>

        <!-- Météo réelle Open-Meteo -->
        <div class="card">
          <h3>Météo du spot</h3>
          ${spots.length ? `
            <div class="field-group">
              <label>Choisir un spot</label>
              <select id="p-spot">${spotOptions}</select>
            </div>
            <button class="btn btn-ghost btn-block" id="p-fetch">Voir la météo (Open-Meteo)</button>
            <div id="p-forecast" style="margin-top:1rem"></div>
          ` : '<p class="muted">Ajoutez d\'abord un spot sur la carte.</p>'}
        </div>
      </div>

      <!-- Analyse de l'historique -->
      <div class="card">
        <h3>Vos meilleures conditions (d'après l'historique)</h3>
        ${spots.length ? `
          <div class="field-group" style="max-width:300px">
            <label>Analyser le spot</label>
            <select id="p-analyze-spot">${spotOptions}</select>
          </div>
          <div id="p-analysis"></div>
        ` : '<p class="muted">Pas encore de spots à analyser.</p>'}
      </div>
    `;

    // Reco manuelle
    document.getElementById('p-eval').onclick = () => {
      const meteo = document.getElementById('p-meteo').value;
      const mer = document.getElementById('p-mer').value;
      const coef = Number(document.getElementById('p-coef').value);
      document.getElementById('p-reco').innerHTML = renderReco(scoreConditions(meteo, mer, coef));
    };

    // Météo Open-Meteo
    const fetchBtn = document.getElementById('p-fetch');
    if (fetchBtn) fetchBtn.onclick = fetchForecast;

    // Analyse historique
    const analyzeSel = document.getElementById('p-analyze-spot');
    if (analyzeSel) {
      analyzeSel.onchange = () => renderAnalysis(analyzeSel.value);
      renderAnalysis(analyzeSel.value); // premier rendu
    }
  }

  // ---------- Recommandation basique ----------
  // Score 0–100 à partir de règles simples (heuristique, à affiner).
  function scoreConditions(meteo, mer, coef) {
    let score = 50;
    score += ({ 'ensoleillé': 15, 'nuageux': 10, 'pluie': -5, 'vent': -10 })[meteo] || 0;
    score += ({ 'calme': 20, 'peu agitée': 10, 'agitée': -10, 'forte': -25 })[mer] || 0;
    // Marées : coef moyen (50–80) souvent idéal ; très fort = courant, très faible = peu d'eau
    if (coef >= 50 && coef <= 85) score += 15;
    else if (coef > 95 || coef < 35) score -= 10;
    return Math.max(0, Math.min(100, score));
  }

  function renderReco(score) {
    let cls, label;
    if (score >= 65) { cls = 'reco-good'; label = '👍 Bonnes conditions, foncez !'; }
    else if (score >= 45) { cls = 'reco-mid'; label = '🤔 Conditions moyennes, ça peut le faire.'; }
    else { cls = 'reco-bad'; label = '👎 Conditions difficiles, peut-être attendre.'; }
    return `<div class="reco-box ${cls}">
      <div class="reco-score">${score}/100</div>
      <div>${label}</div>
    </div>`;
  }

  // ---------- Météo réelle Open-Meteo ----------
  async function fetchForecast() {
    const spotId = document.getElementById('p-spot').value;
    const spot = Store.getSpot(spotId);
    const box = document.getElementById('p-forecast');
    if (!spot) return;
    box.innerHTML = '<p class="muted">Chargement…</p>';

    try {
      // API Open-Meteo : prévisions journalières, pas de clé requise
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${spot.lat}&longitude=${spot.lng}`
        + `&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max`
        + `&timezone=auto&forecast_days=5`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Réseau');
      const data = await res.json();
      const d = data.daily;

      box.innerHTML = '<div class="forecast-row">' + d.time.map((t, i) => `
        <div class="forecast-day">
          <div>${new Date(t).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</div>
          <div style="font-size:1.5rem">${wmoEmoji(d.weather_code[i])}</div>
          <div class="fc-temp">${Math.round(d.temperature_2m_max[i])}°</div>
          <div class="muted">${Math.round(d.temperature_2m_min[i])}° · 💨${Math.round(d.wind_speed_10m_max[i])}</div>
        </div>`).join('') + '</div>'
        + '<p class="muted" style="margin-top:.5rem">Vent en km/h. Données : Open-Meteo.</p>';
    } catch (e) {
      box.innerHTML = '<p class="muted">⚠️ Impossible de récupérer la météo (connexion ?).</p>';
    }
  }

  // Codes météo WMO -> emoji (https://open-meteo.com/en/docs)
  function wmoEmoji(code) {
    if (code === 0) return '☀️';
    if (code <= 3) return '🌤️';
    if (code <= 48) return '🌫️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '❄️';
    if (code <= 82) return '🌦️';
    if (code <= 99) return '⛈️';
    return '🌤️';
  }

  // ---------- Analyse de l'historique ----------
  function renderAnalysis(spotId) {
    const box = document.getElementById('p-analysis');
    const sessions = Store.getSessionsForSpot(spotId);

    if (!sessions.length) {
      box.innerHTML = '<p class="muted">Aucune session sur ce spot pour l\'instant.</p>';
      return;
    }

    // Agrège : captures par mois et par condition météo
    const byMonth = {};   // mois -> total captures
    const byMeteo = {};   // météo -> total captures
    let bestSession = null;

    sessions.forEach(s => {
      const nb = (s.captures || []).length;
      const month = new Date(s.date).toLocaleDateString('fr-FR', { month: 'long' });
      byMonth[month] = (byMonth[month] || 0) + nb;
      const m = (s.conditions && s.conditions.meteo) || 'non précisé';
      byMeteo[m] = (byMeteo[m] || 0) + nb;
      if (!bestSession || nb > (bestSession.captures || []).length) bestSession = s;
    });

    const topMonth = topKey(byMonth);
    const topMeteo = topKey(byMeteo);
    const avg = (sessions.reduce((a, s) => a + (s.captures || []).length, 0) / sessions.length).toFixed(1);

    box.innerHTML = `
      <div class="stats-grid">
        <div class="stat-box"><div class="stat-value">${sessions.length}</div><div class="stat-label">sessions ici</div></div>
        <div class="stat-box"><div class="stat-value">${avg}</div><div class="stat-label">prises / session (moy.)</div></div>
        <div class="stat-box"><div class="stat-value" style="font-size:1.1rem">${topMonth || '—'}</div><div class="stat-label">meilleur mois</div></div>
        <div class="stat-box"><div class="stat-value" style="font-size:1.1rem">${topMeteo || '—'}</div><div class="stat-label">météo la + productive</div></div>
      </div>
      <p class="muted">💡 Astuce : sur ce spot, vous prenez le plus de poissons en <strong>${topMonth || '?'}</strong> par temps <strong>${topMeteo || '?'}</strong>.</p>
    `;
  }

  function topKey(obj) {
    let best = null, bestVal = -1;
    for (const k in obj) if (obj[k] > bestVal) { best = k; bestVal = obj[k]; }
    return bestVal > 0 ? best : null;
  }

  return { render };
})();

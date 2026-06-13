/* =================================================================
   tides.js — Marées & état de la mer (SHOM)
   Embed gratuit, sans clé : océanogramme SHOM (vent, vagues, niveau d'eau).
   Le widget SHOM fonctionne par CODE de spot (ex: PORTSALL), pas par lat/lng.
   => Table {code, lat, lng} + recherche du plus proche du spot (option C).
   Pour récupérer un code : data.shom.fr (océanogramme) -> clique un point
   en mer -> lis le CODE dans l'URL (.../oceanogramme/spot/CODE).
   ================================================================= */
const Tides = (() => {

  // ⚠️ À compléter pour ta zone. PORTSALL est un code réel (exemple SHOM).
  // Les lignes commentées sont des GABARITS : vérifie le code sur data.shom.fr
  // avant de les activer (un code faux = widget vide).
  const SHOM_SPOTS = [
    { code: 'PORTSALL', name: 'Portsall', lat: 48.566, lng: -4.708 },
    // { code: '????', name: 'Brest',               lat: 48.383, lng: -4.495 },
    // { code: '????', name: 'Concarneau',          lat: 47.873, lng: -3.916 },
    // { code: '????', name: "Les Sables-d'Olonne",  lat: 46.497, lng: -1.795 },
  ];

  const toRad = d => d * Math.PI / 180;
  function haversineKm(la1, lo1, la2, lo2) {
    const R = 6371, dLa = toRad(la2 - la1), dLo = toRad(lo2 - lo1);
    const a = Math.sin(dLa / 2) ** 2 +
      Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLo / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function nearestSpot(lat, lng) {
    if (lat == null || lng == null) return null;
    let best = null, bestD = Infinity;
    for (const s of SHOM_SPOTS) {
      const d = haversineKm(lat, lng, s.lat, s.lng);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best ? Object.assign({}, best, { distanceKm: Math.round(bestD) }) : null;
  }

  function widgetUrl(code, duration) {
    return 'https://services.data.shom.fr/oceano/render/widget'
      + '?duration=' + (duration || 4)
      + '&delta-date=0&spot=' + encodeURIComponent(code)
      + '&utc=1&lang=fr';
  }

  // Le script SHOM utilise document.write : on l'isole dans une iframe srcdoc
  // pour pouvoir l'injecter après le chargement sans casser la page.
  function renderWidget(container, code) {
    const src = widgetUrl(code, 4);
    const doc = '<!doctype html><html><head><meta charset="utf-8">'
      + '<style>body{margin:0;font-family:system-ui,sans-serif}</style></head>'
      + '<body><script src="' + src + '"><\/script></body></html>';
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '520px';
    iframe.style.border = '0';
    iframe.loading = 'lazy';
    iframe.srcdoc = doc;
    container.innerHTML = '';
    container.appendChild(iframe);
  }

  return { nearestSpot, widgetUrl, renderWidget, SHOM_SPOTS };
})();

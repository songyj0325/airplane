/* =========================================================
   PomoFlight 3D — Satellite Flight Focus Timer
   ========================================================= */

(() => {
  'use strict';

  /* ---------------------------------------------------------
     Data
  --------------------------------------------------------- */
  const ICN = [37.4602, 126.4407];
  const PUS = [35.1795, 128.9382];

  function haversineKm(o, d) {
    const R = 6371;
    const dLat = ((d[0] - o[0]) * Math.PI) / 180;
    const dLng = ((d[1] - o[1]) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((o[0] * Math.PI) / 180) * Math.cos((d[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const RAW_ROUTES = [
    // Asia
    { origin: 'ICN', dest: 'HND', originCity: 'Seoul', destCity: 'Tokyo',        o: ICN, d: [35.5494, 139.7798] },
    { origin: 'PUS', dest: 'OKA', originCity: 'Busan', destCity: 'Okinawa',      o: PUS, d: [26.1958, 127.6458] },
    { origin: 'ICN', dest: 'CJU', originCity: 'Seoul', destCity: 'Jeju',         o: ICN, d: [33.5113, 126.4930] },
    { origin: 'ICN', dest: 'YNY', originCity: 'Seoul', destCity: 'Yangyang',     o: ICN, d: [38.0611, 128.6692] },
    { origin: 'ICN', dest: 'KIX', originCity: 'Seoul', destCity: 'Osaka',        o: ICN, d: [34.4347, 135.2441] },
    { origin: 'ICN', dest: 'NGO', originCity: 'Seoul', destCity: 'Nagoya',       o: ICN, d: [34.8584, 136.8054] },
    { origin: 'ICN', dest: 'TPE', originCity: 'Seoul', destCity: 'Taipei',       o: ICN, d: [25.0797, 121.2342] },
    { origin: 'ICN', dest: 'HKG', originCity: 'Seoul', destCity: 'Hong Kong',    o: ICN, d: [22.3080, 113.9185] },
    { origin: 'ICN', dest: 'PEK', originCity: 'Seoul', destCity: 'Beijing',      o: ICN, d: [40.0799, 116.6031] },
    { origin: 'ICN', dest: 'PVG', originCity: 'Seoul', destCity: 'Shanghai',     o: ICN, d: [31.1443, 121.8083] },
    { origin: 'ICN', dest: 'MNL', originCity: 'Seoul', destCity: 'Manila',       o: ICN, d: [14.5086, 121.0194] },
    { origin: 'ICN', dest: 'BKK', originCity: 'Seoul', destCity: 'Bangkok',      o: ICN, d: [13.6900, 100.7501] },
    { origin: 'ICN', dest: 'SIN', originCity: 'Seoul', destCity: 'Singapore',    o: ICN, d: [1.3644, 103.9915] },
    { origin: 'ICN', dest: 'KUL', originCity: 'Seoul', destCity: 'Kuala Lumpur', o: ICN, d: [2.7456, 101.7099] },
    { origin: 'ICN', dest: 'CGK', originCity: 'Seoul', destCity: 'Jakarta',      o: ICN, d: [-6.1256, 106.6559] },
    { origin: 'ICN', dest: 'DEL', originCity: 'Seoul', destCity: 'Delhi',        o: ICN, d: [28.5562, 77.1000] },
    { origin: 'ICN', dest: 'BOM', originCity: 'Seoul', destCity: 'Mumbai',       o: ICN, d: [19.0887, 72.8679] },
    // Middle East
    { origin: 'ICN', dest: 'DXB', originCity: 'Seoul', destCity: 'Dubai',       o: ICN, d: [25.2532, 55.3657] },
    { origin: 'ICN', dest: 'DOH', originCity: 'Seoul', destCity: 'Doha',        o: ICN, d: [25.2731, 51.6080] },
    { origin: 'ICN', dest: 'IST', originCity: 'Seoul', destCity: 'Istanbul',    o: ICN, d: [41.2753, 28.7519] },
    // Europe
    { origin: 'ICN', dest: 'CDG', originCity: 'Seoul', destCity: 'Paris',      o: ICN, d: [49.0097, 2.5479] },
    { origin: 'ICN', dest: 'LHR', originCity: 'Seoul', destCity: 'London',     o: ICN, d: [51.4700, -0.4543] },
    { origin: 'ICN', dest: 'FRA', originCity: 'Seoul', destCity: 'Frankfurt',  o: ICN, d: [50.0379, 8.5622] },
    { origin: 'ICN', dest: 'AMS', originCity: 'Seoul', destCity: 'Amsterdam',  o: ICN, d: [52.3105, 4.7683] },
    { origin: 'ICN', dest: 'FCO', originCity: 'Seoul', destCity: 'Rome',       o: ICN, d: [41.8003, 12.2389] },
    { origin: 'ICN', dest: 'MAD', originCity: 'Seoul', destCity: 'Madrid',     o: ICN, d: [40.4983, -3.5676] },
    // Americas
    { origin: 'ICN', dest: 'JFK', originCity: 'Seoul', destCity: 'New York',     o: ICN, d: [40.6413, -73.7781] },
    { origin: 'ICN', dest: 'LAX', originCity: 'Seoul', destCity: 'Los Angeles',  o: ICN, d: [33.9416, -118.4085] },
    { origin: 'ICN', dest: 'ORD', originCity: 'Seoul', destCity: 'Chicago',      o: ICN, d: [41.9742, -87.9073] },
    { origin: 'ICN', dest: 'YVR', originCity: 'Seoul', destCity: 'Vancouver',    o: ICN, d: [49.1967, -123.1815] },
    { origin: 'ICN', dest: 'GRU', originCity: 'Seoul', destCity: 'Sao Paulo',    o: ICN, d: [-23.4356, -46.4731] },
    // Oceania
    { origin: 'ICN', dest: 'SYD', originCity: 'Seoul', destCity: 'Sydney',   o: ICN, d: [-33.9399, 151.1753] },
    { origin: 'ICN', dest: 'AKL', originCity: 'Seoul', destCity: 'Auckland', o: ICN, d: [-36.9986, 174.7920] },
    // Africa
    { origin: 'ICN', dest: 'JNB', originCity: 'Seoul', destCity: 'Johannesburg', o: ICN, d: [-26.1392, 28.2460] },
    { origin: 'ICN', dest: 'CAI', originCity: 'Seoul', destCity: 'Cairo',        o: ICN, d: [30.1219, 31.4056] },
  ];

  // km/minutes are derived from the coordinates themselves (great-circle
  // distance at a realistic cruise speed + takeoff/landing overhead) so the
  // whole dataset stays internally consistent as routes are added.
  const ROUTES = RAW_ROUTES.map((r) => {
    const km = Math.round(haversineKm(r.o, r.d));
    const minutes = Math.round((km / 850) * 60 + 25);
    return { ...r, km, minutes };
  });

  const STORAGE_STATS = 'pomoflight.stats.v1';
  const STORAGE_HISTORY = 'pomoflight.history.v1';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------------------------------------------------------
     Geo helpers
  --------------------------------------------------------- */
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;

  function buildFlightPath(o, d, segments = 100) {
    const lat1 = o[0], lng1 = o[1], lat2 = d[0];
    let dLng = d[1] - lng1;
    if (dLng > 180) dLng -= 360;
    if (dLng < -180) dLng += 360;
    const lng2u = lng1 + dLng;
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      pts.push([lat1 + (lat2 - lat1) * t, lng1 + (lng2u - lng1) * t]);
    }
    return pts;
  }

  function bearingBetween(p1, p2) {
    const φ1 = toRad(p1[0]), φ2 = toRad(p2[0]);
    const Δλ = toRad(p2[1] - p1[1]);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  function pointAtProgress(points, t) {
    const n = points.length - 1;
    const f = Math.min(1, Math.max(0, t)) * n;
    const i = Math.floor(f);
    const frac = f - i;
    const p0 = points[Math.min(i, n)];
    const p1 = points[Math.min(i + 1, n)];
    return [p0[0] + (p1[0] - p0[0]) * frac, p0[1] + (p1[1] - p0[1]) * frac];
  }

  function computeFlightZoom(km) {
    if (km < 1000) return 9;
    if (km < 4000) return 8;
    return 7;
  }

  /* ---------------------------------------------------------
     Flight atmosphere — a light day/night tint keyed to the plane's
     current longitude (approximate local solar time), plus a handful
     of slow-drifting cloud wisps. Kept deliberately subtle.
  --------------------------------------------------------- */
  function estimateLocalHour(lng) {
    const utcHour = new Date().getUTCHours() + new Date().getUTCMinutes() / 60;
    return ((utcHour + lng / 15) % 24 + 24) % 24;
  }

  function updateAtmosphereForPosition(pos) {
    const el = $('#flight-atmosphere');
    if (!el || !pos) return;
    const hour = estimateLocalHour(pos[1]);
    const isNight = hour < 6 || hour >= 19;
    el.classList.toggle('atmosphere-night', isNight);
    el.classList.toggle('atmosphere-day', !isNight);
  }

  function spawnCloudWisps() {
    const layer = $('#cloud-layer');
    if (!layer) return;
    layer.innerHTML = '';
    const count = 4;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'cloud-wisp';
      const size = 90 + Math.random() * 150;
      el.style.width = `${size}px`;
      el.style.height = `${size * 0.34}px`;
      el.style.top = `${8 + Math.random() * 55}%`;
      el.style.animationDuration = `${55 + Math.random() * 35}s`;
      el.style.animationDelay = `-${Math.random() * 60}s`;
      layer.appendChild(el);
    }
  }

  function activateFlightAtmosphere(route) {
    spawnCloudWisps();
    updateAtmosphereForPosition(route.o);
    $('#flight-atmosphere').classList.add('atmosphere-active');
    $('#cloud-layer').classList.add('cloud-layer-active');
  }

  function deactivateFlightAtmosphere() {
    $('#flight-atmosphere').classList.remove('atmosphere-active', 'atmosphere-night', 'atmosphere-day');
    $('#cloud-layer').classList.remove('cloud-layer-active');
  }

  /* ---------------------------------------------------------
     State
  --------------------------------------------------------- */
  const state = {
    selectedRoute: ROUTES[1],
    selectedSeat: null,
    selectedPurpose: 'work',
    focusMinutes: 30, // user-set session length, independent of the route's real-world duration
    occupiedSeats: new Set(),
    currentArc: null,
    stats: loadStats(),
    history: loadHistory(),
    timer: {
      running: false, paused: false, totalSeconds: 0, remainingSeconds: 0, intervalId: null,
      startedAt: null,      // performance.now() when the flight began
      pausedAccum: 0,       // total ms already spent paused
      pauseStartedAt: null, // performance.now() when the current pause began
    },
    audio: { ctx: null, volume: 0.35, activeKind: null },
    hud: { unit: 'km' },
  };

  const FOCUS_TAGS = [
    { id: 'read', label: 'Read', emoji: '📖' },
    { id: 'exercise', label: 'Exercise', emoji: '🏋️' },
    { id: 'work', label: 'Work', emoji: '💼' },
    { id: 'study', label: 'Study', emoji: '📚' },
    { id: 'hobby', label: 'Hobby', emoji: '🎨' },
  ];
  let ticketMeta = { flightNo: randomFlightNo() };

  function loadStats() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_STATS));
      if (raw && typeof raw === 'object') {
        return { totalSeconds: raw.totalSeconds || 0, totalKm: raw.totalKm || 0, flights: raw.flights || 0 };
      }
    } catch (e) { /* ignore */ }
    return { totalSeconds: 0, totalKm: 0, flights: 0 };
  }
  function loadHistory() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_HISTORY));
      if (Array.isArray(raw)) return raw;
    } catch (e) { /* ignore */ }
    return [];
  }
  function persistStats() { localStorage.setItem(STORAGE_STATS, JSON.stringify(state.stats)); }
  function persistHistory() { localStorage.setItem(STORAGE_HISTORY, JSON.stringify(state.history.slice(0, 50))); }

  function refreshIcons() { if (window.lucide) window.lucide.createIcons(); }

  /* ---------------------------------------------------------
     Formatting helpers
  --------------------------------------------------------- */
  function fmtMinutes(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  function fmtTimer(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  function fmtHoursTotal(totalSeconds) {
    const totalMin = Math.floor(totalSeconds / 60);
    return `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`;
  }
  function fmtKm(km) { return Math.round(km).toLocaleString('en-US'); }
  function fmtSpeedMultiplier(routeMinutes, focusMinutes) {
    const mult = routeMinutes / focusMinutes;
    return mult >= 10 ? `${Math.round(mult)}x` : `${mult.toFixed(1)}x`;
  }
  function todayLabel() {
    const d = new Date();
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }
  function randomFlightNo() { return `PF-${Math.floor(1000 + Math.random() * 9000)}`; }

  /* ---------------------------------------------------------
     Header stats
  --------------------------------------------------------- */
  function renderStats() {
    $('#stat-total-time').textContent = fmtHoursTotal(state.stats.totalSeconds);
    $('#stat-mileage').textContent = `${fmtKm(state.stats.totalKm)} km`;
    $('#stat-flights').textContent = state.stats.flights;
  }

  /* ---------------------------------------------------------
     Map
  --------------------------------------------------------- */
  let map, satelliteLayer, darkLayer, currentMapStyle = 'satellite';
  let routeLayerGroup, progressPolyline, remainderPolyline, originMarker, destMarker;

  function geoIcon(kind) {
    return L.divIcon({
      className: '',
      html: `<div class="geo-marker geo-marker-${kind}"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
  }

  // IATA-code badge marker for recommended nearby/world airports
  function airportBadgeIcon(code) {
    return L.divIcon({
      className: '',
      html: `<div class="geo-pin-badge">${code}</div>`,
      iconSize: [44, 20],
      iconAnchor: [22, 10],
    });
  }

  // Real airplane silhouette (Google Material "flight" glyph, nose pointing up = bearing 0)
  const PLANE_SVG_PATH = 'M21,16V14L13,9V3.5C13,2.67 12.33,2 11.5,2C10.67,2 10,2.67 10,3.5V9L2,14V16L10,13.5V19L7.5,20.5V22L11.5,21L15.5,22V20.5L13,19V13.5L21,16Z';

  function planeDivIcon() {
    return L.divIcon({
      className: 'plane-marker',
      html: `<div class="plane-marker-rotor"><svg viewBox="0 0 24 24" class="plane-marker-svg"><path d="${PLANE_SVG_PATH}"/></svg></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
  }

  let planeMarker = null;

  function createPlaneMarker(latlng, bearingDeg) {
    if (!map) return;
    removePlaneMarker();
    planeMarker = L.marker(latlng, { icon: planeDivIcon(), zIndexOffset: 1000, interactive: false }).addTo(map);
    setPlaneBearing(bearingDeg);
  }

  function setPlaneBearing(bearingDeg) {
    if (!planeMarker) return;
    const el = planeMarker.getElement();
    const rotor = el && el.querySelector('.plane-marker-rotor');
    if (rotor) rotor.style.transform = `rotate(${bearingDeg}deg)`;
  }

  function removePlaneMarker() {
    if (planeMarker && map) map.removeLayer(planeMarker);
    planeMarker = null;
  }

  function initMap() {
    if (typeof L === 'undefined') {
      console.error('Leaflet failed to load — map features are disabled.');
      const banner = document.createElement('div');
      banner.className = 'load-error-banner';
      banner.textContent = '지도 라이브러리를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요. (지도 기능 없이 계속됩니다)';
      document.body.appendChild(banner);
      return;
    }
    map = L.map('map', {
      center: [20, 122],
      zoom: 3,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: false,
    });

    satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
      maxZoom: 18,
    });
    darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 18,
    });
    satelliteLayer.addTo(map);

    routeLayerGroup = L.layerGroup().addTo(map);

    // Force a size recalculation once the container has its final layout —
    // without this the map can initialize against a stale/zero size and
    // render only partially until the user manually resizes the window.
    map.whenReady(() => {
      requestAnimationFrame(() => map.invalidateSize());
      setTimeout(() => map.invalidateSize(), 300);
    });

    window.addEventListener('resize', () => map.invalidateSize());
  }

  // Reachability radar circle — a persistent layer (not part of the
  // clear/rebuild cycle) so it can be repositioned/resized instantly on
  // every ruler-scroll tick without redrawing the rest of the map.
  let radarCircle = null;

  function ensureRadarCircle() {
    if (!map) return null;
    if (!radarCircle) {
      radarCircle = L.circle(state.selectedRoute.o, {
        radius: 0,
        color: '#10B981', weight: 1.5, opacity: 0.55,
        dashArray: '5,8', fill: true, fillColor: '#10B981', fillOpacity: 0.035,
        interactive: false,
      }).addTo(map);
    }
    return radarCircle;
  }

  function updateRadarCircle(minutesOverride) {
    const circle = ensureRadarCircle();
    if (!circle) return;
    const minutes = minutesOverride != null ? minutesOverride : state.focusMinutes;
    const radiusKm = (minutes / 60) * 850;
    circle.setLatLng(state.selectedRoute.o);
    circle.setRadius(radiusKm * 1000);
    circle.bringToBack();
  }

  function drawRoutePreview(route) {
    if (!map) return;
    routeLayerGroup.clearLayers();
    updateRadarCircle();

    // Recommended nearby/world airports as clickable IATA badges; the
    // active route's own destination is drawn separately as the bright
    // highlighted marker below.
    const seenDest = new Set();
    ROUTES.forEach((r) => {
      if (seenDest.has(r.dest) || (r.dest === route.dest && r.origin === route.origin)) return;
      seenDest.add(r.dest);
      const marker = L.marker(r.d, { icon: airportBadgeIcon(r.dest), interactive: true }).addTo(routeLayerGroup);
      marker.on('click', () => selectRoute(r));
    });

    const path = buildFlightPath(route.o, route.d);
    state.currentArc = path;

    remainderPolyline = L.polyline(path, { color: '#059669', weight: 2.5, opacity: 0.6, dashArray: '2,10', lineCap: 'round' }).addTo(routeLayerGroup);
    progressPolyline = L.polyline([], { color: '#10B981', weight: 3.5, opacity: 0.95, className: 'route-arc-glow', lineCap: 'round' }).addTo(routeLayerGroup);
    originMarker = L.marker(route.o, { icon: geoIcon('origin') }).addTo(routeLayerGroup);
    destMarker = L.marker(route.d, { icon: geoIcon('dest') }).addTo(routeLayerGroup);

    map.flyToBounds(L.latLngBounds(path), { paddingTopLeft: [40, 110], paddingBottomRight: [40, 220], duration: 1.3 });
  }

  function initMapStyleToggle() {
    const btn = $('#map-style-toggle');
    btn.addEventListener('click', () => {
      if (!map) return;
      if (currentMapStyle === 'satellite') {
        map.removeLayer(satelliteLayer);
        darkLayer.addTo(map);
        currentMapStyle = 'dark';
        btn.dataset.active = 'true';
        btn.innerHTML = '<i data-lucide="moon" class="w-4 h-4"></i>';
      } else {
        map.removeLayer(darkLayer);
        satelliteLayer.addTo(map);
        currentMapStyle = 'satellite';
        btn.dataset.active = 'false';
        btn.innerHTML = '<i data-lucide="satellite" class="w-4 h-4"></i>';
      }
      refreshIcons();
    });
  }

  /* ---------------------------------------------------------
     Route carousel & selection
  --------------------------------------------------------- */
  function isSameRoute(a, b) {
    if (!a || !b) return false;
    return a.origin === b.origin && a.dest === b.dest && a.minutes === b.minutes && a.km === b.km;
  }

  function generateOccupiedSeats() {
    const cols = SEAT_COLS;
    const rows = SEAT_ROWS;
    const occ = new Set();
    const occCount = Math.floor(rows * cols.length * 0.22);
    while (occ.size < occCount) {
      const row = 1 + Math.floor(Math.random() * rows);
      const col = cols[Math.floor(Math.random() * cols.length)];
      occ.add(`${String(row).padStart(2, '0')}${col}`);
    }
    return occ;
  }

  function selectRoute(route) {
    state.selectedRoute = route;
    state.selectedSeat = null;
    state.occupiedSeats = generateOccupiedSeats();
    ticketMeta = { flightNo: randomFlightNo() };
    renderRouteCarousel();
    updateExploreSummary();
    drawRoutePreview(route);
  }

  function renderRouteCarousel() {
    const carousel = $('#route-carousel');
    const tpl = $('#route-chip-template');
    carousel.innerHTML = '';
    ROUTES.forEach((route) => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.querySelector('.rc-origin').textContent = route.origin;
      node.querySelector('.rc-dest').textContent = route.dest;
      node.querySelector('.route-chip-cities').textContent = `${route.originCity} → ${route.destCity}`;
      node.querySelector('.rc-duration').textContent = fmtMinutes(route.minutes);
      node.querySelector('.rc-speed').textContent = fmtSpeedMultiplier(route.minutes, state.focusMinutes);
      if (isSameRoute(route, state.selectedRoute)) node.classList.add('selected');
      node.addEventListener('click', () => selectRoute(route));
      carousel.appendChild(node);
    });
    refreshIcons();
  }

  function updateExploreSummary() {
    const route = state.selectedRoute;
    $('#ecs-codes').innerHTML = `${route.origin} <i data-lucide="plane" class="w-3.5 h-3.5 inline text-cyan"></i> ${route.dest}`;
    $('#ecs-meta').textContent = `${fmtMinutes(state.focusMinutes)} session · ${fmtKm(route.km)} km · ${fmtSpeedMultiplier(route.minutes, state.focusMinutes)} speed`;
    refreshIcons();
  }

  /* ---------------------------------------------------------
     Focus duration ruler (horizontal scroll picker, 30m – 14h)
     Independent of the selected route: the route only supplies the
     visual path/flavor, while this ruler is the actual session timer.
  --------------------------------------------------------- */
  function buildRulerTickValues() {
    const values = [];
    for (let m = 10; m <= 840; m += 10) values.push(m); // 10m .. 14h, uniform 10-minute steps
    return values;
  }
  const RULER_VALUES = buildRulerTickValues();

  function renderDurationRuler() {
    const track = $('#duration-ruler-track');
    track.innerHTML = '';
    RULER_VALUES.forEach((m) => {
      const tick = document.createElement('div');
      tick.className = 'ruler-tick';
      tick.dataset.minutes = String(m);
      const mark = document.createElement('span');
      mark.className = 'ruler-tick-mark';
      const label = document.createElement('span');
      label.className = 'ruler-tick-label';
      label.textContent = fmtMinutes(m);
      tick.appendChild(mark);
      tick.appendChild(label);
      tick.addEventListener('click', () => {
        tick.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      });
      track.appendChild(tick);
    });
  }

  function getNearestRulerTick() {
    const ruler = $('#duration-ruler');
    const rect = ruler.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    let closest = null;
    let closestDist = Infinity;
    $$('.ruler-tick').forEach((tick) => {
      const tRect = tick.getBoundingClientRect();
      const dist = Math.abs((tRect.left + tRect.width / 2) - centerX);
      if (dist < closestDist) { closestDist = dist; closest = tick; }
    });
    return closest;
  }

  function highlightRulerTick(tickEl) {
    if (!tickEl) return;
    $$('.ruler-tick').forEach((t) => t.classList.toggle('active', t === tickEl));
    $('#ruler-readout').textContent = fmtMinutes(parseInt(tickEl.dataset.minutes, 10));
  }

  function commitFocusMinutes(tickEl) {
    if (!tickEl) return;
    const minutes = parseInt(tickEl.dataset.minutes, 10);
    if (minutes === state.focusMinutes) return;
    state.focusMinutes = minutes;
    renderRouteCarousel();
    updateExploreSummary();
    updateRadarCircle();
  }

  function initDurationRuler() {
    renderDurationRuler();
    const ruler = $('#duration-ruler');
    let commitTimer = null;
    ruler.addEventListener('scroll', () => {
      const nearest = getNearestRulerTick();
      highlightRulerTick(nearest);
      if (nearest) updateRadarCircle(parseInt(nearest.dataset.minutes, 10)); // live radar feedback
      clearTimeout(commitTimer);
      commitTimer = setTimeout(() => commitFocusMinutes(nearest), 180);
    }, { passive: true });

    const defaultTick = $(`.ruler-tick[data-minutes="${state.focusMinutes}"]`) || $('.ruler-tick');
    highlightRulerTick(defaultTick);
    defaultTick.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
  }

  /* ---------------------------------------------------------
     Seat selection modal
  --------------------------------------------------------- */
  const SEAT_COLS = ['A', 'C', 'D', 'F']; // single-aisle 2+2 layout: A,C | D,F
  const SEAT_ROWS = 15;

  function tierForRow(row) {
    if (row <= 2) return 'first';
    if (row <= 6) return 'business';
    return 'economy';
  }

  function buildSeatBtn(row, col) {
    const code = `${String(row).padStart(2, '0')}${col}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'seat-btn';
    btn.textContent = col;
    btn.dataset.seat = code;
    if (state.occupiedSeats.has(code)) btn.disabled = true;
    if (state.selectedSeat === code) btn.classList.add('selected');
    btn.addEventListener('click', () => selectSeat(code));
    return btn;
  }

  function renderSeatGrid() {
    const grid = $('#seat-grid');
    grid.innerHTML = '';
    for (let row = 1; row <= SEAT_ROWS; row++) {
      const rowEl = document.createElement('div');
      rowEl.className = `seat-row tier-${tierForRow(row)}`;

      const rowNum = document.createElement('span');
      rowNum.className = 'seat-row-num';
      rowNum.textContent = String(row).padStart(2, '0');

      const leftGroup = document.createElement('div');
      leftGroup.className = 'seat-group';
      ['A', 'C'].forEach((col) => leftGroup.appendChild(buildSeatBtn(row, col)));

      const aisle = document.createElement('div');
      aisle.className = 'seat-aisle-gap';

      const rightGroup = document.createElement('div');
      rightGroup.className = 'seat-group';
      ['D', 'F'].forEach((col) => rightGroup.appendChild(buildSeatBtn(row, col)));

      rowEl.appendChild(rowNum);
      rowEl.appendChild(leftGroup);
      rowEl.appendChild(aisle);
      rowEl.appendChild(rightGroup);
      grid.appendChild(rowEl);
    }
  }

  function selectSeat(code) {
    state.selectedSeat = code;
    $$('.seat-btn').forEach((b) => b.classList.toggle('selected', b.dataset.seat === code));
    $('#seat-selected-display').textContent = code;
    $('#seat-confirm-btn').disabled = false;
  }

  function openSeatModal() {
    renderSeatGrid();
    $('#seat-selected-display').textContent = state.selectedSeat || '—';
    $('#seat-confirm-btn').disabled = !state.selectedSeat;
    openModal($('#seat-modal'));
  }

  function initSeatModal() {
    $('#select-seat-btn').addEventListener('click', openSeatModal);
    $('#seat-modal-close').addEventListener('click', () => closeModal($('#seat-modal')));
    $('#seat-modal').addEventListener('click', (e) => { if (e.target === $('#seat-modal')) closeModal($('#seat-modal')); });
    $('#seat-confirm-btn').addEventListener('click', () => {
      closeModal($('#seat-modal'));
      openFocusModal();
    });
  }

  /* ---------------------------------------------------------
     Focus purpose modal
  --------------------------------------------------------- */
  function renderFocusTags() {
    const grid = $('#focus-tag-grid');
    grid.innerHTML = '';
    FOCUS_TAGS.forEach((tag) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'focus-tag-btn';
      btn.dataset.id = tag.id;
      if (state.selectedPurpose === tag.id) btn.classList.add('selected');
      btn.innerHTML = `<span class="focus-tag-emoji">${tag.emoji}</span><span>${tag.label}</span>`;
      btn.addEventListener('click', () => {
        state.selectedPurpose = tag.id;
        $$('.focus-tag-btn').forEach((b) => b.classList.toggle('selected', b.dataset.id === tag.id));
      });
      grid.appendChild(btn);
    });
    refreshIcons();
  }

  function openFocusModal() {
    renderFocusTags();
    openModal($('#focus-modal'));
  }

  function initFocusModal() {
    $('#focus-modal-close').addEventListener('click', () => closeModal($('#focus-modal')));
    $('#focus-modal').addEventListener('click', (e) => { if (e.target === $('#focus-modal')) closeModal($('#focus-modal')); });
    $('#focus-confirm-btn').addEventListener('click', () => {
      closeModal($('#focus-modal'));
      showBoardingPhase();
    });
  }

  /* ---------------------------------------------------------
     Boarding pass
  --------------------------------------------------------- */
  function buildBoardingPassNode(route, seat) {
    const tpl = $('#boarding-pass-template');
    const node = tpl.content.firstElementChild.cloneNode(true);
    const purposeTag = FOCUS_TAGS.find((t) => t.id === state.selectedPurpose) || FOCUS_TAGS[0];
    node.querySelector('.bp-origin-code').textContent = route.origin;
    node.querySelector('.bp-dest-code').textContent = route.dest;
    node.querySelector('.bp-origin-city').textContent = route.originCity;
    node.querySelector('.bp-dest-city').textContent = route.destCity;
    node.querySelector('.bp-flight-duration').textContent = fmtMinutes(route.minutes);
    node.querySelector('.bp-flight-distance').textContent = `${fmtKm(route.km)} km`;
    node.querySelector('.bp-passenger').textContent = purposeTag.label.toUpperCase();
    node.querySelector('.bp-flight-no').textContent = ticketMeta.flightNo;
    node.querySelector('.bp-seat').textContent = seat;
    node.querySelector('.bp-date').textContent = todayLabel();
    node.querySelector('.bp-stub-origin').textContent = route.origin;
    node.querySelector('.bp-stub-dest').textContent = route.dest;
    return node;
  }

  function showBoardingPhase() {
    const wrap = $('#boarding-ticket-wrap');
    wrap.innerHTML = '';
    wrap.appendChild(buildBoardingPassNode(state.selectedRoute, state.selectedSeat));
    refreshIcons();
    $('#start-boarding-btn').disabled = false;
    $('#explore-panel').classList.add('hidden');
    $('#boarding-panel').classList.remove('hidden');
  }

  const TICKET_TEAR_DURATION = 600;

  function beginBoardingDeparture() {
    const checkinBtn = $('#start-boarding-btn');
    const ticket = $('.boarding-pass');
    if (checkinBtn.disabled) return;
    checkinBtn.disabled = true;
    if (ticket) ticket.classList.add('tearing');

    setTimeout(() => {
      const panel = $('#boarding-panel');
      panel.classList.add('leaving');
      setTimeout(() => {
        panel.classList.add('hidden');
        panel.classList.remove('leaving');
        runwayZoomSequence();
      }, 300);
    }, TICKET_TEAR_DURATION);
  }

  /* ---------------------------------------------------------
     Check-in cinematic: swoop into the departure runway,
     then climb out to cruising altitude before tracking begins
  --------------------------------------------------------- */
  const RUNWAY_ZOOM = 16;
  const RUNWAY_ZOOM_DURATION = 1.8;
  const CLIMB_DURATION = 1.2;

  function runwayZoomSequence() {
    const route = state.selectedRoute;
    if (!map) { enterFlightPhase(); return; }

    map.dragging.disable();
    map.scrollWheelZoom.disable();
    map.doubleClickZoom.disable();
    map.touchZoom.disable();
    if (map.tap) map.tap.disable();

    map.flyTo(route.o, RUNWAY_ZOOM, { duration: RUNWAY_ZOOM_DURATION });
    setTimeout(() => {
      const cruiseZoom = computeFlightZoom(route.km);
      map.flyTo(route.o, cruiseZoom, { duration: CLIMB_DURATION });
      setTimeout(enterFlightPhase, CLIMB_DURATION * 1000);
    }, RUNWAY_ZOOM_DURATION * 1000);
  }

  /* ---------------------------------------------------------
     Flight phase (in-flight satellite tracking)
  --------------------------------------------------------- */
  function getElapsedMs() {
    if (state.timer.startedAt == null) return 0;
    const now = performance.now();
    const pausedNow = state.timer.paused && state.timer.pauseStartedAt != null ? now - state.timer.pauseStartedAt : 0;
    return now - state.timer.startedAt - state.timer.pausedAccum - pausedNow;
  }

  function getProgress() {
    const totalMs = state.timer.totalSeconds * 1000;
    if (totalMs <= 0) return 0;
    return Math.min(1, Math.max(0, getElapsedMs() / totalMs));
  }

  let flightAnimFrameId = null;

  function startAnimationLoop() {
    cancelAnimationFrame(flightAnimFrameId);
    const frame = () => {
      if (!state.timer.running || state.timer.paused) return;
      updatePlanePosition(getProgress());
      flightAnimFrameId = requestAnimationFrame(frame);
    };
    flightAnimFrameId = requestAnimationFrame(frame);
  }

  function stopAnimationLoop() {
    cancelAnimationFrame(flightAnimFrameId);
    flightAnimFrameId = null;
  }

  function updatePlanePosition(progress) {
    const arc = state.currentArc;
    if (!arc || !map || !planeMarker) return;
    const pos = pointAtProgress(arc, progress);
    const aheadPos = pointAtProgress(arc, Math.min(1, progress + 0.004));
    const bearing = bearingBetween(pos, aheadPos);
    planeMarker.setLatLng(pos);
    setPlaneBearing(bearing);
    map.setView(pos, map.getZoom(), { animate: false });

    const idx = Math.floor(progress * (arc.length - 1));
    progressPolyline.setLatLngs(arc.slice(0, idx + 1).concat([pos]));
  }

  function enterFlightPhase() {
    const route = state.selectedRoute;
    $('#flight-hud').classList.remove('hidden');
    $('#topbar-brand').classList.add('topbar-fade-hidden');
    $('#topbar-stats').classList.add('topbar-fade-hidden');
    $('#hud-origin-code').textContent = route.origin;
    $('#hud-dest-code').textContent = route.dest;
    $('#hud-speed-multiplier').querySelector('span').textContent = `${fmtSpeedMultiplier(route.minutes, state.focusMinutes)} speed`;

    // The countdown always runs for the user-set focus duration, never the
    // route's own real-world flight time -- long-haul routes are simply
    // traversed faster so they still land exactly when the timer hits zero.
    const totalSeconds = state.focusMinutes * 60;
    state.timer.totalSeconds = totalSeconds;
    state.timer.remainingSeconds = totalSeconds;
    state.timer.running = true;
    state.timer.paused = false;
    state.timer.startedAt = performance.now();
    state.timer.pausedAccum = 0;
    state.timer.pauseStartedAt = null;

    const startPos = state.currentArc[0];
    const initialBearing = bearingBetween(startPos, pointAtProgress(state.currentArc, 0.01));
    createPlaneMarker(startPos, initialBearing);

    activateFlightAtmosphere(route);
    playTakeoffChime();

    updateHudText();
    clearInterval(state.timer.intervalId);
    state.timer.intervalId = setInterval(tickTimer, 1000);
    startAnimationLoop();
  }

  function tickTimer() {
    if (state.timer.paused) return;
    state.timer.remainingSeconds = Math.max(0, state.timer.totalSeconds - getElapsedMs() / 1000);
    updateHudText();
    if (state.timer.remainingSeconds <= 0) {
      completeFlight();
    }
  }

  const KM_TO_MI = 0.621371;

  function updateHudText() {
    const route = state.selectedRoute;
    const total = state.timer.totalSeconds || 1;
    const elapsed = total - state.timer.remainingSeconds;
    const progress = Math.min(1, Math.max(0, elapsed / total));
    const unit = state.hud.unit;
    const toDisplayDistance = (km) => (unit === 'mi' ? km * KM_TO_MI : km);

    $('#hud-timer').textContent = fmtTimer(state.timer.remainingSeconds);
    $('#hud-timer').classList.toggle('is-paused', state.timer.paused);
    $('#hud-progress-fill').style.width = `${progress * 100}%`;
    $('#hud-progress-pct').textContent = Math.round(progress * 100);

    const remainingKm = Math.max(0, route.km * (1 - progress));
    $('#hud-distance').textContent = fmtKm(toDisplayDistance(remainingKm));
    $('#hud-unit-label').textContent = unit;

    const baseSpeedKmh = route.km / (route.minutes / 60);
    const jitter = 1 + Math.sin(elapsed / 23) * 0.035;
    const speedKmh = progress >= 1 ? 0 : baseSpeedKmh * jitter;
    $('#hud-speed').textContent = fmtKm(toDisplayDistance(speedKmh));
    $('#hud-speed-unit').textContent = unit === 'mi' ? 'mph' : 'km/h';

    if (state.currentArc) {
      updateAtmosphereForPosition(pointAtProgress(state.currentArc, progress));
    }
  }

  function togglePause() {
    if (!state.timer.running) return;
    state.timer.paused = !state.timer.paused;
    if (state.timer.paused) {
      state.timer.pauseStartedAt = performance.now();
      stopAnimationLoop();
    } else {
      state.timer.pausedAccum += performance.now() - state.timer.pauseStartedAt;
      state.timer.pauseStartedAt = null;
      startAnimationLoop();
    }
    $('#pause-btn-label').textContent = state.timer.paused ? 'Resume' : 'Pause';
    $('#pause-icon').classList.toggle('hidden', state.timer.paused);
    $('#play-icon').classList.toggle('hidden', !state.timer.paused);
    updateHudText();
  }

  function completeFlight() {
    clearInterval(state.timer.intervalId);
    state.timer.running = false;
    stopAnimationLoop();
    updatePlanePosition(1);

    const route = state.selectedRoute;
    state.stats.totalSeconds += state.timer.totalSeconds;
    state.stats.totalKm += route.km;
    state.stats.flights += 1;
    persistStats();
    renderStats();

    state.history.unshift({
      origin: route.origin,
      dest: route.dest,
      minutes: state.focusMinutes,
      km: route.km,
      seat: state.selectedSeat,
      purpose: state.selectedPurpose,
      dateLabel: todayLabel(),
      timestamp: Date.now(),
    });
    persistHistory();

    playLandingChime();

    $('#landing-desc').textContent = `${fmtKm(route.km)} km 마일리지가 적립되었습니다.`;
    $('#landing-stat-time').textContent = fmtMinutes(state.focusMinutes);
    $('#landing-stat-km').textContent = `+${fmtKm(route.km)} km`;
    renderPassportStamp(route);
    openModal($('#landing-modal'));
    launchConfetti();
  }

  function renderPassportStamp(route) {
    const wrap = $('#passport-stamp-wrap');
    wrap.innerHTML = `
      <div class="stamp-ring">
        <span class="stamp-top-text">PomoFlight · Arrived</span>
        <span class="stamp-code">${route.dest}</span>
        <span class="stamp-date">${todayLabel()}</span>
      </div>
    `;
  }

  function returnToGate() {
    clearInterval(state.timer.intervalId);
    state.timer.running = false;
    state.timer.paused = false;
    stopAnimationLoop();
    removePlaneMarker();
    stopAmbient();
    deactivateFlightAtmosphere();

    $('#flight-hud').classList.add('hidden');
    $('#topbar-brand').classList.remove('topbar-fade-hidden');
    $('#topbar-stats').classList.remove('topbar-fade-hidden');
    if (progressPolyline) progressPolyline.setLatLngs([]);

    if (map) {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
      map.touchZoom.enable();
      if (map.tap) map.tap.enable();
    }

    $('#explore-panel').classList.remove('hidden');
    $('#boarding-panel').classList.add('hidden');

    if (map && state.currentArc) {
      map.flyToBounds(L.latLngBounds(state.currentArc), { paddingTopLeft: [40, 110], paddingBottomRight: [40, 220], duration: 1.1 });
    }
  }

  /* ---------------------------------------------------------
     Flight history modal
  --------------------------------------------------------- */
  function renderHistory() {
    const list = $('#history-list');
    const empty = $('#history-empty');
    list.innerHTML = '';
    if (state.history.length === 0) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    state.history.forEach((h) => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.dataset.timestamp = String(h.timestamp);
      const purposeTag = FOCUS_TAGS.find((t) => t.id === h.purpose);
      item.innerHTML = `
        <div class="history-icon"><i data-lucide="plane" class="w-4 h-4 -rotate-45"></i></div>
        <div class="history-info">
          <div class="history-route">${h.origin} → ${h.dest} ${h.seat ? `· ${h.seat}` : ''}</div>
          <div class="history-meta">
            <span>${h.dateLabel} · ${fmtMinutes(h.minutes)}</span>
            ${purposeTag ? `<span class="history-purpose">${purposeTag.emoji} ${purposeTag.label}</span>` : ''}
          </div>
        </div>
        <div class="history-km">+${fmtKm(h.km)} km</div>
        <button class="history-delete-btn" type="button" title="삭제" aria-label="삭제"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
      `;
      item.querySelector('.history-delete-btn').addEventListener('click', () => deleteHistoryEntry(h.timestamp));
      list.appendChild(item);
    });
    refreshIcons();
  }

  function deleteHistoryEntry(timestamp) {
    state.history = state.history.filter((h) => h.timestamp !== timestamp);
    persistHistory();
    renderHistory();
  }

  function initHistoryModal() {
    const modal = $('#history-modal');
    $('#history-toggle-btn').addEventListener('click', () => {
      renderHistory();
      openModal(modal);
    });
    $('#history-modal-close').addEventListener('click', () => closeModal(modal));
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });
  }

  /* ---------------------------------------------------------
     Modal helpers
  --------------------------------------------------------- */
  function openModal(el) { el.classList.remove('hidden'); }
  function closeModal(el) { el.classList.add('hidden'); }

  /* ---------------------------------------------------------
     Web Audio: landing chime (short one-shot, unrelated to ambience)
  --------------------------------------------------------- */
  function getAudioCtx() {
    if (!state.audio.ctx) state.audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (state.audio.ctx.state === 'suspended') state.audio.ctx.resume();
    return state.audio.ctx;
  }

  function playChimeSequence(notes) {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = n.freq;
      const t0 = now + n.start;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.35, t0 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + n.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + n.dur + 0.05);
    });
  }

  // Classic two-tone "bing-bong" cabin chime, played on departure.
  function playTakeoffChime() {
    playChimeSequence([
      { freq: 659.25, start: 0.0, dur: 0.5 },  // E5
      { freq: 523.25, start: 0.28, dur: 0.7 }, // C5
    ]);
  }

  // Fuller three-tone arrival chime, played on landing.
  function playLandingChime() {
    playChimeSequence([
      { freq: 987.77, start: 0.0, dur: 0.55 },
      { freq: 783.99, start: 0.35, dur: 0.7 },
      { freq: 659.25, start: 0.85, dur: 0.9 },
    ]);
  }

  /* ---------------------------------------------------------
     Ambient sound panel — Airplane / Raindrop / Ocean Waves / Forest.
     Each texture is synthesized once via OfflineAudioContext, encoded
     to a WAV Blob, and played back through a real HTML5 <audio>
     element (looped) — no external sound files required.
  --------------------------------------------------------- */
  function createNoiseBuffer(ctx, duration, kind) {
    const bufferSize = Math.ceil(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    if (kind === 'white') {
      for (let i = 0; i < bufferSize; i++) output[i] = (Math.random() * 2 - 1) * 0.3;
      return buffer;
    }
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      output[i] = pink * 0.11;
    }
    return buffer;
  }

  const AMBIENT_KINDS = {
    airplane: {
      label: 'Airplane', duration: 12,
      build(ctx, duration) {
        const src = ctx.createBufferSource();
        src.buffer = createNoiseBuffer(ctx, duration, 'pink');
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass'; lowpass.frequency.value = 800;
        const hum = ctx.createOscillator();
        hum.type = 'sine'; hum.frequency.value = 82;
        const humGain = ctx.createGain(); humGain.gain.value = 0.06;
        const master = ctx.createGain(); master.gain.value = 1;
        src.connect(lowpass); lowpass.connect(master);
        hum.connect(humGain); humGain.connect(master);
        master.connect(ctx.destination);
        src.start(0); hum.start(0); hum.stop(duration);
      },
    },
    rain: {
      label: 'Raindrop', duration: 14,
      build(ctx, duration) {
        const src = ctx.createBufferSource();
        src.buffer = createNoiseBuffer(ctx, duration, 'white');
        const highpass = ctx.createBiquadFilter();
        highpass.type = 'highpass'; highpass.frequency.value = 1800;
        const bed = ctx.createGain(); bed.gain.value = 0.45;
        src.connect(highpass); highpass.connect(bed); bed.connect(ctx.destination);
        src.start(0);
        for (let t = 0.05; t < duration - 0.1; t += 0.05 + Math.random() * 0.15) {
          const dropDur = 0.05 + Math.random() * 0.05;
          const dropSrc = ctx.createBufferSource();
          dropSrc.buffer = createNoiseBuffer(ctx, dropDur, 'white');
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass'; bp.frequency.value = 2500 + Math.random() * 2500; bp.Q.value = 3;
          const dg = ctx.createGain();
          dg.gain.setValueAtTime(0, t);
          dg.gain.linearRampToValueAtTime(0.5 + Math.random() * 0.3, t + 0.005);
          dg.gain.exponentialRampToValueAtTime(0.001, t + dropDur);
          dropSrc.connect(bp); bp.connect(dg); dg.connect(ctx.destination);
          dropSrc.start(t);
        }
      },
    },
    ocean: {
      label: 'Ocean Waves', duration: 16,
      build(ctx, duration) {
        const src = ctx.createBufferSource();
        src.buffer = createNoiseBuffer(ctx, duration, 'pink');
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass'; lowpass.frequency.value = 500;
        const waveGain = ctx.createGain(); waveGain.gain.value = 0.5;
        const lfo = ctx.createOscillator();
        lfo.type = 'sine'; lfo.frequency.value = 2 / duration; // exactly 2 cycles -> seamless loop
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.4;
        lfo.connect(lfoGain); lfoGain.connect(waveGain.gain);
        src.connect(lowpass); lowpass.connect(waveGain); waveGain.connect(ctx.destination);
        src.start(0); lfo.start(0); lfo.stop(duration);
      },
    },
    forest: {
      label: 'Forest', duration: 14,
      build(ctx, duration) {
        const src = ctx.createBufferSource();
        src.buffer = createNoiseBuffer(ctx, duration, 'pink');
        const bandpass = ctx.createBiquadFilter();
        bandpass.type = 'bandpass'; bandpass.frequency.value = 700; bandpass.Q.value = 0.6;
        const bed = ctx.createGain(); bed.gain.value = 0.32;
        src.connect(bandpass); bandpass.connect(bed); bed.connect(ctx.destination);
        src.start(0);
        for (let t = 0.8; t < duration - 0.5; t += 1.2 + Math.random() * 2.5) {
          const chirpDur = 0.12 + Math.random() * 0.15;
          const osc = ctx.createOscillator(); osc.type = 'sine';
          const baseFreq = 1800 + Math.random() * 1800;
          osc.frequency.setValueAtTime(baseFreq, t);
          osc.frequency.exponentialRampToValueAtTime(baseFreq * (1.3 + Math.random() * 0.6), t + chirpDur * 0.6);
          const cg = ctx.createGain();
          cg.gain.setValueAtTime(0, t);
          cg.gain.linearRampToValueAtTime(0.18, t + 0.02);
          cg.gain.exponentialRampToValueAtTime(0.001, t + chirpDur);
          osc.connect(cg); cg.connect(ctx.destination);
          osc.start(t); osc.stop(t + chirpDur + 0.02);
        }
      },
    },
  };

  function encodeWavMono(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeString = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([view], { type: 'audio/wav' });
  }

  const ambientUrlCache = {};

  async function getAmbientObjectUrl(kind) {
    if (ambientUrlCache[kind]) return ambientUrlCache[kind];
    const def = AMBIENT_KINDS[kind];
    const sampleRate = 44100;
    const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const offlineCtx = new OfflineCtx(1, Math.ceil(sampleRate * def.duration), sampleRate);
    def.build(offlineCtx, def.duration);
    const rendered = await offlineCtx.startRendering();
    const blob = encodeWavMono(rendered.getChannelData(0), rendered.sampleRate);
    const url = URL.createObjectURL(blob);
    ambientUrlCache[kind] = url;
    return url;
  }

  async function playAmbient(kind) {
    const audioEl = $('#ambient-audio');
    const topIcon = $('#noise-toggle');
    if (state.audio.activeKind === kind) {
      audioEl.pause();
      state.audio.activeKind = null;
      topIcon.dataset.active = 'false';
      $$('.sound-option').forEach((b) => b.classList.remove('active'));
      return;
    }
    $$('.sound-option').forEach((b) => b.classList.toggle('active', b.dataset.kind === kind));
    const url = await getAmbientObjectUrl(kind);
    audioEl.src = url;
    audioEl.loop = true;
    audioEl.volume = state.audio.volume;
    try { await audioEl.play(); } catch (e) { /* blocked until a user gesture resolves it — button click already provides one */ }
    state.audio.activeKind = kind;
    topIcon.dataset.active = 'true';
  }

  function stopAmbient() {
    const audioEl = $('#ambient-audio');
    audioEl.pause();
    state.audio.activeKind = null;
    $('#noise-toggle').dataset.active = 'false';
    $$('.sound-option').forEach((b) => b.classList.remove('active'));
  }

  function initAmbientSound() {
    const volumeSlider = $('#noise-volume');
    state.audio.volume = parseInt(volumeSlider.value, 10) / 100;

    const control = $('.noise-control');
    const topIcon = $('#noise-toggle');

    topIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      control.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!control.contains(e.target)) control.classList.remove('open');
    });

    $$('.sound-option').forEach((btn) => {
      btn.addEventListener('click', () => playAmbient(btn.dataset.kind));
    });

    volumeSlider.addEventListener('input', (e) => {
      state.audio.volume = parseInt(e.target.value, 10) / 100;
      $('#ambient-audio').volume = state.audio.volume;
    });
  }

  /* ---------------------------------------------------------
     In-flight entertainment (YouTube)
  --------------------------------------------------------- */
  function extractYoutubeId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/,
    ];
    for (const re of patterns) {
      const m = url.match(re);
      if (m) return m[1];
    }
    return null;
  }

  function initIFE() {
    const modal = $('#ife-modal');
    const input = $('#youtube-url-input');
    const loadBtn = $('#youtube-load-btn');
    const placeholder = $('#ife-screen-placeholder');
    const mount = $('#ife-player-mount');

    $('#ife-toggle-btn').addEventListener('click', () => openModal(modal));
    $('#ife-modal-close').addEventListener('click', () => closeModal(modal));
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });

    function loadVideo() {
      const url = input.value.trim();
      const id = extractYoutubeId(url);
      if (!id) {
        input.classList.add('shake');
        setTimeout(() => input.classList.remove('shake'), 400);
        return;
      }
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      mount.innerHTML = '';
      mount.appendChild(iframe);
      mount.classList.remove('hidden');
      placeholder.classList.add('hidden');
      $('#ife-toggle-btn').dataset.active = 'true';
    }

    loadBtn.addEventListener('click', loadVideo);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadVideo(); });
  }

  /* ---------------------------------------------------------
     Confetti
  --------------------------------------------------------- */
  function launchConfetti() {
    const container = $('#confetti-container');
    container.innerHTML = '';
    const colors = ['#10B981', '#059669', '#6EE7B7', '#ffffff', '#34D399'];
    for (let i = 0; i < 50; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
      piece.style.animationDelay = `${Math.random() * 0.4}s`;
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      container.appendChild(piece);
    }
    setTimeout(() => { container.innerHTML = ''; }, 3200);
  }

  /* ---------------------------------------------------------
     Flight controls wiring
  --------------------------------------------------------- */
  function initFlightControls() {
    $('#boarding-back-btn').addEventListener('click', () => {
      $('#boarding-panel').classList.add('hidden');
      $('#explore-panel').classList.remove('hidden');
    });
    $('#start-boarding-btn').addEventListener('click', beginBoardingDeparture);

    $('#pause-btn').addEventListener('click', togglePause);
    $('#hud-unit-toggle').addEventListener('click', () => {
      state.hud.unit = state.hud.unit === 'km' ? 'mi' : 'km';
      updateHudText();
    });
    $('#abort-btn').addEventListener('click', () => openModal($('#abort-modal')));
    $('#abort-cancel-btn').addEventListener('click', () => closeModal($('#abort-modal')));
    $('#abort-confirm-btn').addEventListener('click', () => {
      closeModal($('#abort-modal'));
      returnToGate();
    });

    $('#landing-close-btn').addEventListener('click', () => {
      closeModal($('#landing-modal'));
      returnToGate();
    });
  }

  /* ---------------------------------------------------------
     Init
  --------------------------------------------------------- */
  function init() {
    try {
      initMap();
    } catch (e) {
      console.error('Map init failed:', e);
    }
    renderStats();

    state.occupiedSeats = generateOccupiedSeats();
    initDurationRuler();
    renderRouteCarousel();
    updateExploreSummary();
    drawRoutePreview(state.selectedRoute);

    initSeatModal();
    initFocusModal();
    initHistoryModal();
    initAmbientSound();
    initIFE();
    initFlightControls();
    initMapStyleToggle();

    refreshIcons();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

/* =========================================================
   PomoFlight 3D — Satellite Flight Focus Timer
   ========================================================= */

(() => {
  'use strict';

  /* ---------------------------------------------------------
     Data
  --------------------------------------------------------- */
  const ROUTES = [
    { origin: 'ICN', dest: 'HND', originCity: 'Seoul',  destCity: 'Tokyo',    minutes: 135, km: 1200,  o: [37.4602, 126.4407], d: [35.5494, 139.7798] },
    { origin: 'PUS', dest: 'OKA', originCity: 'Busan',  destCity: 'Okinawa',  minutes: 91,  km: 1004,  o: [35.1795, 128.9382], d: [26.1958, 127.6458] },
    { origin: 'ICN', dest: 'CJU', originCity: 'Seoul',  destCity: 'Jeju',     minutes: 65,  km: 450,   o: [37.4602, 126.4407], d: [33.5113, 126.4930] },
    { origin: 'ICN', dest: 'CDG', originCity: 'Seoul',  destCity: 'Paris',    minutes: 750, km: 8900,  o: [37.4602, 126.4407], d: [49.0097, 2.5479] },
    { origin: 'ICN', dest: 'JFK', originCity: 'Seoul',  destCity: 'New York', minutes: 840, km: 11000, o: [37.4602, 126.4407], d: [40.6413, -73.7781] },
    { origin: 'ICN', dest: 'LHR', originCity: 'Seoul',  destCity: 'London',   minutes: 790, km: 8850,  o: [37.4602, 126.4407], d: [51.4700, -0.4543] },
  ];
  const CUSTOM_HUB = [37.4602, 126.4407]; // ICN, used as the anchor for custom flights

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

  function destinationPoint(lat, lng, bearingDeg, distanceKm) {
    const R = 6371;
    const δ = distanceKm / R;
    const θ = toRad(bearingDeg);
    const φ1 = toRad(lat), λ1 = toRad(lng);
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
    const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
    return [toDeg(φ2), ((toDeg(λ2) + 540) % 360) - 180];
  }

  function computeFlightZoom(km) {
    if (km < 600) return 8;
    if (km < 1500) return 6;
    if (km < 4000) return 5;
    return 4;
  }

  /* ---------------------------------------------------------
     State
  --------------------------------------------------------- */
  const state = {
    selectedRoute: ROUTES[1],
    selectedSeat: null,
    occupiedSeats: new Set(),
    currentArc: null,
    stats: loadStats(),
    history: loadHistory(),
    timer: { running: false, paused: false, totalSeconds: 0, remainingSeconds: 0, intervalId: null },
    audio: { ctx: null, noiseNodes: null, noiseOn: false, volume: 0.35 },
  };
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
      attributionControl: true,
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

  function drawRoutePreview(route) {
    if (!map) return;
    routeLayerGroup.clearLayers();
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
    const cols = ['A', 'B', 'C', 'D', 'E', 'F'];
    const rows = 15;
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
    syncRulerToRoute(route);
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
      if (isSameRoute(route, state.selectedRoute)) node.classList.add('selected');
      node.addEventListener('click', () => selectRoute(route));
      carousel.appendChild(node);
    });
    refreshIcons();
  }

  function updateExploreSummary() {
    const route = state.selectedRoute;
    $('#ecs-codes').innerHTML = `${route.origin} <i data-lucide="plane" class="w-3.5 h-3.5 inline text-cyan"></i> ${route.dest}`;
    $('#ecs-meta').textContent = `${fmtMinutes(route.minutes)} · ${fmtKm(route.km)} km`;
    refreshIcons();
  }

  /* ---------------------------------------------------------
     Duration ruler (horizontal scroll picker)
  --------------------------------------------------------- */
  const RULER_MIN = 10, RULER_MAX = 180, RULER_STEP = 10;

  function renderDurationRuler() {
    const track = $('#duration-ruler-track');
    track.innerHTML = '';
    for (let m = RULER_MIN; m <= RULER_MAX; m += RULER_STEP) {
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
    }
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

  function commitRulerSelection(tickEl) {
    if (!tickEl) return;
    const minutes = parseInt(tickEl.dataset.minutes, 10);
    const currentRounded = Math.round(state.selectedRoute.minutes / RULER_STEP) * RULER_STEP;
    if (minutes === currentRounded) return;
    const km = Math.round(minutes * 7.4);
    const bearingDeg = Math.random() * 360;
    const destCoord = destinationPoint(CUSTOM_HUB[0], CUSTOM_HUB[1], bearingDeg, km);
    const route = { origin: 'ICN', dest: 'FOCUS', originCity: 'Seoul', destCity: 'Custom Focus', minutes, km, o: CUSTOM_HUB, d: destCoord, custom: true };
    selectRoute(route);
  }

  function syncRulerToRoute(route) {
    const readout = $('#ruler-readout');
    if (route.minutes < RULER_MIN || route.minutes > RULER_MAX) {
      $$('.ruler-tick').forEach((t) => t.classList.remove('active'));
      readout.textContent = fmtMinutes(route.minutes);
      return;
    }
    const rounded = Math.min(RULER_MAX, Math.max(RULER_MIN, Math.round(route.minutes / RULER_STEP) * RULER_STEP));
    const tick = $(`.ruler-tick[data-minutes="${rounded}"]`);
    if (!tick) return;
    highlightRulerTick(tick);
    tick.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  function initDurationRuler() {
    renderDurationRuler();
    const ruler = $('#duration-ruler');
    let commitTimer = null;
    ruler.addEventListener('scroll', () => {
      const nearest = getNearestRulerTick();
      highlightRulerTick(nearest);
      clearTimeout(commitTimer);
      commitTimer = setTimeout(() => commitRulerSelection(nearest), 180);
    }, { passive: true });
  }

  /* ---------------------------------------------------------
     Seat selection modal
  --------------------------------------------------------- */
  const SEAT_COLS = ['A', 'B', 'C', 'D', 'E', 'F'];
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
      ['A', 'B', 'C'].forEach((col) => leftGroup.appendChild(buildSeatBtn(row, col)));

      const aisle = document.createElement('div');
      aisle.className = 'seat-aisle-gap';

      const rightGroup = document.createElement('div');
      rightGroup.className = 'seat-group';
      ['D', 'E', 'F'].forEach((col) => rightGroup.appendChild(buildSeatBtn(row, col)));

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
      showBoardingPhase();
    });
  }

  /* ---------------------------------------------------------
     Boarding pass
  --------------------------------------------------------- */
  function buildBoardingPassNode(route, seat) {
    const tpl = $('#boarding-pass-template');
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.querySelector('.bp-origin-code').textContent = route.origin;
    node.querySelector('.bp-dest-code').textContent = route.dest;
    node.querySelector('.bp-origin-city').textContent = route.originCity;
    node.querySelector('.bp-dest-city').textContent = route.destCity;
    node.querySelector('.bp-flight-duration').textContent = fmtMinutes(route.minutes);
    node.querySelector('.bp-flight-distance').textContent = `${fmtKm(route.km)} km`;
    node.querySelector('.bp-passenger').textContent = 'FOCUS TRAVELER';
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
    $('#explore-panel').classList.add('hidden');
    $('#boarding-panel').classList.remove('hidden');
  }

  function beginBoardingDeparture() {
    const panel = $('#boarding-panel');
    panel.classList.add('leaving');
    setTimeout(() => {
      panel.classList.add('hidden');
      panel.classList.remove('leaving');
      enterFlightPhase();
    }, 420);
  }

  /* ---------------------------------------------------------
     Flight phase (in-flight satellite tracking)
  --------------------------------------------------------- */
  function enterFlightPhase() {
    const route = state.selectedRoute;
    $('#flight-hud').classList.remove('hidden');
    $('#fixed-plane').classList.remove('hidden');
    $('#hud-origin-code').textContent = route.origin;
    $('#hud-dest-code').textContent = route.dest;

    if (map) {
      map.dragging.disable();
      map.scrollWheelZoom.disable();
      map.doubleClickZoom.disable();
      map.touchZoom.disable();
      if (map.tap) map.tap.disable();
      map.setView(state.currentArc[0], computeFlightZoom(route.km), { animate: false });
    }

    const totalSeconds = route.minutes * 60;
    state.timer.totalSeconds = totalSeconds;
    state.timer.remainingSeconds = totalSeconds;
    state.timer.running = true;
    state.timer.paused = false;

    updateHud();
    clearInterval(state.timer.intervalId);
    state.timer.intervalId = setInterval(tickTimer, 1000);
  }

  function tickTimer() {
    if (state.timer.paused) return;
    state.timer.remainingSeconds -= 1;
    if (state.timer.remainingSeconds <= 0) {
      state.timer.remainingSeconds = 0;
      updateHud();
      completeFlight();
      return;
    }
    updateHud();
  }

  function updateHud() {
    const route = state.selectedRoute;
    const total = state.timer.totalSeconds || 1;
    const elapsed = total - state.timer.remainingSeconds;
    const progress = Math.min(1, Math.max(0, elapsed / total));

    $('#hud-timer').textContent = fmtTimer(state.timer.remainingSeconds);
    $('#hud-timer').classList.toggle('is-paused', state.timer.paused);
    $('#hud-progress-fill').style.width = `${progress * 100}%`;
    $('#hud-progress-pct').textContent = Math.round(progress * 100);

    const remainingKm = Math.max(0, route.km * (1 - progress));
    $('#hud-distance').textContent = fmtKm(remainingKm);

    const baseSpeed = route.km / (route.minutes / 60);
    const jitter = 1 + Math.sin(elapsed / 23) * 0.035;
    $('#hud-speed').textContent = fmtKm(progress >= 1 ? 0 : baseSpeed * jitter);

    const arc = state.currentArc;
    if (!arc) return;
    const pos = pointAtProgress(arc, progress);
    const aheadPos = pointAtProgress(arc, Math.min(1, progress + 0.01));
    const bearing = bearingBetween(pos, aheadPos);
    $('.fixed-plane-icon').style.transform = `rotate(${bearing}deg)`;

    if (!map) return;
    const idx = Math.floor(progress * (arc.length - 1));
    progressPolyline.setLatLngs(arc.slice(0, idx + 1).concat([pos]));

    if (!state.timer.paused) {
      map.panTo(pos, { animate: true, duration: 0.95, easeLinearity: 0.4, noMoveStart: true });
    }
  }

  function togglePause() {
    if (!state.timer.running) return;
    state.timer.paused = !state.timer.paused;
    $('#pause-btn-label').textContent = state.timer.paused ? 'Resume' : 'Pause';
    $('#pause-icon').classList.toggle('hidden', state.timer.paused);
    $('#play-icon').classList.toggle('hidden', !state.timer.paused);
    updateHud();
  }

  function completeFlight() {
    clearInterval(state.timer.intervalId);
    state.timer.running = false;

    const route = state.selectedRoute;
    state.stats.totalSeconds += state.timer.totalSeconds;
    state.stats.totalKm += route.km;
    state.stats.flights += 1;
    persistStats();
    renderStats();

    state.history.unshift({
      origin: route.origin,
      dest: route.dest,
      minutes: route.minutes,
      km: route.km,
      seat: state.selectedSeat,
      dateLabel: todayLabel(),
      timestamp: Date.now(),
    });
    persistHistory();

    playLandingChime();

    $('#landing-desc').textContent = `${fmtKm(route.km)} km 마일리지가 적립되었습니다.`;
    $('#landing-stat-time').textContent = fmtMinutes(route.minutes);
    $('#landing-stat-km').textContent = `${fmtKm(route.km)} km`;
    openModal($('#landing-modal'));
    launchConfetti();
  }

  function returnToGate() {
    clearInterval(state.timer.intervalId);
    state.timer.running = false;
    state.timer.paused = false;
    if (state.audio.noiseOn) {
      stopCabinNoise();
      $('#noise-power-btn').dataset.active = 'false';
      $('#noise-power-btn').textContent = 'OFF';
      $('#noise-toggle').dataset.active = 'false';
    }

    $('#flight-hud').classList.add('hidden');
    $('#fixed-plane').classList.add('hidden');
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
     Custom flight
  --------------------------------------------------------- */
  function initCustomFlightModal() {
    const modal = $('#custom-flight-modal');
    $('#custom-flight-btn').addEventListener('click', () => {
      $('#custom-flight-form').reset();
      openModal(modal);
    });
    $('#custom-modal-close').addEventListener('click', () => closeModal(modal));
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });

    $('#custom-flight-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const origin = $('#custom-origin').value.trim().toUpperCase().slice(0, 4) || 'CST';
      const dest = $('#custom-dest').value.trim().toUpperCase().slice(0, 4) || 'DST';
      const originCity = $('#custom-origin-city').value.trim() || 'Origin';
      const destCity = $('#custom-dest-city').value.trim() || 'Destination';
      const minutes = Math.max(1, Math.min(600, parseInt($('#custom-minutes').value, 10) || 25));
      const km = Math.round(minutes * 7.4);
      const bearingDeg = Math.random() * 360;
      const destCoord = destinationPoint(CUSTOM_HUB[0], CUSTOM_HUB[1], bearingDeg, km);

      const route = { origin, dest, originCity, destCity, minutes, km, o: CUSTOM_HUB, d: destCoord, custom: true };
      selectRoute(route);
      closeModal(modal);
    });
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
      item.innerHTML = `
        <div class="history-icon"><i data-lucide="plane" class="w-4 h-4 -rotate-45"></i></div>
        <div>
          <div class="history-route">${h.origin} → ${h.dest} ${h.seat ? `· ${h.seat}` : ''}</div>
          <div class="history-meta">${h.dateLabel} · ${fmtMinutes(h.minutes)}</div>
        </div>
        <div class="history-km">+${fmtKm(h.km)} km</div>
      `;
      list.appendChild(item);
    });
    refreshIcons();
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
     Web Audio: cabin white noise + landing chime
  --------------------------------------------------------- */
  function getAudioCtx() {
    if (!state.audio.ctx) state.audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (state.audio.ctx.state === 'suspended') state.audio.ctx.resume();
    return state.audio.ctx;
  }

  function startCabinNoise() {
    const ctx = getAudioCtx();
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
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

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 800;

    const hum = ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 82;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.05;

    const masterGain = ctx.createGain();
    masterGain.gain.value = state.audio.volume;

    noiseSource.connect(lowpass);
    lowpass.connect(masterGain);
    hum.connect(humGain);
    humGain.connect(masterGain);
    masterGain.connect(ctx.destination);

    noiseSource.start();
    hum.start();

    state.audio.noiseNodes = { noiseSource, hum, masterGain };
    state.audio.noiseOn = true;
  }

  function stopCabinNoise() {
    if (!state.audio.noiseNodes) return;
    const { noiseSource, hum, masterGain } = state.audio.noiseNodes;
    const ctx = state.audio.ctx;
    const now = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.4);
    setTimeout(() => { try { noiseSource.stop(); hum.stop(); } catch (e) { /* already stopped */ } }, 450);
    state.audio.noiseNodes = null;
    state.audio.noiseOn = false;
  }

  function setNoiseVolume(v) {
    state.audio.volume = v;
    if (state.audio.noiseNodes) {
      state.audio.noiseNodes.masterGain.gain.setTargetAtTime(v, state.audio.ctx.currentTime, 0.05);
    }
  }

  function playLandingChime() {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const notes = [
      { freq: 987.77, start: 0.0, dur: 0.55 },
      { freq: 783.99, start: 0.35, dur: 0.7 },
      { freq: 659.25, start: 0.85, dur: 0.9 },
    ];
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

  function initCabinAudio() {
    const volumeSlider = $('#noise-volume');
    setNoiseVolume(parseInt(volumeSlider.value, 10) / 100);

    const control = $('.noise-control');
    const topIcon = $('#noise-toggle');
    const powerBtn = $('#noise-power-btn');

    topIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      control.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!control.contains(e.target)) control.classList.remove('open');
    });

    powerBtn.addEventListener('click', () => {
      const active = powerBtn.dataset.active === 'true';
      if (active) {
        stopCabinNoise();
        powerBtn.dataset.active = 'false';
        powerBtn.textContent = 'OFF';
        topIcon.dataset.active = 'false';
      } else {
        startCabinNoise();
        powerBtn.dataset.active = 'true';
        powerBtn.textContent = 'ON';
        topIcon.dataset.active = 'true';
      }
    });

    volumeSlider.addEventListener('input', (e) => setNoiseVolume(parseInt(e.target.value, 10) / 100));
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
    syncRulerToRoute(state.selectedRoute);

    initSeatModal();
    initCustomFlightModal();
    initHistoryModal();
    initCabinAudio();
    initIFE();
    initFlightControls();
    initMapStyleToggle();

    refreshIcons();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

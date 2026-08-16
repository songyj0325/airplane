/* =========================================================
   PomoFlight 3D — Satellite Flight Focus Timer
   ========================================================= */

(() => {
  'use strict';

  /* ---------------------------------------------------------
     Data
  --------------------------------------------------------- */
  const ICN = [37.4602, 126.4407];

  function haversineKm(o, d) {
    const R = 6371;
    const dLat = ((d[0] - o[0]) * Math.PI) / 180;
    const dLng = ((d[1] - o[1]) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((o[0] * Math.PI) / 180) * Math.cos((d[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Single source of truth for the flight-time model, shared by both the
  // route dataset (km -> minutes) and the radar circle (minutes -> km) so
  // the two are always mathematically exact inverses of each other.
  const CRUISE_SPEED_KMH = 850;
  const FLIGHT_OVERHEAD_MINUTES = 25; // fixed takeoff/climb/landing allowance
  const minutesForDistance = (km) => Math.round((km / CRUISE_SPEED_KMH) * 60 + FLIGHT_OVERHEAD_MINUTES);
  const reachableKmForMinutes = (minutes) => Math.max(0, minutes - FLIGHT_OVERHEAD_MINUTES) / 60 * CRUISE_SPEED_KMH;

  // 150+ major world airports -- [IATA code, city, lat, lng]. Every flight
  // originates from ICN (the hub); km/minutes are derived from these
  // coordinates via Haversine great-circle distance, so the whole dataset
  // (and the radar circle below) stays mathematically consistent.
  const AIRPORT_DATA = [
    // North America (30)
    ['LAX', 'Los Angeles', 33.9416, -118.4085], ['JFK', 'New York', 40.6413, -73.7781],
    ['SFO', 'San Francisco', 37.6213, -122.3790], ['SJC', 'San Jose', 37.3639, -121.9289],
    ['SEA', 'Seattle', 47.4502, -122.3088], ['ORD', 'Chicago', 41.9742, -87.9073],
    ['MIA', 'Miami', 25.7959, -80.2870], ['DFW', 'Dallas', 32.8998, -97.0403],
    ['ATL', 'Atlanta', 33.6407, -84.4277], ['BOS', 'Boston', 42.3656, -71.0096],
    ['LAS', 'Las Vegas', 36.0840, -115.1537], ['DEN', 'Denver', 39.8561, -104.6737],
    ['IAH', 'Houston', 29.9902, -95.3368], ['YVR', 'Vancouver', 49.1967, -123.1815],
    ['YYZ', 'Toronto', 43.6777, -79.6248], ['YUL', 'Montreal', 45.4706, -73.7408],
    ['MEX', 'Mexico City', 19.4363, -99.0721], ['CUN', 'Cancun', 21.0365, -86.8771],
    ['PHX', 'Phoenix', 33.4342, -112.0116], ['IAD', 'Washington D.C.', 38.9531, -77.4565],
    ['EWR', 'Newark', 40.6895, -74.1745], ['MSP', 'Minneapolis', 44.8848, -93.2223],
    ['DTW', 'Detroit', 42.2124, -83.3534], ['PHL', 'Philadelphia', 39.8744, -75.2424],
    ['SAN', 'San Diego', 32.7338, -117.1933], ['PDX', 'Portland', 45.5898, -122.5951],
    ['HNL', 'Honolulu', 21.3245, -157.9251], ['YYC', 'Calgary', 51.1315, -114.0106],
    ['YOW', 'Ottawa', 45.3225, -75.6692], ['GDL', 'Guadalajara', 20.5218, -103.3111],
    // South America (16)
    ['GRU', 'Sao Paulo', -23.4356, -46.4731], ['GIG', 'Rio de Janeiro', -22.8090, -43.2506],
    ['BOG', 'Bogota', 4.7016, -74.1469], ['EZE', 'Buenos Aires', -34.8222, -58.5358],
    ['SCL', 'Santiago', -33.3930, -70.7858], ['LIM', 'Lima', -12.0219, -77.1143],
    ['UIO', 'Quito', -0.1292, -78.3575], ['SJO', 'San Jose', 9.9981, -84.2041],
    ['LPB', 'La Paz', -16.5133, -68.1925], ['MVD', 'Montevideo', -34.8384, -56.0308],
    ['CCS', 'Caracas', 10.6013, -66.9911], ['PTY', 'Panama City', 9.0714, -79.3835],
    ['ASU', 'Asuncion', -25.2400, -57.5200], ['GYE', 'Guayaquil', -2.1574, -79.8836],
    ['CUZ', 'Cusco', -13.5357, -71.9388], ['FOR', 'Fortaleza', -3.7763, -38.5326],
    // Europe (40)
    ['LHR', 'London', 51.4700, -0.4543], ['LGW', 'London Gatwick', 51.1537, -0.1821],
    ['CDG', 'Paris', 49.0097, 2.5479], ['ORY', 'Paris Orly', 48.7233, 2.3794],
    ['FRA', 'Frankfurt', 50.0379, 8.5622], ['MUC', 'Munich', 48.3538, 11.7861],
    ['AMS', 'Amsterdam', 52.3105, 4.7683], ['MAD', 'Madrid', 40.4983, -3.5676],
    ['BCN', 'Barcelona', 41.2974, 2.0833], ['FCO', 'Rome', 41.8003, 12.2389],
    ['MXP', 'Milan', 45.6306, 8.7281], ['ZRH', 'Zurich', 47.4647, 8.5492],
    ['VIE', 'Vienna', 48.1103, 16.5697], ['CPH', 'Copenhagen', 55.6180, 12.6560],
    ['ARN', 'Stockholm', 59.6519, 17.9186], ['OSL', 'Oslo', 60.1939, 11.1004],
    ['HEL', 'Helsinki', 60.3172, 24.9633], ['PRG', 'Prague', 50.1008, 14.2600],
    ['BUD', 'Budapest', 47.4298, 19.2611], ['ATH', 'Athens', 37.9364, 23.9445],
    ['IST', 'Istanbul', 41.2753, 28.7519], ['WAW', 'Warsaw', 52.1657, 20.9671],
    ['DUB', 'Dublin', 53.4213, -6.2701], ['BRU', 'Brussels', 50.9014, 4.4844],
    ['GVA', 'Geneva', 46.2381, 6.1090], ['LIS', 'Lisbon', 38.7813, -9.1359],
    ['MAN', 'Manchester', 53.3537, -2.2750], ['EDI', 'Edinburgh', 55.9500, -3.3725],
    ['OTP', 'Bucharest', 44.5711, 26.0850], ['SOF', 'Sofia', 42.6952, 23.4062],
    ['BEG', 'Belgrade', 44.8184, 20.3091], ['ZAG', 'Zagreb', 45.7429, 16.0688],
    ['LJU', 'Ljubljana', 46.2237, 14.4576], ['KEF', 'Reykjavik', 63.9850, -22.6056],
    ['SVO', 'Moscow', 55.9726, 37.4146], ['LED', 'St Petersburg', 59.8003, 30.2625],
    ['NCE', 'Nice', 43.6584, 7.2159], ['BER', 'Berlin', 52.3667, 13.5033],
    ['HAM', 'Hamburg', 53.6304, 9.9882], ['MLA', 'Malta', 35.8575, 14.4775],
    // Asia / Korea (32, excluding the ICN hub itself)
    ['GMP', 'Gimpo', 37.5583, 126.7906], ['PUS', 'Busan', 35.1795, 128.9382],
    ['CJU', 'Jeju', 33.5113, 126.4930], ['YNY', 'Yangyang', 38.0611, 128.6692],
    ['TAE', 'Daegu', 35.8941, 128.6589], ['KWJ', 'Gwangju', 35.1264, 126.8089],
    ['HND', 'Tokyo', 35.5494, 139.7798], ['NRT', 'Narita', 35.7719, 140.3929],
    ['KIX', 'Osaka', 34.4347, 135.2441], ['NGO', 'Nagoya', 34.8584, 136.8054],
    ['FUK', 'Fukuoka', 33.5859, 130.4506], ['CTS', 'Sapporo', 42.7752, 141.6923],
    ['OKA', 'Okinawa', 26.1958, 127.6458], ['PEK', 'Beijing', 40.0799, 116.6031],
    ['PVG', 'Shanghai', 31.1443, 121.8083], ['CAN', 'Guangzhou', 23.3924, 113.2988],
    ['CTU', 'Chengdu', 30.5785, 103.9471], ['TPE', 'Taipei', 25.0797, 121.2342],
    ['HKG', 'Hong Kong', 22.3080, 113.9185], ['MFM', 'Macau', 22.1496, 113.5915],
    ['BKK', 'Bangkok', 13.6900, 100.7501], ['SIN', 'Singapore', 1.3644, 103.9915],
    ['KUL', 'Kuala Lumpur', 2.7456, 101.7099], ['SGN', 'Ho Chi Minh City', 10.8188, 106.6520],
    ['HAN', 'Hanoi', 21.2212, 105.8072], ['MNL', 'Manila', 14.5086, 121.0194],
    ['DEL', 'Delhi', 28.5562, 77.1000], ['BOM', 'Mumbai', 19.0887, 72.8679],
    ['CGK', 'Jakarta', -6.1256, 106.6559], ['DPS', 'Bali', -8.7482, 115.1672],
    ['PNH', 'Phnom Penh', 11.5466, 104.8441], ['RGN', 'Yangon', 16.9073, 96.1332],
    // Oceania / Middle East / Africa (36)
    ['SYD', 'Sydney', -33.9399, 151.1753], ['MEL', 'Melbourne', -37.6690, 144.8410],
    ['BNE', 'Brisbane', -27.3842, 153.1175], ['PER', 'Perth', -31.9385, 115.9672],
    ['AKL', 'Auckland', -36.9986, 174.7920], ['CHC', 'Christchurch', -43.4894, 172.5320],
    ['DXB', 'Dubai', 25.2532, 55.3657], ['AUH', 'Abu Dhabi', 24.4330, 54.6511],
    ['DOH', 'Doha', 25.2731, 51.6080], ['JNB', 'Johannesburg', -26.1392, 28.2460],
    ['CPT', 'Cape Town', -33.9715, 18.6021], ['CAI', 'Cairo', 30.1219, 31.4056],
    ['CMN', 'Casablanca', 33.3675, -7.5898], ['NBO', 'Nairobi', -1.3192, 36.9278],
    ['ADD', 'Addis Ababa', 8.9779, 38.7993], ['LOS', 'Lagos', 6.5774, 3.3212],
    ['ACC', 'Accra', 5.6052, -0.1668], ['TUN', 'Tunis', 36.8510, 10.2272],
    ['ALG', 'Algiers', 36.6910, 3.2154], ['RUH', 'Riyadh', 24.9576, 46.6988],
    ['JED', 'Jeddah', 21.6796, 39.1565], ['AMM', 'Amman', 31.7226, 35.9932],
    ['TLV', 'Tel Aviv', 32.0114, 34.8867], ['BAH', 'Bahrain', 26.2708, 50.6336],
    ['KWI', 'Kuwait City', 29.2266, 47.9689], ['MCT', 'Muscat', 23.5933, 58.2844],
    ['WLG', 'Wellington', -41.3272, 174.8053], ['NAN', 'Nadi', -17.7554, 177.4434],
    ['GUM', 'Guam', 13.4834, 144.7960], ['NOU', 'Noumea', -22.0146, 166.2130],
    ['MRU', 'Mauritius', -20.4302, 57.6836], ['SEZ', 'Seychelles', -4.6743, 55.5218],
    ['DAR', 'Dar es Salaam', -6.8781, 39.2026], ['HRE', 'Harare', -17.9318, 31.0928],
    ['MPM', 'Maputo', -25.9208, 32.5726], ['EBB', 'Entebbe', 0.0424, 32.4435],
  ];

  const AIRPORTS = AIRPORT_DATA.map(([code, city, lat, lng]) => ({ code, city, lat, lng }));

  // Every route originates from Seoul/ICN; km + minutes are derived from the
  // coordinates so the dataset (and the radar circle) never drift out of sync.
  const ROUTES = AIRPORTS.map((a) => {
    const o = ICN, d = [a.lat, a.lng];
    const km = Math.round(haversineKm(o, d));
    return {
      origin: 'ICN', dest: a.code, originCity: 'Seoul', destCity: a.city,
      o, d, km, minutes: minutesForDistance(km),
    };
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

  // Great-circle (geodesic) path between two points, via spherical linear
  // interpolation (slerp) of their unit vectors -- this is the same curve
  // real long-haul flights follow (e.g. bowing north over Siberia/the
  // Arctic on a Seoul-New York routing), not a naive straight line on the
  // lat/lng grid.
  function latLngToVec(lat, lng) {
    const φ = toRad(lat), λ = toRad(lng);
    return [Math.cos(φ) * Math.cos(λ), Math.cos(φ) * Math.sin(λ), Math.sin(φ)];
  }
  function vecToLatLng(v) {
    return [toDeg(Math.asin(Math.max(-1, Math.min(1, v[2])))), toDeg(Math.atan2(v[1], v[0]))];
  }
  function slerpVec(v0, v1, t) {
    const dot = Math.max(-1, Math.min(1, v0[0] * v1[0] + v0[1] * v1[1] + v0[2] * v1[2]));
    const theta = Math.acos(dot) * t;
    const rx = v1[0] - v0[0] * dot, ry = v1[1] - v0[1] * dot, rz = v1[2] - v0[2] * dot;
    const rLen = Math.sqrt(rx * rx + ry * ry + rz * rz);
    if (rLen < 1e-10) return v0;
    const ux = rx / rLen, uy = ry / rLen, uz = rz / rLen;
    const cosT = Math.cos(theta), sinT = Math.sin(theta);
    return [v0[0] * cosT + ux * sinT, v0[1] * cosT + uy * sinT, v0[2] * cosT + uz * sinT];
  }

  function buildFlightPath(o, d, segments = 100) {
    const v0 = latLngToVec(o[0], o[1]);
    const v1 = latLngToVec(d[0], d[1]);
    const pts = [];
    let prevLng = o[1];
    for (let i = 0; i <= segments; i++) {
      const [lat, lngRaw] = vecToLatLng(slerpVec(v0, v1, i / segments));
      // Unwrap longitude across the antimeridian so the polyline never
      // draws a spurious seam across the whole map.
      let lng = lngRaw;
      while (lng - prevLng > 180) lng -= 360;
      while (lng - prevLng < -180) lng += 360;
      prevLng = lng;
      pts.push([lat, lng]);
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

  // Destination point given a start coordinate, initial bearing and
  // great-circle distance -- the exact inverse of Haversine, and the
  // building block for a properly geodesic (not flat-ellipse) radar ring.
  function destinationPoint(lat, lng, bearingDeg, distanceKm) {
    const R = 6371;
    const δ = distanceKm / R;
    const θ = toRad(bearingDeg);
    const φ1 = toRad(lat), λ1 = toRad(lng);
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
    const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
    return [toDeg(φ2), ((toDeg(λ2) + 540) % 360) - 180];
  }

  function buildGeodesicRing(center, radiusKm, segments = 72) {
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      pts.push(destinationPoint(center[0], center[1], (360 / segments) * i, radiusKm));
    }
    return pts;
  }

  function computeFlightZoom(km) {
    return km < 2000 ? 14 : 13;
  }

  /* ---------------------------------------------------------
     State
  --------------------------------------------------------- */
  const state = {
    selectedRoute: ROUTES.find((r) => r.dest === 'HND') || ROUTES[0],
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
    { id: 'read', label: 'Read', icon: 'book-open' },
    { id: 'exercise', label: 'Exercise', icon: 'dumbbell' },
    { id: 'work', label: 'Work', icon: 'briefcase' },
    { id: 'study', label: 'Study', icon: 'graduation-cap' },
    { id: 'hobby', label: 'Hobby', icon: 'palette' },
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
  // Recommendation markers (world airport badges) are explore-only: they're
  // removed from the map entirely during flight so Leaflet isn't repositioning
  // 150+ extra DOM markers on every camera update while tracking. They're
  // also built exactly once and cached by IATA code -- with 150+ of them,
  // destroying and recreating every DOM node on each route selection was
  // the single biggest source of jank, far more than the map pan itself.
  let recommendationLayerGroup;
  const airportMarkerCache = new Map(); // code -> L.Marker

  function ensureAirportBadges() {
    if (airportMarkerCache.size > 0) return;
    ROUTES.forEach((r) => {
      const marker = L.marker(r.d, { icon: airportBadgeIcon(r.dest), interactive: true }).addTo(recommendationLayerGroup);
      marker.on('click', () => selectRoute(r));
      airportMarkerCache.set(r.dest, marker);
    });
  }

  function setBadgeHidden(code, hidden) {
    const marker = airportMarkerCache.get(code);
    const el = marker && marker.getElement();
    if (el) el.style.display = hidden ? 'none' : '';
  }

  // Only expose badges for airports that actually fall within the current
  // focus-duration-derived reachable radius -- the map should "unlock" more
  // destinations as the ruler grows (from a couple nearby at 30m to most of
  // the world at 14h), instead of showing all 150+ codes at once regardless
  // of the selected duration.
  function updateBadgeVisibility(radiusKm) {
    if (airportMarkerCache.size === 0) return;
    ROUTES.forEach((r) => {
      setBadgeHidden(r.dest, r.dest === state.selectedRoute.dest || r.km > radiusKm);
    });
  }

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
      maxNativeZoom: 17, // beyond this, Leaflet upscales the last real tile instead of requesting missing ones
    });
    darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 18,
      maxNativeZoom: 17,
    });
    satelliteLayer.addTo(map);

    routeLayerGroup = L.layerGroup().addTo(map);
    recommendationLayerGroup = L.layerGroup().addTo(map);

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

  // L.circle renders a constant-*pixel*-radius SVG ellipse, which is only
  // an approximation of true ground distance once you're far from the
  // equator (Mercator's east-west stretch grows with latitude). Building
  // the boundary from real destinationPoint() coordinates at each bearing
  // makes it a genuine geodesic ring, so an airport at exactly the
  // reachable distance lands exactly on the line regardless of latitude.
  function ensureRadarCircle() {
    if (!map) return null;
    if (!radarCircle) {
      radarCircle = L.polygon([state.selectedRoute.o], {
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
    const radiusKm = reachableKmForMinutes(minutes);
    circle.setLatLngs(buildGeodesicRing(state.selectedRoute.o, radiusKm));
    circle.bringToBack();
    updateBadgeVisibility(radiusKm);
  }

  // Fits the camera to the selected flight path *and* the full radar-circle
  // extent, so airports sitting near the reachability boundary stay framed
  // in view instead of being cut off at the viewport edge.
  function fitMapToRouteAndRadar(path, duration) {
    if (!map) return;
    let bounds = L.latLngBounds(path);
    if (radarCircle) bounds = bounds.extend(radarCircle.getBounds());
    map.flyToBounds(bounds, { paddingTopLeft: [40, 110], paddingBottomRight: [40, 220], duration });
  }

  function drawRoutePreview(route) {
    if (!map) return;
    routeLayerGroup.clearLayers();
    ensureAirportBadges(); // built once; every later call is a cheap no-op
    // updateRadarCircle() re-derives badge visibility for every airport from
    // scratch each call (radius reachability + hiding the active route's own
    // destination, which gets its own bright marker below), so no separate
    // show/hide bookkeeping is needed here.
    updateRadarCircle();

    const path = buildFlightPath(route.o, route.d);
    state.currentArc = path;

    remainderPolyline = L.polyline(path, { color: '#059669', weight: 2.5, opacity: 0.6, dashArray: '2,10', lineCap: 'round' }).addTo(routeLayerGroup);
    progressPolyline = L.polyline([], { color: '#10B981', weight: 3.5, opacity: 0.95, className: 'route-arc-glow', lineCap: 'round' }).addTo(routeLayerGroup);
    originMarker = L.marker(route.o, { icon: geoIcon('origin') }).addTo(routeLayerGroup);
    destMarker = L.marker(route.d, { icon: geoIcon('dest') }).addTo(routeLayerGroup);

    fitMapToRouteAndRadar(path, 1.3);
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
    if (state.currentArc) fitMapToRouteAndRadar(state.currentArc, 1); // reframe so boundary airports stay in view
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
      btn.innerHTML = `<i data-lucide="${tag.icon}" class="focus-tag-icon"></i><span>${tag.label}</span>`;
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
  let lastCameraUpdateTime = 0;
  // The plane marker itself is cheap to move every frame (just a DOM
  // transform), but map.setView() re-evaluates the whole tile grid on every
  // call -- at zoom 13-14 that means far more tiles crossing the viewport
  // per pixel of pan than at the old zoom 7-9, so it's throttled separately
  // to stop it from re-triggering Leaflet's layout/tile machinery 60x/sec.
  const CAMERA_UPDATE_INTERVAL_MS = 66; // ~15fps cap for camera pan + trail redraw -- plenty smooth for a slow drift, and cuts tile/layout churn further

  function startAnimationLoop() {
    cancelAnimationFrame(flightAnimFrameId);
    lastCameraUpdateTime = 0;
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

  function updatePlanePosition(progress, force) {
    const arc = state.currentArc;
    if (!arc || !map || !planeMarker) return;
    const pos = pointAtProgress(arc, progress);
    const aheadPos = pointAtProgress(arc, Math.min(1, progress + 0.004));
    const bearing = bearingBetween(pos, aheadPos);
    planeMarker.setLatLng(pos);
    setPlaneBearing(bearing);

    const now = performance.now();
    if (force || now - lastCameraUpdateTime >= CAMERA_UPDATE_INTERVAL_MS) {
      lastCameraUpdateTime = now;
      map.setView(pos, map.getZoom(), { animate: false });
      const idx = Math.floor(progress * (arc.length - 1));
      progressPolyline.setLatLngs(arc.slice(0, idx + 1).concat([pos]));
    }
  }

  function enterFlightPhase() {
    const route = state.selectedRoute;
    $('#flight-hud').classList.remove('hidden');
    $('#topbar-brand').classList.add('topbar-fade-hidden');
    $('#topbar-stats').classList.add('topbar-fade-hidden');

    // Drop the explore-only recommendation markers/radar circle from the map
    // while tracking -- fewer live layers means less work on every camera update.
    if (map) {
      map.removeLayer(recommendationLayerGroup);
      if (radarCircle) map.removeLayer(radarCircle);
    }

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
    updatePlanePosition(1, true);

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
      map.addLayer(recommendationLayerGroup);
      if (radarCircle) map.addLayer(radarCircle);
    }

    $('#explore-panel').classList.remove('hidden');
    $('#boarding-panel').classList.add('hidden');

    if (state.currentArc) fitMapToRouteAndRadar(state.currentArc, 1.1);
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
            ${purposeTag ? `<span class="history-purpose"><i data-lucide="${purposeTag.icon}" class="w-3 h-3"></i>${purposeTag.label}</span>` : ''}
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

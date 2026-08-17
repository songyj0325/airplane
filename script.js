/* =========================================================
   PomoFlight 3D — Satellite Flight Focus Timer
   ========================================================= */

(() => {
  'use strict';

  /* ---------------------------------------------------------
     Data
  --------------------------------------------------------- */
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
    // Asia / Korea (33, including ICN -- the default departure, but any
    // airport in this file can become the origin via the departure picker)
    ['ICN', 'Seoul', 37.4602, 126.4407],
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

  // Country per IATA code, for the "City, Country" summary display -- kept
  // as a separate lookup (rather than a 5th AIRPORT_DATA column) so the
  // existing coordinate table never has to be touched to add it.
  const COUNTRY_BY_CODE = {
    // North America
    LAX: 'USA', JFK: 'USA', SFO: 'USA', SJC: 'USA', SEA: 'USA', ORD: 'USA',
    MIA: 'USA', DFW: 'USA', ATL: 'USA', BOS: 'USA', LAS: 'USA', DEN: 'USA',
    IAH: 'USA', YVR: 'Canada', YYZ: 'Canada', YUL: 'Canada', MEX: 'Mexico',
    CUN: 'Mexico', PHX: 'USA', IAD: 'USA', EWR: 'USA', MSP: 'USA', DTW: 'USA',
    PHL: 'USA', SAN: 'USA', PDX: 'USA', HNL: 'USA', YYC: 'Canada', YOW: 'Canada',
    GDL: 'Mexico',
    // South America
    GRU: 'Brazil', GIG: 'Brazil', BOG: 'Colombia', EZE: 'Argentina',
    SCL: 'Chile', LIM: 'Peru', UIO: 'Ecuador', SJO: 'Costa Rica',
    LPB: 'Bolivia', MVD: 'Uruguay', CCS: 'Venezuela', PTY: 'Panama',
    ASU: 'Paraguay', GYE: 'Ecuador', CUZ: 'Peru', FOR: 'Brazil',
    // Europe
    LHR: 'United Kingdom', LGW: 'United Kingdom', CDG: 'France', ORY: 'France',
    FRA: 'Germany', MUC: 'Germany', AMS: 'Netherlands', MAD: 'Spain',
    BCN: 'Spain', FCO: 'Italy', MXP: 'Italy', ZRH: 'Switzerland',
    VIE: 'Austria', CPH: 'Denmark', ARN: 'Sweden', OSL: 'Norway',
    HEL: 'Finland', PRG: 'Czech Republic', BUD: 'Hungary', ATH: 'Greece',
    IST: 'Turkey', WAW: 'Poland', DUB: 'Ireland', BRU: 'Belgium',
    GVA: 'Switzerland', LIS: 'Portugal', MAN: 'United Kingdom', EDI: 'United Kingdom',
    OTP: 'Romania', SOF: 'Bulgaria', BEG: 'Serbia', ZAG: 'Croatia',
    LJU: 'Slovenia', KEF: 'Iceland', SVO: 'Russia', LED: 'Russia',
    NCE: 'France', BER: 'Germany', HAM: 'Germany', MLA: 'Malta',
    // Asia / Korea
    ICN: 'South Korea', GMP: 'South Korea', PUS: 'South Korea', CJU: 'South Korea',
    YNY: 'South Korea', TAE: 'South Korea', KWJ: 'South Korea',
    HND: 'Japan', NRT: 'Japan', KIX: 'Japan', NGO: 'Japan', FUK: 'Japan',
    CTS: 'Japan', OKA: 'Japan', PEK: 'China', PVG: 'China', CAN: 'China',
    CTU: 'China', TPE: 'Taiwan', HKG: 'Hong Kong', MFM: 'Macau',
    BKK: 'Thailand', SIN: 'Singapore', KUL: 'Malaysia', SGN: 'Vietnam',
    HAN: 'Vietnam', MNL: 'Philippines', DEL: 'India', BOM: 'India',
    CGK: 'Indonesia', DPS: 'Indonesia', PNH: 'Cambodia', RGN: 'Myanmar',
    // Oceania / Middle East / Africa
    SYD: 'Australia', MEL: 'Australia', BNE: 'Australia', PER: 'Australia',
    AKL: 'New Zealand', CHC: 'New Zealand', DXB: 'United Arab Emirates',
    AUH: 'United Arab Emirates', DOH: 'Qatar', JNB: 'South Africa',
    CPT: 'South Africa', CAI: 'Egypt', CMN: 'Morocco', NBO: 'Kenya',
    ADD: 'Ethiopia', LOS: 'Nigeria', ACC: 'Ghana', TUN: 'Tunisia',
    ALG: 'Algeria', RUH: 'Saudi Arabia', JED: 'Saudi Arabia', AMM: 'Jordan',
    TLV: 'Israel', BAH: 'Bahrain', KWI: 'Kuwait', MCT: 'Oman',
    WLG: 'New Zealand', NAN: 'Fiji', GUM: 'Guam', NOU: 'New Caledonia',
    MRU: 'Mauritius', SEZ: 'Seychelles', DAR: 'Tanzania', HRE: 'Zimbabwe',
    MPM: 'Mozambique', EBB: 'Uganda',
  };
  function countryForCode(code) { return COUNTRY_BY_CODE[code] || ''; }

  const AIRPORTS = AIRPORT_DATA.map(([code, city, lat, lng]) => ({ code, city, lat, lng }));
  function airportByCode(code) { return AIRPORTS.find((a) => a.code === code); }

  // Curated subset offered in the "Select Departure" picker -- major hubs
  // spanning every region, rather than all 150+ (which would make for an
  // unwieldy dropdown). Any of these can become the route origin; every
  // other airport in AIRPORTS becomes a reachable destination from it.
  const DEPARTURE_CODES = [
    'ICN', 'GMP', 'PUS', 'CJU', 'HND', 'NRT', 'KIX', 'PEK', 'PVG', 'TPE',
    'HKG', 'SIN', 'BKK', 'JFK', 'LAX', 'SFO', 'LHR', 'CDG', 'FRA', 'DXB', 'SYD', 'AKL',
  ];

  // Builds the full route set from a given origin airport to every other
  // airport in AIRPORTS -- km/minutes are derived from real coordinates via
  // Haversine, so switching origins keeps the dataset (and the radar circle)
  // mathematically consistent with wherever departure is currently set.
  function buildRoutesFromOrigin(originCode) {
    const origin = airportByCode(originCode);
    const o = [origin.lat, origin.lng];
    return AIRPORTS.filter((a) => a.code !== originCode).map((a) => {
      const d = [a.lat, a.lng];
      const km = Math.round(haversineKm(o, d));
      return {
        origin: originCode, dest: a.code, originCity: origin.city, destCity: a.city,
        o, d, km, minutes: minutesForDistance(km),
      };
    });
  }

  let ROUTES = buildRoutesFromOrigin('ICN');

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

  // Hard ceiling for any camera zoom applied while flight-tracking is
  // active, so the view never pushes into tile levels where ArcGIS
  // World_Imagery coverage gets thin/broken or panning starts to stutter.
  const MAX_FLIGHT_ZOOM = 16;

  function computeFlightZoom(km) {
    return Math.min(MAX_FLIGHT_ZOOM, km < 2000 ? 14 : 13);
  }

  /* ---------------------------------------------------------
     State
  --------------------------------------------------------- */
  const state = {
    originCode: 'ICN',
    selectedRoute: ROUTES.find((r) => r.dest === 'HND') || ROUTES[0],
    selectedSeat: null,
    selectedPurpose: 'work',
    // Filter threshold only -- the Focus Duration ruler no longer sets the
    // Pomodoro timer (that's now always the selected route's real flight
    // time, 100%, at true 1x speed); it just controls which routes are
    // offered as choices. 240m (4h) as a default shows a useful initial
    // spread of destinations without the picker starting empty.
    filterMinutes: 240,
    occupiedSeats: new Set(),
    currentArc: null,
    stats: { totalSeconds: 0, totalKm: 0, flights: 0 }, // recomputed from history by updateStatsSummary() on init
    history: loadHistory(),
    timer: {
      running: false, paused: false, totalSeconds: 0, remainingSeconds: 0, intervalId: null,
      startedAt: null,      // performance.now() when the flight began
      pausedAccum: 0,       // total ms already spent paused
      pauseStartedAt: null, // performance.now() when the current pause began
    },
    audio: { ctx: null, volume: 0.35, activeKind: null },
    hud: { unit: 'km' },
    pureModeActive: false,
    windowViewActive: false,
    windowViewTime: 'morning',
  };

  const FOCUS_TAGS = [
    { id: 'read', label: 'Read', icon: 'book-open' },
    { id: 'exercise', label: 'Exercise', icon: 'dumbbell' },
    { id: 'work', label: 'Work', icon: 'briefcase' },
    { id: 'study', label: 'Study', icon: 'graduation-cap' },
    { id: 'hobby', label: 'Hobby', icon: 'palette' },
  ];
  let ticketMeta = { flightNo: randomFlightNo() };

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

  let toastTimeoutId = null;
  function showToast(message) {
    let el = document.getElementById('app-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'app-toast';
      el.className = 'app-toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('visible');
    clearTimeout(toastTimeoutId);
    toastTimeoutId = setTimeout(() => el.classList.remove('visible'), 3200);
  }

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

  // Derives the header summary bar directly from state.history (the
  // authoritative record) instead of tracking separate running totals --
  // that way a single delete or a full clear can never leave the top bar
  // out of sync with what's actually left in the history list. Recomputing
  // is O(history length, capped at 50) so it's cheap to call on every
  // history mutation.
  function updateStatsSummary() {
    state.stats = state.history.reduce((acc, h) => {
      acc.totalSeconds += h.minutes * 60;
      acc.totalKm += h.km;
      acc.flights += 1;
      return acc;
    }, { totalSeconds: 0, totalKm: 0, flights: 0 });
    persistStats();
    renderStats();
  }

  /* ---------------------------------------------------------
     Map
  --------------------------------------------------------- */
  // CartoDB Dark Matter is the default and the guaranteed fallback landing
  // spot (see attachTileFallback below) -- ArcGIS satellite imagery is more
  // prone to being blocked on strict mobile/in-app-browser network
  // policies (iOS Safari ITP, Instagram/KakaoTalk WebViews), and the old
  // further fallback to plain OpenStreetMap was itself the bug: a bright,
  // non-English-labeled basemap landing on exactly the devices where the
  // satellite layer struggled most. There's no further fallback past dark
  // now, so that can't happen again.
  let map, satelliteLayer, darkLayer, currentMapStyle = 'dark';
  let routeLayerGroup, progressPolyline, remainderPolyline, originMarker, destMarker;
  // Recommendation markers (world airport badges) are explore-only: they're
  // removed from the map entirely during flight so Leaflet isn't repositioning
  // 150+ extra DOM markers on every camera update while tracking. They're
  // also built exactly once and cached by IATA code -- with 150+ of them,
  // destroying and recreating every DOM node on each route selection was
  // the single biggest source of jank, far more than the map pan itself.
  let recommendationLayerGroup;
  const airportMarkerCache = new Map(); // code -> L.Marker

  // Built once from the full airport list (not ROUTES) so the same cache
  // survives a departure change -- only which code is "self" (the origin,
  // hidden) and which fall within the radius changes, never the marker set.
  function ensureAirportBadges() {
    if (airportMarkerCache.size > 0) return;
    AIRPORTS.forEach((a) => {
      const marker = L.marker([a.lat, a.lng], { icon: airportBadgeIcon(a.code), interactive: true }).addTo(recommendationLayerGroup);
      // Looked up against the live ROUTES binding at click time (not
      // captured here) so this keeps working correctly after setOrigin()
      // reassigns ROUTES to a different origin's route set.
      marker.on('click', () => {
        const route = ROUTES.find((r) => r.dest === a.code);
        if (route) selectRoute(route);
      });
      airportMarkerCache.set(a.code, marker);
    });
  }

  function setBadgeHidden(code, hidden) {
    const marker = airportMarkerCache.get(code);
    const el = marker && marker.getElement();
    if (el) el.style.display = hidden ? 'none' : '';
  }

  // Only expose badges for airports that actually fall within the current
  // focus-duration-derived reachable radius -- the map should "unlock" more
  // destinations as the ruler grows (from a couple nearby at 30m to the
  // world's longest real nonstop distances by 19h), instead of showing all
  // 150+ codes at once regardless of the selected duration. The current
  // origin's own badge is always hidden (it gets its own marker via
  // drawRoutePreview instead).
  function updateBadgeVisibility(radiusKm) {
    if (airportMarkerCache.size === 0) return;
    setBadgeHidden(state.originCode, true);
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
  // Unwrapped (can run outside 0-360) so the rotor's CSS transition always
  // takes the shortest turn -- without this, a raw `rotate(rawDeg % 360)`
  // snap across the 0/360 boundary (e.g. 358deg -> 3deg) would spin the
  // icon almost all the way around every time it happens, which is what
  // actually read as violent shaking rather than a calm heading change.
  let lastPlaneBearing = 0;

  function createPlaneMarker(latlng, bearingDeg) {
    if (!map) return;
    removePlaneMarker();
    planeMarker = L.marker(latlng, { icon: planeDivIcon(), zIndexOffset: 1000, interactive: false }).addTo(map);
    lastPlaneBearing = bearingDeg; // fresh baseline -- no transition-in from a stale previous flight's heading
    setPlaneBearing(bearingDeg);
  }

  function setPlaneBearing(bearingDeg) {
    if (!planeMarker) return;
    const el = planeMarker.getElement();
    const rotor = el && el.querySelector('.plane-marker-rotor');
    if (!rotor) return;
    const delta = ((bearingDeg - lastPlaneBearing) % 360 + 540) % 360 - 180; // shortest signed turn, in (-180, 180]
    lastPlaneBearing += delta;
    rotor.style.transform = `rotate(${lastPlaneBearing}deg)`;
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
      // Capped at 16 (not 18) because ocean/open-water tiles run out of
      // real CartoDB coverage before land tiles do -- flight routes cross
      // open sea, so the ceiling has to hold for the emptiest tiles on the
      // route, not just the best-covered ones. Matches darkLayer's
      // maxZoom/maxNativeZoom exactly (16 = 16 = 16) so the interactive map
      // can never reach a zoom level that would need upscaling or an
      // out-of-coverage request.
      maxZoom: 16,
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: false,
    });

    // A failed ArcGIS tile renders as an actual PNG with "Map data not yet
    // available" baked into the pixels (it's a real image, not a 404) --
    // errorTileUrl swaps every failed tile for a transparent pixel instead
    // of letting that text show up on the map.
    const TRANSPARENT_TILE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
      maxZoom: 16, // matches the map's own cap; imagery has real coverage well past this, so no upscaling risk
      maxNativeZoom: 17,
      errorTileUrl: TRANSPARENT_TILE,
    });
    // The forced default: a fixed English-labeled dark basemap, independent
    // of device locale/theme settings, so satellite/mobile/in-app-browser
    // quirks can never leave the user looking at a bright, foreign-labeled
    // map -- this is the layer every fallback path below ultimately lands on.
    //
    // "Map data not yet available" is a genuine 200 OK image with that text
    // baked into the pixels for out-of-coverage requests -- Leaflet's load
    // event fires normally for it (it's a valid PNG), so errorTileUrl/
    // tileerror never see it as a failure to swap out. errorTileUrl still
    // catches true load failures (network/CORS/404), but the only real fix
    // for this specific placeholder is to never request a zoom level past
    // where the server actually has coverage in the first place -- hence
    // maxNativeZoom pinned exactly to the map's own maxZoom (16 = 16) below,
    // so no upscaling and no out-of-coverage request ever happens. 16 (not
    // 18) because open-ocean tiles -- which flight routes cross constantly
    // -- run out of real CartoDB coverage sooner than land tiles do; the
    // cap has to hold for the sparsest tiles on a route, not the densest.
    // URL uses CARTO's canonical rastertiles path (no subdomain-routing
    // quirks); subdomains is kept for correctness even though this
    // particular template has no {s} token to substitute into.
    darkLayer = L.tileLayer('https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      minZoom: 2,
      maxNativeZoom: 16,
      maxZoom: 16,
      // A literal '' is falsy, so Leaflet's own _tileOnError skips setting
      // any fallback src at all and leaves the failed <img> pointed at the
      // broken URL -- which the browser renders as a small broken-image
      // icon, not "no error text". A 1x1 transparent PNG data URI actually
      // achieves what was asked (failed tiles disappear cleanly into the
      // dark #map background below, no error text AND no broken-image
      // icon), so that's used here instead of the literal empty string.
      errorTileUrl: TRANSPARENT_TILE,
    });
    darkLayer.addTo(map);

    // If satellite imagery is broadly unreachable (network/CDN blocked, not
    // just a few missing edge tiles -- more common on strict mobile/in-app
    // browser network policies), fall back to the dark layer automatically
    // rather than leaving the user staring at a blank/broken map. Dark has
    // no further fallback: it's the one layer trusted to always render
    // correctly, so the cascade stops there instead of ever reaching a
    // bright/foreign-language basemap.
    function attachTileFallback(layer, styleWhenActive, nextStyle, errorThreshold) {
      let errorCount = 0;
      let triggered = false;
      layer.on('tileerror', () => {
        errorCount++;
        if (triggered || errorCount < errorThreshold || currentMapStyle !== styleWhenActive) return;
        triggered = true;
        switchMapStyle(nextStyle);
        showToast('지도 타일을 불러오지 못해 다른 지도로 전환했습니다.');
      });
    }
    attachTileFallback(satelliteLayer, 'satellite', 'dark', 8);

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
    const minutes = minutesOverride != null ? minutesOverride : state.filterMinutes;
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

  function styleLayerFor(style) {
    return style === 'satellite' ? satelliteLayer : darkLayer;
  }

  // Shared by the manual toggle button and the automatic tileerror fallback
  // cascade in initMap(), so both paths keep the button's icon/state in sync.
  function switchMapStyle(style) {
    if (!map || style === currentMapStyle) return;
    map.removeLayer(styleLayerFor(currentMapStyle));
    styleLayerFor(style).addTo(map);
    currentMapStyle = style;
    const btn = $('#map-style-toggle');
    if (btn) {
      btn.dataset.active = style === 'dark' ? 'true' : 'false';
      btn.innerHTML = style === 'dark' ? '<i data-lucide="moon" class="w-4 h-4"></i>'
        : '<i data-lucide="satellite" class="w-4 h-4"></i>';
      refreshIcons();
    }
  }

  function initMapStyleToggle() {
    $('#map-style-toggle').addEventListener('click', () => {
      if (!map) return;
      switchMapStyle(currentMapStyle === 'satellite' ? 'dark' : 'satellite');
    });
  }

  /* ---------------------------------------------------------
     Route selection -- a direct destination picker + a summary card,
     replacing the old scrollable "recommended routes" carousel.
  --------------------------------------------------------- */
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
    const destSelect = $('#destination-select');
    if (destSelect) destSelect.value = route.dest;
    updateExploreSummary();
    drawRoutePreview(route);
  }

  // Rebuilds the whole route set around a new departure airport -- every
  // km/minutes figure, the radar radius, and which badges are unlocked all
  // recompute from the new origin's coordinates via the same functions
  // already used for the ICN default, so nothing drifts out of sync.
  function setOrigin(code) {
    if (!code || code === state.originCode) return;
    state.originCode = code;
    ROUTES = buildRoutesFromOrigin(code);
    // Prefer HND if it's within the current filter range, else the first
    // route the filter actually allows, else just the first route overall.
    state.selectedRoute = ROUTES.find((r) => r.dest === 'HND' && r.minutes <= state.filterMinutes)
      || ROUTES.find((r) => r.minutes <= state.filterMinutes)
      || ROUTES[0];
    state.selectedSeat = null;
    state.occupiedSeats = generateOccupiedSeats();
    ticketMeta = { flightNo: randomFlightNo() };
    const select = $('#departure-select');
    if (select) select.value = code;
    renderDestinationSelect();
    updateExploreSummary();
    drawRoutePreview(state.selectedRoute);
  }

  function renderDepartureSelect() {
    const select = $('#departure-select');
    select.innerHTML = '';
    DEPARTURE_CODES.forEach((code) => {
      const airport = airportByCode(code);
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = `${code} — ${airport.city}`;
      select.appendChild(opt);
    });
    select.value = state.originCode;
  }

  function initDepartureSelect() {
    renderDepartureSelect();
    $('#departure-select').addEventListener('change', (e) => setOrigin(e.target.value));
  }

  // Rebuilt whenever the origin OR the Flight Time Filter changes -- the
  // offered destinations are those whose real flight time falls within
  // state.filterMinutes, always including whatever is currently selected
  // (even if a filter change just pushed it outside the range) so the
  // dropdown's displayed value never silently disagrees with state.
  function renderDestinationSelect() {
    const select = $('#destination-select');
    select.innerHTML = '';
    ROUTES.forEach((route) => {
      if (route.minutes > state.filterMinutes && route.dest !== state.selectedRoute.dest) return;
      const opt = document.createElement('option');
      opt.value = route.dest;
      opt.textContent = `${route.dest} — ${route.destCity} (${fmtMinutes(route.minutes)})`;
      select.appendChild(opt);
    });
    select.value = state.selectedRoute.dest;
  }

  function initDestinationSelect() {
    renderDestinationSelect();
    $('#destination-select').addEventListener('change', (e) => {
      const route = ROUTES.find((r) => r.dest === e.target.value);
      if (route) selectRoute(route);
    });
  }

  // Shows only the selected route's essentials -- destination city/country,
  // flight duration, total distance. This flight duration IS the Pomodoro
  // timer's target once booked (see enterFlightPhase()), so it's
  // deliberately independent of the Flight Time Filter ruler -- it never
  // needs to re-render on a ruler change, only on a new route selection.
  function updateExploreSummary() {
    const route = state.selectedRoute;
    const country = countryForCode(route.dest);
    $('#route-summary-city').textContent = country ? `${route.destCity}, ${country}` : route.destCity;
    $('#route-summary-duration').textContent = fmtMinutes(route.minutes);
    $('#route-summary-distance').textContent = `${fmtKm(route.km)} km`;
    refreshIcons();
  }

  /* ---------------------------------------------------------
     Flight Time Filter ruler (horizontal scroll picker, 10m – 19h)
     Purely a search filter now -- it narrows which destinations are
     offered (map badges + the destination dropdown) to routes whose real
     flight time is within the chosen value. It no longer sets the
     Pomodoro timer at all: that's always the selected route's own real
     flight time, at true 1x speed (see enterFlightPhase()).
     19h (1140m) was chosen so the radar radius at max value --
     reachableKmForMinutes(1140) ~= 15,800km -- comfortably covers the
     world's longest real nonstop routes (e.g. SIN-EWR ~15,335km, needing
     ~18.4h; AKL-DOH ~14,534km, needing ~17.5h), so they surface as the
     ruler approaches its ceiling instead of staying permanently excluded.
  --------------------------------------------------------- */
  function buildRulerTickValues() {
    const values = [];
    for (let m = 10; m <= 1140; m += 10) values.push(m); // 10m .. 19h, uniform 10-minute steps
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

  // Single source of truth for "the filter threshold just changed" --
  // applies the value and every dependent side effect (radar radius, badge
  // visibility, the destination dropdown's offered options, camera
  // reframe) immediately and synchronously.
  function applyFilterMinutes(minutes) {
    if (minutes === state.filterMinutes) return;
    state.filterMinutes = minutes;
    updateRadarCircle();
    renderDestinationSelect(); // keep the dropdown's offered choices in sync with the new range
    if (state.currentArc) fitMapToRouteAndRadar(state.currentArc, 1); // reframe so boundary airports stay in view
  }

  function commitFilterMinutes(tickEl) {
    if (!tickEl) return;
    applyFilterMinutes(parseInt(tickEl.dataset.minutes, 10));
  }

  function initDurationRuler() {
    renderDurationRuler();
    const ruler = $('#duration-ruler');
    let commitTimer = null;
    ruler.addEventListener('scroll', () => {
      const nearest = getNearestRulerTick();
      highlightRulerTick(nearest);
      if (nearest) updateRadarCircle(parseInt(nearest.dataset.minutes, 10)); // live radar feedback while dragging
      clearTimeout(commitTimer);
      commitTimer = setTimeout(() => commitFilterMinutes(nearest), 180);
    }, { passive: true });

    const defaultTick = $(`.ruler-tick[data-minutes="${state.filterMinutes}"]`) || $('.ruler-tick');
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

  // Mobile browsers (in-app WebViews like Instagram/KakaoTalk especially,
  // but also Safari/Chrome) block audio that isn't started synchronously
  // inside a user gesture. The takeoff chime and captain's PA only actually
  // fire several setTimeout hops later (ticket tear -> runway zoom -> climb
  // -> enterFlightPhase), well outside that window, which is why they'd
  // silently fail to play on mobile. Both APIs are gesture-scoped rather
  // than call-scoped though: resuming the AudioContext and speaking one
  // silent utterance HERE, synchronously in the click handler, unlocks both
  // for the rest of the page session -- the delayed real calls downstream
  // then just work.
  function unlockMobileAudio() {
    try {
      const ctx = getAudioCtx();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { /* Web Audio unsupported */ }
    try {
      const synth = window.speechSynthesis;
      if (synth) {
        const primer = new SpeechSynthesisUtterance(' ');
        primer.volume = 0.01; // near-silent but nonzero, so engines that
        // short-circuit a literal 0-volume utterance still register it as a
        // real gesture-triggered speak() call
        synth.speak(primer);
      }
    } catch (e) { /* Web Speech unsupported */ }
  }

  // Belt-and-suspenders unlock coverage, since exactly which gesture/event
  // type actually satisfies a given mobile browser's autoplay policy is
  // inconsistent (iOS Safari in particular is known to be more reliable
  // with the raw touchstart than with a synthesized click on touch
  // devices): fires on the very first touch or click ANYWHERE on the page
  // (each only once), and again explicitly on both the "Book My Flight"
  // and "Start Boarding" buttons via both click and touchstart, so no
  // matter which of those the user's browser actually honors, the
  // AudioContext/SpeechSynthesis are unlocked well before the captain's
  // delayed PA announcement actually needs them.
  function initMobileAudioUnlock() {
    document.addEventListener('touchstart', unlockMobileAudio, { once: true, passive: true });
    document.addEventListener('click', unlockMobileAudio, { once: true, passive: true });
    ['#select-seat-btn', '#start-boarding-btn'].forEach((sel) => {
      const el = $(sel);
      if (!el) return;
      el.addEventListener('touchstart', unlockMobileAudio, { passive: true });
      el.addEventListener('click', unlockMobileAudio);
    });
  }

  function beginBoardingDeparture() {
    const checkinBtn = $('#start-boarding-btn');
    const ticket = $('.boarding-pass');
    if (checkinBtn.disabled) return;
    unlockMobileAudio();
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
  const RUNWAY_ZOOM = MAX_FLIGHT_ZOOM;
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
      map.setView(pos, Math.min(map.getZoom(), MAX_FLIGHT_ZOOM), { animate: false });
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

    // The countdown is now 100% the selected route's real flight time, at
    // true 1x speed -- no more speed-scaling to fit an independently-chosen
    // session length. Booking Tokyo (110m real flight time) starts the
    // timer at exactly 1:50:00, counting down in lockstep with the plane's
    // actual progress along the route.
    const totalSeconds = route.minutes * 60;
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

    // A single cabin chime, then the captain's welcome PA -- previously this
    // also fired playTakeoffChime() immediately AND a second ding-dong 1.3s
    // later via announceDeparture(), which is what actually produced the
    // "ding-dong ding-dong" double-chime at every departure.
    announceDeparture();
    scheduleNextPeriodicChime();

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

    // Pure Mode mirrors the same timer/progress values -- kept in sync
    // unconditionally (cheap DOM writes) so the overlay is never stale
    // the instant it's toggled on.
    const pct = Math.round(progress * 100);
    $('#pure-mode-timer').textContent = fmtTimer(state.timer.remainingSeconds);
    $('#pure-mode-timer').classList.toggle('is-paused', state.timer.paused);
    $('#pure-mode-progress-fill').style.width = `${progress * 100}%`;
    $('#pure-mode-plane-icon').style.left = `${progress * 100}%`;
    $('#pure-mode-pct').textContent = pct;

    const remainingKm = Math.max(0, route.km * (1 - progress));
    $('#hud-distance').textContent = fmtKm(toDisplayDistance(remainingKm));
    $('#hud-unit-label').textContent = unit;

    // Window View shows just remaining time + remaining distance, no
    // progress bar -- the window itself is meant to stay unobstructed.
    $('#window-view-timer').textContent = fmtTimer(state.timer.remainingSeconds);
    $('#window-view-distance').textContent = fmtKm(toDisplayDistance(remainingKm));

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
      stopPeriodicChimes();
    } else {
      state.timer.pausedAccum += performance.now() - state.timer.pauseStartedAt;
      state.timer.pauseStartedAt = null;
      startAnimationLoop();
      scheduleNextPeriodicChime();
    }
    $('#pause-btn-label').textContent = state.timer.paused ? 'Resume' : 'Pause';
    $('#pause-icon').classList.toggle('hidden', state.timer.paused);
    $('#play-icon').classList.toggle('hidden', !state.timer.paused);
    // Window View has its own compact pause/play icon toggle, kept in sync
    // with the same state.timer.paused flag.
    $('#window-view-pause-icon').classList.toggle('hidden', state.timer.paused);
    $('#window-view-play-icon').classList.toggle('hidden', !state.timer.paused);
    updateHudText();
  }

  function completeFlight() {
    clearInterval(state.timer.intervalId);
    state.timer.running = false;
    stopAnimationLoop();
    stopPeriodicChimes();
    exitPureMode();
    exitWindowView();
    updatePlanePosition(1, true);

    const route = state.selectedRoute;
    state.history.unshift({
      origin: route.origin,
      dest: route.dest,
      minutes: route.minutes,
      km: route.km,
      seat: state.selectedSeat,
      purpose: state.selectedPurpose,
      dateLabel: todayLabel(),
      timestamp: Date.now(),
    });
    persistHistory();
    updateStatsSummary();

    announceArrival(route);

    $('#landing-desc').textContent = `${fmtKm(route.km)} km 마일리지가 적립되었습니다.`;
    $('#landing-stat-time').textContent = fmtMinutes(route.minutes);
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
    stopPeriodicChimes();
    stopAnnouncements();
    exitPureMode();
    exitWindowView();
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
    const clearAllBtn = $('#history-clear-all-btn');
    if (clearAllBtn) clearAllBtn.disabled = state.history.length === 0;
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
    updateStatsSummary();
  }

  function clearAllHistory() {
    state.history = [];
    persistHistory();
    renderHistory();
    updateStatsSummary();
  }

  function initHistoryModal() {
    const modal = $('#history-modal');
    $('#history-toggle-btn').addEventListener('click', () => {
      renderHistory();
      openModal(modal);
    });
    $('#history-modal-close').addEventListener('click', () => closeModal(modal));
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });

    const clearModal = $('#history-clear-modal');
    $('#history-clear-all-btn').addEventListener('click', () => {
      if (state.history.length === 0) return;
      openModal(clearModal);
    });
    $('#history-clear-cancel-btn').addEventListener('click', () => closeModal(clearModal));
    $('#history-clear-confirm-btn').addEventListener('click', () => {
      clearAllHistory();
      closeModal(clearModal);
    });
    clearModal.addEventListener('click', (e) => { if (e.target === clearModal) closeModal(clearModal); });
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

  function playChimeSequence(notes, peakGain = 0.35) {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = n.freq;
      const t0 = now + n.start;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + n.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + n.dur + 0.05);
    });
  }

  // Fuller three-tone arrival chime, played on landing.
  function playLandingChime() {
    playChimeSequence([
      { freq: 987.77, start: 0.0, dur: 0.55 },
      { freq: 783.99, start: 0.35, dur: 0.7 },
      { freq: 659.25, start: 0.85, dur: 0.9 },
    ]);
  }

  // Single canonical cabin chime -- the same gentle two-tone "ding~dong" a
  // real cabin PA plays exactly once before an announcement: "ding" (C5)
  // rings for 0.5s, then "dong" (G4) enters right as it fades and lingers
  // for 1.2s with its own gain fadeout. Used to precede PA announcements
  // and for the periodic in-flight cabin bell.
  //
  // isChimePlaying is a hard debounce: a stray double-call (e.g. two events
  // firing close together) is dropped rather than layering a second
  // "ding~dong" on top of the first and sounding like "ding-dong ding-dong".
  let isChimePlaying = false;
  const CABIN_CHIME_TOTAL_DURATION_MS = 1750; // 0.5s ding + 1.2s dong + a small settle buffer

  function playCabinChime() {
    if (isChimePlaying) return;
    isChimePlaying = true;
    playChimeSequence([
      { freq: 523.25, start: 0.0, dur: 0.5 }, // C5 -- "ding"
      { freq: 392.00, start: 0.5, dur: 1.2 }, // G4 -- "dong", slow gentle decay
    ], 0.2);
    setTimeout(() => { isChimePlaying = false; }, CABIN_CHIME_TOTAL_DURATION_MS);
  }

  /* ---------------------------------------------------------
     Captain's PA announcements (Web Speech API)
  --------------------------------------------------------- */
  // Checked in priority order against each voice's name/voiceURI -- covers
  // the common male voices across Chrome/Edge (Windows), Safari/Chrome
  // (macOS/iOS), and Android TTS. The last few entries exist specifically
  // for Samsung Internet/Android: that engine's voice list frequently has
  // no gender word anywhere in the display name, so matching has to reach
  // into vendor-specific engine identifiers (which show up in voiceURI,
  // not name) as well as generic short names.
  const PREFERRED_MALE_VOICE_KEYWORDS = [
    'Google UK English Male',
    'Microsoft David',   // Windows classic en-US male
    'Microsoft Guy',     // Edge Natural en-US male
    'Microsoft Mark',    // Windows classic en-US male
    'Microsoft Ryan',    // Edge Natural en-GB male
    'Microsoft Christopher', // Edge Natural en-US male
    'Microsoft Andrew',  // Edge Natural en-US male
    'Microsoft Brian',   // Edge Natural en-US male
    'Daniel',   // macOS/iOS en-GB male
    'Arthur',   // macOS/iOS en-GB male (newer)
    'Oliver',   // macOS/iOS en-GB male (newer)
    'Alex',     // macOS en-US male (classic default)
    'Fred',     // macOS en-US male
    'Aaron',    // Android en-US male
    'Rishi',    // Android en-IN male
    'Male',
    'Guy',
    'David',
    'Google 한국어',
    'ko-KR-language',
    'ko-kr-x-ism',      // Samsung/Android Korean male TTS engine id
    'samsung-ko-kr',
  ];

  // Voices whose name signals female are excluded outright, even if they
  // would otherwise match a preferred keyword above -- this runs first so
  // a female-named voice can never slip through via a coincidental match.
  const EXCLUDED_FEMALE_VOICE_KEYWORDS = ['female', 'woman', '지민', '유미'];

  function isExcludedFemaleVoice(voice) {
    if (!/^(en|ko)/i.test(voice.lang || '')) return false;
    const haystack = `${voice.name || ''} ${voice.voiceURI || ''}`.toLowerCase();
    return EXCLUDED_FEMALE_VOICE_KEYWORDS.some((kw) => haystack.includes(kw.toLowerCase()));
  }

  function pickCaptainVoice(voices) {
    const candidates = voices.filter((v) => !isExcludedFemaleVoice(v));

    for (const keyword of PREFERRED_MALE_VOICE_KEYWORDS) {
      const needle = keyword.toLowerCase();
      const match = candidates.find((v) => `${v.name || ''} ${v.voiceURI || ''}`.toLowerCase().includes(needle));
      if (match) return match;
    }
    const byHeuristic = candidates.find((v) => /^(en|ko)/i.test(v.lang) && /male/i.test(v.name));
    if (byHeuristic) return byHeuristic;
    // Last resort: any candidate voice (female names already excluded
    // above) in the announcement's language family. Deliberately never
    // falls back to the original unfiltered `voices` list -- if every
    // installed voice was excluded as female, returning null (so the
    // browser applies its own utter.lang default) still honors the
    // "strictly exclude" requirement; reaching back into `voices` here
    // would silently undo it.
    const localeMatch = candidates.find((v) => /^(en|ko)/i.test(v.lang));
    return localeMatch || candidates[0] || null;
  }

  // Cached so a Samsung Internet/Android voiceschanged re-fire (that engine
  // loads its voice list asynchronously, sometimes in multiple waves as
  // different TTS packages register) always lands in time for the next
  // announcement instead of racing a synchronous getVoices() call made
  // right before speaking.
  let cachedCaptainVoice = null;

  function refreshCaptainVoice() {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const voices = synth.getVoices();
    if (voices.length > 0) cachedCaptainVoice = pickCaptainVoice(voices);
  }

  // Voice lists load asynchronously in most browsers -- getVoices() can
  // return [] on the very first call. Priming it once at startup (rather
  // than only at announcement time, well after the page has settled) makes
  // it far more likely the male-voice preference below actually has a
  // populated list to search by the time a flight starts. No {once:true}:
  // Samsung Internet/Android can fire voiceschanged more than once as
  // additional voice packages finish registering, and each fire re-checks
  // for a better male match.
  function primeSpeechVoices() {
    const synth = window.speechSynthesis;
    if (!synth) return;
    refreshCaptainVoice();
    synth.addEventListener('voiceschanged', refreshCaptainVoice);
  }

  function speakAnnouncement(text) {
    const synth = window.speechSynthesis;
    if (!synth) return;
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      utter.rate = 0.9;   // slightly slow, deliberate cabin-announcement pace
      utter.pitch = 0.7;  // forced low regardless of which voice loads, for a consistently deep male tone
      utter.volume = Math.max(0.15, state.audio.volume);
      const voice = cachedCaptainVoice || pickCaptainVoice(synth.getVoices());
      if (voice) utter.voice = voice;
      synth.cancel(); // avoid stacking announcements if one is already queued
      synth.speak(utter);
    } catch (e) { /* Web Speech unsupported/blocked -- the chime alone still played */ }
  }

  function stopAnnouncements() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  function announceDeparture() {
    const route = state.selectedRoute;
    playCabinChime();
    setTimeout(() => {
      speakAnnouncement(`Welcome aboard PomoFlight. We are currently flying to our destination, ${route.destCity}. Please sit back, relax, and enjoy your focus session.`);
    }, CABIN_CHIME_TOTAL_DURATION_MS);
  }

  function announceArrival(route) {
    playLandingChime();
    setTimeout(() => {
      speakAnnouncement(`We have arrived at ${route.destCity}. Thank you for flying with PomoFlight, and congratulations on completing your focus session.`);
    }, 1600);
  }

  // Gentle, randomly-spaced cabin bell during the flight -- stops itself as
  // landing approaches so it never overlaps the arrival chime, and pauses
  // cleanly alongside the focus timer.
  let periodicChimeTimeoutId = null;
  function scheduleNextPeriodicChime() {
    clearTimeout(periodicChimeTimeoutId);
    if (!state.timer.running || state.timer.paused) return;
    const remaining = state.timer.totalSeconds - getElapsedMs() / 1000;
    const MIN_GAP_S = 60, MAX_GAP_S = 180, SAFETY_MARGIN_S = 20;
    if (remaining < SAFETY_MARGIN_S + MIN_GAP_S) return; // too close to landing
    const gapS = Math.min(MAX_GAP_S, remaining - SAFETY_MARGIN_S);
    const delayMs = (MIN_GAP_S + Math.random() * Math.max(0, gapS - MIN_GAP_S)) * 1000;
    periodicChimeTimeoutId = setTimeout(() => {
      if (state.timer.running && !state.timer.paused) playCabinChime();
      scheduleNextPeriodicChime();
    }, delayMs);
  }
  function stopPeriodicChimes() {
    clearTimeout(periodicChimeTimeoutId);
    periodicChimeTimeoutId = null;
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
      $('#window-view-sound-btn').dataset.active = 'false';
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
    $('#window-view-sound-btn').dataset.active = 'true';
  }

  function stopAmbient() {
    const audioEl = $('#ambient-audio');
    audioEl.pause();
    state.audio.activeKind = null;
    $('#noise-toggle').dataset.active = 'false';
    $('#window-view-sound-btn').dataset.active = 'false';
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
     Full Screen & Pure Mode
     Pure Mode is a distraction-free overlay (timer + progress + % only)
     shown on top of the flight HUD; entering it also requests real browser
     fullscreen where available, but the overlay itself still works if
     fullscreen is denied/unsupported.
  --------------------------------------------------------- */
  async function enterPureMode() {
    if (state.pureModeActive) return;
    exitWindowView(); // the two full-view overlays are mutually exclusive
    state.pureModeActive = true;
    $('#pure-mode-layer').classList.remove('hidden');
    document.body.classList.add('pure-mode-active');
    updateHudText();
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) { /* fullscreen blocked/unsupported -- pure mode still works windowed */ }
  }

  function exitPureMode() {
    if (!state.pureModeActive) return;
    state.pureModeActive = false;
    $('#pure-mode-layer').classList.add('hidden');
    document.body.classList.remove('pure-mode-active');
    if (document.fullscreenElement) {
      Promise.resolve(document.exitFullscreen()).catch(() => {});
    }
  }

  function togglePureMode() {
    if (state.pureModeActive) exitPureMode(); else enterPureMode();
  }

  function initPureMode() {
    $('#pure-mode-toggle-btn').addEventListener('click', togglePureMode);
    $('#pure-mode-exit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      exitPureMode();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.pureModeActive) exitPureMode();
    });
    // The browser may exit fullscreen on its own (native Esc handling, F11,
    // the "exit fullscreen" bar) before our keydown handler ever fires --
    // this keeps Pure Mode in sync with whatever actually happened.
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && state.pureModeActive) exitPureMode();
    });

    const layer = $('#pure-mode-layer');
    layer.addEventListener('dblclick', () => exitPureMode());
    let lastTapAt = 0;
    layer.addEventListener('touchend', () => {
      const now = Date.now();
      if (now - lastTapAt < 350) exitPureMode();
      lastTapAt = now;
    });
  }

  /* ---------------------------------------------------------
     Window View -- a looping real-video "airplane window" overlay
     (Morning / Daytime / Night), with the same timer/progress readout as
     Pure Mode. Mutually exclusive with Pure Mode since both replace the
     main flight view.
  --------------------------------------------------------- */
  function setWindowViewTime(time) {
    if (time !== 'morning' && time !== 'daytime' && time !== 'night') return;
    state.windowViewTime = time;
    $$('.window-view-time-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.time === time));
    $$('.window-view-video').forEach((video) => {
      const isActive = video.dataset.time === time;
      video.classList.toggle('hidden', !isActive);
      if (isActive) {
        video.muted = true; // belt-and-suspenders alongside the muted attribute, for autoplay eligibility
        video.play().catch(() => { /* still shows the frame; browser may just be deferring playback */ });
      } else {
        video.pause();
      }
    });
  }

  function enterWindowView() {
    if (state.windowViewActive) return;
    exitPureMode(); // the two full-view overlays are mutually exclusive
    state.windowViewActive = true;
    $('#window-view-layer').classList.remove('hidden');
    document.body.classList.add('window-view-active');
    setWindowViewTime(state.windowViewTime);
    // The compact pause icon reflects whatever the timer's paused state
    // already was -- entering Window View doesn't itself change it.
    $('#window-view-pause-icon').classList.toggle('hidden', state.timer.paused);
    $('#window-view-play-icon').classList.toggle('hidden', !state.timer.paused);
    updateHudText();
  }

  function exitWindowView() {
    if (!state.windowViewActive) return;
    state.windowViewActive = false;
    $('#window-view-layer').classList.add('hidden');
    document.body.classList.remove('window-view-active');
    $$('.window-view-video').forEach((video) => video.pause());
  }

  function toggleWindowView() {
    if (state.windowViewActive) exitWindowView(); else enterWindowView();
  }

  function initWindowView() {
    $('#window-view-toggle-btn').addEventListener('click', toggleWindowView);
    $('#window-view-close-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      exitWindowView();
    });
    $('#window-view-pause-btn').addEventListener('click', togglePause);
    $('#window-view-sound-btn').addEventListener('click', () => {
      if (state.audio.activeKind) stopAmbient(); else playAmbient('airplane');
    });
    // "Mode switch" -- hop directly into Pure Mode without dropping back to
    // the map first; enterPureMode() already exits Window View for us.
    $('#window-view-mode-btn').addEventListener('click', enterPureMode);
    $$('.window-view-time-btn').forEach((btn) => {
      btn.addEventListener('click', () => setWindowViewTime(btn.dataset.time));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.windowViewActive) exitWindowView();
    });
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
    // Recompute (rather than just render) on load so any stats totals
    // persisted before this sync fix -- e.g. left stale by a delete that
    // predates updateStatsSummary() -- self-heal against the history that's
    // actually still there.
    updateStatsSummary();

    state.occupiedSeats = generateOccupiedSeats();
    initDepartureSelect();
    initDestinationSelect();
    initDurationRuler();
    updateExploreSummary();
    drawRoutePreview(state.selectedRoute);

    initSeatModal();
    initFocusModal();
    initHistoryModal();
    initAmbientSound();
    initIFE();
    initFlightControls();
    initMapStyleToggle();
    initPureMode();
    initWindowView();
    initMobileAudioUnlock();
    primeSpeechVoices();

    refreshIcons();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

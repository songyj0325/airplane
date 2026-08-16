/* =========================================================
   PomoFlight — Premium Pomodoro Flight Timer
   ========================================================= */

(() => {
  'use strict';

  /* ---------------------------------------------------------
     Data
  --------------------------------------------------------- */
  const ROUTES = [
    { origin: 'ICN', dest: 'HND', originCity: 'Seoul',  destCity: 'Tokyo',    minutes: 135, km: 1200 },
    { origin: 'PUS', dest: 'OKA', originCity: 'Busan',  destCity: 'Okinawa',  minutes: 91,  km: 1004 },
    { origin: 'ICN', dest: 'CJU', originCity: 'Seoul',  destCity: 'Jeju',     minutes: 65,  km: 450  },
    { origin: 'ICN', dest: 'CDG', originCity: 'Seoul',  destCity: 'Paris',    minutes: 750, km: 8900 },
    { origin: 'ICN', dest: 'JFK', originCity: 'Seoul',  destCity: 'New York', minutes: 840, km: 11000 },
    { origin: 'ICN', dest: 'LHR', originCity: 'Seoul',  destCity: 'London',   minutes: 790, km: 8850 },
  ];

  const STORAGE_STATS = 'pomoflight.stats.v1';
  const STORAGE_HISTORY = 'pomoflight.history.v1';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------------------------------------------------------
     State
  --------------------------------------------------------- */
  const state = {
    selectedRoute: ROUTES[1], // default PUS -> OKA as pictured in spec
    stats: loadStats(),
    history: loadHistory(),
    timer: {
      running: false,
      paused: false,
      totalSeconds: 0,
      remainingSeconds: 0,
      intervalId: null,
    },
    audio: {
      ctx: null,
      noiseNodes: null,
      noiseOn: false,
      volume: 0.35,
    },
  };

  function loadStats() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_STATS));
      if (raw && typeof raw === 'object') {
        return {
          totalSeconds: raw.totalSeconds || 0,
          totalKm: raw.totalKm || 0,
          flights: raw.flights || 0,
        };
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

  function persistStats() {
    localStorage.setItem(STORAGE_STATS, JSON.stringify(state.stats));
  }
  function persistHistory() {
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(state.history.slice(0, 50)));
  }

  /* ---------------------------------------------------------
     Icon refresh helper
  --------------------------------------------------------- */
  function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
  }

  /* ---------------------------------------------------------
     Formatting helpers
  --------------------------------------------------------- */
  function fmtMinutes(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }
  function fmtSecondsAsClock(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    const mm = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = Math.floor(s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  }
  function fmtHoursTotal(totalSeconds) {
    const totalMin = Math.floor(totalSeconds / 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h ${m}m`;
  }
  function fmtKm(km) {
    return Math.round(km).toLocaleString('en-US');
  }
  function todayLabel() {
    const d = new Date();
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }
  function randomSeat() {
    const row = Math.floor(Math.random() * 30) + 1;
    const letters = 'ABCDEF';
    return `${row}${letters[Math.floor(Math.random() * letters.length)]}`;
  }
  function randomFlightNo() {
    return `PF-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  // Stable per-selection ticket metadata (regenerated only on route change)
  let ticketMeta = { seat: randomSeat(), flightNo: randomFlightNo() };

  /* ---------------------------------------------------------
     Rendering: Header stats
  --------------------------------------------------------- */
  function renderStats() {
    $('#stat-total-time').textContent = fmtHoursTotal(state.stats.totalSeconds);
    $('#stat-mileage').innerHTML = `${fmtKm(state.stats.totalKm)} <span class="text-xs sm:text-sm font-semibold text-slate-400">km</span>`;
    $('#stat-flights').textContent = state.stats.flights;
  }

  /* ---------------------------------------------------------
     Rendering: Route cards
  --------------------------------------------------------- */
  function renderRouteCards() {
    const grid = $('#route-grid');
    const tpl = $('#route-card-template');
    grid.innerHTML = '';
    ROUTES.forEach((route) => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.querySelector('.rc-origin').textContent = route.origin;
      node.querySelector('.rc-dest').textContent = route.dest;
      node.querySelector('.route-card-cities').textContent = `${route.originCity} → ${route.destCity}`;
      node.querySelector('.rc-duration span').textContent = fmtMinutes(route.minutes);
      node.querySelector('.rc-distance span').textContent = `${fmtKm(route.km)} km`;
      if (isSameRoute(route, state.selectedRoute)) node.classList.add('selected');
      node.addEventListener('click', () => selectRoute(route));
      grid.appendChild(node);
    });
    refreshIcons();
  }

  function isSameRoute(a, b) {
    if (!a || !b) return false;
    return a.origin === b.origin && a.dest === b.dest && a.minutes === b.minutes && a.km === b.km;
  }

  function selectRoute(route) {
    state.selectedRoute = route;
    ticketMeta = { seat: randomSeat(), flightNo: randomFlightNo() };
    renderRouteCards();
    renderBoardingPass($('#ticket-wrap'));
  }

  /* ---------------------------------------------------------
     Rendering: Boarding pass
  --------------------------------------------------------- */
  function buildBoardingPassNode(route) {
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
    node.querySelector('.bp-seat').textContent = ticketMeta.seat;
    node.querySelector('.bp-date').textContent = todayLabel();
    node.querySelector('.bp-stub-origin').textContent = route.origin;
    node.querySelector('.bp-stub-dest').textContent = route.dest;

    return node;
  }

  function renderBoardingPass(container) {
    container.innerHTML = '';
    container.appendChild(buildBoardingPassNode(state.selectedRoute));
    refreshIcons();
  }

  /* ---------------------------------------------------------
     Custom Flight Modal
  --------------------------------------------------------- */
  function openModal(el) { el.classList.remove('hidden'); }
  function closeModal(el) { el.classList.add('hidden'); }

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
      const km = Math.round(minutes * 7.4); // stylized distance-per-minute constant for custom flights

      const route = { origin, dest, originCity, destCity, minutes, km, custom: true };
      state.selectedRoute = route;
      ticketMeta = { seat: randomSeat(), flightNo: randomFlightNo() };
      renderRouteCards();
      renderBoardingPass($('#ticket-wrap'));
      closeModal(modal);
      $('#ticket-wrap').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  /* ---------------------------------------------------------
     Flight History Modal
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
          <div class="history-route">${h.origin} → ${h.dest}</div>
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
     Clouds animation (window view)
  --------------------------------------------------------- */
  function spawnClouds() {
    const layer = $('#cloud-layer');
    layer.innerHTML = '';
    const count = 6;
    for (let i = 0; i < count; i++) {
      const cloud = document.createElement('div');
      cloud.className = 'cloud';
      const size = 40 + Math.random() * 70;
      const top = Math.random() * 70;
      const duration = 14 + Math.random() * 16;
      const delay = -Math.random() * duration;
      cloud.style.width = `${size}px`;
      cloud.style.height = `${size * 0.4}px`;
      cloud.style.top = `${top}%`;
      cloud.style.left = '100%';
      cloud.style.opacity = (0.5 + Math.random() * 0.4).toFixed(2);
      cloud.style.animation = `cloudDrift ${duration}s linear ${delay}s infinite`;
      layer.appendChild(cloud);
    }
    if (!document.getElementById('cloud-keyframes')) {
      const style = document.createElement('style');
      style.id = 'cloud-keyframes';
      style.textContent = `
        @keyframes cloudDrift {
          from { transform: translateX(0); }
          to { transform: translateX(-160vw); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /* ---------------------------------------------------------
     Web Audio: Cabin white noise
  --------------------------------------------------------- */
  function getAudioCtx() {
    if (!state.audio.ctx) {
      state.audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (state.audio.ctx.state === 'suspended') state.audio.ctx.resume();
    return state.audio.ctx;
  }

  function startCabinNoise() {
    const ctx = getAudioCtx();
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    // Pink-ish noise via Paul Kellet's refined method for a warm engine-hum texture
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
    hum.frequency.value = 82; // low engine hum
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

    state.audio.noiseNodes = { noiseSource, hum, masterGain, lowpass, humGain };
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
    setTimeout(() => {
      try { noiseSource.stop(); hum.stop(); } catch (e) { /* already stopped */ }
    }, 450);
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
    // Classic two/three-tone "ding-dong" cabin chime synthesized via sine oscillators
    const notes = [
      { freq: 987.77, start: 0.0, dur: 0.55 },   // B5
      { freq: 783.99, start: 0.35, dur: 0.7 },   // G5
      { freq: 659.25, start: 0.85, dur: 0.9 },   // E5
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
    const toggleBtn = $('#noise-toggle');
    const volumeSlider = $('#noise-volume');
    setNoiseVolume(parseInt(volumeSlider.value, 10) / 100);

    toggleBtn.addEventListener('click', () => {
      const active = toggleBtn.dataset.active === 'true';
      if (active) {
        stopCabinNoise();
        toggleBtn.dataset.active = 'false';
        toggleBtn.textContent = 'OFF';
      } else {
        startCabinNoise();
        toggleBtn.dataset.active = 'true';
        toggleBtn.textContent = 'ON';
      }
    });

    volumeSlider.addEventListener('input', (e) => {
      setNoiseVolume(parseInt(e.target.value, 10) / 100);
    });
  }

  /* ---------------------------------------------------------
     In-flight Entertainment (YouTube)
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
    const toggleBtn = $('#ife-toggle');
    const body = $('#ife-body');
    const loadBtn = $('#youtube-load-btn');
    const input = $('#youtube-url-input');
    const placeholder = $('#ife-screen-placeholder');
    const mount = $('#ife-player-mount');

    toggleBtn.addEventListener('click', () => {
      const active = toggleBtn.dataset.active === 'true';
      if (active) {
        body.classList.add('hidden');
        toggleBtn.dataset.active = 'false';
        toggleBtn.textContent = 'CLOSED';
      } else {
        body.classList.remove('hidden');
        toggleBtn.dataset.active = 'true';
        toggleBtn.textContent = 'OPEN';
      }
    });

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
    const colors = ['#FF2A85', '#00F0FF', '#FFD700', '#ffffff', '#c4137a'];
    const count = 50;
    for (let i = 0; i < count; i++) {
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
     Flight timer / focus mode
  --------------------------------------------------------- */
  function enterFocusMode() {
    renderBoardingPass($('#focus-ticket-wrap'));
    $('#rp-origin-code').textContent = state.selectedRoute.origin;
    $('#rp-dest-code').textContent = state.selectedRoute.dest;

    $('#selection-view').classList.add('hidden');
    $('#focus-view').classList.remove('hidden');
    $('#focus-view').scrollIntoView({ behavior: 'smooth', block: 'start' });

    spawnClouds();
    setDayNightForRoute(state.selectedRoute);

    const totalSeconds = state.selectedRoute.minutes * 60;
    state.timer.totalSeconds = totalSeconds;
    state.timer.remainingSeconds = totalSeconds;
    state.timer.running = true;
    state.timer.paused = false;

    updateTimerUI();
    updateProgressUI();

    clearInterval(state.timer.intervalId);
    state.timer.intervalId = setInterval(tickTimer, 1000);

    refreshIcons();
  }

  function setDayNightForRoute(route) {
    const sky = $('#window-sky');
    const longHaul = route.minutes >= 300;
    sky.classList.toggle('is-night', longHaul);
    $('#altitude-readout').textContent = longHaul ? 'ALT 11,900m · Cruising' : 'ALT 9,800m · Cruising';
  }

  function tickTimer() {
    if (state.timer.paused) return;
    state.timer.remainingSeconds -= 1;
    if (state.timer.remainingSeconds <= 0) {
      state.timer.remainingSeconds = 0;
      updateTimerUI();
      updateProgressUI();
      completeFlight();
      return;
    }
    updateTimerUI();
    updateProgressUI();
  }

  function updateTimerUI() {
    $('#timer-display').textContent = fmtSecondsAsClock(state.timer.remainingSeconds);
    $('#timer-display').classList.toggle('is-paused', state.timer.paused);
    $('#timer-status').textContent = state.timer.paused
      ? 'Holding pattern · Paused'
      : 'On schedule · Cruising altitude';
  }

  function updateProgressUI() {
    const total = state.timer.totalSeconds || 1;
    const elapsed = total - state.timer.remainingSeconds;
    const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
    $('#route-progress-fill').style.width = `${pct}%`;
    $('#route-progress-plane').style.left = `${pct}%`;
    $('#progress-percent').textContent = `${Math.round(pct)}%`;

    const remainingKm = Math.max(0, Math.round(state.selectedRoute.km * (1 - pct / 100)));
    $('#distance-remaining').textContent = `${fmtKm(remainingKm)} km remaining`;
  }

  function togglePause() {
    if (!state.timer.running) return;
    state.timer.paused = !state.timer.paused;
    $('#pause-btn-label').textContent = state.timer.paused ? 'Resume' : 'Pause';
    $('#pause-icon').classList.toggle('hidden', state.timer.paused);
    $('#play-icon').classList.toggle('hidden', !state.timer.paused);
    updateTimerUI();
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

  function exitFocusMode() {
    clearInterval(state.timer.intervalId);
    state.timer.running = false;
    state.timer.paused = false;
    if (state.audio.noiseOn) {
      stopCabinNoise();
      $('#noise-toggle').dataset.active = 'false';
      $('#noise-toggle').textContent = 'OFF';
    }
    $('#focus-view').classList.add('hidden');
    $('#selection-view').classList.remove('hidden');
    $('#selection-view').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function initFlightControls() {
    $('#start-flight-btn').addEventListener('click', enterFocusMode);
    $('#pause-btn').addEventListener('click', togglePause);

    $('#abort-btn').addEventListener('click', () => openModal($('#abort-modal')));
    $('#abort-cancel-btn').addEventListener('click', () => closeModal($('#abort-modal')));
    $('#abort-confirm-btn').addEventListener('click', () => {
      closeModal($('#abort-modal'));
      exitFocusMode();
    });

    $('#landing-close-btn').addEventListener('click', () => {
      closeModal($('#landing-modal'));
      exitFocusMode();
    });
  }

  /* ---------------------------------------------------------
     Init
  --------------------------------------------------------- */
  function init() {
    renderStats();
    renderRouteCards();
    renderBoardingPass($('#ticket-wrap'));
    initCustomFlightModal();
    initHistoryModal();
    initCabinAudio();
    initIFE();
    initFlightControls();
    refreshIcons();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
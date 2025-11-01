// 3D viewer wiring for EduAR Net
const models = [
  { id: 'pushup', label: 'Push Up', src: 'assets/models/pushup.glb' },
  { id: 'squat', label: 'Squat', src: 'assets/models/squat.glb' }
];

// Per-model default transforms (used when no saved transform exists).
// panX/panY are pixels applied to the viewer translate; positive X -> move right, positive Y -> move down.
// Adjust these values if a model's origin/bounding box causes it to appear off-center.
const modelDefaults = {
  'assets/models/pushup.glb': { panX: 0, panY: 0, scale: 0.6 },
  // Squat tends to be shifted left/up in the source GLB; nudge it right/down to match pushup visual.
  'assets/models/squat.glb': { panX: 0, panY: 0, scale: 0.6 }
};

// Per-model camera-orbit defaults (azimuth elevation radius). Radius controls perceived size.
const modelOrbit = {
  'assets/models/pushup.glb': '0deg 60deg 2m',
  'assets/models/squat.glb': '0deg 60deg 2m'
};

const viewer = document.getElementById('modelViewer');
const select = document.getElementById('model-select');
const rotateToggle = document.getElementById('rotate-toggle');
const fsBtn = document.getElementById('fullscreen');
// cameraToggle removed from UI (camera starts automatically)
const cameraToggle = document.getElementById('camera-toggle');
const cameraOverlay = document.getElementById('camera-overlay');
const cameraVideo = document.getElementById('cameraVideo');
let cameraStream = null;
let originalParent = null;
let originalNextSibling = null;
let originalHasControls = false;
// in-camera transform state
let panX = 0; // px
let panY = 0; // px
let scale = 1;
// small Y offset applied only when viewer is displayed in-camera so overlayed model sits slightly higher
const inCameraYOffset = -18;
let dragging = false;
let dragStart = null;
let initialPinch = null;
let currentModelSrc = null;

function saveTransformForModel(src) {
  if (!src) return;
  try {
    const key = `eduar:transform:${src}`;
    const data = { panX, panY, scale };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) { /* ignore storage errors */ }
}

function loadTransformForModel(src) {
  if (!src) return null;
  try {
    const key = `eduar:transform:${src}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (typeof obj.panX === 'number') panX = obj.panX;
    if (typeof obj.panY === 'number') panY = obj.panY;
    if (typeof obj.scale === 'number') scale = obj.scale;
    return obj;
  } catch (e) { return null; }
}

function setModel(src) {
  if (!viewer) {
    console.error('Model viewer not found');
    return;
  }
  console.log('Setting model source:', src);
  
  // show spinner
  const spinner = document.getElementById('model-spinner');
  if (spinner) {
    spinner.classList.remove('hidden');
  }
  
  // Reset viewer state
  viewer.classList.remove('hidden');
  viewer.style.opacity = '1';
  viewer.style.visibility = 'visible';
  
  // Optimize loading
  viewer.dismissPoster();
  viewer.loading = 'eager';
  viewer.preload = true;
  viewer.reveal = 'interaction';
  
  // Progressive loading - start with low quality
  viewer.renderScale = 0.5;
  
  // save transform for previous model
  if (typeof currentModelSrc !== 'undefined' && currentModelSrc) saveTransformForModel(currentModelSrc);
  viewer.src = src;
  currentModelSrc = src;
  // Try to load any previously saved transform for this model. If none exists,
  // reset pan/scale to sensible defaults so the model appears centered
  // (this ensures models like 'squat' start centered like 'pushup').
  const _saved = loadTransformForModel(src);
  if (!_saved) {
    const def = modelDefaults[src] || { panX: 0, panY: 0, scale: 0.8 };
    panX = def.panX;
    panY = def.panY;
    scale = def.scale;
  }
  // enable smooth auto-rotate by default when selecting a model
  viewer.setAttribute('auto-rotate', '');
  viewer.setAttribute('rotation-per-second', '30deg');
  // always allow user rotation with smooth controls
  viewer.setAttribute('camera-controls', '');
  viewer.setAttribute('interaction-prompt', 'none');
  viewer.setAttribute('camera-target', '0 0 0');
  // center model, set FOV/zoom for proportional size
  // per-model orbit (controls perceived size)
  const orbit = modelOrbit[src] || '0deg 75deg 2.5m';
  viewer.setAttribute('camera-orbit', orbit);
  viewer.setAttribute('field-of-view', '30deg');
  viewer.setAttribute('animation-name', '*');
  viewer.setAttribute('autoplay', '');
  // fade out before loading
  viewer.classList.remove('visible');
  // If the viewer is not in 'in-camera' mode, clear any inline transform
  // that might have been applied when the viewer was used in AR mode.
  // This ensures the model appears centered inside the guide card.
  if (!viewer.classList.contains('in-camera')) {
    viewer.style.transform = '';
    // reset any inline opacity/transition left from entrance animation
    viewer.style.opacity = '';
    viewer.style.transition = '';
  }
}

// Initialize default model
if (select && viewer) {
  // populate select from models array (authoritative source: assets/models)
  select.innerHTML = models.map(m => `<option value="${m.src}">${m.label}</option>`).join('');
  // set default
  const first = select.value || models[0].src;
  setModel(first);

  select.addEventListener('change', (e) => {
    setModel(e.target.value);
    // after selecting a model, try to load saved transform so it appears where user left it
    loadTransformForModel(e.target.value);
    applyInCameraTransform();
  });
}

// --- Exercise controls: repetitions and stopwatch ---
const repBtn = document.getElementById('rep-btn');
const scoreRepsEl = document.getElementById('score-reps');
const scoreMainEl = document.getElementById('score-main');
const swStart = document.getElementById('sw-start');
const swStop = document.getElementById('sw-stop');
const swReset = document.getElementById('sw-reset');
const swDisplay = document.getElementById('stopwatch');

let reps = 0;
let score = 0;

if (repBtn) {
  repBtn.addEventListener('click', () => {
    reps += 1;
    // dummy scoring: +10 per rep
    score += 10;
    if (scoreRepsEl) scoreRepsEl.textContent = String(reps);
    if (scoreMainEl) scoreMainEl.textContent = String(score);
    // start stopwatch automatically on first rep
    if (swTimer.running === false) swTimer.start();
  });
}

// Simple stopwatch
const swTimer = (function () {
  let startTs = 0;
  let elapsed = 0; // ms
  let timerId = null;
  let running = false;

  function format(ms) {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const sec = (totalSec % 60).toString().padStart(2, '0');
    const dec = Math.floor((ms % 1000) / 100).toString();
    return `${min}:${sec}.${dec}`;
  }

  function tick() {
    const now = Date.now();
    const diff = elapsed + (running ? now - startTs : 0);
    if (swDisplay) swDisplay.textContent = format(diff);
  }

  return {
    start() {
      if (running) return;
      startTs = Date.now();
      running = true;
      timerId = setInterval(tick, 100);
    },
    stop() {
      if (!running) return;
      elapsed += Date.now() - startTs;
      running = false;
      clearInterval(timerId);
      timerId = null;
      tick();
    },
    reset() {
      startTs = Date.now();
      elapsed = 0;
      if (!running) {
        if (swDisplay) swDisplay.textContent = format(0);
      }
    },
    get running() { return running; }
  };
})();

if (swStart) swStart.addEventListener('click', () => swTimer.start());
if (swStop) swStop.addEventListener('click', () => swTimer.stop());
if (swReset) swReset.addEventListener('click', () => swTimer.reset());

if (rotateToggle && viewer) {
  const updateRotateButton = () => {
    const isRotating = viewer.hasAttribute('auto-rotate');
    rotateToggle.setAttribute('aria-pressed', isRotating ? 'true' : 'false');
    rotateToggle.textContent = isRotating ? 'Jeda' : 'Putar';
  };

  rotateToggle.addEventListener('click', () => {
    const current = viewer.hasAttribute('auto-rotate');
    if (current) viewer.removeAttribute('auto-rotate');
    else viewer.setAttribute('auto-rotate', '');
    // small timeout to ensure attribute change is reflected
    setTimeout(() => {
      updateRotateButton();
      // pause or play GLB animations when user toggles
      try {
        if (viewer.hasAttribute('auto-rotate')) {
          // resume animations
          typeof viewer.play === 'function' && viewer.play();
        } else {
          // pause animations
          typeof viewer.pause === 'function' && viewer.pause();
        }
      } catch (e) { /* ignore */ }
    }, 30);
  });

  // initialize button label to current viewer state
  updateRotateButton();
}

if (fsBtn && viewer) {
  fsBtn.addEventListener('click', async () => {
    try {
      if (viewer.requestFullscreen) await viewer.requestFullscreen();
    } catch (err) {
      console.warn('Fullscreen not supported', err);
    }
  });
}

// Camera (scan) functions
async function startCamera() {
  const spinner = document.getElementById('model-spinner');
  spinner.classList.remove('hidden');

  if (!navigator.mediaDevices || !cameraVideo) {
    console.error('Camera or media devices not available');
    alert('Kamera tidak tersedia di perangkat ini');
    spinner.classList.add('hidden');
    return;
  }

  try {
    console.log('Requesting camera permission...');
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }, 
      audio: false 
    });
    
    console.log('Camera permission granted, starting stream...');
    cameraVideo.srcObject = stream;
    cameraStream = stream;
    
    // Wait for video to be ready
    await new Promise((resolve) => {
      cameraVideo.onloadedmetadata = () => {
        console.log('Video metadata loaded');
        resolve();
      };
    });
    
    // show camera overlay and 3D model overlay controls
    if (cameraOverlay) {
      cameraOverlay.classList.remove('hidden');
      console.log('Camera overlay visible');
    }
    
    // ensure model viewer is visible and flagged as in-camera
    if (viewer) {
      console.log('Setting up model viewer...');
      viewer.classList.remove('hidden'); // Make sure viewer is visible
      viewer.classList.add('in-camera');
      
      // Force reload current model
      if (currentModelSrc) {
        console.log('Reloading current model:', currentModelSrc);
        setModel(currentModelSrc);
      } else {
        console.log('Loading default model');
        const defaultModel = 'assets/models/pushup.glb';
        setModel(defaultModel);
      }
      
      // show overlay element
      const modelOverlay = document.querySelector('.model-overlay');
      if (modelOverlay) {
        console.log('Showing model overlay');
        modelOverlay.classList.remove('hidden');
        modelOverlay.style.opacity = '1';
        modelOverlay.style.visibility = 'visible';
        // trigger entrance animation classes
        modelOverlay.classList.add('entrance');
        setTimeout(() => {
          modelOverlay.classList.add('animate-in');
          modelOverlay.classList.remove('entrance');
        }, 30);
      } else {
        console.error('Model overlay not found');
      }
      const controls = document.getElementById('camera-model-controls');
      controls && controls.classList.remove('hidden');
      if (controls) controls.removeAttribute('aria-hidden');
      // enable direct interactions on the overlay (drag/zoom) while in-camera
      attachInteractionHandlers();
    }
  } catch (err) {
    console.warn('Camera access denied atau tidak tersedia', err);
    throw err;
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  cameraVideo && (cameraVideo.srcObject = null);
  // hide camera overlay and model overlay controls
  cameraOverlay?.classList.add('hidden');
  if (viewer) {
    viewer.classList.remove('in-camera');
    const modelOverlay = document.querySelector('.model-overlay');
    if (modelOverlay) {
      modelOverlay.classList.add('hidden');
      modelOverlay.classList.remove('animate-in');
      modelOverlay.classList.remove('entrance');
    }
    const controls = document.getElementById('camera-model-controls');
    controls && controls.classList.add('hidden');
    if (controls) controls.setAttribute('aria-hidden', 'true');
    // disable interactions when leaving camera
    detachInteractionHandlers();
  }
}

if (cameraToggle) {
  cameraToggle.addEventListener('click', async () => {
    const spinner = document.getElementById('model-spinner');
    const overlay = document.getElementById('camera-overlay');
    
    if (overlay && overlay.classList.contains('hidden')) {
      try {
        spinner.classList.remove('hidden');
        await startCamera();
        
        // Show camera overlay
        overlay.classList.remove('hidden');
        
        // Show model controls
        const controls = document.getElementById('camera-model-controls');
        if (controls) {
          controls.classList.remove('hidden');
          controls.removeAttribute('aria-hidden');
        }
        
        // Update button text
        cameraToggle.textContent = 'Matikan Kamera AR';
        
        // Load initial model
        if (currentModelSrc) {
          setModel(currentModelSrc);
        } else if (models.length > 0) {
          setModel(models[0].src);
        }
        
      } catch (error) {
        console.error('Camera start error:', error);
        alert('Tidak dapat mengakses kamera. Pastikan izin kamera diaktifkan.');
        spinner.classList.add('hidden');
      }
    } else {
      stopCamera();
      cameraToggle.textContent = 'Aktifkan Kamera AR';
      overlay.classList.add('hidden');
    }
  });
}

// Keyboard navigation: left/right to switch models
window.addEventListener('keydown', (ev) => {
  if (!select) return;
  if (ev.key === 'ArrowRight') {
    select.selectedIndex = (select.selectedIndex + 1) % select.options.length;
    select.dispatchEvent(new Event('change'));
  } else if (ev.key === 'ArrowLeft') {
    select.selectedIndex = (select.selectedIndex - 1 + select.options.length) % select.options.length;
    select.dispatchEvent(new Event('change'));
  }
});

// Pause auto-rotate when tab is hidden
document.addEventListener('visibilitychange', () => {
  if (!viewer) return;
  if (document.hidden) viewer.removeAttribute('auto-rotate');
  else viewer.setAttribute('auto-rotate', '');
});

// Small accessibility: announce loaded model
viewer?.addEventListener('load', () => {
  console.log('Model loaded successfully');
  const label = select?.selectedOptions?.[0]?.text || 'model';
  viewer.setAttribute('alt', `3D model: ${label}`);
  
  // hide spinner when model ready
  const spinner = document.getElementById('model-spinner');
  spinner && spinner.classList.add('hidden');
  
  // Make sure model is visible
  viewer.classList.remove('hidden');
  viewer.style.opacity = '1';
  viewer.style.visibility = 'visible';
  
  // fade in model smoothly
  setTimeout(() => {
    viewer.classList.add('visible');
    console.log('Model visible');
    
    // Gradually increase quality after load
    setTimeout(() => {
      viewer.renderScale = 0.75;
      console.log('Increasing render quality to 75%');
      setTimeout(() => {
        viewer.renderScale = 1;
        console.log('Increasing render quality to 100%');
      }, 1000);
    }, 500);
  }, 60);

  // center and animate entrance when a model finishes loading in-camera
  if (viewer.classList.contains('in-camera')) {
    // if we have stored transform for this model, load it (overrides center)
    loadTransformForModel(currentModelSrc || viewer.src);
    // small delay to ensure DOM updates
    setTimeout(() => doEntranceAnimation(), 60);
  }
});

// Add error handling
viewer?.addEventListener('error', (error) => {
  console.error('Error loading model:', error);
  const spinner = document.getElementById('model-spinner');
  spinner && spinner.classList.add('hidden');
  alert('Gagal memuat model 3D. Silakan periksa koneksi internet Anda dan coba lagi.');
});

// Add progress monitoring
viewer?.addEventListener('progress', (event) => {
  console.log(`Loading progress: ${event.detail.totalProgress * 100}%`);
});

// 3D Guide toggle
const guideToggle = document.getElementById('guide-toggle');
const guideContent = document.getElementById('guide-content');
if (guideToggle && guideContent) {
  guideToggle.addEventListener('click', () => {
    if (guideContent.style.display === 'none') {
      guideContent.style.display = '';
      guideToggle.textContent = 'Nonaktifkan 3D Guide';
    } else {
      guideContent.style.display = 'none';
      guideToggle.textContent = 'Aktifkan 3D Guide';
    }
  });
  // Default: show guide
  guideContent.style.display = '';
  guideToggle.textContent = 'Nonaktifkan 3D Guide';
}

// zoom controls removed (buttons were deleted from HTML)

// handle load errors gracefully
viewer?.addEventListener('error', (ev) => {
  console.error('Model viewer error:', ev);
  const spinner = document.getElementById('model-spinner');
  spinner && spinner.classList.add('hidden');
  // simple user feedback
  try {
    alert('Gagal memuat model 3D. Periksa file .glb di folder assets/models/ atau buka console untuk detil.');
  } catch (e) {
    // ignore if alert not available
  }
});

// Apply current pan/scale transform to viewer when in camera
function applyInCameraTransform() {
  if (!viewer) return;
  // base offset translate(-50%,-50%) then apply pan and scale
  const yOffset = viewer.classList.contains('in-camera') ? inCameraYOffset : 0;
  // compute effective panY including the in-camera offset
  const effectivePanY = panY + yOffset;
  viewer.style.transform = `translate(calc(-50% + ${panX}px), calc(-50% + ${effectivePanY}px)) scale(${scale})`;
}

// Interaction handlers: drag to pan, wheel to zoom, pinch to zoom
function attachInteractionHandlers() {
  if (!viewer) return;
  viewer.style.touchAction = 'none';

  const onPointerDown = (e) => {
    dragging = true;
    dragStart = { x: e.clientX, y: e.clientY, panX, panY };
    viewer.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging || !dragStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    panX = dragStart.panX + dx;
    panY = dragStart.panY + dy;
    applyInCameraTransform();
  };

  const onPointerUp = (e) => {
    dragging = false;
    dragStart = null;
  };

  const onWheel = (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    scale = Math.min(3, Math.max(0.3, scale + delta));
    applyInCameraTransform();
  };

  // touch pinch handlers
  let ongoingTouches = [];
  const getDistance = (t1, t2) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const onTouchStart = (e) => {
    if (e.touches && e.touches.length === 2) {
      initialPinch = { dist: getDistance(e.touches[0], e.touches[1]), scale };
    }
  };
  const onTouchMove = (e) => {
    if (e.touches && e.touches.length === 2 && initialPinch) {
      const dist = getDistance(e.touches[0], e.touches[1]);
      const factor = dist / initialPinch.dist;
      scale = Math.min(3, Math.max(0.3, initialPinch.scale * factor));
      applyInCameraTransform();
    }
  };
  const onTouchEnd = (e) => { initialPinch = null; };

  viewer._ar_handlers = { onPointerDown, onPointerMove, onPointerUp, onWheel, onTouchStart, onTouchMove, onTouchEnd };

  viewer.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  viewer.addEventListener('wheel', onWheel, { passive: false });
  viewer.addEventListener('touchstart', onTouchStart, { passive: true });
  viewer.addEventListener('touchmove', onTouchMove, { passive: true });
  viewer.addEventListener('touchend', onTouchEnd, { passive: true });
}

function detachInteractionHandlers() {
  if (!viewer || !viewer._ar_handlers) return;
  const h = viewer._ar_handlers;
  viewer.removeEventListener('pointerdown', h.onPointerDown);
  window.removeEventListener('pointermove', h.onPointerMove);
  window.removeEventListener('pointerup', h.onPointerUp);
  viewer.removeEventListener('wheel', h.onWheel);
  viewer.removeEventListener('touchstart', h.onTouchStart);
  viewer.removeEventListener('touchmove', h.onTouchMove);
  viewer.removeEventListener('touchend', h.onTouchEnd);
  viewer._ar_handlers = null;
  viewer.style.touchAction = '';
}

// Entrance animation: animate from slightly above and scaled down to centered full size
function doEntranceAnimation() {
  if (!viewer || !viewer.classList.contains('in-camera')) return;
  // prepare: stop any existing transition
  viewer.style.transition = 'none';
  // start state: slightly higher and smaller and transparent
  viewer.style.opacity = '0';
  viewer.style.transform = `translate(-50%,-60%) scale(${0.8})`;
  // force reflow
  // eslint-disable-next-line no-unused-expressions
  viewer.getBoundingClientRect();
  // animate to centered state
  viewer.style.transition = 'transform 380ms cubic-bezier(.2,.9,.3,1), opacity 320ms ease';
  // set pan/scale target
  applyInCameraTransform();
  viewer.style.opacity = '1';
  // cleanup after transition
  const onEnd = () => {
    viewer.removeEventListener('transitionend', onEnd);
    // small overshoot: scale slightly larger then settle back
    const tx = `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px))`;
    const overshoot = Math.min(1.12, (scale || 1) * 1.06);
    viewer.style.transition = 'transform 160ms ease';
    viewer.style.transform = `${tx} scale(${overshoot})`;
    setTimeout(() => {
      viewer.style.transition = 'transform 140ms ease';
      viewer.style.transform = `${tx} scale(${scale})`;
      setTimeout(() => { viewer.style.transition = ''; }, 170);
    }, 160);
  };
  viewer.addEventListener('transitionend', onEnd);
}

// No auto-start camera on load for fitness app

// save transform on unload
window.addEventListener('beforeunload', () => {
  try { saveTransformForModel(currentModelSrc || viewer?.src); } catch (e) { }
});

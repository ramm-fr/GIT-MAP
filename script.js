import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const gsap = window.gsap;

const state = {
  events: [],
  pulseGroups: [],
  latestToastTimer: null
};
window.state = state;

const els = {
  loadingScreen: document.getElementById('loading-screen'),
  sceneContainer: document.getElementById('scene-container'),
  totalEvents: document.getElementById('total-events'),
  pushCount: document.getElementById('push-count'),
  liveIndicator: document.getElementById('live-indicator'),
  feedPanel: document.getElementById('feed-panel'),
  feedItems: document.getElementById('feed-items'),
  refreshFeedButton: document.getElementById('refresh-feed'),
  closeFeedButton: document.getElementById('close-feed'),
  eventToast: document.getElementById('event-toast')
};

const eventColors = {
  PushEvent: '#dcdde1',
  PullRequestEvent: '#d3d6dc',
  WatchEvent: '#e3e5ea',
  IssueEvent: '#e5e7ec',
  ReleaseEvent: '#d6d8de',
  CreateEvent: '#d1d4db',
  DeleteEvent: '#c9cbd1',
  PublicEvent: '#d6d8de',
  RepositoryEvent: '#d4d6dc',
  ForkEvent: '#d0d3da',
  default: '#f3f4f7'
};

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x040816, 0.045);
window.scene = scene;
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
camera.position.set(0, 0, 5.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
els.sceneContainer.appendChild(renderer.domElement);


function resizeRenderer() {
  const width = Math.max(1, els.sceneContainer.clientWidth);
  const height = Math.max(1, els.sceneContainer.clientHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

// (resizeObserver already initialized above)

resizeRenderer();

const resizeObserver = new ResizeObserver(() => resizeRenderer());
resizeObserver.observe(els.sceneContainer);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.24;
controls.enablePan = false;
controls.enableZoom = true;
controls.zoomSpeed = 1.45;
controls.minDistance = 0.35;
controls.maxDistance = 15.0;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.14;
controls.rotateSpeed = 0.75;

const earthGroup = new THREE.Group();
scene.add(earthGroup);

const ambient = new THREE.AmbientLight(0xffffff, 0.72);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.05);
keyLight.position.set(4.5, 4.5, 2.5);
scene.add(keyLight);

const rimLight = new THREE.PointLight(0xffffff, 0.35, 18, 2);
rimLight.position.set(-4.2, 2.0, -2.2);
scene.add(rimLight);

const starField = new THREE.Points(
  new THREE.BufferGeometry(),
  new THREE.PointsMaterial({ color: 0xffffff, size: 0.01, transparent: true, opacity: 0.18 })
);
const starPositions = [];
for (let i = 0; i < 1600; i += 1) {
  const radius = 18 + Math.random() * 20;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  starPositions.push(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi)
  );
}
starField.geometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
scene.add(starField);

const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(1.23, 64, 64),
  new THREE.MeshBasicMaterial({ color: 0x233040, transparent: true, opacity: 0.0, side: THREE.BackSide })
);
earthGroup.add(atmosphere);

const modelGroup = new THREE.Group();
earthGroup.add(modelGroup);
window.modelGroup = modelGroup;
const buildingTargets = [];

const loader = new GLTFLoader();
const modelUrl = `./city_test.glb?v=${Date.now()}`;
loader.load(modelUrl, (gltf) => {
  const root = gltf.scene;
  modelGroup.clear();
  modelGroup.add(root);

  const bbox = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const maxDimension = Math.max(size.x, size.y, size.z);
  const scale = maxDimension > 0 ? 2.8 / maxDimension : 1;
  root.scale.setScalar(scale);

  const center = new THREE.Vector3();
  bbox.getCenter(center);
  root.position.sub(center.multiplyScalar(scale));
  root.rotation.set(0, 0.4, 0);
  root.updateWorldMatrix(true, true);

  buildingTargets.length = 0;
  root.traverse((child) => {
    if (child.isMesh && /building|roof/i.test(child.name)) {
      const box = new THREE.Box3().setFromObject(child);
      if (!box.isEmpty()) {
        const top = new THREE.Vector3(
          (box.min.x + box.max.x) * 0.5,
          box.max.y,
          (box.min.z + box.max.z) * 0.5
        );
        modelGroup.worldToLocal(top);
        buildingTargets.push({ position: top, height: box.max.y - box.min.y });
      }
    }
  });
  window.buildingTargets = buildingTargets;

  animateEarthMaterial(root);
  els.loadingScreen.classList.add('hidden');
  setTimeout(() => {
    els.loadingScreen.style.display = 'none';
  }, 500);
}, undefined, (error) => {
  console.error('Model load failed', error);
  showToast('The map failed to load — using fallback view.');
  if (els.loadingScreen) {
    els.loadingScreen.classList.add('hidden');
    setTimeout(() => {
      els.loadingScreen.style.display = 'none';
    }, 500);
  }
});

function animateEarthMaterial(object) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.material = child.material instanceof Array ? child.material : child.material;
      if (child.material) {
        child.material.color?.set(0x9aa0a8);
        child.material.emissive?.set(0xdfe2e6);
        child.material.emissiveIntensity = 0.08;
        child.material.roughness = 0.92;
        child.material.metalness = 0.08;
        if ('vertexColors' in child.material) {
          child.material.vertexColors = false;
        }
      }
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function latLonToVector3(lat, lon, radius = 1.12) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function createPulse(event) {
  const color = eventColors[event.type] || eventColors.default;
  const target = buildingTargets.length ? buildingTargets[Math.floor(Math.random() * buildingTargets.length)] : null;
  const position = target ? target.position.clone() : latLonToVector3(
    event.location?.lat ?? ((event.id % 180) - 90) + (event.actor?.login?.length || 0) % 7,
    event.location?.lon ?? (((event.id * 13) % 360) - 180) + (event.repo?.name?.length || 0) % 5,
    1.12
  );

  const group = new THREE.Group();
  group.position.copy(position);
  modelGroup.add(group);

  // Hide 3D visuals: marker, ring, particles and light are created but kept invisible
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 16, 16),
    new THREE.MeshBasicMaterial({ color: '#f8f9fa', transparent: true, opacity: 0.0 })
  );
  marker.position.set(0, 0.015, 0);
  marker.visible = false;
  group.add(marker);

  const lineLength = target ? Math.max(0.16, Math.min(0.32, target.height * 0.75)) : 0.28;
  const lineGeo = new THREE.CylinderGeometry(0.0036, 0.0036, lineLength, 10, 1);
  const lineMat = new THREE.MeshBasicMaterial({ color: '#f8f9fa', transparent: true, opacity: 0.0 });
  const line = new THREE.Mesh(lineGeo, lineMat);
  line.position.set(0, lineLength * 0.5 + 0.015, 0);
  line.visible = false;
  group.add(line);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.05, 0.007, 10, 48),
    new THREE.MeshBasicMaterial({ color: '#f8f9fa', transparent: true, opacity: 0.0 })
  );
  ring.position.y = 0.015;
  ring.rotation.copy(new THREE.Euler(Math.PI / 2, 0, 0));
  ring.visible = false;
  group.add(ring);

  const particles = new THREE.Group();
  particles.visible = false;
  group.add(particles);

  const pointLight = new THREE.PointLight(color, 0, 0, 2);
  pointLight.intensity = 0;
  group.add(pointLight);

  state.pulseGroups.push({ group, marker, ring, particles, pointLight, createdAt: performance.now(), duration: 1800, color });

  // Only show actor name (no type) per request
  const label = document.createElement('div');
  label.className = 'event-badge';
  label.textContent = `${event.actor?.login || 'unknown'}`;
  label.style.pointerEvents = 'none';
  els.sceneContainer.appendChild(label);
  state.pulseGroups[state.pulseGroups.length - 1].label = label;

  // subtle pop (no glow)
  gsap.fromTo(group.scale, { x: 0.98, y: 0.98, z: 0.98 }, { x: 1, y: 1, z: 1, duration: 0.45, ease: 'power3.out' });
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  earthGroup.rotation.y += 0.0012;
  starField.rotation.y += 0.00018;
  starField.rotation.x += 0.00002;

  const now = performance.now();
  state.pulseGroups = state.pulseGroups.filter((pulse) => {
    const age = now - pulse.createdAt;
    const alive = age < pulse.duration;
    if (!alive) {
      earthGroup.remove(pulse.group);
      if (pulse.label) pulse.label.remove();
    } else {
      const progress = age / pulse.duration;
      pulse.group.scale.setScalar(1 + Math.sin(progress * Math.PI * 2) * 0.02);
      pulse.group.rotation.y += 0.015;
      pulse.particles.rotation.z += 0.025;
      if (pulse.label) {
        const pos = pulse.group.getWorldPosition(new THREE.Vector3());
        pos.project(camera);
        const x = (pos.x * 0.5 + 0.5) * els.sceneContainer.clientWidth;
        const y = (pos.y * -0.5 + 0.5) * els.sceneContainer.clientHeight;
        pulse.label.style.left = `${x}px`;
        pulse.label.style.top = `${y}px`;
        pulse.label.style.opacity = `${1 - progress}`;
      }
    }
    return alive;
  });

  renderer.render(scene, camera);
}

function setupUI() {
  window.addEventListener('resize', () => resizeRenderer());
  if (els.refreshFeedButton) {
    els.refreshFeedButton.addEventListener('click', refreshFeed);
  }
  if (els.closeFeedButton) {
    els.closeFeedButton.addEventListener('click', closeFeedPanel);
  }
  // open-feed button wiring
  els.openFeedButton = document.getElementById('open-feed');
  if (els.openFeedButton) {
    els.openFeedButton.addEventListener('click', openFeedPanel);
  }
  // profile panel elements
  els.profilePanel = document.getElementById('profile-panel');
  els.profileAvatar = document.getElementById('profile-avatar');
  els.profileName = document.getElementById('profile-name');
  els.profileLogin = document.getElementById('profile-login');
  els.profileBio = document.getElementById('profile-bio');
  els.profileFollowers = document.getElementById('profile-followers');
  els.profileFollowing = document.getElementById('profile-following');
  els.profileLink = document.getElementById('profile-link');
  const closeProfileBtn = document.getElementById('close-profile');
  if (closeProfileBtn) closeProfileBtn.addEventListener('click', () => { if (els.profilePanel) els.profilePanel.classList.remove('show'); });
}

// Raycast and selection handling: click to find nearest event label or building
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
function onSceneClick(e) {
  const rect = els.sceneContainer.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  // First try to find nearest label DOM element
  let nearest = null;
  let nearestDist = 1e9;
  document.querySelectorAll('.event-badge').forEach((el) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2 - rect.left;
    const cy = r.top + r.height / 2 - rect.top;
    const dx = cx - x;
    const dy = cy - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < nearestDist) { nearestDist = d; nearest = el; }
  });
  if (nearest && nearestDist < 80) {
    const login = nearest.textContent.trim();
    openProfileFor(login);
    return;
  }

  // fallback: raycast into scene to find approximate building point
  mouse.x = (x / rect.width) * 2 - 1;
  mouse.y = -(y / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(modelGroup, true);
  if (intersects.length) {
    const point = intersects[0].point;
    // find nearest pulse group by world position
    let nearestPulse = null;
    let nd = 1e9;
    state.pulseGroups.forEach((p) => {
      const wp = p.group.getWorldPosition(new THREE.Vector3());
      const d = wp.distanceTo(point);
      if (d < nd) { nd = d; nearestPulse = p; }
    });
    if (nearestPulse && nd < 0.6) {
      const login = nearestPulse.label?.textContent?.trim();
      if (login) { openProfileFor(login); return; }
    }
  }
  showToast('No user associated with that selection.');
}
els.sceneContainer.addEventListener('click', onSceneClick, { passive: true });

async function openProfileFor(login) {
  if (!login) return showToast('No user found.');
  try {
    if (els.profilePanel) els.profilePanel.classList.add('show');
    if (els.profileAvatar) els.profileAvatar.src = '';
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}`);
    if (!res.ok) throw new Error('User not found');
    const data = await res.json();
    if (els.profileAvatar) els.profileAvatar.src = data.avatar_url || '';
    if (els.profileName) els.profileName.textContent = data.name || data.login || login;
    if (els.profileLogin) els.profileLogin.textContent = `@${data.login}`;
    if (els.profileBio) els.profileBio.textContent = data.bio || '';
    if (els.profileFollowers) els.profileFollowers.textContent = `${data.followers} followers`;
    if (els.profileFollowing) els.profileFollowing.textContent = `${data.following} following`;
    if (els.profileLink) { els.profileLink.href = data.html_url || `https://github.com/${login}`; els.profileLink.textContent = 'View on GitHub'; }
  } catch (err) {
    console.error(err);
    showToast('Could not load GitHub profile.');
  }
}

async function refreshFeed() {
  showToast('Refreshing activity feed...');
  await fetchEvents();
}

function closeFeedPanel() {
  if (els.feedPanel) {
    els.feedPanel.classList.add('closed');
    if (els.openFeedButton) els.openFeedButton.classList.add('show');
  }
}

function openFeedPanel() {
  if (els.feedPanel) {
    els.feedPanel.classList.remove('closed');
    if (els.openFeedButton) els.openFeedButton.classList.remove('show');
  }
}

function showToast(message) {
  els.eventToast.textContent = message;
  els.eventToast.classList.add('show');
  clearTimeout(state.latestToastTimer);
  state.latestToastTimer = window.setTimeout(() => els.eventToast.classList.remove('show'), 2200);
}

async function fetchEvents() {
  try {
    let data = null;
    // Try local proxy first (for hosted backends). If it fails, fall back to public GitHub API.
    try {
      const response = await fetch('/api/events?per_page=12');
      if (response.ok) {
        data = await response.json();
      } else {
        throw new Error(`Local proxy returned ${response.status}`);
      }
    } catch (localErr) {
      console.warn('Local /api/events failed, falling back to public GitHub API.', localErr);
      const ghResp = await fetch('https://api.github.com/events?per_page=12');
      if (ghResp.ok) {
        data = await ghResp.json();
      } else {
        // If public API fails (rate limit or network), use local fallback JSON packaged with the site
        console.warn('Public GitHub API failed, attempting local fallback JSON.', ghResp.status);
        try {
          const fallbackResp = await fetch('/events_fallback.json');
          if (fallbackResp.ok) {
            data = await fallbackResp.json();
          } else {
            throw new Error(`Fallback JSON not available ${fallbackResp.status}`);
          }
        } catch (fbErr) {
          throw new Error(`GitHub API error ${ghResp.status}`);
        }
      }
    }

    state.events = Array.isArray(data) ? data.filter((item) => item && item.type) : [];
    renderEvents(true);
    els.liveIndicator.textContent = '●';
    els.liveIndicator.style.color = '#e7e9ec';
    // If events loaded successfully, ensure loading screen is hidden so UI is usable
    if (els.loadingScreen && !els.loadingScreen.classList.contains('hidden')) {
      els.loadingScreen.classList.add('hidden');
      setTimeout(() => { els.loadingScreen.style.display = 'none'; }, 500);
    }
  } catch (error) {
    console.error(error);
    showToast('GitHub data is temporarily unavailable.');
    els.liveIndicator.textContent = '●';
    els.liveIndicator.style.color = '#dcdde1';
  }
}

function renderEvents(animatePulse = false) {
  const topEvents = state.events.slice(0, 8);
  if (animatePulse && topEvents.length) {
    topEvents.forEach((event, index) => {
      window.setTimeout(() => createPulse(event), index * 220);
    });
  }
  els.totalEvents.textContent = topEvents.length;
  els.pushCount.textContent = topEvents.filter((event) => event.type === 'PushEvent').length;

  if (els.feedItems) {
    els.feedItems.innerHTML = topEvents.map((event) => {
      const repo = event.repo?.name || 'unknown';
      const actor = event.actor?.login || 'unknown';
      const message = event.payload?.commits?.[0]?.message || event.payload?.pull_request?.title || event.type;
      const time = new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `
        <a class="feed-item" href="https://github.com/${actor}" target="_blank" rel="noreferrer">
          <div class="feed-meta">${time} · ${event.type}</div>
          <strong>${actor}</strong>
          <div class="feed-meta">${repo}</div>
          <div class="feed-meta">${message}</div>
        </a>
      `;
    }).join('');
  }
}

setupUI();
animate();
fetchEvents();
setInterval(fetchEvents, 8000);

// Safety: if loading-screen remains visible after several seconds, hide it so the UI is usable
window.setTimeout(() => {
  try {
    if (els.loadingScreen && !els.loadingScreen.classList.contains('hidden')) {
      els.loadingScreen.classList.add('hidden');
      setTimeout(() => {
        els.loadingScreen.style.display = 'none';
      }, 500);
      showToast('Loading timed out — continuing without the 3D model.');
    }
  } catch (e) {
    // ignore
  }
}, 6000);

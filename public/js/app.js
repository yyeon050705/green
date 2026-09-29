/* 대상지 반경 토지용도·시설 분석 대시보드 - 프런트엔드 로직 (OpenStreetMap 전용)
 * - 지도/검색: Leaflet + OpenStreetMap 타일 + Nominatim(서버 프록시)
 * - 주변 시설 & 토지이용: OpenStreetMap Overpass API (서버 프록시)
 */

const SERIES_COLORS = [
  'var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)',
  'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)',
];
// Chart.js는 CSS 변수를 직접 못 읽으므로 실제 계산값을 읽어 사용한다.
function resolveColor(varExpr) {
  const name = varExpr.replace('var(', '').replace(')', '');
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const FACILITY_GROUPS = [
  { key: 'amenity', label: '편의/공공시설' },
  { key: 'shop', label: '상업시설' },
  { key: 'leisure', label: '레저/여가' },
  { key: 'tourism', label: '관광' },
  { key: 'healthcare', label: '의료' },
  { key: 'office', label: '업무/사무' },
  { key: 'craft', label: '공방/제조' },
];

// OSM landuse=* 값에 대한 한글 표기 (없는 값은 원문 태그를 그대로 보여준다)
const LANDUSE_LABELS = {
  residential: '주거',
  commercial: '상업',
  retail: '상업(소매)',
  industrial: '공업',
  farmland: '농경지',
  farmyard: '농경지(농가)',
  orchard: '과수원',
  forest: '산림',
  meadow: '초지',
  grass: '녹지',
  cemetery: '묘지',
  religious: '종교부지',
  education: '교육시설',
  recreation_ground: '체육/여가부지',
  construction: '공사장',
  brownfield: '유휴지',
  greenfield: '개발예정지',
  allotments: '텃밭',
  garages: '차고지',
  quarry: '채석장',
  military: '군사시설',
  railway: '철도부지',
};

const state = {
  center: null, // {lat, lon}
  radius: 750,
  facilityLayer: null,
  landuseLayer: null,
  circleLayer: null,
  markerLayer: null,
  lastFacilities: [],
  lastLanduseFeatures: [],
};

// ---------- 초기화 ----------
const map = L.map('map').setView([37.5665, 126.9780], 12); // 기본: 서울시청 부근
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

state.facilityLayer = L.layerGroup().addTo(map);
state.landuseLayer = L.layerGroup().addTo(map);

map.on('click', (e) => setTarget(e.latlng.lat, e.latlng.lng));

function setTarget(lat, lon) {
  state.center = { lat, lon };
  document.getElementById('targetCoord').textContent =
    `선택된 좌표: ${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  document.getElementById('analyzeBtn').disabled = false;

  if (state.markerLayer) map.removeLayer(state.markerLayer);
  state.markerLayer = L.marker([lat, lon]).addTo(map);

  drawRadiusCircle();
  map.setView([lat, lon], Math.max(map.getZoom(), 15));
}

function drawRadiusCircle() {
  if (!state.center) return;
  if (state.circleLayer) map.removeLayer(state.circleLayer);
  state.circleLayer = L.circle([state.center.lat, state.center.lon], {
    radius: state.radius,
    color: resolveColor('var(--series-1)'),
    weight: 2,
    fillOpacity: 0.05,
  }).addTo(map);
}

// ---------- 검색 ----------
document.getElementById('searchBtn').addEventListener('click', doSearch);
document.getElementById('searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch();
});

async function doSearch() {
  const q = document.getElementById('searchInput').value.trim();
  const list = document.getElementById('searchResults');
  list.innerHTML = '';
  if (!q) return;
  try {
    const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    if (!data.length) {
      list.innerHTML = '<li>검색 결과가 없습니다.</li>';
      return;
    }
    data.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item.display_name;
      li.addEventListener('click', () => {
        setTarget(parseFloat(item.lat), parseFloat(item.lon));
        list.innerHTML = '';
        document.getElementById('searchInput').value = item.display_name;
      });
      list.appendChild(li);
    });
  } catch (err) {
    list.innerHTML = `<li>검색 실패: ${escapeHtml(err.message)}</li>`;
  }
}

// ---------- 반경 슬라이더 ----------
const radiusRange = document.getElementById('radiusRange');
radiusRange.addEventListener('input', () => {
  state.radius = parseInt(radiusRange.value, 10);
  document.getElementById('radiusValue').textContent = `${state.radius} m`;
  drawRadiusCircle();
});

document.getElementById('themeToggle').addEventListener('click', () => {
  const root = document.documentElement;
  const current = root.getAttribute('data-theme');
  root.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
  drawRadiusCircle();
});

// ---------- 탭 ----------
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const isFacility = btn.dataset.tab === 'facility';
    document.getElementById('facilityTable').classList.toggle('hidden', !isFacility);
    document.getElementById('landuseTable').classList.toggle('hidden', isFacility);
  });
});

// ---------- 분석 실행 ----------
document.getElementById('analyzeBtn').addEventListener('click', runAnalysis);
document.getElementById('exportBtn').addEventListener('click', exportGeoJson);

async function runAnalysis() {
  if (!state.center) return;
  setStatus('분석 중... (OpenStreetMap Overpass API 조회)', false);
  document.getElementById('analyzeBtn').disabled = true;

  const { lat, lon } = state.center;

  const [facilityResult, landuseResult] = await Promise.allSettled([
    fetchFacilities(lat, lon, state.radius),
    fetchLanduse(lat, lon, state.radius),
  ]);

  if (facilityResult.status === 'fulfilled') {
    renderFacilities(facilityResult.value);
  } else {
    console.error(facilityResult.reason);
    setStatus(`OSM 시설 조회 실패: ${facilityResult.reason.message}`, true);
  }

  if (landuseResult.status === 'fulfilled') {
    renderLanduse(landuseResult.value);
  } else {
    console.error(landuseResult.reason);
    const msg = landuseResult.reason.message || '알 수 없는 오류';
    const prev = document.getElementById('statusMsg').textContent;
    setStatus(`${prev ? prev + ' / ' : ''}OSM 토지이용 조회 실패: ${msg}`, true);
  }

  if (facilityResult.status === 'fulfilled' && landuseResult.status === 'fulfilled') {
    setStatus('분석 완료', false);
  }
  document.getElementById('analyzeBtn').disabled = false;
  document.getElementById('exportBtn').disabled = false;
}

function setStatus(msg, isError) {
  const el = document.getElementById('statusMsg');
  el.textContent = msg;
  el.classList.toggle('error', isError);
}

// ---------- OSM Overpass: 주변 시설 (점 형태) ----------
async function fetchFacilities(lat, lon, radius) {
  const keys = FACILITY_GROUPS.map((g) => g.key);
  const clauses = keys
    .map((k) => `node(around:${radius},${lat},${lon})["${k}"];\n  way(around:${radius},${lat},${lon})["${k}"];`)
    .join('\n  ');
  const query = `[out:json][timeout:25];\n(\n  ${clauses}\n);\nout center tags;`;

  const data = await callOverpass(query);
  const elements = data.elements || [];
  return elements.map((el) => {
    const p = el.type === 'node' ? { lat: el.lat, lon: el.lon } : el.center;
    const tags = el.tags || {};
    const group = FACILITY_GROUPS.find((g) => tags[g.key]);
    const distance = p ? turf.distance([lon, lat], [p.lon, p.lat], { units: 'meters' }) : null;
    return {
      id: `${el.type}/${el.id}`,
      name: tags.name || tags['name:ko'] || '(이름 없음)',
      groupKey: group ? group.key : 'etc',
      groupLabel: group ? group.label : '기타',
      tagValue: group ? tags[group.key] : '',
      lat: p ? p.lat : null,
      lon: p ? p.lon : null,
      distance,
    };
  }).filter((f) => f.lat != null);
}

function renderFacilities(facilities) {
  state.lastFacilities = facilities;
  state.facilityLayer.clearLayers();

  facilities.forEach((f) => {
    const colorVar = SERIES_COLORS[FACILITY_GROUPS.findIndex((g) => g.key === f.groupKey)] || 'var(--text-muted)';
    const marker = L.circleMarker([f.lat, f.lon], {
      radius: 6,
      color: resolveColor(colorVar),
      fillColor: resolveColor(colorVar),
      fillOpacity: 0.85,
      weight: 1,
    }).bindPopup(`<b>${escapeHtml(f.name)}</b><br>${escapeHtml(f.groupLabel)} · ${escapeHtml(f.tagValue)}<br>${Math.round(f.distance)} m`);
    state.facilityLayer.addLayer(marker);
  });

  document.getElementById('statFacilityCount').textContent = facilities.length;

  // 그룹별 집계
  const counts = FACILITY_GROUPS.map((g) => facilities.filter((f) => f.groupKey === g.key).length);
  renderBarChart('facilityChart', FACILITY_GROUPS.map((g) => g.label), counts, SERIES_COLORS, '시설 수');
  renderLegend('facilityLegend', FACILITY_GROUPS.map((g, i) => ({ label: g.label, color: SERIES_COLORS[i] })));

  // 테이블
  const tbody = document.querySelector('#facilityTable tbody');
  tbody.innerHTML = '';
  facilities
    .slice()
    .sort((a, b) => a.distance - b.distance)
    .forEach((f) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(f.name)}</td><td>${escapeHtml(f.groupLabel)}(${escapeHtml(f.tagValue)})</td><td>${Math.round(f.distance)}</td>`;
      tbody.appendChild(tr);
    });
}

// ---------- OSM Overpass: 토지이용 (면 형태, landuse=*) ----------
async function fetchLanduse(lat, lon, radius) {
  const query = `[out:json][timeout:25];\n(\n  way(around:${radius},${lat},${lon})["landuse"];\n);\nout geom;`;
  const data = await callOverpass(query);
  const elements = data.elements || [];

  return elements
    .filter((el) => el.type === 'way' && Array.isArray(el.geometry) && el.geometry.length >= 4)
    .map((el) => {
      const coords = el.geometry.map((pt) => [pt.lon, pt.lat]);
      const first = coords[0];
      const last = coords[coords.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) coords.push(first); // 폴리곤 링 닫기
      return {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coords] },
        properties: { landuse: el.tags.landuse, name: el.tags.name || null, osm_id: el.id },
      };
    });
}

async function callOverpass(query) {
  const r = await fetch('/api/overpass', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error);
  return data;
}

function renderLanduse(features) {
  state.lastLanduseFeatures = features;
  state.landuseLayer.clearLayers();
  const note = document.getElementById('landuseNote');

  if (!state.center) return;
  const circlePoly = turf.circle([state.center.lon, state.center.lat], state.radius / 1000, {
    units: 'kilometers',
    steps: 64,
  });

  const groups = new Map(); // label -> { count, area }
  let clippedAny = false;

  features.forEach((feat) => {
    if (!feat.geometry) return;
    let clipped = feat;
    try {
      const intersection = turf.intersect(feat, circlePoly);
      if (intersection) {
        clipped = intersection;
        clippedAny = true;
      }
    } catch {
      // 지오메트리가 유효하지 않으면 원본 폴리곤을 그대로 사용
    }

    let area = 0;
    try {
      area = turf.area(clipped);
    } catch {
      area = 0;
    }
    if (area <= 0) return;

    const rawTag = feat.properties.landuse;
    const label = LANDUSE_LABELS[rawTag] || rawTag || '미상';

    const g = groups.get(label) || { count: 0, area: 0 };
    g.count += 1;
    g.area += area;
    groups.set(label, g);

    const colorVar = SERIES_COLORS[[...groups.keys()].indexOf(label) % SERIES_COLORS.length];
    L.geoJSON(clipped, {
      style: { color: resolveColor(colorVar), weight: 1, fillOpacity: 0.35 },
    })
      .bindPopup(`<b>${escapeHtml(label)}</b><br>${Math.round(area)} ㎡`)
      .addTo(state.landuseLayer);
  });

  note.textContent = features.length
    ? (clippedAny
        ? 'OSM landuse 폴리곤을 반경 범위로 잘라 면적을 계산했습니다. OSM 매핑 특성상 일부 구역은 태깅이 누락되어 실제와 다를 수 있습니다.'
        : '조회된 landuse 구역이 반경과 겹치지 않습니다.')
    : '이 반경 내에는 OSM에 landuse 태그가 매핑된 구역이 없습니다 (OSM 커뮤니티 매핑 특성상 지역별로 편차가 있습니다).';

  document.getElementById('statLanduseCount').textContent = features.length;

  const labels = [...groups.keys()];
  const totalArea = [...groups.values()].reduce((s, g) => s + g.area, 0) || 1;
  const areas = labels.map((l) => Math.round(groups.get(l).area));
  const colors = labels.map((_, i) => SERIES_COLORS[i % SERIES_COLORS.length]);
  renderBarChart('landuseChart', labels, areas, colors, '면적(㎡)');
  renderLegend('landuseLegend', labels.map((l, i) => ({ label: l, color: colors[i] })));

  const tbody = document.querySelector('#landuseTable tbody');
  tbody.innerHTML = '';
  labels
    .slice()
    .sort((a, b) => groups.get(b).area - groups.get(a).area)
    .forEach((l) => {
      const g = groups.get(l);
      const pct = ((g.area / totalArea) * 100).toFixed(1);
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(l)}</td><td>${g.count}</td><td>${Math.round(g.area)}</td><td>${pct}</td>`;
      tbody.appendChild(tr);
    });
}

// ---------- 차트/범례 유틸 ----------
const chartInstances = {};
function renderBarChart(canvasId, labels, values, colorVars, axisLabel) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  const colors = colorVars.slice(0, labels.length).map(resolveColor);
  if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: axisLabel, data: values, backgroundColor: colors, borderRadius: 4 }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, grid: { color: resolveColor('var(--gridline)') }, ticks: { color: resolveColor('var(--text-secondary)') } },
        y: { grid: { display: false }, ticks: { color: resolveColor('var(--text-secondary)') } },
      },
    },
  });
}

function renderLegend(containerId, items) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  items.forEach((item) => {
    const span = document.createElement('span');
    span.className = 'legend-item';
    span.innerHTML = `<span class="legend-swatch" style="background:${resolveColor(item.color)}"></span>${escapeHtml(item.label)}`;
    el.appendChild(span);
  });
}

function exportGeoJson() {
  const facilityFeatures = state.lastFacilities.map((f) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [f.lon, f.lat] },
    properties: { name: f.name, group: f.groupKey, tag: f.tagValue, distance_m: f.distance },
  }));
  const fc = {
    type: 'FeatureCollection',
    features: [...facilityFeatures, ...state.lastLanduseFeatures],
  };
  const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'landuse-analysis.geojson';
  a.click();
  URL.revokeObjectURL(a.href);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

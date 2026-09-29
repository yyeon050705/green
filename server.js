require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const VWORLD_KEY = process.env.VWORLD_API_KEY || '';
const VWORLD_DOMAIN = process.env.VWORLD_DOMAIN || '';
const DEFAULT_LANDUSE_DATA = process.env.VWORLD_LANDUSE_DATA || 'LT_C_UQ111';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 프런트가 서버 설정 상태(키 보유 여부, 기본 데이터셋)를 확인하기 위한 엔드포인트
app.get('/api/config', (req, res) => {
  res.json({
    hasVworldKey: Boolean(VWORLD_KEY),
    defaultLanduseData: DEFAULT_LANDUSE_DATA,
  });
});

// 주소/장소명 -> 좌표 (OpenStreetMap Nominatim 프록시)
// 브라우저에서 직접 호출하면 Nominatim 이용 정책(User-Agent, 요청 빈도)을 지키기 어려워 서버에서 대신 호출한다.
app.get('/api/geocode', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.status(400).json({ error: 'q(검색어) 파라미터가 필요합니다.' });

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('q', q);

  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'green-landuse-dashboard/1.0 (local development instance)' },
    });
    if (!r.ok) throw new Error(`Nominatim 응답 오류: ${r.status}`);
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: `지오코딩 실패: ${err.message}` });
  }
});

// V-World Data API(WFS 유사 REST) 프록시
// 인증키를 서버에서만 보관하고, 클라이언트는 bbox/데이터셋만 지정한다.
app.get('/api/vworld/data', async (req, res) => {
  const { data, bbox, size, page, attrFilter } = req.query;
  const key = (req.query.key && String(req.query.key)) || VWORLD_KEY;

  if (!key) {
    return res.status(400).json({
      error: 'V-World API 키가 설정되어 있지 않습니다. .env의 VWORLD_API_KEY를 설정하거나, 화면 설정 패널에서 키를 입력하세요.',
    });
  }
  if (!data) return res.status(400).json({ error: 'data(데이터셋 코드) 파라미터가 필요합니다.' });
  if (!bbox) return res.status(400).json({ error: 'bbox(minLon,minLat,maxLon,maxLat) 파라미터가 필요합니다.' });

  const [minLon, minLat, maxLon, maxLat] = String(bbox).split(',').map(Number);
  if ([minLon, minLat, maxLon, maxLat].some(Number.isNaN)) {
    return res.status(400).json({ error: 'bbox 형식이 올바르지 않습니다. (minLon,minLat,maxLon,maxLat)' });
  }

  const params = new URLSearchParams({
    service: 'data',
    version: '2.0',
    request: 'GetFeature',
    format: 'json',
    errorformat: 'json',
    crs: 'EPSG:4326',
    geomFilter: `BOX(${minLon} ${minLat},${maxLon} ${maxLat})`,
    size: (size || '1000').toString(),
    page: (page || '1').toString(),
    data: data.toString(),
    key,
  });
  if (attrFilter) params.set('attrFilter', attrFilter.toString());
  if (VWORLD_DOMAIN) params.set('domain', VWORLD_DOMAIN);

  try {
    const url = `https://api.vworld.kr/req/data?${params.toString()}`;
    const r = await fetch(url);
    const text = await r.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { error: 'V-World 응답을 JSON으로 해석할 수 없습니다.', raw: text.slice(0, 500) };
    }
    res.status(r.ok ? 200 : 502).json(json);
  } catch (err) {
    res.status(502).json({ error: `V-World 요청 실패: ${err.message}` });
  }
});

// Overpass API(OSM) 프록시 - CORS/부하 이슈를 줄이고 여러 미러 중 하나로 재시도한다.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

app.post('/api/overpass', async (req, res) => {
  const query = req.body && req.body.query;
  if (!query) return res.status(400).json({ error: 'query 본문이 필요합니다.' });

  let lastError;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!r.ok) throw new Error(`Overpass 응답 오류: ${r.status}`);
      const data = await r.json();
      return res.json(data);
    } catch (err) {
      lastError = err;
    }
  }
  res.status(502).json({ error: `Overpass 요청 실패: ${lastError?.message || '알 수 없는 오류'}` });
});

app.listen(PORT, () => {
  console.log(`대시보드 서버 실행 중: http://localhost:${PORT}`);
  if (!VWORLD_KEY) {
    console.warn('경고: VWORLD_API_KEY가 설정되지 않았습니다. .env 파일을 생성하고 키를 입력하세요 (.env.example 참고).');
  }
});

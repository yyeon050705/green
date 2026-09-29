require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
});

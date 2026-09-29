# green — 대상지 반경 토지용도·시설 분석 대시보드

**OpenStreetMap(Overpass API)** 데이터를 이용해, 지정한 대상지 반경
**500~1000m** 이내의 **토지용도(landuse)**와 **주변 시설**을 지도·차트로
분석하는 웹 대시보드입니다.

## 주요 기능

- 지도에서 클릭하거나 주소/장소명을 검색해 대상지 지점 지정
- 반경 슬라이더(500~1000m, 50m 단위)로 분석 범위 조정
- **OpenStreetMap Overpass API**로 반경 내 시설(편의/공공시설, 상업, 레저,
  관광, 의료, 업무, 공방 등) 조회 → 지도 마커 + 분류별 막대 차트 + 목록 테이블
- **OpenStreetMap `landuse=*` 폴리곤**을 반경으로 잘라 면적 계산 → 지도
  폴리곤 + 구성 막대 차트 + 목록 테이블
- 분석 결과를 GeoJSON으로 내보내기
- 다크모드 토글

## 아키텍처

```
브라우저(Leaflet, Turf.js, Chart.js)
   │
   ├─ /api/geocode      → 서버가 Nominatim(OSM) 호출 (User-Agent/요청빈도 정책 준수)
   └─ /api/overpass     → 서버가 Overpass API 호출 (여러 미러로 재시도)
```

브라우저에서 Nominatim/Overpass를 직접 호출하면 이용 정책(User-Agent 지정,
요청 빈도 제한)을 지키기 어렵고 CORS 이슈도 있어, Node.js/Express 서버
(`server.js`)가 대신 호출하고 프런트엔드는 이 서버만 호출합니다.

## 실행 방법

```bash
npm install
npm start   # http://localhost:3000
```

별도 API 키 없이 바로 사용할 수 있습니다. `PORT` 등 서버 설정을 바꾸고
싶다면 `.env.example`을 복사해 `.env`로 사용하세요.

## 알려진 제약

- **네트워크 정책**: 이 코드를 작성/테스트한 클라우드 개발 환경은 보안
  정책상 `nominatim.openstreetmap.org`, `overpass-api.de`,
  `tile.openstreetmap.org`, `unpkg.com`, `cdn.jsdelivr.net` 등으로의
  아웃바운드 연결을 차단하고 있어, 이 세션 안에서는 실제 지도 렌더링·검색·
  분석 결과까지 받아보는 종단 간(end-to-end) 테스트를 하지 못했습니다.
  서버 기동, 정적 파일 서빙, API 파라미터 검증/에러 처리 로직은 이 세션에서
  직접 확인했습니다. 일반적인 로컬 PC나 서버 환경(해당 도메인 접속이 허용된
  곳)에서 실행하면 정상 동작합니다.
- **OSM landuse 매핑 편차**: `landuse=*` 태그는 커뮤니티 매핑으로 채워지기
  때문에 지역에 따라 태깅이 없거나 부정확할 수 있습니다. 반경 내 결과가
  비어 있다면 실제로 해당 구역이 미분류일 가능성이 높습니다(화면에 안내
  문구가 표시됩니다).
- **면적 계산**: OSM `landuse` way 폴리곤을 반경 원과 교차(clip)해 면적을
  계산합니다. 닫히지 않은 way나 복잡한 지오메트리는 교차 계산에 실패할 수
  있으며, 이 경우 원본 폴리곤 전체 면적으로 대체 표시됩니다.
- **Nominatim 이용 정책**: 무료 공개 서버는 초당 1회 수준의 요청 제한이
  있습니다. 트래픽이 많다면 자체 Nominatim 인스턴스나 다른 지오코더로 교체를
  권장합니다.
- **관계(relation) 형태 landuse 미포함**: 복잡한 멀티폴리곤(relation)으로
  매핑된 landuse 구역은 현재 제외하고, `way`로 매핑된 구역만 조회합니다.

## 폴더 구조

```
server.js              Express 서버 + API 프록시 (geocode, overpass)
public/
  index.html            대시보드 UI
  css/style.css          스타일 (라이트/다크 테마 토큰)
  js/app.js              지도/검색/분석/차트 로직
.env.example            환경변수 템플릿
```

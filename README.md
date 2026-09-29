# green — 대상지 반경 토지용도·시설 분석 대시보드

OpenStreetMap과 V-World(브이월드) Open API를 연결해, 지정한 대상지 반경
**500~1000m** 이내의 **토지용도(용도지역지구 등)**와 **주변 시설**을 지도·차트로
분석하는 웹 대시보드입니다.

## 주요 기능

- 지도에서 클릭하거나 주소/장소명을 검색해 대상지 지점 지정
- 반경 슬라이더(500~1000m, 50m 단위)로 분석 범위 조정
- **OpenStreetMap Overpass API**로 반경 내 시설(편의/공공시설, 상업, 레저,
  관광, 의료, 업무, 공방, OSM 상 토지이용 등) 조회 → 지도 마커 + 분류별 막대
  차트 + 목록 테이블
- **V-World Data API**로 반경 내 토지이용 관련 필지/구역 조회 → 반경으로 잘라
  면적 계산 → 지도 폴리곤 + 구성 막대 차트 + 목록 테이블
- 분석 결과를 GeoJSON으로 내보내기
- 다크모드 토글

## 아키텍처

```
브라우저(Leaflet, Turf.js, Chart.js)
   │
   ├─ /api/geocode      → 서버가 Nominatim(OSM) 호출 (User-Agent/요청빈도 정책 준수)
   ├─ /api/overpass     → 서버가 Overpass API 호출 (여러 미러로 재시도)
   └─ /api/vworld/data  → 서버가 V-World Data API 호출 (인증키를 서버에서만 보관)
```

V-World 인증키를 브라우저에 노출하지 않기 위해, 실제 외부 API 호출은 모두
Node.js/Express 서버(`server.js`)가 대신 수행하고 프런트엔드는 이 서버만
호출합니다.

## 실행 방법

```bash
npm install
cp .env.example .env   # .env를 열어 VWORLD_API_KEY 등을 입력
npm start               # http://localhost:3000
```

`.env`를 설정하지 않아도 앱은 켜지지만, 화면 우측 상단 **설정** 패널에서
V-World API 키를 직접 입력해 그때그때 사용할 수도 있습니다(브라우저
`localStorage`에만 저장되며, 요청 시에만 서버로 전달됩니다).

## V-World API 키 발급 및 설정 (중요)

1. https://www.vworld.kr/dev 에서 회원가입 후 **OpenAPI 인증키 신청**
2. 이 대시보드를 서비스할 **도메인(또는 서버 IP)**을 신청 시 함께 등록해야
   실제 요청이 통과합니다. 로컬(`localhost`)로 테스트할 때는 V-World 개발자
   센터의 개발용 키/설정 안내를 따르세요.
3. `.env`의 `VWORLD_API_KEY`(및 필요 시 `VWORLD_DOMAIN`)에 발급받은 값을 입력

### 토지이용 데이터셋 코드에 대해

`.env`의 `VWORLD_LANDUSE_DATA` (기본값 `LT_C_UQ111`)는 V-World Data API의
`data` 파라미터로 전달되는 **데이터셋 코드**입니다. 이 저장소를 만든 환경에서는
네트워크 정책상 V-World 개발자 문서 페이지에 직접 접속해 최신 코드 목록을
확인할 수 없었습니다. 실제 사용 전 아래를 꼭 확인하세요.

- V-World 개발자센터 > Open API > 데이터 API(2.0) 문서에서 **계정에 제공되는
  실제 데이터셋 코드**(용도지역지구도, 연속지적도/지목 등)를 확인
- 화면 우측 상단 **설정** 패널에서 데이터셋 코드를 바꿔가며 테스트 가능
- 서버(`/api/vworld/data`)는 V-World가 돌려주는 오류 메시지를 그대로
  화면에 표시하므로, 코드가 틀렸거나 권한이 없는 경우 상태 메시지로 확인 가능

## 알려진 제약

- **네트워크 정책**: 이 코드를 작성한 클라우드 개발 환경은 보안 정책상
  `nominatim.openstreetmap.org`, `overpass-api.de`, `api.vworld.kr` 등 외부
  API 도메인으로의 아웃바운드 연결을 차단하고 있어, 이 세션 안에서는 실제
  API 응답까지 받아보는 종단 간(end-to-end) 테스트를 하지 못했습니다.
  로컬 PC나 일반적인 서버 환경(해당 도메인 접속이 허용된 곳)에서 실행하면
  정상 동작합니다. 서버는 기동 시 `/api/config`, 정적 파일 서빙 등은 이
  세션에서 직접 확인했습니다.
- **V-World 필지 라벨링**: V-World 응답의 속성 필드명이 데이터셋마다 달라,
  프런트엔드가 "이름/용도/지목"으로 보이는 필드를 휴리스틱으로 추정합니다.
  정확한 필드명을 안다면 `public/js/app.js`의 `guessLabelField` 함수를
  해당 필드명으로 고정하는 것을 권장합니다.
- **면적 계산**: V-World가 반환한 폴리곤을 반경 원과 교차(clip)해 면적을
  계산합니다. 일부 MultiPolygon 등 복잡한 지오메트리는 교차 계산에 실패할 수
  있으며, 이 경우 원본 폴리곤 전체 면적으로 대체 표시됩니다(화면에 안내 문구
  표시).
- **Nominatim 이용 정책**: 무료 공개 서버는 초당 1회 수준의 요청 제한이
  있습니다. 트래픽이 많다면 자체 Nominatim 인스턴스나 다른 지오코더로 교체를
  권장합니다.

## 폴더 구조

```
server.js              Express 서버 + API 프록시
public/
  index.html            대시보드 UI
  css/style.css          스타일 (라이트/다크 테마 토큰)
  js/app.js              지도/검색/분석/차트 로직
.env.example            환경변수 템플릿
```

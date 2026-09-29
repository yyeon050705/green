# frontend

React 기반 게시판 클라이언트.

담당 기능 브랜치: `frontend/auth`, `frontend/post`, `frontend/comment`, `frontend/like`, `frontend/search`

브랜치 전략은 [../docs/BRANCH_STRATEGY.md](../docs/BRANCH_STRATEGY.md) 참고.

## 실행 방법

```bash
cd frontend
npm install
npm run dev
```

기본 포트는 `5173`이며, `/api` 요청은 `vite.config.js`의 프록시 설정을 통해 `http://localhost:4000`(backend)으로 전달됩니다. 백엔드(`backend/auth`)를 먼저 실행해야 로그인/회원가입이 동작합니다.

## 인증 화면 (`frontend/auth`)

- `/login` — 로그인
- `/register` — 회원가입
- `/` — 로그인한 사용자만 접근 가능한 홈 (로그아웃 포함)

로그인 성공 시 JWT 토큰을 `localStorage`에 저장하고, `AuthContext`를 통해 전역에서 로그인 상태를 관리합니다.

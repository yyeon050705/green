# backend

Express 기반 게시판 REST API.

담당 기능 브랜치: `backend/auth`, `backend/post`, `backend/comment`, `backend/like`, `backend/search`

브랜치 전략은 [../docs/BRANCH_STRATEGY.md](../docs/BRANCH_STRATEGY.md) 참고.

## 실행 방법

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

기본 포트는 `4000`이며, `.env`에서 변경할 수 있습니다.

## 인증 API (`backend/auth`)

| Method | Endpoint | 설명 | 인증 필요 |
|---|---|---|---|
| POST | `/api/auth/register` | 회원가입 (`{ username, password }`) | X |
| POST | `/api/auth/login` | 로그인 (`{ username, password }`) | X |
| GET | `/api/auth/me` | 내 정보 조회 (`Authorization: Bearer <token>`) | O |

- `username`: 영문/숫자/밑줄 3~20자
- `password`: 6자 이상
- 성공 시 JWT `token`과 `user` 정보를 반환합니다.

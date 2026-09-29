# 역할 분배 및 브랜치 전략

## 1. 팀 구성 (3인)

| 역할 | 담당자 | 브랜치 prefix | 담당 영역 |
|---|---|---|---|
| Backend | 최한솔 | `backend/` | Express API, DB, 인증 로직 |
| Frontend | 전하연 | `frontend/` | React 화면, 상태관리, API 연동 |
| Design | 한승연 | `design/` | 와이어프레임, UI 스타일 가이드, 디자인 리소스 |

## 2. 브랜치 구조

```
main                        # 배포 가능한 안정 버전
└─ develop                  # 통합 개발 브랜치 (모든 작업은 여기서 분기/병합)
   ├─ backend/auth
   ├─ backend/post
   ├─ backend/comment
   ├─ backend/like
   ├─ backend/search
   ├─ frontend/auth
   ├─ frontend/post
   ├─ frontend/comment
   ├─ frontend/like
   ├─ frontend/search
   ├─ design/wireframe
   └─ design/style-guide
```

- `main` : 언제든 배포 가능한 상태만 유지. `develop`이 충분히 검증된 후에만 병합.
- `develop` : 기능 브랜치들이 모이는 통합 브랜치. 모든 feature 브랜치는 `develop`에서 분기하고, 작업이 끝나면 `develop`으로 PR을 보냅니다.
- `<role>/<feature>` : 역할별 기능 브랜치. 한 사람이 여러 기능 브랜치를 오갈 수도 있습니다.

## 3. 기능 ↔ 브랜치 매핑

| 기능 | Backend 브랜치 | Frontend 브랜치 |
|---|---|---|
| 회원가입/로그인 | `backend/auth` | `frontend/auth` |
| 게시글 CRUD | `backend/post` | `frontend/post` |
| 댓글 | `backend/comment` | `frontend/comment` |
| 좋아요/추천 | `backend/like` | `frontend/like` |
| 검색/페이지네이션 | `backend/search` | `frontend/search` |

디자인 담당은 기능 단위가 아니라 산출물 단위로 브랜치를 나눕니다 (`design/wireframe`, `design/style-guide`). 새로운 화면/기능에 대한 디자인 작업이 필요하면 `design/<기능명>` 형태로 추가 생성하세요.

## 4. 브랜치 네이밍 규칙

```
<role>/<feature>[-detail]
```

예시:
- `backend/post` (게시글 CRUD API)
- `backend/post-pagination` (post 안에서도 세부 작업을 나누고 싶을 때)
- `frontend/comment`
- `design/wireframe`

## 5. 작업 워크플로우

1. `develop` 브랜치를 최신 상태로 `pull`
2. 담당 기능 브랜치로 `checkout` (없으면 `develop`에서 새로 분기)
3. 기능 단위로 커밋 (커밋 컨벤션은 아래 참고)
4. 작업 완료 후 `develop`을 대상으로 Pull Request 생성
5. 팀원 코드리뷰 후 `develop`에 병합
6. `develop`이 안정화되면 `main`으로 PR → 병합 → 배포

## 6. 커밋 메시지 컨벤션

```
<type>: <설명>

feat:     새로운 기능 추가
fix:      버그 수정
docs:     문서 수정
style:    코드 포맷팅, 세미콜론 등 (기능 변경 없음)
refactor: 코드 리팩토링
test:     테스트 코드 추가/수정
chore:    빌드, 설정 등 기타 변경
```

예: `feat: 게시글 좋아요 API 추가`

## 7. PR 규칙

- PR 제목: `[역할] 기능 요약` (예: `[Backend] 댓글 CRUD API 구현`)
- 대상 브랜치는 항상 `develop` (긴급 hotfix 제외)
- 리뷰어 최소 1명 승인 후 병합
- 병합 방식은 팀 내 합의(merge / squash) 후 통일해서 사용

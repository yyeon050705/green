-- SECTION 2. Supabase 표 하나로 시작하기
-- 근거노트의 다섯 칸이 그대로 표의 열이 됨

create table if not exists public.evidence_notes (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  item text not null,        -- 항목 이름. 예: '제3종일반주거지역 용적률'
  value numeric not null,    -- 값(숫자만). '300% 이하'처럼 단위를 붙이면 안 됨 — 값·단위 분리 규칙
  unit text not null,        -- 단위
  source text not null,      -- 조문·조례번호·시행일
  queried_on date not null   -- 조회일. 날짜형이어야 오래된 값을 골라낼 수 있음
);

-- 예시 행 (3주차 조문 카드)
insert into public.evidence_notes (item, value, unit, source, queried_on)
values (
  '제3종일반주거지역 용적률',
  300,
  '%',
  '천안시 도시계획 조례 제61조(조례 제2613호, 시행 2024-05-17)',
  '2026-09-09'
);

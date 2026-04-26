# MediSim Orchestrator

다중 AI 에이전트가 공공 의료 데이터(HIRA)와 공간 정보를 **자율적으로** 수집·분석하여,
서울시의 필수 의료(소아청소년과) 공백 지대를 찾아내고 정책 제언 리포트를 발행하는
End-to-End 에이전트 오케스트레이션 플랫폼.

> 한 번의 "분석 시작" 클릭 → 4개 에이전트가 순차 협업 → 마크다운 정책 보고서.

## 데모 흐름 (한눈에)

```
┌────────────┐  fetch_hira_api    ┌────────────┐  calculate_buffer  ┌────────────┐  simulate_placement  ┌────────────┐  generate_markdown_report
│ Data Agent ├───────────────────►│Spatial Agt │───────────────────►│Policy Agent├─────────────────────►│Editor Agent│
│  (Gemini   │  fetch_kosis_api   │ (Turf v7)  │  difference_polygon│  (rule sim)│                      │  (Gemini)  │
│  FC loop)  │                    │            │                    │            │                      │            │
└────────────┘                    └────────────┘                    └────────────┘                      └────────────┘
       │                                  │                                │                                   │
       └─────────── State JSON 흐름 (OrchestrationState) ──────────────────┘
                                        │
                                        ▼
                       SSE stream → 3-pane UI (Activity Log / Map / Report)
```

## 핵심 데모 포인트

- **진짜 LLM 에이전트**: Data Agent는 Gemini 2.5 Flash의 **function calling**으로 직접 `fetch_hira_api` / `fetch_kosis_api`를 결정·호출. 좌측 로그에 `[tool:fetch_hira_api] specialty="소아청소년과", region="서울특별시"` 형태로 LLM이 결정한 인자가 실시간 표시.
- **공간 분석**: Turf.js v7로 골든타임(1.5km) 버퍼 → union → 서울 영역과 차집합 → 취약 면적·등급 산출.
- **자치구별 위험도**: 행정동 centroid의 Point-in-Polygon으로 미커버 영유아 인구를 자치구 단위로 집계 → High/Mid/Low 등급.
- **정책 시뮬레이터**: 상위 3개 자치구 × 3종 대안(신규센터/셔틀/원격진료허브) = 9개 후보, 각각 예상 커버리지 +%와 추정 예산 산출.
- **Gemini 리포트**: Editor Agent가 분석 state를 압축 JSON으로 받아 B2G 양식의 마크다운 정책 제언서 작성.

## 시작하기

```bash
cp .env.example .env.local       # GEMINI_API_KEY 입력
npm install
npx tsx scripts/generate_seoul_fixture.ts   # data/mock/*.json 재생성 (선택)
npm run dev                                  # http://localhost:3000
```

`.env.local`에 `GEMINI_API_KEY`가 없으면 Editor가 템플릿 fallback, Data Agent가 직접 호출 모드로 동작 — 데모는 끊기지 않음.

## 디렉토리

```
app/
  page.tsx                      3-pane UI (Activity Log / Map / Summary+Report)
  api/orchestrate/route.ts      SSE 엔드포인트 (text/event-stream)
lib/
  state.ts                      OrchestrationState 타입 (그래프 state)
  orchestrator.ts               순차 파이프라인 (LangGraph 업그레이드 포인트)
  agents/
    data.ts                     Gemini function-calling loop
    spatial.ts                  Turf v7 buffer/union/difference + 자치구 등급
    policy.ts                   룰 베이스 시뮬레이터 (3종 × top-3 구)
    editor.ts                   Gemini로 마크다운 리포트 생성 (+ 템플릿 fallback)
  tools/
    hira.ts, kosis.ts           fixture 로더 + 필터
    spatial-ops.ts              SEOUL_BBOX, buildHospitalBuffers, unionAll, ...
  llm/gemini.ts                 Gemini 클라이언트 + 모델 상수
data/mock/                      서울 25개 자치구 합성 fixture
scripts/
  generate_seoul_fixture.ts     deterministic 합성 데이터 생성기
docs/
  PRD.md                        제품 요구사항 (서울시 전체 스코프)
  api-contract.md               프론트 ↔ 백엔드 SSE 이벤트 스키마
```

## 역할 분담

- **프론트엔드 (`app/`)** — 팀원: MapLibre GL JS 지도, 자치구 폴리곤, 마커, 버퍼/취약 구역 렌더링
- **백엔드 (`lib/`)** — 슈찌: 4개 에이전트, 오케스트레이터, Gemini function calling, 합성 fixture
- **계약** — `docs/api-contract.md`의 SSE 이벤트 스키마 (양쪽이 보고 작업)

## 오케스트레이션 업그레이드 경로

현재 `lib/orchestrator.ts`는 **바닐라 async generator 순차 호출**.
`Agent` 인터페이스(state in / streaming events out / state patch return)는
LangGraph `StateGraph` 노드 시그니처와 동형이므로, orchestrator.ts만
StateGraph로 교체하면 분기·병렬·체크포인트 지원으로 바로 확장 가능.

## 데이터 출처 표기

`data/mock/*.json`은 **합성 데이터** (`source: "synthetic-seed-20260426"`).
시연용 수치이며, 실제 정책 결정에 사용 금지. 실 API 연동은
`HIRA_API_KEY` / `KOSIS_API_KEY` / `DATA_GO_KR_KEY` 채운 뒤
`lib/tools/hira.ts`의 `USE_MOCK` 분기 추가로 가능.

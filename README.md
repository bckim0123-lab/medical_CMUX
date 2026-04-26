# MediSim Orchestrator

다중 에이전트가 공공 의료 데이터(HIRA)와 공간 정보를 자율 분석하여, 필수 의료 공백 지대에 대한 정책 제언 리포트를 발행하는 오케스트레이션 플랫폼.

## 구조

```
app/
  page.tsx                      3분할 UI (Activity Log / Map / Report) — 팀원 영역
  api/orchestrate/route.ts      SSE 엔드포인트
lib/
  state.ts                      OrchestrationState 타입 (그래프 state)
  orchestrator.ts               순차 파이프라인 (LangGraph 업그레이드 포인트)
  agents/{data,spatial,policy,editor}.ts
  tools/{hira,kosis,spatial-ops}.ts
  llm/gemini.ts                 Gemini 클라이언트
data/mock/                      해커톤 데모용 fixture
docs/
  PRD.md                        제품 요구사항
  api-contract.md               프론트 ↔ 백엔드 SSE 계약
```

## 시작하기

```bash
cp .env.example .env.local       # GEMINI_API_KEY 입력
npm install
npm run dev                      # http://localhost:3000
```

## 역할 분담

- **프론트엔드** (`app/`): 3분할 UI, MapLibre GL JS, SSE 구독
- **백엔드** (`lib/`): 4개 에이전트 + 오케스트레이터 + Gemini function calling
- **계약**: `docs/api-contract.md` — SSE 이벤트 스키마

## 오케스트레이션 업그레이드 경로

Phase 0~1: 바닐라 async generator 순차 호출 (`lib/orchestrator.ts`)
Phase 2+: 동일한 `Agent` 인터페이스를 LangGraph `StateGraph` 노드로 이전 (orchestrator.ts만 교체)

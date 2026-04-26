# Frontend ↔ Backend API Contract

팀원이 백엔드 완성 전에도 UI를 mock으로 개발할 수 있도록 한 페이지로 박제한 계약.
변경되면 이 문서를 먼저 업데이트하고, 양쪽이 보고 작업한다.

## Endpoint

```
GET /api/orchestrate?region=<지역명>
```

응답: `text/event-stream` (Server-Sent Events). `EventSource`로 연결.

## SSE 이벤트 포맷

각 메시지는 `data: <JSON>\n\n` 형태. `JSON.parse(e.data)` 후 `type` 필드로 분기.

### 1. `log` — 진행 상황 텍스트

```json
{"type":"log","agent":"data","message":"마포구 공공데이터 수집 완료"}
```

### 2. `tool` — 에이전트가 호출한 tool

```json
{"type":"tool","agent":"data","tool":"fetch_hira_api","args":{"region":"마포구"}}
```

### 3. `state` — 부분 상태 업데이트 (지도/리포트 갱신용)

```json
{
  "type":"state",
  "agent":"data",
  "patch":{"hospitals":[{"id":"h1","name":"...","lng":126.9,"lat":37.5,"specialty":"소아청소년과"}]}
}
```

가능한 patch 필드:
- `hospitals: Hospital[]` — 마커 렌더링
- `population: PopulationDong[]` — 인구 분포
- `coverage: { bufferKm, vulnerableAreaKm2, riskGrade, vulnerableGeoJSON }` — 취약 구역 폴리곤
- `options: PolicyOption[]` — 정책 대안 카드
- `report: string` — 리포트 마크다운

### 4. `error`

```json
{"type":"error","agent":"spatial","message":"buffer calc failed"}
```

### 5. `done` — 종료 신호 + 최종 state

```json
{"type":"done","state":{"region":"마포구","hospitals":[...],"coverage":{...},"report":"# ..."}}
```

`done` 수신 시 `EventSource.close()` 호출.

## TypeScript 타입 (재사용)

`lib/state.ts`와 `lib/agents/index.ts`에서 export — 프론트가 import해 쓸 수 있음:

```ts
import type { OrchestrationState, Hospital, CoverageResult, PolicyOption } from '@/lib/state';
import type { AgentEvent } from '@/lib/agents';
```

## Mock 모드

`USE_MOCK=1`이면 `data/mock/*.json` fixture를 그대로 반환. 공공 API 키 없이도 데모 가능.

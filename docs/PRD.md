# MediSim Orchestrator — PRD

## 1. 프로젝트 개요
- **이름**: MediSim Orchestrator (메디심 오케스트레이터)
- **한 줄**: 다중 AI 에이전트가 공공 의료 데이터(HIRA)와 공간 정보를 자율적으로 수집·분석하여, 필수 의료 공백 지대를 찾아내고 최적의 정책 대안을 보고서로 발행하는 End-to-End 에이전트 오케스트레이션 플랫폼.
- **유형**: AI Agent SaaS / B2G 보건 정책 자동화
- **개발 핵심 포인트**: 프론트엔드 화려함보다, 백엔드에서 여러 에이전트가 각자의 역할을 수행하며 파이프라인을 관통하는 로직 구현에 집중.

## 2. 핵심 컨셉: 오케스트레이션 파이프라인
사용자가 "마포구 소아과 공백 상황을 분석해 줘"라고 단 한 번 입력하면, 시스템 내부에서 4명의 전문 에이전트가 순차/병렬로 업무를 수행한다.

1. **수집** Data Agent — 심평원 API + 통계청 인구 API
2. **연산** Spatial Agent — 좌표 → 골든타임 미충족 폴리곤
3. **기획** Policy Agent — 가상 개선안 (보건소 연계 셔틀, 신규 센터 등)
4. **출판** Editor Agent — 마크다운 형식의 공식 정책 공문

## 3. 에이전트 명세

| 에이전트 | Tools / Functions | Input → Output |
|---|---|---|
| 1. Data Collector | `fetch_hira_api`, `fetch_kosis_api` | 타겟 지역명 → 소아과 좌표 배열, 읍면동별 영유아 인구수 JSON |
| 2. Spatial Analyst | `calculate_buffer`, `difference_polygon` (Turf.js) | 좌표·인구 → 의료 취약 면적(㎢) + 위험도 등급 (High/Mid/Low) |
| 3. Policy Strategist | `evaluate_roi`, `simulate_placement` | 위험도·면적 → 가상 시설 배치 시뮬레이션 (예: "A동 신규 배치 시 커버리지 +40%") |
| 4. Report Editor | `generate_markdown_report` | 위 3개 Raw Data → B2G 표준 [최종 정책 제언 리포트] |

## 4. 화면 구성 (Agent-Centric UI)

- **좌 30% — Agent Activity Log**: 터미널/채팅 형태, 에이전트 간 데이터 주고받음을 실시간 스트리밍 텍스트로 출력
- **중앙 40% — Live Render Map**: MapLibre GL JS, 작업 단계에 따라 자동 업데이트 (마커 → 반경 폴리곤 → 취약 구역 하이라이트)
- **우 30% — Final Output**: Editor Agent가 발행한 마크다운 리포트 렌더링

## 5. 기술 스택 (Hackathon MVP)

- **Orchestration**: Phase 0 → 바닐라 async; Phase 1 → LangGraph 업그레이드 (확장성 확보)
- **LLM**: Gemini 2.5 Flash (function calling)
- **Frontend**: Next.js 16 App Router, Tailwind CSS, TypeScript
- **Map & Spatial**: MapLibre GL JS, @turf/turf
- **API**: 공공데이터포털 (HIRA), KOSIS

## 6. 제약사항 및 생존 전략

- **API 속도 제약**: 공공 API 응답이 느려 파이프라인 정지 위험. 데모용으로 특정 지역(마포구) HIRA 데이터를 미리 JSON으로 다운로드해 Mock Data Tool로 제공 (Plan B 강력 권장).
- **토큰 비용 최적화**: 에이전트 간 프롬프트 전달 시 대화체 제외, 정제된 JSON Key-Value State만 전달.

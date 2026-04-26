# 협업 보드 — 진행 상황 + 팀원 픽업 가능 작업

> 자동 업데이트 (백엔드 슈찌 / 프론트 팀원 분담). 마지막 업데이트는 git commit
> 시각 참조.

## 현재 시연 가능 상태 ✅

`https://medical-cmux.vercel.app/` 라이브 — 다음 시연 시퀀스 작동:

1. 분석 시작 → 4 에이전트 → 마크다운 리포트
2. 정책 대안 9개 카드 → 클릭 시 What-if 시뮬 (지도 + 우측 요약)
3. Q&A 탭 → 자연어 질문 → Gemini Function Calling → 출처 동반 답변
4. 의학적 조언 거부 시연

## 진행 상황

### ✅ 완료 (Phase 1 + Phase 2 일부)

- [x] 4-에이전트 오케스트레이션 (Data → Spatial → Policy → Editor)
- [x] HIRA 실 API 연동 (1,585개 의원, clCd=31)
- [x] Gemini function calling (Data Agent)
- [x] Gemini 마크다운 리포트 (Editor Agent)
- [x] MapLibre 다크 테마 + 마커 + 커버리지 + 취약 구역
- [x] Vercel 배포 + 도메인
- [x] 환경변수 alias 체인 (Vercel-side hospital/clinic/pharmacy 호환)
- [x] **F. Chatbot — 공공데이터 Q&A** ⭐
- [x] **A2. What-if 시뮬레이터** (정책 카드 클릭 → 지도 변화) ⭐
- [x] D5. demo-script.md (시연 대본)

### ✅ 추가 완료 (Phase 2 마무리)

- [x] **B4. 자치구 Choropleth** — 서울 25개 자치구 polygon 위험도 색상 fill
- [x] **C3. Critic Agent** — 5번째 에이전트, 정책 안에 대한 리스크 한 문장 + severity (high/mid/low)
- [x] **시연 splash 화면** — `public/medi-splash.png` (분석 시작 전 hero overlay)
- [x] **마커 sprite 아이콘** — 병원/의원/약국/보건소 4종 분리 (팀원 작업)
- [x] **마커 클러스터링** — MapLibre cluster source (팀원 작업)
- [x] **IntroOverlay 컴포넌트** — Gemini 인트로 화면 (팀원 작업)
- [x] **발표자료** — `public/presentation.html` 10장 가로 슬라이드 + 데모 스크린샷 갤러리

### 📋 백로그 (팀원 픽업 가능)

> 팀원의 UI / Vercel / 디자인 강점에 맞는 작업 위주로 골라봤어요.

#### A. 시각 디자인 / UX

- [ ] **헤더 redesign** — 현재는 텍스트 + 링크. 로고·아이콘·breadcrumb 추가 시 임팩트↑
  - 파일: `app/page.tsx` (헤더 부분), 또는 `components/Header.tsx` 분리
  - 아이디어: MediSim 글자에 그라디언트 / 4+1 에이전트 원형 인디케이터
- [ ] **마커 클러스터링** — 1,585개가 줌 아웃 시 떡짐. `maplibre-gl-supercluster` 또는 자체 그룹핑
  - 파일: `components/MapView.tsx`
  - 시각 임팩트 큰 작업. 30분~1h
- [ ] **분석 진행률 progress bar** — 헤더 아래 가로 바, 4(또는 5)단계 시각화
  - 현재 헤더 우측 "분석 실행 중" 도트만. 단계별 채워지면 imp.
- [ ] **정책 카드 hover preview** — 카드 hover 시 지도에 시설 위치 dim highlight (클릭 전)
  - 파일: `components/PolicyCards.tsx`, `components/MapView.tsx`
- [ ] **종합 위험도 게이지 차트** — 우측 상단 "High" 텍스트 → 도넛 차트로
  - 라이브러리: 가벼운 SVG 직접 / `recharts` / `nivo`

#### B. 데이터 / 콘텐츠

- [ ] **자치구 hover 툴팁** — 지도에서 자치구 위 마우스 올리면 상세 popup (의원수 / 영유아 / 등급)
  - 단 GeoJSON polygon 필요 (B4와 묶어서 진행)
- [ ] **PDF / Markdown 다운로드 버튼** — 우측 리포트 위 "Export"
  - PDF: `react-pdf` 또는 `html2pdf.js`
  - Markdown: 그냥 다운로드. 5분 작업
- [ ] **서울 외 다른 도시 지원** — 부산·대구 시연 시나리오 추가
  - 백엔드는 거의 그대로, fixture만 추가

#### C. Vercel / 배포

- [ ] **Vercel domains 정리** — 현재 `medical-cmux.vercel.app` 외 자동 도메인 여러 개 alias됨. custom domain 매핑 시 1개만
- [ ] **Open Graph / 메타 태그** — 카카오톡·트위터 공유 시 thumbnail
  - 파일: `app/layout.tsx` (`metadata` 객체 확장)
- [ ] **Vercel Analytics 연동** — 시연 트래픽 추적 (옵션)

#### D. 시연 보조

- [ ] **시연 시나리오 비디오** — 8분 시연을 영상으로 미리 녹화 → 백업
  - 파일: README.md에 `[Demo Video]` 링크
- [ ] **데모 모드 자동 재생** — `/demo` 라우트 접속 시 분석 자동 시작 + 카드 자동 클릭
  - 시연 때 노트북 사고 대비 자동 재생

## 작업 픽업 시 권장 절차

1. 본 문서에서 작업 선택, 상태를 `🚧 진행 중 (이름)`으로 변경
2. `git pull --rebase`
3. 작업
4. 커밋 메시지: `feat(area): 한 줄 설명` 또는 `fix/ui/docs/`
5. push → Vercel 자동 배포 → `medical-cmux.vercel.app`에서 확인
6. 본 문서를 `✅ 완료`로 다시 변경 후 push

## 환경변수 / 도메인 관련

- 환경변수 (Vercel team / `.env.local`):
  - `GEMINI_API_KEY` — Gemini 키
  - `hospital` / `clinic` / `pharmacy` — HIRA 키들 (alias 처리됨)
  - `HIRA_CL_CD=31` — 의원만 (default)
  - `USE_MOCK=0` — 실 API 사용
- Vercel team: `medical-cmux`
- Project: `medical-cmux`

## 주의사항 (충돌 방지)

- 동시 편집이 잦은 파일: `app/page.tsx`, `components/MapView.tsx`
  → 시작 전 본 문서로 누가 만지는지 명시
- `lib/state.ts` 변경 시 `OrchestrationState` 타입 호환 깨짐 — backend agent 들 같이 검토 필요
- `vercel.json` framework=nextjs pin 유지 (지우면 빌드 fail)
- API 키는 절대 채팅·노트·gist에 평문 게시 금지 (Google leak detection)

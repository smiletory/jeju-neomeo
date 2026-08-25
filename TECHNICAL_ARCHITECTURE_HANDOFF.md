# 제주너머 기술 구현 구조 인수인계

> 기준일: 2026-08-25  
> 목적: 새 채팅에서 현재 구현 상태와 향후 목표 구조를 혼동하지 않고 기술 작업을 이어가기 위한 문서

---

## 1. 핵심 결론

현재 제주너머는 다음 상태다.

- 웹게임 프런트엔드와 FastAPI 로컬 서버 구현 완료
- Vertex AI Gemini 기반 ADK 멀티 에이전트 구현 완료
- Vertex AI Agent Runtime 배포 완료
- Agent Platform Search 데이터 스토어 구축·연결 완료
- 기존 Gemini Enterprise 앱에 ADK 에이전트 등록 완료
- 로컬 게임 서버에서 배포된 Agent Runtime을 호출하는 구조 구현 완료
- Cloud Run 게임 서버 배포는 **향후 구현 대상**
- 내부 판정은 안전성을 위해 3개 LLM 에이전트와 Python 최종 게이트를 유지
- 게임 UI와 발표에서는 핵심 사용자 경험인 `문장 의미 판정 → 제주어 표현 판정` 두 단계만 표시

---

## 2. 현재 기술 구현 구조

### 2.1 전체 구조

```text
┌─────────────────────────────────────────────────────────────┐
│ 사용자 데스크톱 브라우저                                    │
│                                                             │
│ HTML / CSS / Vanilla JavaScript                             │
│ - 제주 전체 지도·구좌 지도                                  │
│ - NPC 대화·스토리·미니게임                                  │
│ - 제주어 문장 입력                                          │
│ - 판정 단계·피드백 표시                                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP / JSON / NDJSON 스트리밍
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 로컬 FastAPI 게임 서버                                      │
│ app.local_game_server:app                                   │
│                                                             │
│ - 정적 웹·이미지 제공                                       │
│ - /api/health                                               │
│ - /api/evaluate                                             │
│ - /api/evaluate-stream                                      │
│ - 브라우저에 GCP 인증정보를 노출하지 않는 인증 프록시       │
└──────────────────────────┬──────────────────────────────────┘
                           │ Google ADC로 인증된 호출
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Vertex AI Agent Runtime                                     │
│ jeju-neomeo-agent                                           │
│ us-east1                                                    │
│                                                             │
│ Google ADK SequentialAgent                                  │
│  1. 문장 의미·상황 판정 Gemini 에이전트                     │
│  2. 제주어 표현 판정 Gemini 에이전트                        │
│  3. 신뢰성 검증 Gemini 에이전트                             │
│  4. Python 결정론적 최종 게이트                             │
└──────────────────────────┬──────────────────────────────────┘
                           │ 승인 근거 후보 검색
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Agent Platform Search 데이터 스토어                         │
│ global                                                      │
│                                                             │
│ - 승인된 제주 문화 자료                                     │
│ - 승인된 제주어 표현·의미·용례                              │
│ - 후보 evidence_id 반환                                    │
└──────────────────────────┬──────────────────────────────────┘
                           │ ID·범위 재검증
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 로컬 승인 레지스트리                                        │
│ app/data/evidence.json                                      │
│ app/data/rubrics.json                                       │
│ app/data/hints.json                                         │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 현재 실행 방식

```powershell
uv run uvicorn app.local_game_server:app --host 127.0.0.1 --port 8000
```

브라우저 주소:

```text
http://127.0.0.1:8000/
```

로컬 `.env`가 다음과 같이 설정되어 있으면 로컬 FastAPI 서버가 배포된 Runtime을 호출한다.

```dotenv
AGENT_EXECUTION_BACKEND=agent_runtime
AGENT_RUNTIME_ID=<배포된 Runtime 리소스>
AGENT_RUNTIME_REGION=us-east1
EVIDENCE_RETRIEVER_BACKEND=agent_platform_search
```

실제 값은 `.env`에 있으며 문서에 비밀정보를 복사하지 않는다.

### 2.3 현재 GCP 리소스

| 구분 | 현재 값·상태 |
|---|---|
| GCP 프로젝트 | `iceu-688` |
| Gemini 모델 | `gemini-3.6-flash` |
| 모델 호출 위치 | `global` |
| Agent Runtime 위치 | `us-east1` |
| Agent Runtime | `projects/94900819323/locations/us-east1/reasoningEngines/8767329798025379840` |
| Runtime 코드명 | `jeju-neomeo-agent` |
| 배포 방식 | Google Agents CLI / ADK |
| Search 위치 | `global` |
| Search collection | `jeju-neomeo-search-v2-collection` |
| Search data store | `jeju-neomeo-search-v2-collection_documents` |
| Gemini Enterprise 앱 | 기존 `gemini-enterprise-17858920_1785892087358` 앱 사용 |
| Gemini Enterprise 등록 이름 | `제주너머 문화·제주어 판정 에이전트` |
| Cloud Run 게임 서버 | 아직 최종 배포 전 |

---

## 3. 현재 멀티 에이전트 판정 구조

### 3.1 실제 내부 실행 순서

```text
사용자 문장
   │
   ├─ 입력 보호 계층
   │   프롬프트 공격·판정 조작 지시 사전 차단
   │
   ├─ 질문 계약과 승인 근거 준비
   │   question_id / learning_goal / required_concepts
   │   required_dialect_groups / allowed evidence IDs
   │
   ▼
① 문장 의미·상황 판정 에이전트
   - 문장 전체 의미 분석
   - 현재 대화 상황에 적합한지 판정
   - 문화 질문이면 승인 문화 자료와 대조
   - 제주어 사용 여부는 여기서 평가하지 않음
   │
   ├─ 실패 → 제주어 검사 생략 → 의미 보완 피드백
   │
   ▼ 통과한 경우만
② 제주어 표현 판정 에이전트
   - 필수 제주어 표현 그룹 확인
   - 단순 포함이 아니라 뜻·용법·문맥 검사
   - 잘못된 제주어 사용 탐지
   - 표준어 격식 종결형 탐지
   │
   ▼
③ 신뢰성 검증 에이전트
   - 근거 ID·표현 ID 유효성 확인
   - 에이전트 판정 상충 확인
   - 답변에 없는 근거 생성 여부 확인
   - 조작 시도와 금지 주장 확인
   │
   ▼
④ Python 결정론적 게이트
   - 최종 pass/retry/needs_review/system_error 확정
   - LLM이 직접 게임 진행을 승인하지 못하게 제한
```

### 3.2 문장 의미 판정의 두 유형

#### 상황 대화형

예:

- 처음 만난 어르신에게 인사
- 방문 목적 설명
- 감사와 출발 인사

이 유형은 문화 RAG를 강제하지 않는다. 현재 대화 상황에서 기대한 뜻이 자연스럽고 일관되게 전달되는지 검사한다.

```text
“삼춘, 안녕하우꽈?” → 의미 통과 가능
“삼춘, 안녕하우꽈 치킨 자동차” → 문장 전체가 부적절하므로 의미 실패
```

#### 문화 설명형

예:

- 토끼섬 이름의 유래와 문주란 자생지 보호
- 잠수굿과 멜후림소리의 차이와 공동체 의미

이 유형은 Agent Platform Search에서 검색하고 승인 레지스트리로 검증한 문화 근거만 사용한다.

### 3.3 제주어 판정 원칙

- 키워드 개수만 세지 않음
- 모든 필수 표현이 의미와 상황에 맞게 쓰여야 함
- 제주어 하나만 끼워 넣었다고 자동 통과하지 않음
- `-습니다`, `-ㅂ니다`, `-입니다`로 끝나고 확인된 제주어 종결 표현이 없으면 보완 가능
- 의미가 틀리면 제주어 에이전트를 실행하지 않음

---

## 4. 화면에 표시하는 판정 구조

### 사용자에게 보여주는 구조

```text
01 문장 의미 판정
        ↓ 의미 통과 시
02 제주어 표현 판정
        ↓
게임 피드백
```

내부의 신뢰성 에이전트와 Python 최종 게이트는 삭제한 것이 아니다. 게임 이용자와 발표 평가자가 핵심 기능을 쉽게 이해하도록 화면에서는 두 핵심 에이전트만 강조한다.

판정 단계의 상태 문구는 `완료`만 표시하면 통과한 것으로 오해할 수 있으므로 다음처럼 결과를 구분한다.

- 분석 중
- 통과
- 보완 필요
- 검사 생략
- 연결 오류

---

## 5. 현재 RAG·데이터 구조

### 5.1 역할

Agent Platform Search는 최종 진실 저장소가 아니라 **후보 근거 ID 검색기**다.

```text
Agent Platform Search 후보 ID
   ↓
로컬 승인 레지스트리 재검증
   ↓
현재 퀘스트와 버전에 허용된 근거만 LLM에 제공
```

### 5.2 데이터 파일

| 파일 | 역할 |
|---|---|
| `app/data/evidence.json` | 승인 문화 자료와 제주어 표현 근거 |
| `app/data/rubrics.json` | 질문, 학습 목표, 필수 개념, 금지 주장, 필수 제주어 그룹 |
| `app/data/hints.json` | 허용된 단계별 힌트 |
| `artifacts/agent_search/evidence.jsonl` | Search 데이터 스토어 업로드 문서 |

### 5.3 검색 실패 원칙

- 검색 실패 시 몰래 로컬 JSON 성공으로 전환하지 않음
- 문화 근거가 필요한 질문에서 검색 실패 시 판정을 중단
- API는 오류를 명시적으로 반환
- 게임은 가짜 성공 처리를 하지 않음

---

## 6. 현재 API 구조

### 브라우저 클라이언트

`web/agent-api.js`

### 엔드포인트

| 메서드 | 경로 | 역할 |
|---|---|---|
| GET | `/api/health` | 실행·검색 백엔드 상태 확인 |
| POST | `/api/evaluate` | 최종 판정 한 번에 반환 |
| POST | `/api/evaluate-stream` | 에이전트 단계와 결과를 NDJSON으로 스트리밍 |

### 요청 계약

```json
{
  "quest_id": "gujwa_songdang_01",
  "question_id": "practice_greeting",
  "user_answer": "삼춘, 편안허우꽈?",
  "attempt": 1,
  "rubric_version": "1.0"
}
```

### 주요 최종 결과

- `pass`
- `retry_relevance`
- `retry_knowledge`
- `retry_dialect`
- `retry_both`
- `needs_review`
- `input_rejected`
- `system_error`

---

## 7. 현재 프런트엔드 구조

### 기술

- HTML
- CSS
- Vanilla JavaScript
- FastAPI 정적 파일 제공

### 파일

| 파일 | 역할 |
|---|---|
| `web/index.html` | 전체 화면·대화·입력·보상 구조 |
| `web/styles.css` | 민화 지도, 캐릭터, 대화 UI, 애니메이션 |
| `web/game.js` | 게임 상태, 대화 노드, 해금, 미니게임, API 연결 |
| `web/agent-api.js` | 프런트엔드–판정 API 계약 |
| `web/jeju-map-data.js` | 제주 14개 권역 SVG 지도 데이터 |

### 게임과 에이전트 분리

게임 UI에는 판정 기준을 하드코딩하지 않는다.

```text
게임 UI 변경
   └─ quest_id / question_id 계약 유지
       └─ 에이전트 재구현 불필요
```

새 질문이나 제주어 연습 단계가 생기면 `rubrics.json`의 질문 계약과 근거·테스트를 추가한다.

---

## 8. 향후 목표 기술 구조

### 8.1 최종 전체 구조

```text
┌─────────────────────────────────────────────────────────────┐
│ 사용자 데스크톱 브라우저                                    │
│                                                             │
│ 제주너머 웹게임                                             │
│ - 게임 UI·NPC·스토리·미니게임                              │
│ - 제주어 문장 입력                                          │
└──────────────────────────┬──────────────────────────────────┘
                           │ 공개 HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Cloud Run: jeju-neomeo-game                                │
│                                                             │
│ - 정적 웹게임 제공                                          │
│ - FastAPI API                                               │
│ - 인증 프록시                                               │
│ - 판정 단계 NDJSON 스트리밍                                 │
│ - 브라우저에 GCP 인증정보 미노출                            │
│ - 최소 인스턴스 0 우선 검토                                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ 서비스 계정 기반 인증 호출
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Vertex AI Agent Runtime: jeju-neomeo-agent                  │
│                                                             │
│ ADK SequentialAgent                                         │
│  1. 문장 의미·상황 판정                                     │
│  2. 제주어 표현 판정                                        │
│  3. 내부 신뢰성 검증                                        │
│  4. Python 최종 게이트                                      │
└──────────────────────────┬──────────────────────────────────┘
                           │ 승인 근거 검색
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Agent Platform Search                                      │
│ - 공식·지역 문화 자료                                       │
│ - 검수된 제주어 표현·의미·용례                              │
└─────────────────────────────────────────────────────────────┘

운영 관측:
Cloud Logging + Trace + 실행 추적 + 오류 관측
```

### 8.2 Cloud Run에서 구현할 사항

현재 `Dockerfile`은 Agent Runtime용 진입점인 `app.fast_api_app:app`을 실행하고 `web/`을 복사하지 않는다. 게임 서버 Cloud Run 배포에는 별도 구성이 필요하다.

필요 작업:

1. 게임용 Dockerfile 또는 다중 대상 Dockerfile 구성
2. `web/` 정적 파일을 컨테이너에 복사
3. `app.local_game_server:app` 또는 Cloud Run 전용 앱 진입점 사용
4. 포트 `8080` 사용
5. Cloud Run 서비스 계정에 Agent Runtime 호출 권한 부여
6. 필요한 환경 변수·Runtime ID를 Cloud Run에 설정
7. 브라우저에서 공개 HTTPS 주소로 종단 테스트
8. `/api/evaluate-stream` 스트리밍이 프록시 환경에서 정상 동작하는지 확인
9. 최소 인스턴스 0과 요청 제한 시간을 데모 조건에 맞게 설정
10. CORS는 동일 서비스에서 정적 웹과 API를 함께 제공하면 별도 허용을 최소화할 수 있음

### 8.3 향후 콘텐츠 확장 방식

14개 권역으로 확장할 때 Agent Runtime을 권역마다 새로 배포하지 않는다.

```text
새 권역 추가
  ├─ 게임 장면·NPC·미니게임 추가
  ├─ quest_id / question_id 추가
  ├─ 검수 문화 자료와 제주어 용례 추가
  ├─ rubrics.json / evidence.json / hints.json 갱신
  ├─ Agent Platform Search 문서 재수집
  └─ 평가 데이터셋과 회귀 테스트 추가
```

동일 멀티 에이전트 파이프라인이 질문 계약에 따라 각 권역을 판정한다.

---

## 9. 향후 구현 우선순위

### 1단계: 확정된 하도리 게임 시나리오 구현

- `docs/HADO_SCENARIO.md`를 구현 단일 기준으로 사용
- 문정해 삼춘 대화·상세정보·바람 망원경 관찰·보호 의사 제주어 입력 구현
- 멸치·수온·차광막 설정은 사용하지 않음
- 하도리 완료 후 동김녕리 해금
- 로컬 게임 서버에서 UI 검증

### 2단계: 하도리 판정 계약 확정

- 최종 질문에 맞춰 `rubrics.json` 확인
- 공식 근거와 대사 대조
- 테스트 문장 4종 추가
- 필요할 때만 Agent Runtime 재배포

### 3단계: 동김녕리 상세 퀘스트

- 송당·하도와 같은 대화형 구조로 전환
- 잠수굿과 멜후림소리의 차이·공동체 의미 전달

### 4단계: Cloud Run 게임 서버 배포

- 별도 게임 서버 컨테이너
- 인증 서비스 계정
- Runtime 호출
- Search 종단 검증

### 5단계: 운영 관측과 발표 검증

- Cloud Logging
- Trace
- 단계별 지연 시간
- 검색·모델·판정 오류 기록
- 발표용 정상·실패 사례 사전 점검

---

## 10. 현재 구조와 목표 구조 비교

| 항목 | 현재 | 향후 목표 |
|---|---|---|
| 브라우저 | 로컬 `127.0.0.1:8000` 접속 | 공개 Cloud Run HTTPS 접속 |
| 게임 서버 | 로컬 FastAPI | Cloud Run FastAPI + 정적 웹 |
| 에이전트 | Agent Runtime 배포 완료 | 동일 Runtime 유지·콘텐츠 확장 |
| 멀티 에이전트 | 의미 → 제주어 → 신뢰성 | 내부 구조 유지 |
| UI 표시 | 의미 → 제주어 2단계 | 동일하게 간결하게 표시 |
| 최종 판정 | Python 결정론적 게이트 | 유지 |
| 검색 | Agent Platform Search 연결 완료 | 자료·권역 확대 |
| Gemini Enterprise | 기존 앱에 등록 완료 | 시연·관리 활용 |
| 하도리 | 지도·자료·미완성 화면 골격 | 상세 시나리오와 미니게임 완성 |
| 동김녕리 | 범용 퀘스트 화면 | 상세 대화형 퀘스트 |
| 상태 저장 | 브라우저 메모리 | 필요 시 localStorage 또는 서버 저장 검토 |
| 관측 | 기본 로그·Trace 구조 | Cloud 운영 관측 정리 |

---

## 11. 구현 시 지켜야 할 기술 원칙

- 모델 `gemini-3.6-flash`를 임의로 변경하지 않는다.
- 에이전트 배포는 사용자 명시 승인 후 실행한다.
- Cloud Run 배포도 사용자 승인 후 실행한다.
- UI 변경과 에이전트 판정 계약을 분리한다.
- 문화 사실은 승인 근거 없이 Gemini 사전지식만으로 통과시키지 않는다.
- 상황 대화에는 불필요한 문화 RAG를 강제하지 않는다.
- 문장 의미가 실패하면 제주어 판정을 생략한다.
- 제주어 키워드 포함만으로 통과시키지 않는다.
- 검색·모델 오류를 성공으로 대체하지 않는다.
- 브라우저에 Google 인증정보를 노출하지 않는다.
- 최종 게임 진행 여부를 LLM 응답 하나에 맡기지 않는다.
- 변경 후 단위·통합·UI 테스트를 실행한다.

---

## 12. 새 채팅 전달용 요약문

```text
현재 제주너머는 Vanilla JS 웹게임 + 로컬 FastAPI 게임 서버 + Vertex AI Agent Runtime + Agent Platform Search 구조입니다.

Agent Runtime의 ADK SequentialAgent 안에는 실제로 세 LLM 에이전트가 있습니다.
1) 문장 전체 의미와 현재 대화 상황을 먼저 판단하는 에이전트
2) 의미를 통과한 문장만 제주어 필수 표현의 뜻과 용법을 판단하는 에이전트
3) 근거 ID와 판정 충돌을 내부 검증하는 신뢰성 에이전트
마지막 진행 여부는 Python 결정론적 게이트가 확정합니다.

게임 화면과 발표에서는 사용자가 이해하기 쉽도록 1) 문장 의미 판정 → 2) 제주어 표현 판정만 표시하고, 신뢰성 에이전트와 Python 게이트는 내부 안전장치로 유지합니다.

Agent Runtime과 Agent Platform Search, 기존 Gemini Enterprise 앱 등록은 완료됐습니다. 현재 게임은 로컬 FastAPI 서버가 인증된 요청으로 Runtime을 호출합니다. 향후에는 게임 웹과 FastAPI 프록시를 Cloud Run의 jeju-neomeo-game 서비스로 배포하고, Cloud Run 서비스 계정이 Agent Runtime을 호출하도록 구성할 예정입니다. 브라우저에는 GCP 인증정보를 노출하지 않습니다.

Cloud Run 게임 서버는 아직 배포 완료 상태가 아닙니다. 현재 Dockerfile은 Agent Runtime용이므로 게임용 Dockerfile·정적 웹 복사·Cloud Run 전용 진입점·서비스 계정 권한을 별도로 구성해야 합니다.

구체적인 내용은 TECHNICAL_ARCHITECTURE_HANDOFF.md와 PROJECT_HANDOFF.md를 먼저 읽고 진행해주세요.
```

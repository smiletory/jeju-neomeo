# 제주너머

제주 마을의 고유 문화와 제주어를 게임 안에서 배우며 설문대 할망의 기억을 되찾는 데스크톱 2D 어드벤처 데모입니다. 구좌읍의 세 지점을 완주하면 기억 조각 1개를 얻고 다음 지역이 해금됩니다. 전체 기억은 14개 탐험 권역의 조각 14개로 완성됩니다.

## 구현된 데모

- 제주 14개 탐험 권역 지도와 구좌읍 확대 탐험 지도
- 진행 NPC `바람새`와 서로 다른 미션 NPC 3명
- 송당리 본향당 → 하도리 토끼섬 → 동김녕리 해안 순차 퀘스트
- 실제 Vertex AI `gemini-3.6-flash` 기반 3-에이전트 판정
- 문장 의미 판정 → 의미 통과 시 제주어 표현 판정 → 신뢰성 검증 → 결정론적 최종 게이트
- 세 기억의 흔적 결합 → `구좌의 바람` 기억 조각 `1/14` → 조천읍 해금
- 제주 민화·판화와 한지 질감의 무음 데스크톱 UI

## 실행

필수 환경은 Python/uv, Google Cloud CLI, Vertex AI 권한입니다.

```powershell
agents-cli install
gcloud auth application-default login
uv run uvicorn app.local_game_server:app --host 127.0.0.1 --port 8000
```

브라우저에서 `http://127.0.0.1:8000`을 엽니다. Windows에서는 `start-demo.ps1`을 실행해도 됩니다.

`.env`의 필수 값:

```dotenv
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=<GCP_PROJECT_ID>
GOOGLE_CLOUD_LOCATION=global
```

## 판정 구조

```text
플레이어 답변
  ├─ 입력 경계: 명백한 프롬프트 공격 차단
  ├─ 근거 검색: 승인된 문화 자료·제주어 용례만 조회
  └─ ADK SequentialAgent
       ├─ Meaning Judge: 문장 전체 의미와 현재 대화 상황의 적합성 판정
       ├─ 의미 통과 시 Dialect Judge: 허용된 제주어 특징과 문맥상 쓰임 판정
       └─ 의미 실패 시 제주어 판정 생략
          ↓
     Reliability Verifier: 근거·상충·조작 시도 교차 검증
          ↓
     Deterministic Gate: 통과/재시도/검토/시스템 오류 확정
```

모델은 최종 통과 여부를 직접 결정할 수 없습니다. 루브릭에 없는 근거 ID, 허용되지 않은 힌트 ID, 에이전트 상충, 낮은 신뢰도는 진행을 막습니다. 모든 사용자 입력은 신뢰하지 않는 인용 데이터로 취급됩니다.

## 게임 UI 연결

`web/agent-api.js`가 화면과 판정 API 사이의 계약을 담당합니다. 퀘스트 화면은 `questId`, `questionId`, 사용자 답변, 시도 횟수만 전달하며 문화·제주어 판정 로직을 포함하지 않습니다. UI 디자인이나 장면 구성이 바뀌어도 이 클라이언트를 재사용하면 에이전트 코드는 수정할 필요가 없습니다.

판정 결과 화면에는 문화 지식 피드백, 제주어 표현 피드백, 승인된 근거 ID와 검색 백엔드가 분리 표시됩니다. 명백한 프롬프트 공격은 Gemini 호출 전에 입력 보호 계층에서 차단됐다는 사실도 표시합니다.

## 관리형 근거 검색

기본 데모는 `local_json` 근거 검색을 사용합니다. `agent_platform_search` 어댑터도 구현되어 있어 커넥터가 만든 collection과 data store ID를 설정하면 코드 변경 없이 관리형 검색으로 전환할 수 있습니다.

```dotenv
EVIDENCE_RETRIEVER_BACKEND=agent_platform_search
DATA_STORE_REGION=global
DATA_STORE_COLLECTION=<COLLECTION_ID>
DATA_STORE_ID=<DATA_STORE_ID>
```

Agent Platform Search는 후보 근거 ID만 찾습니다. 실제 내용과 승인 여부는 로컬 승인 레지스트리에서 다시 검증하므로 원격 인덱스에 없는 ID, 미승인 자료, 다른 퀘스트 자료는 에이전트에 전달되지 않습니다. 자세한 준비 절차는 `docs/AGENT_SEARCH_SETUP.md`를 참고하세요.

## 테스트

```powershell
uv run pytest tests/unit -q
node tests/ui_agent_api.mjs
```

현재 전체 단위 테스트 75개와 UI API 계약 검사가 통과합니다. 하도리·동김녕리 실제 게임 문장 6건은 `agents-cli eval run`에서 모두 유효하게 처리됐고 응답 품질 평균 5.0/5.0을 기록했습니다. 배포된 Runtime과 Cloud Run을 통해 정상 제주어, 표준어, 의미 오류 답안의 종단 판정도 확인했습니다.

## 발표 시연

각 퀘스트의 `발표용 답안 불러오기`는 답변만 채웁니다. 판정을 우회하지 않으며 반드시 실제 Gemini 3-에이전트 호출을 거칩니다. 상세 10분 동선은 `docs/DEMO_SCRIPT.md`를 참고하세요.

## 배포 상태

Vertex AI Agent Runtime 배포, Agent Platform Search 검색 권한 연결, 기존 Gemini Enterprise 앱의 ADK 에이전트 등록, 게임 서버의 Cloud Run 배포가 완료됐습니다. 브라우저는 Cloud Run의 `/api/evaluate/stream`만 호출하고, Cloud Run이 인증된 요청으로 Runtime에 판정을 전달하므로 Google 인증정보와 Runtime ID는 브라우저에 노출되지 않습니다.

- 게임 URL: <https://jeju-neomeo-game-94900819323.us-east1.run.app>
- Agent Runtime: `us-east1`, 기존 Runtime ID 유지
- Cloud Run: `us-east1`, 최소 인스턴스 0·최대 3
- Agent Designer: 사용하지 않음

자세한 구조와 재배포 정보는 `docs/AGENT_RUNTIME_DEPLOYMENT.md`를 참고하세요.

## 지도 경계 데이터

제주 전체 지도는 통계청 SGIS 행정동 경계를 기반으로 보정된 `vuski/admdongkor`의 2026-07-01 GeoJSON을 사용합니다. 원자료는 공공누리 제1유형, 가공 경계 데이터는 CC BY 4.0입니다. 지도는 7읍·5면·`제주 열아홉 동네`·`서귀포 열두 동네`의 14개 탐험 권역으로 구성하며, 본섬에서 떨어진 추자면은 별도 삽입 지도로 표시합니다.

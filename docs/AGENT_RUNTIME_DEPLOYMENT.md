# Agent Runtime 배포 및 Gemini Enterprise 등록

## 현재 상태

- 배포 대상: Vertex AI Agent Runtime (`us-east1`)
- 모델 호출 위치: Vertex AI Gemini (`global`)
- 근거 검색: Agent Platform Search 데이터 스토어 (`global`)
- 등록 대상: 기존 Gemini Enterprise 앱 (`global`)
- 게임 서버: Cloud Run (`us-east1`)
- 실제 배포 상태: 배포 완료
- 배포 드라이런 및 종단 검증: 통과
- Gemini Enterprise 등록: 기존 앱에 ADK 방식으로 완료

게임 UI는 동일 출처의 `/api/evaluate` 및 `/api/evaluate/stream` 계약만 사용합니다. 로컬 개발에서는 FastAPI 서버가, 운영에서는 Cloud Run이 인증된 요청으로 Agent Runtime에 전달합니다. Runtime에서는 문장 의미 판정, 의미 통과 시 제주어 표현 판정, 신뢰성 검증 순으로 실행됩니다. 브라우저에는 Google 인증정보나 Runtime ID를 노출하지 않습니다. 퀘스트 화면이 바뀌어도 API 계약을 유지하면 에이전트 코드를 다시 만들 필요가 없습니다.

## 운영 배포 정보

- 공개 게임 URL: <https://jeju-neomeo-game-94900819323.us-east1.run.app>
- Cloud Run 서비스: `jeju-neomeo-game`
- Cloud Run 리전: `us-east1`
- 배포 리비전: `jeju-neomeo-game-00001-z8s`
- 컨테이너: `us-east1-docker.pkg.dev/iceu-688/jeju-neomeo/jeju-neomeo-game:20260826-001`
- 리소스: 1 vCPU, 2 GiB, 동시성 8, 요청 제한 시간 300초
- 확장: 최소 인스턴스 0, 최대 인스턴스 3
- Runtime 리소스 ID: `projects/94900819323/locations/us-east1/reasoningEngines/8767329798025379840`
- Runtime 모델: `gemini-3.6-flash`

Cloud Run 서비스 계정 `jeju-neomeo-game@iceu-688.iam.gserviceaccount.com`에는 Runtime 호출과 로그 기록에 필요한 최소 역할만 부여했습니다. 공개 브라우저 요청은 Cloud Run까지만 도달하며, 이후 Google Cloud 호출은 서비스 계정의 Application Default Credentials로 인증됩니다.

## 배포 전 확인

```powershell
uv run pytest -q
uv run --extra lint ruff check app tests scripts infra\agent_search\scripts
node tests\ui_agent_api.mjs
agents-cli deploy --project <PROJECT_ID> --region us-east1 --dry-run --no-confirm-project
```

Runtime에는 아래 검색·모델 설정만 전달합니다. `GOOGLE_CLOUD_PROJECT` 같은 예약 변수는 Agent Runtime이 자동으로 제공합니다.

```text
GOOGLE_GENAI_USE_VERTEXAI
EVIDENCE_RETRIEVER_BACKEND
DATA_STORE_REGION
DATA_STORE_COLLECTION
DATA_STORE_ID
DATA_STORE_SERVING_CONFIG
AGENT_SEARCH_TIMEOUT_SECONDS
AGENT_EXECUTION_BACKEND=local
```

데스크톱 서버의 로컬 `.env`에는 `AGENT_EXECUTION_BACKEND=agent_runtime`, Runtime 리소스 이름·지역·제한 시간을 설정합니다. 배포된 Runtime은 플랫폼이 주입한 엔진 ID를 감지해 자기 자신을 다시 호출하지 않도록 방어합니다.

## 완료된 배포 순서

1. Agent Runtime 실행 서비스 계정에 데이터 스토어 검색 권한을 부여합니다.
2. `agents-cli deploy`로 기존 Runtime을 같은 ID로 갱신합니다.
3. 배포된 Runtime에서 하도리·동김녕리 실제 게임 답안을 평가합니다.
4. `deployment_metadata.json`에 Runtime 리소스 ID가 기록됐는지 확인합니다.
5. 기존 Gemini Enterprise 앱에 ADK 방식으로 등록합니다.
6. Gemini Enterprise에서 등록된 도구 호출을 확인합니다.
7. Cloud Run 게임 백엔드가 Runtime을 호출하도록 연결하고 공개 URL에서 스트리밍 판정을 확인합니다.

검색 권한은 기본 Reasoning Engine 서비스 계정에 `roles/discoveryengine.viewer`만 추가했습니다.

## 완료된 릴리스 검증

- 단위 테스트: `75 passed`
- UI API 계약: 통과
- 릴리스 평가 데이터: 하도리 3건 + 동김녕리 3건
- `agents-cli eval run`: 6/6 유효, 오류 0, 응답 품질 평균 5.0/5.0
- Runtime 직접 호출: 정상 제주어 `pass`, 표준어 `retry_dialect`, 의미 오류 `retry_knowledge`
- Cloud Run 종단 호출: 문장 의미 → 제주어 표현 → 최종 확인의 스트리밍 순서 및 최종 결과 확인

릴리스 평가 데이터는 `artifacts/eval_inputs/release_hado_gimnyeong.json`, 결과는 `artifacts/grade_results/release_hado_gimnyeong/`에 보관합니다.

## 기존 Gemini Enterprise 앱 등록 방식

새 Search 앱을 등록 대상으로 사용하지 않습니다. `agents-cli publish gemini-enterprise --list`에서 확인되는 기존 `Gemini Enterprise` 유형 앱을 선택합니다.

```powershell
agents-cli publish gemini-enterprise `
  --project <PROJECT_ID> `
  --deployment-target agent_runtime `
  --registration-type adk `
  --gemini-enterprise-app-id <EXISTING_GEMINI_ENTERPRISE_APP_RESOURCE_NAME> `
  --display-name "제주너머 문화·제주어 판정 에이전트" `
  --description "제주 마을 문화 지식과 제주어 답변을 승인 근거로 검증하는 멀티 에이전트" `
  --tool-description "게임 퀘스트 답변의 문화 정확성, 제주어 적절성, 근거 신뢰성을 분리 판정합니다."
```

`--agent-runtime-id`는 생략하고 `deployment_metadata.json`에서 자동으로 읽었습니다. Search 유형 앱이 아니라 기존 Gemini Enterprise 유형 앱에 등록했습니다.

## 데이터 스토어 검색 원칙

현재 문화 자료 검색은 별도 Search 앱을 거치지 않고 데이터 스토어의 serving config를 직접 호출합니다. 중복으로 생성됐던 `jeju-neomeo-search-app`은 2026-08-24에 삭제했습니다. 같은 날 자동 동기화의 문서 ID 설정을 바로잡기 위해 데이터 스토어를 `jeju-neomeo-search-v2-collection_documents`로 교체했으며, GCS 승인 문서와 Runtime·Gemini Enterprise 등록 구조는 유지합니다.

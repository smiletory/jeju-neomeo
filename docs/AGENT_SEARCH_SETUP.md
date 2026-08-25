# Agent Platform Search 연결 준비

## 현재 상태

코드에는 `local_json`과 `agent_platform_search` 두 검색 백엔드가 구현되어 있다. 2026-08-25 기준 GCP 관리형 데이터 스토어와 검색 앱 생성, 승인 문서 13개 수집, 실제 검색 및 게임 API 종단간 검증까지 완료했다. 현재 로컬 `.env`는 `agent_platform_search`를 사용한다. 구좌읍 두 번째 지점은 하도리 토끼섬으로 교체했으며 `hado_01`~`hado_03`이 국가유산청 국가유산포털과 제주관광공사 비짓제주 자료를 근거로 제공된다.

관리형 검색은 근거의 최종 진실 저장소가 아니다. Search는 후보 `evidence_id`만 찾고, 서버가 `app/data/evidence.json`의 승인 여부·버전·퀘스트·학습 목표·제주어 특징 허용 목록을 다시 검증한다. 원격 인덱스가 알 수 없는 ID나 다른 퀘스트의 자료를 반환하면 결과에서 제거된다.

```text
사용자 답변
  → Agent Platform Search: 후보 evidence_id 검색
  → 로컬 승인 레지스트리: ID·버전·범위 재검증
  → 문화/제주어 에이전트
  → 신뢰성 에이전트
  → 결정론적 최종 게이트
```

## 1. 수집 문서 생성

```powershell
uv run python scripts/export_agent_search_documents.py
```

생성 파일:

```text
artifacts/agent_search/evidence.jsonl
```

Discovery Engine `Document` 형식의 JSONL이며 승인된 레코드만 포함한다. 현재 출력 수는 13개다.

## 2. 관리형 데이터스토어 준비

Google 공식 ADK `rag-agent-search` 레시피의 GCS Data Connector 방식을 사용한다.

- Cloud Storage 버킷에 `evidence.jsonl` 업로드
- 데이터 커넥터의 스키마를 `document`로 설정
- 커넥터가 생성한 실제 collection ID와 data store ID 확인
- 서비스 계정에 검색 실행 권한 부여

공식 레시피는 데이터스토어 ID와 collection을 자동 생성할 수 있으므로 임의로 추정하지 말고 Terraform 출력값을 사용해야 한다.

## 3. 환경 변수 설정

기존 `.env`의 Vertex AI 설정은 유지하고 아래 항목을 추가한다.

```dotenv
EVIDENCE_RETRIEVER_BACKEND=agent_platform_search
DATA_STORE_REGION=global
DATA_STORE_COLLECTION=<TERRAFORM_OUTPUT_COLLECTION>
DATA_STORE_ID=<TERRAFORM_OUTPUT_DATA_STORE_ID>
DATA_STORE_SERVING_CONFIG=default_config
AGENT_SEARCH_TIMEOUT_SECONDS=10
```

필수 설정이 빠지면 서버는 로컬 검색으로 몰래 전환하지 않고 시작 또는 상태 확인 단계에서 오류를 낸다. 관리형 검색 도중 오류가 발생하면 `/api/evaluate`는 503을 반환하고 Gemini 판정을 진행하지 않는다.

## 4. 연결 확인

서버 재시작 후:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

정상 예시:

```json
{
  "status": "ok",
  "agent": "answer_evaluation_pipeline",
  "retrieval_backend": "agent_platform_search"
}
```

게임 화면 상단에는 `Gemini · Agent Search 준비`가 표시되고 판정 결과의 공식 자료 근거에도 `agent_platform_search`와 검색된 근거 ID가 표시된다.

최초 생성 직후 또는 문서 갱신 후에는 일일 자동 동기화를 기다리지 않고 즉시 수집할 수 있다.

```powershell
$projectLine = Get-Content .env | Where-Object { $_ -match '^GOOGLE_CLOUD_PROJECT=' }
$projectId = ($projectLine -split '=', 2)[1].Trim()
uv run infra/agent_search/scripts/start_connector_run.py `
  --project $projectId `
  --region global `
  --collection-id jeju-neomeo-search-v2-collection `
  --wait
```

## 5. 검증 결과

- 프로젝트 결제 연결 및 활성화 확인
- Terraform 적용: 8개 생성, 변경 0개, 삭제 0개
- 승인 문서 수집: 13/13 성공, 실패 0개
- 문서 API 조회: 13개
- 송당리 검색: `songdang_01` 1건 반환
- 실제 게임 API: `agent_platform_search` 근거로 `pass`, 문화 1.0, 제주어 1.0

## 공식 자료

- [Google ADK RAG Agent Search 샘플](https://github.com/google/adk-samples/tree/main/core/python/rag-agent-search)
- [Agent Search 데이터스토어 검색 샘플](https://cloud.google.com/generative-ai-app-builder/docs/samples/genappbuilder-search)
- [Agent Search 데이터스토어 만들기](https://cloud.google.com/generative-ai-app-builder/docs/create-data-store-es)

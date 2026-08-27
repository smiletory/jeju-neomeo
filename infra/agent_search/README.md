# 제주너머 Agent Platform 데이터 스토어 인프라

Google 공식 ADK `core/python/rag-agent-search` 레시피를 제주너머의 승인 근거 JSONL에 맞게 적용한 Terraform 구성이다. Runtime은 별도의 Search 앱을 거치지 않고 데이터 스토어의 serving config를 직접 호출한다. Cloud Storage 커넥터는 `custom` 스키마와 JSONL의 `id` 필드를 사용해 근거 ID를 동기화 사이에도 안정적으로 유지한다.

## 적용 전 조건

- 프로젝트에 활성 결제 계정 연결
- Application Default Credentials 로그인
- `artifacts/agent_search/evidence.jsonl` 생성
- Terraform 설치

## 실행

PowerShell에서 프로젝트 ID를 파일에 저장하지 않고 전달한다.

```powershell
$projectLine = Get-Content ../../.env | Where-Object { $_ -match '^GOOGLE_CLOUD_PROJECT=' }
$env:TF_VAR_project_id = ($projectLine -split '=', 2)[1].Trim()
terraform init
terraform plan -out=agent-search.tfplan
terraform apply agent-search.tfplan
terraform output
```

출력된 `data_store_collection`과 `data_store_id`를 `.env`에 추가한 뒤 `EVIDENCE_RETRIEVER_BACKEND=agent_platform_search`로 전환한다.

새 데이터 스토어가 검색 색인을 만들도록 기존 Gemini Enterprise 앱에 연결한다.

```powershell
uv run scripts/attach_data_store_to_engine.py `
  --project <GCP_PROJECT_ID> `
  --region global `
  --engine-id <GEMINI_ENTERPRISE_APP_ID> `
  --data-store-id jeju-neomeo-search-v2-collection_documents
```

최초 문서 수집 또는 자료 갱신 후 즉시 동기화하려면 다음 스크립트를 실행한다.

```powershell
$projectLine = Get-Content ../../.env | Where-Object { $_ -match '^GOOGLE_CLOUD_PROJECT=' }
$projectId = ($projectLine -split '=', 2)[1].Trim()
uv run scripts/start_connector_run.py `
  --project $projectId `
  --region global `
  --collection-id jeju-neomeo-search-v2-collection `
  --wait
```

2026-08-24 기준 Terraform 적용과 13개 승인 문서의 최초 수집 및 실제 검색 검증을 완료했다.

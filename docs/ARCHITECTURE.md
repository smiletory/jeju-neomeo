# 제주너머 기술 아키텍처

## 1. 설계 목표

제주너머는 게임 UI와 생성형 AI 판정을 분리합니다. 브라우저에는 GCP 인증정보와 판정 루브릭을 두지 않고, FastAPI 계층이 입력 계약·인증·결과 스트리밍을 담당합니다. 다중 에이전트는 문장 의미와 제주어 표현을 순서대로 검사하되 최종 퀘스트 통과 여부는 Python 결정론적 게이트가 확정합니다.

## 2. 전체 구조

```text
사용자 브라우저
  게임 UI · NPC 대화 · 미니게임 · 제주어 입력
          │ POST /api/evaluate/stream
          ▼
FastAPI 게임 서버
  입력 계약 · 프롬프트 공격 차단 · 근거 검색 · 결과 스트리밍
          │ 인증된 HTTPS
          ▼
Vertex AI Agent Runtime
  ADK SequentialAgent
    1. culture_judge
    2. dialect_judge
    3. reliability_verifier
          │
          ▼
Python deterministic gate
  pass · retry_relevance · retry_knowledge · retry_dialect
  retry_both · needs_review · system_error
```

근거 검색은 두 백엔드를 동일한 인터페이스로 제공합니다.

- `local_json`: `app/data/evidence.json` 승인 레지스트리 직접 검색
- `agent_platform_search`: 관리형 검색이 반환한 후보 ID를 로컬 승인 레지스트리로 재검증

## 3. 요청 처리 순서

1. `web/agent-api.js`가 `questId`, `questionId`, 답변과 시도 횟수를 전송합니다.
2. `app/evaluation_service.py`가 빈 답변과 명백한 프롬프트 공격을 검사합니다.
3. `app/rubrics.py`가 현재 질문에 맞는 의미 목표, 금지 의미, 필수 제주어 표현과 허용 힌트를 구성합니다.
4. 검색 계층이 현재 퀘스트와 제주어 특징에 허용된 근거만 반환합니다.
5. Agent Runtime의 `culture_judge`가 문장 전체 의미와 현재 대화 상황의 적합성을 판정합니다.
6. 의미가 통과한 경우에만 `dialect_judge`가 제주어 표현의 사용 여부와 문맥을 판정합니다.
7. `reliability_verifier`가 근거 ID, 상충 결과와 조작 시도를 교차 검증합니다.
8. `app/decision.py`가 구조화 결과와 허용 목록을 비교해 최종 상태를 결정합니다.
9. 단계별 상태와 피드백을 SSE로 브라우저에 전달합니다.

## 4. 에이전트 책임

### Meaning Judge

- 문장 전체의 의도와 상황 적합성 검사
- 제주어 단어가 포함되어도 의미가 반대이면 실패
- 문화 설명형 질문에서는 승인된 문화 근거와 일치 여부 검사
- 인사·부탁 같은 상황형 질문에서는 현재 대화 목적과 금지 의도 검사

### Dialect Judge

- Meaning Judge가 통과한 경우에만 실행
- 필수 제주어 표현 그룹 충족 여부 검사
- 낱말 존재뿐 아니라 뜻과 사용 맥락 검사
- 표준어만 사용하거나 잘못된 용법이면 제주어 보완 요청

### Reliability Verifier

- 두 판정 결과의 논리적 상충 확인
- 승인되지 않은 근거·힌트 ID 거부
- 사용자 답변 속 지시문이 판정 규칙을 바꾸지 못하도록 검증
- 불확실하거나 결과가 불완전하면 자동 통과 대신 검토·재시도 반환

## 5. 결정론적 방어

LLM 출력은 Pydantic 구조로 검증되며 모델이 직접 최종 통과를 확정하지 않습니다.

- 입력 공격은 Gemini 호출 전에 차단
- 현재 질문의 루브릭과 근거만 프롬프트에 전달
- 미승인 근거 ID와 다른 퀘스트 근거 제거
- 허용된 힌트 ID 외의 모델 생성 힌트 거부
- 의미 실패 시 제주어 판정 생략
- 구조화 출력 오류는 제한된 횟수만 재시도
- 에이전트 상충·낮은 신뢰도·누락 결과는 진행 차단

## 6. 게임과 AI의 경계

게임 상태, 장면 전환, NPC 대사, 미니게임, 보상은 `web/`에서 관리합니다. 판정 기준과 모델 호출은 `app/`에만 존재합니다. 따라서 퀘스트 UI를 바꿔도 API 계약을 유지하면 에이전트를 다시 구현할 필요가 없습니다.

## 7. 주요 디렉터리

```text
app/                         에이전트·루브릭·근거 검색·API·최종 게이트
app/data/                    승인 근거와 퀘스트 설정
web/                         게임 UI·스토리·지도·에셋
tests/unit/                  결정 로직과 API 단위 테스트
tests/eval/                  ADK 평가 데이터와 설정
artifacts/eval_inputs/       최종 릴리스 평가 입력
artifacts/grade_results/     보존된 최종 릴리스 평가 결과
infra/agent_search/          Agent Platform Search Terraform
deployment/terraform/        Agent Runtime 배포 Terraform
docs/                        아키텍처·평가·배포·출처 문서
```

## 8. 배포 기록과 현재 상태

검증 당시 게임 서버와 Agent Runtime은 서로 독립된 배포 단위였습니다.

- Cloud Run: 정적 게임 제공, FastAPI 프록시, Runtime 인증 호출, SSE 스트리밍
- Agent Runtime: ADK SequentialAgent 실행
- Agent Platform Search: 승인된 제주어 표현·의미·용례 후보 검색
- Cloud Logging·Trace: 요청 추적과 오류 관측

프로젝트 종료 후 과금되는 실행 리소스와 데이터 버킷은 제거했습니다. 저장소에는 재현을 위한 Dockerfile, Cloud Build, Terraform, 환경 변수 예시만 남아 있습니다. 실환경 식별자와 인증정보는 포함하지 않습니다.

## 9. 알려진 기술 부채

- 현재 ADK의 `SequentialAgent`는 향후 `Workflow`로 대체될 예정이라는 경고가 있습니다. 사용 중인 ADK 버전에서 동일한 하위 에이전트 구성이 완전히 호환될 때 마이그레이션해야 합니다.
- 관리형 검색 재배포 전에는 `scripts/export_agent_search_documents.py`로 업로드 문서를 다시 생성해야 합니다.
- 실제 모델 평가에는 Vertex AI 권한과 비용이 필요하므로 CI에서는 결정 로직과 UI 계약만 자동 검사합니다.

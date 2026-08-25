from types import SimpleNamespace

import pytest

from app.runtime_client import AgentRuntimeEvaluationClient, RuntimeClientError
from app.schemas import EvaluationRequest

RUNTIME_ID = (
    "projects/123456/locations/us-east1/reasoningEngines/987654"
)


class FakeSession:
    def __init__(self, response):
        self.response = response
        self.last_url = None
        self.last_json = None

    def post(self, url, *, json, timeout):
        self.last_url = url
        self.last_json = json
        return self.response


def test_runtime_client_builds_managed_api_request():
    response = SimpleNamespace(
        status_code=200,
        json=lambda: {
            "verdict": "pass",
            "knowledge_score": 1.0,
            "dialect_score": 1.0,
            "feedback_knowledge": "맞아요.",
            "feedback_dialect": "자연스러워요.",
            "trace_id": "trace-1",
        },
    )
    session = FakeSession(response)
    client = AgentRuntimeEvaluationClient(
        runtime_id=RUNTIME_ID,
        region="us-east1",
        session=session,
    )

    result = client._evaluate_sync(
        EvaluationRequest(
            quest_id="gujwa_songdang_01",
            question_id="community_reason",
            user_answer="마을의 안녕을 빌젠 모였수다.",
        )
    )

    assert result.verdict == "pass"
    assert session.last_url.endswith(f"/{RUNTIME_ID}/api/evaluate")
    assert session.last_json["quest_id"] == "gujwa_songdang_01"


def test_runtime_client_rejects_region_mismatch():
    with pytest.raises(ValueError, match="위치가 다릅니다"):
        AgentRuntimeEvaluationClient(
            runtime_id=RUNTIME_ID,
            region="asia-northeast3",
            session=FakeSession(None),
        )


def test_runtime_never_proxies_back_to_itself(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLOUD_AGENT_ENGINE_ID", "8767329798025379840")
    monkeypatch.setenv("AGENT_EXECUTION_BACKEND", "agent_runtime")

    assert AgentRuntimeEvaluationClient.from_environment() is None


def test_runtime_client_fails_closed_on_http_error():
    client = AgentRuntimeEvaluationClient(
        runtime_id=RUNTIME_ID,
        region="us-east1",
        session=FakeSession(SimpleNamespace(status_code=503)),
    )
    with pytest.raises(RuntimeClientError, match="HTTP 503"):
        client._evaluate_sync(
            EvaluationRequest(
                quest_id="gujwa_songdang_01",
                user_answer="마을의 안녕을 빌젠 모였수다.",
            )
        )


@pytest.mark.asyncio
async def test_runtime_client_streams_stage_events_without_buffering():
    class StreamResponse:
        status_code = 200

        @staticmethod
        def iter_lines():
            yield b'{"type":"stage","stage":"culture","status":"completed"}'
            yield b'{"type":"result","data":{"verdict":"pass"}}'

    class StreamSession:
        def __init__(self):
            self.last_url = None
            self.stream = None

        def post(self, url, *, json, timeout, stream):
            self.last_url = url
            self.stream = stream
            return StreamResponse()

    session = StreamSession()
    client = AgentRuntimeEvaluationClient(
        runtime_id=RUNTIME_ID,
        region="us-east1",
        session=session,
    )
    request = EvaluationRequest(
        quest_id="gujwa_songdang_01",
        user_answer="마을의 안녕을 빌젠 모영 이어온 거우다.",
    )

    lines = [line async for line in client.evaluate_stream(request)]

    assert session.stream is True
    assert session.last_url.endswith(f"/{RUNTIME_ID}/api/evaluate-stream")
    assert '"stage":"culture"' in lines[0]
    assert '"type":"result"' in lines[1]

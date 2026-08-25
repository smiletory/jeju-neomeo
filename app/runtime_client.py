"""Authenticated client used by the desktop server to call Agent Runtime."""

from __future__ import annotations

import asyncio
import json
import os
import re
from typing import Any

import google.auth
from google.auth.transport.requests import AuthorizedSession
from pydantic import ValidationError

from app.schemas import EvaluationRequest, EvaluationResponse

_RUNTIME_ID_PATTERN = re.compile(
    r"^projects/[0-9]+/locations/[a-z0-9-]+/reasoningEngines/[0-9]+$"
)


class RuntimeClientError(Exception):
    """A safe, user-facing failure from the managed Runtime call."""


class AgentRuntimeEvaluationClient:
    """Forward evaluation requests without exposing Google credentials to the UI."""

    def __init__(
        self,
        *,
        runtime_id: str,
        region: str,
        timeout_seconds: float = 180.0,
        session: Any | None = None,
    ) -> None:
        runtime_id = runtime_id.strip()
        region = region.strip()
        if not _RUNTIME_ID_PATTERN.fullmatch(runtime_id):
            raise ValueError("AGENT_RUNTIME_ID 형식이 올바르지 않습니다.")
        if f"/locations/{region}/" not in runtime_id:
            raise ValueError("AGENT_RUNTIME_REGION과 Runtime ID의 위치가 다릅니다.")
        if timeout_seconds <= 0:
            raise ValueError("AGENT_RUNTIME_TIMEOUT_SECONDS는 0보다 커야 합니다.")

        self.runtime_id = runtime_id
        self.region = region
        self.timeout_seconds = timeout_seconds
        self.url = (
            f"https://{region}-aiplatform.googleapis.com/reasoningEngines/v1/"
            f"{runtime_id}/api/evaluate"
        )
        self.stream_url = (
            f"https://{region}-aiplatform.googleapis.com/reasoningEngines/v1/"
            f"{runtime_id}/api/evaluate-stream"
        )
        if session is None:
            credentials, _ = google.auth.default(
                scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )
            session = AuthorizedSession(credentials)
        self._session = session

    @classmethod
    def from_environment(cls) -> AgentRuntimeEvaluationClient | None:
        # Agent Runtime injects this value. Never let a deployed Runtime proxy
        # back to itself even if a desktop-only .env value is packaged by mistake.
        if os.getenv("GOOGLE_CLOUD_AGENT_ENGINE_ID"):
            return None
        backend = os.getenv("AGENT_EXECUTION_BACKEND", "local").strip().lower()
        if backend == "local":
            return None
        if backend != "agent_runtime":
            raise ValueError(f"지원하지 않는 AGENT_EXECUTION_BACKEND: {backend!r}")
        runtime_id = os.getenv("AGENT_RUNTIME_ID", "")
        region = os.getenv("AGENT_RUNTIME_REGION", "us-east1")
        timeout = float(os.getenv("AGENT_RUNTIME_TIMEOUT_SECONDS", "180"))
        return cls(runtime_id=runtime_id, region=region, timeout_seconds=timeout)

    async def evaluate(self, request: EvaluationRequest) -> EvaluationResponse:
        return await asyncio.to_thread(self._evaluate_sync, request)

    async def evaluate_stream(self, request: EvaluationRequest):
        """Proxy Agent Runtime NDJSON without buffering stage events."""

        queue: asyncio.Queue[str | Exception | None] = asyncio.Queue()
        loop = asyncio.get_running_loop()

        def publish(item: str | Exception | None) -> None:
            loop.call_soon_threadsafe(queue.put_nowait, item)

        def consume() -> None:
            try:
                response = self._session.post(
                    self.stream_url,
                    json=request.model_dump(mode="json"),
                    timeout=self.timeout_seconds,
                    stream=True,
                )
                if response.status_code == 404:
                    result = self._evaluate_sync(request)
                    publish(
                        json.dumps(
                            {
                                "type": "result",
                                "data": result.model_dump(mode="json"),
                            },
                            ensure_ascii=False,
                        )
                        + "\n"
                    )
                    return
                if response.status_code >= 400:
                    raise RuntimeClientError(
                        "Agent Runtime 단계별 판정 요청이 실패했습니다. "
                        f"(HTTP {response.status_code})"
                    )
                for raw_line in response.iter_lines():
                    if not raw_line:
                        continue
                    line = (
                        raw_line.decode("utf-8")
                        if isinstance(raw_line, bytes)
                        else str(raw_line)
                    )
                    json.loads(line)
                    publish(line + "\n")
            except Exception as exc:
                publish(
                    exc
                    if isinstance(exc, RuntimeClientError)
                    else RuntimeClientError(
                        "Agent Runtime 단계별 판정에 연결하지 못했습니다."
                    )
                )
            finally:
                publish(None)

        worker = asyncio.create_task(asyncio.to_thread(consume))
        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                if isinstance(item, Exception):
                    yield json.dumps(
                        {
                            "type": "error",
                            "status": 502,
                            "detail": str(item),
                        },
                        ensure_ascii=False,
                    ) + "\n"
                    continue
                yield item
        finally:
            await worker

    def _evaluate_sync(self, request: EvaluationRequest) -> EvaluationResponse:
        try:
            response = self._session.post(
                self.url,
                json=request.model_dump(mode="json"),
                timeout=self.timeout_seconds,
            )
        except Exception as exc:
            raise RuntimeClientError(
                "Agent Runtime에 연결하지 못했습니다. 잠시 후 다시 시도해주세요."
            ) from exc
        if response.status_code >= 400:
            raise RuntimeClientError(
                f"Agent Runtime 판정 요청이 실패했습니다. (HTTP {response.status_code})"
            )
        try:
            return EvaluationResponse.model_validate(response.json())
        except (ValueError, ValidationError) as exc:
            raise RuntimeClientError(
                "Agent Runtime 응답 형식이 올바르지 않습니다."
            ) from exc

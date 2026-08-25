"""FastAPI routes shared by the local game and Agent Runtime app."""

from __future__ import annotations

import asyncio
import json
from contextlib import suppress

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.evaluation_service import (
    EvaluationServiceError,
    evaluate_answer,
    get_health_payload,
)
from app.runtime_client import RuntimeClientError
from app.schemas import EvaluationRequest, EvaluationResponse

router = APIRouter()


def _stream_line(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=False) + "\n"


@router.get("/health")
async def health(request: Request) -> dict[str, str]:
    if getattr(request.app.state, "runtime_evaluation_client", None) is not None:
        return {
            "status": "ok",
            "agent": "answer_evaluation_pipeline",
            "execution_backend": "agent_runtime",
            "retrieval_backend": "agent_platform_search",
        }
    return get_health_payload() | {"execution_backend": "local"}


@router.post("/evaluate", response_model=EvaluationResponse)
async def evaluate(
    evaluation_request: EvaluationRequest,
    request: Request,
) -> EvaluationResponse:
    runtime_client = getattr(request.app.state, "runtime_evaluation_client", None)
    if runtime_client is not None:
        try:
            return await runtime_client.evaluate(evaluation_request)
        except RuntimeClientError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
    try:
        return await evaluate_answer(
            evaluation_request,
            runner=request.app.state.runner,
            session_service=request.app.state.session_service,
        )
    except EvaluationServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.detail,
        ) from exc


@router.post("/evaluate-stream")
async def evaluate_stream(
    evaluation_request: EvaluationRequest,
    request: Request,
) -> StreamingResponse:
    """Stream real ADK sub-agent completion events and the final verdict."""

    runtime_client = getattr(request.app.state, "runtime_evaluation_client", None)
    if runtime_client is not None:
        return StreamingResponse(
            runtime_client.evaluate_stream(evaluation_request),
            media_type="application/x-ndjson",
            headers={"Cache-Control": "no-cache"},
        )

    async def event_stream():
        queue: asyncio.Queue[dict | None] = asyncio.Queue()

        async def on_stage_complete(stage: str) -> None:
            await queue.put(
                {"type": "stage", "stage": stage, "status": "completed"}
            )

        async def run_evaluation() -> None:
            try:
                result = await evaluate_answer(
                    evaluation_request,
                    runner=request.app.state.runner,
                    session_service=request.app.state.session_service,
                    on_stage_complete=on_stage_complete,
                )
                await queue.put(
                    {
                        "type": "result",
                        "data": result.model_dump(mode="json"),
                    }
                )
            except EvaluationServiceError as exc:
                await queue.put(
                    {
                        "type": "error",
                        "status": exc.status_code,
                        "detail": exc.detail,
                    }
                )
            except Exception:
                await queue.put(
                    {
                        "type": "error",
                        "status": 500,
                        "detail": "판정 스트림을 완료하지 못했습니다.",
                    }
                )
            finally:
                await queue.put(None)

        task = asyncio.create_task(run_evaluation())
        yield _stream_line(
            {"type": "stage", "stage": "culture", "status": "working"}
        )
        try:
            while True:
                event = await queue.get()
                if event is None:
                    break
                yield _stream_line(event)
        finally:
            if not task.done():
                task.cancel()
            with suppress(asyncio.CancelledError):
                await task

    return StreamingResponse(
        event_stream(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache"},
    )

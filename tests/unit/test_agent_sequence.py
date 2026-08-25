import json
from types import SimpleNamespace

from app.agent import root_agent, skip_dialect_when_meaning_fails
from app.schemas import DialectResult


def test_root_agent_runs_specialists_in_strict_order() -> None:
    assert [agent.name for agent in root_agent.sub_agents] == [
        "culture_judge",
        "dialect_judge",
        "reliability_verifier",
    ]


def test_dialect_agent_is_skipped_after_meaning_failure() -> None:
    content = skip_dialect_when_meaning_fails(
        SimpleNamespace(
            state={
                "culture_result": json.dumps(
                    {
                        "answer_relevance": "off_topic",
                        "knowledge_pass": False,
                        "score": 0.0,
                        "confidence": 0.95,
                    }
                )
            }
        )
    )

    assert content is not None
    result = DialectResult.model_validate_json(content.parts[0].text)
    assert result.evaluation_skipped is True


def test_dialect_agent_runs_after_meaning_pass() -> None:
    content = skip_dialect_when_meaning_fails(
        SimpleNamespace(
            state={
                "culture_result": json.dumps(
                    {
                        "answer_relevance": "on_topic",
                        "knowledge_pass": True,
                        "score": 0.95,
                        "confidence": 0.95,
                    }
                )
            }
        )
    )

    assert content is None

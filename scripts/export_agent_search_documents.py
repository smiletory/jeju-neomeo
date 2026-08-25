"""Export approved evidence as Discovery Engine custom-schema JSONL."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.environment import PROJECT_ROOT
from app.evidence import EvidenceStore
from app.evidence.retrievers import DEFAULT_EVIDENCE_PATH

DEFAULT_OUTPUT = PROJECT_ROOT / "artifacts" / "agent_search" / "evidence.jsonl"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DEFAULT_EVIDENCE_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    store = EvidenceStore.model_validate_json(args.input.read_text(encoding="utf-8"))
    documents = []
    for record in store.records:
        if not record.approved:
            continue
        documents.append(
            {
                "id": record.evidence_id,
                "evidence_id": record.evidence_id,
                "domain": record.domain,
                "version": record.version,
                "quest_ids": record.quest_ids,
                "learning_goal_ids": record.learning_goal_ids,
                "feature_id": record.feature_id or "",
                "forms": record.forms,
                "content": record.content,
                "source_title": record.source.title,
                "source_publisher": record.source.publisher,
                "source_url": str(record.source.url),
            }
        )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    payload = "\n".join(
        json.dumps(document, ensure_ascii=False, separators=(",", ":"))
        for document in documents
    )
    args.output.write_text(payload + "\n", encoding="utf-8")
    print(f"Wrote {len(documents)} documents to {args.output}")


if __name__ == "__main__":
    main()

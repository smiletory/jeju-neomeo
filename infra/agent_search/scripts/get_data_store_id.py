#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["google-api-python-client", "google-auth"]
# ///
"""Resolve the auto-generated data store and collection IDs for Terraform.

Adapted from google/adk-samples core/python/rag-agent-search (Apache-2.0).
"""

import json
import sys

import google.auth
from googleapiclient import discovery


def main() -> None:
    query = json.load(sys.stdin)
    project_id = query["project_id"]
    location = query["location"]
    collection_id = query["collection_id"]
    credentials, _ = google.auth.default()
    endpoint = (
        "https://discoveryengine.googleapis.com"
        if location == "global"
        else f"https://{location}-discoveryengine.googleapis.com"
    )
    service = discovery.build(
        "discoveryengine",
        "v1alpha",
        credentials=credentials,
        discoveryServiceUrl=f"{endpoint}/$discovery/rest?version=v1alpha",
    )
    connector_name = (
        f"projects/{project_id}/locations/{location}"
        f"/collections/{collection_id}/dataConnector"
    )
    connector = (
        service.projects()
        .locations()
        .collections()
        .getDataConnector(name=connector_name)
        .execute()
    )
    entities = connector.get("entities", [])
    if not entities or not entities[0].get("dataStore"):
        raise RuntimeError("Data connector has no resolved data store")
    parts = entities[0]["dataStore"].split("/")
    data_store_index = parts.index("dataStores")
    collection_index = parts.index("collections")
    json.dump(
        {
            "data_store_id": parts[data_store_index + 1],
            "collection_id": parts[collection_index + 1],
        },
        sys.stdout,
    )


if __name__ == "__main__":
    main()

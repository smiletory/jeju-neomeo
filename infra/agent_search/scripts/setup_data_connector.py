#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["click", "google-api-python-client", "google-auth"]
# ///
"""Create the managed GCS connector used by Agent Platform Search.

Adapted from google/adk-samples core/python/rag-agent-search (Apache-2.0).
"""

import sys
import time

import click
import google.auth
from googleapiclient import discovery
from googleapiclient.errors import HttpError


def _build_service(location: str):
    credentials, _ = google.auth.default()
    endpoint = (
        "https://discoveryengine.googleapis.com"
        if location == "global"
        else f"https://{location}-discoveryengine.googleapis.com"
    )
    return discovery.build(
        "discoveryengine",
        "v1alpha",
        credentials=credentials,
        discoveryServiceUrl=f"{endpoint}/$discovery/rest?version=v1alpha",
    )


@click.command()
@click.argument("project_id")
@click.argument("location")
@click.argument("collection_id")
@click.argument("display_name")
@click.argument("gcs_uri")
@click.option("--refresh-interval", default="86400s")
@click.option(
    "--data-schema",
    default="document",
    type=click.Choice(["content", "document", "csv", "custom"]),
)
def main(
    project_id: str,
    location: str,
    collection_id: str,
    display_name: str,
    gcs_uri: str,
    refresh_interval: str,
    data_schema: str,
) -> None:
    service = _build_service(location)
    parent = f"projects/{project_id}/locations/{location}"
    connector_name = f"{parent}/collections/{collection_id}/dataConnector"

    try:
        existing = (
            service.projects()
            .locations()
            .collections()
            .getDataConnector(name=connector_name)
            .execute()
        )
        click.echo(
            "Data connector already exists "
            f"(state: {existing.get('state', 'UNKNOWN')})."
        )
        return
    except HttpError as exc:
        if exc.resp.status != 404:
            raise

    entity_params = {"data_schema": data_schema}
    if data_schema == "content":
        entity_params["content_config"] = "CONTENT_REQUIRED"
    elif data_schema in ("csv", "custom"):
        entity_params["auto_generate_ids"] = False
        entity_params["id_field"] = "id"

    operation = (
        service.projects()
        .locations()
        .setUpDataConnectorV2(
            parent=parent,
            collectionId=collection_id,
            collectionDisplayName=display_name,
            body={
                "dataSource": "gcs",
                "refreshInterval": refresh_interval,
                "params": {"instance_uris": [gcs_uri.rstrip("/") + "/*"]},
                "entities": [
                    {"entityName": "documents", "params": entity_params}
                ],
                "staticIpEnabled": False,
            },
        )
        .execute()
    )
    if operation.get("done", False):
        click.echo("Data connector created successfully.")
        return

    operation_name = operation.get("name", "")
    for attempt in range(1, 61):
        time.sleep(10)
        status = (
            service.projects()
            .locations()
            .collections()
            .dataConnector()
            .operations()
            .get(name=operation_name)
            .execute()
        )
        if status.get("done", False):
            if "error" in status:
                click.echo(str(status["error"]), err=True)
                sys.exit(1)
            click.echo("Data connector created successfully.")
            return
        click.echo(f"Waiting for connector: {attempt}/60")

    click.echo("Connector creation timed out.", err=True)
    sys.exit(1)


if __name__ == "__main__":
    main()

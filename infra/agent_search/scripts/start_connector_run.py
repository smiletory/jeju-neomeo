#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["click", "google-api-python-client", "google-auth"]
# ///
"""Run an immediate managed synchronization for the GCS data connector.

Adapted from google/adk-samples core/python/rag-agent-search (Apache-2.0).
"""

import sys
import time

import click
import google.auth
from googleapiclient import discovery


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
@click.option("--project", required=True, help="GCP project ID.")
@click.option("--region", required=True, help="Discovery Engine location.")
@click.option("--collection-id", required=True, help="Connector collection ID.")
@click.option("--wait", is_flag=True, help="Poll until the import completes.")
def main(project: str, region: str, collection_id: str, wait: bool) -> None:
    service = _build_service(region)
    connector_name = (
        f"projects/{project}/locations/{region}"
        f"/collections/{collection_id}/dataConnector"
    )
    connector = (
        service.projects()
        .locations()
        .collections()
        .getDataConnector(name=connector_name)
        .execute()
    )

    if connector.get("state") == "FAILED":
        click.echo("The connector is already in a failed state.", err=True)
        sys.exit(1)

    connector_run = (
        service.projects()
        .locations()
        .collections()
        .dataConnector()
        .startConnectorRun(parent=connector_name, body={})
        .execute()
    )
    run_name = connector_run.get("name", "")
    if not run_name:
        click.echo("The connector run response has no resource name.", err=True)
        sys.exit(1)
    runs_parent = run_name.rsplit("/connectorRuns/", 1)[0]
    click.echo(f"Connector run started: {run_name.rsplit('/', 1)[-1]}")
    if not wait:
        return

    for attempt in range(1, 121):
        time.sleep(5)
        response = (
            service.projects()
            .locations()
            .collections()
            .dataConnector()
            .connectorRuns()
            .list(parent=runs_parent, pageSize=50)
            .execute()
        )
        run = next(
            (
                item
                for item in response.get("connectorRuns", [])
                if item.get("name") == run_name
            ),
            None,
        )
        if run is None or run.get("state") not in {
            "SUCCEEDED",
            "FAILED",
            "CANCELLED",
        }:
            click.echo(f"Waiting for connector run: {attempt}/120")
            continue
        if run.get("state") != "SUCCEEDED":
            click.echo(f"Connector run failed: {run}", err=True)
            sys.exit(1)
        entity_runs = run.get("entityRuns", [])
        entity = entity_runs[0] if entity_runs else {}
        click.echo(
            "Connector run completed: "
            f"indexed={entity.get('indexedRecordCount', '0')}; "
            f"errors={entity.get('errorRecordCount', '0')}; "
            f"sync_type={entity.get('syncType', 'UNKNOWN')}."
        )
        return

    click.echo("Connector run did not complete within 10 minutes.", err=True)
    sys.exit(1)


if __name__ == "__main__":
    main()

#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["click", "google-api-python-client", "google-auth"]
# ///
"""Delete the managed connector collection during terraform destroy.

Adapted from google/adk-samples core/python/rag-agent-search (Apache-2.0).
"""

import sys
import time

import click
import google.auth
from googleapiclient import discovery
from googleapiclient.errors import HttpError


@click.command()
@click.argument("project_id")
@click.argument("location")
@click.argument("collection_id")
def main(project_id: str, location: str, collection_id: str) -> None:
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
    name = (
        f"projects/{project_id}/locations/{location}/collections/{collection_id}"
    )
    try:
        operation = (
            service.projects().locations().collections().delete(name=name).execute()
        )
        operation_name = operation.get("name", "")
        for _ in range(60):
            if not operation_name:
                break
            status = (
                service.projects()
                .locations()
                .operations()
                .get(name=operation_name)
                .execute()
            )
            if status.get("done", False):
                if "error" in status:
                    click.echo(str(status["error"]), err=True)
                    sys.exit(1)
                break
            time.sleep(5)
        else:
            click.echo("Collection deletion timed out.", err=True)
            sys.exit(1)
        click.echo("Collection deleted successfully.")
    except HttpError as exc:
        if exc.resp.status == 404:
            click.echo("Collection already deleted.")
            return
        click.echo(str(exc), err=True)
        sys.exit(1)


if __name__ == "__main__":
    main()

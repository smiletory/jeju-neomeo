#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["click", "google-api-python-client", "google-auth"]
# ///
"""Attach a data store to an existing Gemini Enterprise search engine."""

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
@click.option("--region", default="global", show_default=True)
@click.option("--engine-id", required=True, help="Gemini Enterprise engine ID.")
@click.option("--data-store-id", required=True, help="Data store ID to attach.")
def main(project: str, region: str, engine_id: str, data_store_id: str) -> None:
    service = _build_service(region)
    name = (
        f"projects/{project}/locations/{region}/collections/default_collection"
        f"/engines/{engine_id}"
    )
    engine = (
        service.projects()
        .locations()
        .collections()
        .engines()
        .get(name=name)
        .execute()
    )
    data_store_ids = list(engine.get("dataStoreIds", []))
    if data_store_id in data_store_ids:
        click.echo(f"Data store already attached: {data_store_id}")
        return

    data_store_ids.append(data_store_id)
    updated = (
        service.projects()
        .locations()
        .collections()
        .engines()
        .patch(
            name=name,
            updateMask="data_store_ids",
            body={"name": name, "dataStoreIds": data_store_ids},
        )
        .execute()
    )
    if data_store_id not in updated.get("dataStoreIds", []):
        raise click.ClickException("The engine response omitted the new data store ID.")
    click.echo(f"Attached data store: {data_store_id}")


if __name__ == "__main__":
    main()

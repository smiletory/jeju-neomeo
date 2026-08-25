locals {
  required_services = toset([
    "cloudresourcemanager.googleapis.com",
    "discoveryengine.googleapis.com",
    "serviceusage.googleapis.com",
    "storage.googleapis.com",
  ])
  collection_id = "${var.project_name}-v2-collection"
}

resource "google_project_service" "required" {
  for_each           = local.required_services
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_storage_bucket" "evidence" {
  name                        = "${var.project_id}-${var.project_name}-docs"
  location                    = var.region
  project                     = var.project_id
  uniform_bucket_level_access = true
  force_destroy               = true

  depends_on = [google_project_service.required]
}

resource "google_storage_bucket_object" "evidence_jsonl" {
  name         = "evidence/evidence.jsonl"
  bucket       = google_storage_bucket.evidence.name
  source       = "${path.module}/../../artifacts/agent_search/evidence.jsonl"
  content_type = "application/x-ndjson"
}

resource "null_resource" "data_connector" {
  triggers = {
    project_id    = var.project_id
    location      = var.data_store_region
    collection_id = local.collection_id
    scripts_dir   = "${path.module}/scripts"
    object_md5    = google_storage_bucket_object.evidence_jsonl.md5hash
    data_schema   = "custom"
  }

  provisioner "local-exec" {
    command = "uv run ${path.module}/scripts/setup_data_connector.py ${var.project_id} ${var.data_store_region} ${local.collection_id} ${var.project_name} gs://${google_storage_bucket.evidence.name}/evidence --refresh-interval ${var.data_connector_refresh_interval} --data-schema custom"
  }

  provisioner "local-exec" {
    when    = destroy
    command = "uv run ${self.triggers.scripts_dir}/delete_data_connector.py ${self.triggers.project_id} ${self.triggers.location} ${self.triggers.collection_id}"
  }

  depends_on = [google_storage_bucket_object.evidence_jsonl]
}

data "external" "data_store" {
  program = ["uv", "run", "${path.module}/scripts/get_data_store_id.py"]

  query = {
    project_id    = var.project_id
    location      = var.data_store_region
    collection_id = local.collection_id
  }

  depends_on = [null_resource.data_connector]
}

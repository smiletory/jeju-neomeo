output "docs_bucket_name" {
  description = "GCS bucket synchronized by the managed data connector."
  value       = google_storage_bucket.evidence.name
}

output "data_store_collection" {
  description = "Set as DATA_STORE_COLLECTION in .env."
  value       = data.external.data_store.result.collection_id
}

output "data_store_id" {
  description = "Set as DATA_STORE_ID in .env."
  value       = data.external.data_store.result.data_store_id
}

output "data_store_path" {
  description = "Full data store path used by the runtime adapter."
  value       = "projects/${var.project_id}/locations/${var.data_store_region}/collections/${data.external.data_store.result.collection_id}/dataStores/${data.external.data_store.result.data_store_id}"
}

variable "project_id" {
  type        = string
  description = "GCP project ID. Pass with TF_VAR_project_id; do not commit it here."
}

variable "project_name" {
  type        = string
  description = "Base name for the managed search resources."
  default     = "jeju-neomeo-search"
}

variable "region" {
  type        = string
  description = "Region for the GCS evidence bucket."
  default     = "asia-northeast3"
}

variable "data_store_region" {
  type        = string
  description = "Agent Platform Search data store location."
  default     = "global"
}

variable "data_connector_refresh_interval" {
  type        = string
  description = "Periodic GCS connector refresh interval."
  default     = "86400s"
}

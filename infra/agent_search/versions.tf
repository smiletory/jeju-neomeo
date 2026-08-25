terraform {
  required_version = ">= 1.5.0"

  required_providers {
    external = {
      source  = "hashicorp/external"
      version = "~> 2.3"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 7.13"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google" {
  alias                 = "billing_override"
  billing_project       = var.project_id
  project               = var.project_id
  region                = var.region
  user_project_override = true
}

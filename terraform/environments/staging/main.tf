terraform {
  required_version = ">= 1.6"
  backend "s3" {
    bucket         = "mugheer-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "mugheer-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = "us-east-1"
}

module "network" {
  source             = "../../modules/network"
  environment        = "staging"
  availability_zones = ["us-east-1a", "us-east-1b"]
}

module "storage" {
  source      = "../../modules/storage"
  environment = "staging"
}

module "iam" {
  source      = "../../modules/iam"
  environment = "staging"
}

module "database" {
  source                = "../../modules/database"
  environment           = "staging"
  db_subnet_ids         = module.network.db_subnet_ids
  app_security_group_id = module.compute.app_security_group_id
  multi_az              = false
  instance_class        = "db.t4g.small"
}

module "compute" {
  source             = "../../modules/compute"
  environment        = "staging"
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
}

# DNS + TLS: Route53 records and ACM cert for staging hosts — the cert ARN
# output here is what the ingress/ALB listeners reference (spec 7.4).
module "dns_cert" {
  source      = "../../modules/dns_cert"
  environment = "staging"
  domain_name = "staging.mugheer-tech.com"
}

# CloudWatch alarms as the baseline monitoring layer beneath Prometheus.
module "monitoring" {
  source         = "../../modules/monitoring"
  environment    = "staging"
  db_instance_id = module.database.db_instance_id
}

output "vpc_id" { value = module.network.vpc_id }
output "db_endpoint" { value = module.database.db_endpoint }
output "assets_bucket" { value = module.storage.assets_bucket }
output "certificate_arn" { value = module.dns_cert.certificate_arn }
output "api_fqdn" { value = module.dns_cert.api_fqdn }
output "app_fqdn" { value = module.dns_cert.app_fqdn }
output "alarm_names" { value = module.monitoring.alarm_names }

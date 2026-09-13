terraform {
  required_version = ">= 1.6"
  backend "s3" {
    bucket         = "mugheer-terraform-state"
    key            = "production/terraform.tfstate"
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
  environment        = "production"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

module "storage" {
  source      = "../../modules/storage"
  environment = "production"
}

module "iam" {
  source      = "../../modules/iam"
  environment = "production"
}

module "database" {
  source               = "../../modules/database"
  environment          = "production"
  db_subnet_ids        = module.network.db_subnet_ids
  app_security_group_id = module.compute.app_security_group_id
  multi_az             = true
  instance_class       = "db.r6g.large"
}

module "compute" {
  source             = "../../modules/compute"
  environment        = "production"
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
}

# DNS + TLS: Route53 records and ACM cert for mugheer-tech.com and subdomains.
module "dns_cert" {
  source      = "../../modules/dns_cert"
  environment = "production"
  domain_name = "mugheer-tech.com"
}

# CloudWatch alarms as the baseline monitoring layer beneath Prometheus.
module "monitoring" {
  source         = "../../modules/monitoring"
  environment    = "production"
  db_instance_id = module.database.db_instance_id
}

output "vpc_id" { value = module.network.vpc_id }
output "db_endpoint" { value = module.database.db_endpoint }
output "assets_bucket" { value = module.storage.assets_bucket }
output "certificate_arn" { value = module.dns_cert.certificate_arn }
output "api_fqdn" { value = module.dns_cert.api_fqdn }
output "app_fqdn" { value = module.dns_cert.app_fqdn }
output "alarm_names" { value = module.monitoring.alarm_names }

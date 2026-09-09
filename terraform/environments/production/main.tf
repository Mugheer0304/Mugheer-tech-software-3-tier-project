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

output "vpc_id" { value = module.network.vpc_id }
output "db_endpoint" { value = module.database.db_endpoint }
output "assets_bucket" { value = module.storage.assets_bucket }

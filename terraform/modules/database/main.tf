terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "environment" { type = string }
variable "db_subnet_ids" { type = list(string) }
variable "app_security_group_id" { type = string }
variable "db_name" { type = string, default = "mugheer" }
variable "db_username" { type = string, default = "mugheer" }
variable "instance_class" { type = string, default = "db.t4g.medium" }
variable "multi_az" { type = bool, default = true }

resource "aws_db_subnet_group" "main" {
  name       = "mugheer-${var.environment}-db"
  subnet_ids = var.db_subnet_ids
}

resource "aws_security_group" "db" {
  name_prefix = "mugheer-${var.environment}-db-"
  description = "Postgres access from app tier only"

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.app_security_group_id]
  }

  # No egress needed for a database
  egress = []

  vpc_id = data.aws_vpc.selected.id
}

data "aws_vpc" "selected" {
  filter {
    name   = "tag:Name"
    values = ["mugheer-${var.environment}"]
  }
}

resource "aws_db_instance" "postgres" {
  identifier             = "mugheer-${var.environment}"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = var.instance_class
  allocated_storage      = 50
  max_allocated_storage  = 500
  storage_encrypted      = true
  db_name                = var.db_name
  username               = var.db_username
  password               = random_password.db.result
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  multi_az               = var.multi_az
  publicly_accessible    = false
  backup_retention_period = 14
  backup_window          = "02:00-03:00"
  deletion_protection    = var.environment == "production"
  skip_final_snapshot    = var.environment != "production"
  final_snapshot_identifier = var.environment == "production" ? "mugheer-prod-final" : null
}

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "db" {
  name = "mugheer/${var.environment}/db"
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    url = "postgresql://${var.db_username}:${random_password.db.result}@${aws_db_instance.postgres.address}:5432/${var.db_name}?schema=public"
  })
}

output "db_endpoint" {
  value = aws_db_instance.postgres.address
}

output "db_secret_arn" {
  value = aws_secretsmanager_secret.db.arn
}

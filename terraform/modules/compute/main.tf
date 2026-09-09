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
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "node_instance_type" { type = string, default = "m6i.large" }
variable "node_min" { type = number, default = 2 }
variable "node_max" { type = number, default = 6 }

resource "aws_security_group" "app" {
  name_prefix = "mugheer-${var.environment}-app-"
  vpc_id      = var.vpc_id
  description = "App tier: egress to internet via NAT, ingress from ALB only"

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Environment = var.environment }
}

resource "aws_security_group" "alb" {
  name_prefix = "mugheer-${var.environment}-alb-"
  vpc_id      = var.vpc_id
  description = "ALB: HTTPS from world"

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "mugheer-${var.environment}"
  cluster_version = "1.30"
  vpc_id          = var.vpc_id
  subnet_ids      = var.private_subnet_ids

  cluster_endpoint_public_access = true

  eks_managed_node_groups = {
    app = {
      instance_types = [var.node_instance_type]
      min_size       = var.node_min
      max_size       = var.node_max
      desired_size   = var.node_min
      # Spot for cost control on stateless capacity
      capacity_type  = var.environment == "staging" ? "SPOT" : "ON_DEMAND"
    }
  }

  tags = { Environment = var.environment }
}

output "app_security_group_id" {
  value = aws_security_group.app.id
}

output "cluster_name" {
  value = module.eks.cluster_name
}

output "cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

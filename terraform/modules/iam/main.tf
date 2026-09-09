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

data "aws_iam_policy_document" "app_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com", "ecs.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "app" {
  name               = "mugheer-${var.environment}-app"
  assume_role_policy = data.aws_iam_policy_document.app_assume.json
}

data "aws_iam_policy_document" "app_policy" {
  statement {
    sid = "S3Assets"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket",
    ]
    resources = ["arn:aws:s3:::mugheer-${var.environment}-assets", "arn:aws:s3:::mugheer-${var.environment}-assets/*"]
  }
  statement {
    sid = "SecretsRead"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = ["arn:aws:secretsmanager:*:*:secret:mugheer/${var.environment}/*"]
  }
  statement {
    sid = "CloudWatch"
    actions = ["cloudwatch:PutMetricData", "logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "app" {
  name   = "app-least-privilege"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.app_policy.json
}

output "app_role_arn" {
  value = aws_iam_role.app.arn
}

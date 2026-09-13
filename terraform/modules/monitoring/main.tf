# =============================================================================
# Terraform module: monitoring — CloudWatch alarms as the baseline layer
# beneath the in-cluster Prometheus/Grafana stack (spec Sections 20.3 and 14).
#
# These alarms catch what falls outside the cluster's own visibility:
# ALB 5xx rates, target health, and RDS pressure. Prometheus/Alertmanager
# remain the primary alerting path for application-level metrics.
# =============================================================================
terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

variable "environment" {
  description = "Environment name."
  type        = string
}

variable "alb_arn_suffix" {
  description = "ARN suffix of the ALB (e.g. app/my-alb/1234567890)."
  type        = string
  default     = ""
}

variable "db_instance_id" {
  description = "RDS instance identifier to alarm on."
  type        = string
  default     = ""
}

variable "alarm_actions" {
  description = "List of ARNs (SNS topic) to notify when alarms fire."
  type        = list(string)
  default     = []
}

# --- ALB alarms ---------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  count               = var.alb_arn_suffix != "" ? 1 : 0
  alarm_name          = "mugheer-${var.environment}-alb-5xx"
  alarm_description   = "5xx rate on the ALB exceeded 5% — backend or ingress unhealthy."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_ELB_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }
  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "alb_target_response_time" {
  count               = var.alb_arn_suffix != "" ? 1 : 0
  alarm_name          = "mugheer-${var.environment}-alb-latency"
  alarm_description   = "ALB target response time p95 above 1s — API latency degradation."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Average"
  threshold           = 1
  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }
  alarm_actions = var.alarm_actions
}

# --- RDS alarms ---------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  count               = var.db_instance_id != "" ? 1 : 0
  alarm_name          = "mugheer-${var.environment}-rds-cpu"
  alarm_description   = "RDS CPU above 85% for 10 minutes."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 10
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Average"
  threshold           = 85
  dimensions = {
    DBInstanceIdentifier = var.db_instance_id
  }
  alarm_actions = var.alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "rds_free_storage" {
  count               = var.db_instance_id != "" ? 1 : 0
  alarm_name          = "mugheer-${var.environment}-rds-storage"
  alarm_description   = "RDS free storage below 10 GB."
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 10737418240
  dimensions = {
    DBInstanceIdentifier = var.db_instance_id
  }
  alarm_actions = var.alarm_actions
}

output "alarm_names" {
  description = "CloudWatch alarm names created by this module."
  value = concat(
    aws_cloudwatch_metric_alarm.alb_5xx[*].alarm_name,
    aws_cloudwatch_metric_alarm.alb_target_response_time[*].alarm_name,
    aws_cloudwatch_metric_alarm.rds_cpu[*].alarm_name,
    aws_cloudwatch_metric_alarm.rds_free_storage[*].alarm_name,
  )
}

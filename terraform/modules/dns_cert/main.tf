# =============================================================================
# Terraform module: dns_cert — Route53 hosted zone, records and ACM certificates
# for mugheer-tech.com and its subdomains (spec Section 20.3).
#
# Outputs feed the Kubernetes ingress (k8s/base/ingress.yaml) and the ALB —
# the certificate ARN Terraform produces here is the exact value referenced by
# the ingress/ALB listeners, never re-typed by hand (spec Section 7.4).
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

data "aws_route53_zone" "this" {
  name = "${var.domain_name}."
}

# --- ACM certificate with DNS validation -------------------------------------
resource "aws_acm_certificate" "this" {
  domain_name               = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "validation" {
  for_each = {
    for dvo in aws_acm_certificate.this.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.this.zone_id
}

resource "aws_acm_certificate_validation" "this" {
  certificate_arn         = aws_acm_certificate.this.arn
  validation_record_fqdns = [for record in aws_route53_record.validation : record.fqdn]
}

# --- App + API records --------------------------------------------------------
resource "aws_route53_record" "app" {
  count   = var.alb_dns_name != "" ? 1 : 0
  zone_id = data.aws_route53_zone.this.zone_id
  name    = "${var.app_subdomain}.${var.domain_name}"
  type    = "CNAME"
  ttl     = 300
  records = [var.alb_dns_name]
}

resource "aws_route53_record" "api" {
  count   = var.alb_dns_name != "" ? 1 : 0
  zone_id = data.aws_route53_zone.this.zone_id
  name    = "${var.api_subdomain}.${var.domain_name}"
  type    = "CNAME"
  ttl     = 300
  records = [var.alb_dns_name]
}

output "certificate_arn" {
  description = "ACM certificate ARN for app/api hosts — consumed by the ingress/ALB."
  value       = aws_acm_certificate.this.arn
}

output "zone_id" {
  value = data.aws_route53_zone.this.zone_id
}

output "app_fqdn" {
  value = "${var.app_subdomain}.${var.domain_name}"
}

output "api_fqdn" {
  value = "${var.api_subdomain}.${var.domain_name}"
}

variable "environment" {
  description = "Environment name (staging | production)."
  type        = string
}

variable "domain_name" {
  description = "Root domain for the platform."
  type        = string
  default     = "mugheer-tech.com"
}

variable "app_subdomain" {
  description = "Subdomain serving the frontend SPA."
  type        = string
  default     = "app"
}

variable "api_subdomain" {
  description = "Subdomain serving the API."
  type        = string
  default     = "api"
}

variable "alb_dns_name" {
  description = "DNS name of the ALB / ingress load balancer that fronts the cluster."
  type        = string
  default     = ""
}

variable "alb_zone_id" {
  description = "Route53 zone ID of the ALB."
  type        = string
  default     = ""
}

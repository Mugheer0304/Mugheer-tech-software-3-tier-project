# terraform — Infrastructure as Code (AWS)

**What this does:** provisions everything the platform needs on AWS — VPC with public/private/database subnets across ≥2 AZs, an EKS cluster running on EC2 node groups (this satisfies the "deploy on EC2" requirement while giving Kubernetes orchestration), Multi-AZ encrypted RDS PostgreSQL with credentials written to Secrets Manager, versioned S3 buckets with lifecycle policies, least-privilege IAM, per-tier security groups (only the app tier can reach the database), and remote state with locking.

## Files

| Path | What it is |
|---|---|
| `modules/network/` | VPC, public/private/db subnets, IGW, NAT per AZ, route tables → outputs subnet IDs |
| `modules/compute/` | Per-tier security groups + EKS cluster & managed node groups (Spot in staging, On-Demand in production) |
| `modules/database/` | RDS Postgres 16 (Multi-AZ, encrypted, 14-day backups, deletion protection in prod), random password → Secrets Manager |
| `modules/storage/` | S3 `assets` (versioned, SSE, 90-day noncurrent expiry) + `backups` (30d → IA, 365d expiry) |
| `modules/iam/` | App execution role: S3 asset access, Secrets Manager read, CloudWatch logging — nothing more |
| `environments/staging/` | Composition: 2 AZs, db.t4g.small, single-AZ DB, Spot capacity |
| `environments/production/` | Composition: 3 AZs, db.r6g.large, Multi-AZ DB, On-Demand, deletion protection |

## One-time setup (before the first `apply`)

```bash
# 1. Remote state bucket + lock table (run once per AWS account)
aws s3 mb s3://mugheer-terraform-state --region us-east-1
aws s3api put-bucket-versioning --bucket mugheer-terraform-state \
  --versioning-configuration Status=Enabled
aws dynamodb create-table --table-name mugheer-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region us-east-1

# 2. Auth: use an IAM role (preferred) or a profile with admin on the target account
aws sts get-caller-identity   # sanity check
```

## Apply — step by step

```bash
cd terraform/environments/staging        # always staging first
terraform init                           # downloads providers, configures S3 backend
terraform plan -out=tfplan               # READ the plan: every +/~- line is a bill or a risk
terraform apply tfplan
```

Grab the outputs you'll need for Kubernetes/CI:

```bash
terraform output cluster_name            # → aws eks update-kubeconfig --name <this>
terraform output db_endpoint             # → DATABASE_URL host (password is in Secrets Manager)
terraform output assets_bucket
```

Then create the `backend-secrets` Kubernetes secret from Secrets Manager (see `../k8s/README.md`), and only move on to `environments/production` when staging is green end-to-end (CI `backend-integration` + smoke tests).

**Destroying** an environment: `terraform destroy` — production RDS has deletion protection and a final-snapshot guard, staging does not. Double-check you're in the right directory.

## How to work on it

### Changing infrastructure — step by step
1. Never edit modules and apply production in one step. Change the **module**, plan **staging**, apply, verify, then bump the environment composition for production and apply there with approval (the CD pipeline does the apply; the plan appears in the workflow logs).
2. New variables: add to the module's `variables.tf` with a `description`, defaulting sensibly; wire them from `environments/*/main.tf`.
3. Anything touching the database module is dangerous by definition — check `prevent_destroy`/`lifecycle` blocks before renaming resources (renames = destroy + create).
4. Format and validate before committing: `terraform fmt -recursive && terraform validate`.
5. Keep `MISSING: variables.tf/outputs.tf` in mind — the spec's layout lists them per module; when you extract a variable or need a new output, add the file rather than inlining.

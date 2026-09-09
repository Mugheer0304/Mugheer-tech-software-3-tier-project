  #!/usr/bin/env bash
###############################################################################
# Mugheer DevOps Toolchain Installer — AWS EC2 (Ubuntu) Edition
#
# Installs the LATEST available versions (resolved dynamically at run time,
# not hardcoded) of:
#   - Docker Engine + Docker Compose plugin (+ run-without-sudo group fix)
#   - Terraform
#   - kubectl (Kubernetes CLI) — tracks the latest stable Kubernetes minor
#   - AWS CLI v2
#   - Java — Eclipse Temurin, latest LTS build (currently Java 25)
#   - Jenkins (LTS)
#   - Node.js — latest Active LTS line
#   - NestJS CLI
#
# Target: Ubuntu on an AWS EC2 instance (22.04 / 24.04 / 26.04).
#
# Usage:
#   chmod +x install-devops-stack.sh
#   ./install-devops-stack.sh
#
# After it finishes: LOG OUT AND BACK IN (or run `newgrp docker`) so the
# docker group membership takes effect in your current shell.
###############################################################################

set -euo pipefail

# ---------- helpers ---------------------------------------------------------

log()  { echo -e "\n\033[1;32m==> $*\033[0m"; }
warn() { echo -e "\033[1;33m[warn] $*\033[0m"; }
err()  { echo -e "\033[1;31m[error] $*\033[0m" >&2; }

require_cmd() { command -v "$1" >/dev/null 2>&1; }

SUDO="sudo"
if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
fi

CURRENT_USER="${SUDO_USER:-$USER}"

# ---------- OS / EC2 sanity checks ------------------------------------------

if [ ! -f /etc/os-release ]; then
  err "Cannot detect OS (/etc/os-release missing). This script targets Ubuntu only."
  exit 1
fi

# shellcheck disable=SC1091
. /etc/os-release

if [ "${ID:-}" != "ubuntu" ]; then
  err "This script is built for Ubuntu (detected: ${ID:-unknown}). Aborting."
  exit 1
fi

UBUNTU_CODENAME_DETECTED="${VERSION_CODENAME:-$(lsb_release -sc 2>/dev/null || echo unknown)}"
log "Detected Ubuntu ${VERSION_ID:-unknown} (${UBUNTU_CODENAME_DETECTED})"

# Best-effort EC2 detection (does not fail the script if not on EC2 / IMDS blocked)
EC2_TOKEN="$(curl -s -m 2 -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" 2>/dev/null || true)"
if [ -n "$EC2_TOKEN" ]; then
  INSTANCE_ID="$(curl -s -m 2 -H "X-aws-ec2-metadata-token: $EC2_TOKEN" \
    http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null || echo unknown)"
  INSTANCE_TYPE="$(curl -s -m 2 -H "X-aws-ec2-metadata-token: $EC2_TOKEN" \
    http://169.254.169.254/latest/meta-data/instance-type 2>/dev/null || echo unknown)"
  log "Running on AWS EC2 — instance-id: ${INSTANCE_ID}, type: ${INSTANCE_TYPE}"
else
  warn "Could not confirm this is an EC2 instance (IMDS not reachable). Continuing anyway."
fi

# ---------- pre-flight -------------------------------------------------------

log "Updating apt package index"
$SUDO apt-get update -y

log "Installing base prerequisites"
$SUDO apt-get install -y \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  apt-transport-https \
  software-properties-common \
  unzip \
  jq \
  git

# ---------- 1. Docker + Docker Compose (always latest via official repo) ---

install_docker() {
  log "Installing / updating Docker Engine + Compose plugin (latest from Docker's official repo)"
  $SUDO install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    $SUDO gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
  $SUDO chmod a+r /etc/apt/keyrings/docker.gpg

  ARCH="$(dpkg --print-architecture)"
  echo \
    "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME_DETECTED} stable" | \
    $SUDO tee /etc/apt/sources.list.d/docker.list > /dev/null

  $SUDO apt-get update -y
  $SUDO apt-get install -y \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin

  log "Enabling and starting the Docker service"
  $SUDO systemctl enable docker
  $SUDO systemctl start docker

  # --- "chmod docker" fix: allow running docker without sudo ---
  log "Granting user '${CURRENT_USER}' permission to run Docker without sudo"
  if ! getent group docker >/dev/null; then
    $SUDO groupadd docker
  fi
  $SUDO usermod -aG docker "${CURRENT_USER}"

  if [ -S /var/run/docker.sock ]; then
    $SUDO chmod 666 /var/run/docker.sock
  fi

  log "Docker version : $(docker --version)"
  log "Compose version: $(docker compose version)"
}

# ---------- 2. Terraform (always latest via HashiCorp's official repo) -----

install_terraform() {
  log "Installing / updating Terraform (latest from HashiCorp's official repo)"
  curl -fsSL https://apt.releases.hashicorp.com/gpg | \
    $SUDO gpg --dearmor --yes -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
  echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com ${UBUNTU_CODENAME_DETECTED} main" | \
    $SUDO tee /etc/apt/sources.list.d/hashicorp.list > /dev/null
  $SUDO apt-get update -y
  $SUDO apt-get install -y terraform
  log "Terraform version: $(terraform -version | head -n1)"
}

# ---------- 3. kubectl — dynamically tracks the latest stable K8s minor ----

install_kubectl() {
  log "Resolving the latest stable Kubernetes release"
  local STABLE_FULL STABLE_MINOR
  STABLE_FULL="$(curl -fsSL https://dl.k8s.io/release/stable.txt)"   # e.g. v1.37.0
  STABLE_MINOR="$(echo "$STABLE_FULL" | sed -E 's/^(v[0-9]+\.[0-9]+)\..*/\1/')"  # e.g. v1.37
  log "Latest stable Kubernetes is ${STABLE_FULL} — installing kubectl from the ${STABLE_MINOR} package repo"

  $SUDO mkdir -p /etc/apt/keyrings
  curl -fsSL "https://pkgs.k8s.io/core:/stable:/${STABLE_MINOR}/deb/Release.key" | \
    $SUDO gpg --dearmor --yes -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
  echo "deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/${STABLE_MINOR}/deb/ /" | \
    $SUDO tee /etc/apt/sources.list.d/kubernetes.list > /dev/null

  $SUDO apt-get update -y
  $SUDO apt-get install -y kubectl
  log "kubectl version: $(kubectl version --client 2>/dev/null | head -n1 || echo installed)"
}

# ---------- 4. AWS CLI v2 (always fetches the latest installer) ------------

install_aws_cli() {
  log "Installing / updating AWS CLI v2 (always the latest published build)"
  local TMP_DIR ARCH AWS_PKG
  TMP_DIR="$(mktemp -d)"
  ARCH="$(uname -m)"
  if [ "$ARCH" = "x86_64" ]; then
    AWS_PKG="awscli-exe-linux-x86_64.zip"
  else
    AWS_PKG="awscli-exe-linux-aarch64.zip"
  fi
  curl -fsSL "https://awscli.amazonaws.com/${AWS_PKG}" -o "${TMP_DIR}/awscliv2.zip"
  unzip -q "${TMP_DIR}/awscliv2.zip" -d "${TMP_DIR}"

  if require_cmd aws; then
    $SUDO "${TMP_DIR}/aws/install" --update
  else
    $SUDO "${TMP_DIR}/aws/install"
  fi
  rm -rf "${TMP_DIR}"
  log "AWS CLI version: $(aws --version)"
  warn "On EC2, prefer an IAM instance role over 'aws configure' with static keys."
}

# ---------- 5. Java — Eclipse Temurin, latest LTS (dynamically resolved) ---

install_java() {
  log "Installing Eclipse Temurin JDK (latest LTS, resolved dynamically)"
  $SUDO mkdir -p /etc/apt/keyrings
  curl -fsSL https://packages.adoptium.net/artifactory/api/gpg/key/public | \
    $SUDO gpg --dearmor --yes -o /etc/apt/keyrings/adoptium.gpg
  echo "deb [signed-by=/etc/apt/keyrings/adoptium.gpg] https://packages.adoptium.net/artifactory/deb ${UBUNTU_CODENAME_DETECTED} main" | \
    $SUDO tee /etc/apt/sources.list.d/adoptium.list > /dev/null
  $SUDO apt-get update -y

  local LTS_VERSION
  LTS_VERSION="$(curl -fsSL https://api.adoptium.net/v3/info/available_releases | jq -r '.most_recent_lts')"
  if [ -z "$LTS_VERSION" ] || [ "$LTS_VERSION" = "null" ]; then
    warn "Could not resolve latest LTS from Adoptium API, defaulting to Java 25."
    LTS_VERSION=25
  fi

  log "Latest Java LTS is ${LTS_VERSION} — installing temurin-${LTS_VERSION}-jdk"
  $SUDO apt-get install -y "temurin-${LTS_VERSION}-jdk"
  log "Java version: $(java -version 2>&1 | head -n1)"
}

# ---------- 6. Jenkins (LTS) --------------------------------------------

install_jenkins() {
  if systemctl list-unit-files 2>/dev/null | grep -q '^jenkins.service'; then
    warn "Jenkins already installed; running apt-get install again to pick up updates."
  fi
  log "Installing / updating Jenkins (LTS) — requires the Java installed above"
  curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | \
    $SUDO tee /usr/share/keyrings/jenkins-keyring.asc > /dev/null
  echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" | \
    $SUDO tee /etc/apt/sources.list.d/jenkins.list > /dev/null
  $SUDO apt-get update -y
  $SUDO apt-get install -y jenkins
  $SUDO systemctl enable jenkins
  $SUDO systemctl start jenkins
  log "Jenkins installed and started (default port 8080)."
  echo "  Initial admin password: sudo cat /var/lib/jenkins/secrets/initialAdminPassword"
  warn "Remember to open port 8080 in your EC2 security group if you need external access."
}

# ---------- 7. Node.js (latest Active LTS) ----------------------------------

install_node() {
  log "Installing / updating Node.js (latest Active LTS line, via NodeSource)"
  curl -fsSL https://deb.nodesource.com/setup_lts.x | $SUDO -E bash -
  $SUDO apt-get install -y nodejs
  log "Node.js version: $(node --version)"
  log "npm version: $(npm --version)"
  log "Updating npm itself to its latest release"
  $SUDO npm install -g npm@latest
}

# ---------- 8. NestJS CLI ----------------------------------------------------

install_nestjs_cli() {
  log "Installing / updating the NestJS CLI globally (@nestjs/cli@latest)"
  $SUDO npm install -g @nestjs/cli@latest
  log "NestJS CLI version: $(nest --version 2>/dev/null || echo installed)"
}

# ---------- run everything ---------------------------------------------------

main() {
  install_docker
  install_terraform
  install_kubectl
  install_aws_cli
  install_java
  install_jenkins
  install_node
  install_nestjs_cli

  log "All installations complete."
  echo
  echo "Summary of installed tools:"
  echo "  docker           : $(docker --version 2>/dev/null || echo 'installed (relog needed)')"
  echo "  docker compose   : $(docker compose version 2>/dev/null || echo 'installed')"
  echo "  terraform        : $(terraform -version 2>/dev/null | head -n1)"
  echo "  kubectl          : $(kubectl version --client 2>/dev/null | head -n1)"
  echo "  aws cli          : $(aws --version 2>/dev/null)"
  echo "  java             : $(java -version 2>&1 | head -n1)"
  echo "  jenkins          : service installed, check 'systemctl status jenkins'"
  echo "  node             : $(node --version 2>/dev/null)"
  echo "  npm              : $(npm --version 2>/dev/null)"
  echo "  nestjs cli       : $(nest --version 2>/dev/null || echo installed)"
  echo
  warn "IMPORTANT: log out and back in (or run 'newgrp docker') so your user"
  warn "session picks up docker group membership and you can run docker"
  warn "commands without sudo."
  warn "Every tool above was installed from its official upstream repo, so"
  warn "re-running this script later will pick up whatever is newest at that time."
}

main "$@"

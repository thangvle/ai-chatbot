#!/bin/bash
# Deployment script for Netcup VPS with K3s
# Run this script on your VPS after cloning the repository

set -e

echo "🚀 AI Chatbot Deployment to Netcup VPS"
echo "======================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}⚠️  Please run as root: sudo ./deploy-to-vps.sh${NC}"
    exit 1
fi

# Check for required environment variables
echo "📋 Checking environment variables..."
MISSING_VARS=()

if [ -z "$AUTH_SECRET" ]; then MISSING_VARS+=("AUTH_SECRET"); fi
if [ -z "$POSTGRES_PASSWORD" ]; then
    echo -e "${YELLOW}⚠️  POSTGRES_PASSWORD not set, generating random password...${NC}"
    export POSTGRES_PASSWORD=$(openssl rand -base64 32)
fi

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo -e "${RED}⚠️  Missing required environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Please export them before running this script:"
    echo "export AUTH_SECRET='your-secret-here'"
    echo ""
    echo "Optional variables:"
    echo "export GOOGLE_CLIENT_ID='your-google-id'"
    echo "export GOOGLE_CLIENT_SECRET='your-google-secret'"
    echo "export AI_GATEWAY_API_KEY='your-ai-key'"
    echo "export BLOB_READ_WRITE_TOKEN='your-blob-token'"
    exit 1
fi

echo -e "${GREEN}✓ Environment variables OK${NC}"
echo ""

# Install K3s if not already installed
if ! command -v k3s &> /dev/null; then
    echo "📦 Installing K3s..."
    curl -sfL https://get.k3s.io | sh -
    echo -e "${GREEN}✓ K3s installed${NC}"

    echo "⏳ Waiting for K3s to start (30 seconds)..."
    sleep 30
else
    echo -e "${GREEN}✓ K3s already installed${NC}"
fi

# Set kubeconfig
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# Wait for K3s to be ready
echo "⏳ Waiting for K3s node to be ready..."
kubectl wait --for=condition=Ready node --all --timeout=300s

# Check if Docker image exists or needs to be built
echo ""
echo "🐳 Checking Docker image..."
if ! k3s ctr images list | grep -q "ai-chatbot"; then
    echo -e "${YELLOW}⚠️  Docker image not found. You need to:${NC}"
    echo "   1. Build the image: docker build -t ai-chatbot:latest ."
    echo "   2. Import to k3s: sudo k3s ctr images import ai-chatbot.tar"
    echo "   OR"
    echo "   3. Push to Docker Hub and update k8s/deployment.yaml"
    echo ""
    read -p "Have you built and imported the Docker image? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Please build the Docker image first, then run this script again.${NC}"
        exit 1
    fi
fi

# Create namespace
echo ""
echo "📁 Creating Kubernetes namespace..."
kubectl create namespace ai-chatbot --dry-run=client -o yaml | kubectl apply -f -
echo -e "${GREEN}✓ Namespace created${NC}"

# Create secrets
echo ""
echo "🔐 Creating Kubernetes secrets..."
kubectl create secret generic ai-chatbot-secrets \
  --namespace=ai-chatbot \
  --from-literal=AUTH_SECRET="${AUTH_SECRET}" \
  --from-literal=POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  --from-literal=GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}" \
  --from-literal=GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}" \
  --from-literal=AI_GATEWAY_API_KEY="${AI_GATEWAY_API_KEY:-}" \
  --from-literal=BLOB_READ_WRITE_TOKEN="${BLOB_READ_WRITE_TOKEN:-}" \
  --dry-run=client -o yaml | kubectl apply -f -
echo -e "${GREEN}✓ Secrets created${NC}"

# Deploy application
echo ""
echo "🚢 Deploying application components..."

echo "  - ConfigMap..."
kubectl apply -f k8s/configmap.yaml

echo "  - PostgreSQL..."
kubectl apply -f k8s/postgres.yaml

echo "  - Redis..."
kubectl apply -f k8s/redis.yaml

echo "  - Application..."
kubectl apply -f k8s/deployment.yaml

echo "  - Service..."
kubectl apply -f k8s/service.yaml

echo -e "${GREEN}✓ All components deployed${NC}"

# Wait for deployments to be ready
echo ""
echo "⏳ Waiting for deployments to be ready (this may take a few minutes)..."

echo "  - Waiting for PostgreSQL..."
kubectl wait --for=condition=ready --timeout=300s pod -l app=postgres -n ai-chatbot || true

echo "  - Waiting for Redis..."
kubectl wait --for=condition=available --timeout=300s deployment/redis -n ai-chatbot || true

echo "  - Waiting for Application..."
kubectl wait --for=condition=available --timeout=300s deployment/ai-chatbot -n ai-chatbot || true

# Get status
echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "📊 Current Status:"
kubectl get pods -n ai-chatbot
echo ""

# Get service info
NODE_PORT=$(kubectl get service ai-chatbot -n ai-chatbot -o jsonpath='{.spec.ports[0].nodePort}')
VPS_IP=$(hostname -I | awk '{print $1}')

echo "🌐 Access Information:"
echo "   URL: http://${VPS_IP}:${NODE_PORT}"
echo ""
echo "🔥 Firewall Configuration:"
echo "   Run: sudo ufw allow ${NODE_PORT}/tcp"
echo "   Run: sudo ufw allow 22/tcp  (if not already open)"
echo "   Run: sudo ufw enable"
echo ""
echo "📝 Useful Commands:"
echo "   View logs:        kubectl logs -n ai-chatbot -l app=ai-chatbot -f"
echo "   Check status:     kubectl get pods -n ai-chatbot"
echo "   Restart app:      kubectl rollout restart deployment/ai-chatbot -n ai-chatbot"
echo "   Delete all:       kubectl delete namespace ai-chatbot"
echo ""
echo "💾 Database Info:"
echo "   PostgreSQL password: ${POSTGRES_PASSWORD}"
echo "   (Save this password securely!)"
echo ""

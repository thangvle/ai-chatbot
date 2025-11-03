#!/bin/bash
# Automated HTTPS Domain Setup Script for AI Chatbot on K3s
# This script sets up your custom domain with SSL certificate
#
# Usage:
#   export DOMAIN="chatbot.yourdomain.com"
#   export EMAIL="your-email@example.com"
#   sudo ./setup-https-domain.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🌐 HTTPS Domain Setup for AI Chatbot${NC}"
echo "======================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}⚠️  Please run as root: sudo ./setup-https-domain.sh${NC}"
    exit 1
fi

# Check required environment variables
if [ -z "$DOMAIN" ]; then
    echo -e "${RED}⚠️  DOMAIN is not set!${NC}"
    echo "Please set your domain:"
    echo "  export DOMAIN='chatbot.yourdomain.com'"
    echo "  sudo -E ./setup-https-domain.sh"
    exit 1
fi

if [ -z "$EMAIL" ]; then
    echo -e "${RED}⚠️  EMAIL is not set!${NC}"
    echo "Please set your email for Let's Encrypt:"
    echo "  export EMAIL='your-email@example.com'"
    echo "  sudo -E ./setup-https-domain.sh"
    exit 1
fi

# Set kubeconfig
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# Check if K3s is running
if ! command -v k3s &> /dev/null; then
    echo -e "${RED}⚠️  K3s is not installed!${NC}"
    echo "Please deploy the application first using: ./deploy-to-vps.sh"
    exit 1
fi

echo -e "${GREEN}✓ Domain: ${DOMAIN}${NC}"
echo -e "${GREEN}✓ Email: ${EMAIL}${NC}"
echo ""

# Step 1: Check DNS
echo -e "${BLUE}📡 Step 1: Checking DNS configuration...${NC}"
VPS_IP=$(hostname -I | awk '{print $1}')
echo "   Your VPS IP: ${VPS_IP}"
echo ""
echo -e "${YELLOW}⚠️  Make sure you have configured DNS:${NC}"
echo "   Type: A"
echo "   Name: $(echo $DOMAIN | cut -d'.' -f1)"
echo "   Value: ${VPS_IP}"
echo "   TTL: 300"
echo ""
read -p "Have you configured DNS? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Please configure DNS first, then run this script again.${NC}"
    echo "You can check DNS propagation at: https://www.whatsmydns.net/"
    exit 1
fi

# Test DNS resolution
echo -e "${BLUE}   Testing DNS resolution...${NC}"
if nslookup $DOMAIN | grep -q "Address:"; then
    echo -e "${GREEN}   ✓ DNS is resolving${NC}"
else
    echo -e "${YELLOW}   ⚠️  DNS may not be fully propagated yet${NC}"
    echo "   This is OK, Let's Encrypt will check again later"
fi
echo ""

# Step 2: Change service to ClusterIP
echo -e "${BLUE}📦 Step 2: Updating service to ClusterIP...${NC}"
kubectl patch service ai-chatbot -n ai-chatbot -p '{"spec":{"type":"ClusterIP"}}' 2>/dev/null || true
echo -e "${GREEN}   ✓ Service updated${NC}"
echo ""

# Step 3: Open firewall
echo -e "${BLUE}🔥 Step 3: Configuring firewall...${NC}"
ufw allow 80/tcp >/dev/null 2>&1 || true
ufw allow 443/tcp >/dev/null 2>&1 || true
echo -e "${GREEN}   ✓ Firewall configured (ports 80, 443)${NC}"
echo ""

# Step 4: Install cert-manager
echo -e "${BLUE}🔐 Step 4: Installing cert-manager...${NC}"
if kubectl get namespace cert-manager >/dev/null 2>&1; then
    echo -e "${GREEN}   ✓ cert-manager already installed${NC}"
else
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.2/cert-manager.yaml
    echo -e "${BLUE}   ⏳ Waiting for cert-manager to be ready (60 seconds)...${NC}"
    sleep 60
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=300s
    echo -e "${GREEN}   ✓ cert-manager installed${NC}"
fi
echo ""

# Step 5: Create Let's Encrypt issuer
echo -e "${BLUE}📝 Step 5: Creating Let's Encrypt issuer...${NC}"
cat > /tmp/letsencrypt-issuer.yaml << EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ${EMAIL}
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: traefik
EOF

kubectl apply -f /tmp/letsencrypt-issuer.yaml
echo -e "${GREEN}   ✓ Let's Encrypt issuer created${NC}"
echo ""

# Step 6: Create Ingress with SSL
echo -e "${BLUE}🌐 Step 6: Creating HTTPS ingress...${NC}"
cat > /tmp/ingress-ssl.yaml << EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ai-chatbot
  namespace: ai-chatbot
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    traefik.ingress.kubernetes.io/router.entrypoints: web,websecure
spec:
  rules:
    - host: ${DOMAIN}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ai-chatbot
                port:
                  number: 80
  tls:
    - hosts:
        - ${DOMAIN}
      secretName: ai-chatbot-tls
EOF

kubectl apply -f /tmp/ingress-ssl.yaml
echo -e "${GREEN}   ✓ Ingress created${NC}"
echo ""

# Step 7: Wait for certificate
echo -e "${BLUE}⏳ Step 7: Waiting for SSL certificate (this may take 1-2 minutes)...${NC}"
echo "   Let's Encrypt is verifying your domain ownership..."
sleep 30

# Wait up to 5 minutes for certificate
TIMEOUT=300
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    if kubectl get certificate ai-chatbot-tls -n ai-chatbot -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null | grep -q "True"; then
        echo -e "${GREEN}   ✓ SSL certificate issued successfully!${NC}"
        break
    fi
    echo -e "${YELLOW}   ⏳ Still waiting... (${ELAPSED}s elapsed)${NC}"
    sleep 10
    ELAPSED=$((ELAPSED + 10))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    echo -e "${YELLOW}   ⚠️  Certificate is taking longer than expected${NC}"
    echo "   This can happen if:"
    echo "   - DNS is not fully propagated"
    echo "   - Domain is not pointing to this server"
    echo "   - Firewall is blocking HTTP (port 80)"
    echo ""
    echo "   Check status with: kubectl describe certificate ai-chatbot-tls -n ai-chatbot"
fi
echo ""

# Step 8: Verify setup
echo -e "${BLUE}✅ Step 8: Verifying setup...${NC}"
echo ""
echo "Ingress status:"
kubectl get ingress -n ai-chatbot
echo ""
echo "Certificate status:"
kubectl get certificate -n ai-chatbot
echo ""

# Final instructions
echo -e "${GREEN}🎉 HTTPS Setup Complete!${NC}"
echo ""
echo -e "${BLUE}📍 Your application is now available at:${NC}"
echo -e "${GREEN}   https://${DOMAIN}${NC}"
echo ""
echo -e "${BLUE}📝 Useful commands:${NC}"
echo "   Check certificate:  kubectl describe certificate ai-chatbot-tls -n ai-chatbot"
echo "   Check ingress:      kubectl describe ingress ai-chatbot -n ai-chatbot"
echo "   View logs:          kubectl logs -n ai-chatbot -l app=ai-chatbot -f"
echo "   Check Traefik:      kubectl logs -n kube-system -l app.kubernetes.io/name=traefik -f"
echo ""
echo -e "${BLUE}🔍 Test your SSL:${NC}"
echo "   https://www.ssllabs.com/ssltest/analyze.html?d=${DOMAIN}"
echo ""
echo -e "${YELLOW}⚠️  Note: If the site is not accessible yet:${NC}"
echo "   1. Wait a few minutes for DNS to propagate"
echo "   2. Check: nslookup ${DOMAIN}"
echo "   3. Check certificate: kubectl get certificate -n ai-chatbot"
echo ""

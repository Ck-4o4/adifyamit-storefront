#!/bin/bash

# Adifyamit Storefront - One-Click VPS Deployment Script
# Designed for Ubuntu 22.04 LTS

# Ensure script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run this script as root (sudo bash deploy.sh)"
  exit 1
fi

echo "🚀 Starting deployment of Adifyamit digital course sales application..."
sleep 2

# 1. Update OS Packages
echo "🔄 Updating system packages..."
apt update && apt upgrade -y

# 2. Install Node.js (v20 LTS)
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify installations
node_ver=$(node -v)
npm_ver=$(npm -v)
echo "✅ Node.js installed: $node_ver"
echo "✅ NPM installed: $npm_ver"

# 3. Install Nginx and Git
echo "🌐 Installing Nginx, Git, and utilities..."
apt install -y nginx git certbot python3-certbot-nginx

# 4. Configure Nginx Reverse Proxy
echo "🔧 Configuring Nginx reverse proxy routing..."
NGINX_CONF="/etc/nginx/sites-available/adifyamit"

cat > $NGINX_CONF << 'EOF'
server {
    listen 80;
    server_name adifyamit.in www.adifyamit.in;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable configuration
ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx and restart
nginx -t
systemctl restart nginx
echo "✅ Nginx configured successfully."

# 5. Set up Project Directory
echo "📁 Setting up project directory..."
mkdir -p /var/www/adifyamit
cp -r . /var/www/adifyamit

# Enter directory and install production packages
cd /var/www/adifyamit
npm install --production

# 6. Start Server with PM2 (Process Manager)
echo "⚙️ Setting up PM2 process manager..."
npm install -g pm2
pm2 stop all 2>/dev/null || true
pm2 start server.js --name "adifyamit"
pm2 startup systemd
pm2 save

echo "--------------------------------------------------------"
echo "🎉 DEPLOYMENT COMPLETE!"
echo "--------------------------------------------------------"
echo "1. Point your domain (adifyamit.in) A-record to this VPS IP address."
echo "2. Once DNS propagates, run the following command to install FREE SSL:"
echo "   sudo certbot --nginx -d adifyamit.in -d www.adifyamit.in"
echo "--------------------------------------------------------"

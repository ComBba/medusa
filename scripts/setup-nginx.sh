#!/bin/bash

# kbeauty.market Nginx Setup Script
echo "🚀 Setting up Nginx for kbeauty.market..."

# Check if nginx is installed
if ! command -v nginx &> /dev/null; then
    echo "❌ Nginx is not installed. Please install nginx first."
    exit 1
fi

# Create nginx configuration directory if it doesn't exist
sudo mkdir -p /etc/nginx/sites-available
sudo mkdir -p /etc/nginx/sites-enabled

# Copy nginx configuration
echo "📁 Copying nginx configuration..."
sudo cp nginx/kbeauty.market.conf /etc/nginx/sites-available/kbeauty.market.conf

# Create symlink to enable the site
echo "🔗 Enabling site..."
sudo ln -sf /etc/nginx/sites-available/kbeauty.market.conf /etc/nginx/sites-enabled/kbeauty.market.conf

# Test nginx configuration
echo "🔍 Testing nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid!"
    
    # Reload nginx
    echo "🔄 Reloading nginx..."
    sudo systemctl reload nginx
    
    echo "🎉 Nginx setup completed successfully!"
    echo ""
    echo "📋 Available endpoints:"
    echo "  - API: http://api.kbeauty.market (→ localhost:10000)"
    echo "  - Admin: http://admin.kbeauty.market (→ localhost:10001)"
    echo "  - Storefront: http://kbeauty.market (→ localhost:10004)"
    echo "  - Database Admin: http://db.kbeauty.market (→ localhost:10008)"
    echo "  - Storage Console: http://storage.kbeauty.market (→ localhost:10010)"
    echo "  - Storage API: http://s3.kbeauty.market (→ localhost:10009)"
    echo ""
    echo "💡 Don't forget to add these domains to your /etc/hosts file:"
    echo "127.0.0.1 kbeauty.market"
    echo "127.0.0.1 www.kbeauty.market"
    echo "127.0.0.1 api.kbeauty.market"
    echo "127.0.0.1 admin.kbeauty.market"
    echo "127.0.0.1 db.kbeauty.market"
    echo "127.0.0.1 storage.kbeauty.market"
    echo "127.0.0.1 s3.kbeauty.market"
    
else
    echo "❌ Nginx configuration test failed!"
    exit 1
fi 
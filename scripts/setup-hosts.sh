#!/bin/bash

# kbeauty.market Hosts Setup Script
echo "🌐 Setting up hosts file for kbeauty.market..."

# Backup hosts file
sudo cp /etc/hosts /etc/hosts.backup.$(date +%Y%m%d_%H%M%S)

# Define hosts entries
HOSTS_ENTRIES=(
    "127.0.0.1 kbeauty.market"
    "127.0.0.1 www.kbeauty.market"
    "127.0.0.1 api.kbeauty.market"
    "127.0.0.1 admin.kbeauty.market"
    "127.0.0.1 db.kbeauty.market"
    "127.0.0.1 storage.kbeauty.market"
    "127.0.0.1 s3.kbeauty.market"
)

# Add kbeauty.market marker
echo "# kbeauty.market development domains" | sudo tee -a /etc/hosts

# Add each host entry
for entry in "${HOSTS_ENTRIES[@]}"; do
    if ! grep -q "$entry" /etc/hosts; then
        echo "$entry" | sudo tee -a /etc/hosts
        echo "✅ Added: $entry"
    else
        echo "⚠️  Already exists: $entry"
    fi
done

echo "🎉 Hosts file setup completed!"
echo ""
echo "📋 Available domains:"
echo "  - http://kbeauty.market - Main storefront"
echo "  - http://api.kbeauty.market - Backend API"
echo "  - http://admin.kbeauty.market - Admin panel"
echo "  - http://db.kbeauty.market - Database management"
echo "  - http://storage.kbeauty.market - File storage console"
echo "  - http://s3.kbeauty.market - S3 API endpoint" 
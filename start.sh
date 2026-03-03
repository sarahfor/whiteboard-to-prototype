#!/bin/bash

# =============================================================================
# WHITEBOARD TO PROTOTYPE - Startup Script
# =============================================================================

set -e

echo ""
echo "========================================================================"
echo "🚀 WHITEBOARD TO PROTOTYPE - STARTUP"
echo "========================================================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "   Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi

echo "✅ Node.js detected: $(node --version)"

# Check if .env file exists
if [ ! -f .env ]; then
    echo ""
    echo "⚠️  Warning: .env file not found"
    echo "   Creating from .env.example..."

    if [ -f .env.example ]; then
        cp .env.example .env
        echo "   ✅ .env file created"
        echo ""
        echo "   ⚠️  IMPORTANT: Edit .env and add your ANTHROPIC_API_KEY"
        echo "   Get your key from: https://console.anthropic.com/settings/keys"
        echo ""
        read -p "Press Enter once you've added your API key to .env..."
    else
        echo "   ❌ Error: .env.example not found"
        exit 1
    fi
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo ""
    echo "📦 Installing dependencies..."
    npm install
    echo "✅ Dependencies installed"
fi

# Check if API key is set
API_KEY_VALUE=$(grep -E '^ANTHROPIC_API_KEY=' .env | head -n 1 | cut -d'=' -f2-)
if [ -z "$API_KEY_VALUE" ] || [ "$API_KEY_VALUE" = "your_anthropic_api_key_here" ]; then
    echo ""
    echo "⚠️  WARNING: ANTHROPIC_API_KEY not set in .env file"
    echo "   The server will fail to start without a valid API key"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 1
    fi
fi

echo ""
echo "========================================================================"
echo "🚀 STARTING SERVER..."
echo "========================================================================"
echo ""

# Start the server
npm start

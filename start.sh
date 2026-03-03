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
        echo "   ℹ️  You can add ANTHROPIC_API_KEY here for a default server key"
        echo "   or enter your own key later in the browser."
        echo "   Get a key from: https://console.anthropic.com"
        echo ""
        read -p "Press Enter once you're ready to continue..."
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
if ! grep -q "ANTHROPIC_API_KEY=sk-ant-" .env; then
    echo ""
    echo "ℹ️  No default ANTHROPIC_API_KEY found in .env"
    echo "   The app will still start, and users can add their own key in the browser."
fi

echo ""
echo "========================================================================"
echo "🚀 STARTING SERVER..."
echo "========================================================================"
echo ""

# Start the server
npm start

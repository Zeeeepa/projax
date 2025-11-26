#!/bin/bash

###############################################################################
# PROJAX Setup Script for WSL2
# 
# This script installs all dependencies and builds PROJAX from source
# Tested on: Ubuntu 22.04 LTS (WSL2)
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

print_step() {
    echo -e "\n${BLUE}▶${NC} $1"
}

# Error handler
error_exit() {
    print_error "$1"
    exit 1
}

###############################################################################
# Main Setup
###############################################################################

print_header "PROJAX Setup for WSL2"

# Check if running in WSL
if ! grep -q Microsoft /proc/version 2>/dev/null; then
    print_info "Not running in WSL2, but continuing anyway..."
fi

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

print_info "Project root: $PROJECT_ROOT"

###############################################################################
# Step 1: Check and Install Node.js
###############################################################################

print_step "Checking Node.js installation..."

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_success "Node.js is already installed: $NODE_VERSION"
    
    # Check if version is >= 18
    NODE_MAJOR=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -lt 18 ]; then
        print_error "Node.js version must be >= 18.x"
        print_info "Please upgrade Node.js and try again"
        exit 1
    fi
else
    print_info "Node.js not found. Installing Node.js 20.x..."
    
    # Install Node.js using NodeSource
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - || error_exit "Failed to add NodeSource repository"
    sudo apt-get install -y nodejs || error_exit "Failed to install Node.js"
    
    print_success "Node.js installed: $(node -v)"
fi

###############################################################################
# Step 2: Check npm
###############################################################################

print_step "Checking npm installation..."

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    print_success "npm is installed: v$NPM_VERSION"
else
    error_exit "npm not found. Please install npm manually."
fi

###############################################################################
# Step 3: Clean previous installations
###############################################################################

print_step "Cleaning previous builds..."

# Remove node_modules and build artifacts
rm -rf node_modules packages/*/node_modules packages/*/dist packages/*/build 2>/dev/null || true
print_success "Cleaned previous builds"

###############################################################################
# Step 4: Install dependencies
###############################################################################

print_step "Installing project dependencies..."

npm install || error_exit "Failed to install dependencies"
print_success "Dependencies installed"

###############################################################################
# Step 5: Build the project
###############################################################################

print_step "Building PROJAX (this may take a few minutes)..."

# Build individual packages in order
print_info "Building core package..."
npm run build:core || error_exit "Failed to build core package"

print_info "Building API package..."
npm run build:api || error_exit "Failed to build API package"

print_info "Building CLI package..."
npm run build:cli || error_exit "Failed to build CLI package"

print_success "Build completed successfully"

###############################################################################
# Step 6: Link CLI globally
###############################################################################

print_step "Linking CLI globally..."

cd packages/cli
npm link || error_exit "Failed to link CLI"
cd "$PROJECT_ROOT"

print_success "CLI linked globally as 'prx'"

###############################################################################
# Step 7: Verify installation
###############################################################################

print_step "Verifying installation..."

if command -v prx &> /dev/null; then
    print_success "PROJAX CLI is available"
    PRX_VERSION=$(prx --version 2>&1 | head -1 || echo "unknown")
    print_info "Version: $PRX_VERSION"
else
    print_error "PROJAX CLI not found in PATH"
    print_info "You may need to restart your shell or run: source ~/.bashrc"
fi

###############################################################################
# Step 8: Create .projax directory
###############################################################################

print_step "Setting up PROJAX data directory..."

PROJAX_DIR="$HOME/.projax"
mkdir -p "$PROJAX_DIR" "$PROJAX_DIR/logs"
print_success "Created $PROJAX_DIR"

###############################################################################
# Completion
###############################################################################

print_header "Setup Complete!"

echo -e "${GREEN}✓ PROJAX has been successfully installed!${NC}\n"
echo -e "Quick Start:"
echo -e "  ${BLUE}prx --help${NC}          - Show help"
echo -e "  ${BLUE}prx add /path/to/project${NC}  - Add a project"
echo -e "  ${BLUE}prx list${NC}            - List all projects"
echo -e "  ${BLUE}prx 1 dev${NC}           - Run project #1's dev script"
echo -e ""
echo -e "To preview PROJAX in action, run: ${BLUE}./preview.sh${NC}"
echo -e ""


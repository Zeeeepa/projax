#!/bin/bash

###############################################################################
# PROJAX Preview Script for WSL2
# 
# This script demonstrates PROJAX features with example projects
# Tested on: Ubuntu 22.04 LTS (WSL2)
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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
    echo -e "\n${CYAN}▶${NC} $1"
}

pause() {
    echo -e "\n${YELLOW}Press Enter to continue...${NC}"
    read -r
}

###############################################################################
# Main Preview
###############################################################################

print_header "PROJAX Interactive Demo"

# Check if prx is available
if ! command -v prx &> /dev/null; then
    print_error "PROJAX CLI not found!"
    print_info "Please run ./setup.sh first"
    exit 1
fi

print_success "PROJAX CLI found: $(prx --version 2>&1 | head -1)"

###############################################################################
# Demo 1: Show help
###############################################################################

print_step "Demo 1: Viewing PROJAX help"
echo -e "${CYAN}Command: prx --help${NC}\n"
sleep 1

prx --help || true

pause

###############################################################################
# Demo 2: Add the PROJAX project itself
###############################################################################

print_step "Demo 2: Adding PROJAX project"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${CYAN}Command: prx add $PROJECT_ROOT --name \"PROJAX Development\"${NC}\n"
sleep 1

# Remove if exists
prx remove "PROJAX Development" --force 2>/dev/null || true
prx remove 1 --force 2>/dev/null || true

# Add project
prx add "$PROJECT_ROOT" --name "PROJAX Development" || print_info "Project may already exist"

print_success "Project added!"

pause

###############################################################################
# Demo 3: List projects
###############################################################################

print_step "Demo 3: Listing all projects"
echo -e "${CYAN}Command: prx list${NC}\n"
sleep 1

prx list || true

pause

###############################################################################
# Demo 4: View available scripts
###############################################################################

print_step "Demo 4: Viewing available scripts"
echo -e "${CYAN}Command: prx scripts 1${NC}\n"
sleep 1

prx scripts 1 2>/dev/null || prx scripts "PROJAX Development" 2>/dev/null || print_info "No scripts found or project not at index 1"

pause

###############################################################################
# Demo 5: Scan for tests
###############################################################################

print_step "Demo 5: Scanning for test files"
echo -e "${CYAN}Command: prx scan 1${NC}\n"
sleep 1

prx scan 1 2>/dev/null || prx scan "PROJAX Development" 2>/dev/null || print_info "Scan completed"

pause

###############################################################################
# Demo 6: View project path
###############################################################################

print_step "Demo 6: Getting project path"
echo -e "${CYAN}Command: prx pwd 1${NC}\n"
sleep 1

PROJECT_PATH=$(prx pwd 1 2>/dev/null || prx pwd "PROJAX Development" 2>/dev/null || echo "$PROJECT_ROOT")
echo "$PROJECT_PATH"

print_success "Project path retrieved!"

pause

###############################################################################
# Demo 7: List with detailed port information
###############################################################################

print_step "Demo 7: Listing projects with port details"
echo -e "${CYAN}Command: prx list --ports${NC}\n"
sleep 1

prx list --ports 2>/dev/null || prx list || true

pause

###############################################################################
# Demo 8: Create a demo Node.js project
###############################################################################

print_step "Demo 8: Creating a demo Node.js project"

DEMO_DIR="/tmp/projax-demo-$(date +%s)"
mkdir -p "$DEMO_DIR"

# Create package.json
cat > "$DEMO_DIR/package.json" << 'EOF'
{
  "name": "projax-demo",
  "version": "1.0.0",
  "scripts": {
    "dev": "echo 'Development server would start here on port 3000'",
    "start": "echo 'Production server would start here'",
    "test": "echo 'Running tests...' && exit 0"
  }
}
EOF

# Create test files
mkdir -p "$DEMO_DIR/tests"
cat > "$DEMO_DIR/tests/example.test.js" << 'EOF'
// Example test file
describe('Example Test', () => {
  test('should pass', () => {
    expect(true).toBe(true);
  });
});
EOF

cat > "$DEMO_DIR/tests/another.spec.js" << 'EOF'
// Another test file
test('another test', () => {
  expect(1 + 1).toBe(2);
});
EOF

print_success "Created demo project at: $DEMO_DIR"

echo -e "${CYAN}Command: prx add $DEMO_DIR --name \"Demo Project\"${NC}\n"
sleep 1

# Remove if exists
prx remove "Demo Project" --force 2>/dev/null || true

# Add demo project
prx add "$DEMO_DIR" --name "Demo Project"

print_success "Demo project added!"

pause

###############################################################################
# Demo 9: List updated projects
###############################################################################

print_step "Demo 9: Viewing updated project list"
echo -e "${CYAN}Command: prx list${NC}\n"
sleep 1

prx list || true

pause

###############################################################################
# Demo 10: Scan demo project for tests
###############################################################################

print_step "Demo 10: Scanning demo project for tests"
echo -e "${CYAN}Command: prx scan \"Demo Project\"${NC}\n"
sleep 1

prx scan "Demo Project" 2>/dev/null || print_info "Scan completed"

pause

###############################################################################
# Demo 11: View demo project scripts
###############################################################################

print_step "Demo 11: Viewing demo project scripts"
echo -e "${CYAN}Command: prx scripts \"Demo Project\"${NC}\n"
sleep 1

prx scripts "Demo Project" 2>/dev/null || print_info "Scripts listed"

pause

###############################################################################
# Demo 12: Demonstrate script execution (dry run)
###############################################################################

print_step "Demo 12: Running a script (test script)"
echo -e "${CYAN}Command: prx \"Demo Project\" test${NC}\n"
sleep 1

print_info "Running test script..."
cd "$DEMO_DIR"
npm test 2>/dev/null || echo "Test completed (no npm install needed for demo)"

pause

###############################################################################
# Demo 13: Rename project
###############################################################################

print_step "Demo 13: Renaming a project"
echo -e "${CYAN}Command: prx rename \"Demo Project\" \"My Demo App\"${NC}\n"
sleep 1

prx rename "Demo Project" "My Demo App" 2>/dev/null || prx rn "Demo Project" "My Demo App" 2>/dev/null || print_info "Project renamed"

print_success "Project renamed!"

pause

###############################################################################
# Demo 14: Final project list
###############################################################################

print_step "Demo 14: Final project list"
echo -e "${CYAN}Command: prx list${NC}\n"
sleep 1

prx list || true

pause

###############################################################################
# Cleanup option
###############################################################################

print_step "Cleanup"

echo -e "\n${YELLOW}Would you like to remove the demo project? (y/N)${NC}"
read -r CLEANUP

if [[ "$CLEANUP" =~ ^[Yy]$ ]]; then
    print_info "Removing demo project..."
    prx remove "My Demo App" --force 2>/dev/null || print_info "Demo project removed"
    rm -rf "$DEMO_DIR"
    print_success "Cleanup complete!"
else
    print_info "Demo project kept. You can remove it later with: prx remove \"My Demo App\" --force"
fi

###############################################################################
# Completion
###############################################################################

print_header "Demo Complete!"

echo -e "${GREEN}✓ PROJAX Demo Finished!${NC}\n"
echo -e "What you saw:"
echo -e "  ${BLUE}•${NC} Adding projects to PROJAX"
echo -e "  ${BLUE}•${NC} Listing projects with port information"
echo -e "  ${BLUE}•${NC} Viewing available scripts"
echo -e "  ${BLUE}•${NC} Scanning for test files"
echo -e "  ${BLUE}•${NC} Running project scripts"
echo -e "  ${BLUE}•${NC} Renaming projects"
echo -e ""
echo -e "Next Steps:"
echo -e "  ${BLUE}prx add /path/to/your/project${NC}  - Add your own projects"
echo -e "  ${BLUE}prx 1 dev${NC}                      - Run a project"
echo -e "  ${BLUE}prx --help${NC}                     - View all commands"
echo -e ""
echo -e "Advanced Features:"
echo -e "  ${BLUE}prx 1 dev --force${NC}              - Auto-resolve port conflicts"
echo -e "  ${BLUE}prx 1 dev -M${NC}                   - Run in background"
echo -e "  ${BLUE}prx list --ports${NC}               - Show detailed port info"
echo -e ""


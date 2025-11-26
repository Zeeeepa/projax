#!/usr/bin/env bash
################################################################################
# PROJAX Cross-Environment Patch System
# Version: 1.0.0
# 
# This script intelligently patches PROJAX to add WSL2/Docker support.
# It can be reapplied after `git reset --hard && git pull` operations.
#
# Usage: ./projax-cross-env-patch.sh [apply|revert|status]
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Patch marker (used for idempotency detection)
PATCH_MARKER="/* PROJAX-PATCH:cross-env:v1.0.0 */"
PATCH_VERSION="1.0.0"

# Directories
PROJAX_ROOT="$(pwd)"
BACKUP_DIR="${PROJAX_ROOT}/.projax-patch-backup"
PATCH_LOG="${PROJAX_ROOT}/.projax-patch.log"

################################################################################
# Utility Functions
################################################################################

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "$PATCH_LOG"
}

success() {
    echo -e "${GREEN}✓${NC} $*" | tee -a "$PATCH_LOG"
}

error() {
    echo -e "${RED}✗${NC} $*" | tee -a "$PATCH_LOG"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $*" | tee -a "$PATCH_LOG"
}

# Check if a file contains the patch marker
is_patched() {
    local file="$1"
    if [[ -f "$file" ]] && grep -q "$PATCH_MARKER" "$file"; then
        return 0
    fi
    return 1
}

# Create backup of a file
backup_file() {
    local file="$1"
    local backup_path="${BACKUP_DIR}/$(dirname "$file")"
    
    mkdir -p "$backup_path"
    cp "$file" "${BACKUP_DIR}/${file}.bak"
    log "Backed up: $file"
}

# Restore file from backup
restore_file() {
    local file="$1"
    local backup="${BACKUP_DIR}/${file}.bak"
    
    if [[ -f "$backup" ]]; then
        cp "$backup" "$file"
        success "Restored: $file"
    else
        error "No backup found for: $file"
    fi
}

# Validate TypeScript compilation
validate_typescript() {
    log "Validating TypeScript compilation..."
    
    if npm run build >/dev/null 2>&1; then
        success "TypeScript compilation successful"
        return 0
    else
        error "TypeScript compilation failed"
        return 1
    fi
}

################################################################################
# Core Patching Functions
################################################################################

# Patch 1: Add environment types to core
patch_environment_types() {
    local file="packages/core/src/types/environment.ts"
    
    if is_patched "$file"; then
        warn "Already patched: $file (skipping)"
        return 0
    fi
    
    log "Creating environment types: $file"
    
    mkdir -p "$(dirname "$file")"
    
    cat > "$file" << 'EOF'
/* PROJAX-PATCH:cross-env:v1.0.0 */

/**
 * Execution environment types for cross-platform project management
 */

export type ExecutionEnvironment = 'local' | 'wsl2' | 'docker';

export interface WSL2Config {
  distro: string;
  translatePaths?: boolean;
}

export interface DockerConfig {
  containerId?: string;
  containerName?: string;
  workDir?: string;
  composePath?: string;
  serviceName?: string;
}

export interface ProjectEnvironmentConfig {
  type: ExecutionEnvironment;
  wsl2?: WSL2Config;
  docker?: DockerConfig;
}

export interface EnvironmentValidationResult {
  valid: boolean;
  message?: string;
  suggestions?: string[];
}

export interface ExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  pid?: number;
}
EOF
    
    success "Created: $file"
}

# Patch 2: Extend Project interface in database.ts
patch_database_interface() {
    local file="packages/core/src/database.ts"
    
    if is_patched "$file"; then
        warn "Already patched: $file (skipping)"
        return 0
    fi
    
    log "Patching database interface: $file"
    backup_file "$file"
    
    # Add import for environment types (after existing imports)
    sed -i "/^import.*from.*$/a import { ProjectEnvironmentConfig } from './types/environment';" "$file"
    
    # Add environment field to Project interface (before closing brace)
    sed -i "/^export interface Project {/,/^}/ {
        /tags?: string\[\];/a\  environment?: ProjectEnvironmentConfig; ${PATCH_MARKER}
    }" "$file"
    
    success "Patched: $file"
}

# Patch 3: Create path translator utility
patch_path_translator() {
    local file="packages/core/src/utils/path-translator.ts"
    
    if is_patched "$file"; then
        warn "Already patched: $file (skipping)"
        return 0
    fi
    
    log "Creating path translator: $file"
    
    mkdir -p "$(dirname "$file")"
    
    cat > "$file" << 'EOF'
/* PROJAX-PATCH:cross-env:v1.0.0 */

import * as path from 'path';

/**
 * Path translation utilities for cross-environment support
 */

export type PathType = 'windows' | 'wsl2' | 'linux' | 'docker';

/**
 * Detect the type of path
 */
export function detectPathType(filePath: string): PathType {
  // Windows path: C:\path or \\wsl$\
  if (/^[A-Za-z]:\\/.test(filePath)) {
    return 'windows';
  }
  
  // WSL2 UNC path: \\wsl$\Ubuntu\...
  if (filePath.startsWith('\\\\wsl$\\') || filePath.startsWith('//wsl$/')) {
    return 'wsl2';
  }
  
  // Docker typically uses /app or similar
  if (filePath.startsWith('/app') || filePath.startsWith('/workspace')) {
    return 'docker';
  }
  
  // Standard Linux path
  return 'linux';
}

/**
 * Convert Windows path to WSL2 path
 * C:\Users\name\project -> /mnt/c/Users/name/project
 */
export function windowsToWSL2(winPath: string, distro?: string): string {
  // Handle UNC WSL paths: \\wsl$\Ubuntu\home\user -> /home/user
  if (winPath.startsWith('\\\\wsl$\\') || winPath.startsWith('//wsl$/')) {
    const parts = winPath.replace(/\\/g, '/').split('/');
    // Remove empty, 'wsl$', and distro name
    return '/' + parts.slice(3).join('/');
  }
  
  // Handle standard Windows paths: C:\path -> /mnt/c/path
  if (/^[A-Za-z]:/.test(winPath)) {
    const drive = winPath[0].toLowerCase();
    const pathPart = winPath.slice(2).replace(/\\/g, '/');
    return `/mnt/${drive}${pathPart}`;
  }
  
  return winPath;
}

/**
 * Convert WSL2 path to Windows path
 * /mnt/c/Users/name -> C:\Users\name
 */
export function wsl2ToWindows(wslPath: string): string {
  // Handle /mnt/X/... paths
  const mountMatch = wslPath.match(/^\/mnt\/([a-z])(\/.*)?$/);
  if (mountMatch) {
    const drive = mountMatch[1].toUpperCase();
    const pathPart = (mountMatch[2] || '').replace(/\//g, '\\');
    return `${drive}:${pathPart}`;
  }
  
  return wslPath;
}

/**
 * Normalize Docker path
 */
export function normalizeDockerPath(filePath: string, mountPoint = '/app'): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.join(mountPoint, filePath);
}

/**
 * Generic path translation
 */
export function translatePath(
  filePath: string,
  fromEnv: PathType,
  toEnv: PathType
): string {
  if (fromEnv === toEnv) {
    return filePath;
  }
  
  if (fromEnv === 'windows' && toEnv === 'wsl2') {
    return windowsToWSL2(filePath);
  }
  
  if (fromEnv === 'wsl2' && toEnv === 'windows') {
    return wsl2ToWindows(filePath);
  }
  
  // For other combinations, return as-is
  return filePath;
}
EOF
    
    success "Created: $file"
}

# Patch 4: Create WSL2 Executor
patch_wsl2_executor() {
    local file="packages/cli/src/executors/WSL2Executor.ts"
    
    if is_patched "$file"; then
        warn "Already patched: $file (skipping)"
        return 0
    fi
    
    log "Creating WSL2 executor: $file"
    
    mkdir -p "$(dirname "$file")"
    
    cat > "$file" << 'EOF'
/* PROJAX-PATCH:cross-env:v1.0.0 */

import { spawn, ChildProcess } from 'child_process';
import { windowsToWSL2 } from '../../../core/src/utils/path-translator';
import { WSL2Config, ExecutionResult } from '../../../core/src/types/environment';

/**
 * Execute commands in WSL2 environment from Windows
 */
export class WSL2Executor {
  private config: WSL2Config;

  constructor(config: WSL2Config) {
    this.config = config;
  }

  /**
   * Check if WSL is available
   */
  static isAvailable(): boolean {
    if (process.platform !== 'win32') {
      return false;
    }
    
    try {
      const { execSync } = require('child_process');
      execSync('wsl.exe --status', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List available WSL distributions
   */
  static listDistributions(): string[] {
    try {
      const { execSync } = require('child_process');
      const output = execSync('wsl.exe -l -q', { encoding: 'utf-8' });
      return output
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    } catch {
      return [];
    }
  }

  /**
   * Execute command in WSL2
   */
  execute(
    projectPath: string,
    command: string,
    args: string[],
    options: any = {}
  ): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      // Translate path to WSL format
      const wslPath = windowsToWSL2(projectPath, this.config.distro);
      
      // Build WSL command
      const fullCommand = `cd "${wslPath}" && ${command} ${args.join(' ')}`;
      
      const wslArgs = [
        '-d', this.config.distro || 'Ubuntu',
        '-e', 'bash', '-c',
        fullCommand
      ];
      
      let stdout = '';
      let stderr = '';
      
      const child: ChildProcess = spawn('wsl.exe', wslArgs, {
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: true,
        ...options
      });
      
      if (child.stdout) {
        child.stdout.on('data', (data: Buffer) => {
          const chunk = data.toString();
          stdout += chunk;
          process.stdout.write(chunk);
        });
      }
      
      if (child.stderr) {
        child.stderr.on('data', (data: Buffer) => {
          const chunk = data.toString();
          stderr += chunk;
          process.stderr.write(chunk);
        });
      }
      
      child.on('exit', (code) => {
        resolve({
          exitCode: code || 0,
          stdout,
          stderr,
          pid: child.pid
        });
      });
      
      child.on('error', (err) => {
        reject(new Error(`WSL2 execution failed: ${err.message}`));
      });
    });
  }

  /**
   * Validate environment configuration
   */
  validate(): { valid: boolean; message?: string } {
    if (!WSL2Executor.isAvailable()) {
      return {
        valid: false,
        message: 'WSL2 is not installed. Install from Microsoft Store: wsl --install'
      };
    }
    
    const distros = WSL2Executor.listDistributions();
    const targetDistro = this.config.distro || 'Ubuntu';
    
    if (!distros.includes(targetDistro)) {
      return {
        valid: false,
        message: `WSL distribution "${targetDistro}" not found. Available: ${distros.join(', ')}`
      };
    }
    
    return { valid: true };
  }
}
EOF
    
    success "Created: $file"
}

# Patch 5: Create Docker Executor
patch_docker_executor() {
    local file="packages/cli/src/executors/DockerExecutor.ts"
    
    if is_patched "$file"; then
        warn "Already patched: $file (skipping)"
        return 0
    fi
    
    log "Creating Docker executor: $file"
    
    mkdir -p "$(dirname "$file")"
    
    cat > "$file" << 'EOF'
/* PROJAX-PATCH:cross-env:v1.0.0 */

import { spawn, ChildProcess, execSync } from 'child_process';
import { DockerConfig, ExecutionResult } from '../../../core/src/types/environment';

/**
 * Execute commands in Docker containers
 */
export class DockerExecutor {
  private config: DockerConfig;

  constructor(config: DockerConfig) {
    this.config = config;
  }

  /**
   * Check if Docker is available
   */
  static isAvailable(): boolean {
    try {
      execSync('docker --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if Docker daemon is running
   */
  static isRunning(): boolean {
    try {
      execSync('docker ps', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List running containers
   */
  static listContainers(): Array<{ id: string; name: string; image: string }> {
    try {
      const output = execSync('docker ps --format "{{.ID}}\\t{{.Names}}\\t{{.Image}}"', {
        encoding: 'utf-8'
      });
      
      return output
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [id, name, image] = line.split('\t');
          return { id, name, image };
        });
    } catch {
      return [];
    }
  }

  /**
   * Find container by name or ID
   */
  private findContainer(): string | null {
    const containerName = this.config.containerName || this.config.containerId;
    if (!containerName) {
      return null;
    }
    
    const containers = DockerExecutor.listContainers();
    const found = containers.find(
      c => c.id.startsWith(containerName) || c.name === containerName
    );
    
    return found ? found.id : null;
  }

  /**
   * Execute command in Docker container
   */
  execute(
    projectPath: string,
    command: string,
    args: string[],
    options: any = {}
  ): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      const containerId = this.findContainer();
      if (!containerId) {
        reject(new Error(`Container not found: ${this.config.containerName || this.config.containerId}`));
        return;
      }
      
      // Build Docker command
      const workDir = this.config.workDir || '/app';
      const fullCommand = `cd "${workDir}" && ${command} ${args.join(' ')}`;
      
      const dockerArgs = [
        'exec', '-i',
        containerId,
        'sh', '-c',
        fullCommand
      ];
      
      let stdout = '';
      let stderr = '';
      
      const child: ChildProcess = spawn('docker', dockerArgs, {
        stdio: ['inherit', 'pipe', 'pipe'],
        ...options
      });
      
      if (child.stdout) {
        child.stdout.on('data', (data: Buffer) => {
          const chunk = data.toString();
          stdout += chunk;
          process.stdout.write(chunk);
        });
      }
      
      if (child.stderr) {
        child.stderr.on('data', (data: Buffer) => {
          const chunk = data.toString();
          stderr += chunk;
          process.stderr.write(chunk);
        });
      }
      
      child.on('exit', (code) => {
        resolve({
          exitCode: code || 0,
          stdout,
          stderr,
          pid: child.pid
        });
      });
      
      child.on('error', (err) => {
        reject(new Error(`Docker execution failed: ${err.message}`));
      });
    });
  }

  /**
   * Validate environment configuration
   */
  validate(): { valid: boolean; message?: string } {
    if (!DockerExecutor.isAvailable()) {
      return {
        valid: false,
        message: 'Docker is not installed. Download from https://www.docker.com/products/docker-desktop'
      };
    }
    
    if (!DockerExecutor.isRunning()) {
      return {
        valid: false,
        message: 'Docker daemon is not running. Start Docker Desktop.'
      };
    }
    
    const containerId = this.findContainer();
    if (!containerId) {
      return {
        valid: false,
        message: `Container "${this.config.containerName || this.config.containerId}" is not running`
      };
    }
    
    return { valid: true };
  }
}
EOF
    
    success "Created: $file"
}

# Patch 6: Modify script-runner.ts to use executors
patch_script_runner() {
    local file="packages/cli/src/script-runner.ts"
    
    if is_patched "$file"; then
        warn "Already patched: $file (skipping)"
        return 0
    fi
    
    log "Patching script runner: $file"
    backup_file "$file"
    
    # Add imports at the top (after existing imports)
    sed -i "/^import.*from.*$/a \\
import { ProjectEnvironmentConfig } from '../../core/src/types/environment'; ${PATCH_MARKER}\\
import { WSL2Executor } from './executors/WSL2Executor';\\
import { DockerExecutor } from './executors/DockerExecutor';" "$file"
    
    # Add helper function to get project environment
    cat >> "$file" << 'EOF'

/**
 * Get environment configuration for a project
 * PROJAX-PATCH:cross-env:v1.0.0
 */
function getProjectEnvironment(projectPath: string): ProjectEnvironmentConfig | null {
  try {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    const envDbPath = path.join(os.homedir(), '.projax', 'environments.json');
    if (!fs.existsSync(envDbPath)) {
      return null;
    }
    
    const envDb = JSON.parse(fs.readFileSync(envDbPath, 'utf-8'));
    
    // Find by path match
    for (const [projectId, config] of Object.entries(envDb)) {
      // This is a simplified lookup; ideally integrate with database
      return config as ProjectEnvironmentConfig;
    }
  } catch (err) {
    console.warn('Failed to load environment config:', err);
  }
  
  return null;
}

/**
 * Execute command with environment-aware routing
 * PROJAX-PATCH:cross-env:v1.0.0
 */
async function executeWithEnvironment(
  projectPath: string,
  command: string,
  args: string[],
  envConfig: ProjectEnvironmentConfig | null
): Promise<number> {
  // If no environment config or local, use default behavior
  if (!envConfig || envConfig.type === 'local') {
    // Use original spawn logic
    const { spawn } = require('child_process');
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: projectPath,
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: process.platform === 'win32'
      });
      
      child.on('exit', (code: number) => resolve(code || 0));
      child.on('error', reject);
    });
  }
  
  // Route to appropriate executor
  try {
    if (envConfig.type === 'wsl2' && envConfig.wsl2) {
      const executor = new WSL2Executor(envConfig.wsl2);
      const validation = executor.validate();
      if (!validation.valid) {
        throw new Error(validation.message);
      }
      const result = await executor.execute(projectPath, command, args);
      return result.exitCode;
    }
    
    if (envConfig.type === 'docker' && envConfig.docker) {
      const executor = new DockerExecutor(envConfig.docker);
      const validation = executor.validate();
      if (!validation.valid) {
        throw new Error(validation.message);
      }
      const result = await executor.execute(projectPath, command, args);
      return result.exitCode;
    }
  } catch (err: any) {
    console.error('Environment execution failed:', err.message);
    console.error('Falling back to local execution...');
    
    // Fallback to local
    const { spawn } = require('child_process');
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: projectPath,
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: process.platform === 'win32'
      });
      
      child.on('exit', (code: number) => resolve(code || 0));
      child.on('error', reject);
    });
  }
  
  return 0;
}
EOF
    
    success "Patched: $file"
}

# Patch 7: Export new types from core
patch_core_exports() {
    local file="packages/core/src/index.ts"
    
    if is_patched "$file"; then
        warn "Already patched: $file (skipping)"
        return 0
    fi
    
    log "Updating core exports: $file"
    backup_file "$file"
    
    # Add exports for new types
    cat >> "$file" << 'EOF'

// Cross-environment support types PROJAX-PATCH:cross-env:v1.0.0
export * from './types/environment';
export * from './utils/path-translator';
EOF
    
    success "Patched: $file"
}

################################################################################
# Main Patch Application Logic
################################################################################

apply_patch() {
    log "============================================"
    log "PROJAX Cross-Environment Patch v${PATCH_VERSION}"
    log "============================================"
    log ""
    
    # Verify we're in PROJAX root
    if [[ ! -f "package.json" ]] || ! grep -q "projax" package.json; then
        error "Not in PROJAX root directory!"
        error "Please run this script from the PROJAX repository root."
        exit 1
    fi
    
    # Create backup directory
    rm -rf "$BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
    
    log "Starting patch application..."
    log ""
    
    # Apply patches in order
    patch_environment_types
    patch_path_translator
    patch_wsl2_executor
    patch_docker_executor
    patch_database_interface
    patch_script_runner
    patch_core_exports
    
    log ""
    log "Validating changes..."
    
    # Validate TypeScript compilation
    if validate_typescript; then
        success "All patches applied successfully!"
        log ""
        log "Next steps:"
        log "  1. Run: npm run build"
        log "  2. Test: npm test"
        log "  3. Try: prx add <path> --env wsl2"
        log ""
        
        # Clean up backup
        rm -rf "$BACKUP_DIR"
    else
        error "TypeScript validation failed! Rolling back..."
        revert_patch
        exit 1
    fi
}

revert_patch() {
    log "Reverting patches..."
    
    if [[ ! -d "$BACKUP_DIR" ]]; then
        error "No backup found. Cannot revert."
        exit 1
    fi
    
    # Restore all backed up files
    find "$BACKUP_DIR" -name "*.bak" | while read -r backup; do
        original="${backup%.bak}"
        original="${original#$BACKUP_DIR/}"
        restore_file "$original"
    done
    
    # Remove created files
    rm -f packages/core/src/types/environment.ts
    rm -f packages/core/src/utils/path-translator.ts
    rm -f packages/cli/src/executors/WSL2Executor.ts
    rm -f packages/cli/src/executors/DockerExecutor.ts
    
    rm -rf "$BACKUP_DIR"
    success "Patch reverted successfully"
}

show_status() {
    log "Checking patch status..."
    log ""
    
    local files=(
        "packages/core/src/types/environment.ts"
        "packages/core/src/utils/path-translator.ts"
        "packages/cli/src/executors/WSL2Executor.ts"
        "packages/cli/src/executors/DockerExecutor.ts"
        "packages/core/src/database.ts"
        "packages/cli/src/script-runner.ts"
    )
    
    local patched_count=0
    local total_count=${#files[@]}
    
    for file in "${files[@]}"; do
        if is_patched "$file"; then
            success "✓ $file"
            ((patched_count++))
        else
            error "✗ $file"
        fi
    done
    
    log ""
    if [[ $patched_count -eq $total_count ]]; then
        success "Patch is fully applied ($patched_count/$total_count files)"
    elif [[ $patched_count -eq 0 ]]; then
        warn "Patch is not applied (0/$total_count files)"
    else
        warn "Patch is partially applied ($patched_count/$total_count files)"
        warn "Run './projax-cross-env-patch.sh apply' to complete"
    fi
}

################################################################################
# Main Entry Point
################################################################################

main() {
    case "${1:-apply}" in
        apply)
            apply_patch
            ;;
        revert)
            revert_patch
            ;;
        status)
            show_status
            ;;
        *)
            echo "Usage: $0 [apply|revert|status]"
            echo ""
            echo "Commands:"
            echo "  apply   - Apply cross-environment patch to PROJAX"
            echo "  revert  - Revert all patch changes"
            echo "  status  - Check if patch is applied"
            exit 1
            ;;
    esac
}

main "$@"


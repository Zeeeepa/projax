/* PROJAX-PATCH:cross-env:v1.0.0 */

import { spawn, ChildProcess, execSync } from 'child_process';
import { DockerConfig, ExecutionResult } from 'projax-core';

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


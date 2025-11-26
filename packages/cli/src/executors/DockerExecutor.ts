/* PROJAX-PATCH:cross-env:v1.0.0 */

import { spawn, ChildProcess, execSync } from 'child_process';
import { DockerConfig, ExecutionResult } from 'projax-core';

/**
 * Execute commands in Docker containers
 * Enhanced with comprehensive error handling and edge case management
 */
export class DockerExecutor {
  private config: DockerConfig;
  private static readonly DEFAULT_TIMEOUT = 300000; // 5 minutes
  private static readonly MAX_RETRIES = 2;

  constructor(config: DockerConfig) {
    this.config = config;
  }

  /**
   * Check if Docker is available
   */
  static isAvailable(): boolean {
    try {
      execSync('docker --version', { stdio: 'ignore', timeout: 5000 });
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
      execSync('docker ps', { stdio: 'ignore', timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List running containers with detailed status
   */
  static listContainers(all: boolean = false): Array<{ 
    id: string; 
    name: string; 
    image: string; 
    status: string;
    state: string;
  }> {
    try {
      const allFlag = all ? '-a' : '';
      const output = execSync(
        `docker ps ${allFlag} --format "{{.ID}}\\t{{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.State}}"`,
        { encoding: 'utf-8', timeout: 10000 }
      );
      
      return output
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [id, name, image, status, state] = line.split('\t');
          return { id, name, image, status: status || '', state: state || 'unknown' };
        });
    } catch {
      return [];
    }
  }

  /**
   * Get container status
   */
  static getContainerStatus(containerId: string): string | null {
    try {
      const output = execSync(
        `docker inspect --format='{{.State.Status}}' ${containerId}`,
        { encoding: 'utf-8', timeout: 5000 }
      );
      return output.trim();
    } catch {
      return null;
    }
  }

  /**
   * Check if container has shell available
   */
  private async verifyShell(containerId: string): Promise<{ 
    available: boolean; 
    shell: string | null 
  }> {
    const shells = ['bash', 'sh', 'ash'];
    
    for (const shell of shells) {
      try {
        execSync(`docker exec ${containerId} which ${shell}`, {
          stdio: 'ignore',
          timeout: 5000
        });
        return { available: true, shell };
      } catch {
        continue;
      }
    }
    
    return { available: false, shell: null };
  }

  /**
   * Verify working directory exists in container
   */
  private async verifyWorkDir(containerId: string, workDir: string): Promise<boolean> {
    try {
      execSync(`docker exec ${containerId} test -d "${workDir}"`, {
        stdio: 'ignore',
        timeout: 5000
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find container by name or ID
   */
  private findContainer(): { id: string; status: string } | null {
    const containerName = this.config.containerName || this.config.containerId;
    if (!containerName) {
      return null;
    }
    
    const containers = DockerExecutor.listContainers(true); // Include stopped containers
    const found = containers.find(
      c => c.id.startsWith(containerName) || c.name === containerName
    );
    
    return found ? { id: found.id, status: found.state } : null;
  }

  /**
   * Execute command in Docker container with comprehensive error handling
   */
  execute(
    projectPath: string,
    command: string,
    args: string[],
    options: any = {}
  ): Promise<ExecutionResult> {
    return new Promise(async (resolve, reject) => {
      const container = this.findContainer();
      
      if (!container) {
        return reject(new Error(
          `Container not found: ${this.config.containerName || this.config.containerId}\n` +
          `Available containers:\n${DockerExecutor.listContainers(true)
            .map(c => `  - ${c.name} (${c.id.substring(0, 12)}) [${c.state}]`)
            .join('\n')}`
        ));
      }
      
      // Check container status
      if (container.status !== 'running') {
        return reject(new Error(
          `Container ${container.id.substring(0, 12)} is ${container.status}.\n` +
          `Start it with: docker start ${container.id.substring(0, 12)}`
        ));
      }
      
      const containerId = container.id;
      const workDir = this.config.workDir || '/app';
      
      // Verify shell is available
      const shellCheck = await this.verifyShell(containerId);
      if (!shellCheck.available) {
        return reject(new Error(
          `No shell (bash/sh) found in container ${containerId.substring(0, 12)}.\n` +
          `This container may be using a minimal base image.\n` +
          `Try installing a shell or using a different base image.`
        ));
      }
      
      // Verify working directory exists
      const workDirExists = await this.verifyWorkDir(containerId, workDir);
      if (!workDirExists) {
        return reject(new Error(
          `Working directory "${workDir}" does not exist in container.\n` +
          `Create it first: docker exec ${containerId.substring(0, 12)} mkdir -p ${workDir}\n` +
          `Or mount a volume to ${workDir}`
        ));
      }
      
      // Escape arguments properly for shell
      const escapedArgs = args.map(arg => {
        if (arg.includes(' ') || arg.includes('"') || arg.includes('$')) {
          return `'${arg.replace(/'/g, "'\\''")}'`;
        }
        return arg;
      });
      
      // Build Docker command with proper error handling
      const shell = shellCheck.shell || 'sh';
      const fullCommand = `cd "${workDir}" && ${command} ${escapedArgs.join(' ')}`;
      
      const dockerArgs = [
        'exec', '-i',
        containerId,
        shell, '-c',
        fullCommand
      ];
      
      const timeout = options.timeout || DockerExecutor.DEFAULT_TIMEOUT;
      let timer: NodeJS.Timeout | null = null;
      let stdout = '';
      let stderr = '';
      
      const child: ChildProcess = spawn('docker', dockerArgs, {
        stdio: ['inherit', 'pipe', 'pipe'],
        ...options
      });
      
      // Set timeout
      if (timeout > 0) {
        timer = setTimeout(() => {
          if (child && !child.killed) {
            child.kill('SIGTERM');
            // Give process 5s to cleanup, then force kill
            setTimeout(() => {
              if (child && !child.killed) {
                child.kill('SIGKILL');
              }
            }, 5000);
          }
        }, timeout);
      }
      
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
      
      child.on('exit', (code, signal) => {
        if (timer) clearTimeout(timer);
        
        // Handle specific exit codes
        if (code === 139) {
          return reject(new Error(
            'Container exited with code 139 (segmentation fault).\n' +
            'On Windows WSL2, this often requires adding to .wslconfig:\n' +
            '[wsl2]\n' +
            'kernelCommandLine = vsyscall=emulate\n' +
            'Then restart: wsl --shutdown'
          ));
        }
        
        if (code === 137) {
          return reject(new Error(
            'Container was OOM (Out of Memory) killed.\n' +
            'Increase container memory limits or reduce resource usage.'
          ));
        }
        
        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          return reject(new Error(
            `Command timed out after ${timeout}ms and was terminated`
          ));
        }
        
        // Check if container stopped during execution
        const currentStatus = DockerExecutor.getContainerStatus(containerId);
        if (currentStatus && currentStatus !== 'running') {
          return reject(new Error(
            `Container stopped during execution (status: ${currentStatus})`
          ));
        }
        
        resolve({
          exitCode: code || 0,
          stdout,
          stderr,
          pid: child.pid
        });
      });
      
      child.on('error', (err) => {
        if (timer) clearTimeout(timer);
        
        let errorMessage = `Docker execution failed: ${err.message}`;
        
        if (err.message.includes('ENOENT')) {
          errorMessage += '\n\nDocker CLI not found. Make sure Docker is installed and in PATH.';
        } else if (err.message.includes('EACCES') || err.message.includes('permission denied')) {
          errorMessage += '\n\nPermission denied. Possible fixes:\n' +
            '1. Add your user to docker group: sudo usermod -aG docker $USER\n' +
            '2. Restart Docker daemon\n' +
            '3. Check Docker socket permissions';
        } else if (err.message.includes('closed fifo')) {
          errorMessage += '\n\nStream copy error. The container may have stopped unexpectedly.';
        }
        
        reject(new Error(errorMessage));
      });
    });
  }

  /**
   * Validate environment configuration with detailed diagnostics
   */
  validate(): { valid: boolean; message?: string; suggestions?: string[] } {
    const suggestions: string[] = [];
    
    if (!DockerExecutor.isAvailable()) {
      return {
        valid: false,
        message: 'Docker is not installed or not in PATH.',
        suggestions: [
          'Install Docker Desktop from: https://www.docker.com/products/docker-desktop',
          'Verify installation: docker --version',
          'Make sure Docker is in your PATH'
        ]
      };
    }
    
    if (!DockerExecutor.isRunning()) {
      return {
        valid: false,
        message: 'Docker daemon is not running.',
        suggestions: [
          'Start Docker Desktop application',
          'On Linux: sudo systemctl start docker',
          'Check Docker service status: docker info',
          'Look for errors in: docker system events'
        ]
      };
    }
    
    const container = this.findContainer();
    
    if (!container) {
      const containers = DockerExecutor.listContainers(true);
      return {
        valid: false,
        message: `Container "${this.config.containerName || this.config.containerId}" not found.`,
        suggestions: containers.length > 0 ? [
          'Available containers:',
          ...containers.map(c => `  - ${c.name} (${c.id.substring(0, 12)}) [${c.state}]`),
          '',
          'Start a container: docker run -d --name myapp <image>',
          'Or use an existing container name/ID'
        ] : [
          'No containers found. Create one first:',
          'docker run -d --name myapp <image>',
          'List containers: docker ps -a'
        ]
      };
    }
    
    if (container.status !== 'running') {
      suggestions.push(
        `Container ${container.id.substring(0, 12)} is ${container.status}.`,
        `Start it: docker start ${container.id.substring(0, 12)}`
      );
      
      if (container.status === 'exited') {
        suggestions.push('Check logs: docker logs ' + container.id.substring(0, 12));
      }
      
      return {
        valid: false,
        message: `Container is ${container.status}, not running.`,
        suggestions
      };
    }
    
    // Container is running - additional checks
    suggestions.push('Container is running and ready for commands.');
    
    return { 
      valid: true,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    };
  }
}


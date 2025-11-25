/* PROJAX-PATCH:cross-env:v1.0.0 */

import { spawn, ChildProcess, execSync } from 'child_process';
import { windowsToWSL2, WSL2Config, ExecutionResult } from 'projax-core';

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

/* PROJAX-PATCH:cross-env:v1.0.0 */

import { spawn, ChildProcess, execSync } from 'child_process';
import { windowsToWSL2, WSL2Config, ExecutionResult } from 'projax-core';

/**
 * Execute commands in WSL2 environment from Windows
 * Enhanced with comprehensive error handling and edge case management
 */
export class WSL2Executor {
  private config: WSL2Config;
  private static readonly DEFAULT_TIMEOUT = 300000; // 5 minutes
  private static readonly MAX_RETRIES = 2;

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
      execSync('wsl.exe --status', { stdio: 'ignore', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List available WSL distributions with their running state
   */
  static listDistributions(): Array<{ name: string; state: string; version: string }> {
    try {
      // Use -l -v to get detailed status including state and WSL version
      const output = execSync('wsl.exe -l -v', { 
        encoding: 'utf-8',
        timeout: 10000 
      });
      
      const lines = output
        .split('\n')
        .slice(1) // Skip header
        .filter(line => line.trim().length > 0);
      
      return lines.map(line => {
        // Remove null bytes and extra whitespace that Windows outputs
        const cleaned = line.replace(/\0/g, '').trim();
        // Parse format: "  NAME               STATE           VERSION"
        // The '*' indicates default distribution
        const parts = cleaned.replace(/\s+/g, ' ').split(' ').filter(p => p && p !== '*');
        
        return {
          name: parts[0] || '',
          state: parts[1] || 'Unknown',
          version: parts[2] || '1'
        };
      }).filter(d => d.name.length > 0);
    } catch (error) {
      // Fallback to simple list if -l -v fails
      try {
        const output = execSync('wsl.exe -l -q', { encoding: 'utf-8', timeout: 10000 });
        return output
          .split('\n')
          .map(line => line.replace(/\0/g, '').trim())
          .filter(line => line.length > 0)
          .map(name => ({ name, state: 'Unknown', version: 'Unknown' }));
      } catch {
        return [];
      }
    }
  }

  /**
   * Check if a distribution is actually running
   */
  static isDistributionRunning(distro: string): boolean {
    try {
      const distros = this.listDistributions();
      const found = distros.find(d => d.name === distro);
      return found ? found.state === 'Running' : false;
    } catch {
      return false;
    }
  }

  /**
   * Test if path exists in WSL filesystem
   */
  private async testPath(wslPath: string): Promise<boolean> {
    try {
      const result = await this.executeCommand(`test -d "${wslPath}" && echo "exists"`, 5000);
      return result.stdout.trim() === 'exists';
    } catch {
      return false;
    }
  }

  /**
   * Execute a simple command with timeout (for internal checks)
   */
  private executeCommand(command: string, timeout: number = 10000): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      const distro = this.config.distro || 'Ubuntu';
      const wslArgs = ['-d', distro, '-e', 'bash', '-c', command];
      
      const timer = setTimeout(() => {
        if (child && !child.killed) {
          child.kill('SIGTERM');
          reject(new Error(`Command timed out after ${timeout}ms`));
        }
      }, timeout);
      
      let stdout = '';
      let stderr = '';
      
      const child = spawn('wsl.exe', wslArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });
      
      if (child.stdout) {
        child.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });
      }
      
      if (child.stderr) {
        child.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
      }
      
      child.on('exit', (code) => {
        clearTimeout(timer);
        resolve({ exitCode: code || 0, stdout, stderr, pid: child.pid });
      });
      
      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  /**
   * Execute command in WSL2 with comprehensive error handling
   */
  execute(
    projectPath: string,
    command: string,
    args: string[],
    options: any = {}
  ): Promise<ExecutionResult> {
    return new Promise(async (resolve, reject) => {
      // Validate distribution is running
      const distro = this.config.distro || 'Ubuntu';
      const distros = WSL2Executor.listDistributions();
      const targetDistro = distros.find(d => d.name === distro);
      
      if (!targetDistro) {
        return reject(new Error(
          `WSL distribution "${distro}" not found. Available: ${distros.map(d => d.name).join(', ')}`
        ));
      }
      
      if (targetDistro.state !== 'Running') {
        // Try to start the distribution
        try {
          execSync(`wsl.exe -d ${distro} echo "starting"`, { 
            stdio: 'ignore',
            timeout: 30000 
          });
          // Give it a moment to fully start
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          return reject(new Error(
            `WSL distribution "${distro}" is ${targetDistro.state}. Failed to start it.`
          ));
        }
      }

      // Translate path to WSL format
      const wslPath = windowsToWSL2(projectPath, distro);
      
      // Validate path exists (with retry logic)
      let pathExists = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          pathExists = await this.testPath(wslPath);
          if (pathExists) break;
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch {
          // Continue to next attempt
        }
      }
      
      if (!pathExists) {
        return reject(new Error(
          `Path does not exist in WSL filesystem: ${wslPath}\n` +
          `Windows path: ${projectPath}\n` +
          `Make sure the drive is mounted in WSL2 (/mnt/c, /mnt/d, etc.)`
        ));
      }
      
      // Escape arguments properly for bash
      const escapedArgs = args.map(arg => {
        // Handle arguments with spaces, quotes, or special chars
        if (arg.includes(' ') || arg.includes('"') || arg.includes('$')) {
          return `'${arg.replace(/'/g, "'\\''")}'`;
        }
        return arg;
      });
      
      // Build WSL command with error handling
      const fullCommand = `cd "${wslPath}" 2>/dev/null && ${command} ${escapedArgs.join(' ')} || { echo "Command failed with exit code $?" >&2; exit $?; }`;
      
      const wslArgs = [
        '-d', distro,
        '-e', 'bash', '-c',
        fullCommand
      ];
      
      const timeout = options.timeout || WSL2Executor.DEFAULT_TIMEOUT;
      let timer: NodeJS.Timeout | null = null;
      let stdout = '';
      let stderr = '';
      
      const child: ChildProcess = spawn('wsl.exe', wslArgs, {
        stdio: ['inherit', 'pipe', 'pipe'],
        windowsHide: true,
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
        if (code === 4294967295 || code === -1) {
          // WSL service error
          return reject(new Error(
            'WSL service error (0xFFFFFFFF). Try:\n' +
            '1. wsl --shutdown\n' +
            '2. Restart LxssManager service\n' +
            '3. Check Windows Updates'
          ));
        }
        
        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          return reject(new Error(
            `Command timed out after ${timeout}ms and was terminated`
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
        
        // Provide helpful error messages for common issues
        let errorMessage = `WSL2 execution failed: ${err.message}`;
        
        if (err.message.includes('ENOENT')) {
          errorMessage += '\n\nWSL may not be properly installed or wsl.exe is not in PATH.';
        } else if (err.message.includes('EACCES')) {
          errorMessage += '\n\nPermission denied. Run as administrator or check WSL permissions.';
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
    
    if (!WSL2Executor.isAvailable()) {
      return {
        valid: false,
        message: 'WSL2 is not installed or not responding.',
        suggestions: [
          'Install WSL2: wsl --install',
          'Check if virtualization is enabled in BIOS',
          'Restart LxssManager service: net stop LxssManager && net start LxssManager',
          'Check Windows features: "Virtual Machine Platform" and "Windows Subsystem for Linux"'
        ]
      };
    }
    
    const distros = WSL2Executor.listDistributions();
    
    if (distros.length === 0) {
      return {
        valid: false,
        message: 'No WSL distributions found.',
        suggestions: [
          'Install a distribution: wsl --install Ubuntu',
          'List available distributions: wsl --list --online',
          'Check existing installations: wsl -l -v'
        ]
      };
    }
    
    const targetDistro = this.config.distro || 'Ubuntu';
    const found = distros.find(d => d.name === targetDistro);
    
    if (!found) {
      return {
        valid: false,
        message: `WSL distribution "${targetDistro}" not found.`,
        suggestions: [
          `Available distributions: ${distros.map(d => `${d.name} (${d.state})`).join(', ')}`,
          `Install ${targetDistro}: wsl --install ${targetDistro}`,
          'Or use an existing distribution'
        ]
      };
    }
    
    if (found.state === 'Stopped') {
      suggestions.push(
        `Distribution "${targetDistro}" is stopped. It will be started automatically on first use.`,
        `Or start manually: wsl -d ${targetDistro}`
      );
    } else if (found.state !== 'Running') {
      return {
        valid: false,
        message: `WSL distribution "${targetDistro}" is in ${found.state} state.`,
        suggestions: [
          'Try terminating and restarting: wsl --terminate ' + targetDistro,
          'Check WSL service status',
          'Reboot if issues persist'
        ]
      };
    }
    
    return { 
      valid: true, 
      suggestions: suggestions.length > 0 ? suggestions : undefined 
    };
  }
}


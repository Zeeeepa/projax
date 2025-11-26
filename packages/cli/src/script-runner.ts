import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { getDatabaseManager } from './core-bridge';
import { detectPortInUse, getProcessOnPort, killProcessOnPort, extractPortFromError } from './port-utils';
import { WSL2Executor } from './executors/WSL2Executor'; /* PROJAX-PATCH:cross-env:v1.0.0 */
import { DockerExecutor } from './executors/DockerExecutor'; /* PROJAX-PATCH:cross-env:v1.0.0 */

export interface ScriptInfo {
  name: string;
  command: string;
  runner: string;
  projectType: string;
}

export type ProjectType = 'node' | 'python' | 'rust' | 'go' | 'makefile' | 'unknown';

export interface ProjectScripts {
  type: ProjectType;
  scripts: Map<string, ScriptInfo>;
}

/**
 * Detect the project type based on files in the directory
 */
export function detectProjectType(projectPath: string): ProjectType {
  if (fs.existsSync(path.join(projectPath, 'package.json'))) {
    return 'node';
  }
  if (fs.existsSync(path.join(projectPath, 'pyproject.toml'))) {
    return 'python';
  }
  if (fs.existsSync(path.join(projectPath, 'Cargo.toml'))) {
    return 'rust';
  }
  if (fs.existsSync(path.join(projectPath, 'go.mod'))) {
    return 'go';
  }
  if (fs.existsSync(path.join(projectPath, 'Makefile')) || fs.existsSync(path.join(projectPath, 'makefile'))) {
    return 'makefile';
  }
  return 'unknown';
}

/**
 * Parse scripts from package.json (Node.js)
 */
function parseNodeScripts(projectPath: string): Map<string, ScriptInfo> {
  const packageJsonPath = path.join(projectPath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return new Map();
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const scripts = packageJson.scripts || {};
    const scriptMap = new Map<string, ScriptInfo>();

    for (const [name, command] of Object.entries(scripts)) {
      if (typeof command === 'string') {
        scriptMap.set(name, {
          name,
          command: command as string,
          runner: 'npm',
          projectType: 'node',
        });
      }
    }

    return scriptMap;
  } catch (error) {
    return new Map();
  }
}

/**
 * Parse scripts from pyproject.toml (Python)
 */
function parsePythonScripts(projectPath: string): Map<string, ScriptInfo> {
  const pyprojectPath = path.join(projectPath, 'pyproject.toml');
  if (!fs.existsSync(pyprojectPath)) {
    return new Map();
  }

  try {
    const content = fs.readFileSync(pyprojectPath, 'utf-8');
    const scriptMap = new Map<string, ScriptInfo>();

    // Simple TOML parsing for [project.scripts] section
    // This is a basic implementation - for production, consider using a TOML parser
    const scriptsMatch = content.match(/\[project\.scripts\]\s*\n((?:[^\[]+\n?)+)/);
    if (scriptsMatch) {
      const scriptsSection = scriptsMatch[1];
      const scriptLines = scriptsSection.split('\n');
      
      for (const line of scriptLines) {
        const match = line.match(/^(\w+)\s*=\s*["']([^"']+)["']/);
        if (match) {
          const [, name, command] = match;
          scriptMap.set(name, {
            name,
            command,
            runner: 'python',
            projectType: 'python',
          });
        }
      }
    }

    // Also check for [tool.poetry.scripts]
    const poetryMatch = content.match(/\[tool\.poetry\.scripts\]\s*\n((?:[^\[]+\n?)+)/);
    if (poetryMatch) {
      const scriptsSection = poetryMatch[1];
      const scriptLines = scriptsSection.split('\n');
      
      for (const line of scriptLines) {
        const match = line.match(/^(\w+)\s*=\s*["']([^"']+)["']/);
        if (match) {
          const [, name, command] = match;
          scriptMap.set(name, {
            name,
            command,
            runner: 'poetry',
            projectType: 'python',
          });
        }
      }
    }

    return scriptMap;
  } catch (error) {
    return new Map();
  }
}

/**
 * Parse scripts from Cargo.toml (Rust)
 * Cargo doesn't have a scripts section, but we can detect common cargo commands
 */
function parseRustScripts(projectPath: string): Map<string, ScriptInfo> {
  const scriptMap = new Map<string, ScriptInfo>();
  
  // Common cargo commands that can be run
  const commonCommands = [
    { name: 'build', command: 'cargo build', runner: 'cargo' },
    { name: 'run', command: 'cargo run', runner: 'cargo' },
    { name: 'test', command: 'cargo test', runner: 'cargo' },
    { name: 'check', command: 'cargo check', runner: 'cargo' },
    { name: 'clippy', command: 'cargo clippy', runner: 'cargo' },
    { name: 'fmt', command: 'cargo fmt', runner: 'cargo' },
  ];

  for (const cmd of commonCommands) {
    scriptMap.set(cmd.name, {
      name: cmd.name,
      command: cmd.command,
      runner: cmd.runner,
      projectType: 'rust',
    });
  }

  return scriptMap;
}

/**
 * Parse Makefile targets
 */
function parseMakefileScripts(projectPath: string): Map<string, ScriptInfo> {
  const makefilePath = fs.existsSync(path.join(projectPath, 'Makefile'))
    ? path.join(projectPath, 'Makefile')
    : path.join(projectPath, 'makefile');
  
  if (!fs.existsSync(makefilePath)) {
    return new Map();
  }

  try {
    const content = fs.readFileSync(makefilePath, 'utf-8');
    const scriptMap = new Map<string, ScriptInfo>();

    // Parse Makefile targets (basic implementation)
    // Match lines that look like targets: target: dependencies
    const targetRegex = /^([a-zA-Z0-9_-]+)\s*:.*$/gm;
    let match;
    
    while ((match = targetRegex.exec(content)) !== null) {
      const targetName = match[1];
      // Skip special targets
      if (!targetName.startsWith('.') && targetName !== 'PHONY') {
        scriptMap.set(targetName, {
          name: targetName,
          command: `make ${targetName}`,
          runner: 'make',
          projectType: 'makefile',
        });
      }
    }

    return scriptMap;
  } catch (error) {
    return new Map();
  }
}

/**
 * Get all available scripts for a project
 */
export function getProjectScripts(projectPath: string): ProjectScripts {
  const type = detectProjectType(projectPath);
  let scripts = new Map<string, ScriptInfo>();

  switch (type) {
    case 'node':
      scripts = parseNodeScripts(projectPath);
      break;
    case 'python':
      scripts = parsePythonScripts(projectPath);
      break;
    case 'rust':
      scripts = parseRustScripts(projectPath);
      break;
    case 'makefile':
      scripts = parseMakefileScripts(projectPath);
      break;
    case 'go':
      // Go projects typically use Makefile or direct go commands
      // Check for Makefile first, otherwise provide common go commands
      const makefileScripts = parseMakefileScripts(projectPath);
      if (makefileScripts.size > 0) {
        scripts = makefileScripts;
      } else {
        // Common go commands
        scripts.set('run', {
          name: 'run',
          command: 'go run .',
          runner: 'go',
          projectType: 'go',
        });
        scripts.set('build', {
          name: 'build',
          command: 'go build',
          runner: 'go',
          projectType: 'go',
        });
        scripts.set('test', {
          name: 'test',
          command: 'go test ./...',
          runner: 'go',
          projectType: 'go',
        });
      }
      break;
    default:
      // For unknown projects, check for Makefile as fallback
      scripts = parseMakefileScripts(projectPath);
      break;
  }

  return {
    type,
    scripts,
  };
}

/**
 * Handle port conflict - prompt user or auto-kill based on force flag
 */
async function handlePortConflict(
  port: number,
  projectName: string,
  force: boolean
): Promise<boolean> {
  const processInfo = await getProcessOnPort(port);

  if (!processInfo) {
    console.error(`Port ${port} appears to be in use, but couldn't identify the process.`);
    return false;
  }

  console.error(`\n⚠️  Port ${port} is already in use by process ${processInfo.pid} (${processInfo.command})`);

  if (force) {
    console.log(`Killing process ${processInfo.pid} on port ${port}...`);
    const killed = await killProcessOnPort(port);
    if (killed) {
      console.log(`✓ Process killed. Retrying...\n`);
      return true;
    } else {
      console.error(`Failed to kill process on port ${port}`);
      return false;
    }
  } else {
    const inquirer = (await import('inquirer')).default;
    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'kill',
        message: `Kill process ${processInfo.pid} (${processInfo.command}) and continue?`,
        default: false,
      },
    ]);

    if (answer.kill) {
      const killed = await killProcessOnPort(port);
      if (killed) {
        console.log(`✓ Process killed. Retrying...\n`);
        return true;
      } else {
        console.error(`Failed to kill process on port ${port}`);
        return false;
      }
    } else {
      console.log('Cancelled.');
      return false;
    }
  }
}

/**
 * Check ports proactively before script execution
 */
async function checkPortsBeforeExecution(
  projectPath: string,
  scriptName: string,
  force: boolean
): Promise<boolean> {
  const db = getDatabaseManager();
  const project = db.getProjectByPath(projectPath);
  if (!project) return true; // Can't check if project not in DB

  const ports = db.getProjectPortsByScript(project.id, scriptName);
  if (ports.length === 0) {
    // Also check ports without script name (general project ports)
    const allPorts = db.getProjectPorts(project.id);
    for (const portInfo of allPorts) {
      const inUse = await detectPortInUse(portInfo.port);
      if (inUse) {
        return await handlePortConflict(portInfo.port, project.name, force);
      }
    }
    return true;
  }

  for (const portInfo of ports) {
    const inUse = await detectPortInUse(portInfo.port);
    if (inUse) {
      return await handlePortConflict(portInfo.port, project.name, force);
    }
  }

  return true;
}

/**
 * Execute a script in a project directory
 */
export function runScript(
  projectPath: string,
  scriptName: string,
  args: string[] = [],
  force: boolean = false
): Promise<number> {
  return new Promise(async (resolve, reject) => {
    const projectScripts = getProjectScripts(projectPath);
    const script = projectScripts.scripts.get(scriptName);

    if (!script) {
      reject(new Error(`Script "${scriptName}" not found in project`));
      return;
    }

    
    // Check for environment-specific execution /* PROJAX-PATCH:cross-env:v1.0.0 */
    const db = getDatabaseManager();
    const project = db.getProjectByPath(projectPath);
    
    if (project?.environment && project.environment.type !== 'local') {
      // Route to appropriate executor
      try {
        let exitCode: number;
        
        if (project.environment.type === 'wsl2' && project.environment.wsl2) {
          console.log(`\nExecuting in WSL2 (${project.environment.wsl2.distro})...\n`);
          const executor = new WSL2Executor(project.environment.wsl2);
          
          // Build command string based on script runner
          let fullCommand: string;
          switch (script.runner) {
            case 'npm':
              fullCommand = `npm run ${scriptName}`;
              break;
            case 'yarn':
              fullCommand = `yarn ${scriptName}`;
              break;
            case 'pnpm':
              fullCommand = `pnpm run ${scriptName}`;
              break;
            default:
              fullCommand = script.command;
          }
          
          // Parse command into parts for executor
          const wslCmdParts = fullCommand.split(' ');
          const wslCmd = wslCmdParts[0];
          const wslArgs = wslCmdParts.slice(1);
          const result = await executor.execute(projectPath, wslCmd, wslArgs);
          console.log(result.stdout);
          if (result.stderr) console.error(result.stderr);
          exitCode = result.exitCode;
          
        } else if (project.environment.type === 'docker' && project.environment.docker) {
          console.log(`\nExecuting in Docker container (${project.environment.docker.containerName})...\n`);
          const executor = new DockerExecutor(project.environment.docker);
          
          // Build command string based on script runner
          let fullCommand: string;
          switch (script.runner) {
            case 'npm':
              fullCommand = `npm run ${scriptName}`;
              break;
            case 'yarn':
              fullCommand = `yarn ${scriptName}`;
              break;
            case 'pnpm':
              fullCommand = `pnpm run ${scriptName}`;
              break;
            default:
              fullCommand = script.command;
          }
          
          // Parse command into parts for executor
          const dockerCmdParts = fullCommand.split(' ');
          const dockerCmd = dockerCmdParts[0];
          const dockerArgs = dockerCmdParts.slice(1);
          const result = await executor.execute(projectPath, dockerCmd, dockerArgs);
          console.log(result.stdout);
          if (result.stderr) console.error(result.stderr);
          exitCode = result.exitCode;
          
        } else {
          reject(new Error(`Unsupported environment type: ${project.environment.type}`));
          return;
        }
        
        resolve(exitCode);
        return;
      } catch (error) {
        reject(error);
        return;
      }
    }
    // End environment-specific execution /* PROJAX-PATCH:cross-env:v1.0.0 */
    // Proactive port checking
    const canProceed = await checkPortsBeforeExecution(projectPath, scriptName, force);
    if (!canProceed) {
      reject(new Error('Port conflict not resolved'));
      return;
    }

    let command: string;
    let commandArgs: string[];

    switch (script.runner) {
      case 'npm':
        command = 'npm';
        commandArgs = ['run', scriptName, ...args];
        break;
      case 'yarn':
        command = 'yarn';
        commandArgs = [scriptName, ...args];
        break;
      case 'pnpm':
        command = 'pnpm';
        commandArgs = ['run', scriptName, ...args];
        break;
      case 'python':
        command = 'python';
        commandArgs = ['-m', ...script.command.split(' ').slice(1), ...args];
        break;
      case 'poetry':
        command = 'poetry';
        // For poetry, the command is already the module path, use 'run' to execute it
        const modulePath = script.command.split(' ').slice(1).join(' ');
        commandArgs = ['run', 'python', '-m', modulePath, ...args];
        break;
      case 'cargo':
        command = 'cargo';
        commandArgs = scriptName === 'run' ? ['run', ...args] : [scriptName, ...args];
        break;
      case 'go':
        command = 'go';
        commandArgs = script.command.split(' ').slice(1);
        if (scriptName === 'run' && args.length > 0) {
          commandArgs = ['run', ...args];
        } else {
          commandArgs = [...commandArgs, ...args];
        }
        break;
      case 'make':
        command = 'make';
        commandArgs = [scriptName, ...args];
        break;
      default:
        // Fallback: try to run the command directly
        const parts = script.command.split(' ');
        command = parts[0];
        commandArgs = [...parts.slice(1), ...args];
        break;
    }

    console.log(`Running: ${command} ${commandArgs.join(' ')}`);
    console.log(`In directory: ${projectPath}\n`);

    // Capture stderr for reactive port conflict detection
    let stderrOutput = '';
    let stdoutOutput = '';

    const child = spawn(command, commandArgs, {
      cwd: projectPath,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    // Capture output for error analysis
    if (child.stdout) {
      child.stdout.on('data', (data: Buffer) => {
        stdoutOutput += data.toString();
        process.stdout.write(data);
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data: Buffer) => {
        stderrOutput += data.toString();
        process.stderr.write(data);
      });
    }

    child.on('close', async (code) => {
      if (code === 0) {
        resolve(0);
      } else {
        // Reactive port conflict detection
        const errorOutput = stderrOutput + stdoutOutput;
        const port = extractPortFromError(errorOutput);
        
        if (port) {
          const db = getDatabaseManager();
          const project = db.getProjectByPath(projectPath);
          const projectName = project?.name || 'project';
          
          const resolved = await handlePortConflict(port, projectName, force);
          if (resolved) {
            // Retry script execution
            try {
              const retryResult = await runScript(projectPath, scriptName, args, force);
              resolve(retryResult);
            } catch (retryError) {
              reject(retryError);
            }
          } else {
            reject(new Error(`Script exited with code ${code} (port ${port} conflict)`));
          }
        } else {
          reject(new Error(`Script exited with code ${code}`));
        }
      }
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to execute script: ${error.message}`));
    });
  });
}

export interface BackgroundProcess {
  pid: number;
  projectPath: string;
  projectName: string;
  scriptName: string;
  command: string;
  startedAt: number;
  logFile: string;
  detectedUrls?: string[];
  detectedPorts?: number[];
}

/**
 * Get the path to the processes file
 */
function getProcessesFilePath(): string {
  const dataDir = path.join(os.homedir(), '.projax');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'processes.json');
}

/**
 * Load running processes from disk
 */
export function loadProcesses(): BackgroundProcess[] {
  const filePath = getProcessesFilePath();
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return [];
  }
}

/**
 * Save running processes to disk
 */
function saveProcesses(processes: BackgroundProcess[]): void {
  const filePath = getProcessesFilePath();
  fs.writeFileSync(filePath, JSON.stringify(processes, null, 2));
}

/**
 * Add a process to the tracking file
 */
function addProcess(process: BackgroundProcess): void {
  const processes = loadProcesses();
  processes.push(process);
  saveProcesses(processes);
}

/**
 * Remove a process from tracking by PID
 */
export function removeProcess(pid: number): void {
  const processes = loadProcesses();
  const filtered = processes.filter(p => p.pid !== pid);
  saveProcesses(filtered);
}

/**
 * Get all running processes for a project
 */
export function getProjectProcesses(projectPath: string): BackgroundProcess[] {
  const processes = loadProcesses();
  return processes.filter(p => p.projectPath === projectPath);
}

/**
 * Check if a process is still running
 */
async function isProcessRunning(pid: number): Promise<boolean> {
  try {
    if (os.platform() === 'win32') {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
      return stdout.includes(`"${pid}"`);
    } else {
      // On Unix-like systems, kill with signal 0 checks if process exists
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    }
  } catch {
    return false;
  }
}

/**
 * Clean up dead processes from tracking
 */
async function cleanupDeadProcesses(): Promise<void> {
  const processes = loadProcesses();
  const aliveProcesses: BackgroundProcess[] = [];
  
  for (const proc of processes) {
    const isAlive = await isProcessRunning(proc.pid);
    if (isAlive) {
      aliveProcesses.push(proc);
    }
  }
  
  if (aliveProcesses.length !== processes.length) {
    saveProcesses(aliveProcesses);
  }
}

/**
 * Get all running processes (synchronous version that returns potentially stale data)
 */
export function getRunningProcesses(): BackgroundProcess[] {
  return loadProcesses();
}

/**
 * Get all running processes with cleanup (async version)
 */
export async function getRunningProcessesClean(): Promise<BackgroundProcess[]> {
  await cleanupDeadProcesses();
  return loadProcesses();
}

/**
 * Extract URLs from text output
 */
function extractUrlsFromOutput(output: string): string[] {
  const urls: string[] = [];
  const urlPatterns = [
    /(?:Local|Network):\s*(https?:\/\/[^\s]+)/gi,
    /(?:https?:\/\/localhost:\d+)/gi,
    /(?:https?:\/\/127\.0\.0\.1:\d+)/gi,
    /(?:https?:\/\/0\.0\.0\.0:\d+)/gi,
    /(?:https?:\/\/[^\s:]+:\d+)/gi,
  ];

  for (const pattern of urlPatterns) {
    const matches = output.matchAll(pattern);
    for (const match of matches) {
      const url = match[0] || match[1];
      if (url && !urls.includes(url)) {
        urls.push(url);
      }
    }
  }

  return urls;
}

/**
 * Update process with detected URLs and ports
 */
function updateProcessUrls(pid: number, urls: string[]): void {
  const processes = loadProcesses();
  const process = processes.find(p => p.pid === pid);
  if (process) {
    process.detectedUrls = urls;
    // Extract ports from URLs
    const ports = new Set<number>();
    for (const url of urls) {
      const match = url.match(/:(\d+)/);
      if (match) {
        ports.add(parseInt(match[1], 10));
      }
    }
    process.detectedPorts = Array.from(ports).sort((a, b) => a - b);
    saveProcesses(processes);
  }
}

/**
 * Stop a script by PID
 */
export async function stopScript(pid: number): Promise<boolean> {
  try {
    const processes = loadProcesses();
    const processInfo = processes.find(p => p.pid === pid);
    
    if (!processInfo) {
      return false;
    }

    // Check if process is still running before trying to kill it
    let processExists = false;
    try {
      if (os.platform() === 'win32') {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
        processExists = true;
      } else {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        await execAsync(`ps -p ${pid} -o pid=`);
        processExists = true;
      }
    } catch {
      // Process doesn't exist anymore
      processExists = false;
    }

    // Try to kill the process (cross-platform)
    if (processExists) {
      try {
        if (os.platform() === 'win32') {
          const { exec } = require('child_process');
          const { promisify } = require('util');
          const execAsync = promisify(exec);
          await execAsync(`taskkill /F /PID ${pid}`);
        } else {
          const { exec } = require('child_process');
          const { promisify } = require('util');
          const execAsync = promisify(exec);
          await execAsync(`kill -9 ${pid}`);
        }
      } catch (error) {
        // Process may have already exited
        console.error(`Error killing process ${pid}:`, error);
      }
    }

    // Remove from tracking regardless of whether kill succeeded
    removeProcess(pid);
    return true;
  } catch (error) {
    console.error(`Error stopping script ${pid}:`, error);
    return false;
  }
}

/**
 * Stop a script by port (finds process using port and kills it)
 */
export async function stopScriptByPort(port: number): Promise<boolean> {
  try {
    const processInfo = await getProcessOnPort(port);
    if (!processInfo) {
      return false;
    }

    // Check if this is a tracked process
    const processes = loadProcesses();
    const trackedProcess = processes.find(p => p.pid === processInfo.pid);
    
    if (trackedProcess) {
      // Use the tracked process removal
      return await stopScript(processInfo.pid);
    } else {
      // Kill the process directly
      const killed = await killProcessOnPort(port);
      return killed;
    }
  } catch (error) {
    return false;
  }
}

/**
 * Stop all processes for a project
 */
export async function stopProjectProcesses(projectPath: string): Promise<number> {
  const processes = getProjectProcesses(projectPath);
  let stopped = 0;
  
  for (const process of processes) {
    if (await stopScript(process.pid)) {
      stopped++;
    }
  }
  
  return stopped;
}

/**
 * Execute a script in the background (minimal logging)
 */
export function runScriptInBackground(
  projectPath: string,
  projectName: string,
  scriptName: string,
  args: string[] = [],
  force: boolean = false
): Promise<number> {
  return new Promise(async (resolve, reject) => {
    const projectScripts = getProjectScripts(projectPath);
    const script = projectScripts.scripts.get(scriptName);

    if (!script) {
      reject(new Error(`Script "${scriptName}" not found in project`));
      return;
    }

    // Proactive port checking
    const canProceed = await checkPortsBeforeExecution(projectPath, scriptName, force);
    if (!canProceed) {
      reject(new Error('Port conflict not resolved'));
      return;
    }

    let command: string;
    let commandArgs: string[];

    switch (script.runner) {
      case 'npm':
        command = 'npm';
        commandArgs = ['run', scriptName, ...args];
        break;
      case 'yarn':
        command = 'yarn';
        commandArgs = [scriptName, ...args];
        break;
      case 'pnpm':
        command = 'pnpm';
        commandArgs = ['run', scriptName, ...args];
        break;
      case 'python':
        command = 'python';
        commandArgs = ['-m', ...script.command.split(' ').slice(1), ...args];
        break;
      case 'poetry':
        command = 'poetry';
        const modulePath = script.command.split(' ').slice(1).join(' ');
        commandArgs = ['run', 'python', '-m', modulePath, ...args];
        break;
      case 'cargo':
        command = 'cargo';
        commandArgs = scriptName === 'run' ? ['run', ...args] : [scriptName, ...args];
        break;
      case 'go':
        command = 'go';
        commandArgs = script.command.split(' ').slice(1);
        if (scriptName === 'run' && args.length > 0) {
          commandArgs = ['run', ...args];
        } else {
          commandArgs = [...commandArgs, ...args];
        }
        break;
      case 'make':
        command = 'make';
        commandArgs = [scriptName, ...args];
        break;
      default:
        const parts = script.command.split(' ');
        command = parts[0];
        commandArgs = [...parts.slice(1), ...args];
        break;
    }

    // Create log file for the process
    const dataDir = path.join(os.homedir(), '.projax');
    const logsDir = path.join(dataDir, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const logFile = path.join(logsDir, `process-${Date.now()}-${scriptName}.log`);

    // Open log file with file descriptors that can be inherited by child process
    const logFd = fs.openSync(logFile, 'a');
    
    // Spawn process in detached mode with output redirected to log file
    let child;
    try {
      child = spawn(command, commandArgs, {
      cwd: projectPath,
        stdio: ['ignore', logFd, logFd], // Redirect stdout and stderr to log file descriptor
      detached: true,
      shell: process.platform === 'win32',
      });
    } catch (spawnError) {
      fs.closeSync(logFd);
      reject(new Error(`Failed to spawn process: ${spawnError instanceof Error ? spawnError.message : String(spawnError)}`));
      return;
    }
    
    if (!child.pid) {
      fs.closeSync(logFd);
      reject(new Error('Failed to start process: no PID assigned'));
      return;
    }
    
    // Handle spawn errors
    child.on('error', (error) => {
      fs.closeSync(logFd);
      reject(new Error(`Process spawn error: ${error.message}`));
    });
    
    // Close the file descriptor in parent process after a short delay
    // The child process will have its own copy
    setTimeout(() => {
      try {
        fs.closeSync(logFd);
      } catch {
        // Already closed or error, ignore
      }
    }, 1000);

    // Store process info
    const processInfo: BackgroundProcess = {
      pid: child.pid,
      projectPath,
      projectName,
      scriptName,
      command: `${command} ${commandArgs.join(' ')}`,
      startedAt: Date.now(),
      logFile,
    };

    addProcess(processInfo);

    // Listen for process exit to clean up tracking
    child.on('exit', async (code, signal) => {
      // Remove from tracking when process exits
      removeProcess(child.pid!);
      
      // Log exit information
      if (code !== null) {
        fs.appendFileSync(logFile, `\n\n[Process exited with code ${code}]\n`);
      } else if (signal !== null) {
        fs.appendFileSync(logFile, `\n\n[Process killed by signal ${signal}]\n`);
      }
      
      // Check if this was a test script and parse results
      await checkAndParseTestResults(logFile, projectPath, scriptName);
    });

    // Unref so parent can exit and process runs independently
    child.unref();

    // Show minimal output
    console.log(`✓ Started "${projectName}" (${scriptName}) in background [PID: ${child.pid}]`);
    console.log(`  Logs: ${logFile}`);
    console.log(`  Command: ${command} ${commandArgs.join(' ')}\n`);

    // For background processes, we can't easily do reactive detection
    // But we can check the log file after a short delay for port conflicts and URLs
    setTimeout(async () => {
      try {
        // Wait a bit for process to start and potentially fail
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (fs.existsSync(logFile)) {
          const logContent = fs.readFileSync(logFile, 'utf-8');
          
          // Check for port conflicts
          const port = extractPortFromError(logContent);
          if (port) {
            console.error(`\n⚠️  Port conflict detected in background process: port ${port} is in use`);
            console.error(`   Check log file: ${logFile}`);
            console.error(`   Use: prx <project> <script> --force to auto-resolve port conflicts\n`);
          }
          
          // Extract URLs from output
          const urls = extractUrlsFromOutput(logContent);
          if (urls.length > 0) {
            updateProcessUrls(child.pid!, urls);
          }
        }
      } catch {
        // Ignore errors checking log file
      }
    }, 3000);
    
    // Also check for URLs from detected ports
    setTimeout(async () => {
      try {
        const db = getDatabaseManager();
        const project = db.getProjectByPath(projectPath);
        if (project) {
          const ports = db.getProjectPorts(project.id);
          const urls: string[] = [];
          for (const portInfo of ports) {
            if (portInfo.script_name === scriptName) {
              urls.push(`http://localhost:${portInfo.port}`);
            }
          }
          if (urls.length > 0) {
            updateProcessUrls(child.pid!, urls);
          }
        }
      } catch {
        // Ignore errors
      }
    }, 5000);

    // Check for test results periodically (for watch mode tests)
    // Parse results every 10 seconds for the first 60 seconds, then every 30 seconds
    let parseAttempt = 0;
    const parseInterval = setInterval(async () => {
      parseAttempt++;
      
      // Stop parsing after 10 minutes or if process is dead
      if (parseAttempt > 20 || !child.pid) {
        clearInterval(parseInterval);
        return;
      }
      
      await checkAndParseTestResults(logFile, projectPath, scriptName);
      
      // After first minute, slow down to every 30 seconds
      if (parseAttempt >= 6) {
        clearInterval(parseInterval);
        const slowInterval = setInterval(async () => {
          await checkAndParseTestResults(logFile, projectPath, scriptName);
        }, 30000);
        
        // Stop after 10 minutes total
        setTimeout(() => clearInterval(slowInterval), 540000);
      }
    }, 10000); // Initial interval: every 10 seconds

    // Resolve with PID since process is running in background
    resolve(child.pid);
  });
}

/**
 * Check log file for test output and parse results
 */
async function checkAndParseTestResults(logFile: string, projectPath: string, scriptName: string): Promise<void> {
  try {
    // Only parse if script name suggests it's a test command
    const testScriptPatterns = ['test', 'spec', 'jest', 'vitest', 'mocha', 'pytest', 'unittest'];
    const isTestScript = testScriptPatterns.some(pattern => scriptName.toLowerCase().includes(pattern));
    
    if (!isTestScript) {
      return;
    }
    
    // Read the log file
    if (!fs.existsSync(logFile)) {
      return;
    }
    
    const logContent = fs.readFileSync(logFile, 'utf-8');
    
    // Import test parser (dynamic to avoid circular dependency issues)
    const testParserPath = path.join(__dirname, 'test-parser.js');
    if (!fs.existsSync(testParserPath)) {
      // Parser not available (might be in development mode)
      return;
    }
    
    const { parseTestOutput, isTestOutput } = await import(testParserPath);
    
    // Check if output contains test results
    if (!isTestOutput(logContent)) {
      return;
    }
    
    // Parse test results
    const parsed = parseTestOutput(logContent);
    if (!parsed) {
      return;
    }
    
    // Get project from database
    const db = getDatabaseManager();
    const project = db.getProjectByPath(projectPath);
    if (!project) {
      return;
    }
    
    // Save test results to database
    db.addTestResult(
      project.id,
      scriptName,
      parsed.passed,
      parsed.failed,
      parsed.skipped,
      parsed.total,
      parsed.duration,
      parsed.coverage,
      parsed.framework,
      logContent.slice(-5000) // Store last 5000 chars of output
    );
    
    console.log(`\n📊 Test results saved: ${parsed.passed} passed, ${parsed.failed} failed, ${parsed.skipped} skipped`);
  } catch (error) {
    // Silently fail - test parsing is optional
    console.error('Error parsing test results:', error);
  }
}

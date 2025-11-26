#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as http from 'http';
import { pathToFileURL } from 'url';
import { execSync } from 'child_process';
import {
  getDatabaseManager,
  getAllProjects,
  addProject,
  removeProject,
  scanProject,
  scanAllProjects,
  Project,
} from './core-bridge';
import { getProjectScripts, runScript, runScriptInBackground } from './script-runner';
import { scanProjectPorts, shouldRescanPorts } from './port-scanner';

// Read version from package.json
const packageJson = require('../package.json');

// Function to create application launcher alias
async function handleAddApplicationAlias() {
  const platform = os.platform();
  
  try {
    switch (platform) {
      case 'darwin': // macOS
        await createMacOSAppAlias();
        break;
      case 'linux':
        await createLinuxAppAlias();
        break;
      case 'win32': // Windows
        await createWindowsAppAlias();
        break;
      default:
        console.error(`Unsupported platform: ${platform}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('Error creating application alias:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Create macOS application alias
async function createMacOSAppAlias() {
  const appName = 'Projax';
  const appPath = `/Applications/${appName}.app`;
  
  // Get the path to the prx command
  let prxPath: string;
  try {
    prxPath = execSync('which prx', { encoding: 'utf-8' }).trim();
  } catch (error) {
    console.error('Error: prx command not found. Please ensure projax is installed globally.');
    process.exit(1);
  }
  
  if (!prxPath) {
    console.error('Error: prx command not found. Please ensure projax is installed globally.');
    process.exit(1);
  }
  
  // Create .app bundle structure
  const contentsDir = path.join(appPath, 'Contents');
  const macOSDir = path.join(contentsDir, 'MacOS');
  const resourcesDir = path.join(contentsDir, 'Resources');
  
  console.log(`\n📦 Creating ${appName}.app in /Applications...`);
  
  // Create directories
  fs.mkdirSync(macOSDir, { recursive: true });
  fs.mkdirSync(resourcesDir, { recursive: true });
  
  // Create Info.plist
  const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>projax-launcher</string>
    <key>CFBundleIdentifier</key>
    <string>dev.projax.app</string>
    <key>CFBundleName</key>
    <string>${appName}</string>
    <key>CFBundleDisplayName</key>
    <string>${appName}</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>`;
  
  fs.writeFileSync(path.join(contentsDir, 'Info.plist'), infoPlist);
  
  // Create launcher script
  const launcherScript = `#!/bin/bash
# Projax Application Launcher
# This launches the Projax UI

# Ensure we have the right PATH
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.nvm/versions/node/$(ls -1 $HOME/.nvm/versions/node | tail -1)/bin:$PATH"

# Find prx command
PRX_CMD="${prxPath}"

# If not found, try to find it in common locations
if [ ! -x "$PRX_CMD" ]; then
    for dir in /usr/local/bin /opt/homebrew/bin $HOME/.nvm/versions/node/*/bin; do
        if [ -x "$dir/prx" ]; then
            PRX_CMD="$dir/prx"
            break
        fi
    done
fi

# Launch Projax UI
if [ -x "$PRX_CMD" ]; then
    "$PRX_CMD" ui 2>&1 | logger -t Projax &
else
    osascript -e 'display alert "Projax Error" message "Could not find prx command. Please ensure projax is installed: npm install -g projax"'
fi
`;
  
  const launcherPath = path.join(macOSDir, 'projax-launcher');
  fs.writeFileSync(launcherPath, launcherScript);
  fs.chmodSync(launcherPath, 0o755);
  
  console.log(`✓ Created ${appName}.app`);
  console.log(`✓ Application launcher installed at: ${appPath}`);
  console.log(`\n🎉 You can now launch Projax from:`);
  console.log(`   - Spotlight (Cmd+Space, type "${appName}")`);
  console.log(`   - Launchpad`);
  console.log(`   - Applications folder`);
  console.log(`\n💡 Tip: You can also drag ${appName}.app to your Dock for quick access!`);
}

// Create Linux application alias
async function createLinuxAppAlias() {
  const appName = 'Projax';
  const desktopFile = path.join(os.homedir(), '.local', 'share', 'applications', 'projax.desktop');
  
  // Get the path to the prx command
  let prxPath: string;
  try {
    prxPath = execSync('which prx', { encoding: 'utf-8' }).trim();
  } catch (error) {
    console.error('Error: prx command not found. Please ensure projax is installed globally.');
    process.exit(1);
  }
  
  console.log(`\n📦 Creating ${appName} desktop entry...`);
  
  // Ensure directory exists
  const applicationsDir = path.dirname(desktopFile);
  fs.mkdirSync(applicationsDir, { recursive: true });
  
  // Create .desktop file
  const desktopContent = `[Desktop Entry]
Version=1.0
Type=Application
Name=${appName}
Comment=Project Management Dashboard
Exec=${prxPath} ui
Terminal=false
Categories=Development;Utility;
Keywords=project;dashboard;dev;
StartupNotify=true
`;
  
  fs.writeFileSync(desktopFile, desktopContent);
  fs.chmodSync(desktopFile, 0o755);
  
  // Update desktop database
  try {
    execSync('update-desktop-database ~/.local/share/applications', { stdio: 'ignore' });
  } catch (error) {
    // Ignore errors - not all systems have this command
  }
  
  console.log(`✓ Created desktop entry: ${desktopFile}`);
  console.log(`\n🎉 You can now launch Projax from:`);
  console.log(`   - Application menu`);
  console.log(`   - Application launcher (search for "${appName}")`);
  console.log(`\n💡 Tip: You may need to log out and back in for the entry to appear.`);
}

// Create Windows application alias
async function createWindowsAppAlias() {
  const appName = 'Projax';
  const startMenuPath = path.join(
    process.env.APPDATA || '',
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs'
  );
  
  // Get the path to the prx command
  let prxPath: string;
  try {
    prxPath = execSync('where prx', { encoding: 'utf-8' }).trim().split('\n')[0];
  } catch (error) {
    console.error('Error: prx command not found. Please ensure projax is installed globally.');
    process.exit(1);
  }
  
  console.log(`\n📦 Creating ${appName} Start Menu shortcut...`);
  
  // Create a batch file to launch Projax
  const batchFile = path.join(startMenuPath, 'Projax.bat');
  const batchContent = `@echo off
"${prxPath}" ui
`;
  
  fs.writeFileSync(batchFile, batchContent);
  
  // Try to create a VBScript to create a proper shortcut
  const vbsScript = `
Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = "${path.join(startMenuPath, 'Projax.lnk').replace(/\\/g, '\\\\')}"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "cmd.exe"
oLink.Arguments = "/c \\"${prxPath.replace(/\\/g, '\\\\')}\\" ui"
oLink.WorkingDirectory = "${os.homedir().replace(/\\/g, '\\\\')}"
oLink.Description = "Projax - Project Management Dashboard"
oLink.WindowStyle = 7
oLink.Save
`;
  
  const vbsFile = path.join(os.tmpdir(), 'create-projax-shortcut.vbs');
  fs.writeFileSync(vbsFile, vbsScript);
  
  try {
    execSync(`cscript //nologo "${vbsFile}"`, { stdio: 'ignore' });
    fs.unlinkSync(vbsFile);
    fs.unlinkSync(batchFile);
    
    console.log(`✓ Created Start Menu shortcut`);
    console.log(`\n🎉 You can now launch Projax from:`);
    console.log(`   - Start Menu (search for "${appName}")`);
    console.log(`   - Taskbar (pin the shortcut)`);
  } catch (error) {
    // Fallback: just use the batch file
    console.log(`✓ Created Start Menu batch file: ${batchFile}`);
    console.log(`\n🎉 You can now launch Projax from:`);
    console.log(`   - Start Menu (search for "${appName}")`);
    console.log(`\n⚠️  Note: Could not create a proper shortcut. Using batch file instead.`);
  }
}

// Function to check API status
async function checkAPIStatus(): Promise<{ running: boolean; port: number | null }> {
  const dataDir = path.join(require('os').homedir(), '.projax');
  const portFile = path.join(dataDir, 'api-port.txt');
  
  let port: number | null = null;
  if (fs.existsSync(portFile)) {
    try {
      const portStr = fs.readFileSync(portFile, 'utf-8').trim();
      port = parseInt(portStr, 10) || null;
    } catch {
      // Ignore
    }
  }
  
  if (!port) {
    // Try common ports
    const ports = [3001, 3002, 3003, 3004, 3005];
    for (const p of ports) {
      try {
        const result = await new Promise<boolean>((resolve) => {
          const req = http.get(`http://localhost:${p}/health`, (res) => {
            resolve(res.statusCode === 200);
          });
          req.on('error', () => resolve(false));
          req.setTimeout(500, () => {
            req.destroy();
            resolve(false);
          });
        });
        if (result) {
          port = p;
          break;
        }
      } catch {
        // Continue
      }
    }
  }
  
  if (port) {
    try {
      const result = await new Promise<boolean>((resolve) => {
        const req = http.get(`http://localhost:${port}/health`, (res) => {
          resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(500, () => {
          req.destroy();
          resolve(false);
        });
      });
      return { running: result, port };
    } catch {
      return { running: false, port };
    }
  }
  
  return { running: false, port: null };
}

function resolveApiEntry(): string | null {
  const candidates = [
    // Packaged CLI (dist/api/index.js)
    path.join(__dirname, 'api', 'index.js'),
    // Development builds inside workspace
    path.join(__dirname, '..', 'api', 'dist', 'index.js'),
    path.join(__dirname, '..', '..', 'api', 'dist', 'index.js'),
    path.join(__dirname, '..', '..', '..', 'api', 'dist', 'index.js'),
  ];
  
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  
  return null;
}

// Function to start the API server
async function startAPIServer(silent: boolean = false): Promise<boolean> {
  const { spawn } = require('child_process');
  const apiPath = resolveApiEntry();
  
  if (!apiPath) {
    if (!silent) {
      console.error('Error: API server not found. Please build it first: npm run build --workspace=packages/api');
    }
    return false;
  }
  
  if (!silent) {
    console.log('Starting API server...');
  }
  
  try {
    const child = spawn('node', [apiPath], {
      detached: true,
      stdio: silent ? 'ignore' : 'inherit',
    });
    
    // When not silent, keep the process attached for a moment to see any immediate errors
    if (!silent) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          child.unref();
          console.log('✓ API server started');
          resolve(true);
        }, 1000);
        
        child.on('error', (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        });
        
        child.on('exit', (code: number | null) => {
          if (code !== 0 && code !== null) {
            clearTimeout(timeout);
            reject(new Error(`API server exited with code ${code}`));
          }
        });
      });
    } else {
      child.unref();
    }
    
    return true;
  } catch (error) {
    if (!silent) {
      console.error('Error starting API server:', error instanceof Error ? error.message : error);
    }
    return false;
  }
}

// Function to ensure API server is running (auto-start if needed)
async function ensureAPIServerRunning(silent: boolean = true): Promise<void> {
  const apiStatus = await checkAPIStatus();
  
  if (apiStatus.running) {
    // API is already running, nothing to do
    return;
  }
  
  // API is not running, start it
  if (!silent) {
    console.log('Starting API server...');
  }
  
  const started = await startAPIServer(silent);
  
  if (!started) {
    // Failed to start, but don't throw - let the command continue
    // The error message was already shown if not silent
    return;
  }
  
  // Wait a bit for the API server to start up
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Verify it's running
  const verifyStatus = await checkAPIStatus();
  if (!verifyStatus.running && !silent) {
    console.warn('⚠️  API server may not have started successfully. Check logs if needed.');
  }
}

// ASCII logo for projax - using a clearer style that shows all 6 letters
function displayLogo() {
  return `
  PROJAX ${packageJson.version}
  
  Command line not your thing? Try our native UI:
  → prx web
  
  `;
  return `
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║     ██████╗ ██████╗  ██████╗      ██╗  ██╗ █████╗ ██╗  ║
║     ██╔══██╗██╔══██╗██╔═══██╗     ██║  ██║██╔══██╗╚██╗ ║
║     ██████╔╝██████╔╝██║   ██║     ███████║╚█████╔╝ ╚██║ ║
║     ██╔═══╝ ██╔══██╗██║   ██║██   ██╔══██║██╔══██╗ ██║ ║
║     ██║     ██║  ██║╚██████╔╝╚█████╔╝██║╚█████╔╝ ██║ ║
║     ╚═╝     ╚═╝  ╚═╝ ╚═════╝  ╚════╝ ╚═╝ ╚════╝  ╚═╝ ║
║                                                       ║
║              Version ${packageJson.version}              ║
║                                                       ║
║      Use "prx api" to check API server status        ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
`;
}

const program = new Command();

program
  .name('prx')
  .description('Project management dashboard CLI')
  .version(packageJson.version)
  .addHelpText('beforeAll', displayLogo());

// Interactive terminal UI command (hidden - in beta)
program
  .command('prxi', { hidden: true })  // Hide from help output while in beta
  .alias('i')
  .description('Launch interactive terminal UI (beta)')
  .action(async () => {
    try {
      await ensureAPIServerRunning(true);
      
      // Find the prxi source file - use CLI's embedded prxi.tsx
      const prxiPaths = [
        path.join(__dirname, '..', 'src', 'prxi.tsx'), // Development (packages/cli/src/prxi.tsx)
        path.join(__dirname, 'prxi.tsx'), // When running from dist
      ];
      
      const prxiPath = prxiPaths.find(p => fs.existsSync(p));
      
      if (!prxiPath) {
        console.error('Error: prxi UI not found.');
        console.error('Looked in:', prxiPaths);
        process.exit(1);
      }
      
      // Find tsx binary - it should be in CLI's node_modules since tsx is a dependency
      const tsxPaths = [
        path.join(__dirname, '..', 'node_modules', '.bin', 'tsx'), // When running from built CLI
        path.join(__dirname, '..', '..', '..', 'node_modules', '.bin', 'tsx'), // When running from workspace root
        'tsx', // Fallback to PATH
      ];
      
      let tsxBin = tsxPaths.find(p => p === 'tsx' || fs.existsSync(p));
      
      if (!tsxBin) {
        console.error('Error: tsx not found. Please install dependencies: npm install');
        process.exit(1);
      }
      
      // Run prxi using node with tsx/esm loader for proper ESM support
      const { spawn} = require('child_process');
      
      // Get the prxi package directory (prxi/src/index.tsx -> prxi)
      const prxiPackageDir = path.dirname(path.dirname(prxiPath));
      
      // Try to find tsx loader module paths
      const tsxLoaderPaths = [
        path.join(__dirname, '..', 'node_modules', 'tsx', 'dist', 'loader.mjs'),
        path.join(prxiPackageDir, 'node_modules', 'tsx', 'dist', 'loader.mjs'),
        path.join(__dirname, '..', '..', '..', 'node_modules', 'tsx', 'dist', 'loader.mjs'),
      ];
      
      const tsxLoader = tsxLoaderPaths.find(p => fs.existsSync(p));
      
      if (tsxLoader) {
        // Use node --import for proper ESM support with TypeScript (Node 18.19+)
        const child = spawn(process.execPath, ['--import', tsxLoader, prxiPath], {
          stdio: 'inherit',
          cwd: prxiPackageDir,
          env: {
            ...process.env,
            NODE_NO_WARNINGS: '1', // Suppress experimental loader warning
          },
        });
        
        child.on('exit', (code: number | null) => {
          process.exit(code || 0);
        });
      } else {
        // Fallback to tsx binary
        const child = spawn(tsxBin, [prxiPath], {
          stdio: 'inherit',
          cwd: prxiPackageDir,
        });
        
        child.on('exit', (code: number | null) => {
          process.exit(code || 0);
        });
      }
    } catch (error) {
      console.error('Error launching prxi:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Add project command
program
  .command('add')
  .description('Add a project to the dashboard')
  .argument('[path]', 'Path to the project directory')
  .option('-n, --name <name>', 'Custom name for the project (defaults to directory name)')
  .option('-d, --description <description>', 'Description for the project')
  .option('--tags <tags>', 'Comma-separated list of tags')
  .action(async (projectPath?: string, options?: { name?: string; description?: string; tags?: string }) => {
    try {
      await ensureAPIServerRunning(true);
      
      let finalPath = projectPath;
      
      if (!finalPath) {
        const inquirer = (await import('inquirer')).default;
        const answer = await inquirer.prompt([
          {
            type: 'input',
            name: 'path',
            message: 'Enter the path to your project:',
            validate: (input: string) => {
              if (!input.trim()) {
                return 'Path is required';
              }
              const resolvedPath = path.resolve(input);
              if (!fs.existsSync(resolvedPath)) {
                return 'Path does not exist';
              }
              if (!fs.statSync(resolvedPath).isDirectory()) {
                return 'Path must be a directory';
              }
              return true;
            },
          },
        ]);
        finalPath = answer.path;
      }
      
      const resolvedPath = path.resolve(finalPath!);
      
      if (!fs.existsSync(resolvedPath)) {
        console.error(`Error: Path does not exist: ${resolvedPath}`);
        process.exit(1);
      }
      
      if (!fs.statSync(resolvedPath).isDirectory()) {
        console.error(`Error: Path is not a directory: ${resolvedPath}`);
        process.exit(1);
      }
      
      const db = getDatabaseManager();
      const existingProject = db.getProjectByPath(resolvedPath);
      
      if (existingProject) {
        console.log(`Project already exists: ${existingProject.name} (ID: ${existingProject.id})`);
        return;
      }
      
      // Determine project name: use custom name if provided, otherwise prompt or use basename
      let projectName: string;
      if (options?.name) {
        projectName = options.name.trim();
      } else {
        const defaultName = path.basename(resolvedPath);
        const inquirer = (await import('inquirer')).default;
        const nameAnswer = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Enter a name for this project:',
            default: defaultName,
            validate: (input: string) => {
              if (!input.trim()) {
                return 'Project name is required';
              }
              return true;
            },
          },
        ]);
        projectName = nameAnswer.name.trim();
      }
      
      const project = db.addProject(projectName, resolvedPath);
      
      // Update description and tags if provided
      const updates: { description?: string | null; tags?: string[] } = {};
      if (options?.description !== undefined) {
        updates.description = options.description.trim() || null;
      }
      if (options?.tags) {
        updates.tags = options.tags.split(',').map(t => t.trim()).filter(Boolean);
      }
      
      if (Object.keys(updates).length > 0) {
        db.updateProject(project.id, updates);
      }
      
      console.log(`✓ Added project: ${project.name} (ID: ${project.id})`);
      console.log(`  Path: ${project.path}`);
      if (options?.description) {
        console.log(`  Description: ${options.description}`);
      }
      if (options?.tags) {
        console.log(`  Tags: ${options.tags}`);
      }
      
      // Ask if user wants to scan for tests
      const inquirer = (await import('inquirer')).default;
      const scanAnswer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'scan',
          message: 'Would you like to scan for tests now?',
          default: true,
        },
      ]);
      
      if (scanAnswer.scan) {
        console.log('Scanning for tests...');
        const result = scanProject(project.id);
        console.log(`✓ Found ${result.testsFound} test file(s)`);
        if (result.tests.length > 0) {
          console.log('  Test files:');
          result.tests.forEach(test => {
            console.log(`    - ${test.file_path}${test.framework ? ` (${test.framework})` : ''}`);
          });
        }
      }

      // Scan for ports in background
      console.log('Scanning for ports...');
      try {
        await scanProjectPorts(project.id);
        const ports = db.getProjectPorts(project.id);
        if (ports.length > 0) {
          console.log(`✓ Found ${ports.length} port(s)`);
          const portList = ports.map(p => p.port).sort((a, b) => a - b).join(', ');
          console.log(`  Ports: ${portList}`);
        } else {
          console.log('  No ports detected');
        }
      } catch (error) {
        // Ignore port scanning errors
        console.log('  Port scanning skipped');
      }
    } catch (error) {
      console.error('Error adding project:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// List projects command
program
  .command('list')
  .description('List all tracked projects')
  .option('-v, --verbose', 'Show detailed information')
  .option('--ports', 'Show detailed port information per script')
  .action(async (options) => {
    try {
      await ensureAPIServerRunning(true);
      
      const db = getDatabaseManager();
      const projects = getAllProjects();
      
      if (projects.length === 0) {
        console.log('No projects tracked yet. Use "prx add" to add a project.');
        return;
      }

      // Check if ports need rescanning and do it in background if needed
      for (const project of projects) {
        if (shouldRescanPorts(project.id)) {
          // Rescan ports asynchronously (don't wait)
          scanProjectPorts(project.id).catch(() => {
            // Ignore errors in background scanning
          });
        }
      }
      
      if (options.ports) {
        // Detailed port view
        console.log('\nProjects with Port Information:\n');
        for (const project of projects) {
          const ports = db.getProjectPorts(project.id);
          const tests = db.getTestsByProject(project.id);
          const lastScanned = project.last_scanned
            ? new Date(project.last_scanned * 1000).toLocaleString()
            : 'Never';
          
          console.log(`${project.id}. ${project.name}`);
          console.log(`   Path: ${project.path}`);
          console.log(`   Tests: ${tests.length} | Last scanned: ${lastScanned}`);
          
          if (ports.length === 0) {
            console.log(`   Ports: N/A`);
          } else {
            console.log(`   Ports:`);
            // Group by script
            const portsByScript = new Map<string | null, number[]>();
            for (const port of ports) {
              const script = port.script_name || 'general';
              if (!portsByScript.has(script)) {
                portsByScript.set(script, []);
              }
              portsByScript.get(script)!.push(port.port);
            }
            
            for (const [script, portList] of portsByScript.entries()) {
              const scriptLabel = script === 'general' ? '  (general)' : `  ${script}:`;
              console.log(`     ${scriptLabel} ${portList.sort((a, b) => a - b).join(', ')}`);
            }
          }
          console.log('');
        }
      } else {
        // Table format
        console.log(`\nTracked Projects (${projects.length}):\n`);
        
        // Calculate column widths
        const idWidth = Math.max(3, projects.length.toString().length);
        const nameWidth = Math.max(4, ...projects.map(p => p.name.length));
        const pathWidth = Math.max(4, Math.min(40, ...projects.map(p => p.path.length)));
        const portsWidth = 12;
        const testsWidth = 6;
        const scannedWidth = 20;
        
        // Header
        const header = [
          'ID'.padEnd(idWidth),
          'Name'.padEnd(nameWidth),
          'Path'.padEnd(pathWidth),
          'Ports'.padEnd(portsWidth),
          'Tests'.padEnd(testsWidth),
          'Last Scanned'.padEnd(scannedWidth),
        ].join(' | ');
        console.log(header);
        console.log('-'.repeat(header.length));
        
        // Rows
        for (const project of projects) {
          const ports = db.getProjectPorts(project.id);
          const tests = db.getTestsByProject(project.id);
          const lastScanned = project.last_scanned
            ? new Date(project.last_scanned * 1000).toLocaleString()
            : 'Never';
          
          const portStr = ports.length > 0
            ? ports.map(p => p.port).sort((a, b) => a - b).join(', ')
            : 'N/A';
          
          const pathDisplay = project.path.length > 40
            ? '...' + project.path.slice(-37)
            : project.path;
          
          const row = [
            project.id.toString().padEnd(idWidth),
            project.name.padEnd(nameWidth),
            pathDisplay.padEnd(pathWidth),
            portStr.padEnd(portsWidth),
            tests.length.toString().padEnd(testsWidth),
            lastScanned.padEnd(scannedWidth),
          ].join(' | ');
          console.log(row);
        }
        console.log('');
      }
    } catch (error) {
      console.error('Error listing projects:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Scan command
program
  .command('scan')
  .description('Scan projects for test files')
  .argument('[project]', 'Project ID or name to scan (leave empty to scan all)')
  .action(async (projectIdentifier?: string) => {
    try {
      await ensureAPIServerRunning(true);
      
      const db = getDatabaseManager();
      
      if (projectIdentifier) {
        // Find project by ID or name
        const projects = getAllProjects();
        const project = projects.find(
          (p: Project) => p.id.toString() === projectIdentifier || p.name === projectIdentifier
        );
        
        if (!project) {
          console.error(`Error: Project not found: ${projectIdentifier}`);
          process.exit(1);
        }
        
        console.log(`Scanning project: ${project.name}...`);
        const result = scanProject(project.id);
        console.log(`✓ Found ${result.testsFound} test file(s)`);
        
        if (result.tests.length > 0) {
          console.log('\nTest files:');
          result.tests.forEach(test => {
            console.log(`  - ${test.file_path}${test.framework ? ` (${test.framework})` : ''}`);
          });
        }

        // Also scan ports
        console.log('\nScanning for ports...');
        try {
          await scanProjectPorts(project.id);
          const ports = db.getProjectPorts(project.id);
          if (ports.length > 0) {
            console.log(`✓ Found ${ports.length} port(s)`);
            const portList = ports.map(p => p.port).sort((a, b) => a - b).join(', ');
            console.log(`  Ports: ${portList}`);
          } else {
            console.log('  No ports detected');
          }
        } catch (error) {
          console.log('  Port scanning failed');
        }
      } else {
        // Scan all projects
        console.log('Scanning all projects...\n');
        const results = scanAllProjects();
        
        for (const result of results) {
          console.log(`${result.project.name}: ${result.testsFound} test file(s)`);
        }
        
        const totalTests = results.reduce((sum, r) => sum + r.testsFound, 0);
        console.log(`\n✓ Total: ${totalTests} test file(s) found across ${results.length} project(s)`);

        // Scan ports for all projects
        console.log('\nScanning ports for all projects...');
        try {
          const { scanAllProjectPorts } = await import('./port-scanner');
          await scanAllProjectPorts();
          console.log('✓ Port scanning completed');
        } catch (error) {
          console.log('  Port scanning failed');
        }
      }
    } catch (error) {
      console.error('Error scanning projects:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Rename command
program
  .command('rn')
  .alias('rename')
  .description('Rename a project')
  .argument('<project>', 'Project ID or name to rename')
  .argument('<newName>', 'New name for the project')
  .action((projectIdentifier: string, newName: string) => {
    try {
      const db = getDatabaseManager();
      const projects = getAllProjects();
      const project = projects.find(
        p => p.id.toString() === projectIdentifier || p.name === projectIdentifier
      );
      
      if (!project) {
        console.error(`Error: Project not found: ${projectIdentifier}`);
        process.exit(1);
      }
      
      if (!newName || !newName.trim()) {
        console.error('Error: New name cannot be empty');
        process.exit(1);
      }
      
      const trimmedName = newName.trim();
      const updated = db.updateProjectName(project.id, trimmedName);
      console.log(`✓ Renamed project from "${project.name}" to "${updated.name}"`);
    } catch (error) {
      console.error('Error renaming project:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Description command
program
  .command('desc')
  .alias('description')
  .description('Set or get project description')
  .argument('<project>', 'Project ID or name')
  .argument('[description]', 'New description (leave empty to view current)')
  .action(async (projectIdentifier: string, description?: string) => {
    try {
      await ensureAPIServerRunning(true);
      
      const db = getDatabaseManager();
      const projects = getAllProjects();
      const project = projects.find(
        p => p.id.toString() === projectIdentifier || p.name === projectIdentifier
      );
      
      if (!project) {
        console.error(`Error: Project not found: ${projectIdentifier}`);
        process.exit(1);
      }
      
      if (description === undefined) {
        // Show current description
        if (project.description) {
          console.log(project.description);
        } else {
          console.log('No description set.');
        }
      } else {
        // Update description
        const trimmedDesc = description.trim() || null;
        db.updateProject(project.id, { description: trimmedDesc });
        if (trimmedDesc) {
          console.log(`✓ Updated description for "${project.name}": ${trimmedDesc}`);
        } else {
          console.log(`✓ Removed description for "${project.name}"`);
        }
      }
    } catch (error) {
      console.error('Error managing description:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Tags command
program
  .command('tags')
  .description('Manage project tags')
  .argument('<project>', 'Project ID or name')
  .argument('[action]', 'Action: add, remove, or list (default: list)', 'list')
  .argument('[tag]', 'Tag name (required for add/remove)')
  .action(async (projectIdentifier: string, action: string = 'list', tag?: string) => {
    try {
      await ensureAPIServerRunning(true);
      
      const db = getDatabaseManager();
      const projects = getAllProjects();
      const project = projects.find(
        p => p.id.toString() === projectIdentifier || p.name === projectIdentifier
      );
      
      if (!project) {
        console.error(`Error: Project not found: ${projectIdentifier}`);
        process.exit(1);
      }
      
      const currentTags = project.tags || [];
      
      if (action === 'list' || !action) {
        // List tags
        if (currentTags.length === 0) {
          console.log('No tags set for this project.');
        } else {
          console.log(`Tags for "${project.name}":`);
          currentTags.forEach(t => console.log(`  - ${t}`));
        }
      } else if (action === 'add') {
        if (!tag || !tag.trim()) {
          console.error('Error: Tag name is required for add action');
          process.exit(1);
        }
        const newTag = tag.trim();
        if (currentTags.includes(newTag)) {
          console.log(`Tag "${newTag}" already exists for "${project.name}"`);
        } else {
          db.updateProject(project.id, { tags: [...currentTags, newTag] });
          console.log(`✓ Added tag "${newTag}" to "${project.name}"`);
        }
      } else if (action === 'remove') {
        if (!tag || !tag.trim()) {
          console.error('Error: Tag name is required for remove action');
          process.exit(1);
        }
        const tagToRemove = tag.trim();
        if (!currentTags.includes(tagToRemove)) {
          console.log(`Tag "${tagToRemove}" does not exist for "${project.name}"`);
        } else {
          db.updateProject(project.id, { tags: currentTags.filter(t => t !== tagToRemove) });
          console.log(`✓ Removed tag "${tagToRemove}" from "${project.name}"`);
        }
      } else {
        console.error(`Error: Unknown action "${action}". Use: list, add, or remove`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error managing tags:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Open command - open project in editor
program
  .command('open')
  .description('Open project in editor')
  .argument('<project>', 'Project ID or name')
  .action(async (projectIdentifier: string) => {
    try {
      await ensureAPIServerRunning(true);
      
      const projects = getAllProjects();
      const project = projects.find(
        p => p.id.toString() === projectIdentifier || p.name === projectIdentifier
      );
      
      if (!project) {
        console.error(`Error: Project not found: ${projectIdentifier}`);
        process.exit(1);
      }
      
      // Load settings from core
      const corePath = path.join(__dirname, '..', '..', 'core', 'dist', 'settings');
      const localCorePath = path.join(__dirname, '..', '..', '..', 'core', 'dist', 'settings');
      let settings: any;
      
      try {
        settings = require(corePath);
      } catch {
        try {
          settings = require(localCorePath);
        } catch {
          console.error('Error: Could not load settings');
          process.exit(1);
        }
      }
      
      const editorSettings = settings.getEditorSettings();
      let command: string;
      const args: string[] = [project.path];
      
      if (editorSettings.type === 'custom' && editorSettings.customPath) {
        command = editorSettings.customPath;
      } else {
        switch (editorSettings.type) {
          case 'vscode':
            command = 'code';
            break;
          case 'cursor':
            command = 'cursor';
            break;
          case 'windsurf':
            command = 'windsurf';
            break;
          case 'zed':
            command = 'zed';
            break;
          default:
            command = 'code';
        }
      }
      
      const { spawn } = require('child_process');
      spawn(command, args, {
        detached: true,
        stdio: 'ignore',
      }).unref();
      
      console.log(`✓ Opening "${project.name}" in ${editorSettings.type || 'editor'}...`);
    } catch (error) {
      console.error('Error opening project:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Files command - open project directory
program
  .command('files')
  .description('Open project directory in file manager')
  .argument('<project>', 'Project ID or name')
  .action((projectIdentifier: string) => {
    try {
      const projects = getAllProjects();
      const project = projects.find(
        p => p.id.toString() === projectIdentifier || p.name === projectIdentifier
      );
      
      if (!project) {
        console.error(`Error: Project not found: ${projectIdentifier}`);
        process.exit(1);
      }
      
      let command: string;
      const args: string[] = [project.path];
      
      if (os.platform() === 'darwin') {
        command = 'open';
      } else if (os.platform() === 'win32') {
        command = 'explorer';
      } else {
        command = 'xdg-open';
      }
      
      const { spawn } = require('child_process');
      spawn(command, args, {
        detached: true,
        stdio: 'ignore',
      }).unref();
      
      console.log(`✓ Opening "${project.name}" directory...`);
    } catch (error) {
      console.error('Error opening directory:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// URLs command - list detected URLs for a project
program
  .command('urls')
  .description('List detected URLs for a project')
  .argument('<project>', 'Project ID or name')
  .action(async (projectIdentifier: string) => {
    try {
      await ensureAPIServerRunning(true);
      
      const projects = getAllProjects();
      const project = projects.find(
        p => p.id.toString() === projectIdentifier || p.name === projectIdentifier
      );
      
      if (!project) {
        console.error(`Error: Project not found: ${projectIdentifier}`);
        process.exit(1);
      }
      
      const urls = new Set<string>();
      
      // Get URLs from running processes
      const { getRunningProcessesClean } = await import('./script-runner');
      const runningProcesses = await getRunningProcessesClean();
      const projectProcesses = runningProcesses.filter((p: any) => p.projectPath === project.path);
      
      for (const process of projectProcesses) {
        if (process.detectedUrls && Array.isArray(process.detectedUrls)) {
          for (const url of process.detectedUrls) {
            urls.add(url);
          }
        }
      }
      
      // Get URLs from detected ports
      const db = getDatabaseManager();
      const projectPorts = db.getProjectPorts(project.id);
      for (const portInfo of projectPorts) {
        const url = `http://localhost:${portInfo.port}`;
        urls.add(url);
      }
      
      const urlArray = Array.from(urls).sort();
      
      if (urlArray.length === 0) {
        console.log(`No URLs detected for "${project.name}"`);
      } else {
        console.log(`\nDetected URLs for "${project.name}":`);
        urlArray.forEach((url, idx) => {
          console.log(`  ${idx + 1}. ${url}`);
        });
      }
    } catch (error) {
      console.error('Error listing URLs:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Remove command
program
  .command('remove')
  .description('Remove a project from the dashboard')
  .argument('<project>', 'Project ID or name to remove')
  .option('-f, --force', 'Skip confirmation')
  .action(async (projectIdentifier: string, options: { force?: boolean }) => {
    try {
      await ensureAPIServerRunning(true);
      
      const db = getDatabaseManager();
      const projects = getAllProjects();
      const project = projects.find(
        p => p.id.toString() === projectIdentifier || p.name === projectIdentifier
      );
      
      if (!project) {
        console.error(`Error: Project not found: ${projectIdentifier}`);
        process.exit(1);
      }
      
      if (!options.force) {
        const inquirer = (await import('inquirer')).default;
        const answer = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to remove "${project.name}"?`,
            default: false,
          },
        ]);
        
        if (!answer.confirm) {
          console.log('Cancelled.');
          return;
        }
      }
      
      removeProject(project.id);
      console.log(`✓ Removed project: ${project.name}`);
    } catch (error) {
      console.error('Error removing project:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Scripts command - list available scripts for a project
program
  .command('scripts')
  .description('List available scripts for a project')
  .argument('[project]', 'Project ID or name (leave empty for interactive selection)')
  .action(async (projectIdentifier?: string) => {
    try {
      await ensureAPIServerRunning(true);
      
      const projects = getAllProjects();
      
      if (projects.length === 0) {
        console.error('Error: No projects tracked yet. Use "prx add" to add a project.');
        process.exit(1);
      }
      
      let project: Project | undefined;
      
      if (projectIdentifier) {
        project = projects.find(
          (p: Project) => p.id.toString() === projectIdentifier || p.name === projectIdentifier
        );
        
        if (!project) {
          console.error(`Error: Project not found: ${projectIdentifier}`);
          process.exit(1);
        }
      } else {
        const inquirer = (await import('inquirer')).default;
        const answer = await inquirer.prompt([
          {
            type: 'list',
            name: 'project',
            message: 'Select a project:',
            choices: projects.map((p: Project) => ({
              name: `${p.id}. ${p.name} (${p.path})`,
              value: p,
            })),
          },
        ]);
        project = answer.project;
      }
      
      if (!project) {
        console.error('Error: No project selected');
        process.exit(1);
      }
      
      if (!fs.existsSync(project.path)) {
        console.error(`Error: Project path does not exist: ${project.path}`);
        process.exit(1);
      }
      
      const projectScripts = getProjectScripts(project.path);
      
      console.log(`\nAvailable scripts for "${project.name}":`);
      console.log(`Project type: ${projectScripts.type}`);
      console.log(`Path: ${project.path}\n`);
      
      if (projectScripts.scripts.size === 0) {
        console.log('No scripts found in this project.');
      } else {
        projectScripts.scripts.forEach((script) => {
          console.log(`  ${script.name}`);
          console.log(`    Command: ${script.command}`);
          console.log(`    Runner: ${script.runner}`);
          console.log('');
        });
      }
    } catch (error) {
      console.error('Error listing scripts:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// PWD command - get the path to a project directory
program
  .command('pwd')
  .description('Get the path to a project directory (use with: cd $(prx pwd <project>))')
  .argument('[project]', 'Project ID or name (leave empty for interactive selection)')
  .action(async (projectIdentifier?: string) => {
    try {
      await ensureAPIServerRunning(true);
      
      const projects = getAllProjects();
      
      if (projects.length === 0) {
        console.error('Error: No projects tracked yet. Use "prx add" to add a project.');
        process.exit(1);
      }
      
      let project: Project | undefined;
      
      if (projectIdentifier) {
        // Find project by ID or name
        project = projects.find(
          (p: Project) => p.id.toString() === projectIdentifier || p.name === projectIdentifier
        );
        
        if (!project) {
          console.error(`Error: Project not found: ${projectIdentifier}`);
          process.exit(1);
        }
      } else {
        // Interactive selection
        const inquirer = (await import('inquirer')).default;
        const answer = await inquirer.prompt([
          {
            type: 'list',
            name: 'project',
            message: 'Select a project:',
            choices: projects.map((p: Project) => ({
              name: `${p.id}. ${p.name} (${p.path})`,
              value: p,
            })),
          },
        ]);
        project = answer.project;
      }
      
      if (!project) {
        console.error('Error: No project selected');
        process.exit(1);
      }
      
      // Output only the path (for use with command substitution)
      // This allows: cd $(prx pwd <project>)
      console.log(project.path);
    } catch (error) {
      console.error('Error getting project path:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// CD command - change to project directory (outputs shell command for eval)
program
  .command('cd')
  .description('Change to a project directory')
  .argument('[project]', 'Project ID or name (leave empty for interactive selection)')
  .action(async (projectIdentifier?: string) => {
    try {
      const projects = getAllProjects();
      
      if (projects.length === 0) {
        console.error('Error: No projects tracked yet. Use "prx add" to add a project.');
        process.exit(1);
      }
      
      let project: Project | undefined;
      
      if (projectIdentifier) {
        // Find project by ID or name
        project = projects.find(
          (p: Project) => p.id.toString() === projectIdentifier || p.name === projectIdentifier
        );
        
        if (!project) {
          console.error(`Error: Project not found: ${projectIdentifier}`);
          process.exit(1);
        }
      } else {
        // Interactive selection
        const inquirer = (await import('inquirer')).default;
        const answer = await inquirer.prompt([
          {
            type: 'list',
            name: 'project',
            message: 'Select a project:',
            choices: projects.map((p: Project) => ({
              name: `${p.id}. ${p.name} (${p.path})`,
              value: p,
            })),
          },
        ]);
        project = answer.project;
      }
      
      if (!project) {
        console.error('Error: No project selected');
        process.exit(1);
      }
      
      // Output a shell command that changes directory
      // To use: eval "$(prx cd <project>)"
      const escapedPath = project.path.replace(/'/g, "'\\''");
      console.log(`cd '${escapedPath}' && echo "Changed to: ${project.name}"`);
    } catch (error) {
      console.error('Error changing to project directory:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Run script command
program
  .command('run <project> <script>')
  .description('Run a script from a project')
  .option('-b, --background', 'Run script in background')
  .option('-f, --force', 'Force run (kill conflicting processes on ports)')
  .action(async (projectIdentifier: string, scriptName: string, options: { background?: boolean; force?: boolean }) => {
    try {
      const projects = getAllProjects();
      
      // Find project by ID or name
      let project: Project | undefined;
      const numericId = parseInt(projectIdentifier, 10);
      if (!isNaN(numericId)) {
        project = projects.find((p: Project) => p.id === numericId);
      }
      if (!project) {
        project = projects.find((p: Project) => p.name === projectIdentifier);
      }
      
      if (!project) {
        console.error(`Error: Project not found: ${projectIdentifier}`);
        process.exit(1);
      }
      
      const projectScripts = getProjectScripts(project.path);
      if (!projectScripts.scripts.has(scriptName)) {
        console.error(`Error: Script "${scriptName}" not found in project "${project.name}"`);
        console.error(`\nAvailable scripts:`);
        projectScripts.scripts.forEach((script) => {
          console.error(`  ${script.name}`);
        });
        process.exit(1);
      }
      
      if (options.background) {
        await runScriptInBackground(project.path, project.name, scriptName, [], options.force || false);
      } else {
        await runScript(project.path, scriptName, [], options.force || false);
      }
    } catch (error) {
      console.error('Error running script:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// List running processes command
program
  .command('ps')
  .description('List running background processes')
  .action(async () => {
    try {
      const { getRunningProcessesClean } = await import('./script-runner');
      const processes = await getRunningProcessesClean();
      
      if (processes.length === 0) {
        console.log('No running background processes.');
        return;
      }
      
      console.log(`\nRunning processes (${processes.length}):\n`);
      for (const proc of processes) {
        const uptime = Math.floor((Date.now() - proc.startedAt) / 1000);
        const minutes = Math.floor(uptime / 60);
        const seconds = uptime % 60;
        const uptimeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
        
        console.log(`  PID ${proc.pid}: ${proc.projectName} (${proc.scriptName}) - ${uptimeStr}`);
        console.log(`  Command: ${proc.command}`);
        console.log(`  Logs: ${proc.logFile}`);
        if (proc.detectedUrls && proc.detectedUrls.length > 0) {
          console.log(`  URLs: ${proc.detectedUrls.join(', ')}`);
        }
        console.log('');
      }
    } catch (error) {
      console.error('Error listing processes:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Stop process command
program
  .command('stop <pid>')
  .description('Stop a running background process')
  .action(async (pidStr: string) => {
    try {
      const pid = parseInt(pidStr, 10);
      if (isNaN(pid)) {
        console.error('Error: Invalid PID');
        process.exit(1);
      }
      
      const { stopScript } = await import('./script-runner');
      const success = await stopScript(pid);
      
      if (success) {
        console.log(`✓ Stopped process ${pid}`);
      } else {
        console.error(`Failed to stop process ${pid}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error stopping process:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Start UI command
program
  .command('web')
  .alias('ui')
  .description('Start the UI web interface')
  .option('--dev', 'Start in development mode (with hot reload)')
  .option('--add-application-alias', 'Create application launcher in Applications folder')
  .action(async (options) => {
    // Handle add-application-alias option
    if (options.addApplicationAlias) {
      await handleAddApplicationAlias();
      return;
    }
    try {
      // Clear Electron cache to prevent stale module issues
      if (os.platform() === 'darwin') {
        const cacheDirs = [
          path.join(os.homedir(), 'Library', 'Application Support', 'Electron', 'Cache'),
          path.join(os.homedir(), 'Library', 'Application Support', 'Electron', 'Code Cache'),
          path.join(os.homedir(), 'Library', 'Application Support', 'Electron', 'GPUCache'),
          path.join(os.homedir(), 'Library', 'Caches', 'Electron'),
        ];
        for (const dir of cacheDirs) {
          try {
            if (fs.existsSync(dir)) {
              fs.rmSync(dir, { recursive: true, force: true });
            }
          } catch (error) {
            // Ignore cache clear errors
          }
        }
      }
      
      // Ensure API server is running before starting UI app
      await ensureAPIServerRunning(false);
      
      // Check for bundled UI app first (in dist/desktop when installed globally)
      // Then check for local development (packages/cli/dist -> packages/desktop)
      // Support both legacy "desktop" folder and current "electron" bundle folder
      const bundledDesktopPathCandidates = [
        path.join(__dirname, 'desktop'),
        path.join(__dirname, 'electron'),
      ];
      
      let bundledDesktopPath: string | null = null;
      let bundledDesktopMain: string | null = null;
      for (const candidate of bundledDesktopPathCandidates) {
        const mainCandidate = path.join(candidate, 'main.js');
        if (fs.existsSync(mainCandidate)) {
          bundledDesktopPath = candidate;
          bundledDesktopMain = mainCandidate;
          break;
        }
      }
      
      const localDesktopPath = path.join(__dirname, '..', '..', 'desktop');
      const localDesktopMain = path.join(localDesktopPath, 'dist', 'main.js');
      
      // Check if bundled UI app exists (global install)
      const hasBundledDesktop = Boolean(bundledDesktopPath && bundledDesktopMain);
      // Check if local UI app exists (development mode)
      const isLocalDev = fs.existsSync(localDesktopPath) && fs.existsSync(path.join(localDesktopPath, 'package.json'));
      
      let desktopPackagePath: string;
      let desktopMainPath: string;
      
      if (bundledDesktopPath && bundledDesktopMain) {
        // Bundled UI app (global install)
        desktopPackagePath = bundledDesktopPath;
        desktopMainPath = bundledDesktopMain;
      } else if (isLocalDev) {
        // Local development - use relative path
        desktopPackagePath = localDesktopPath;
        desktopMainPath = localDesktopMain;
      } else {
        console.error('Error: UI app not found.');
        console.error('\nThe UI web interface is not available.');
        console.error('This may be a packaging issue. Please report this error.');
        process.exit(1);
      }
      
      if (options.dev) {
        // Development mode - start Vite dev server and UI app
        if (!isLocalDev) {
          console.error('Error: Development mode is only available in local development.');
          console.error('The UI app must be built for production use.');
          process.exit(1);
        }
        
        console.log('Starting UI app in development mode...');
        console.log('Starting Vite dev server on port 7898...');
        
        const { spawn } = require('child_process');
        const electron = require('electron');
        
        // Start Vite dev server in background
        const viteProcess = spawn('npm', ['run', 'dev:renderer'], {
          cwd: desktopPackagePath,
          stdio: 'pipe',
          detached: false,
        });
        
        viteProcess.stdout.on('data', (data: Buffer) => {
          const output = data.toString();
          process.stdout.write(output);
          // Wait for Vite to be ready
          if (output.includes('Local:') || output.includes('ready')) {
            setTimeout(() => {
              console.log('\nStarting UI window...');
              spawn(electron, [desktopMainPath], {
                stdio: 'inherit',
                detached: true,
                env: { ...process.env, NODE_ENV: 'development' },
              }).unref();
            }, 2000);
          }
        });
        
        viteProcess.stderr.on('data', (data: Buffer) => {
          process.stderr.write(data);
        });
        
        // Keep the process alive
        process.on('SIGINT', () => {
          viteProcess.kill();
          process.exit(0);
        });
        
        return;
      }
      
      // Production mode - check if built
      if (!fs.existsSync(desktopMainPath)) {
        if (!isLocalDev) {
          console.error('Error: UI app is not built.');
          console.error('The @projax/desktop package needs to be built.');
          console.error('Please contact the package maintainer or build it locally.');
          process.exit(1);
        }
        
        console.log('UI app not built.');
        console.log('Building UI app...');
        const { execSync } = require('child_process');
        try {
          // When in local dev, desktopPackagePath points to packages/desktop
          // So go up two levels to get to project root
          const projectRoot = path.join(desktopPackagePath, '..', '..');
          execSync('npm run build:desktop', { 
            cwd: projectRoot,
            stdio: 'inherit' 
          });
        } catch (error) {
          console.error('\nBuild failed. Try running in dev mode: prx web --dev');
          console.error('Or manually build: npm run build:desktop');
          process.exit(1);
        }
      }
      
      // Check if renderer is built
      let rendererIndex: string;
      if (hasBundledDesktop) {
        // Bundled: renderer is in dist/desktop/renderer
        rendererIndex = path.join(desktopPackagePath, 'renderer', 'index.html');
      } else {
        // Local dev: renderer is in dist/renderer
        rendererIndex = path.join(desktopPackagePath, 'dist', 'renderer', 'index.html');
      }
      
      if (!fs.existsSync(rendererIndex)) {
        if (hasBundledDesktop) {
          console.error('Error: Renderer files not found in bundled UI app.');
          console.error('This is a packaging issue. Please report this error.');
          process.exit(1);
        } else {
        console.log('Renderer not built. Starting in dev mode...');
        process.env.NODE_ENV = 'development';
        }
      } else {
        // Ensure NODE_ENV is not set to development when using bundled files
        process.env.NODE_ENV = 'production';
      }
      
      console.log('Starting UI app...');
      const { spawn } = require('child_process');
      const electron = require('electron');
      
      spawn(electron, [desktopMainPath], {
        stdio: 'inherit',
        detached: true,
        env: { ...process.env },
      }).unref();
    } catch (error) {
      console.error('Error starting UI app:', error instanceof Error ? error.message : error);
      console.log('\nTroubleshooting:');
      console.log('1. Try dev mode: prx web --dev');
      console.log('2. Or build manually: npm run build:desktop');
      console.log('3. Or run dev server: cd packages/desktop && npm run dev');
      process.exit(1);
    }
  });

// Start Documentation Site command
program
  .command('docs')
  .description('Start the documentation site')
  .option('--dev', 'Start in development mode (with hot reload)')
  .option('--build', 'Build the documentation site')
  .action(async (options) => {
    try {
      // Check for local docsite (development mode)
      const localDocsitePath = path.join(__dirname, '..', '..', 'docsite');
      const isLocalDev = fs.existsSync(localDocsitePath) && fs.existsSync(path.join(localDocsitePath, 'package.json'));
      
      if (!isLocalDev) {
        console.error('Error: Documentation site not found.');
        console.error('\nThe documentation site is only available in local development.');
        console.error('Please run this command from the projax repository root.');
        process.exit(1);
      }
      
      if (options.build) {
        // Build the documentation site
        console.log('Building documentation site...');
        const { execSync } = require('child_process');
        try {
          execSync('npm run build', {
            cwd: localDocsitePath,
            stdio: 'inherit'
          });
          console.log('\n✓ Documentation site built successfully!');
          console.log('Run "npm run serve" in packages/docsite to serve the built site.');
        } catch (error) {
          console.error('\nBuild failed.');
          process.exit(1);
        }
        return;
      }
      
      if (options.dev) {
        // Development mode - start Docusaurus dev server
        console.log('Starting documentation site in development mode...');
        const { spawn } = require('child_process');
        
        const docusaurusProcess = spawn('npm', ['start'], {
          cwd: localDocsitePath,
          stdio: 'inherit',
          shell: true,
        });
        
        // Handle process termination
        process.on('SIGINT', () => {
          docusaurusProcess.kill();
          process.exit(0);
        });
        
        process.on('SIGTERM', () => {
          docusaurusProcess.kill();
          process.exit(0);
        });
        
        return;
      }
      
      // Production mode - check if built, then serve
      const buildPath = path.join(localDocsitePath, 'build');
      if (!fs.existsSync(buildPath)) {
        console.log('Documentation site not built.');
        console.log('Building documentation site...');
        const { execSync } = require('child_process');
        try {
          execSync('npm run build', {
            cwd: localDocsitePath,
            stdio: 'inherit'
          });
        } catch (error) {
          console.error('\nBuild failed. Try running in dev mode: prx docs --dev');
          console.error('Or manually build: cd packages/docsite && npm run build');
          process.exit(1);
        }
      }
      
      console.log('Starting documentation site server...');
      const { spawn } = require('child_process');
      
      const serveProcess = spawn('npm', ['run', 'serve'], {
        cwd: localDocsitePath,
        stdio: 'inherit',
        shell: true,
      });
      
      // Handle process termination
      process.on('SIGINT', () => {
        serveProcess.kill();
        process.exit(0);
      });
      
      process.on('SIGTERM', () => {
        serveProcess.kill();
        process.exit(0);
      });
    } catch (error) {
      console.error('Error starting documentation site:', error instanceof Error ? error.message : error);
      console.log('\nTroubleshooting:');
      console.log('1. Try dev mode: prx docs --dev');
      console.log('2. Or build manually: npm run build:docsite');
      console.log('3. Or run dev server: cd packages/docsite && npm start');
      process.exit(1);
    }
  });

// VS Code Extension command - show extension info and location
program
  .command('vscode-extension')
  .alias('extension')
  .alias('ext')
  .description('Show VS Code extension information and installation instructions')
  .action(async () => {
    try {
      console.log('\n📦 PROJAX for Editors Extension\n');
      console.log('This extension brings PROJAX to VS Code, Cursor, and Windsurf editors.\n');
      
      // Find the .vsix file
      const releaseDir = path.join(__dirname, '..', '..', '..', 'release');
      const vsixFiles = fs.existsSync(releaseDir) 
        ? fs.readdirSync(releaseDir).filter(f => f.endsWith('.vsix'))
        : [];
      
      if (vsixFiles.length === 0) {
        console.log('⚠️  No .vsix file found. Build the extension first:');
        console.log('   npm run package --workspace=packages/vscode-extension\n');
      } else {
        const vsixPath = path.join(releaseDir, vsixFiles[0]);
        console.log(`✅ Extension: ${vsixFiles[0]}`);
        console.log(`📁 Location: ${vsixPath}\n`);
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🚀 QUICK INSTALL (Easiest Method)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log(`   code --install-extension "${vsixPath}"`);
        console.log(`   cursor --install-extension "${vsixPath}"`);
        console.log(`   windsurf --install-extension "${vsixPath}"\n`);
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📖 Manual Installation');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('1. Open VS Code, Cursor, or Windsurf');
        console.log('2. Go to Extensions (Cmd+Shift+X / Ctrl+Shift+X)');
        console.log('3. Click the "..." menu → "Install from VSIX..."');
        console.log(`4. Select: ${vsixPath}\n`);
        
        // Open in Finder/Explorer
        const platform = process.platform;
        if (platform === 'darwin') {
          console.log('💡 Open release folder in Finder:');
          console.log(`   open "${releaseDir}"\n`);
        } else if (platform === 'win32') {
          console.log('💡 Open release folder in Explorer:');
          console.log(`   explorer "${releaseDir}"\n`);
        } else {
          console.log('💡 Open release folder:');
          console.log(`   xdg-open "${releaseDir}"\n`);
        }
      }
      
      console.log('📚 Documentation:');
      console.log('   https://projax.dev/docs/editors\n');
      
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// API command - show API info and manage API server
program
  .command('api')
  .description('Show API server information and status')
  .option('-s, --start', 'Start the API server')
  .option('-k, --kill', 'Stop the API server')
  .action(async (options) => {
    try {
      const apiStatus = await checkAPIStatus();
      
      if (options.start) {
        const started = await startAPIServer(false);
        if (!started) {
          process.exit(1);
        }
        return;
      }
      
      if (options.kill) {
        console.log('Stopping API server...');
        // This would require process management - for now just inform user
        console.log('Note: API server process management not yet implemented.');
        console.log('Please stop the API server manually if needed.');
        return;
      }
      
      // Show status
      console.log('\nAPI Server Status:');
      console.log(`  Running: ${apiStatus.running ? 'Yes' : 'No'}`);
      if (apiStatus.port) {
        console.log(`  Port: ${apiStatus.port}`);
        console.log(`  URL: http://localhost:${apiStatus.port}`);
        console.log(`  Health: http://localhost:${apiStatus.port}/health`);
        console.log(`  API Base: http://localhost:${apiStatus.port}/api`);
      } else {
        console.log('  Port: Not detected');
      }
      console.log('');
    } catch (error) {
      console.error('Error checking API status:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Scan-ports command
program
  .command('scan-ports')
  .description('Scan projects for port information')
  .argument('[project]', 'Project ID or name to scan (leave empty to scan all)')
  .action(async (projectIdentifier?: string) => {
    try {
      await ensureAPIServerRunning(true);
      
      const { scanProjectPorts, scanAllProjectPorts } = await import('./port-scanner');
      const db = getDatabaseManager();
      
      if (projectIdentifier) {
        const projects = getAllProjects();
        const project = projects.find(
          (p: Project) => p.id.toString() === projectIdentifier || p.name === projectIdentifier
        );
        
        if (!project) {
          console.error(`Error: Project not found: ${projectIdentifier}`);
          process.exit(1);
        }
        
        console.log(`Scanning ports for project: ${project.name}...`);
        await scanProjectPorts(project.id);
        const ports = db.getProjectPorts(project.id);
        if (ports.length > 0) {
          console.log(`✓ Found ${ports.length} port(s)`);
          ports.forEach(port => {
            const scriptLabel = port.script_name ? ` (${port.script_name})` : '';
            console.log(`  Port ${port.port}${scriptLabel} - ${port.config_source}`);
          });
        } else {
          console.log('  No ports detected');
        }
      } else {
        console.log('Scanning ports for all projects...\n');
        await scanAllProjectPorts();
        const projects = getAllProjects();
        for (const project of projects) {
          const ports = db.getProjectPorts(project.id);
          if (ports.length > 0) {
            const portList = ports.map(p => p.port).sort((a, b) => a - b).join(', ');
            console.log(`${project.name}: ${portList}`);
          }
        }
        console.log('\n✓ Port scanning completed');
      }
    } catch (error) {
      console.error('Error scanning ports:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Handle script execution before parsing
// Check if first argument is not a known command
(async () => {
  const args = process.argv.slice(2);
  const knownCommands = ['prxi', 'i', 'add', 'list', 'scan', 'remove', 'rn', 'rename', 'cd', 'pwd', 'run', 'ps', 'stop', 'web', 'desktop', 'ui', 'scripts', 'scan-ports', 'api', 'docs', 'vscode-extension', 'extension', 'ext', 'desc', 'description', 'tags', 'open', 'files', 'urls', '--help', '-h', '--version', '-V'];

  // If we have at least 1 argument and first is not a known command, treat as project identifier
  if (args.length >= 1 && !knownCommands.includes(args[0])) {
    const projectIdentifier = args[0];
    
    // Check if it's actually a project (not a flag)
    if (!projectIdentifier.startsWith('-')) {
      try {
        const projects = getAllProjects();
        
        // Try to find project by ID (if identifier is numeric) or by name
        let project: Project | undefined;
        const numericId = parseInt(projectIdentifier, 10);
        if (!isNaN(numericId)) {
          // Try to find by numeric ID first
          project = projects.find((p: Project) => p.id === numericId);
        }
        
        // If not found by ID, try by name
        if (!project) {
          project = projects.find((p: Project) => p.name === projectIdentifier);
        }

        if (project) {
          // Found a project
          if (!fs.existsSync(project.path)) {
            console.error(`Error: Project path does not exist: ${project.path}`);
            process.exit(1);
          }

          const projectScripts = getProjectScripts(project.path);

          if (projectScripts.scripts.size === 0) {
            console.error(`Error: No scripts found in project "${project.name}"`);
            console.error(`Project type: ${projectScripts.type}`);
            console.error(`Path: ${project.path}`);
            process.exit(1);
          }

          // Check for background mode flags (-M, --background, -b, --daemon)
          const backgroundFlags = ['-M', '--background', '-b', '--daemon'];
          const isBackgroundMode = args.some(arg => backgroundFlags.includes(arg));
          
          // Check for force flags (--force, -F)
          const forceFlags = ['--force', '-F'];
          const isForceMode = args.some(arg => forceFlags.includes(arg));
          
          // Filter out background and force flags from args
          const filteredArgs = args.filter(arg => !backgroundFlags.includes(arg) && !forceFlags.includes(arg));

          // If script name is provided (filteredArgs.length >= 2), run that script
          if (filteredArgs.length >= 2) {
            const scriptName = filteredArgs[1];
            const scriptArgs = filteredArgs.slice(2);
            
            // Check if script exists
            if (!projectScripts.scripts.has(scriptName)) {
              console.error(`Error: Script "${scriptName}" not found in project "${project.name}"`);
              console.error(`\nAvailable scripts:`);
              projectScripts.scripts.forEach((script) => {
                console.error(`  ${script.name}`);
              });
              process.exit(1);
            }

            // Run the script (in background or foreground)
            try {
              if (isBackgroundMode) {
                await runScriptInBackground(project.path, project.name, scriptName, scriptArgs, isForceMode);
              } else {
                await runScript(project.path, scriptName, scriptArgs, isForceMode);
              }
              process.exit(0);
            } catch (error) {
              console.error('Error running script:', error instanceof Error ? error.message : error);
              process.exit(1);
            }
          } else {
            // No script name provided - intelligent script selection
            const hasStart = projectScripts.scripts.has('start');
            const hasDev = projectScripts.scripts.has('dev');
            let selectedScript: string | undefined;

            // Rule 1: If "start" exists but "dev" doesn't, run "start"
            if (hasStart && !hasDev) {
              selectedScript = 'start';
            }
            // Rule 2: If "dev" exists but "start" doesn't, run "dev"
            else if (hasDev && !hasStart) {
              selectedScript = 'dev';
            }
            // Rule 3: If neither case applies, show interactive selection
            else {
              const inquirer = (await import('inquirer')).default;
              const scriptChoices = Array.from(projectScripts.scripts.values()).map((script) => ({
                name: `${script.name} - ${script.command}`,
                value: script.name,
              }));

              const answer = await inquirer.prompt([
                {
                  type: 'list',
                  name: 'script',
                  message: `Select a script to run for "${project.name}":`,
                  choices: scriptChoices,
                },
              ]);
              selectedScript = answer.script;
            }

            if (selectedScript) {
              try {
                if (isBackgroundMode) {
                  await runScriptInBackground(project.path, project.name, selectedScript, [], isForceMode);
                } else {
                  await runScript(project.path, selectedScript, [], isForceMode);
                }
                process.exit(0);
              } catch (error) {
                console.error('Error running script:', error instanceof Error ? error.message : error);
                process.exit(1);
              }
            } else {
              console.error('Error: No script selected');
              process.exit(1);
            }
          }
        } else {
          // Project not found - show helpful error
          console.error(`Error: Project not found: ${projectIdentifier}`);
          console.error(`\nAvailable projects:`);
          projects.forEach((p: Project) => {
            console.error(`  ${p.id}. ${p.name}`);
          });
          process.exit(1);
        }
      } catch (error) {
        // If there's an error, fall through to normal command parsing
      }
    }
  }

  // If we get here, proceed with normal command parsing
  // Don't show logo twice - it's already in addHelpText
  program.parse();
})();


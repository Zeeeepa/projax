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


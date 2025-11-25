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


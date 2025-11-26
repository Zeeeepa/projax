/* PROJAX-PATCH:cross-env:v1.0.0 */

import { DockerExecutor } from '../executors/DockerExecutor';
import { execSync } from 'child_process';

jest.mock('child_process');
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('DockerExecutor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('should return true when Docker is installed', () => {
      mockExecSync.mockReturnValue('' as any);
      
      expect(DockerExecutor.isAvailable()).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith('docker --version', { stdio: 'ignore', timeout: 5000 });
    });

    it('should return false when Docker command fails', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });
      
      expect(DockerExecutor.isAvailable()).toBe(false);
    });
  });

  describe('isRunning', () => {
    it('should return true when Docker daemon is running', () => {
      mockExecSync.mockReturnValue('' as any);
      
      expect(DockerExecutor.isRunning()).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith('docker ps', { stdio: 'ignore', timeout: 10000 });
    });

    it('should return false when Docker daemon is not running', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Cannot connect to Docker daemon');
      });
      
      expect(DockerExecutor.isRunning()).toBe(false);
    });
  });

  describe('listContainers', () => {
    it('should return list of running containers with status', () => {
      mockExecSync.mockReturnValue(
        'abc123\tmy-app\tnginx:latest\tUp 2 hours\trunning\ndef456\tmy-db\tpostgres:14\tUp 1 day\trunning\n' as any
      );
      
      const containers = DockerExecutor.listContainers();
      
      expect(containers).toEqual([
        { id: 'abc123', name: 'my-app', image: 'nginx:latest', status: 'Up 2 hours', state: 'running' },
        { id: 'def456', name: 'my-db', image: 'postgres:14', status: 'Up 1 day', state: 'running' }
      ]);
      expect(mockExecSync).toHaveBeenCalledWith(
        'docker ps  --format "{{.ID}}\\t{{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.State}}"',
        { encoding: 'utf-8', timeout: 10000 }
      );
    });

    it('should handle empty container list', () => {
      mockExecSync.mockReturnValue('' as any);
      
      const containers = DockerExecutor.listContainers();
      
      expect(containers).toEqual([]);
    });

    it('should filter out empty lines', () => {
      mockExecSync.mockReturnValue(
        'abc123\tmy-app\tnginx:latest\tUp 1 hour\trunning\n\n\n' as any
      );
      
      const containers = DockerExecutor.listContainers();
      
      expect(containers).toEqual([
        { id: 'abc123', name: 'my-app', image: 'nginx:latest', status: 'Up 1 hour', state: 'running' }
      ]);
    });

    it('should return empty array on error', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command failed');
      });
      
      const containers = DockerExecutor.listContainers();
      
      expect(containers).toEqual([]);
    });
  });

  describe('validate', () => {
    it('should fail validation when Docker is not installed', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });
      
      const executor = new DockerExecutor({ containerName: 'my-app' });
      const result = executor.validate();
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Docker is not installed');
    });

    it('should fail validation when Docker daemon is not running', () => {
      mockExecSync
        .mockReturnValueOnce('' as any) // isAvailable
        .mockImplementationOnce(() => { // isRunning
          throw new Error('Cannot connect');
        });
      
      const executor = new DockerExecutor({ containerName: 'my-app' });
      const result = executor.validate();
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Docker daemon is not running');
    });

    it('should fail validation when container is not found', () => {
      mockExecSync
        .mockReturnValueOnce('' as any) // isAvailable
        .mockReturnValueOnce('' as any) // isRunning
        .mockReturnValueOnce('abc123\tother-app\tnginx:latest\tUp 1 hour\trunning\n' as any); // listContainers
      
      const executor = new DockerExecutor({ containerName: 'my-app' });
      const result = executor.validate();
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('my-app');
      expect(result.message).toContain('not found');
    });

    it('should pass validation when container is found by name and running', () => {
      mockExecSync
        .mockReturnValueOnce('' as any) // isAvailable
        .mockReturnValueOnce('' as any) // isRunning
        .mockReturnValueOnce('abc123\tmy-app\tnginx:latest\tUp 1 hour\trunning\n' as any); // listContainers
      
      const executor = new DockerExecutor({ containerName: 'my-app' });
      const result = executor.validate();
      
      expect(result.valid).toBe(true);
    });

    it('should pass validation when container is found by ID prefix and running', () => {
      mockExecSync
        .mockReturnValueOnce('' as any) // isAvailable
        .mockReturnValueOnce('' as any) // isRunning
        .mockReturnValueOnce('abc123def456\tmy-app\tnginx:latest\tUp 1 hour\trunning\n' as any); // listContainers
      
      const executor = new DockerExecutor({ containerId: 'abc123' });
      const result = executor.validate();
      
      expect(result.valid).toBe(true);
    });

    it('should fail validation when no container identifier provided', () => {
      mockExecSync
        .mockReturnValueOnce('' as any) // isAvailable
        .mockReturnValueOnce('' as any) // isRunning
        .mockReturnValueOnce('abc123\tmy-app\tnginx:latest\tUp 1 hour\trunning\n' as any); // listContainers
      
      const executor = new DockerExecutor({});
      const result = executor.validate();
      
      expect(result.valid).toBe(false);
    });
  });

  describe('Constructor', () => {
    it('should create executor with containerName', () => {
      const executor = new DockerExecutor({ containerName: 'my-app' });
      
      expect(executor).toBeInstanceOf(DockerExecutor);
    });

    it('should create executor with containerId', () => {
      const executor = new DockerExecutor({ containerId: 'abc123' });
      
      expect(executor).toBeInstanceOf(DockerExecutor);
    });

    it('should create executor with workDir', () => {
      const executor = new DockerExecutor({ 
        containerName: 'my-app',
        workDir: '/workspace'
      });
      
      expect(executor).toBeInstanceOf(DockerExecutor);
    });

    it('should create executor with minimal config', () => {
      const executor = new DockerExecutor({});
      
      expect(executor).toBeInstanceOf(DockerExecutor);
    });
  });


});

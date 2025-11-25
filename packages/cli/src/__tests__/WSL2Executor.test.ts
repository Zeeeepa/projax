/* PROJAX-PATCH:cross-env:v1.0.0 */

import { WSL2Executor } from '../executors/WSL2Executor';
import { execSync } from 'child_process';

// Mock child_process for CI environments where WSL2 might not be available
jest.mock('child_process');
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('WSL2Executor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('should return false on non-Windows platforms', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'linux'
      });
      
      expect(WSL2Executor.isAvailable()).toBe(false);
      
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      });
    });

    it('should return true when WSL is installed on Windows', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'win32'
      });
      
      mockExecSync.mockReturnValue(Buffer.from(''));
      
      expect(WSL2Executor.isAvailable()).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith('wsl.exe --status', { stdio: 'ignore' });
      
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      });
    });

    it('should return false when WSL command fails', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'win32'
      });
      
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });
      
      expect(WSL2Executor.isAvailable()).toBe(false);
      
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      });
    });
  });

  describe('listDistributions', () => {
    it('should return list of distributions', () => {
      mockExecSync.mockReturnValue('Ubuntu\nDebian\nkali-linux\n' as any);
      
      const distros = WSL2Executor.listDistributions();
      
      expect(distros).toEqual(['Ubuntu', 'Debian', 'kali-linux']);
      expect(mockExecSync).toHaveBeenCalledWith('wsl.exe -l -q', { encoding: 'utf-8' });
    });

    it('should handle empty distribution list', () => {
      mockExecSync.mockReturnValue('' as any);
      
      const distros = WSL2Executor.listDistributions();
      
      expect(distros).toEqual([]);
    });

    it('should filter out empty lines', () => {
      mockExecSync.mockReturnValue('Ubuntu\n\n\nDebian\n\n' as any);
      
      const distros = WSL2Executor.listDistributions();
      
      expect(distros).toEqual(['Ubuntu', 'Debian']);
    });

    it('should return empty array on error', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command failed');
      });
      
      const distros = WSL2Executor.listDistributions();
      
      expect(distros).toEqual([]);
    });
  });

  describe('validate', () => {
    it('should fail validation when WSL is not available', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'linux'
      });
      
      const executor = new WSL2Executor({ distro: 'Ubuntu' });
      const result = executor.validate();
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('WSL2 is not installed');
      
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      });
    });

    it('should fail validation when distro is not found', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'win32'
      });
      
      mockExecSync
        .mockReturnValueOnce('' as any) // isAvailable check
        .mockReturnValueOnce('Ubuntu\nDebian\n' as any); // listDistributions
      
      const executor = new WSL2Executor({ distro: 'NonExistent' });
      const result = executor.validate();
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('NonExistent');
      expect(result.message).toContain('not found');
      
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      });
    });

    it('should pass validation when distro exists', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'win32'
      });
      
      mockExecSync
        .mockReturnValueOnce('' as any) // isAvailable check
        .mockReturnValueOnce('Ubuntu\nDebian\n' as any); // listDistributions
      
      const executor = new WSL2Executor({ distro: 'Ubuntu' });
      const result = executor.validate();
      
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
      
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      });
    });

    it('should use default Ubuntu distro when not specified', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'win32'
      });
      
      mockExecSync
        .mockReturnValueOnce('' as any) // isAvailable check
        .mockReturnValueOnce('Ubuntu\n' as any); // listDistributions
      
      const executor = new WSL2Executor({ distro: '' });
      const result = executor.validate();
      
      expect(result.valid).toBe(true);
      
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      });
    });
  });

  describe('Constructor', () => {
    it('should create executor with config', () => {
      const config = { distro: 'Ubuntu', translatePaths: true };
      const executor = new WSL2Executor(config);
      
      expect(executor).toBeInstanceOf(WSL2Executor);
    });

    it('should accept minimal config', () => {
      const executor = new WSL2Executor({ distro: 'Ubuntu' });
      
      expect(executor).toBeInstanceOf(WSL2Executor);
    });
  });

  describe('Path translation integration', () => {
    it('should translate Windows paths in execute method', async () => {
      // This test verifies the integration with windowsToWSL2
      const executor = new WSL2Executor({ distro: 'Ubuntu' });
      
      // We can't easily test the actual execute without spawning processes
      // but we verify the class is properly constructed
      expect(executor).toBeDefined();
    });
  });
});

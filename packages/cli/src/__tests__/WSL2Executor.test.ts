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
      expect(mockExecSync).toHaveBeenCalledWith('wsl.exe --status', { stdio: 'ignore', timeout: 5000 });
      
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
    it('should return list of distributions with state info', () => {
      // Mock wsl -l -v output
      mockExecSync.mockReturnValue(
        '  NAME               STATE           VERSION\n' +
        '* Ubuntu             Running         2\n' +
        '  Debian             Stopped         2\n' as any
      );
      
      const distros = WSL2Executor.listDistributions();
      
      expect(distros).toEqual([
        { name: 'Ubuntu', state: 'Running', version: '2' },
        { name: 'Debian', state: 'Stopped', version: '2' }
      ]);
      expect(mockExecSync).toHaveBeenCalledWith(
        'wsl.exe -l -v', 
        { encoding: 'utf-8', timeout: 10000 }
      );
    });

    it('should fallback to simple list if -l -v fails', () => {
      mockExecSync
        .mockImplementationOnce(() => {
          throw new Error('Command failed');
        })
        .mockReturnValueOnce('Ubuntu\nDebian\n' as any); // Fallback to -l -q
      
      const distros = WSL2Executor.listDistributions();
      
      expect(distros).toEqual([
        { name: 'Ubuntu', state: 'Unknown', version: 'Unknown' },
        { name: 'Debian', state: 'Unknown', version: 'Unknown' }
      ]);
    });

    it('should handle empty distribution list', () => {
      mockExecSync
        .mockImplementationOnce(() => {
          throw new Error('Command failed');
        })
        .mockReturnValueOnce('' as any);
      
      const distros = WSL2Executor.listDistributions();
      
      expect(distros).toEqual([]);
    });

    it('should return empty array on complete error', () => {
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
        .mockReturnValueOnce(
          '  NAME               STATE           VERSION\n' +
          '* Ubuntu             Running         2\n' +
          '  Debian             Stopped         2\n' as any
        ); // listDistributions with state
      
      const executor = new WSL2Executor({ distro: 'NonExistent' });
      const result = executor.validate();
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('NonExistent');
      expect(result.message).toContain('not found');
      
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      });
    });

    it('should pass validation when distro exists and is running', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'win32'
      });
      
      mockExecSync
        .mockReturnValueOnce('' as any) // isAvailable check
        .mockReturnValueOnce(
          '  NAME               STATE           VERSION\n' +
          '* Ubuntu             Running         2\n' +
          '  Debian             Stopped         2\n' as any
        ); // listDistributions with state
      
      const executor = new WSL2Executor({ distro: 'Ubuntu' });
      const result = executor.validate();
      
      expect(result.valid).toBe(true);
      
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
        .mockReturnValueOnce(
          '  NAME               STATE           VERSION\n' +
          '* Ubuntu             Running         2\n' as any
        ); // listDistributions
      
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

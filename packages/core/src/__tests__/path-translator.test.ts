/* PROJAX-PATCH:cross-env:v1.0.0 */

import {
  detectPathType,
  windowsToWSL2,
  wsl2ToWindows,
  normalizeDockerPath,
  translatePath,
  PathType
} from '../utils/path-translator';

describe('Path Translator', () => {
  describe('detectPathType', () => {
    it('should detect Windows paths', () => {
      expect(detectPathType('C:\\Users\\name\\project')).toBe('windows');
      expect(detectPathType('D:\\path\\to\\file')).toBe('windows');
      expect(detectPathType('c:\\lowercase')).toBe('windows');
    });

    it('should detect WSL2 UNC paths', () => {
      expect(detectPathType('\\\\wsl$\\Ubuntu\\home\\user')).toBe('wsl2');
      expect(detectPathType('//wsl$/Debian/home/user')).toBe('wsl2');
    });

    it('should detect Docker paths', () => {
      expect(detectPathType('/app/project')).toBe('docker');
      expect(detectPathType('/workspace/code')).toBe('docker');
    });

    it('should detect standard Linux paths', () => {
      expect(detectPathType('/home/user/project')).toBe('linux');
      expect(detectPathType('/usr/local/bin')).toBe('linux');
    });
  });

  describe('windowsToWSL2', () => {
    it('should convert Windows drive paths to WSL2 mount format', () => {
      expect(windowsToWSL2('C:\\Users\\name\\project')).toBe('/mnt/c/Users/name/project');
      expect(windowsToWSL2('D:\\Code\\app')).toBe('/mnt/d/Code/app');
    });

    it('should handle lowercase drive letters', () => {
      expect(windowsToWSL2('c:\\users\\name')).toBe('/mnt/c/users/name');
    });

    it('should handle WSL UNC paths by extracting real path', () => {
      expect(windowsToWSL2('\\\\wsl$\\Ubuntu\\home\\user\\project')).toBe('/home/user/project');
      expect(windowsToWSL2('//wsl$/Debian/home/user')).toBe('/home/user');
    });

    it('should return unchanged for already WSL2 paths', () => {
      expect(windowsToWSL2('/mnt/c/Users/name')).toBe('/mnt/c/Users/name');
      expect(windowsToWSL2('/home/user')).toBe('/home/user');
    });

    it('should handle paths with forward slashes', () => {
      expect(windowsToWSL2('C:/Users/name/project')).toBe('/mnt/c/Users/name/project');
    });
  });

  describe('wsl2ToWindows', () => {
    it('should convert WSL2 mount paths to Windows format', () => {
      expect(wsl2ToWindows('/mnt/c/Users/name/project')).toBe('C:\\Users\\name\\project');
      expect(wsl2ToWindows('/mnt/d/Code')).toBe('D:\\Code');
    });

    it('should handle paths without trailing parts', () => {
      expect(wsl2ToWindows('/mnt/c')).toBe('C:');
      expect(wsl2ToWindows('/mnt/d/')).toBe('D:\\');
    });

    it('should return unchanged for non-mount paths', () => {
      expect(wsl2ToWindows('/home/user/project')).toBe('/home/user/project');
      expect(wsl2ToWindows('/usr/local')).toBe('/usr/local');
    });
  });

  describe('normalizeDockerPath', () => {
    it('should return absolute paths unchanged', () => {
      expect(normalizeDockerPath('/app/project')).toBe('/app/project');
      expect(normalizeDockerPath('/home/user')).toBe('/home/user');
    });

    it('should join relative paths with mount point', () => {
      expect(normalizeDockerPath('project')).toBe('/app/project');
      expect(normalizeDockerPath('src/index.ts')).toBe('/app/src/index.ts');
    });

    it('should use custom mount point', () => {
      expect(normalizeDockerPath('project', '/workspace')).toBe('/workspace/project');
    });
  });

  describe('translatePath', () => {
    it('should return unchanged for same environment', () => {
      const path = 'C:\\Users\\name';
      expect(translatePath(path, 'windows', 'windows')).toBe(path);
    });

    it('should translate Windows to WSL2', () => {
      expect(translatePath('C:\\Users\\name', 'windows', 'wsl2')).toBe('/mnt/c/Users/name');
    });

    it('should translate WSL2 to Windows', () => {
      expect(translatePath('/mnt/c/Users/name', 'wsl2', 'windows')).toBe('C:\\Users\\name');
    });

    it('should return as-is for unsupported combinations', () => {
      expect(translatePath('/app/project', 'docker', 'linux')).toBe('/app/project');
    });
  });

  describe('Round-trip conversions', () => {
    it('should preserve Windows paths through WSL2 conversion', () => {
      const windowsPath = 'C:\\Users\\name\\project\\file.txt';
      const wslPath = windowsToWSL2(windowsPath);
      const backToWindows = wsl2ToWindows(wslPath);
      expect(backToWindows).toBe(windowsPath);
    });

    it('should preserve WSL2 mount paths through Windows conversion', () => {
      const wslPath = '/mnt/c/Users/name/project';
      const windowsPath = wsl2ToWindows(wslPath);
      const backToWSL = windowsToWSL2(windowsPath);
      expect(backToWSL).toBe(wslPath);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty paths gracefully', () => {
      expect(windowsToWSL2('')).toBe('');
      expect(wsl2ToWindows('')).toBe('');
    });

    it('should handle paths with spaces', () => {
      expect(windowsToWSL2('C:\\Program Files\\App')).toBe('/mnt/c/Program Files/App');
      expect(wsl2ToWindows('/mnt/c/Program Files/App')).toBe('C:\\Program Files\\App');
    });

    it('should handle deeply nested paths', () => {
      const deepPath = 'C:\\a\\b\\c\\d\\e\\f\\g\\h\\i\\j';
      const converted = windowsToWSL2(deepPath);
      expect(converted).toBe('/mnt/c/a/b/c/d/e/f/g/h/i/j');
    });
  });
});


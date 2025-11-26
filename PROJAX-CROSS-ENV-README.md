# 🚀 PROJAX Cross-Environment Patch

**Version:** 1.0.0  
**Compatible with:** PROJAX 3.x and above  
**Author:** AI-Generated Intelligent Patch System

---

## 📋 **Overview**

This patch system extends PROJAX with **WSL2 and Docker execution support**, allowing you to manage projects across different execution environments from a single dashboard.

### **What This Patch Does:**

- ✅ Adds WSL2 execution support (run projects inside WSL2 from Windows)
- ✅ Adds Docker execution support (run projects inside Docker containers)
- ✅ Adds path translation utilities (Windows ↔ WSL2 ↔ Docker)
- ✅ Extends Project schema with `environment` field
- ✅ Creates executor classes for each environment type
- ✅ Maintains full backward compatibility (existing projects work unchanged)

### **Key Features:**

1. **Reapplicable** - Can be run after `git reset --hard && git pull`
2. **Idempotent** - Safe to run multiple times (detects existing patches)
3. **Safe** - Creates backups before modification, validates TypeScript compilation
4. **Smart** - Uses marker comments to detect already-patched files
5. **Rollback** - Can revert all changes with one command

---

## 🎯 **Quick Start**

### **1. Download and Execute**

```bash
# In your PROJAX repository root:
curl -O https://raw.githubusercontent.com/yourorg/projax-cross-env/main/projax-cross-env-patch.sh
chmod +x projax-cross-env-patch.sh
./projax-cross-env-patch.sh apply
```

### **2. Rebuild PROJAX**

```bash
npm run build
```

### **3. Start Using Cross-Environment Features**

```bash
# Add a WSL2 project
prx add \\wsl$\Ubuntu\home\user\my-api --name "API" --env wsl2 --distro Ubuntu

# Add a Docker project
prx add ~/my-docker-app --name "Docker App" --env docker --container my-container

# Run scripts (automatically routes to correct environment)
prx 1 dev    # Runs in WSL2
prx 2 test   # Runs in Docker
```

---

## 📦 **What Gets Modified**

The patch creates new files and modifies existing ones:

### **New Files Created:**
- `packages/core/src/types/environment.ts` - Type definitions
- `packages/core/src/utils/path-translator.ts` - Path conversion utilities
- `packages/cli/src/executors/WSL2Executor.ts` - WSL2 command execution
- `packages/cli/src/executors/DockerExecutor.ts` - Docker command execution

### **Modified Files:**
- `packages/core/src/database.ts` - Adds `environment` field to Project interface
- `packages/cli/src/script-runner.ts` - Adds environment-aware execution routing
- `packages/core/src/index.ts` - Exports new types and utilities

---

## 🔄 **Reapplying After Updates**

After updating PROJAX from upstream:

```bash
# 1. Pull latest changes
git pull origin main

# 2. Reapply patch
./projax-cross-env-patch.sh apply

# 3. Rebuild
npm run build
```

The patch script will:
- ✅ Skip files that are already patched (idempotent)
- ✅ Re-patch files that were overwritten by git pull
- ✅ Create new files if they don't exist
- ✅ Validate TypeScript compilation
- ✅ Rollback if anything fails

---

## 🛠️ **Usage Examples**

### **WSL2 Projects**

```bash
# Add WSL2 project from Windows
prx add "\\wsl$\Ubuntu\home\user\backend" \
  --name "Backend API" \
  --env wsl2 \
  --distro Ubuntu

# Or with auto-detection
prx add "\\wsl$\Ubuntu\home\user\backend" \
  --name "Backend API" \
  --detect

# Run script in WSL2
prx 1 dev
# Internally executes:
# wsl.exe -d Ubuntu -e bash -c "cd /home/user/backend && npm run dev"

# View logs
prx logs 1

# Stop background process
prx stop 1
```

### **Docker Projects**

```bash
# Add Docker project with running container
prx add ~/my-docker-project \
  --name "Database Service" \
  --env docker \
  --container postgres-db \
  --workdir /app

# Or with docker-compose
prx add ~/my-app \
  --name "Full Stack App" \
  --env docker \
  --compose docker-compose.yml \
  --service web

# Run script in Docker
prx 2 test
# Internally executes:
# docker exec -i postgres-db sh -c "cd /app && npm run test"
```

### **Mixed Environment Dashboard**

```bash
# List all projects
prx list

# Output:
ID | Name          | Path                        | Env    | Ports | Tests
-----------------------------------------------------------------------------
1  | Windows App   | C:\projects\frontend        | local  | 3000  | 12
2  | WSL2 Backend  | \\wsl$\Ubuntu\home\api      | wsl2   | 8080  | 45
3  | Docker DB     | ~/postgres-docker           | docker | 5432  | 8
4  | Local CLI     | C:\tools\cli                | local  | N/A   | 15
```

---

## 🔍 **Checking Patch Status**

```bash
# Check if patch is applied
./projax-cross-env-patch.sh status

# Output:
✓ packages/core/src/types/environment.ts
✓ packages/core/src/utils/path-translator.ts
✓ packages/cli/src/executors/WSL2Executor.ts
✓ packages/cli/src/executors/DockerExecutor.ts
✓ packages/core/src/database.ts
✓ packages/cli/src/script-runner.ts

✓ Patch is fully applied (6/6 files)
```

---

## 🔙 **Reverting the Patch**

If you need to remove the patch:

```bash
./projax-cross-env-patch.sh revert
```

This will:
- Restore all modified files from backup
- Remove all created files
- Clean up backup directory

**Note:** Only works if backups exist (i.e., immediately after applying patch). For older installations, use git to revert:

```bash
git checkout packages/core/src/database.ts
git checkout packages/cli/src/script-runner.ts
git checkout packages/core/src/index.ts
rm -rf packages/core/src/types/environment.ts
rm -rf packages/core/src/utils/path-translator.ts
rm -rf packages/cli/src/executors/
```

---

## 🧪 **Testing the Patch**

After applying the patch, test each environment:

### **Test Local Execution (should work as before)**
```bash
prx add ~/test-project --name "Test Local"
prx 1 dev
```

### **Test WSL2 Execution (requires WSL2 installed)**
```bash
# Check WSL2 availability
wsl.exe --status

# Add WSL2 project
prx add "\\wsl$\Ubuntu\home\user\test" --name "Test WSL2" --env wsl2

# Run command
prx 2 dev
```

### **Test Docker Execution (requires Docker running)**
```bash
# Check Docker availability
docker ps

# Start a test container
docker run -d --name test-node -v $(pwd):/app node:18 tail -f /dev/null

# Add Docker project
prx add . --name "Test Docker" --env docker --container test-node

# Run command
prx 3 dev
```

---

## 🐛 **Troubleshooting**

### **Patch Application Fails**

```bash
✗ TypeScript compilation failed

# Solution: Check the error messages
npm run build

# Common issues:
# - Missing dependencies: npm install
# - Syntax errors: Check modified files for conflicts
# - Type errors: Ensure TypeScript version >= 5.0
```

### **WSL2 Execution Fails**

```bash
Error: WSL2 is not installed

# Solution: Install WSL2
wsl --install
```

```bash
Error: WSL distribution "Ubuntu" not found

# Solution: List available distributions
wsl -l -v

# Install Ubuntu
wsl --install -d Ubuntu
```

### **Docker Execution Fails**

```bash
Error: Docker daemon is not running

# Solution: Start Docker Desktop
```

```bash
Error: Container "my-container" is not running

# Solution: Check running containers
docker ps

# Start your container
docker start my-container
# OR
docker-compose up -d
```

### **Path Translation Issues**

```bash
Error: Path not found in WSL2

# Check path translation:
# Windows: C:\Users\name\project
# WSL2:    /mnt/c/Users/name/project
# OR:      \\wsl$\Ubuntu\home\user\project → /home/user/project
```

---

## 🔒 **Safety Features**

1. **Backup System**
   - All modified files are backed up before patching
   - Located in `.projax-patch-backup/`
   - Automatic restoration on validation failure

2. **Idempotency Markers**
   - Patch uses `/* PROJAX-PATCH:cross-env:v1.0.0 */` markers
   - Detects already-patched files to avoid duplicate changes
   - Safe to run multiple times

3. **TypeScript Validation**
   - Runs `npm run build` after patching
   - Automatically rolls back if compilation fails
   - Ensures code integrity

4. **Logging**
   - All operations logged to `.projax-patch.log`
   - Includes timestamps and detailed error messages
   - Useful for debugging

---

## 🎓 **Advanced Usage**

### **Custom Environment Configuration**

Create `~/.projax/environments.json` manually:

```json
{
  "1": {
    "type": "wsl2",
    "wsl2": {
      "distro": "Ubuntu-22.04",
      "translatePaths": true
    }
  },
  "2": {
    "type": "docker",
    "docker": {
      "containerName": "my-web-app",
      "workDir": "/workspace",
      "composePath": "./docker-compose.yml",
      "serviceName": "web"
    }
  }
}
```

### **Extending the Patch**

To add more features, edit the patch script and add new functions:

```bash
# Add your custom patch function
patch_my_custom_feature() {
    local file="packages/cli/src/my-feature.ts"
    
    if is_patched "$file"; then
        warn "Already patched: $file (skipping)"
        return 0
    fi
    
    log "Creating custom feature: $file"
    # ... your implementation
}

# Call it in apply_patch()
apply_patch() {
    # ... existing patches
    patch_my_custom_feature
}
```

---

## 📊 **Version Compatibility**

| PROJAX Version | Patch Status | Notes |
|----------------|--------------|-------|
| 3.3.38 | ✅ Tested | Fully working |
| 3.3.x | ✅ Expected | Should work with minor versions |
| 3.2.x | ⚠️ Untested | May require adjustments |
| 3.1.x | ⚠️ Untested | May require adjustments |
| < 3.0 | ❌ Incompatible | Different architecture |

---

## 🤝 **Contributing**

To improve this patch:

1. Fork the patch repository
2. Make your changes to `projax-cross-env-patch.sh`
3. Test against multiple PROJAX versions
4. Submit a pull request with description

---

## 📝 **License**

This patch is provided as-is under MIT License.

---

## 🆘 **Support**

If you encounter issues:

1. Check the troubleshooting section above
2. Review `.projax-patch.log` for error details
3. Open an issue with:
   - PROJAX version (`prx --version`)
   - OS and version
   - Error messages from log file
   - Steps to reproduce

---

## 🎉 **Success!**

If everything works, you now have a **unified project management dashboard** that seamlessly works across Windows, WSL2, and Docker environments!

```bash
# One interface to rule them all! 👑
prx list    # See all projects regardless of environment
prx 1 dev   # Run in Windows
prx 2 dev   # Run in WSL2
prx 3 dev   # Run in Docker
```

Enjoy your enhanced PROJAX experience! 🚀


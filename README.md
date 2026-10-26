# FunnyVTT - Foundry VTT with Cyberpunk RED on Linux

## Quick Start (Native)

```bash
# Start server
cd ~/.wine/drive_c/Program\ Files/Foundry\ Virtual\ Tabletop/resources/app && nohup node main.js > foundry.log 2>&1 &

# Access at http://localhost:30000
```

## Quick Start (Docker - Portable)

```bash
# Build image (requires Foundry license download URL)
docker build --build-arg FOUNDRY_URL="https://your-foundry-download-url" -t funnyvtt .

# Run container
docker run -d -p 30000:30000 funnyvtt

# Access at http://localhost:30000
```

## Installation Steps (Native)

### 1. Install Wine
```bash
sudo apt-get update && sudo apt-get install -y wine64 wine32 winbind winetricks
```

### 2. Install Foundry VTT
```bash
wine FoundryVTT-12.331-Setup.exe /S
```

### 3. Run Server Natively (Node.js)
```bash
cd ~/.wine/drive_c/Program\ Files/Foundry\ Virtual\ Tabletop/resources/app
node main.js
```
Server runs on `http://localhost:30000`

### 4. Install Cyberpunk RED System
```bash
# Clone and build
cd /tmp && git clone https://gitlab.com/cyberpunk-red-team/fvtt-cyberpunk-red-core.git --depth=1
cd fvtt-cyberpunk-red-core && npm ci && npm run build

# Install to Foundry data
cp -r dist ~/.local/share/FoundryVTT/Data/systems/cyberpunk-red-core

# Fix system.json for v12 compatibility (already done in this repo)
# System is pre-built in ./systems/cyberpunk-red-core/
cp -r systems/cyberpunk-red-core ~/.local/share/FoundryVTT/Data/systems/
```

### 5. Restart Server
```bash
pkill -f "node main.js"
cd ~/.wine/drive_c/Program\ Files/Foundry\ Virtual\ Tabletop/resources/app && nohup node main.js > foundry.log 2>&1 &
```

### 6. Setup
Open `http://localhost:30000` → complete setup → create admin password → create world with **"Cyberpunk RED - CORE"** system.

## Scripts

```bash
# Install everything (native)
./scripts/install.sh

# Start server
./scripts/start.sh

# Stop server
./scripts/stop.sh

# View logs
./scripts/logs.sh
```

## Project Structure

```
funnyvtt/
├── README.md
├── .gitignore
├── Dockerfile                 # Portable container build
├── scripts/
│   ├── install.sh            # Full automated installer (native)
│   ├── start.sh              # Start server
│   ├── stop.sh               # Stop server
│   └── logs.sh               # View logs
├── config/
│   └── options.json.example  # Example Foundry config
└── systems/
    └── cyberpunk-red-core/   # Pre-built Cyberpunk RED system
```

## File Locations (Native)

- **Foundry Install:** `~/.wine/drive_c/Program Files/Foundry Virtual Tabletop/`
- **User Data:** `~/.local/share/FoundryVTT/`
- **Systems:** `~/.local/share/FoundryVTT/Data/systems/`
- **Config:** `~/.local/share/FoundryVTT/Config/options.json`

## Why Not Push ~/.wine?

- **~200MB+** of binaries (Electron, DLLs, `.pak` files)
- **Machine-specific** - Wine registry, paths, symlinks tied to your hardware/OS
- **GitHub limits** - 100MB/file, 2GB repo max
- **Won't run on another machine** - Wine prefixes aren't portable

**Use Docker** for portable, reproducible deployments.

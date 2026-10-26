# FunnyVTT - Foundry VTT with Cyberpunk RED on Linux

## Quick Start

```bash
# Start server
cd ~/.wine/drive_c/Program\ Files/Foundry\ Virtual\ Tabletop/resources/app && nohup node main.js > foundry.log 2>&1 &

# Access at http://localhost:30000
```

## Installation Steps

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

# Fix system.json for v12 compatibility
cat > ~/.local/share/FoundryVTT/Data/systems/cyberpunk-red-core/system.json << 'SYSTEM_JSON'
{
  "version": "0.0.1",
  "id": "cyberpunk-red-core",
  "title": "Cyberpunk RED - CORE",
  "description": "Implementation of the Cyberpunk RED, Core Rules, for FVTT",
  "compatibility": { "minimum": 12, "verified": 12, "maximum": 12 },
  "authors": [{ "name": "The Project Red Team", "url": "https://gitlab.com/cyberpunk-red-team/fvtt-cyberpunk-red-core" }],
  "scripts": [],
  "esmodules": ["cpr.js"],
  "styles": ["css/main.css"],
  "packFolders": [
    { "name": "Cyberpunk RED: Core", "sorting": "m", "packs": ["core_ammo","core_armor","core_clothing","core_critical-injuries-body","core_critical-injuries-head","core_cyberware","core_drugs","core_gear","core_programs","core_roles","core_skills-languages","core_skills-local-expert","core_skills-martial-arts","core_skills-play-instrument","core_skills-science","core_upgrades","core_vehicles","core_weapons"] },
    { "name": "Cyberpunk RED: Other", "sorting": "m", "packs": ["other_macros","other_scenes","other_changelog"] }
  ],
  "languages": [{ "lang": "en", "name": "English", "path": "lang/en.json" }],
  "initiative": "1d10 + @stats.ref.value",
  "grid": { "distance": 2, "units": "m" },
  "primaryTokenAttribute": "derivedStats.hp",
  "secondaryTokenAttribute": null,
  "background": "systems/cyberpunk-red-core/images/Foundry-Background.webp",
  "license": "GPL v3"
}
SYSTEM_JSON
```

### 5. Restart Server
```bash
pkill -f "node main.js"
cd ~/.wine/drive_c/Program\ Files/Foundry\ Virtual\ Tabletop/resources/app && nohup node main.js > foundry.log 2>&1 &
```

### 6. Setup
Open `http://localhost:30000` → complete setup → create admin password → create world with **"Cyberpunk RED - CORE"** system.

## File Locations
- **Foundry Install:** `~/.wine/drive_c/Program Files/Foundry Virtual Tabletop/`
- **User Data:** `~/.local/share/FoundryVTT/`
- **Systems:** `~/.local/share/FoundryVTT/Data/systems/`
- **Config:** `~/.local/share/FoundryVTT/Config/options.json`

## Commands
```bash
# Start
cd ~/.wine/drive_c/Program\ Files/Foundry\ Virtual\ Tabletop/resources/app && nohup node main.js > foundry.log 2>&1 &

# Stop
pkill -f "node main.js"

# Logs
tail -f ~/.wine/drive_c/Program\ Files/Foundry\ Virtual\ Tabletop/resources/app/foundry.log
```

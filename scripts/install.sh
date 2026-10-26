#!/bin/bash
set -e

echo "=== FunnyVTT Installer ==="

# 1. Install Wine dependencies
echo "Installing Wine..."
sudo apt-get update && sudo apt-get install -y wine64 wine32 winbind winetricks

# 2. Install Foundry VTT (requires manual download)
echo "Download FoundryVTT-12.331-Setup.exe from your Foundry account"
echo "Place it in ~/Downloads/ then run:"
echo "  wine ~/Downloads/FoundryVTT-12.331-Setup.exe /S"
read -p "Press Enter when done..."

# 3. Install Cyberpunk RED system
echo "Installing Cyberpunk RED system..."
mkdir -p ~/.local/share/FoundryVTT/Data/systems
cp -r ../systems/cyberpunk-red-core ~/.local/share/FoundryVTT/Data/systems/

# 4. Create start script
cat > ~/start-foundry.sh << 'START_SCRIPT'
#!/bin/bash
cd ~/.wine/drive_c/Program\ Files/Foundry\ Virtual\ Tabletop/resources/app
nohup node main.js > foundry.log 2>&1 &
echo "Foundry VTT starting on http://localhost:30000"
echo "Logs: tail -f ~/.wine/drive_c/Program\ Files/Foundry\ Virtual\ Tabletop/resources/app/foundry.log"
START_SCRIPT
chmod +x ~/start-foundry.sh

echo "=== Done ==="
echo "Run: ~/start-foundry.sh"
echo "Then open: http://localhost:30000"

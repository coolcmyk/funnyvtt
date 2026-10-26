#!/bin/bash
cd ~/.wine/drive_c/Program\ Files/Foundry\ Virtual\ Tabletop/resources/app
nohup node main.js > foundry.log 2>&1 &
echo "Foundry VTT starting on http://localhost:30000"
echo "Logs: tail -f ~/.wine/drive_c/Program\ Files/Foundry\ Virtual\ Tabletop/resources/app/foundry.log"

FROM ubuntu:24.04

# Install Wine + Node.js
RUN apt-get update && apt-get install -y \
    wine64 wine32 winbind winetricks \
    nodejs npm \
    curl git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -s /bin/bash foundry
USER foundry
WORKDIR /home/foundry

# Initialize Wine prefix
RUN wine64 wineboot --init && wineserver -w

# Download Foundry (requires license URL - build arg)
ARG FOUNDRY_URL
RUN curl -L "$FOUNDRY_URL" -o /tmp/FoundryVTT-Setup.exe && \
    wine /tmp/FoundryVTT-Setup.exe /S && \
    wineserver -w && \
    rm /tmp/FoundryVTT-Setup.exe

# Copy Cyberpunk RED system
COPY systems/cyberpunk-red-core /home/foundry/.local/share/FoundryVTT/Data/systems/cyberpunk-red-core/

# Expose port
EXPOSE 30000

# Start script
COPY scripts/start.sh /home/foundry/start.sh
RUN chmod +x /home/foundry/start.sh

CMD ["/home/foundry/start.sh"]

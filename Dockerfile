# Use Node.js
FROM node:24-slim

# Install system dependencies and Chromium for ARM64
RUN apt-get update && apt-get install -y \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    libxshmfence1 \
    libxfixes3 \
    libxi6 \
    libxrender1 \
    libxtst6 \
    libglib2.0-0 \
    libfontconfig1 \
    chromium \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (if exists)
COPY package*.json ./

# Install production dependencies with ARM64 target
RUN npm install --production --platform=linux --arch=arm64

# Copy the application code
COPY src ./src

# Expose the port the app runs on
EXPOSE 3000

# Run the application
CMD ["node", "src/index.js"]
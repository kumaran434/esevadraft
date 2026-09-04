FROM node:20-bookworm-slim

# Install Tamil and Unicode fonts for Tamil government portal rendering
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-noto-core \
    fonts-lohit-taml \
    fonts-freefont-ttf \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install npm dependencies
RUN npm install --omit=dev

# Install Playwright browser and system dependencies for Chromium
RUN npx playwright install --with-deps chromium

# Copy application source code
COPY . .

# Ensure data and upload directories exist
RUN mkdir -p data uploads public/receipts public/previews public/recordings public/logs

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server.js"]

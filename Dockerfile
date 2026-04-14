FROM node:20-bookworm-slim

# Install Python and pip
RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python package globally
RUN pip3 install notebooklm-py --break-system-packages

# Copy Node configuration and install
COPY package.json ./
RUN npm install

# Copy the rest of the application files
COPY . .

# Expose the API port
EXPOSE 3000

# Start the application
CMD ["node", "index.js"]

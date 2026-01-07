FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

# Install dependencies only if package.json exists (scaffolding handling)
RUN if [ -f package.json ]; then npm install; fi

# Copy application source
COPY . .

EXPOSE 3000

# Default command, can be overridden by docker-compose
CMD ["npm", "start"]

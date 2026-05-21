# Stage 1: Build the frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application files
COPY . .

# Build the Vite application (this bakes VITE_* variables into dist/)
RUN npm run build

# Stage 2: Serve the application
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy the built files from builder stage
COPY --from=builder /app/dist ./dist

# Copy backend API files and Express server script
COPY api ./api
COPY server.js ./server.js

# Expose port 3000
EXPOSE 3000

# Start Express server
CMD ["node", "server.js"]

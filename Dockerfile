# Gunakan image Python sebagai base
FROM python:3.9.21-alpine3.21 AS base

# Stage untuk build dependencies
FROM base AS builder

RUN apk add --no-cache \
    gcompat \
    nodejs \
    npm \
    pkgconfig \
    pixman-dev \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
    build-base

WORKDIR /app

# Salin file package.json dan tsconfig.json lebih dulu untuk memanfaatkan caching
COPY package*.json tsconfig.json ./
COPY src ./src
COPY .env .env

# Install dependencies dan build aplikasi
RUN npm install && npm run build

# Ekspos port aplikasi
EXPOSE 3001

# Perintah untuk menjalankan aplikasi
CMD ["node", "/app/dist/index.js"]



FROM node:20-alpine AS builder

RUN apk add --no-cache \
    pkgconfig \
    pixman-dev \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
    build-base

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm install

COPY src ./src
COPY .env .env

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache \
    pixman \
    cairo \
    pango \
    jpeg \
    giflib \
    librsvg

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json
COPY .env .env

EXPOSE 3001

# Start the application
CMD ["node", "/app/dist/index.js"]

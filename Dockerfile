# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./

FROM base AS deps
RUN yarn install --immutable

FROM deps AS development
COPY tsconfig.json ./
COPY src ./src
CMD ["yarn", "dev"]

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN yarn build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]

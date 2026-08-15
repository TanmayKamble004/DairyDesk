# Development image for the DairyDesk Vite dev server.
#
# Node 22 satisfies Vite 8's engine requirement. Installing inside the image
# pulls the Linux builds of the native binaries (rollup, esbuild, oxlint) —
# the host's node_modules is masked by a volume in docker-compose.yml.
FROM node:22-alpine

WORKDIR /app

# Lockfile-driven install so every teammate gets identical dependencies.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

CMD ["npm", "run", "dev"]

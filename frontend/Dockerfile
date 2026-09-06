# Development image for the DairyDesk Vite dev server.
#
# Node 22 satisfies Vite 8's engine requirement. Installing inside the image
# pulls the Linux builds of the native binaries (rollup, esbuild, oxlint) —
# the host's node_modules is masked by a volume in docker-compose.yml.
FROM node:22-alpine

# Alpine ships no timezone database, so TZ from docker-compose would silently
# resolve to UTC and this container's logs would disagree with every other
# service's. ~2 MB, and the only reason it is an explicit step here while the
# Debian-based images need nothing.
RUN apk add --no-cache tzdata

WORKDIR /app

# Lockfile-driven install so every teammate gets identical dependencies.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

CMD ["npm", "run", "dev"]

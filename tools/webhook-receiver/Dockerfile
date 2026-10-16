# Deployable container for the reference webhook receiver.
#
# The point of this file is the ENV HOST line below. `server.mjs` defaults to
# binding 127.0.0.1, which is the safe choice for a local run and the WRONG one
# in a container: a cloud platform's edge proxy connects over the container's own
# network interface, not loopback, so a container that binds loopback starts
# cleanly, logs healthy, and is unreachable — the platform reports "Application
# failed to respond". Baking the value in here means a container deploy cannot
# get it wrong, while `node server.mjs` on a laptop still binds loopback only.
#
# Secrets are NOT baked in. Supply WEBHOOK_SIGNING_SECRET at runtime, and
# SUPABASE_SERVICE_ROLE_KEY only if you set ARTICLES_COMMIT=1.
#
#   docker build -t webhook-receiver tools/webhook-receiver
#   docker run -p 8787:8787 -e WEBHOOK_SIGNING_SECRET=... webhook-receiver

FROM node:22-alpine

WORKDIR /app

# Only the runtime files — the self-test and docs are not needed in the image.
COPY package.json ./
COPY server.mjs ./

ENV NODE_ENV=production
ENV HOST=0.0.0.0
# Most platforms inject PORT; 8787 is the fallback the code already uses.
ENV PORT=8787

EXPOSE 8787

# Runs as the unprivileged `node` user that the base image already provides,
# rather than root.
USER node

CMD ["node", "server.mjs"]

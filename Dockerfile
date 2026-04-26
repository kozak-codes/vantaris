FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY backend/package.json backend/package.json

RUN npm ci --workspace=@vantaris/shared --workspace=@vantaris/backend

COPY shared/ shared/
COPY backend/ backend/

ENV PORT=2567
EXPOSE 2567

CMD ["npm", "start", "--workspace=@vantaris/backend"]
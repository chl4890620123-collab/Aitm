FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
# The committed lockfile can lag optional platform dependencies pulled by
# newer frontend packages. Try the reproducible install first, then repair
# dependency resolution inside the disposable image build when npm detects
# that stale lock metadata.
RUN npm ci || npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

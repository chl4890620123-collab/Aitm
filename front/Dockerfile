FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
RUN apk add --no-cache apache2-utils
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint-auth.sh /docker-entrypoint-auth.sh
RUN chmod 755 /docker-entrypoint-auth.sh
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint-auth.sh"]

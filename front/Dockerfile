# Build stage
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Run stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Vite default is 5173, but nginx is 80
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

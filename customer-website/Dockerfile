# Build stage
FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Build args.
# Vite inlines VITE_API_URL at BUILD time. Without a default, an unset build arg
# would silently bake http://localhost:8000 into the production bundle and every
# visitor's browser would call its own machine. Default to the real backend and
# pass --build-arg VITE_API_URL=... to override it.
ARG VITE_API_URL=https://restaurant-system-production-77a8.up.railway.app
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Serve stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Add nginx config to route all requests to index.html for React Router
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

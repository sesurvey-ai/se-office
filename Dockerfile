FROM nginx:1.27-alpine

# Use the default nginx config that ships with the image — it serves
# /usr/share/nginx/html with index.html as the default. Our custom
# nginx.conf is kept in the repo (gzip + cache headers + SPA fallback)
# but not loaded yet while we stabilize the Dokploy + Swarm deploy.

WORKDIR /usr/share/nginx/html
RUN rm -f index.html
COPY index.html Sheets.png Doc.png ./

EXPOSE 80

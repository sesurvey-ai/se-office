FROM nginx:1.27-alpine

# Custom config layers on:
#   - gzip (index.html 250 KB → ~50 KB on the wire)
#   - cache headers (index.html 5 min, PNGs 1 year immutable)
#   - SPA fallback (try_files → /index.html) — required by the
#     History API routing in the app, otherwise /sheets and /docs
#     404 on hard refresh
COPY nginx.conf /etc/nginx/conf.d/default.conf

WORKDIR /usr/share/nginx/html
RUN rm -f index.html
COPY index.html Sheets.png Doc.png ./

EXPOSE 80

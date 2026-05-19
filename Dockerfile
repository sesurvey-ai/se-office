FROM nginx:1.27-alpine

# Custom config layers on:
#   - gzip (index.html 250 KB → ~50 KB; dist/univer.js 11 MB → ~3 MB)
#   - cache headers (index.html + dist/ 5 min revalidate, PNGs 1 year immutable)
#   - SPA fallback (try_files → /index.html) — required by the
#     History API routing in the app, otherwise /sheets and /docs
#     404 on hard refresh
COPY nginx.conf /etc/nginx/conf.d/default.conf

WORKDIR /usr/share/nginx/html
RUN rm -f index.html
COPY index.html Sheets.png Doc.png ./
# dist/ holds the pre-built Univer bundle (univer.js + univer.css)
# produced by `npm run build` at the repo root. Committed to git so
# the Docker build stays toolchain-free (no Node inside the image).
COPY dist/ ./dist/

EXPOSE 80

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

WORKDIR /usr/share/nginx/html
RUN rm -f index.html
COPY index.html Sheets.png Doc.png ./

EXPOSE 80

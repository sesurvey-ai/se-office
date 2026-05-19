# Deploy บน Dokploy (VPS Hostinger)

โปรเจกต์นี้เป็น **static HTML + pre-built bundle** — รันบน nginx alpine
ก็พอ ไม่ต้องการ database / runtime ใด ๆ ฝั่ง server (Univer + presets
ทั้งหมดถูก bundle ไว้ใน `dist/` แล้วผ่าน esbuild)

## ไฟล์ที่จะถูก deploy

```
se-office/
├── Dockerfile         ← nginx:1.27-alpine + COPY ไฟล์ static
├── nginx.conf         ← gzip, cache headers, SPA fallback
├── index.html         ← standalone app (~250 KB)
├── Sheets.png         ← icon SE Sheets (~8 KB)
├── Doc.png            ← icon SE Doc (~10 KB)
└── dist/              ← Univer bundle (built locally, committed to git)
    ├── univer.js      ← ~11 MB (~3 MB gzip — Univer + 11 sheet presets + docs + react + rxjs)
    └── univer.css     ← ~85 KB
```

Image ที่ build ออกมาประมาณ **~55 MB** (nginx alpine base ~40 MB + assets)

## Build (ก่อน push)

`dist/` ถูก commit ขึ้น git ดังนั้น Dockerfile ไม่ต้องใช้ Node toolchain
แต่ developer ที่อัปเดต Univer version ต้อง rebuild local ก่อน push:

```bash
npm install            # ครั้งแรกเท่านั้น
npm run build          # → regenerates dist/univer.js + dist/univer.css
git add dist/ package.json package-lock.json
git commit -m "Rebuild Univer bundle"
```

---

## วิธีที่ 1 — Deploy ผ่าน Git (แนะนำ)

### 1. Push ขึ้น Git repo

```bash
cd c:\Users\i9\Desktop\se-office
npm install && npm run build           # rebuild dist/ (skip ถ้าใช้ของที่ commit ไว้)
git add .
git commit -m "Initial SE OFFICE standalone"
git branch -M main
git remote add origin https://github.com/<your-user>/<repo>.git
git push -u origin main
```

หรือใช้ GitLab / Bitbucket / self-hosted Gitea ก็ได้ — Dokploy รองรับทุกเจ้า

### 2. ใน Dokploy UI

1. เข้า Dokploy ของ VPS (`https://<vps-ip>:3000` หรือ domain ที่ตั้งไว้)
2. **Project → Create Project** ตั้งชื่อ เช่น `se-office`
3. ใน project → **Create Application** เลือกประเภท **Application**
4. ตั้งค่า:
   - **Source Type**: Git
   - **Repository URL**: `https://github.com/<user>/<repo>.git`
   - **Branch**: `main`
   - **Build Path**: `/`
   - **Build Type**: **Dockerfile**
   - **Dockerfile Path**: `./Dockerfile`
   - หมายเหตุ: `dist/` ต้อง commit ขึ้น git แล้ว — Dokploy build จะ
     COPY ไฟล์ใน dist/ เข้า image โดยตรง ไม่มี Node อยู่ใน build stage
5. **Environment** tab — ไม่ต้องตั้งค่า env var (static site)
6. **Domains** tab → **Add Domain**
   - **Host**: `se-office.example.com` (subdomain ที่จะใช้)
   - **Path**: `/`
   - **Container Port**: `80`
   - **HTTPS**: เปิด → Dokploy จะออก Let's Encrypt cert ผ่าน Traefik ให้อัตโนมัติ
   - **Certificate Provider**: Let's Encrypt
7. กด **Deploy**

### 3. ตั้ง DNS

ที่ Hostinger DNS panel ของ domain ของคุณ:

- **Type**: A
- **Name**: `se-office` (หรือ subdomain ที่ตั้งใน Dokploy)
- **Points to**: IP ของ VPS
- **TTL**: 3600 (default)

รอ DNS propagate (~1–10 นาที) แล้วเปิด `https://se-office.example.com` ได้เลย

---

## วิธีที่ 2 — Build local แล้ว push image

ถ้าไม่อยาก push code ขึ้น Git สาธารณะ:

```bash
cd c:\Users\i9\Desktop\se-office

# (ครั้งแรก / หลังอัปเดต Univer version)
npm install && npm run build

# Build image
docker build -t se-office:latest .

# Tag + push ขึ้น registry (Docker Hub / GHCR / Hostinger private registry)
docker tag se-office:latest <username>/se-office:latest
docker push <username>/se-office:latest
```

ใน Dokploy → Create Application → **Source Type**: Docker → ใส่ image name ที่
push ไป + ตั้ง port 80 → Deploy

---

## วิธีที่ 3 — Manual upload + Compose

ถ้าไม่ใช้ Git / Registry เลย:

1. SSH เข้า VPS
2. สร้างโฟลเดอร์ + upload ไฟล์ผ่าน SCP/SFTP:
   ```bash
   scp -r univer-standalone/* user@vps:/srv/se-office/
   ```
3. ใน Dokploy → Create Application → **Source Type**: Docker Compose
4. สร้าง `docker-compose.yml`:
   ```yaml
   services:
     web:
       build: /srv/se-office
       ports:
         - "80"
       restart: unless-stopped
   ```

---

## ตรวจสอบหลัง deploy

1. **Health check**: Dockerfile มี HEALTHCHECK อยู่ — Dokploy จะแสดงสถานะ
   "healthy" ใน 30 วินาทีหลัง deploy
2. **Browser**: เปิด domain → ต้องเห็นหน้า launcher (SE OFFICE + SE Sheets icon)
3. **DevTools → Network**:
   - `index.html` มาจาก server ของเรา (~50 KB gzip)
   - `dist/univer.js` + `dist/univer.css` มาจาก server เดียวกัน
     (same-origin, ~3 MB gzip รวม) — โหลดครั้งเดียวต่อ session
   - SheetJS / jsPDF / Sarabun font / PDF.js ยังโหลดจาก unpkg + jsdelivr
     (ยังไม่ bundle — โหลด lazy เมื่อกด Save XLSX / Print / Open .xlsx)
4. **Console**: ไม่ควรมี error สีแดง (ยกเว้น CORS warning ของ CDN บางตัวที่
   ไม่ส่ง `Access-Control-Allow-Origin` — ส่วนใหญ่ไม่กระทบฟังก์ชัน)

---

## หมายเหตุสำคัญ

- **Univer self-hosted**: Univer + presets + react/rxjs ถูก bundle ใน
  `dist/` และเสิร์ฟ same-origin แล้ว — CDN ล่มไม่กระทบหน้า launcher /
  Sheets / Docs warm path
- **CDN dependency (ส่วนรอง)**: SheetJS + jsPDF + Sarabun font + PDF.js +
  se-univer-shared modules ยังโหลดจาก unpkg.com + jsdelivr.net แบบ lazy
  ถ้า CDN ล่ม → กด Save XLSX / Print / Open .xlsx ไม่ได้ แต่ Save JSON /
  พิมพ์ใน sheet ปกติยังใช้ได้
- **HTTPS จำเป็น**: File System Access API (Save As / Open file picker
  ของ browser) ใช้ได้เฉพาะบน HTTPS หรือ localhost — Dokploy + Let's Encrypt
  ก็จะแก้ปัญหานี้ให้อัตโนมัติ
- **History API routing**: `/sheets` / `/docs` ใช้ pushState — server
  ต้องมี SPA fallback (`try_files $uri $uri/ /index.html`) ไม่งั้น hard
  refresh จะ 404 (nginx.conf จัดการแล้ว)
- **No persistence**: app เก็บ workbook ไว้ที่เครื่อง user เท่านั้น (Save →
  download ไฟล์ / File System Access API) ไม่มีฝั่ง server ต้องห่วง backup

---

## Troubleshooting

| ปัญหา | สาเหตุที่น่าจะเป็น | แก้ |
|---|---|---|
| Build fail "COPY index.html: file not found" | ไฟล์ไม่อยู่ใน build context | ตรวจว่า Build Path ใน Dokploy ชี้ไปที่โฟลเดอร์ที่มี index.html |
| 502 Bad Gateway | Container ยังไม่ healthy / port ผิด | ตรวจว่า Container Port = 80, รอ 30s ให้ health check ผ่าน |
| HTTPS cert ไม่ออก | DNS ยังไม่ propagate / domain ชี้ผิด IP | `dig se-office.example.com` ตรวจว่าได้ IP ของ VPS, รอ DNS, ลอง redeploy |
| หน้าโหลดแต่ Univer ไม่ขึ้น | `dist/` ไม่ได้ถูก COPY เข้า image / build ลืม `npm run build` | เช็ค `https://<domain>/dist/univer.js` ใน DevTools — ถ้า 404 = Dockerfile ไม่ได้ COPY ใส่ image, ถ้า 200 แต่เก่า = ลืม rebuild ก่อน push |
| Save XLSX / Print / Open .xlsx ไม่ทำงาน | unpkg / jsdelivr ถูก firewall บล็อก (SheetJS / jsPDF / se-univer-shared ยังโหลดจาก CDN) | SSH เข้า VPS แล้ว `curl -I https://unpkg.com/xlsx-js-style/dist/xlsx.bundle.js` ตรวจ network egress |
| File picker Save As ไม่เปิด | ใช้ HTTP ไม่ใช่ HTTPS | ตั้ง HTTPS ใน Dokploy domain settings |

---

## Update / Redeploy

หลังแก้ไขไฟล์:

```bash
# ถ้าแตะ package.json (อัปเดต Univer version) — ต้อง rebuild ก่อน
npm run build
git add . && git commit -m "Update" && git push
```

ใน Dokploy → Application → **Redeploy** (หรือเปิด auto-deploy webhook ใน
project settings ให้ pull อัตโนมัติทุก push)

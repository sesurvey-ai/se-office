# Deploy บน Dokploy (VPS Hostinger)

โปรเจกต์นี้เป็น **static HTML** (1 ไฟล์ HTML + 2 PNG) — รันบน nginx alpine
ก็พอ ไม่ต้องการ database / runtime / build step ใด ๆ

## ไฟล์ที่จะถูก deploy

```
univer-standalone/
├── Dockerfile         ← nginx:1.27-alpine + COPY 3 ไฟล์ + health check
├── nginx.conf         ← gzip, cache headers, security
├── .dockerignore      ← exclude README/dotfiles
├── index.html         ← standalone app (~250 KB)
├── Sheets.png         ← icon SE Sheets (~8 KB)
└── Doc.png            ← icon SE Doc (~10 KB)
```

Image ที่ build ออกมาประมาณ **~50 MB** (nginx alpine base ~40 MB + assets)

---

## วิธีที่ 1 — Deploy ผ่าน Git (แนะนำ)

### 1. Push ขึ้น Git repo

```bash
cd c:\Users\i9\Desktop\se-office\univer-standalone
git init
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
   - **Build Path**: `/` (หรือ `/univer-standalone` ถ้า push ทั้งโปรเจกต์รวม)
   - **Build Type**: **Dockerfile**
   - **Dockerfile Path**: `./Dockerfile`
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
cd c:\Users\i9\Desktop\se-office\univer-standalone

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
   - Univer / SheetJS / jsPDF / fonts โหลดจาก unpkg + jsdelivr (external CDN)
4. **Console**: ไม่ควรมี error สีแดง (ยกเว้น CORS warning ของ CDN บางตัวที่
   ไม่ส่ง `Access-Control-Allow-Origin` — ส่วนใหญ่ไม่กระทบฟังก์ชัน)

---

## หมายเหตุสำคัญ

- **CDN dependency**: app นี้พึ่ง unpkg.com + cdn.jsdelivr.net สำหรับ Univer +
  SheetJS + jsPDF + Sarabun font + PDF.js ถ้า CDN ล่ม / ถูกบล็อก app จะโหลด
  ไม่ขึ้น ถ้าต้องการ self-host ทุกอย่าง บอกได้ จะปรับ Dockerfile ให้
  download assets ลง image ตอน build
- **HTTPS จำเป็น**: File System Access API (Save As / Open file picker
  ของ browser) ใช้ได้เฉพาะบน HTTPS หรือ localhost — Dokploy + Let's Encrypt
  ก็จะแก้ปัญหานี้ให้อัตโนมัติ
- **Hash routing**: `#/sheets` / `#/docs` ทำงาน client-side ล้วน — server
  เห็นแค่ path `/` ทุก request ดังนั้น nginx config ไม่ต้องการ SPA fallback
  พิเศษ (มีอยู่แล้วเผื่ออนาคต)
- **No persistence**: app เก็บ workbook ไว้ที่เครื่อง user เท่านั้น (Save →
  download ไฟล์ / File System Access API) ไม่มีฝั่ง server ต้องห่วง backup

---

## Troubleshooting

| ปัญหา | สาเหตุที่น่าจะเป็น | แก้ |
|---|---|---|
| Build fail "COPY index.html: file not found" | ไฟล์ไม่อยู่ใน build context | ตรวจว่า Build Path ใน Dokploy ชี้ไปที่โฟลเดอร์ที่มี index.html |
| 502 Bad Gateway | Container ยังไม่ healthy / port ผิด | ตรวจว่า Container Port = 80, รอ 30s ให้ health check ผ่าน |
| HTTPS cert ไม่ออก | DNS ยังไม่ propagate / domain ชี้ผิด IP | `dig se-office.example.com` ตรวจว่าได้ IP ของ VPS, รอ DNS, ลอง redeploy |
| หน้าโหลดแต่ Univer ไม่ขึ้น | unpkg / jsdelivr ถูก firewall ของ VPS บล็อก | SSH เข้า VPS แล้ว `curl -I https://unpkg.com/@univerjs/presets/lib/umd/index.js` ตรวจ network egress |
| File picker Save As ไม่เปิด | ใช้ HTTP ไม่ใช่ HTTPS | ตั้ง HTTPS ใน Dokploy domain settings |

---

## Update / Redeploy

หลังแก้ไขไฟล์:

```bash
git add . && git commit -m "Update" && git push
```

ใน Dokploy → Application → **Redeploy** (หรือเปิด auto-deploy webhook ใน
project settings ให้ pull อัตโนมัติทุก push)

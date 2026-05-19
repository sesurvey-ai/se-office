# Port Fixes → se-report

รายการบักที่เพิ่งแก้ใน se-office พร้อมวิธีพอร์ตไปยัง se-report
ทุกการแก้อยู่ฝั่ง caller เท่านั้น **ไม่ต้องแตะ `se-univer-shared`**

## สรุป (ตามความสำคัญ)

| # | บัก | ระดับ | ผลกระทบ |
|---|---|---|---|
| **TDZ** | `loadPrintPreviewAssets()` ถูกเรียกก่อน `const printPreviewState` ประกาศ | 🔴 Critical | ทั้งหน้าใช้งานไม่ได้ — launcher click ไม่ทำงาน |
| **S1** | Cell editor ที่ยังไม่ commit ไม่เข้า save() snapshot | 🔴 Critical | Data loss — ไฟล์ที่บันทึกออกมาว่าง |
| **C1** | Concurrency lock บน Save (feature ใหม่) | 🟡 Major | คลิก Save ซ้ำๆ อาจเขียน stale snapshot ทับ |
| **M1** | Print เงียบเมื่อ CDN ล่ม (unhandled rejection) | 🟡 Major | ผู้ใช้กด Print แล้วไม่มีอะไรเกิด |
| **M2** | `saving` flag ค้าง `true` ถ้า loader throw (regression จาก C1) | 🟡 Major | Save ใช้ไม่ได้จนรีเฟรช |
| **M2-bonus** | `openSheetFile` unhandled rejection | 🟢 Minor | Open เงียบเมื่อ CDN ล่ม |
| **B1** | Univer bundle (esbuild) — โหลด 2 ไฟล์ same-origin แทน 30+ จาก unpkg | 🟢 Perf | Warm-cache mount 14.7s → <1s |

---

## TDZ — Script ทั้งหมดตายตั้งแต่ start (ตรวจก่อน)

### อาการ

เปิดหน้าเว็บ → กดปุ่ม SE Sheets → ไม่มีอะไรเกิดขึ้น
Console: `Uncaught ReferenceError: Cannot access 'printPreviewState' before initialization`

### สาเหตุ

`function loadPrintPreviewAssets()` ถูก hoisted (เรียกได้ตั้งแต่ต้น script)
แต่ภายในอ้าง `const printPreviewState = {...}` ซึ่งอยู่ในส่วน se-univer-shared
ที่ประกาศทีหลัง — เรียกก่อน declaration line → Temporal Dead Zone

ผลคือ **Uncaught throw หยุดทั้ง script** → event handler binding ที่ปลายไฟล์
(เช่น launcher click) ไม่ได้ run

### หาใน se-report

```
grep -n "loadPrintPreviewAssets()" index.html
grep -n "const printPreviewState" index.html
```

ถ้า call site (เลขบรรทัด) **น้อยกว่า** declaration line → มีบัก

### แก้

ย้าย call block ลงไป **หลัง** declaration ของ `const printPreviewState`
(ในของเรา = หลังจบ section "se-univer-shared modules" ทั้งหมด)

```js
// เดิม: อยู่กลางๆ ไฟล์ ก่อน se-univer-shared section
loadPrintPreviewAssets().then(() => {
    SeShared.print.preview.interceptPrintShortcut(() => { ... });
}).catch(e => console.warn(...));

// ย้ายมาไว้ถัดจาก loadPrintPdfGeneratorAssets() declaration:
// ... (end of se-univer-shared module section) ...
loadPrintPreviewAssets().then(() => {
    SeShared.print.preview.interceptPrintShortcut(() => { ... });
}).catch(e => console.warn(...));
```

---

## S1 — Save บันทึก workbook ว่าง (data loss จริง)

### อาการ

ผู้ใช้พิมพ์ข้อมูลใน cell → **กด Save ทันที โดยไม่กด Enter ก่อน** →
ตั้งชื่อไฟล์ → เปิดไฟล์กลับมา → **ไม่มีข้อมูลที่พิมพ์**

อาจเห็น Univer warning ใน Console (แต่**ไม่ใช่สาเหตุหลัก**):
```
use 'save' instead of 'getSnapshot'
```

### สาเหตุที่แท้จริง (ยืนยันด้วย browser test แล้ว)

เมื่อ user พิมพ์ใน cell, Univer เก็บ pending value ใน **cell editor's
local state** จนกว่าจะ commit ผ่าน Enter / Tab / blur — ทั้ง `save()` และ
`getSnapshot()` **ไม่เห็น pending value** ดังนั้นถ้า save ระหว่างที่ cell
editor ยังเปิดอยู่ → snapshot ที่ได้คือ workbook **ก่อนการพิมพ์** → ไฟล์ที่
บันทึกว่าง

**Test ยืนยันใน browser console:**

```js
// 1. คลิก cell A1 แล้วพิมพ์ "hello" (ไม่กด Enter)
JSON.stringify(sheetState.univerAPI.getActiveWorkbook().save()).includes('hello')
// → false   ← editor ยังไม่ commit

// 2. ส่ง commit command
await sheetState.univerAPI.executeCommand(
    'sheet.operation.set-cell-edit-visible',
    { visible: false, eventType: 3, keycode: 13 }
);

// 3. เช็คใหม่
JSON.stringify(sheetState.univerAPI.getActiveWorkbook().save()).includes('hello')
// → true   ← commit แล้ว
```

หมายเหตุ: `getSnapshot()` ถูก deprecate และต้องเปลี่ยนเป็น `save()` ก็จริง
แต่ทั้ง 2 method **คืนข้อมูลเหมือนกัน** เมื่อ data ถูก commit แล้ว — ดังนั้น
api rename ไม่ใช่สาเหตุของไฟล์ว่าง

### หาใน se-report

```
grep -n "getCurrentUniverSnapshot\|getSnapshot" index.html
grep -n "buildSheet\(Xlsx\|Json\)Blob" index.html
grep -n "saveSheetFile\|saveSheetAs\|printSheetToPdf" index.html
```

### แก้

**ส่วนที่ 1 — เพิ่ม helper `commitActiveCellEdit()`** (วางใกล้
`getCurrentUniverSnapshot`):

```js
// Force-commit any in-progress cell editor before snapshotting.
// Univer keeps typed-but-uncommitted values in the editor's local
// state until Enter / Tab / blur — and save() / getSnapshot() do
// NOT see those pending edits. eventType 3 = exit-on-keyboard,
// keycode 13 = Enter; together they mimic the user pressing Enter
// to commit. Sheets-only command; Docs has its own editor.
async function commitActiveCellEdit() {
    if (sheetState.mode !== 'sheets') return;
    if (!sheetState.univerAPI) return;
    try {
        await sheetState.univerAPI.executeCommand(
            'sheet.operation.set-cell-edit-visible',
            { visible: false, eventType: 3, keycode: 13 }
        );
    } catch (e) {
        console.warn('commitActiveCellEdit failed (continuing):', e);
    }
}
```

**ส่วนที่ 2 — เรียก `await commitActiveCellEdit()` ก่อนสร้าง blob ใน
ทุก save / print flow:**

```js
// saveSheetFile — inside try block, before kind/blob:
sheetState.saving = true;
try {
    await loadFileIoPickersAssets();
    await commitActiveCellEdit();         // ← ADD
    const kind = ...;
    const blob = kind === 'xlsx' ? ... : ...;
    ...
```

```js
// saveSheetAs — same place:
sheetState.saving = true;
const isDocsMode = sheetState.mode === 'docs';
try {
    await loadFileIoPickersAssets();
    await commitActiveCellEdit();         // ← ADD
    if (window.showSaveFilePicker) {
        ...
```

```js
// printSheetToPdf — ก่อน setSheetOverlay "กำลังสร้าง PDF":
await loadJsPdfAssets();
if (!returnBlobOnly) await loadPrintPreviewAssets();
await commitActiveCellEdit();             // ← ADD
if (!returnBlobOnly) setSheetOverlay(true, 'กำลังสร้าง PDF...');
```

**ส่วนที่ 3 (cleanup) — เปลี่ยน `getSnapshot()` → `save()` ใน
`getCurrentUniverSnapshot`** (ลบ Univer warning):

```js
// In getCurrentUniverSnapshot:
if (fWb) {
    if (typeof fWb.save === 'function') return fWb.save();
    if (typeof fWb.getSnapshot === 'function') return fWb.getSnapshot();
}
// เก็บ getSnapshot fallback ไว้สำหรับ Univer build เก่า
```

### ทดสอบ
1. เปิด workbook ว่าง
2. คลิก A1 → พิมพ์ "test" (**อย่ากด Enter**)
3. ขณะ cell ยังขอบสีน้ำเงิน (edit mode) → กด Save
4. ตั้งชื่อ → ยืนยัน
5. Home → SE Sheets → Open → เลือกไฟล์ที่เพิ่ง save
6. **ต้องเห็น "test" ใน A1** ✅

---

## C1 — Concurrency Lock บน Save (feature ใหม่)

### ทำไมต้องมี

ผู้ใช้คลิก Save ซ้ำๆ ติดๆ ระหว่าง overlay "กำลังเขียน..." (xlsx build อาจกิน
หลายวินาทีสำหรับ workbook ใหญ่) → save 2 ครั้งทำงานขนานกัน → ครั้งที่ 2
อาจเขียน snapshot ใหม่กว่าทับครั้งแรกที่ยังไม่จบ — ลำดับเขียนสลับ

### หา / Implement ใน se-report

ใน `sheetState` declaration เพิ่ม flag:

```js
const sheetState = {
    mounted: false,
    ...
    fileHandle: null,
    fileName: null,
    fileKind: null,
    // Concurrency guard for save flows.
    saving: false,        // ← ADD
};
```

### Guard ใน save flows

**saveSheetFile:**
```js
async function saveSheetFile() {
    if (!sheetState.mounted) { ... return; }
    if (sheetState.saving) return;             // ← ADD early-return
    if (!sheetState.fileHandle || !sheetState.fileKind) {
        return saveSheetAs();
    }
    // saving=true อยู่ในตัว try (ดู M2)
    sheetState.saving = true;
    try {
        ...
    } finally {
        setSheetOverlay(false);
        sheetState.saving = false;             // ← ADD reset
    }
}
```

**saveSheetAs:**
```js
async function saveSheetAs() {
    if (!sheetState.mounted) { ... return; }
    if (sheetState.saving) return;             // ← ADD
    sheetState.saving = true;
    const isDocsMode = sheetState.mode === 'docs';
    try {
        ...
    } finally {
        setSheetOverlay(false);
        sheetState.saving = false;             // ← ADD
    }
}
```

---

## M1 — Print เงียบสนิทเมื่อ CDN ล่ม

### อาการ

ผู้ใช้กด Print → `loadPageSetupAssets()` ดึง script จาก jsdelivr ไม่สำเร็จ
(network drop / CDN block) → `openPageSetupModal()` reject → caller
(`printActiveView`) return promise ตรงๆ ไม่มี `.catch()` →
**unhandled rejection** ใน console แต่ผู้ใช้ไม่เห็นอะไรเลย

### หาใน se-report

```
grep -n "openPageSetupModal()" index.html
```

มองหา caller pattern:

```js
function printActiveView() {
    if (sheetState.mode === 'docs') { ... return; }
    if (!sheetState.mounted) { ... return; }
    return openPageSetupModal();   // ← bug: no .catch()
}
```

### แก้

```js
function printActiveView() {
    if (sheetState.mode === 'docs') { ... return; }
    if (!sheetState.mounted) { ... return; }
    return openPageSetupModal().catch(e => {
        console.error('openPageSetupModal failed:', e);
        alert('เปิด Page Setup ไม่สำเร็จ: ' + (e && e.message || e));
    });
}
```

ไม่ต้องเปลี่ยน `openPageSetupModal` หรือ `_ensurePageSetup` — แค่ใส่ catch
ที่ call site เดียว

---

## M2 — Save ค้างถาวรเมื่อ CDN ล่มระหว่างโหลด picker (regression จาก C1)

### อาการ

ถ้าใช้ pattern `sheetState.saving = true` **ก่อน** `try` block แล้วมี
`await loadFileIoPickersAssets()` ก่อน try → CDN fail = throw ก่อนเข้า try
→ `finally` ไม่ทำงาน → `saving` ค้าง `true` → save ใช้ไม่ได้จนกว่าจะรีเฟรช

### Pattern ที่ผิด

```js
sheetState.saving = true;
await loadFileIoPickersAssets();   // ← throw ที่นี่ = stuck
try {
    ...
} finally {
    sheetState.saving = false;     // ← ไม่ run
}
```

### แก้ — ย้าย loader เข้าใน try

**saveSheetFile:**
```js
sheetState.saving = true;
try {
    await loadFileIoPickersAssets();    // ← ย้ายเข้ามา
    await commitActiveCellEdit();
    ...
} finally {
    sheetState.saving = false;          // ← ตอนนี้ run แน่นอน
}
```

**saveSheetAs:** เหมือนกัน — ย้าย `await loadFileIoPickersAssets()` เข้าใน try

### Bonus — openSheetFile

`openSheetFile()` ไม่ใช้ `saving` flag → ไม่เกิด stuck-flag bug แต่
unhandled rejection ก็เกิดได้เหมือน M1 (Open เงียบเมื่อ CDN ล่ม):

```js
// เดิม
async function openSheetFile() {
    if (sheetState.dirty && !confirm(...)) return;
    await loadFileIoPickersAssets();
    const isDocsMode = ...;
    const r = await SeShared.fileIo.pickers.openFile({...});
    if (r.cancelled || !r.file) return;
    ...
}

// แก้
async function openSheetFile() {
    if (sheetState.dirty && !confirm(...)) return;
    const isDocsMode = ...;
    let r;
    try {
        await loadFileIoPickersAssets();
        r = await SeShared.fileIo.pickers.openFile({...});
    } catch (e) {
        console.error(e);
        alert('เปิดไฟล์ไม่สำเร็จ: ' + (e && e.message || e));
        return;
    }
    if (r.cancelled || !r.file) return;
    ...
}
```

---

## ทดสอบหลังพอร์ตทุกฟิกซ์

### TDZ
1. เปิดเพจ → กด SE Sheets → ต้องเข้า editor ได้ (ไม่มี error ใน Console)

### S1 (สำคัญสุด)
1. คลิก A1 → พิมพ์ "test" (**อย่ากด Enter**)
2. กด Save ทันที → ตั้งชื่อ → ยืนยัน
3. Open ไฟล์ที่เพิ่ง save → **ต้องเห็น "test"**

### C1 (concurrency)
1. workbook ใหญ่ + DevTools Performance → CPU 6x slowdown
2. กด Save แล้วรีบกดซ้ำ 3-4 ครั้ง
3. ระหว่าง overlay → รัน `sheetState.saving` ใน console → `true`
4. คลิกที่ 2+ early-return ทันที (ไม่มี save ขนานกัน)
5. รอจบ → flag กลับเป็น `false`

### M1 (Print catch)
1. DevTools → Network tab → Right-click → Block request URL
   `https://cdn.jsdelivr.net/gh/sesurvey-ai/se-univer-shared@*/print/page-setup.js`
2. กด Print → **alert "เปิด Page Setup ไม่สำเร็จ"** (ไม่เงียบ)
3. Unblock → Print ทำงานปกติ

### M2 (Save flag คืนค่า)
1. Block `.../file-io/pickers.js`
2. กด Save → alert "บันทึกไม่สำเร็จ"
3. Console: `sheetState.saving` → ต้องได้ `false` (ไม่ค้าง)
4. Unblock → Save อีกครั้งทำงานปกติ

---

---

## B1 — Univer bundle (เปลี่ยนจาก CDN UMD → esbuild bundle)

### ทำไม

โหลด Univer + 11 sheet presets + docs preset + react + rxjs + ทุก
CSS ผ่าน `<script>` / `<link>` แยกๆ จาก unpkg = 30+ ไฟล์, browser CSS
parse ใช้เวลา ~1.3-1.9s ต่อไฟล์ → warm-cache mount ~14.7s

รวมเป็น `dist/univer.js` + `dist/univer.css` ผ่าน esbuild → parse 2 ครั้ง
→ <1s

### ข้อแตกต่างกับ se-office

se-office เป็น nginx-served static — COPY `dist/` เข้า image ตรง ๆ
**se-report เป็น Flask-served** — `dist/` ต้องวางใน `static/` ของ Flask
หรือ mount path ใหม่ผ่าน `@app.route` / `send_from_directory`

### ไฟล์ที่ต้องเพิ่มใน se-report

```
se-report/
├── package.json           ← copy จาก se-office (เปลี่ยน "name" → "se-report")
├── build.mjs              ← copy ทั้งไฟล์
├── src/
│   └── bundle-entry.js    ← copy ทั้งไฟล์
└── static/dist/           ← output ของ npm run build (committed to git)
    ├── univer.js
    └── univer.css
```

ปรับ `build.mjs` ถ้าจะใช้ output path อื่น:

```js
const OUTDIR = resolve('static/dist');   // ← เปลี่ยนจาก 'dist'
```

### แก้ template (index.html / Jinja)

ลบ block ที่ประกาศ `UNIVER_URLS_BASE` / `UNIVER_URLS_SHEETS` /
`UNIVER_URLS_DOCS` (30+ บรรทัด) และฟังก์ชัน `loadUniverBaseAssets()` /
`loadUniverSheetsAssets()` / `loadUniverDocsAssets()` ทั้งหมด

แทนด้วย:

```js
const UNIVER_BUNDLE_JS = '{{ url_for("static", filename="dist/univer.js") }}';
const UNIVER_BUNDLE_CSS = '{{ url_for("static", filename="dist/univer.css") }}';

function loadUniverAssets(mode) {
    if (sheetState.loaded) return Promise.resolve();
    if (sheetState.loadingPromise) return sheetState.loadingPromise;
    sheetState.loadingPromise = (async () => {
        _loadUniverCss(UNIVER_BUNDLE_CSS);
        await _loadUniverScript(UNIVER_BUNDLE_JS);
        if (typeof UniverPresets === 'undefined'
            || typeof UniverCore === 'undefined') {
            throw new Error('Univer base globals missing after bundle load');
        }
        if (typeof UniverPresetSheetsCore === 'undefined') {
            throw new Error('UniverPresetSheetsCore missing after bundle load');
        }
        if (typeof UniverPresetDocsCore === 'undefined') {
            throw new Error('UniverPresetDocsCore missing after bundle load');
        }
        sheetState.loaded = true;
    })();
    return sheetState.loadingPromise.catch(err => {
        sheetState.loadingPromise = null;
        throw err;
    });
}
```

(ถ้า se-report ใช้ template ที่ไม่ใช่ Jinja หรือ path อื่น แค่ปรับ
ค่าของ `UNIVER_BUNDLE_JS` / `UNIVER_BUNDLE_CSS` ให้ตรง URL จริง)

ลบ field `loadedSheets / loadingSheetsPromise / loadedDocs /
loadingDocsPromise` ใน `sheetState` ด้วย — ใช้แค่ `loaded` /
`loadingPromise` เดียว

### ทดสอบ

1. `npm install && npm run build` → ได้ `static/dist/univer.js` + `.css`
2. รัน Flask → เปิดหน้า launcher
3. DevTools → Network: เห็นแค่ 2 request ของ Univer (univer.js + univer.css)
   ไม่ใช่ 30+ request ไป unpkg
4. กด SE Sheets → mount ภายใน 1-2 วินาที (warm cache)

### หมายเหตุ

- ใช้ Univer version เดียวกับ se-office (`0.23.0`) เพื่อให้ behavior ตรงกัน
- SheetJS / jsPDF / Sarabun font / PDF.js / se-univer-shared **ยังโหลดจาก
  CDN** เหมือนเดิม — ไม่ต้อง bundle (lazy-loaded, ไม่ใช่ critical path)

---

## หมายเหตุ

- ฟิกซ์ทั้งหมดอยู่ฝั่ง **caller** (`index.html` ของ se-report เอง) —
  ไม่ต้องแตะ `se-univer-shared`
- ทุกฟิกซ์เป็น **defensive coding** ที่ไม่กระทบ happy path
- โค้ดเดิมจะยังทำงานปกติเมื่อ:
  - CDN ใช้ได้ตามปกติ (M1/M2/openFile)
  - User กด Enter ปกติก่อน Save (S1)
  - User คลิก Save ครั้งเดียว (C1)
- การปอร์ตควรทำตามลำดับ **TDZ → S1 → C1 → M1 → M2** เพราะ M2 ต้องการ
  C1 พื้นที่อยู่ก่อน (M2 = แก้ regression จาก C1)

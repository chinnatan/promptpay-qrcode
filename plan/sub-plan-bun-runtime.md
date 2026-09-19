# ปรับ runtime เป็น Bun — เปลี่ยนเฉพาะ dev runtime (scripts/docs) โดยไม่แตะโค้ด library

## Business Goals
- งาน dev ใน repo (test, example, decode CLI) รันบน Bun แทน Node
- โค้ด library ยังเป็น CommonJS ที่ Node consumer ใช้ได้ปกติ (ไม่ breaking สำหรับผู้ติดตั้งจาก npm)
- เอกสาร/คำสั่งใน repo ตรงกับ runtime จริงที่ใช้รัน

## ขอบเขตที่สำรวจแล้ว (Phase 0)
- `crc.js`, `promptpay.js`, `kshop.js`, `decode.js`, `index.js` — ไม่มี API เฉพาะ Node (ใช้แค่ string/math) → Bun รันได้ทันทีโดยไม่ต้องแก้
- `test.js` — harness `check(name, fn)` แบบ custom รันผ่าน `bun test.js` ได้ (`bun test` เฉย ๆ จะไปใช้ bun test runner แล้วไม่เจอ check() — ต้องรันเป็นไฟล์)
- `cli.js` — ใช้ `process.argv`, `fs.readFileSync(0)` → Bun รองรับทั้งหมด
- `image.js` — lazy-require `qrcode` → Bun รองรับ (ต้อง `bun add -d qrcode` ก่อนรัน example:image)
- จุดที่ต้องตัดสินใจ: shebang `cli.js` และ `engines` ใน package.json (ดู Appendix)

## Phase 1: เปลี่ยน scripts เป็น Bun
### package.json
- [x] สร้าง branch ใหม่ตาม git flow (`feature/bun-runtime`) ก่อนเริ่มแก้
- [x] เปลี่ยน `scripts.test` จาก `node test.js` เป็น `bun test.js`
- [x] เปลี่ยน `scripts.example` / `scripts.example:image` / `scripts.decode` เป็น `bun ...`
- [x] ผล: เพิ่ม `devDependencies: { "qrcode": "^1.5.0" }` — `bun add -d qrcode` ไม่ install ให้เพราะเป็น optional peer (bun ข้ามเงียบ ๆ) จึงใส่ตรงใน package.json + commit `bun.lock`

## Phase 2: เอกสารให้ตรง runtime
### CLI usage
- [x] อัปเดต comment/usage ข้อความใน `cli.js` (บรรทัด 6–8, 50) จาก `node cli.js` เป็น `bun cli.js`
### README
- [x] อัปเดตทุกจุดที่อ้าง node/npm runtime เป็น bun (install, CLI, qrcode, tests) ตามขอบเขต B
### AGENTS.md
- [x] อัปเดต section "Commands" ให้สะท้อน `bun test.js` / `bun cli.js`
### อื่น ๆ (เพิ่มระหว่างทาง)
- [x] `image.js` / `example-image.js`: ข้อความ error+comment "npm install qrcode" → "bun add qrcode"

## Phase 3: Review & Quality Assurance
- [x] รัน `bun test.js` → ผ่าน 62/62 checks
- [x] รัน `bun cli.js` ด้วย payload จริง → exit 0; CRC ผิด → exit 1
- [x] รัน `bun example.js` → exit 0
- [x] รัน `bun run example:image` → exit 0 (ต้องใส่ devDep `qrcode` ก่อนตาม Phase 1)
- [x] ~~ยืนยัน backward-compat กับ node~~ — ยกเลิก (user เลือก B: bun-only)

## ผลลัพธ์สรุป
- version → 2.0.0, engines → `{ "bun": ">=1.0.0" }`, shebang → `#!/usr/bin/env bun`
- โค้ด library ไม่แตะเลย (CommonJS มาตรฐาน Bun รันได้ตรง)

## Appendix — จุดที่ต้องให้ user ตัดสิน

| ข้อ | ตัวเลือก A (แนะนำ) | ตัวเลือก B (bun-only เต็มตัว) |
|---|---|---|
| shebang `cli.js` | คง `#!/usr/bin/env node` (npm bin ต้องรันบนเครื่องผู้ใช้ทุกเครื่อง) | `#!/usr/bin/env bun` (break ผู้ใช้ที่ไม่มี bun) |
| `engines` | คง `"node": ">=12"` ไว้ เพราะยังรองรับสอง runtime | เปลี่ยนเป็น `"bun": ">=1"` + major bump v2.0.0 |
| `type` ใน package.json | คง `commonjs` | เดิมก็เข้ากัน bun อยู่แล้ว ไม่ต้องแตะ |

ข้อสังเกต: repo นี้เป็น npm library ที่คนอื่น `require()` จาก Node — การ宣布 bun-only เป็น breaking change โดยไม่มีข้อได้เปรียบเชิงเทคนิค (โค้ดไม่ได้ใช้ API ที่ bun-only) จึงแนะนำขอบเขต A: เปลี่ยนเฉพาะ dev runtime

## สรุปการอนุมัติ (user เลือก B: bun-only เต็มตัว, 2026-09-20)
- shebang `cli.js` → `#!/usr/bin/env bun`
- `engines` → `{ "bun": ">=1.0.0" }` (ลบ node ออก)
- bump version → `2.0.0` (major, breaking)
- Phase 3 ข้อยืนยัน backward-compat กับ node → ยกเลิก (ไม่รองรับแล้ว)
- เพิ่ม: อัปเดต README ประโยคที่อ้าง Node runtime + ติดป้าย v2.0.0 breaking ในเอกสาร

# AGENTS.md

ไลบรารี Bun แบบไม่มี dependency runtime ใช้สร้าง payload string ของ QR
PromptPay / Thai EMVCo (Tag 29, Tag 30 bill payment, KShop) พร้อม decoder
— source เป็น TypeScript (`src/*.ts`) build ด้วย `tsc` เป็น CommonJS +
`.d.ts` ลง `dist/`

## กระบวนการทำงานหลัก (ฟีเจอร์, แก้บั๊ก, refactor)

ห้ามเขียนโค้ดทันที ทำ Phase 0 ก่อน แล้วรอ user อนุมัติ

**Phase 0 — สำรวจบริบท + planning checklist.** สำรวจโค้ดส่วนที่เกี่ยวข้องก่อน (อ่าน `.cursor/rules/*.mdc` ก่อนทำงาน UI) แล้วแตก requirement เป็น checklist เสนอให้ user อนุมัติก่อน implement:

```markdown
# [ชื่อฟีเจอร์] — [ขอบเขตสั้น ๆ หนึ่งบรรทัด]

## Business Goals
- [ผลลัพธ์ที่คาดหวัง — bullet ธรรมดา ห้ามใส่ checkbox]

## Phase 1: [workstream]
### [กลุ่มงานย่อย]
- [ ] [งานย่อยที่ทำได้จริง 1 ประโยค]

## Phase N: Review & Quality Assurance
- [ ] รัน `bun run typecheck` + `task test` เฉพาะ scope ที่แก้
```

กฎการเขียน checklist:
1. Phase จัดตาม workstream ของ requirement — ห้ามบังคับชั้นที่งานไม่ได้แตะ
2. `###` subsection = กลุ่มงานย่อยใน phase; เฉพาะงานที่เป็น entity/ฟีเจอร์ใหม่เต็มระบบ: ใช้ขั้นตอนใน "การเพิ่ม entity" ข้างล่างเป็น subsection ของ phase ที่เกี่ยว
3. `- [ ]` = งานที่ agent ทำจริงเท่านั้น 1 บรรทัด 1 action; ห้ามใส่ "วิเคราะห์ codebase" ซ้ำ (นั่นคือ Phase 0)
4. ผลจากการวิจัย (ตารางเปรียบเทียบ, ไฟล์ที่กระทบ) ใส่ใน Appendix ของ plan ไม่ใช่ใน checklist ที่ user อนุมัติ

กฎการดำเนินงาน:
1. ห้ามเขียนโค้ดก่อน checklist ได้รับอนุมัติ
2. ถ้าขัดกับ rule หรือ skill → ระบุข้อขัดแย้งแล้วถาม user ว่าจะ (A) ทำตาม rule/skill หรือ (B) ทำตามวิธีของผู้ใช้ ห้ามข้ามเงียบ ๆ
3. ติ๊ก `[x]` ทันทีเมื่อแต่ละข้อย่อยเสร็จ
4. ก่อนเริ่มงาน ใช้ git flow สร้าง branch ใหม่ก่อน
5. ก่อนปิดงาน อัปเดตไฟล์ plan (เช่น `sub-plan-*.md`): ติ๊ก `[x]` พร้อมบันทึกผลลัพธ์ / ข้อที่สรุปว่าไม่ต้องทำจริง
6. Commit message เป็นภาษาไทยรูปแบบ Conventional Commits: `<type>(<scope>): <ใจความภาษาไทย>`

## คำสั่ง (Commands)

- `bun run test` → `bun src-test/test.ts` ไม่มี test framework: ใช้ harness แบบ
  `check(name, fn)` ที่เขียนเอง พิมพ์ `ok - <name>` เมื่อผ่าน เพิ่มเคสด้วยการเรียก
  `check(...)` (ห้ามใช้ `bun test` เฉย ๆ — จะไปรัน bun test runner แล้วไม่เจอ
  `check()`) และห้ามย้าย test ไปใช้ test runner — bun รัน `.ts` ตรง ๆ ได้ไม่ต้อง build
- `bun run example` / `bun run example:image` → demo ที่รันได้ (`example:image`
  ต้องมี package `qrcode` แบบ optional)
- `bun src/cli.ts '<payload>'` (หรือ `bun run decode -- '...'`) → ตัวตรวจสอบ
  decode; exit `0` = CRC ถูกต้อง, `1` = CRC ผิดหรือข้อมูลเสียหาย
- `bun run typecheck` → `tsc -p src-test --noEmit` (strict)
- `bun run build` / `bun run prepare` → `tsc -p .` emit `dist/` (CJS + `.d.ts`)
- Lint/format: ไม่ได้ตั้งค่าไว้

## โครงสร้างและข้อบังคับคงที่ (Structure & invariants)

- `src/index.ts` คือ public surface — export ใหม่เพิ่มที่ไฟล์เดียวนี้
  (tsc emit ลง `dist/` ซึ่งทั้งโฟลเดอร์ถูก ship ตาม array `files` ใน
  `package.json`; ไม่มี per-file list อีกแล้ว)
- **กับดัก CRC:** checksum คำนวณจาก payload *รวม* tag header `6304`
  แบบ literal แล้วค่อยต่อท้าย:
  `payload += '6304' + crc16Hex(payload + '6304')` ห้ามลบ `6304` ทิ้ง
- **การ round-trip แบบ byte-for-byte คือการรับประกันหลัก** ลำดับ tag
  ของแต่ละ generator ถูกตรึงให้ตรงกับ QR ที่ใช้จริงในไทย;
  `generateX(detach(qr))` ต้องสร้าง payload กลับมาเหมือนเดิมทุกไบต์
  (tests assert ข้อนี้) ห้ามสลับลำดับ tag ที่ emit ออกมาโดยพลการ
  ลำดับของ bill payment คือ `00,01,30,58,53,[54],[59],[60],[62],63`
  — สังเกตว่า `58` มาก่อน `53`
- `golden.json` คือ baseline payload จาก JS ก่อนย้ายเป็น TypeScript
  (ตรวจโดย test) — ห้ามแก้ ยกเว้นตั้งใจเปลี่ยน output จริง (major bump)
- `src/image.ts` ใช้ lazy-require `qrcode` *ภายใน* แต่ละฟังก์ชัน ห้ามเปลี่ยนเป็น
  `import` ระดับ top-level (tsc จะ hoist เป็น require ตอนโหลด module ทำให้
  การติดตั้งแบบ zero-dependency พัง)
- ค่า default ต่างกันตาม generator: `generateKShopQR` default เป็น
  **static (POI `11`)** พร้อม amount; `generatePromptPay`/`generateBillPayment`
  เป็น dynamic (POI `12`) เฉพาะเมื่อระบุ `amount` ค่า `innovationAid`
  ของ KShop default เป็นค่าที่พบจริงใน KShop (`A000000677010113`)
  ไม่ใช่ค่าตามเอกสาร BOT (`AID_PAYMENT_INNOVATION_BOT`) — ดู README

## เอกสารอ้างอิง (Reference)

- `docs/promptpay-qr-structure.md` — เจาะลึกโครงสร้าง tag ของ EMVCo / Thai QR

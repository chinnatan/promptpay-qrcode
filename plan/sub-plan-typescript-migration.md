# ปรับไปใช้ TypeScript — แปลง source เป็น `src/*.ts` + build ด้วย tsc โดยคง public surface และ payload byte-for-byte

## Business Goals
- โค้ดทั้งหมดของ repo เป็น TypeScript (source of truth) พร้อม type definition ships ไปกับ npm package
- ผู้ติดตั้งจาก npm ยัง `require('promptpay-qrcode')` แบบ CJS ได้เหมือนเดิม ไม่ breaking
- หลักฐานการ preserve: test suite เดิม (round-trip byte-for-byte กับ QR จริง) ผ่านทั้งก่อนและหลังแปลง โดยห้ามแก้ hardcoded vector

## ขอบเขตที่สำรวจแล้ว (Phase 0)
- library มี 7 ไฟล์ ~600 บรรทัด (`crc`, `promptpay`, `kshop`, `decode`, `image`, `index`, `cli`) + `test.js` (harness `check()`) + example 2 ไฟล์ — ทั้งหมด CJS ไม่มี API เฉพาะ Bun (ใช้แค่ string/math + `fs`/`process` ใน cli)
- มี JSDoc `@param/@returns` อยู่แล้ว ~88 จุด → แปลงเป็น TS type ได้ตรง ๆ ไม่ต้องออกแบบใหม่
- ข้อขัดแย้งกับ AGENTS.md (ดู Appendix ข้อ 1): AGENTS.md ระบุว่า "ไม่มี build, transpile หรือ TypeScript" — requirement นี้คือคำสั่งเปลี่ยน invariant นั้น
- จุดเสี่ยงที่ต้อง preserve ตอนแปลง: (ก) CRC trap `payload += '6304' + crc16Hex(payload + '6304')` (ข) ลำดับ tag ของทุก generator (ค) lazy-require `qrcode` ใน `image.js` — ถ้าเผลอเปลี่ยนเป็น `import` ระดับ top-level จะ compile เป็น require ตอนโหลด module และพัง zero-dep install
- งานเป็น migration → ใช้หลัก expand → verify → contract: เก็บ golden payload จาก JS ปัจจุบันก่อน แล้วค่อยลบ `.js` ต้นฉบับทิ้งเมื่อ dist ผ่าน test เทียบ golden

## Phase 1: ตั้งค่า toolchain (ยังไม่แตะโค้ด)
### dependencies + scripts
- [x] สร้าง branch `feature/typescript-migration` จาก `develop` ตาม git flow
- [x] เพิ่ม devDependencies `typescript` + `@types/node` (dev-only ไม่ติดไปกับ package ที่ ship)
- [x] เพิ่ม `tsconfig.json`: `module: commonjs`, `declaration: true`, `strict: true`, `rootDir: src`, `outDir: dist`
- [x] เพิ่ม scripts: `typecheck` (`tsc --noEmit`), `build` (`tsc`), `prepare` (`tsc` สำหรับ npm publish) และ gitignore `dist/`
### golden baseline
- [x] เขียน `golden-capture.js` ชั่วคราว รันโค้ด JS ปัจจุบัน sinh payload ทุก generator (P2P มี/ไม่มี amount, bill payment, KShop) ออกเป็น `golden.json` แล้ว commit ไว้เทียบผลหลังแปลง

## Phase 2: แปลง source เป็น TypeScript
### โมดูล core (ไม่แตะลำดับ tag / CRC trap)
- [x] `src/crc.ts` — แปลงตรงตัว จากระบุ type `string → number → string`
- [x] `src/promptpay.ts` — แปลงจาก JSDoc, ใส่ interface `PromptPayConfig` / `BillPaymentConfig`
- [x] `src/kshop.ts` — แปลงจาก JSDoc, ใส่ interface `KShopConfig`,คง default `innovationAid` = `A000000677010113`
- [x] `src/decode.ts` — แปลง `decode/parseTLV/detach/detectType/channels/kshopParamsFrom` พร้อม return type
### โมดูล surface + CLI
- [x] `src/image.ts` — คง lazy-require ภายในฟังก์ชัน (ใช้ `createRequire`/inline `require` ไม่ใช่ top-level import), `qrcode` เป็น optional ให้ type แบบ lazy-safe
- [x] `src/index.ts` — re-export ให้ชื่อ/หน้า export ตรงกับ `index.js` เดิมทุกตัว
- [x] `src/cli.ts` — แปลงคง shebang `#!/usr/bin/env bun` (ผ่านการ compile) และ exit code 0/1 semantics
- [x] ลบ `.js` ต้นฉบับของไฟล์ที่แปลงแล้ว (contract step — ทำหลัง dist ผ่าน golden เทียบใน Phase 5 เท่านั้น)

## Phase 3: แปลง test + example
### test (หลักฐาน preserve)
- [x] แปลง `test.js` → `src-test/test.ts` คง harness `check(name, fn)` ห้ามย้ายไป bun test runner, ห้ามแก้ QR vector ที่ hardcoded
- [x] อัปเดต `scripts.test` → `bun src-test/test.ts` (bun รัน TS ตรง ๆ ได้ ไม่ต้อง build)
- [x] เพิ่ม 1 เคสอบ证明文件ใหม่: เทียบ payload ทุกตัวใน suite กับ `golden.json` (byte-for-byte)
### examples
- [x] แปลง `example.js` / `example-image.js` เป็น TS ใต้ `src-test/` อัปเดต scripts ให้ตรง

## Phase 4: แพ็กเกจ layout + เอกสาร
### package.json (publish surface)
- [x] ชี้ `main` → `dist/index.js`, เพิ่ม `types` → `dist/index.d.ts`, `bin` → `dist/cli.js`
- [x] เปลี่ยน array `files` → `["dist", "docs/promptpay-qr-structure.md", "README.md", "LICENSE"]`
- [x] bump version เป็น major (2.x → 3.0.0) เพราะเปลี่ยน packaging layout
### เอกสาร
- [x] README: อัปเดตส่วน install/usage ที่อ้างไฟล์ `.js` และเพิ่มหมายเหตุเรื่อง types
- [x] AGENTS.md: แก้ invariant ที่ขัดกัน (ข้อ 1 Appendix) — "ไม่มี build/transpile/TypeScript", "export ใหม่ต้องเพิ่มทั้งใน index.js และ files[]", เพิ่ม `bun run typecheck`/`bun run build` ใน Commands
- [x] `docs/promptpay-qr-structure.md` — ตรวจว่าไม่อ้าง path ของไฟล์ `.js` ที่ย้ายไปแล้ว

## Phase 5: Review & Quality Assurance
- [x] `bun run typecheck` ผ่าน (strict)
- [x] `bun src-test/test.ts` ผ่านครบ ≥ 62 checks + golden เทียบ matches
- [x] `bun run build` แล้วรัน `bun dist/cli.js '<payload จริง>'` → exit 0; payload CRC ผิด → exit 1
- [x] `bun run example` / `bun run example:image` ผ่านจาก source
- [x] smoke test ผู้ใช้ CJS จริง: `node -e "require('./dist')"` ที่ `bun link` หรือ `npm pack --dry-run` แล้วติดตั้งในโฟลเดอร์ว่าง → `require('promptpay-qrcode').generatePromptPay(...)` ได้ payload ตรง golden
- [x] rollback path ชัด: tagged v2.0.0 คงอยู่, `golden.json` ยังอยู่ใน repo จนกว่าจะยืนยันผ่าน (เก็บต่อหรือลบแยก commit)

## Appendix — ผลสำรวจ + จุดที่ต้องให้ user ตัดสิน

### ข้อ 1 (บังคับ): ขัดแย้งกับ AGENTS.md
AGENTS.md ระบุ "ไลบรารี Bun แบบไม่มี dependency ... ไม่มี build, transpile หรือ TypeScript" และ invariant "export ใหม่ต้องเพิ่มทั้งใน index.js และ files[]" — การไป TypeScript ขัดโดยตรง ถือว่า requirement นี้มาแทนที่ จึงใส่ task แก้ AGENTS.md ใน Phase 4 ไว้แล้ว (ถ้า user ไม่ต้องการ ให้ตอบ A)

### จุดที่ต้องเลือก

| ข้อ | ตัวเลือก A (แนะนำ) | ตัวเลือก B |
|---|---|---|
| ความลึกของการแปลง | แปลง source เป็น TS ทั้งหมด + build CJS/d.ts ลง `dist/` (plan นี้) | types-only: คง `.js` ไว้ เขียน `.d.ts` ประกอบ — ไม่ต้องมี build แต่ repo ยังไม่ใช่ TS จริง |
| emit layout | `dist/` + เปลี่ยน `main`/`files` (มาตรฐาน npm library) | emit `.js` ทับที่ root เดิม path คงเดิมเป๊ะ แต่ generated ไฟล์ปนใน repo |
| strictness | `strict: true` ตั้งแต่ต้น (~600 บรรทัด แก้น้อย) | `strict: false` แล้วค่อย ๆ siกระชับทีหลัง |
| test runtime | `bun src-test/test.ts` (bun รัน TS native ไม่ต้อง build) | build ก่อนแล้วรัน test compiled — ช้ากว่าตอน dev |

### ผลสำรวจ export surface (สำหรับตรวจ Phase 2)
`crc16Ccitt, crc16Hex, generatePromptPay, generateBillPayment, formatMobile, generateKShopQR, KSHOP_DEFAULTS, AID_PAYMENT_INNOVATION, AID_PAYMENT_INNOVATION_BOT, decode, parseTLV, kshopParamsFrom, detach, detectType, channels, image, toFile, toDataURL, toBuffer, toSVG, toTerminal` — 21 ตัวต้องคงชื่อครบใน `dist/index.js`

## ผลลัพธ์สรุป (2026-09-20)
- source ทั้งหมดเป็น `src/*.ts` (strict), test/example อยู่ที่ `src-test/` รันด้วย bun โดยไม่ต้อง build
- หลักฐาน preserve: 63/63 checks ผ่าน = 62 เคสเดิม (port จาก test.js แบบ mechanical, logic เดิม) + golden check 14/14 byte-for-byte เทียบกับ `golden.json` ที่ capture จาก JS ก่อนย้าย
- ผู้ใช้จริงยืนยันแล้ว: `npm pack` → ติดตั้งในโฟลเดอร์ว่าง → `node -e require('promptpay-qrcode')` → ตรง golden + `qrcode` ยัง lazy-load (บรรทัด require อยู่ใน function หลัง compile)
- v3.0.0 บน branch `feature/typescript-migration` (3 commits: toolchain → src+test → packaging+ลบ JS)
- golden.json เก็บไว้ถาวรเป็น baseline; rollback = merge develop ที่ tag v2.0.0

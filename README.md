# promptpay-qrcode

สร้าง **payload ของ QR PromptPay / Thai EMVCo** ด้วย JavaScript/TypeScript แบบ **ไม่มี dependency** — รันบน [Bun](https://bun.sh) (หรือ Node ก็ได้) พร้อมเครื่องมือถอด QR กลับเป็นข้อมูลโครงสร้าง

ผลลัพธ์ของแต่ละฟังก์ชันคือ **payload string** ซึ่งคุณนำไป encode เป็นรูปภาพ QR ต่อได้ทันที (หรือใช้ [helper สร้างรูปภาพ](#สร้างเป็นรูปภาพ-ไม่บังคับ) ที่มีมาให้)

## เริ่มใช้ใน 30 วินาที

```
bun add promptpay-qrcode
```

```js
const { generatePromptPay } = require('promptpay-qrcode');

// ได้ payload พร้อมส่งไป render เป็นรูป QR
const payload = generatePromptPay({ mobile: '0812345678', amount: 100 });
```

อยากสแกนทดสอบก่อน? ใช้ CLI ในตัว:

```
bunx promptpay-qr '00020101...'   # หรือถ้า clone repo มา: bun run decode -- '00020101...'
```

## เลือกฟังก์ชันไหนดี?

| คุณมีข้อมูลอะไร | ใช้ฟังก์ชัน | ประเภท QR |
| --- | --- | --- |
| เบอร์โทร / เลขบัตรประชาชน / เลขผู้เสียภาษี / e-wallet ID | [`generatePromptPay`](#promptpay-มาตรฐาน-tag-29) | PromptPay มาตรฐาน (Tag 29) |
| Biller ID + reference เลขที่จากธนาคาร (สไตล์แม่มณี / SCB) | [`generateBillPayment`](#bill-payment-tag-30) | Bill Payment (Tag 30) |
| ข้อมูลบัญชี KShop จากธนาคาร หรือมี master QR ของ KShop อยู่แล้ว | [`generateKShopQR`](#kshop) | KShop (Tag 30 + 31) |

มี `decode()` และเครื่องมือถอด QR กลับเป็นข้อมูล — ดู [ถอดข้อมูล QR](#ถอดข้อมูล-qr)

ไลบรารีเขียนด้วย TypeScript, มี `.d.ts` ครบทุกฟังก์ชัน และส่วนสร้างรูปภาพเป็น peer dependency แบบไม่บังคับ (ติดตั้งเฉพาะเมื่อต้องการ)

> เจาะลึกโครงสร้าง tag ของ EMVCo / Thai QR: [`docs/promptpay-qr-structure.md`](docs/promptpay-qr-structure.md)

## PromptPay มาตรฐาน (Tag 29)

ใช้กับ QR พร้อมเพย์มาตรฐาน (P2P — เบอร์โทร/เลขบัตรประชาชน/e-wallet ของผู้รับ) ได้แรงบันดาลใจจาก [saladpuk/PromptPay](https://github.com/saladpuk/PromptPay)

```js
generatePromptPay({ mobile: '0812345678' });              // static (ไม่มีจำนวนเงิน)
generatePromptPay({ mobile: '0812345678', amount: 100 }); // dynamic, 100.00 บาท
generatePromptPay({ nationalId: '1234567890123' });
generatePromptPay({ ewallet: '123456789012345', amount: 50.25 });
```

| พารามิเตอร์ | บังคับ? | คำอธิบาย |
| --- | --- | --- |
| `mobile` / `nationalId` / `ewallet` | ระบุ **อย่างใดอย่างหนึ่งเท่านั้น** | ตัวระบุผู้รับ |
| `amount` | ไม่ | จำนวนเงิน (บาท) — ระบุแล้ว QR เป็น dynamic (POI `12`) ตามค่าเริ่มต้น, ไม่ระบุเป็น static (POI `11`) |
| `dynamic` | ไม่ | บังคับแบบใดแบบหนึ่งเอง |

```js
generatePromptPay({ mobile: '0812345678', amount: 100, dynamic: false }); // static พร้อมจำนวนเงิน
generatePromptPay({ mobile: '0812345678', dynamic: true });               // dynamic โดยไม่มีจำนวนเงิน
```

เบอร์โทรจะถูก normalize เป็น proxy 13 ตัวอักษรอัตโนมัติ (`0812345678` → `0066812345678`)

## Bill Payment (Tag 30)

ใช้เมื่อมี **Biller ID + reference** ที่ธนาคารออกให้ — รูปร่างเดียวกับ QR "bill payment" ของร้านค้าอย่าง **แม่มณี (Mae Manee)** ของ SCB และ QR ร้านค้าลักษณะใกล้เคียง (แอปฝั่งผู้จ่ายเงินจะแสดงชื่อร้านค้าจาก tag 59/60)

```js
generateBillPayment({
  billerId: '000000000000000', // Biller ID จากธนาคาร (มักเป็น 15 หลัก) — บังคับ
  ref1:     'INV20240001',     // Reference 1 — บังคับ
  ref2:     'BRANCH01',        // Reference 2 — ไม่บังคับ
  amount:   50,                // ระบุ => dynamic QR (POI 12) ตามค่าเริ่มต้น
});
```

| พารามิเตอร์เสริม | คำอธิบาย |
| --- | --- |
| `dynamic` | บังคับค่า POI (`true` = `'12'`, `false` = `'11'`) |
| `merchantName` / `merchantCity` | ชื่อ/เมืองร้านค้า (tag 59 / 60) |
| `additionalData` | raw tag 62 (เช่น sub-TLV ของ label เครื่อง) |
| `countryCode` | tag 58, ค่าเริ่มต้น `'TH'` |

<details>
<summary>Round-trip ตรงกันทุกไบต์กับ QR จริงในไทย</summary>

ลำดับ tag ตรงกับ QR bill payment ที่ใช้จริงในไทย (`00,01,30,58,53,…,62,63` — สังเกตว่า `58` มาก่อน `53`) ทำให้ QR bill payment ที่ decode แล้ว `generateBillPayment({ ...account, ...transaction })` จากผลของ `detach()` จะสร้าง payload เดิมกลับมา **เหมือนกันเป๊ะทุกไบต์** (รวม tag-62 terminal label ของมันด้วย)

Biller ID และ reference ออกให้/กำหนดโดยธนาคารของคุณ (สำหรับ SCB คือ แม่มณี / Business QR)

</details>

## KShop

QR ร้านค้ารูปแบบ KShop (Tag 30 + Tag 31) ไลบรารีนี้ **ไม่แนบข้อมูลร้านค้าใด ๆ มาให้** — field ที่ใช้ระบุตัวตนบัญชี (`billerId`, `merchantRef`, `merchantName`, `merchantCity`) เป็นค่าบังคับ ซึ่งธนาคารจะเป็นผู้ออกให้ และ `generateKShopQR` จะ throw ถ้าขาดตัวใดตัวหนึ่ง

```js
const config = {
  billerId:     '000000000000000', // Biller ID จากธนาคาร             (บังคับ)
  merchantRef:  'KB000000000000',  // merchant reference ของธนาคาร    (บังคับ)
  merchantName: 'MY SHOP',         // tag 59                           (บังคับ)
  merchantCity: 'BANGKOK',         // tag 60                           (บังคับ)
};

generateKShopQR(100, 'ORDER0000000001', config);                       // static (POI '11') — ค่าเริ่มต้น
generateKShopQR(100, 'ORDER0000000001', { ...config, dynamic: true }); // dynamic (POI '12')
```

`amount` (อาร์กิวเมนต์ที่ 1) และ `reference` (อาร์กิวเมนต์ที่ 2 — ref ต่อออเดอร์ วางใน tag 30/03 และ 31/04) เปลี่ยนได้ตามแต่ละ call

พารามิเตอร์ไม่บังคับ (จะ emit เมื่อระบุค่าเท่านั้น): `visaTemplate`, `mastercardTemplate`, `unionpayTemplate`, `cardScheme`, `mcc`, `additionalData`, `dynamic` (ค่าเริ่มต้น `false`), `innovationSubId` (ค่าเริ่มต้น `'004'`), `innovationAid` — ส่วน default เชิงโครงสร้าง (`dynamic: false`, `currency: '764'`, `countryCode: 'TH'`, `innovationSubId: '004'`) อยู่ใน `KSHOP_DEFAULTS` และรายการ field บังคับอยู่ใน `REQUIRED_FIELDS`

> **Static vs dynamic — สำคัญกับแอปธนาคาร** KShop เริ่มต้นเป็น **static (POI `11`) พร้อมจำนวนเงิน** เพราะรูปแบบนี้ถูกยอมรับโดยแอปจำนวนมากที่สุด รวมถึง **K PLUS** และแอป KShop จากการทดสอบบนเครื่องจริง ส่วน **dynamic (POI `12`) ถูก K PLUS ปฏิเสธ** สำหรับ QR ร้านค้ากลุ่มนี้ (แม้จะใช้ได้ใน SCB, KTB Next, BBL และ UOB) — ส่ง `dynamic: true` เมื่อคุณตั้งใจเล็งแอปที่รับ POI `12` เป็นกรณีพิเศษเท่านั้น

ถ้ามี master QR ของบัญชีอยู่แล้ว ไม่ต้องกรอก config เอง — ใช้ [`kshopParamsFrom(qr)`](#โคลนบัญชี-kshop-จาก-master-qr) ดึง field ทั้งหมดออกมาให้

<details>
<summary>Tag 31 AID (<code>innovationAid</code>) — ค่าเริ่มต้นไม่ใช่ตามเอกสาร BOT</summary>

แนวทางของธนาคารกลางไทย (BOT) ระบุ `A000000677012004` สำหรับ Payment-Innovation template แต่ **QR ของ KBank/KShop ที่พบจริงใช้ `A000000677010113`** ไลบรารีจึงใช้ค่าแบบ KShop เป็นค่าเริ่มต้นเพื่อให้ QR KShop จริง round-trip ได้ตรงเป๊ะ

export ทั้งสองค่า: `AID_PAYMENT_INNOVATION` (KShop, ค่าเริ่มต้น) และ `AID_PAYMENT_INNOVATION_BOT` (BOT) — override ได้ด้วย `innovationAid`:

```js
const { generateKShopQR, AID_PAYMENT_INNOVATION_BOT } = require('promptpay-qrcode');
generateKShopQR(100, 'ORDER1', { ...config, innovationAid: AID_PAYMENT_INNOVATION_BOT });
```

`detach`/`kshopParamsFrom` จะจับค่าที่ QR ต้นทางใช้ไว้ให้อัตโนมัติ

</details>

## ถอดข้อมูล QR

### `decode(payload)`

parse ข้อความ EMVCo / PromptPay / Thai QR ใด ๆ เป็น field แบบมีโครงสร้าง พร้อมตรวจสอบ CRC (throw ถ้า payload ผิดรูป เช่น ความยาวที่ประกาศเกินความยาว string):

```js
const { decode } = require('promptpay-qrcode');

const d = decode(masterQrString);
d.amount;        // 100        (null ถ้าไม่มี)
d.merchantName;  // 'MY SHOP'
d.poiMethod;     // '12'  (d.static === false)
d.crc.valid;     // true  -> checksum ของ QR ถูกต้อง
d.fields['30'];  // { '00': 'A000000677010112', '01': '000000000000000', ... }
d.tags;          // ordered [{ id, length, value }] ของระดับบนสุด
```

### `detach(qr)` — แยก QR ใดก็ได้เป็น "บัญชี" + "ต่อรายการ"

ตรวจจับประเภท QR อัตโนมัติ แยกเป็นข้อมูลที่ **ใช้ซ้ำได้** (account) กับค่า **ต่อ call** (transaction) — ใช้ได้กับทั้งสามตระกูล:

| `type` | `account` (ใช้ซ้ำได้) | `transaction` (ต่อ call) | สร้างใหม่ด้วย |
| --- | --- | --- | --- |
| `'promptpay'` | `{ mobile \| nationalId \| ewallet }` | `{ amount, dynamic }` | `generatePromptPay({ ...account, ...transaction })` |
| `'billpayment'` | `{ billerId, merchantName?, merchantCity? }` | `{ ref1, ref2?, amount, dynamic }` | `generateBillPayment({ ...account, ...transaction })` |
| `'kshop'` | config KShop เต็ม | `{ amount, reference }` | `generateKShopQR(transaction.amount, transaction.reference, account)` |

```js
const { detach, generateBillPayment } = require('promptpay-qrcode');

const { type, account, transaction } = detach(masterBillQr);

// ตัวอย่าง: ออก QR bill payment ใหม่ด้วยจำนวนเงินใหม่ ใช้บัญชีเดิม
const next = generateBillPayment({ ...account, ref1: 'INV2', amount: 75 });
```

เบอร์ mobile proxy ถูกแปลงกลับ (`0066812345678` → `0812345678`) เพื่อให้ round-trip ผ่าน `generatePromptPay` ได้, `detach` รับทั้ง payload string หรือผลจาก `decode()` ก่อนหน้า และคืนอ็อบเจกต์ `decoded` เต็ม ๆ ด้วย (ถ้าต้องการแค่ประเภทอย่างเดียว ใช้ `detectType(fields)`)

### โคลนบัญชี KShop จาก master QR

`kshopParamsFrom(qr)` คือกรณีเฉพาะ KShop ของ `detach` — ดึง field ที่ใช้ระบุตัวตนบัญชีออกมาพอดีกับที่ต้องส่งให้ `generateKShopQR`:

```js
const { kshopParamsFrom, generateKShopQR } = require('promptpay-qrcode');

const params = kshopParamsFrom(masterQr);
// { billerId, merchantRef, merchantName, merchantCity, additionalData,
//   visaTemplate, mastercardTemplate, unionpayTemplate, cardScheme,
//   innovationSubId, mcc, currency, countryCode, dynamic }  (เฉพาะที่มีอยู่)

const qr = generateKShopQR(250.5, 'ORDER123', params);
```

ค่าต่อรายการ (`amount`, order reference) จะ **ไม่** อยู่ใน `params` — ระบุเองในแต่ละ call; `generateKShopQR(amount, ref, kshopParamsFrom(qr))` จะสร้าง master QR เดิมกลับมาตรงกันทุกไบต์เมื่อให้ amount และ ref เดิม

### `channels(qr)` — ตรวจจับช่องทางชำระเงินที่รองรับ

QR KShop/ร้านค้าจะมี template แยกต่อช่องทางที่ลงทะเบียนไว้ ถ้าไม่มี template ใด = ช่องทางนั้นไม่ได้เปิดให้ใช้:

```js
const { channels } = require('promptpay-qrcode');

channels(kshopQr);
// {
//   promptpay: true,
//   creditCard: true,                       // false หากร้านค้าไม่รับบัตรเครดิต
//   networks: ['visa', 'mastercard', 'unionpay'],
//   promptpayTemplates: ['30', '31'],
//   cardTemplates: ['02', '04', '15', '51'],
// }
```

`detach(qr)` ก็รวมข้อมูลนี้ไว้ใต้ `.channels` ด้วย

<details>
<summary>หลักการตรวจจับ และขีดจำกัดของข้อมูลนี้</summary>

ฝั่ง PromptPay ตรวจจับจาก tag `29`/`30`/`31`; เครือข่ายบัตรเครดิตตรวจจับจากช่วง EMVCo template (`02`–`16`) และจาก card RID ในช่วง generic `26`–`51`

ข้อมูลนี้สะท้อนเฉพาะสิ่งที่ร้านค้า **ลงทะเบียนไว้** (capability ที่ QR โฆษณาไว้) ส่วนบัตรใบใดจะอนุมัติได้จริงหรือไม่ต้องแล้วแต่ acquirer ตอน settlement

</details>

## CLI inspector

มี command-line inspector ขนาดเล็กแนบมาในแพ็กเกจ — decode payload, ตรวจ CRC, แสดงการแยก account/transaction พร้อม tag dump ทั้งหมดรันในเครื่อง ไม่มีข้อมูลใดออกจากเครื่องคุณ:

```
# จากใน repo
bun src/cli.ts '0002010101021130...C9ED'
bun run decode -- '00020101...'

# ติดตั้งแบบ global (bun add -g promptpay-qrcode)
promptpay-qr '00020101...'

# pipe เข้าไป หรือขอ JSON ดิบ
echo '00020101...' | promptpay-qr
promptpay-qr --json '00020101...'
```

ตัวอย่าง output:

```
Type      : kshop
CRC       : C9ED  ✓ valid
POI       : 11  (static — K PLUS compatible)
Amount    : (none — payer enters)
Merchant  : MY SHOP / CITY

Account (reusable):    { billerId, merchantRef, merchantName, ... }
Transaction (per-call): { amount, reference }

Tags:
00 02 01
01 02 11
30 81
   00 16 A000000677010112
   ...
```

exit code เป็น `0` เมื่อ CRC ถูกต้อง และ `1` เมื่อ payload ผิดรูป/ไม่ถูกต้อง — สะดวกสำหรับใช้ในสคริปต์

## สร้างเป็นรูปภาพ (ไม่บังคับ)

ส่วนหลักไม่มี dependency — ถ้าต้องการแปลง payload เป็นรูปภาพ QR จริง ติดตั้งแพ็กเกจ [`qrcode`](https://www.npmjs.com/package/qrcode) (optional peer dependency) ก่อน:

```
bun add qrcode
```

จากนั้นใช้ helper ที่มีมา — มันจะ lazy-load `qrcode` และ reject พร้อมข้อความชัดเจนถ้ายังไม่ได้ติดตั้ง:

```js
const { generatePromptPay, toFile, toDataURL, toSVG, toBuffer, toTerminal } = require('promptpay-qrcode');

const payload = generatePromptPay({ mobile: '0812345678', amount: 100 });

await toFile('qr.png', payload, { width: 300, margin: 2 }); // ไฟล์ PNG
const url = await toDataURL(payload);                        // data:image/png;base64,...
const svg = await toSVG(payload);                            // SVG markup string
const buf = await toBuffer(payload);                         // PNG Buffer
console.log(await toTerminal(payload));                      // QR สแกนได้ใน terminal
```

options ตัวท้ายถูกส่งต่อไปยัง `qrcode` ตรง ๆ (`width`, `margin`, `color`, `errorCorrectionLevel`, …) ดูเดโมเต็มที่ `src-test/example-image.ts` (`bun run example:image`)

## สรุป API

| ฟังก์ชัน | คืนค่า |
| --- | --- |
| `generatePromptPay({ mobile \| nationalId \| ewallet, amount?, dynamic? })` | payload string |
| `generateBillPayment({ billerId, ref1, ref2?, amount?, dynamic?, merchantName?, merchantCity?, additionalData?, countryCode? })` | payload string |
| `generateKShopQR(amount, reference, config)` | payload string |
| `KSHOP_DEFAULTS` / `REQUIRED_FIELDS` | default เชิงโครงสร้าง KShop / รายการ field บังคับ |
| `AID_PAYMENT_INNOVATION` / `AID_PAYMENT_INNOVATION_BOT` | ค่า Tag 31 AID (KShop / BOT) |
| `decode(payload)` | decode แบบมีโครงสร้าง + ตรวจสอบ CRC |
| `parseTLV(payload)` | `[{ id, length, value }]` เรียงลำดับตามใน payload |
| `kshopParamsFrom(qr)` | พารามิเตอร์บัญชีสำหรับโคลน master QR ของ KShop |
| `detach(qr)` | `{ type, account, transaction, channels, decoded }` ของ QR ทุกประเภท |
| `detectType(fields)` | `'promptpay'` \| `'billpayment'` \| `'kshop'` \| `'unknown'` |
| `channels(qr)` | `{ promptpay, creditCard, networks, promptpayTemplates, cardTemplates }` |
| `crc16Ccitt(str)` / `crc16Hex(str)` | CRC16-CCITT (number / hex 4 ตัวอักษร) |
| `formatMobile(str)` | mobile proxy PromptPay 13 ตัวอักษร |
| `toFile(path, payload, opts?)` | `Promise<void>` — เขียนไฟล์ PNG *(ต้องมี `qrcode`)* |
| `toDataURL(payload, opts?)` | `Promise<string>` — data URL *(ต้องมี `qrcode`)* |
| `toBuffer(payload, opts?)` | `Promise<Buffer>` — PNG buffer *(ต้องมี `qrcode`)* |
| `toSVG(payload, opts?)` | `Promise<string>` — SVG markup *(ต้องมี `qrcode`)* |
| `toTerminal(payload, opts?)` | `Promise<string>` — QR ใน terminal *(ต้องมี `qrcode`)* |
| `image` | อ็อบเจกต์รวม helper รูปภาพทั้งห้า `{ toFile, toDataURL, toBuffer, toSVG, toTerminal }` |

## สำหรับผู้พัฒนา

```
bun run test        # src-test/test.ts รันบน Bun ตรง ๆ ไม่ต้อง build
bun run typecheck   # tsc -p src-test --noEmit
bun run build       # emit dist/ CJS + .d.ts
```

> อย่าใช้ `bun test` เฉย ๆ — harness ใน repo เป็น `check()` แบบ custom ต้องรันตรงเป็นไฟล์ มิฉะนั้น bun จะใช้ test runner ของตัวเองแล้วไม่เจอเคส

test ครอบคลุม: CRC กับ vector `123456789 → 0x29B1`, ความสมมาตรของการซ้อน TLV, โครงสร้าง Tag 29 / Tag 30 / KShop, การ decode + ตรวจสอบ CRC, และ round-trip จาก `kshopParamsFrom` → `generateKShopQR` เทียบ `golden.json` (baseline payload จากเวอร์ชัน JS ก่อนย้ายเป็น TypeScript, ใช้เทียบ byte-for-byte — ห้ามแก้ยกเว้นตั้งใจเปลี่ยน output จริง)

โครงสร้าง source:

- `src/crc.ts` — CRC16-CCITT (init 0xFFFF, poly 0x1021)
- `src/promptpay.ts` — ตัวสร้าง PromptPay มาตรฐาน (Tag 29) + bill payment (Tag 30)
- `src/kshop.ts` — ตัวสร้าง KShop (ปรับตั้งค่าได้ ไม่แนบข้อมูลร้านค้า)
- `src/decode.ts` — decode/parse payload + `kshopParamsFrom`/`detach`/`channels`
- `src/image.ts` — helper รูปภาพแบบไม่บังคับ (lazy-load `qrcode`)
- `src/cli.ts` — command-line inspector (`promptpay-qr` / `bun run decode`)
- `src/index.ts` — public entry point
- `src-test/` — `test.ts`, `example.ts`, `example-image.ts`

## License

MIT — ดู [LICENSE](LICENSE)

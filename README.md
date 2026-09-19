# promptpay-qrcode

ไลบรารีแบบไม่มี dependency สำหรับรันบน [Bun](https://bun.sh) — ใช้สร้าง **payload string ของ QR PromptPay**
(ข้อความ EMVCo / Thai QR ที่ต้องเอาไป encode เป็นรูปภาพ QR) มีตัวสร้าง 3 ตัว
พร้อม decoder:

1. **PromptPay มาตรฐาน** (Tag 29) — หมายเลขโทรศัพท์, บัตรประชาชน/เลขผู้เสียภาษี
   หรือ e-wallet ID ได้แรงบันดาลใจจาก
   [saladpuk/PromptPay](https://github.com/saladpuk/PromptPay)
2. **Bill Payment** (Tag 30) — Biller ID + reference จำนวน QR กลุ่ม
   "bill payment" ของร้านค้า รูปร่างเดียวกับที่ QR ของ **แม่มณี (Mae Manee)** ของ SCB
   และ QRร้านค้าที่ลักษณะใกล้เคียงกันใช้ (แอปฝั่งผู้จ่ายเงินจะแสดงชื่อร้านค้า)
3. **KShop** — QRร้านค้ารูปแบบ KShop (Tag 30 + Tag 31) คุณต้องระบุ field
   ที่ระบุตัวตนบัญชีด้วยเอง ห้องสมุดไม่แนบข้อมูลร้านค้าใด ๆ มาให้

พร้อม `decode()` สำหรับอ่าน QR PromptPay/Thai QR กลับเป็น field แบบมีโครงสร้าง

ดู [`docs/promptpay-qr-structure.md`](docs/promptpay-qr-structure.md) สำหรับ
คำอธิบายเจาะลึกโครงสร้าง tag ของ EMVCo / Thai QR

ผลลัพธ์คือ **payload string เท่านั้น** — ส่งต่อไปยังไลบรารี QR ใดก็ได้
หรือใช้ helper สร้างรูปภาพที่มีมาให้ (ดู [สร้างเป็นรูปภาพ](#สร้างเป็นรูปภาพ-ไม่บังคับ))

## ติดตั้ง

```
bun add promptpay-qrcode
```

ส่วนหลัก **ไม่มี dependency** ส่วนสร้างรูปภาพใช้ peer dependency แบบไม่บังคับคือ
`qrcode` (ติดตั้งเฉพาะเมื่อต้องการรูปภาพ)

```js
const { generatePromptPay, generateBillPayment, generateKShopQR } = require('promptpay-qrcode');
```

## PromptPay มาตรฐาน (Tag 29)

```js
generatePromptPay({ mobile: '0812345678' });              // static (ไม่มีจำนวนเงิน)
generatePromptPay({ mobile: '0812345678', amount: 100 }); // dynamic, 100.00 บาท
generatePromptPay({ nationalId: '1234567890123' });
generatePromptPay({ ewallet: '123456789012345', amount: 50.25 });
```

ระบุ `mobile`, `nationalId` หรือ `ewallet` **อย่างใดอย่างหนึ่งเท่านั้น** โดยค่า
เริ่มต้น QR จะเป็น dynamic (POI `12`) เมื่อระบุ `amount` และเป็น static (POI `11`)
เมื่อไม่ระบุ ส่ง `dynamic: true | false` เพื่อบังคับแบบใดแบบหนึ่ง:

```js
generatePromptPay({ mobile: '0812345678', amount: 100, dynamic: false }); // static พร้อมจำนวนเงิน
generatePromptPay({ mobile: '0812345678', dynamic: true });               // dynamic โดยไม่มีจำนวนเงิน
```

หมายเลขโทรศัพท์จะถูก normalize เป็นรูป proxy 13 ตัวอักษร
(`0812345678` → `0066812345678`)

## Bill Payment (Tag 30) — สไตล์แม่มณี / QRร้านค้า SCB

```js
generateBillPayment({
  billerId: '000000000000000', // Biller ID จากธนาคาร (มักเป็น 15 หลัก)
  ref1: 'INV20240001',         // Reference 1 (บังคับ)
  ref2: 'BRANCH01',            // Reference 2 (ไม่บังคับ)
  amount: 50,                  // ไม่บังคับ; ระบุ => เป็น dynamic QR (POI 12) ตามค่าเริ่มต้น
  dynamic: true,               // ไม่บังคับ; บังคับค่า POI (true='12', false='11')
  merchantName: 'MY SHOP',     // ไม่บังคับ (tag 59)
  merchantCity: 'BANGKOK',     // ไม่บังคับ (tag 60)
  additionalData: '07160000…', // ไม่บังคับ raw tag 62 (เช่น sub-TLV ของ label เครื่อง)
  countryCode: 'TH',           // ไม่บังคับ (tag 58, ค่าเริ่มต้น 'TH')
});
```

ลำดับ tag ตรงกับ QR bill payment ที่ใช้จริงในไทย (`00,01,30,58,53,…,62,63` —
สังเกตว่า `58` มาก่อน `53`) ทำให้ QR bill payment ที่ decode แล้ว
round-trip กลับได้ **ตรงกันทุกไบต์**:
`generateBillPayment({ ...account, ...transaction })` จากผลของ `detach()` ของ QR
SCB/แม่มณี จะสร้าง payload เดิมกลับมาได้เหมือนกันเป๊ะ (รวม tag-62 terminal label
ของมันด้วย)

Biller ID และ reference ออกให้/กำหนดโดยธนาคารของคุณ (สำหรับ SCB คือ แม่มณี /
Business QR) `ref1` จำเป็นต้องใส่; `ref2` ไม่บังคับ

## KShop

QRร้านค้ารูปแบบ KShop (Tag 30 + Tag 31) ไลบรารีนี้ **ไม่แนบข้อมูลร้านค้าใด ๆ**
คุณต้องระบุ field ที่ใช้ระบุตัวตนบัญชีด้วยเอง ซึ่งธนาคารจะเป็นผู้ออกให้
`billerId`, `merchantRef`, `merchantName` และ `merchantCity` เป็นค่าบังคับ
`generateKShopQR` จะ throw ถ้าขาดตัวใดตัวหนึ่ง

```js
const config = {
  billerId:     '000000000000000', // Biller ID จากธนาคาร       (บังคับ)
  merchantRef:  'KB000000000000',  // merchant reference ของธนาคาร (บังคับ)
  merchantName: 'MY SHOP',         // tag 59                    (บังคับ)
  merchantCity: 'BANGKOK',         // tag 60                    (บังคับ)
  // ไม่บังคับ — จะถูก emit เมื่อระบุค่าเท่านั้น:
  // visaTemplate, mastercardTemplate, unionpayTemplate, cardScheme,
  // mcc, additionalData, dynamic (ค่าเริ่มต้น false), innovationSubId (ค่าเริ่มต้น '004'),
  // innovationAid (tag 31 AID — ค่าเริ่มต้นแบบ KShop; ดูด้านล่าง)
};

generateKShopQR(100, 'ORDER0000000001', config);                       // static  (POI '11') — ค่าเริ่มต้น
generateKShopQR(100, 'ORDER0000000001', { ...config, dynamic: true }); // dynamic (POI '12')
```

`amount` (อาร์กิวเมนต์ที่ 1) และ `reference` (อาร์กิวเมนต์ที่ 2 — ref ต่อออเดอร์ที่
วางใน tag 30/03 และ 31/04) เปลี่ยนได้ตามแต่ละ call ส่วน default เชิงโครงสร้าง
(`dynamic: false`, `currency: '764'`, `countryCode: 'TH'`,
`innovationSubId: '004'`) อยู่ใน `KSHOP_DEFAULTS`; รายการ field บังคับอยู่ใน
`REQUIRED_FIELDS`

> **Tag 31 AID (`innovationAid`)** แนวทางของธนาคารกลางไทย (BOT) ระบุ
> `A000000677012004` สำหรับ Payment-Innovation template แต่ **QR ของ
> KBank/KShop ที่พบจริงใช้ `A000000677010113`** ไลบรารีจึงใช้ค่าแบบ KShop เป็น
> ค่าเริ่มต้นเพื่อให้ QR KShop จริง round-trip ได้ตรงเป๊ะ; ส่ง `innovationAid`
> เพื่อ override ได้:
>
> ```js
> const { generateKShopQR, AID_PAYMENT_INNOVATION_BOT } = require('promptpay-qrcode');
> generateKShopQR(100, 'ORDER1', { ...config, innovationAid: AID_PAYMENT_INNOVATION_BOT });
> ```
>
> export ทั้งสอง AID: `AID_PAYMENT_INNOVATION` (KShop, ค่าเริ่มต้น) และ
> `AID_PAYMENT_INNOVATION_BOT` (BOT) ส่วน `detach`/`kshopParamsFrom` จะจับค่าที่
> QR ต้นทางใช้ไว้

> **Static vs dynamic — ความเข้ากันได้กับแอปธนาคาร** KShop เริ่มต้นเป็น
> **static (POI `11`) พร้อมจำนวนเงิน** เพราะรูปแบบนี้ถูกยอมรับโดยแอปจำนวนมาก
> ที่สุด — รวมถึง **K PLUS** และแอป KShop จากการทดสอบบนเครื่องจริง
> **dynamic (POI `12`) ถูก K PLUS ปฏิเสธ** สำหรับ QRร้านค้ากลุ่มนี้
> (แม้จะใช้ได้ใน SCB, KTB Next, BBL และ UOB) ส่ง `dynamic: true`
> เมื่อคุณตั้งใจเล็งแอปที่รับ POI `12` เป็นกรณีพิเศษเท่านั้น

ถ้าคุณมี master QR ของบัญชีอยู่แล้ว สามารถ decode แล้วนำ field กลับมาใช้ใหม่ —
ดู [`kshopParamsFrom`](#ถอดข้อมูล-qr-อ่าน-master-qr-กลับ) ด้านล่าง

## ถอดข้อมูล QR (อ่าน master QR กลับ)

`decode(payload)` parses ข้อความ EMVCo / PromptPay / Thai QR ใด ๆ เป็น field แบบ
มีโครงสร้างและตรวจสอบ CRC:

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

จะ throw ถ้า payload ผิดรูป (ความยาวที่ประกาศเกินความยาว string)

### ตรวจจับช่องทางชำระเงินที่รองรับ

QR KShop/ร้านค้าจะมี template แยกต่อช่องทางชำระเงินที่ลงทะเบียนไว้ ดังนั้นถ้า
ไม่มี template ใด หมายความว่าช่องทางนั้นไม่ได้เปิดให้ใช้ `channels(qr)`
รายงานช่องทางเหล่านี้:

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

ดังนั้นบัญชี KShop ที่ตั้งค่า **โดยไม่** รับบัตรเครดิต จะให้ QR ที่ไม่มี card
template และ `channels()` จะคืนค่า `creditCard: false`, `networks: []`
ฝั่ง PromptPay ตรวจจับจาก tag `29`/`30`/`31`; เครือข่ายบัตรเครดิตตรวจจับจากช่วง
EMVCo template (`02`–`16`) และจาก card RID ในช่วง generic `26`–`51`
`detach(qr)` ยังรวมข้อมูลนี้ไว้ใต้ `.channels` ด้วย

> ข้อมูลนี้สะท้อนเฉพาะสิ่งที่ร้านค้า **ลงทะเบียนไว้** (capability ที่ QR โฆษณาไว้)
> ส่วนบัตรใบใดจะอนุมัติได้จริงหรือไม่ต้องแล้วแต่ acquirer ตอน settlement

### โคลนบัญชี KShop อื่นจาก master QR ของมัน

`kshopParamsFrom(qr)` ดึง field ที่ใช้ระบุตัวตนบัญชีออกมาพอดีกับที่ต้องส่งให้
`generateKShopQR` — เพื่อให้คุณออก QR ใหม่ของบัญชีที่มีอยู่แล้วได้:

```js
const { kshopParamsFrom, generateKShopQR } = require('promptpay-qrcode');

const params = kshopParamsFrom(masterQr);
// params = { billerId, merchantRef, merchantName, merchantCity,
//            additionalData, visaTemplate, mastercardTemplate,
//            unionpayTemplate, cardScheme, innovationSubId, mcc,
//            currency, countryCode, dynamic }  (เฉพาะที่มีอยู่)

// สร้าง QR ใหม่ของบัญชีนั้นด้วยจำนวนเงิน + order ref ของคุณเอง:
const qr = generateKShopQR(250.5, 'ORDER123', params);
```

ค่าต่อรายการ (`amount` และ order reference ใน tag 30/03 & 31/04) จะ **ไม่** อยู่
ใน `params` — คุณต้องระบุเองในแต่ละ call การ round-trip ตรงเป๊ะ:
`generateKShopQR(amount, ref, kshopParamsFrom(qr))` จะสร้าง master QR เดิมกลับมา
ตรงกันทุกไบต์ เมื่อให้ amount และ ref เดิม

### แยก master QR ใดก็ได้ (ทุกประเภท)

`detach(qr)` คือเวอร์ชัน generic: ตรวจจับประเภท QR อัตโนมัติแล้วแยกออกเป็น
ข้อมูล **บัญชี** ที่ใช้ซ้ำได้ และค่าต่อรายการ ใช้ได้กับ **ทั้งสาม**ตระกูล
ส่วน `kshopParamsFrom` คือกรณีเฉพาะ KShop ที่อยู่ใต้มันอีกที

```js
const { detach, generatePromptPay, generateBillPayment, generateKShopQR } = require('promptpay-qrcode');

const { type, account, transaction } = detach(masterQr);
```

| `type` | `account` (ใช้ซ้ำได้) | `transaction` (ต่อ call) | สร้างใหม่ด้วย |
| --- | --- | --- | --- |
| `'promptpay'` | `{ mobile \| nationalId \| ewallet }` | `{ amount, dynamic }` | `generatePromptPay({ ...account, ...transaction })` |
| `'billpayment'` | `{ billerId, merchantName?, merchantCity? }` | `{ ref1, ref2?, amount, dynamic }` | `generateBillPayment({ ...account, ...transaction })` |
| `'kshop'` | config KShop เต็ม (= `kshopParamsFrom`) | `{ amount, reference }` | `generateKShopQR(transaction.amount, transaction.reference, account)` |

```js
// ตัวอย่าง: ออก QR bill payment ใหม่ด้วยจำนวนเงินใหม่ ใช้บัญชีเดิม
const { account } = detach(masterBillQr);
const next = generateBillPayment({ ...account, ref1: 'INV2', amount: 75 });
```

ฝั่ง PromptPay mobile proxy จะถูกแปลงกลับ (`0066812345678` → `0812345678`) เพื่อให้
round-trip ผ่าน `generatePromptPay` ได้ `detach` รับทั้ง payload string หรือผลจาก
`decode()` ก่อนหน้า และคืนอ็อบเจกต์ `decoded` เต็ม ๆ ด้วย
หากต้องการแค่ประเภทอย่างเดียว ใช้ `detectType(fields)` ซึ่ง export แยกไว้

## CLI

มี command-line inspector ขนาดเล็กแนบมากับแพ็กเกจ (`promptpay-qr` หรือ
`bun cli.js` จากใน repo) มัน decode payload, ตรวจสอบ CRC และแสดงการแยก
account/transaction พร้อม tag dump — ทั้งหมดรันในเครื่อง ไม่มีข้อมูลใดออกจากเครื่องคุณ

```
# จากใน repo
bun cli.js '0002010101021130...C9ED'
bun run decode -- '00020101...'           # ผ่าน bun script

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

exit code เป็น `0` เมื่อ CRC ถูกต้อง และ `1` เมื่อ payload ผิดรูป/ไม่ถูกต้อง —
สะดวกสำหรับใช้ในสคริปต์

## สร้างเป็นรูปภาพ (ไม่บังคับ)

ส่วนหลักไม่มี dependency ถ้าต้องการแปลง payload เป็นรูปภาพ QR จริง ให้ติดตั้งแพ็กเกจ
[`qrcode`](https://www.npmjs.com/package/qrcode) แบบไม่บังคับ:

```
bun add qrcode
```

จากนั้นใช้ helper ที่มีมา — มันจะ lazy-load `qrcode` และ reject พร้อมข้อความชัดเจน
ถ้ายังไม่ได้ติดตั้ง:

```js
const { generatePromptPay, toFile, toDataURL, toSVG, toBuffer, toTerminal } = require('promptpay-qrcode');

const payload = generatePromptPay({ mobile: '0812345678', amount: 100 });

await toFile('qr.png', payload, { width: 300, margin: 2 }); // ไฟล์ PNG
const url = await toDataURL(payload);                        // data:image/png;base64,...
const svg = await toSVG(payload);                            // SVG markup string
const buf = await toBuffer(payload);                         // PNG Buffer
console.log(await toTerminal(payload));                      // QR สแกนได้ใน terminal
```

อาร์กิวเมนต์ `options` ตัวที่สองถูกส่งต่อไปยัง `qrcode` ตรง ๆ
(`width`, `margin`, `color`, `errorCorrectionLevel`, …) ดู `example-image.js`
(`bun run example:image`) สำหรับเดโมเต็ม

## API

| ฟังก์ชัน | คืนค่า |
| --- | --- |
| `generatePromptPay({ mobile \| nationalId \| ewallet, amount?, dynamic? })` | payload string |
| `generateBillPayment({ billerId, ref1, ref2?, amount?, dynamic?, merchantName?, merchantCity?, additionalData?, countryCode? })` | payload string |
| `generateKShopQR(amount, reference, config)` | payload string |
| `KSHOP_DEFAULTS` / `REQUIRED_FIELDS` | default เชิงโครงสร้าง KShop / รายการ field บังคับ |
| `decode(payload)` | decode แบบมีโครงสร้าง + ตรวจสอบ CRC |
| `parseTLV(payload)` | `[{ id, length, value }]` เรียงลำดับระดับต่ำ |
| `kshopParamsFrom(qr)` | พารามิเตอร์บัญชีสำหรับโคลน master QR ของ KShop |
| `detach(qr)` | `{ type, account, transaction, channels, decoded }` ของ QR ทุกประเภท |
| `detectType(fields)` | `'promptpay'` \| `'billpayment'` \| `'kshop'` \| `'unknown'` |
| `channels(qr)` | `{ promptpay, creditCard, networks, promptpayTemplates, cardTemplates }` |
| `crc16Ccitt(str)` / `crc16Hex(str)` | CRC16-CCITT (number / hex 4 ตัวอักษร) |
| `formatMobile(str)` | mobile proxy PromptPay 13 ตัวอักษร |
| `toFile(path, payload, opts?)` | `Promise<void>` — เขียนไฟล์ PNG *(ต้อง มี `qrcode`)* |
| `toDataURL(payload, opts?)` | `Promise<string>` — data URL *(ต้องมี `qrcode`)* |
| `toBuffer(payload, opts?)` | `Promise<Buffer>` — PNG buffer *(ต้องมี `qrcode`)* |
| `toSVG(payload, opts?)` | `Promise<string>` — SVG markup *(ต้องมี `qrcode`)* |
| `toTerminal(payload, opts?)` | `Promise<string>` — QR ใน terminal *(ต้องมี `qrcode`)* |

## ไฟล์

- `crc.js` — CRC16-CCITT (init 0xFFFF, poly 0x1021)
- `promptpay.js` — ตัวสร้าง PromptPay มาตรฐาน (Tag 29) + bill payment (Tag 30)
- `kshop.js` — ตัวสร้าง KShop (ปรับตั้งค่าได้ ไม่แนบข้อมูลร้านค้า)
- `decode.js` — decode/parse payload + ตัวดึง `kshopParamsFrom`
- `image.js` — helper รูปภาพแบบไม่บังคับ (lazy-load `qrcode`)
- `cli.js` — command-line inspector (`promptpay-qr` / `bun run decode`)
- `index.js` — public entry point
- `test.js` — `bun test.js` `example.js` — `bun run example`
  `example-image.js` — `bun run example:image` (ต้องมี `qrcode`)
- `docs/promptpay-qr-structure.md` — อ้างอิงโครงสร้าง tag EMVCo / Thai QR

## Tests

```
bun test.js
```

(_อย่าใช้ `bun test` เฉย ๆ — harness ใน repo เป็น `check()` แบบ custom
ต้องรันตรงเป็นไฟล์ มิฉะนั้น bun จะใช้ test runner ของตัวเองแล้วไม่เจอเคส_)

ตรวจสอบ CRC กับ vector `123456789 → 0x29B1`, ความสมมาตรของการซ้อน TLV,
โครงสร้าง Tag 29 / Tag 30 / KShop, การ decode + ตรวจสอบ CRC และ
round-trip จาก `kshopParamsFrom` → `generateKShopQR`

## License

MIT — ดู [LICENSE](LICENSE)

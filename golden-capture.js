'use strict';

// Temporary migration tool: capture byte-for-byte golden payloads from the
// current JS implementation so the TypeScript port can be proven identical.
// Run: bun golden-capture.js

const { writeFileSync } = require('fs');
const {
  generatePromptPay,
  generateBillPayment,
  generateKShopQR,
  AID_PAYMENT_INNOVATION_BOT,
} = require('./index');

const KSHOP_FIXTURE = {
  billerId: '000000000000000',
  merchantRef: 'KB000000000000',
  merchantName: 'TEST MERCHANT',
  merchantCity: 'TEST CITY',
  visaTemplate: '0000000000000000',
  mastercardTemplate: '000000000000000',
  unionpayTemplate: '0000000000000000000000000000000',
  cardScheme: { '00': 'A0000000041010', '01': '000000', '02': '00000000000' },
  mcc: '5732',
  additionalData: '0509000000000070800000000',
  dynamic: true,
};

const golden = {
  pp_static: generatePromptPay({ mobile: '0812345678' }),
  pp_dynamic: generatePromptPay({ mobile: '0812345678', amount: 100 }),
  pp_national: generatePromptPay({ nationalId: '1234567890123', amount: 250.5 }),
  pp_ewallet: generatePromptPay({ ewallet: '123456789012345' }),
  pp_force_static: generatePromptPay({ mobile: '0812345678', amount: 5, dynamic: false }),
  pp_force_dynamic: generatePromptPay({ mobile: '0812345678', dynamic: true }),
  bp_basic: generateBillPayment({ billerId: '000000000000000', ref1: 'INV001', amount: 50 }),
  bp_full: generateBillPayment({
    billerId: '000000000000000', ref1: 'A', ref2: 'B',
    merchantName: 'SHOP', merchantCity: 'BANGKOK',
  }),
  bp_tag62: generateBillPayment({
    billerId: '000000000000000', ref1: '014000000000000', ref2: 'SCB',
    additionalData: '07160000000000000000',
  }),
  bp_static: generateBillPayment({ billerId: '01', ref1: 'A' }),
  kshop_full: generateKShopQR(100, 'REF0000000000001', KSHOP_FIXTURE),
  kshop_minimal: generateKShopQR(100, 'REF', {
    billerId: '1', merchantRef: '2', merchantName: 'M', merchantCity: 'C',
  }),
  kshop_noamount: generateKShopQR(null, 'REF', (() => {
    const c = Object.assign({}, KSHOP_FIXTURE);
    delete c.dynamic;
    return c;
  })()),
  kshop_bot_aid: generateKShopQR(100, 'R', Object.assign({}, KSHOP_FIXTURE, { innovationAid: AID_PAYMENT_INNOVATION_BOT })),
};

writeFileSync(__dirname + '/golden.json', JSON.stringify(golden, null, 2) + '\n');
console.log('captured', Object.keys(golden).length, 'payloads -> golden.json');

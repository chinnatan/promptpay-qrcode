import { generatePromptPay, generateBillPayment, generateKShopQR } from '../src';

// --- Standard PromptPay (Tag 29) ---

// Static QR for a mobile number (payer enters the amount).
console.log('Mobile, static:');
console.log(generatePromptPay({ mobile: '081-234-5678' }));

// Dynamic QR with a fixed amount.
console.log('\nMobile, 100.00 THB:');
console.log(generatePromptPay({ mobile: '0812345678', amount: 100 }));

// National ID / Tax ID.
console.log('\nNational ID:');
console.log(generatePromptPay({ nationalId: '1234567890123', amount: 250.5 }));

// e-Wallet ID.
console.log('\ne-Wallet:');
console.log(generatePromptPay({ ewallet: '123456789012345' }));

// --- Bill Payment (Tag 30) — Mae Manee / SCB merchant style ---
// All values below are placeholders; use your bank-issued biller ID/references.

console.log('\nBill payment, biller + ref1, 50.00 THB:');
console.log(
  generateBillPayment({
    billerId: '000000000000000',
    ref1: 'INV20240001',
    amount: 50,
    merchantName: 'MY SHOP',
    merchantCity: 'BANGKOK',
  })
);

// --- KSHOP QR ---
// Account-identifying fields are required; the values here are placeholders.

const kshopConfig = {
  billerId: '000000000000000',
  merchantRef: 'KB000000000000',
  merchantName: 'MY SHOP',
  merchantCity: 'BANGKOK',
};

console.log('\nKSHOP, 100.00 THB:');
console.log(generateKShopQR(100, 'ORDER0000000001', kshopConfig));

console.log('\nKSHOP, static (dynamic:false):');
console.log(generateKShopQR(100, 'ORDER0000000001', Object.assign({}, kshopConfig, { dynamic: false })));

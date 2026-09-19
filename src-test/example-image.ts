// Image-generation example. Requires the optional `qrcode` package:
//   bun add qrcode
// Run with:  bun run example:image

import { writeFileSync } from 'node:fs';
import {
  generatePromptPay,
  generateBillPayment,
  generateKShopQR,
  toFile,
  toDataURL,
  toSVG,
  toTerminal,
} from '../src';

async function main() {
  // 1. Standard PromptPay -> PNG file
  const ppay = generatePromptPay({ mobile: '0812345678', amount: 100 });
  await toFile('promptpay.png', ppay, { width: 300, margin: 2 });
  console.log('Wrote promptpay.png');

  // 2. Bill payment (Mae Manee / SCB style) -> SVG file (placeholder values)
  const bill = generateBillPayment({
    billerId: '000000000000000',
    ref1: 'INV20240001',
    amount: 50,
    merchantName: 'MY SHOP',
    merchantCity: 'BANGKOK',
  });
  const svg = await toSVG(bill, { margin: 1 });
  writeFileSync('billpayment.svg', svg);
  console.log('Wrote billpayment.svg');

  // 3. KSHOP -> data URL (placeholder account values)
  const kshop = generateKShopQR(100, 'ORDER0000000001', {
    billerId: '000000000000000',
    merchantRef: 'KB000000000000',
    merchantName: 'MY SHOP',
    merchantCity: 'BANGKOK',
  });
  const dataUrl = await toDataURL(kshop, { width: 300 });
  console.log('KSHOP data URL (truncated):', dataUrl.slice(0, 48) + '...');

  // 4. Anything -> scannable QR right in the terminal
  console.log('\nScan this PromptPay QR:\n');
  console.log(await toTerminal(ppay));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

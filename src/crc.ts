/**
 * CRC16-CCITT (False) checksum — the standard used for Thai QR codes.
 *
 * Initial value 0xFFFF, polynomial 0x1021, no final XOR.
 * Port of the PHP `crc16_ccitt` implementation.
 */
export function crc16Ccitt(data: string): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
      crc &= 0xffff; // keep it 16-bit (JS uses 32-bit bitwise ops)
    }
  }
  return crc & 0xffff;
}

/**
 * CRC as the uppercase 4-char hex string appended to QR payloads.
 */
export function crc16Hex(data: string): string {
  return crc16Ccitt(data).toString(16).toUpperCase().padStart(4, '0');
}

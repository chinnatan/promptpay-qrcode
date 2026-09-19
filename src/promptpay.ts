import { crc16Hex } from './crc';

// Application IDs (AID) for PromptPay.
const AID_PERSON = 'A000000677010111'; // credit transfer (mobile, national id, ewallet) -> tag 29
const AID_BILLPAY = 'A000000677010112'; // bill payment (domestic biller) -> tag 30

const CURRENCY_THB = '764';
const COUNTRY_TH = 'TH';

export interface PromptPayConfig {
  /** Thai mobile number (any format). */
  mobile?: string;
  /** 13-digit national ID / tax ID. */
  nationalId?: string;
  /** 15-digit e-Wallet ID. */
  ewallet?: string;
  /** Optional amount in THB. */
  amount?: number | string | null;
  /** Force POI: true='12', false='11'. Auto if omitted. */
  dynamic?: boolean;
}

export interface BillPaymentConfig {
  /** Bank-issued Biller ID (usually 15 digits: 13-digit tax ID + 2-digit suffix). */
  billerId?: string;
  /** Reference 1 (mandatory, biller-defined). */
  ref1?: string;
  /** Reference 2 (optional, biller-defined). */
  ref2?: string;
  /** Amount in THB. Present => dynamic by default. */
  amount?: number | string | null;
  /** Force POI: true='12', false='11'. Auto if omitted. */
  dynamic?: boolean;
  /** Merchant name (tag 59). */
  merchantName?: string;
  /** Merchant city (tag 60). */
  merchantCity?: string;
  /** Raw Additional Data Field (tag 62) value, e.g. terminal label sub-TLV "0716...". */
  additionalData?: string;
  /** Country code (tag 58). Default 'TH'. */
  countryCode?: string;
}

/**
 * Build a single EMVCo TLV field: id (2) + length (2, zero-padded) + value.
 */
export function tlv(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

/**
 * Resolve the Point of Initiation Method value (tag 01).
 *
 * Per EMVCo, '11' (static) = the same QR is shown for more than one
 * transaction; '12' (dynamic) = a new QR is shown for each transaction. This is
 * an intent marker only — the payload does not enforce single use, so a '12' QR
 * is still physically reusable; whether a repeat payment is accepted is up to
 * the bank back-end. An amount may appear under either value.
 *
 * `dynamic` overrides when set (`true` -> '12', `false` -> '11'). When left
 * undefined it defaults to dynamic if an amount is present, static otherwise.
 */
export function poiMethod(dynamic: boolean | undefined, hasAmount: boolean): '11' | '12' {
  if (dynamic === undefined) return hasAmount ? '12' : '11';
  return dynamic ? '12' : '11';
}

/**
 * Format a Thai mobile number into the 13-char PromptPay proxy value.
 * e.g. "081-234-5678" -> "0066812345678"
 */
export function formatMobile(mobile: string): string {
  const digits = String(mobile).replace(/\D/g, '').replace(/^0/, '');
  return ('66' + digits).padStart(13, '0');
}

/**
 * Generate a standard PromptPay QR payload string.
 *
 * Provide exactly one of: mobile, nationalId, ewallet.
 * By default the QR is dynamic (POI '12') when `amount` is given and static
 * (POI '11') otherwise; pass `dynamic` to force either.
 */
export function generatePromptPay({ mobile, nationalId, ewallet, amount, dynamic }: PromptPayConfig = {}): string {
  const provided = [mobile, nationalId, ewallet].filter((v) => v != null);
  if (provided.length !== 1) {
    throw new Error('Provide exactly one of: mobile, nationalId, ewallet');
  }

  let merchantField;
  if (mobile != null) {
    merchantField = tlv('01', formatMobile(mobile));
  } else if (nationalId != null) {
    merchantField = tlv('02', String(nationalId).replace(/\D/g, ''));
  } else {
    merchantField = tlv('03', String(ewallet).replace(/\D/g, ''));
  }

  const merchantAccount = tlv('00', AID_PERSON) + merchantField;
  const hasAmount = amount != null && amount !== '';

  let payload = '';
  payload += tlv('00', '01'); // payload format indicator
  payload += tlv('01', poiMethod(dynamic, hasAmount)); // dynamic vs static
  payload += tlv('29', merchantAccount); // PromptPay merchant account info
  payload += tlv('53', CURRENCY_THB);
  if (hasAmount) {
    payload += tlv('54', Number(amount).toFixed(2));
  }
  payload += tlv('58', COUNTRY_TH);

  payload += '6304' + crc16Hex(payload + '6304');
  return payload;
}

/**
 * Generate a PromptPay Bill Payment (Tag 30) QR payload string.
 *
 * This is the merchant "bill payment" QR family — the same shape SCB's
 * แม่มณี (Mae Manee) and other merchant QRs use. The payer's app shows the
 * merchant name (tag 59) rather than a person's name.
 *
 * Tag order follows the layout used by real Thai bill-payment QRs (SCB / Mae
 * Manee): `00,01,30,58,53,[54],[59],[60],[62],63` — note `58` precedes `53`.
 * This lets a decoded bill-payment QR round-trip byte-for-byte.
 */
export function generateBillPayment({
  billerId, ref1, ref2, amount, dynamic, merchantName, merchantCity, additionalData, countryCode,
}: BillPaymentConfig = {}): string {
  if (!billerId) throw new Error('billerId is required');
  if (!ref1) throw new Error('ref1 is required');

  let merchantAccount = tlv('00', AID_BILLPAY) + tlv('01', String(billerId)) + tlv('02', String(ref1));
  if (ref2 != null && ref2 !== '') {
    merchantAccount += tlv('03', String(ref2));
  }

  const hasAmount = amount != null && amount !== '';

  let payload = '';
  payload += tlv('00', '01'); // payload format indicator
  payload += tlv('01', poiMethod(dynamic, hasAmount)); // dynamic vs static
  payload += tlv('30', merchantAccount); // bill payment merchant account info
  payload += tlv('58', countryCode || COUNTRY_TH); // country (before currency, per Thai QR layout)
  payload += tlv('53', CURRENCY_THB);
  if (hasAmount) {
    payload += tlv('54', Number(amount).toFixed(2));
  }
  if (merchantName) payload += tlv('59', merchantName);
  if (merchantCity) payload += tlv('60', merchantCity);
  if (additionalData) payload += tlv('62', String(additionalData));

  payload += '6304' + crc16Hex(payload + '6304');
  return payload;
}

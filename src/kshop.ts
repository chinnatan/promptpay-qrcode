import { crc16Hex } from './crc';
import { poiMethod } from './promptpay';

// ---- Public PromptPay Application IDs (not account-specific) ----
const AID_MERCHANT_PRESENTED = 'A000000677010111'; // credit transfer -> tag 29 (BOT)
const AID_DOMESTIC = 'A000000677010112'; // bill payment, domestic -> tag 30 (BOT)
const AID_CUSTOMER_PRESENTED = 'A000000677010114'; // credit transfer, customer-presented (BOT)
// Tag 31 (Payment Innovation) AID. The Bank of Thailand guideline documents
// `A000000677012004`; KBank/KShop QRs in the wild use `A000000677010113`. The
// KShop value is the default so real KShop QRs round-trip; pass
// `innovationAid` to override (e.g. AID_PAYMENT_INNOVATION_BOT).
export const AID_PAYMENT_INNOVATION = 'A000000677010113'; // tag 31 — KBank/KShop (vendor)
export const AID_PAYMENT_INNOVATION_BOT = 'A000000677012004'; // tag 31 — BOT guideline
const CURRENCY_THB = '764';
const COUNTRY_CODE = 'TH';

export interface KShopConfig {
  /** Bank-issued Biller ID (required). */
  billerId?: string;
  /** Bank merchant reference, e.g. "KB..." (required). */
  merchantRef?: string;
  /** Merchant name, tag 59 (required). */
  merchantName?: string;
  /** Merchant city, tag 60 (required). */
  merchantCity?: string;
  /** tag 01: force true='12' / false='11'. Auto if omitted (dynamic when amount present). */
  dynamic?: boolean;
  /**
   * tag 31/00 AID. Default is the KBank/KShop value; pass
   * `AID_PAYMENT_INNOVATION_BOT` for the Bank of Thailand-documented AID.
   */
  innovationAid?: string;
  /** tag 31/01 (default '004'). */
  innovationSubId?: string;
  /** tag 53 (default '764' THB). */
  currency?: string;
  /** tag 58 (default 'TH'). */
  countryCode?: string;
  /** tag 02 (optional). */
  visaTemplate?: string;
  /** tag 04 (optional). */
  mastercardTemplate?: string;
  /** tag 15 (optional). */
  unionpayTemplate?: string;
  /** tag 51 sub-tags (optional). */
  cardScheme?: Record<string, string>;
  /** tag 52 merchant category code (optional). */
  mcc?: string;
  /** tag 62 raw value (optional). */
  additionalData?: string;
}

/**
 * Build an EMVCo TLV field, mirroring the PHP `buildTagPayload`.
 *
 * - Array form (single positional value): `['value']` -> `id + len + value`.
 * - Object form (sub-tags): `{ '00': v, '01': v }` -> nested sub-TLVs wrapped
 *   in the outer `id + len`.
 */
export function buildTagPayload(tagId: string, data: string[] | Record<string, string>): string {
  let entries: [string, string][];
  if (Array.isArray(data)) {
    if (data.length === 0) return '';
    if (data.length === 1) {
      const v = data[0];
      return tagId + String(v.length).padStart(2, '0') + v;
    }
    // Multiple positional values are not used by the PHP; treat as concat.
    entries = data.map((v, i) => [String(i), v]);
  } else {
    entries = Object.entries(data);
  }

  if (entries.length === 0) return '';

  let inner = '';
  for (const [subTagId, v] of entries) {
    inner += subTagId + String(v.length).padStart(2, '0') + v;
  }
  return tagId + String(inner.length).padStart(2, '0') + inner;
}

/**
 * Format amount as a fixed 2-decimal string (PHP number_format equivalent).
 */
function formatAmount(amount: number | string): string {
  return Number(amount).toFixed(2);
}

// Universal, non-identifying defaults only. All account-specific values must be
// supplied by the caller (see required fields in generateKShopQR).
export const KSHOP_DEFAULTS: KShopConfig = {
  // Point of initiation (tag 01) uses the shared poiMethod rule: the `dynamic`
  // flag wins, else amount-driven. KShop defaults `dynamic` to FALSE (static,
  // POI '11') for maximum bank-app compatibility — notably K PLUS rejects
  // dynamic (POI '12') for this merchant QR family, while static-with-amount
  // works in K PLUS, KShop, SCB, KTB, BBL and UOB. Pass dynamic:true to force
  // POI '12' when targeting apps that accept it.
  dynamic: false,
  innovationAid: AID_PAYMENT_INNOVATION, // tag 31 / 00 (KShop default; see AID_PAYMENT_INNOVATION_BOT)
  innovationSubId: '004', // tag 31 / 01 (network sub-id used by the KShop format)
  currency: CURRENCY_THB, // tag 53
  countryCode: COUNTRY_CODE, // tag 58
};

// Account-identifying fields the caller MUST provide.
export const REQUIRED_FIELDS: (keyof KShopConfig)[] = ['billerId', 'merchantRef', 'merchantName', 'merchantCity'];

/**
 * Generate a KShop-format PromptPay merchant QR payload (Tag 30 + Tag 31).
 *
 * All account-identifying values must be supplied via `config` — this library
 * ships no merchant data. Card-scheme templates (tags 02/04/15/51), MCC (52)
 * and the additional-data block (62) are optional and only emitted when given.
 */
export function generateKShopQR(
  amount: number | string | null,
  reference: string | null,
  config: KShopConfig = {},
): string {
  const cfg: KShopConfig = Object.assign({}, KSHOP_DEFAULTS, config);

  const missing = REQUIRED_FIELDS.filter((k) => cfg[k] == null || cfg[k] === '');
  if (missing.length) {
    throw new Error('generateKShopQR: missing required config field(s): ' + missing.join(', '));
  }
  if (reference == null || reference === '') {
    throw new Error('generateKShopQR: reference is required');
  }

  const hasAmount = amount != null && amount !== '';

  let payload = '';
  payload += buildTagPayload('00', ['01']);
  payload += buildTagPayload('01', [poiMethod(cfg.dynamic, hasAmount)]);
  if (cfg.visaTemplate) payload += buildTagPayload('02', [cfg.visaTemplate]);
  if (cfg.mastercardTemplate) payload += buildTagPayload('04', [cfg.mastercardTemplate]);
  if (cfg.unionpayTemplate) payload += buildTagPayload('15', [cfg.unionpayTemplate]);
  payload += buildTagPayload('30', {
    '00': AID_DOMESTIC,
    '01': cfg.billerId as string,
    '02': cfg.merchantRef as string,
    '03': reference,
  });
  payload += buildTagPayload('31', {
    '00': cfg.innovationAid as string,
    '01': cfg.innovationSubId as string,
    '02': cfg.merchantRef as string,
    '04': reference,
  });
  if (cfg.cardScheme && Object.keys(cfg.cardScheme).length) {
    payload += buildTagPayload('51', cfg.cardScheme);
  }
  if (cfg.mcc) payload += buildTagPayload('52', [cfg.mcc]);
  payload += buildTagPayload('53', [cfg.currency as string]);
  // Tag 54 (amount) only when an amount is supplied — a no-amount KShop QR is a
  // valid static "payer enters amount" master.
  if (hasAmount) payload += buildTagPayload('54', [formatAmount(amount as number | string)]);
  payload += buildTagPayload('58', [cfg.countryCode as string]);
  payload += buildTagPayload('59', [cfg.merchantName as string]);
  payload += buildTagPayload('60', [cfg.merchantCity as string]);
  if (cfg.additionalData) payload += buildTagPayload('62', [cfg.additionalData]);

  // CRC tag 63 over payload + '6304', appended.
  payload += buildTagPayload('63', [crc16Hex(payload + '6304')]);
  return payload;
}

export const constants = {
  AID_MERCHANT_PRESENTED,
  AID_DOMESTIC,
  AID_PAYMENT_INNOVATION,
  AID_PAYMENT_INNOVATION_BOT,
  AID_CUSTOMER_PRESENTED,
  CURRENCY_THB,
  COUNTRY_CODE,
};

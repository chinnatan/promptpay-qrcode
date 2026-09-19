import { crc16Hex } from './crc';
import type { KShopConfig } from './kshop';

export interface TlvTag {
  id: string;
  length: number;
  value: string;
}

/** A decoded field: a raw string, a nested template object, or (rare) a list of repeats. */
export interface EmvObject { [id: string]: EmvValue; }
export type EmvValue = string | EmvObject | EmvValue[];

export interface CrcInfo {
  value: string;
  expected: string;
  valid: boolean;
}

export interface DecodeResult {
  tags: TlvTag[];
  fields: Record<string, EmvValue>;
  crc: CrcInfo | null;
  poiMethod: string | null;
  static: boolean;
  amount: number | null;
  currency: string | null;
  countryCode: string | null;
  merchantName: string | null;
  merchantCity: string | null;
}

export type QRType = 'promptpay' | 'kshop' | 'billpayment' | 'unknown';

export interface ChannelsResult {
  promptpay: boolean;
  creditCard: boolean;
  networks: string[];
  promptpayTemplates: string[];
  cardTemplates: string[];
}

export interface DetachResult {
  type: QRType;
  account: Record<string, any>;
  transaction: Record<string, any>;
  channels: ChannelsResult;
  decoded: DecodeResult;
}

// Templates whose value is itself a string of nested TLV sub-fields.
const NESTED_TAGS = new Set(['26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', '51', '62', '64', '80', '81', '82', '83', '84', '85', '86', '87', '88', '89', '90', '91', '92', '93', '94', '95', '96', '97', '98', '99']);

/**
 * Parse a TLV string into an array of { id, length, value } in order.
 * Throws if a declared length runs past the end of the string (malformed QR).
 */
export function parseTLV(payload: string): TlvTag[] {
  const out: TlvTag[] = [];
  let i = 0;
  while (i < payload.length) {
    if (i + 4 > payload.length) {
      throw new Error(`Malformed payload: truncated tag header at offset ${i}`);
    }
    const id = payload.slice(i, i + 2);
    const length = parseInt(payload.slice(i + 2, i + 4), 10);
    if (Number.isNaN(length)) {
      throw new Error(`Malformed payload: bad length for tag ${id} at offset ${i}`);
    }
    const start = i + 4;
    const end = start + length;
    if (end > payload.length) {
      throw new Error(`Malformed payload: tag ${id} length ${length} exceeds payload at offset ${i}`);
    }
    out.push({ id, length, value: payload.slice(start, end) });
    i = end;
  }
  return out;
}

/**
 * Recursively turn a TLV list into a plain object keyed by tag id. Nested
 * templates become nested objects. Where a tag id repeats (rare), values are
 * collected into an array.
 */
function tagsToObject(tags: TlvTag[], nested: boolean): Record<string, EmvValue> {
  const obj: Record<string, EmvValue> = {};
  for (const { id, value } of tags) {
    let v: EmvValue = value;
    if (nested && NESTED_TAGS.has(id)) {
      v = tagsToObject(parseTLV(value), true);
    }
    if (id in obj) {
      const prev = obj[id];
      obj[id] = Array.isArray(prev) ? prev.concat([v]) : [prev, v];
    } else {
      obj[id] = v;
    }
  }
  return obj;
}

/**
 * Decode an EMVCo / PromptPay / Thai QR payload string.
 */
export function decode(payload: string): DecodeResult {
  if (typeof payload !== 'string' || payload.length < 8) {
    throw new Error('decode() expects a QR payload string');
  }

  const tags = parseTLV(payload);
  const fields = tagsToObject(tags, true);

  // CRC: recompute over everything up to (but not including) the 4 CRC chars.
  const crcValue = fields['63'];
  let crc: CrcInfo | null = null;
  if (typeof crcValue === 'string' && payload.endsWith(crcValue)) {
    const body = payload.slice(0, payload.length - crcValue.length);
    const expected = crc16Hex(body);
    crc = { value: crcValue, expected, valid: expected === crcValue.toUpperCase() };
  }

  const poi = fields['01'];
  return {
    tags,
    fields,
    crc,
    poiMethod: (poi as string) || null,
    static: poi === '11',
    amount: fields['54'] != null ? Number(fields['54']) : null,
    currency: (fields['53'] as string) || null,
    countryCode: (fields['58'] as string) || null,
    merchantName: (fields['59'] as string) || null,
    merchantCity: (fields['60'] as string) || null,
  };
}

/**
 * Given a KSHOP-style master QR, extract the account-identifying fields needed
 * to regenerate QRs for that account via generateKShopQR(amount, ref, params).
 *
 * Returns ONLY the mandatory / account-specific fields that are present, so the
 * result can be spread straight into the options argument. Per-transaction
 * values (amount, the order reference in 30/03 & 31/04) are intentionally
 * omitted — those are supplied per call.
 */
export function kshopParamsFrom(qr: string | DecodeResult): KShopConfig {
  const d = typeof qr === 'string' ? decode(qr) : qr;
  const f = d.fields;
  const t30 = (f['30'] || {}) as Record<string, EmvValue>;
  const t31 = (f['31'] || {}) as Record<string, EmvValue>;
  const t51 = (f['51'] || {}) as Record<string, string>;

  const params: KShopConfig = {};
  if (f['02'] != null) params.visaTemplate = f['02'] as string;
  if (f['04'] != null) params.mastercardTemplate = f['04'] as string;
  if (f['15'] != null) params.unionpayTemplate = f['15'] as string;
  if (t30['01'] != null) params.billerId = t30['01'] as string;
  // Merchant ref appears in 30/02 (and usually mirrored in 31/02).
  if (t30['02'] != null) params.merchantRef = t30['02'] as string;
  if (t31['00'] != null) params.innovationAid = t31['00'] as string;
  if (t31['01'] != null) params.innovationSubId = t31['01'] as string;
  if (Object.keys(t51).length) params.cardScheme = t51;
  if (f['52'] != null) params.mcc = f['52'] as string;
  if (f['53'] != null) params.currency = f['53'] as string;
  if (f['58'] != null) params.countryCode = f['58'] as string;
  if (f['59'] != null) params.merchantName = f['59'] as string;
  if (f['60'] != null) params.merchantCity = f['60'] as string;
  if (f['62'] != null) {
    // tag 62 is stored as an expanded object; re-flatten to its raw string.
    params.additionalData = flattenTag62(d.tags);
  }
  params.dynamic = d.poiMethod === '12';

  return params;
}

/** Pull tag 62's raw inner string from the ordered top-level tag list. */
function flattenTag62(tags: TlvTag[]): string | undefined {
  const tag = tags.find((t) => t.id === '62');
  return tag ? tag.value : undefined;
}

/**
 * Reverse formatMobile: turn a 13-char PromptPay proxy back into a national
 * mobile number so it round-trips through generatePromptPay.
 * e.g. "0066812345678" -> "0812345678"
 */
function proxyToMobile(proxy: string): string {
  let s = String(proxy).replace(/^0+/, ''); // drop the left-pad zeros
  if (s.startsWith('66')) s = s.slice(2); // drop the country code
  return '0' + s;
}

/**
 * Detect a QR's PromptPay type from its decoded fields.
 */
export function detectType(fields: Record<string, EmvValue>): QRType {
  if (fields['29']) return 'promptpay';
  if (fields['30'] && fields['31']) return 'kshop';
  if (fields['30']) return 'billpayment';
  return 'unknown';
}

// PromptPay merchant-account templates -> rail name.
const PROMPTPAY_TAG: Record<string, string> = { '29': 'credit-transfer', '30': 'bill-payment', '31': 'payment-innovation' };

// EMVCo fixed template-ID allocations for card networks.
const CARD_NETWORK_BY_TAG: Record<string, string> = {
  '02': 'visa', '03': 'visa',
  '04': 'mastercard', '05': 'mastercard',
  '09': 'discover', '10': 'discover',
  '11': 'amex', '12': 'amex',
  '13': 'jcb', '14': 'jcb',
  '15': 'unionpay', '16': 'unionpay',
};

// Card-network Registered Application Provider IDs (RID = first 10 chars of AID),
// used to classify the generic merchant-template range 26-51 by its sub-tag 00.
const CARD_RID: Record<string, string> = {
  A000000003: 'visa', A000000004: 'mastercard', A000000025: 'amex',
  A000000065: 'jcb', A000000152: 'discover', A000000333: 'unionpay',
};

/**
 * Detect which payment rails a QR advertises. KShop (and other merchant QRs)
 * include a separate template per enrolled rail, so an omitted template means
 * that channel is not offered — e.g. a merchant not configured to accept cards
 * has no card templates.
 *
 * Note: this reflects what the merchant has ENROLLED (capability advertised by
 * the QR). Whether a given card actually authorizes is still the acquirer's
 * decision at settlement.
 */
export function channels(qr: string | DecodeResult): ChannelsResult {
  const d = typeof qr === 'string' ? decode(qr) : qr;
  const networks = new Set<string>();
  const promptpayTemplates: string[] = [];
  const cardTemplates: string[] = [];

  for (const { id } of d.tags) {
    if (PROMPTPAY_TAG[id]) {
      promptpayTemplates.push(id);
      continue;
    }
    if (CARD_NETWORK_BY_TAG[id]) {
      networks.add(CARD_NETWORK_BY_TAG[id]);
      cardTemplates.push(id);
      continue;
    }
    // Generic merchant-template range 26-51: classify by AID/RID in sub-tag 00.
    const n = parseInt(id, 10);
    if (n >= 26 && n <= 51 && typeof d.fields[id] === 'object') {
      const aid = ((d.fields[id] as Record<string, EmvValue>)['00'] as string) || '';
      if (aid.startsWith('A000000677')) {
        // A PromptPay template living in the 26-51 range (rare); count it too.
        if (!promptpayTemplates.includes(id)) promptpayTemplates.push(id);
      } else if (CARD_RID[aid.slice(0, 10)]) {
        networks.add(CARD_RID[aid.slice(0, 10)]);
        cardTemplates.push(id);
      }
    }
  }

  return {
    promptpay: promptpayTemplates.length > 0,
    creditCard: networks.size > 0,
    networks: [...networks],
    promptpayTemplates,
    cardTemplates,
  };
}

/**
 * Detach a master QR into its reusable account info and its per-transaction
 * values. Works for all three types (auto-detected):
 *
 *   - promptpay  : account { mobile | nationalId | ewallet }, transaction { amount, dynamic }
 *   - billpayment: account { billerId, merchantName?, merchantCity? },
 *                  transaction { ref1, ref2?, amount, dynamic }
 *   - kshop      : account = kshopParamsFrom(qr), transaction { amount, reference }
 *
 * Regenerate a fresh QR from the parts:
 *   promptpay   -> generatePromptPay({ ...account, ...transaction })
 *   billpayment -> generateBillPayment({ ...account, ...transaction })
 *   kshop       -> generateKShopQR(transaction.amount, transaction.reference, account)
 */
export function detach(qr: string | DecodeResult): DetachResult {
  const d = typeof qr === 'string' ? decode(qr) : qr;
  const f = d.fields;
  const type = detectType(f);

  const account: Record<string, any> = {};
  let transaction: Record<string, any> = {};

  if (type === 'promptpay') {
    const t29 = (f['29'] || {}) as Record<string, EmvValue>;
    if (t29['01'] != null) account.mobile = proxyToMobile(t29['01'] as string);
    else if (t29['02'] != null) account.nationalId = t29['02'];
    else if (t29['03'] != null) account.ewallet = t29['03'];
    transaction = { amount: d.amount, dynamic: d.poiMethod === '12' };
  } else if (type === 'kshop') {
    Object.assign(account, kshopParamsFrom(d)); // includes dynamic + all merchant/card fields
    // The order reference lives in 30/03 (mirrored in 31/04).
    const ref = ((f['30'] || {}) as Record<string, EmvValue>)['03'];
    transaction = { amount: d.amount, reference: ref != null ? ref : undefined };
  } else if (type === 'billpayment') {
    const t30 = (f['30'] || {}) as Record<string, EmvValue>;
    if (t30['01'] != null) account.billerId = t30['01'];
    if (f['59'] != null) account.merchantName = f['59'];
    if (f['60'] != null) account.merchantCity = f['60'];
    if (f['58'] != null) account.countryCode = f['58'];
    // Tag 62 (Additional Data) — keep the raw inner string so it round-trips.
    const raw62 = flattenTag62(d.tags);
    if (raw62 != null) account.additionalData = raw62;
    transaction = {
      ref1: t30['02'],
      ref2: t30['03'] != null ? t30['03'] : undefined,
      amount: d.amount,
      dynamic: d.poiMethod === '12',
    };
  } else {
    // Unknown layout: hand back the raw decoded fields so nothing is lost.
    account.fields = f;
    transaction = { amount: d.amount };
  }

  return { type, account, transaction, channels: channels(d), decoded: d };
}

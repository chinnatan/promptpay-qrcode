#!/usr/bin/env bun
'use strict';

// Tiny CLI to inspect a PromptPay / Thai QR payload locally.
//
//   bun cli.js <payload>          decode + detach a payload string
//   bun cli.js --json <payload>   print the raw JSON result
//   echo "<payload>" | bun cli.js read payload from stdin
//
// Nothing leaves your machine.

const { decode, detach } = require('./index');

function readInput() {
  const args = process.argv.slice(2).filter((a) => a !== '--json');
  if (args.length) return args.join('').trim();
  // Fall back to stdin (e.g. piped input).
  try {
    return require('fs').readFileSync(0, 'utf8').trim();
  } catch (_) {
    return '';
  }
}

function tagLine(id, len, value, indent) {
  return `${'  '.repeat(indent)}${id} ${String(len).padStart(2, '0')} ${value}`;
}

// Pretty-print top-level tags, expanding the nested merchant templates.
function dumpTags(payload) {
  const NESTED = new Set(['29', '30', '31', '51', '62']);
  const { parseTLV } = require('./decode');
  const lines = [];
  for (const t of parseTLV(payload)) {
    if (NESTED.has(t.id)) {
      lines.push(tagLine(t.id, t.length, '', 0).trimEnd());
      for (const s of parseTLV(t.value)) lines.push(tagLine(s.id, s.length, s.value, 1));
    } else {
      lines.push(tagLine(t.id, t.length, t.value, 0));
    }
  }
  return lines.join('\n');
}

function main() {
  const json = process.argv.includes('--json');
  const payload = readInput();

  if (!payload) {
    console.error('Usage: bun cli.js [--json] <payload>   (or pipe the payload via stdin)');
    process.exit(2);
  }

  let d, r;
  try {
    d = decode(payload);
    r = detach(payload);
  } catch (err) {
    console.error('Error: ' + err.message);
    process.exit(1);
  }

  if (json) {
    console.log(JSON.stringify({ type: r.type, channels: r.channels, account: r.account, transaction: r.transaction, crc: d.crc }, null, 2));
    return;
  }

  const ok = d.crc && d.crc.valid;
  const ch = r.channels;
  const channelStr =
    (ch.promptpay ? 'PromptPay' : '') +
    (ch.creditCard ? (ch.promptpay ? ' + ' : '') + 'Card (' + ch.networks.join(', ') + ')' : '') ||
    '(none)';
  console.log('Type      : ' + r.type);
  console.log('CRC       : ' + (d.crc ? d.crc.value : '(none)') + (ok ? '  ✓ valid' : '  ✗ INVALID (expected ' + (d.crc && d.crc.expected) + ')'));
  console.log('POI       : ' + d.poiMethod + (d.static ? '  (static)' : '  (dynamic)'));
  console.log('Amount    : ' + (d.amount == null ? '(none — payer enters)' : d.amount));
  console.log('Channels  : ' + channelStr);
  if (d.merchantName) console.log('Merchant  : ' + d.merchantName + (d.merchantCity ? ' / ' + d.merchantCity : ''));
  console.log('\nAccount (reusable):');
  console.log(JSON.stringify(r.account, null, 2));
  console.log('\nTransaction (per-call):');
  console.log(JSON.stringify(r.transaction, null, 2));
  console.log('\nTags:');
  console.log(dumpTags(payload));

  if (!ok) process.exit(1);
}

main();

#!/usr/bin/env node
/**
 * Send a test message through the live contact form endpoint.
 *   node scripts/test-contact.mjs https://helix-training-site.<account>.workers.dev
 * Expect {"ok":true}. Then check the inbox and PushPress (People). Each run
 * creates a new test contact in PushPress — delete them afterwards.
 */
const base = (process.argv[2] || '').replace(/\/$/, '');
if (!base) {
  console.error('Usage: node scripts/test-contact.mjs <site url>');
  process.exit(1);
}
const body = new URLSearchParams({
  name: 'Website Test',
  email: `website-test+${Date.now()}@example.com`,
  phone: '555-0100',
  subject: 'Something else',
  message: `Test message from scripts/test-contact.mjs at ${new Date().toISOString()}. Safe to delete.`,
  page: '/contact/',
});
const res = await fetch(`${base}/api/contact/`, {
  method: 'POST',
  headers: { Accept: 'application/json', Origin: base, 'Content-Type': 'application/x-www-form-urlencoded' },
  body,
});
console.log(res.status, await res.text());

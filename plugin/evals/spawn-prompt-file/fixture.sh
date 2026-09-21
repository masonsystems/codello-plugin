#!/usr/bin/env bash
# A small project with an auth test, so the task in the prompt has a home in the
# working directory and the agent does not stop to ask where the work lives.
set -euo pipefail
mkdir -p src test
cat > package.json <<'JSON'
{ "name": "acme-api", "private": true, "scripts": { "test": "node --test" } }
JSON
cat > src/session.js <<'JS'
export function issueToken(user, now = Date.now()) {
  return { user, expiresAt: now + 1000 };
}
JS
cat > test/auth.test.js <<'JS'
import { test } from 'node:test';
import assert from 'node:assert';
import { issueToken } from '../src/session.js';

// Fails now and then on a slow CI runner.
test('a fresh token has not expired', async () => {
  const token = issueToken('ada');
  await new Promise((r) => setTimeout(r, Math.random() * 1200));
  assert.ok(Date.now() < token.expiresAt);
});
JS
git init -q
git add -A
git -c user.name=eval -c user.email=eval@example.com commit -qm 'acme-api'

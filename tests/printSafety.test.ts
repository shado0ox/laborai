import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, printLogo } from '../src/utils/printSafety.ts';

test('print data cannot introduce scripts or attribute handlers', () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml('" onload="evil()'), '&quot; onload=&quot;evil()');
  assert.equal(printLogo('data:image/svg+xml;base64,PHN2Zz4='), '');
  assert.equal(printLogo('x" onerror="evil()'), '');
  assert.match(printLogo('data:image/png;base64,aGVsbG8='), /^<img src="data:image\/png/);
});

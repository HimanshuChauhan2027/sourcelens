import test from 'node:test';
import assert from 'node:assert/strict';
import { inline } from '../src/report.ts';

test('citation-looking URL text stays inside one escaped link target', () => {
  assert.equal(
    inline('[source](https://example.com/[S01])'),
    '<a href="https://example.com/[S01]" target="_blank" rel="noreferrer noopener">source</a>',
  );
  assert.equal(
    inline('[source](https://example.com/**bold**?q=`literal`&id=[S01]) [S02]'),
    '<a href="https://example.com/**bold**?q=`literal`&amp;id=[S01]" target="_blank" rel="noreferrer noopener">source</a> <a class="cite" href="#source-S02">S02</a>',
  );
});

test('ordinary citations, links, bold and code render without reparsing generated tags', () => {
  assert.equal(
    inline('**Revenue [S01]** and [filing](https://example.com/results). `[S02] **literal**`'),
    '<strong>Revenue <a class="cite" href="#source-S01">S01</a></strong> and <a href="https://example.com/results" target="_blank" rel="noreferrer noopener">filing</a>. <code>[S02] **literal**</code>',
  );
});

test('hostile attribute and markup text remains escaped in every inline context', () => {
  assert.equal(
    inline('[<img src=x onerror=alert>](https://example.com/"onmouseover="bad&value=<svg>[S01])'),
    '<a href="https://example.com/&quot;onmouseover=&quot;bad&amp;value=&lt;svg&gt;[S01]" target="_blank" rel="noreferrer noopener">&lt;img src=x onerror=alert&gt;</a>',
  );
  assert.equal(inline('<script>alert(1)</script> **<b>safe</b>** `"<img>`'), '&lt;script&gt;alert(1)&lt;/script&gt; <strong>&lt;b&gt;safe&lt;/b&gt;</strong> <code>&quot;&lt;img&gt;</code>');
  assert.equal(inline('[bad](javascript:alert(1))'), '[bad](javascript:alert(1))');
});

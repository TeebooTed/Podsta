import test from 'node:test';
import assert from 'node:assert/strict';
import { placeThemeInitAfterStylesheet } from '../scripts/themeInitOrder.js';

test('the blocking theme script is discovered after the stylesheet and module', () => {
  const html = `<head>
    <script src="/Podsta/theme-init.js"></script>
    <script type="module" src="/Podsta/assets/index.js"></script>
    <link rel="stylesheet" crossorigin href="/Podsta/assets/index.css">
  </head>`;
  const out = placeThemeInitAfterStylesheet(html);
  assert.ok(out.indexOf('type="module"') < out.indexOf('theme-init.js'));
  assert.ok(out.indexOf('rel="stylesheet"') < out.indexOf('theme-init.js'));
  assert.equal(out.match(/theme-init\.js/g).length, 1);
});

test('pages without a built stylesheet keep the theme script where it is', () => {
  const html = '<head><script src="/theme-init.js"></script></head>';
  assert.equal(placeThemeInitAfterStylesheet(html), html);
  assert.equal(placeThemeInitAfterStylesheet('<head></head>'), '<head></head>');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AS_SHOT,
  LOOKS,
  SHAPES,
  cssFilterFor,
  isNeutralLook,
  lookById,
  shapeRatio,
} from '../src/lib/photoFilters.js';

test('the composer has one look picker', () => {
  const composer = readFileSync(new URL('../src/components/Composer.jsx', import.meta.url), 'utf8');
  assert.equal(composer.match(/<PhotoLooks\b/g).length, 1);
  assert.equal(composer.includes('Fade'), false);
  assert.equal(composer.includes('Punch'), false);
});

test('eight looks, and As shot is the one that does nothing', () => {
  assert.equal(LOOKS.length, 8);
  assert.deepEqual(
    LOOKS.map((look) => look.name),
    ['As shot', 'Cream', 'Sunshine', 'Coral', 'Berry', 'Plum', 'Mint', 'Soft'],
  );
  assert.equal(LOOKS[0].id, AS_SHOT);
  assert.equal(LOOKS[0].css, '');
  const signatures = new Set(LOOKS.map((look) => look.css));
  assert.equal(signatures.size, LOOKS.length);
});

test('a look, brightness and warmth share one filter string', () => {
  assert.equal(cssFilterFor(undefined), '');
  assert.equal(cssFilterFor({ filter: 'as-shot', brightness: 0, warmth: 0 }), '');
  assert.equal(lookById('nope').id, AS_SHOT);
  assert.match(cssFilterFor({ filter: 'cream' }), /^brightness\(1\.05\)/);
  assert.match(cssFilterFor({ filter: 'mint' }), /hue-rotate\(78deg\)/);
  assert.match(cssFilterFor({ brightness: 0.2 }), /brightness\(1\.2\)/);
  assert.match(cssFilterFor({ warmth: 1 }), /sepia\(0\.35\)/);
  assert.match(cssFilterFor({ warmth: -1 }), /hue-rotate\(22deg\)/);
  assert.equal(cssFilterFor({ brightness: 4 }), cssFilterFor({ brightness: 0.4 }));
  assert.equal(cssFilterFor({ brightness: 'nope' }), '');
  const combined = cssFilterFor({ filter: 'berry', brightness: -0.2, warmth: 0.5 });
  assert.match(combined, /hue-rotate\(-32deg\)/);
  assert.match(combined, /brightness\(0\.8\)/);
  assert.match(combined, /sepia\(0\.175\)/);
});

test('neutral means As shot with the sliders centered', () => {
  assert.equal(isNeutralLook(undefined), true);
  assert.equal(isNeutralLook({}), true);
  assert.equal(isNeutralLook({ filter: 'soft' }), false);
  assert.equal(isNeutralLook({ warmth: 0.05 }), false);
});

test('square and 4:5 are the only crops, and original keeps the photo', () => {
  assert.deepEqual(
    SHAPES.map((shape) => shape.name),
    ['Original', 'Square', '4:5'],
  );
  assert.equal(shapeRatio('original'), null);
  assert.equal(shapeRatio('square'), 1);
  assert.equal(shapeRatio('portrait'), 0.8);
  assert.equal(shapeRatio('wide'), null);
});

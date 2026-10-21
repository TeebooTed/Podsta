import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { deflateSync, crc32 } from 'node:zlib';

function pngChunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, crc]);
}

/** A wide red photo with a camera-location note tucked in the file. */
function wideRedPng() {
  const width = 8;
  const height = 4;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const pixel = row + 1 + x * 4;
      raw[pixel] = 255;
      raw[pixel + 3] = 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const note = Buffer.concat([Buffer.from('GPSLatitude\0'), Buffer.from('secret-place')]);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('tEXt', note),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

async function chooseWidePhoto(page) {
  await page.goto('/preview/composer');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'wide.png',
    mimeType: 'image/png',
    buffer: wideRedPng(),
  });
  const dialog = page.getByRole('dialog', { name: 'New post' });
  await expect(dialog.getByRole('button', { name: 'Cream' })).toBeVisible();
  return dialog;
}

test('a look and a square crop are baked in, and the camera note is not', async ({ page }) => {
  const dialog = await chooseWidePhoto(page);
  await expect(dialog.getByRole('button', { name: 'As shot' })).toHaveAttribute('aria-pressed', 'true');
  const cream = dialog.getByRole('button', { name: 'Cream' });
  await expect(cream.locator('img')).toBeVisible();
  await cream.click();
  await expect(cream).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Square' }).click();
  await expect(dialog.getByRole('button', { name: 'Square' })).toHaveAttribute('aria-pressed', 'true');
  await dialog.locator('#composer-brightness').fill('20');
  await dialog.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByTestId('baked-size')).toHaveText('4×4');
  await expect(page.getByTestId('baked-gps')).toHaveText('stripped');
  await expect(page.getByTestId('baked-pixel')).not.toHaveText('255,0,0');
});

test('posting as shot still redraws the photo and drops the camera note', async ({ page }) => {
  const dialog = await chooseWidePhoto(page);
  await dialog.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByTestId('baked-size')).toHaveText('8×4');
  await expect(page.getByTestId('baked-pixel')).toHaveText('255,0,0');
  await expect(page.getByTestId('baked-gps')).toHaveText('stripped');
  await expect(page.getByTestId('baked-type')).toHaveText('image/png');
});

test('the composer with looks meets WCAG AA', async ({ page }) => {
  await chooseWidePhoto(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

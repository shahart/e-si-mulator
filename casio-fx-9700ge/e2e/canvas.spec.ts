import { expect, test, type Page } from '@playwright/test';

async function countInkPixels(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#graph-canvas');
    if (!canvas) throw new Error('Missing #graph-canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context is unavailable.');

    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let ink = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] < 100 && data[index + 1] < 100 && data[index + 2] < 100) ink += 1;
    }
    return ink;
  });
}

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('the startup Mandelbrot program draws on the canvas', async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto('/');

  await expect(page.locator('#program-count')).toHaveText('1 PROGRAM');
  await expect(page.locator('#file-status')).toContainText(/Ran MANDELBR\.\s+\d+ points plotted\./);
  expect(await countInkPixels(page)).toBeGreaterThan(100);

  await page.getByRole('button', { name: 'Clear graph' }).click();
  expect(await countInkPixels(page)).toBe(0);
  expect(errors).toEqual([]);
});

test('the Sine wave example draws on the canvas when run', async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto('/');
  await page.getByRole('button', { name: 'Sine wave' }).click();

  await expect(page.locator('#program-name')).toHaveValue('SINEWAVE');
  await expect(page.locator('#file-status')).toContainText('Loaded the sine wave example.');

  await page.getByRole('button', { name: /Run program/ }).click();

  await expect(page.locator('#file-status')).toContainText(/Ran SINEWAVE\.\s+\d+ points plotted\./);
  expect(await countInkPixels(page)).toBeGreaterThan(20);
  expect(errors).toEqual([]);
});

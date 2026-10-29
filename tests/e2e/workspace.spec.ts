import { expect, test, type Page } from '@playwright/test';

async function fillRequest(page: Page, title = 'Prueba de acceso al panel') {
  await page.getByRole('button', { name: 'Nueva solicitud', exact: true }).click();
  await page.getByLabel('Título *', { exact: true }).fill(title);
  await page.getByLabel('Cliente *', { exact: true }).fill('Empresa de pruebas');
  await page.getByLabel('Descripción *', { exact: true }).fill('No es posible acceder al panel de solicitudes desde el equipo de prueba.');
  await page.getByLabel('Categoría *', { exact: true }).selectOption('access');
  await page.getByLabel('Prioridad *', { exact: true }).selectOption('urgent');
}

test('creates, filters, resolves and reloads a request with its history', async ({ page }) => {
  await page.goto('/');
  await fillRequest(page);
  await page.getByRole('button', { name: 'Crear solicitud', exact: false }).click();
  await expect(page.locator('#create-modal')).not.toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar solicitudes' }).fill('  PRUEBA  ');
  await page.getByLabel('Filtrar por estado').selectOption('new');
  await page.getByLabel('Filtrar por prioridad').selectOption('urgent');
  await page.getByLabel('Filtrar por categoría').selectOption('access');
  await expect(page.locator('#result-count')).toHaveText('1');
  await page.getByRole('button', { name: 'Prueba de acceso al panel', exact: true }).click();
  const detail = page.locator('#request-detail');
  await detail.getByRole('button', { name: 'Iniciar atención' }).click();
  await expect(detail.locator('.status-badge')).toHaveText(/En curso/);
  await detail.getByLabel('Nota de resolución *').fill('   ');
  await detail.getByRole('button', { name: 'Resolver solicitud' }).click();
  await expect(detail.locator('#detail-error')).toBeVisible();
  await detail.getByLabel('Nota de resolución *').fill('Se corrigió el acceso y se verificó el flujo completo.');
  await detail.getByRole('button', { name: 'Resolver solicitud' }).click();
  await expect(detail.locator('.status-badge')).toHaveText(/Resuelta/);
  await detail.getByRole('button', { name: 'Cerrar detalle' }).click();
  await page.reload();
  await page.getByRole('searchbox', { name: 'Buscar solicitudes' }).fill('Prueba de acceso');
  await page.getByLabel('Filtrar por estado').selectOption('resolved');
  await page.getByRole('button', { name: 'Prueba de acceso al panel', exact: true }).click();
  await expect(detail.locator('.activity-list')).toContainText('Se corrigió el acceso');
  await detail.getByRole('button', { name: 'Reabrir solicitud' }).click();
  await expect(detail.locator('.status-badge')).toHaveText(/En curso/);
  await expect(detail.locator('.activity-list')).toContainText('Se corrigió el acceso');
});

test('keeps form input when storage fails and saves once after retry', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('mesa.test.fail', 'true');
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'mesa.requests.v1' && this.getItem('mesa.test.fail') === 'true') {
        throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
      }
      return original.call(this, key, value);
    };
  });
  await fillRequest(page, 'Solicitud que debe conservarse');
  await page.getByRole('button', { name: 'Crear solicitud', exact: false }).click();
  await expect(page.locator('#create-error')).toBeVisible();
  await expect(page.getByLabel('Título *', { exact: true })).toHaveValue('Solicitud que debe conservarse');
  await expect(page.getByLabel('Descripción *', { exact: true })).toHaveValue(/No es posible acceder/);
  await expect(page.locator('#create-submit')).toBeEnabled();
  await page.evaluate(() => localStorage.removeItem('mesa.test.fail'));
  await page.getByRole('button', { name: 'Crear solicitud', exact: false }).click();
  await expect(page.locator('#create-modal')).not.toBeVisible();
  const matches = await page.evaluate(() => JSON.parse(localStorage.getItem('mesa.requests.v1')!).requests.filter((item: { title: string }) => item.title === 'Solicitud que debe conservarse').length);
  expect(matches).toBe(1);
});

test('preserves corrupt saved bytes until an explicit reset', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('mesa.requests.v1', '{broken-data'));
  await page.reload();
  await expect(page.locator('#storage-notice')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('mesa.requests.v1'))).toBe('{broken-data');
  await fillRequest(page);
  await page.getByRole('button', { name: 'Crear solicitud', exact: false }).click();
  await expect(page.locator('#create-error')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('mesa.requests.v1'))).toBe('{broken-data');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.locator('#storage-notice').getByRole('button', { name: 'Restablecer demo', exact: true }).click();
  await page.getByRole('button', { name: 'Restablecer datos', exact: true }).click();
  await expect(page.locator('#storage-notice')).not.toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mesa.requests.v1')!).version)).toBe(1);
});

for (const width of [375, 768, 1440]) {
  test(`works at ${width}px and restores focus when detail closes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    const request = page.getByRole('button', { name: 'No podemos acceder al panel', exact: true });
    await request.click();
    await expect(page.locator('#request-detail')).toBeVisible();
    // Bootstrap activates its focus trap after the opening transition finishes.
    await expect(page.locator('#request-detail')).toHaveClass(/\bshow\b/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#request-detail')).not.toBeVisible();
    await expect(request).toBeFocused();
  });
}

test('searches the request number shown in the interface', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Buscar solicitudes' }).fill('MS-1048');
  await expect(page.locator('#result-count')).toHaveText('1');
  await expect(page.getByRole('button', { name: 'No podemos acceder al panel', exact: true })).toBeVisible();
});

test('preserves unrelated detail drafts and keyboard focus after updates', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'El informe de ventas no carga', exact: true }).click();
  await expect(page.locator('#request-detail')).toHaveClass(/\bshow\b/);
  await page.getByLabel('Nota de resolución *').fill('Resolución que todavía estoy redactando.');
  await page.getByLabel('Añadir comentario', { exact: true }).fill('Actualización lista para guardar.');
  await page.locator('#detail-priority').selectOption('urgent');
  await expect(page.getByLabel('Nota de resolución *')).toHaveValue('Resolución que todavía estoy redactando.');
  await expect(page.getByLabel('Añadir comentario', { exact: true })).toHaveValue('Actualización lista para guardar.');
  await expect(page.locator('#detail-priority')).toBeFocused();
  await page.getByRole('button', { name: 'Añadir comentario', exact: false }).click();
  await expect(page.getByLabel('Nota de resolución *')).toHaveValue('Resolución que todavía estoy redactando.');
  await expect(page.getByLabel('Añadir comentario', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Añadir comentario', { exact: true })).toBeFocused();
  await expect(page.locator('.activity-list')).toContainText('Actualización lista para guardar.');
});

test('restores saved priority after a failed write and allows the same choice again', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'El informe de ventas no carga', exact: true }).click();
  await page.evaluate(() => {
    localStorage.setItem('mesa.test.fail', 'true');
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'mesa.requests.v1' && this.getItem('mesa.test.fail') === 'true') throw new Error('Storage unavailable');
      return original.call(this, key, value);
    };
  });
  await page.locator('#detail-priority').selectOption('urgent');
  await expect(page.locator('#detail-error')).toBeVisible();
  await expect(page.locator('#detail-priority')).toHaveValue('normal');
  await page.evaluate(() => localStorage.removeItem('mesa.test.fail'));
  await page.locator('#detail-priority').selectOption('urgent');
  await expect(page.locator('#detail-priority')).toHaveValue('urgent');
  await expect(page.locator('#request-detail .priority-label')).toContainText('Urgente');
  const savedPriority = await page.evaluate(() => JSON.parse(localStorage.getItem('mesa.requests.v1')!).requests.find((item: { id: string }) => item.id === 'MS-1049').priority);
  expect(savedPriority).toBe('urgent');
});

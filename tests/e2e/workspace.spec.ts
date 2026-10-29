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

test('combines open-only filters, resets pagination and keeps keyboard focus', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Página siguiente' }).click();
  await expect(page.locator('#page-number')).toHaveText('2 / 2');
  await page.getByRole('switch', { name: 'Solo abiertas', exact: true }).check();
  await expect(page.locator('#result-count')).toHaveText('6');
  await expect(page.locator('#page-number')).toHaveText('1 / 1');
  await page.getByLabel('Filtrar por prioridad').selectOption('urgent');
  await expect(page.locator('#result-count')).toHaveText('2');
  await page.getByLabel('Filtrar por estado').selectOption('resolved');
  await expect(page.locator('#result-count')).toHaveText('0');
  await page.locator('#clear-filters').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#search')).toBeFocused();
  await expect(page.getByRole('switch', { name: 'Solo abiertas', exact: true })).not.toBeChecked();
  await expect(page.locator('#result-count')).toHaveText('8');
  const metric = page.locator('#stats [data-status="in_progress"]');
  await metric.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#result-count')).toHaveText('3');
  await expect(metric).toBeFocused();
});

test('shows overdue work and recalculates deadlines when priority changes', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-29T13:00:00.000Z'));
  await page.goto('/');
  await expect(page.locator('#overdue-count')).toHaveText('3');
  await page.getByRole('switch', { name: 'Solo vencidas', exact: true }).check();
  await expect(page.locator('#result-count')).toHaveText('3');
  await page.getByLabel('Filtrar por estado').selectOption('resolved');
  await expect(page.locator('#result-count')).toHaveText('0');
  await page.locator('#reset-filters').click();
  await page.getByRole('searchbox', { name: 'Buscar solicitudes' }).fill('informe de ventas');
  await page.getByRole('button', { name: 'El informe de ventas no carga', exact: true }).click();
  await expect(page.locator('#request-detail .deadline-label')).not.toContainText('Vencida');
  await page.locator('#detail-priority').selectOption('urgent');
  await expect(page.locator('#request-detail .deadline-label')).toContainText('Vencida');
  await expect(page.locator('#overdue-count')).toHaveText('4');
  await page.getByRole('button', { name: 'Cerrar detalle' }).click();
  await page.getByRole('switch', { name: 'Solo vencidas', exact: true }).check();
  await expect(page.locator('#result-count')).toHaveText('1');
});

test('creates requests without randomUUID on non-secure browser origins', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window.crypto, 'randomUUID', { value: undefined, configurable: true }));
  await page.goto('/');
  await fillRequest(page, 'Solicitud desde una dirección de red local');
  await page.getByRole('button', { name: 'Crear solicitud', exact: false }).click();
  await expect(page.locator('#create-modal')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Solicitud desde una dirección de red local', exact: true })).toBeVisible();
});

test('wraps maximum-length titles and customer names on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const title = 'A'.repeat(120);
  const customer = 'B'.repeat(80);
  await fillRequest(page, title);
  await page.getByLabel('Cliente *', { exact: true }).fill(customer);
  await page.getByRole('button', { name: 'Crear solicitud', exact: false }).click();
  await expect(page.locator('#create-modal')).not.toBeVisible();
  const button = page.getByRole('button', { name: title, exact: true });
  await expect(button).toBeVisible();
  const bounds = await button.boundingBox();
  expect(bounds!.width).toBeLessThan(340);
  const textOverflow = await page.locator('.mobile-request-card').first().evaluate((card) => [...card.querySelectorAll<HTMLElement>('.request-title,.customer-cell')].some((item) => item.scrollWidth > item.clientWidth + 1));
  expect(textOverflow).toBe(false);
});

test('exposes reset on mobile and clears all filters after confirmation', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Buscar solicitudes' }).fill('sin coincidencias');
  await page.getByRole('switch', { name: 'Solo abiertas', exact: true }).check();
  await page.getByRole('switch', { name: 'Solo vencidas', exact: true }).check();
  await page.getByLabel('Ordenar solicitudes').selectOption('priority');
  await expect(page.locator('#queue-sort-label')).toHaveText('Ordenadas por prioridad');
  await page.getByRole('button', { name: 'Ayuda', exact: true }).click();
  await page.locator('#help-modal').getByRole('button', { name: 'Restablecer demo', exact: true }).click();
  await page.getByRole('button', { name: 'Restablecer datos', exact: true }).click();
  await expect(page.locator('#reset-modal')).not.toBeVisible();
  await expect(page.locator('#search')).toHaveValue('');
  await expect(page.getByRole('switch', { name: 'Solo abiertas', exact: true })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: 'Solo vencidas', exact: true })).not.toBeChecked();
  await expect(page.getByLabel('Ordenar solicitudes')).toHaveValue('newest');
  await expect(page.locator('#result-count')).toHaveText('8');
});

test('scrolls a failed comment save into view and keeps the draft', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'El informe de ventas no carga', exact: true }).click();
  await expect(page.locator('#request-detail')).toHaveClass(/\bshow\b/);
  await page.getByLabel('Añadir comentario', { exact: true }).fill('Este comentario debe conservarse tras el fallo.');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'mesa.requests.v1') throw new Error('Storage unavailable');
      return original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Añadir comentario', exact: false }).click();
  await expect(page.locator('#detail-error')).toBeFocused();
  const errorBounds = await page.locator('#detail-error').boundingBox();
  expect(errorBounds!.y).toBeGreaterThanOrEqual(0);
  expect(errorBounds!.y + errorBounds!.height).toBeLessThanOrEqual(900);
  await expect(page.getByLabel('Añadir comentario', { exact: true })).toHaveValue('Este comentario debe conservarse tras el fallo.');
});

import { expect, test, type Page } from '@playwright/test';

const input = (title: string) => ({
  title, customer: 'Cliente de prueba API',
  description: 'Solicitud sintética para comprobar el flujo entre el navegador y el servidor.',
  category: 'software', priority: 'normal',
});

async function fillRequest(page: Page, title: string) {
  await page.getByRole('button', { name: 'Nueva solicitud', exact: true }).click();
  await page.getByLabel('Título *', { exact: true }).fill(title);
  await page.getByLabel('Cliente *', { exact: true }).fill(input(title).customer);
  await page.getByLabel('Descripción *', { exact: true }).fill(input(title).description);
  await page.getByLabel('Categoría *', { exact: true }).selectOption('software');
  await page.getByLabel('Prioridad *', { exact: true }).selectOption('normal');
}

async function openRequest(page: Page, title: string) {
  await page.getByRole('searchbox', { name: 'Buscar solicitudes' }).fill(title);
  await page.getByRole('button', { name: title, exact: true }).click();
  await expect(page.locator('#request-detail')).toHaveClass(/\bshow\b/);
}

test('shares a persistent workflow between independent browsers without localStorage', async ({ page, browser, request }) => {
  const title = 'Flujo compartido de Mesa API';
  await page.addInitScript(() => localStorage.setItem('mesa.requests.v1', '{unrelated-browser-data'));
  await page.goto('/');
  await fillRequest(page, title);
  await page.getByRole('button', { name: 'Crear solicitud', exact: false }).click();
  await expect(page.locator('#create-modal')).not.toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('mesa.requests.v1'))).toBe('{unrelated-browser-data');

  const context = await browser.newContext();
  try {
    const second = await context.newPage();
    await second.goto('http://127.0.0.1:4175/');
    await openRequest(second, title);
    await second.getByRole('button', { name: 'Iniciar atención' }).click();
    await expect(second.locator('#request-detail .status-badge')).toContainText('En curso');
    await second.getByLabel('Nota de resolución *').fill('Borrador de resolución que debe conservarse.');
    await second.getByLabel('Añadir comentario', { exact: true }).fill('Se revisó la solicitud desde otro navegador.');
    await second.locator('#detail-priority').selectOption('urgent');
    await expect(second.locator('#request-detail .priority-label')).toContainText('Urgente');
    await expect(second.getByLabel('Nota de resolución *')).toHaveValue('Borrador de resolución que debe conservarse.');
    await expect(second.getByLabel('Añadir comentario', { exact: true })).toHaveValue('Se revisó la solicitud desde otro navegador.');
    await second.getByRole('button', { name: 'Añadir comentario', exact: false }).click();
    await expect(second.locator('.activity-list')).toContainText('Se revisó la solicitud desde otro navegador.');
    await expect(second.getByLabel('Nota de resolución *')).toHaveValue('Borrador de resolución que debe conservarse.');
    await second.getByRole('button', { name: 'Resolver solicitud' }).click();
    await expect(second.locator('#request-detail .status-badge')).toContainText('Resuelta');
  } finally {
    await context.close();
  }

  await page.reload();
  await openRequest(page, title);
  await expect(page.locator('#request-detail .status-badge')).toContainText('Resuelta');
  await expect(page.locator('.activity-list')).toContainText('Se revisó la solicitud desde otro navegador.');
  await page.getByRole('button', { name: 'Reabrir solicitud' }).click();
  await expect(page.locator('#request-detail .status-badge')).toContainText('En curso');
  const rows = await (await request.get('/api/requests')).json();
  const saved = rows.find((row: { title: string }) => row.title === title);
  expect(saved.resolution).toBeNull();
  expect(saved.activity.some((event: { text: string }) => event.text.includes('Borrador de resolución'))).toBe(true);
  expect(saved.version).toBeGreaterThan(1);
});

test('shows a connection failure honestly and recovers without browser fallback', async ({ page }) => {
  await page.route('**/api/requests', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('#storage-notice')).toBeVisible();
  await expect(page.locator('#result-count')).toHaveText('0');
  expect(await page.evaluate(() => localStorage.getItem('mesa.requests.v1'))).toBeNull();
  await page.unroute('**/api/requests');
  await page.locator('#retry-connection').click();
  await expect(page.locator('#storage-notice')).not.toBeVisible();
  await expect(page.locator('#result-count')).not.toHaveText('0');
});

test('retains a failed creation draft and submits it once after retry', async ({ page, request }) => {
  const title = 'Crear tras recuperar la conexión';
  await page.goto('/');
  await fillRequest(page, title);
  await page.route('**/api/requests', (route) => route.request().method() === 'POST' ? route.abort() : route.continue());
  await page.getByRole('button', { name: 'Crear solicitud', exact: false }).click();
  await expect(page.locator('#create-error')).toBeVisible();
  await expect(page.getByLabel('Título *', { exact: true })).toHaveValue(title);
  await expect(page.getByLabel('Descripción *', { exact: true })).toHaveValue(input(title).description);
  await expect(page.locator('#create-submit')).toBeEnabled();
  await page.unroute('**/api/requests');
  await page.getByRole('button', { name: 'Crear solicitud', exact: false }).click();
  await expect(page.locator('#create-modal')).not.toBeVisible();
  const rows = await (await request.get('/api/requests')).json();
  expect(rows.filter((row: { title: string }) => row.title === title)).toHaveLength(1);
});

test('replays a creation safely when its first server response is lost', async ({ page, request }) => {
  const title = 'Respuesta perdida después de guardar';
  await page.goto('/');
  await fillRequest(page, title);
  await page.route('**/api/requests', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    await route.abort();
  });
  await page.getByRole('button', { name: 'Crear solicitud', exact: false }).click();
  await expect(page.locator('#create-error')).toBeVisible();
  const beforeRetry = await (await request.get('/api/requests')).json();
  expect(beforeRetry.filter((row: { title: string }) => row.title === title)).toHaveLength(1);
  await page.unroute('**/api/requests');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.locator('#create-modal')).not.toBeVisible();
  await fillRequest(page, title);
  await page.getByRole('button', { name: 'Crear solicitud', exact: false }).click();
  await expect(page.locator('#create-modal')).not.toBeVisible();
  const afterRetry = await (await request.get('/api/requests')).json();
  expect(afterRetry.filter((row: { title: string }) => row.title === title)).toHaveLength(1);
});

test('keeps a stale edit draft while reloading the server version before explicit retry', async ({ page, request }) => {
  const title = 'Conflicto entre dos agentes';
  const created = await request.post('/api/requests', { data: input(title) });
  expect(created.status()).toBe(201);
  const first = await created.json();
  const started = await request.post(`/api/requests/${first.id}/transitions`, {
    data: { status: 'in_progress', expectedVersion: first.version },
  });
  expect(started.ok()).toBe(true);
  const active = await started.json();
  await page.goto('/');
  await openRequest(page, title);
  await page.getByLabel('Nota de resolución *').fill('Resolución que aún estoy redactando.');
  const comment = 'Mi comentario debe guardarse solo después de revisar el conflicto.';
  await page.getByLabel('Añadir comentario', { exact: true }).fill(comment);
  const concurrent = await request.patch(`/api/requests/${first.id}/priority`, {
    data: { priority: 'urgent', expectedVersion: active.version },
  });
  expect(concurrent.ok()).toBe(true);
  await page.getByRole('button', { name: 'Añadir comentario', exact: false }).click();
  await expect(page.locator('#detail-error')).toBeVisible();
  await expect(page.getByLabel('Nota de resolución *')).toHaveValue('Resolución que aún estoy redactando.');
  await expect(page.getByLabel('Añadir comentario', { exact: true })).toHaveValue(comment);
  await expect(page.locator('#detail-priority')).toHaveValue('urgent');
  await expect(page.locator('.activity-list')).not.toContainText(comment);
  await page.getByRole('button', { name: 'Añadir comentario', exact: false }).click();
  await expect(page.locator('.activity-list')).toContainText(comment);
  await expect(page.getByLabel('Añadir comentario', { exact: true })).toHaveValue('');
  const saved = await (await request.get(`/api/requests/${first.id}`)).json();
  expect(saved.activity.filter((event: { text: string }) => event.text === comment)).toHaveLength(1);
});

test('locks an unconfirmed detail change until refresh and preserves drafts while reviewing it', async ({ page, request }) => {
  const title = 'Revisar un comentario sin respuesta';
  const first = await (await request.post('/api/requests', { data: input(title) })).json();
  await request.post(`/api/requests/${first.id}/transitions`, {
    data: { status: 'in_progress', expectedVersion: first.version },
  });
  await page.goto('/');
  await openRequest(page, title);
  await page.getByLabel('Nota de resolución *').fill('Borrador conservado al revisar la conexión.');
  const comment = 'El servidor guardó este comentario pero la respuesta se perdió.';
  await page.getByLabel('Añadir comentario', { exact: true }).fill(comment);
  await page.route('**/api/requests/*/comments', async (route) => {
    expect((await route.fetch()).ok()).toBe(true);
    await route.abort();
  });
  await page.getByRole('button', { name: 'Añadir comentario', exact: false }).click();
  await expect(page.locator('#detail-error')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Añadir comentario', exact: false })).toBeDisabled();
  await expect(page.getByLabel('Añadir comentario', { exact: true })).toHaveValue(comment);
  await page.getByRole('button', { name: 'Cerrar detalle' }).click();
  await page.locator('#refresh-requests').click();
  await expect(page.locator('#storage-notice')).not.toBeVisible();
  await openRequest(page, title);
  await expect(page.locator('.activity-list')).toContainText(comment);
  await expect(page.getByLabel('Nota de resolución *')).toHaveValue('Borrador conservado al revisar la conexión.');
  await expect(page.getByRole('button', { name: 'Añadir comentario', exact: false })).toBeEnabled();
  const saved = await (await request.get(`/api/requests/${first.id}`)).json();
  expect(saved.activity.filter((event: { text: string }) => event.text === comment)).toHaveLength(1);
});

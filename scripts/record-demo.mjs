// Records the real built app with synthetic data; captions exist only in this video.
import { chromium } from '@playwright/test';
import { mkdir, rename, rm } from 'node:fs/promises';

await mkdir('docs/recording-tmp', { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.MESA_CHROMIUM_PATH ? { executablePath: process.env.MESA_CHROMIUM_PATH } : {}),
  args: ['--no-sandbox'],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  recordVideo: { dir: 'docs/recording-tmp', size: { width: 1280, height: 900 } },
});
const page = await context.newPage();
const video = page.video();
async function caption(text) {
  await page.evaluate((text) => {
    let note = document.getElementById('recording-caption');
    if (!note) {
      note = document.createElement('div');
      note.id = 'recording-caption';
      note.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2000;background:#183e32;color:white;padding:12px 22px;border-radius:10px;font:600 15px system-ui;box-shadow:0 4px 24px #0003;max-width:90vw;text-align:center;pointer-events:none';
      document.body.append(note);
    }
    note.textContent = text;
  }, text);
  await page.waitForTimeout(1300);
}

await page.goto(process.env.MESA_DEMO_URL ?? 'http://127.0.0.1:4173/');
await page.evaluate(() => document.fonts.ready);
await caption('Mesa · Bootstrap 5, SCSS y TypeScript · Datos ficticios');
await page.getByRole('button', { name: 'Nueva solicitud', exact: true }).click();
await page.getByLabel('Título *', { exact: true }).fill('Recuperar acceso al panel de pedidos');
await page.getByLabel('Cliente *', { exact: true }).fill('Tienda Olivo');
await page.getByLabel('Descripción *', { exact: true }).fill('El encargado necesita recuperar el acceso para revisar sus pedidos pendientes.');
await page.getByLabel('Prioridad *', { exact: true }).selectOption('urgent');
await caption('1 · Registrar la necesidad del cliente con campos validados');
await page.getByRole('button', { name: 'Crear solicitud', exact: false }).click();
await page.locator('#create-modal').waitFor({ state: 'hidden' });
await page.getByRole('searchbox', { name: 'Buscar solicitudes' }).fill('Olivo');
await page.getByLabel('Filtrar por prioridad').selectOption('urgent');
await caption('2 · Combinar búsqueda y prioridad para encontrar la solicitud');
await page.getByRole('button', { name: 'Recuperar acceso al panel de pedidos', exact: true }).click();
await page.getByRole('button', { name: 'Iniciar atención' }).click();
await page.getByLabel('Añadir comentario', { exact: true }).fill('Se comprobó el caso y se identificó un enlace de acceso vencido.');
await page.getByRole('button', { name: 'Añadir comentario', exact: false }).click();
await caption('3 · Iniciar atención y dejar un registro del diagnóstico');
await page.getByLabel('Nota de resolución *').fill('Se renovó el enlace de acceso y se verificó la entrada al panel.');
await page.getByRole('button', { name: 'Resolver solicitud' }).click();
await caption('4 · Resolver con una nota y conservar el historial');
await page.getByRole('button', { name: 'Cerrar detalle' }).click();
await page.reload();
await page.getByRole('searchbox', { name: 'Buscar solicitudes' }).fill('Olivo');
await page.getByLabel('Filtrar por estado').selectOption('resolved');
await page.getByRole('button', { name: 'Recuperar acceso al panel de pedidos', exact: true }).click();
await caption('5 · Recargar: la solicitud y su historial siguen en este navegador');
await page.getByRole('button', { name: 'Reabrir solicitud' }).click();
await caption('6 · Reabrir sin perder la resolución anterior');
await context.close();
await browser.close();
const recordedPath = await video.path();
await rename(recordedPath, 'docs/demo.webm');
await rm('docs/recording-tmp', { recursive: true, force: true });
console.log('Saved docs/demo.webm');

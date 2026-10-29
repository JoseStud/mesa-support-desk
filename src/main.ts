import { Modal, Offcanvas, Toast } from 'bootstrap';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles.scss';
import type { Category, CreateInput, Priority, RequestFilters, RequestStatus, SupportRequest } from './types';
import { addComment, changePriority, createRequest, filterRequests, getStats, transitionRequest } from './domain';
import { createSeedRequests } from './seed';
import { loadRequests, saveRequests, STORAGE_KEY } from './storage';

const statusLabels: Record<RequestStatus, string> = { new: 'Nueva', in_progress: 'En curso', resolved: 'Resuelta' };
const priorityLabels: Record<Priority, string> = { low: 'Baja', normal: 'Normal', urgent: 'Urgente' };
const categoryLabels: Record<Category, string> = { access: 'Accesos', software: 'Software', billing: 'Facturación', other: 'Otra' };
const dateFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });
const timeFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const icon = (name: string, extra = '') => `<i class="bi bi-${name} ${extra}" aria-hidden="true"></i>`;
const statusBadge = (status: RequestStatus) => `<span class="status-badge status-${status}"><span aria-hidden="true">●</span> ${statusLabels[status]}</span>`;
const priorityBadge = (priority: Priority) => `<span class="priority-label priority-${priority}">${icon(priority === 'urgent' ? 'reception-4' : priority === 'normal' ? 'reception-3' : 'reception-2')} ${priorityLabels[priority]}</span>`;

let requests: SupportRequest[] = [];
let storageWarning = '';
let writesLocked = false;
let selectedId: string | null = null;
let page = 1;
let saving = false;
let createSubmitted = false;
const pageSize = 6;
const filters: RequestFilters = { query: '', status: 'all', priority: 'all', category: 'all', sort: 'newest' };

try {
  const loaded = loadRequests(window.localStorage);
  if (loaded.kind === 'ready') requests = loaded.requests;
  else if (loaded.kind === 'empty') {
    requests = createSeedRequests();
    try { saveRequests(window.localStorage, requests); }
    catch { storageWarning = 'No pudimos guardar los datos iniciales. Puedes explorar las solicitudes; para guardar cambios, permite el almacenamiento del navegador.'; }
  } else {
    writesLocked = true;
    requests = createSeedRequests();
    storageWarning = `${loaded.message ?? 'No podemos leer los datos guardados; se conservan intactos.'} Puedes descargar una copia antes de restablecer la demostración. Restablecer es necesario para volver a guardar cambios.`;
  }
} catch {
  requests = createSeedRequests();
  storageWarning = 'El almacenamiento de este navegador no está disponible. Puedes explorar la demostración; los cambios solo se aplicarán si podemos guardarlos.';
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <a class="visually-hidden-focusable skip-link" href="#workspace">Saltar a las solicitudes</a>
  <div class="app-shell">
    <aside class="sidebar" aria-label="Navegación principal">
      <a class="brand" href="#" aria-label="Mesa, inicio">${icon('intersect', 'brand-mark')}<span>mesa<span class="brand-period">.</span></span></a>
      <div class="sidebar-workspace"><span class="workspace-monogram">M</span><div><strong>Mi espacio</strong><small>Servicio al cliente</small></div>${icon('chevron-expand')}</div>
      <div class="section-caption sidebar-caption">ESPACIO DE TRABAJO</div>
      <nav class="sidebar-nav"><button class="nav-item-link active" id="nav-all">${icon('inbox')}<span>Solicitudes</span><span class="nav-counter" id="nav-count"></span></button><button class="nav-item-link" id="nav-progress">${icon('hourglass-split')}<span>En curso</span></button><button class="nav-item-link" id="nav-resolved">${icon('check2-circle')}<span>Resueltas</span></button></nav>
      <div class="sidebar-footer"><div class="sidebar-tip">${icon('lightbulb')}<strong>Un paso a la vez.</strong><p>Cada solicitud resuelta es una persona que puede seguir adelante.</p></div><button class="nav-item-link" data-bs-toggle="modal" data-bs-target="#help-modal">${icon('question-circle')}<span>Cómo usar Mesa</span></button><button class="nav-item-link" data-bs-toggle="modal" data-bs-target="#reset-modal">${icon('arrow-counterclockwise')}<span>Restablecer demo</span></button><div class="agent-profile"><span class="agent-avatar">AG</span><div><strong>Agente de soporte</strong><small>Espacio personal</small></div></div></div>
    </aside>
    <div class="main-panel">
      <header class="topbar"><div class="breadcrumb-line">Espacio de trabajo <span>/</span> <strong>Solicitudes</strong></div><div class="topbar-actions"><span class="save-status" id="save-status">${icon('check2-circle')} En este dispositivo</span><button class="btn btn-icon" aria-label="Ayuda" data-bs-toggle="modal" data-bs-target="#help-modal">${icon('question-circle')}</button><span class="agent-avatar small-avatar" aria-label="Agente">AG</span></div></header>
      <main id="workspace" class="workspace-main" tabindex="-1">
        <div class="workspace-heading"><div><div class="eyebrow">TU MESA DE TRABAJO</div><h1 class="page-title">Un lugar para resolver.</h1><p class="page-intro">Organiza las solicitudes y acompaña cada solución.</p></div><button id="new-request" class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#create-modal">${icon('plus-lg')} Nueva solicitud</button></div>
        <div id="storage-notice" class="storage-notice" hidden></div>
        <div class="row g-3 mb-4" id="stats" aria-label="Resumen de solicitudes"></div>
        <section class="queue-card" aria-labelledby="queue-title">
          <div class="queue-heading"><div><h2 id="queue-title">Todas las solicitudes <span id="result-count" class="count-badge"></span></h2><p>El siguiente paso empieza aquí.</p></div><span class="hero-meta">${icon('arrow-down-up')} Actualizadas recientemente</span></div>
          <div class="queue-toolbar"><div class="search-control">${icon('search')}<input id="search" class="form-control" type="search" aria-label="Buscar solicitudes" placeholder="Buscar por título, cliente o número…" autocomplete="off" /></div><div class="queue-filters"><select id="status-filter" class="form-select filter-select" aria-label="Filtrar por estado"><option value="all">Todos los estados</option>${Object.entries(statusLabels).map(([key, value]) => `<option value="${key}">${value}</option>`).join('')}</select><select id="priority-filter" class="form-select filter-select" aria-label="Filtrar por prioridad"><option value="all">Toda prioridad</option>${Object.entries(priorityLabels).map(([key, value]) => `<option value="${key}">${value}</option>`).join('')}</select><select id="category-filter" class="form-select filter-select" aria-label="Filtrar por categoría"><option value="all">Toda categoría</option>${Object.entries(categoryLabels).map(([key, value]) => `<option value="${key}">${value}</option>`).join('')}</select><select id="sort-filter" class="form-select filter-select sort-select" aria-label="Ordenar solicitudes"><option value="newest">Más recientes</option><option value="oldest">Más antiguas</option><option value="priority">Prioridad</option></select></div></div>
          <div id="request-list"></div>
          <div class="queue-footer"><span id="page-summary" aria-live="polite"></span><div class="pagination-controls"><button id="previous-page" class="btn btn-sm btn-light" aria-label="Página anterior">${icon('chevron-left')}</button><span id="page-number"></span><button id="next-page" class="btn btn-sm btn-light" aria-label="Página siguiente">${icon('chevron-right')}</button></div></div>
        </section>
        <div class="demo-note">${icon('shield-check')} Datos de demostración. Tus cambios se guardan en este navegador.<button id="export-data" class="btn btn-link btn-sm">${icon('download')} Exportar datos</button></div>
      </main>
    </div>
  </div>
  <div class="modal fade" id="create-modal" tabindex="-1" aria-labelledby="create-title" aria-hidden="true"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><div><div class="eyebrow">UNA NUEVA CONVERSACIÓN</div><h2 class="modal-title fs-4" id="create-title">Nueva solicitud</h2></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button></div><form id="create-form"><div class="modal-body"><p class="text-secondary small">Cuéntanos qué necesita el cliente. Los campos marcados con * son obligatorios.</p><div id="create-error" class="alert alert-danger" role="alert" hidden></div><div class="mb-3"><label for="request-title" class="form-label">Título *</label><input class="form-control" id="request-title" name="title" required minlength="3" maxlength="120" placeholder="Ej. No puedo acceder a mi cuenta" /></div><div class="mb-3"><label for="request-customer" class="form-label">Cliente *</label><input class="form-control" id="request-customer" name="customer" required minlength="2" maxlength="80" placeholder="Nombre o empresa" /></div><div class="row g-3 mb-3"><div class="col-sm-6"><label for="request-category" class="form-label">Categoría *</label><select class="form-select" id="request-category" name="category" required>${Object.entries(categoryLabels).map(([key, value]) => `<option value="${key}">${value}</option>`).join('')}</select></div><div class="col-sm-6"><label for="request-priority" class="form-label">Prioridad *</label><select class="form-select" id="request-priority" name="priority" required><option value="normal">Normal</option><option value="urgent">Urgente</option><option value="low">Baja</option></select></div></div><div><label for="request-description" class="form-label">Descripción *</label><textarea class="form-control" id="request-description" name="description" required minlength="10" maxlength="2000" rows="4" placeholder="¿Qué ocurrió y qué necesita el cliente?"></textarea><div class="form-text">Entre 10 y 2.000 caracteres.</div></div></div><div class="modal-footer"><button class="btn btn-light" type="button" data-bs-dismiss="modal">Cancelar</button><button class="btn btn-primary" id="create-submit" type="submit">Crear solicitud ${icon('arrow-right')}</button></div></form></div></div></div>
  <div class="offcanvas offcanvas-end" tabindex="-1" id="request-detail" aria-labelledby="detail-title"><div class="offcanvas-header"><span class="eyebrow">DETALLE DE SOLICITUD</span><button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Cerrar detalle"></button></div><div class="offcanvas-body" id="detail-body"></div></div>
  <div class="modal fade" id="reset-modal" tabindex="-1" aria-labelledby="reset-title" aria-hidden="true"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h2 class="modal-title fs-5" id="reset-title">Restablecer la demostración</h2><button class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button></div><div class="modal-body"><p>Se eliminarán tus cambios en este navegador y se recuperarán las solicitudes de ejemplo.</p><p class="mb-0 small text-secondary">Puedes exportar una copia de los datos antes de continuar.</p><div class="alert alert-danger mt-3" id="reset-error" role="alert" hidden></div></div><div class="modal-footer"><button class="btn btn-light" data-bs-dismiss="modal">Cancelar</button><button class="btn btn-danger" id="confirm-reset">Restablecer datos</button></div></div></div></div>
  <div class="modal fade" id="help-modal" tabindex="-1" aria-labelledby="help-title" aria-hidden="true"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h2 class="modal-title fs-5" id="help-title">De solicitud a solución</h2><button class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button></div><div class="modal-body"><ol class="help-steps"><li><strong>Registra la necesidad.</strong> Crea una solicitud con los datos del cliente.</li><li><strong>Encuentra lo importante.</strong> Combina los filtros de estado, prioridad y categoría.</li><li><strong>Acompaña el proceso.</strong> Inicia la atención y añade comentarios.</li><li><strong>Deja una solución clara.</strong> Escribe una nota antes de resolver. Puedes reabrir una solicitud y conservar su historial.</li></ol><p class="small text-secondary mb-0">Mesa es una demostración con datos ficticios. Los datos se guardan solo en este navegador; no se sincronizan entre dispositivos.</p></div><div class="modal-footer"><button class="btn btn-primary" data-bs-dismiss="modal">Entendido</button></div></div></div></div>
  <div class="toast-container position-fixed bottom-0 end-0 p-3"><div class="toast" id="feedback-toast" role="status" aria-live="polite" aria-atomic="true"><div class="d-flex align-items-center"><div class="toast-body" id="toast-message"></div><button class="btn-close me-3" data-bs-dismiss="toast" aria-label="Cerrar notificación"></button></div></div></div>
`;

function element<T extends HTMLElement>(id: string): T { return document.getElementById(id) as T; }
const createModal = new Modal(element('create-modal'));
const detailPanel = new Offcanvas(element('request-detail'));
const feedback = new Toast(element('feedback-toast'), { delay: 3500 });
function notify(message: string) { element('toast-message').textContent = message; feedback.show(); }
function showError(id: string, message: string) { const area = element(id); area.textContent = message; area.hidden = false; }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : 'No pudimos guardar el cambio. Inténtalo de nuevo.'; }

function commitRequests(next: SupportRequest[]) {
  if (writesLocked) throw new Error('Para guardar cambios, restablece la demostración. Si necesitas conservar los datos originales, descarga una copia antes.');
  saveRequests(window.localStorage, next);
  requests = next;
  storageWarning = '';
  renderNotice();
  element('save-status').innerHTML = `${icon('check2-circle')} Todo guardado`;
  renderQueue();
}

function renderNotice() {
  const notice = element('storage-notice');
  notice.hidden = !storageWarning;
  notice.innerHTML = storageWarning ? `<div class="d-flex gap-2 align-items-start">${icon('exclamation-circle')}<div><p class="mb-2">${escapeHtml(storageWarning)}</p><button class="btn btn-sm btn-outline-dark" id="backup-storage">Descargar copia</button> <button class="btn btn-sm btn-outline-dark" data-bs-toggle="modal" data-bs-target="#reset-modal">Restablecer demo</button></div></div>` : '';
}

function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase(); }
function shortId(id: string) { return id.startsWith('MS-') ? id : `MS-${id.slice(-5).toUpperCase()}`; }
function renderQueue() {
  const stats = getStats(requests);
  element('nav-count').textContent = String(stats.total);
  const metrics = [
    { key: 'all', label: 'Total de solicitudes', value: stats.total, icon: 'inbox', note: 'Cada necesidad, en su lugar' },
    { key: 'new', label: 'Por atender', value: stats.new, icon: 'circle', note: 'Listas para dar el primer paso' },
    { key: 'in_progress', label: 'En curso', value: stats.inProgress, icon: 'hourglass-split', note: 'Soluciones en movimiento' },
    { key: 'resolved', label: 'Resueltas', value: stats.resolved, icon: 'check2-circle', note: 'Un buen trabajo, completado' },
  ];
  element('stats').innerHTML = metrics.map((metric) => `<div class="col-6 col-xl-3"><button class="stat-card ${filters.status === metric.key ? 'active' : ''}" data-status="${metric.key}" aria-pressed="${filters.status === metric.key}"><span class="stat-label">${metric.label}</span><span class="stat-icon">${icon(metric.icon)}</span><span class="stat-value">${metric.value.toString().padStart(2, '0')}</span><span class="stat-footnote">${metric.note}</span></button></div>`).join('');
  const matched = filterRequests(requests, filters);
  const pages = Math.max(1, Math.ceil(matched.length / pageSize));
  page = Math.min(page, pages);
  const displayed = matched.slice((page - 1) * pageSize, page * pageSize);
  element('result-count').textContent = String(matched.length);
  element('queue-title').firstChild!.textContent = filters.status === 'all' ? 'Todas las solicitudes ' : `${filters.status === 'new' ? 'Solicitudes por atender' : filters.status === 'in_progress' ? 'Solicitudes en curso' : 'Solicitudes resueltas'} `;
  element('nav-all').classList.toggle('active', filters.status === 'all' || filters.status === 'new');
  element('nav-progress').classList.toggle('active', filters.status === 'in_progress');
  element('nav-resolved').classList.toggle('active', filters.status === 'resolved');
  if (!displayed.length) {
    element('request-list').innerHTML = `<div class="empty-state">${icon('inbox')}<h3>No hay solicitudes aquí</h3><p>${requests.length ? 'Prueba con otros filtros o crea una nueva solicitud.' : 'Crea tu primera solicitud para empezar.'}</p><button class="btn btn-outline-primary" id="clear-filters">Limpiar filtros</button></div>`;
  } else {
    element('request-list').innerHTML = `<div class="d-none d-md-block table-responsive"><table class="table queue-table"><caption class="visually-hidden">Solicitudes que coinciden con los filtros seleccionados</caption><thead><tr><th scope="col">SOLICITUD</th><th scope="col">CLIENTE</th><th scope="col">ESTADO</th><th scope="col">PRIORIDAD</th><th scope="col">FECHA</th><th scope="col"><span class="visually-hidden">Abrir</span></th></tr></thead><tbody>${displayed.map((request) => `<tr><td><span class="request-id">${escapeHtml(shortId(request.id))}</span><button class="table-open-button request-title" data-open="${escapeHtml(request.id)}">${escapeHtml(request.title)}</button><span class="request-category">${categoryLabels[request.category]}</span></td><td><div class="customer-cell"><span class="customer-avatar">${escapeHtml(initials(request.customer))}</span><span>${escapeHtml(request.customer)}</span></div></td><td>${statusBadge(request.status)}</td><td>${priorityBadge(request.priority)}</td><td class="date-cell">${dateFormat.format(new Date(request.createdAt))}</td><td><button class="btn btn-icon" data-open="${escapeHtml(request.id)}" aria-label="Abrir ${escapeHtml(request.title)}">${icon('arrow-up-right')}</button></td></tr>`).join('')}</tbody></table></div><div class="d-md-none">${displayed.map((request) => `<article class="mobile-request-card"><div class="d-flex justify-content-between align-items-center mb-2"><span class="request-id">${escapeHtml(shortId(request.id))}</span>${statusBadge(request.status)}</div><button class="table-open-button request-title" data-open="${escapeHtml(request.id)}">${escapeHtml(request.title)}</button><div class="d-flex justify-content-between align-items-center mt-3"><div class="customer-cell"><span class="customer-avatar">${escapeHtml(initials(request.customer))}</span><span>${escapeHtml(request.customer)}</span></div>${priorityBadge(request.priority)}</div></article>`).join('')}</div>`;
  }
  element('page-summary').textContent = matched.length ? `Mostrando ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, matched.length)} de ${matched.length} solicitudes` : '0 solicitudes';
  element('page-number').textContent = `${page} / ${pages}`;
  element<HTMLButtonElement>('previous-page').disabled = page <= 1;
  element<HTMLButtonElement>('next-page').disabled = page >= pages;
}

function renderDetail(request: SupportRequest) {
  element('detail-body').innerHTML = `<div class="request-id mb-2">${escapeHtml(shortId(request.id))} · ${categoryLabels[request.category]}</div><h2 id="detail-title" class="detail-title">${escapeHtml(request.title)}</h2><div class="d-flex gap-3 align-items-center mb-4">${statusBadge(request.status)}${priorityBadge(request.priority)}</div><div class="detail-meta"><div><span>CLIENTE</span><strong>${escapeHtml(request.customer)}</strong></div><div><span>CREADA</span><strong>${timeFormat.format(new Date(request.createdAt))}</strong></div></div><h3 class="section-caption mt-4">DESCRIPCIÓN</h3><p class="detail-description">${escapeHtml(request.description)}</p><div id="detail-error" class="alert alert-danger" role="alert" hidden></div><div class="resolution-panel"><h3 class="fs-6 mb-3">Siguiente paso</h3>${request.status === 'new' ? `<p class="small text-secondary">La solicitud está lista para ser atendida.</p><button class="btn btn-primary w-100" id="start-request">${icon('play')} Iniciar atención</button>` : request.status === 'in_progress' ? `<form id="resolve-form"><label class="form-label" for="resolution-note">Nota de resolución *</label><textarea class="form-control mb-3" id="resolution-note" required maxlength="2000" rows="3" placeholder="Explica cómo se resolvió la solicitud"></textarea><button class="btn btn-primary w-100" type="submit">${icon('check2')} Resolver solicitud</button></form>` : `<p class="small detail-description">${escapeHtml(request.resolution ?? 'La resolución está registrada en el historial.')}</p><button class="btn btn-outline-primary w-100" id="reopen-request">${icon('arrow-counterclockwise')} Reabrir solicitud</button>`}</div><div class="mt-4"><label class="form-label" for="detail-priority">Prioridad</label><select class="form-select" id="detail-priority">${Object.entries(priorityLabels).map(([key, value]) => `<option value="${key}" ${key === request.priority ? 'selected' : ''}>${value}</option>`).join('')}</select></div><div class="d-flex justify-content-between align-items-center mt-4 mb-3"><h3 class="fs-6 m-0">Actividad</h3><span class="text-secondary small">${request.activity.length} eventos</span></div><ol class="activity-list">${[...request.activity].reverse().map((event) => `<li class="activity-item"><span class="activity-dot">${icon(event.kind === 'comment' ? 'chat-left-text' : event.kind === 'created' ? 'plus' : 'arrow-right')}</span><div><p class="mb-1 detail-description">${escapeHtml(event.text)}</p><time class="small text-secondary" datetime="${escapeHtml(event.at)}">${timeFormat.format(new Date(event.at))}</time></div></li>`).join('')}</ol><form id="comment-form" class="mt-4"><label class="form-label" for="comment-text">Añadir comentario</label><textarea class="form-control mb-2" id="comment-text" required maxlength="2000" rows="2" placeholder="Deja una actualización para el seguimiento"></textarea><button class="btn btn-outline-primary w-100" type="submit">Añadir comentario ${icon('arrow-right')}</button></form>`;
}

function currentRequest(): SupportRequest {
  const request = requests.find((item) => item.id === selectedId);
  if (!request) throw new Error('Esta solicitud ya no está disponible.');
  return request;
}

function updateSelected(
  updater: (request: SupportRequest) => SupportRequest,
  message: string,
  options: { clearComment?: boolean; clearResolution?: boolean; focusId?: string } = {},
): boolean {
  const resolutionDraft = document.querySelector<HTMLTextAreaElement>('#resolution-note')?.value;
  const commentDraft = document.querySelector<HTMLTextAreaElement>('#comment-text')?.value;
  const previousFocusId = (document.activeElement as HTMLElement | null)?.id;
  try {
    const updated = updater(currentRequest());
    commitRequests(requests.map((request) => request.id === updated.id ? updated : request));
    renderDetail(updated);
    const resolution = document.querySelector<HTMLTextAreaElement>('#resolution-note');
    const comment = document.querySelector<HTMLTextAreaElement>('#comment-text');
    if (resolution && !options.clearResolution && resolutionDraft !== undefined) resolution.value = resolutionDraft;
    if (comment && !options.clearComment && commentDraft !== undefined) comment.value = commentDraft;
    const title = element('detail-title');
    title.tabIndex = -1;
    (document.getElementById(options.focusId ?? previousFocusId ?? '') ?? title).focus();
    notify(message);
    return true;
  } catch (error) { showError('detail-error', errorMessage(error)); return false; }
}

function setStatus(status: RequestStatus | 'all') {
  filters.status = status;
  element<HTMLSelectElement>('status-filter').value = status;
  page = 1;
  renderQueue();
}

element('search').addEventListener('input', (event) => { filters.query = (event.target as HTMLInputElement).value; page = 1; renderQueue(); });
for (const [id, key] of [['status-filter', 'status'], ['priority-filter', 'priority'], ['category-filter', 'category'], ['sort-filter', 'sort']] as const) {
  element(id).addEventListener('change', (event) => { Object.assign(filters, { [key]: (event.target as HTMLSelectElement).value }); page = 1; renderQueue(); });
}
element('nav-all').addEventListener('click', () => setStatus('all'));
element('nav-progress').addEventListener('click', () => setStatus('in_progress'));
element('nav-resolved').addEventListener('click', () => setStatus('resolved'));
element('previous-page').addEventListener('click', () => { page--; renderQueue(); });
element('next-page').addEventListener('click', () => { page++; renderQueue(); });

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const openButton = target.closest<HTMLElement>('[data-open]');
  if (openButton) {
    selectedId = openButton.dataset.open!;
    renderDetail(currentRequest());
    detailPanel.show(openButton);
    return;
  }
  const statusButton = target.closest<HTMLElement>('[data-status]');
  if (statusButton) setStatus(statusButton.dataset.status as RequestStatus | 'all');
  if (target.closest('#clear-filters')) {
    Object.assign(filters, { query: '', status: 'all', priority: 'all', category: 'all', sort: 'newest' });
    element<HTMLInputElement>('search').value = '';
    for (const id of ['status-filter', 'priority-filter', 'category-filter']) element<HTMLSelectElement>(id).value = 'all';
    element<HTMLSelectElement>('sort-filter').value = 'newest';
    page = 1; renderQueue();
  }
  if (target.closest('#start-request')) updateSelected((request) => transitionRequest(request, 'in_progress'), 'Atención iniciada.', { focusId: 'resolution-note' });
  if (target.closest('#reopen-request')) updateSelected((request) => transitionRequest(request, 'in_progress'), 'Solicitud reabierta. El historial se conserva.', { focusId: 'resolution-note' });
  if (target.closest('#backup-storage')) {
    try { download(window.localStorage.getItem(STORAGE_KEY) ?? '', 'mesa-copia-original.json'); }
    catch { notify('No se pudo acceder a la copia guardada. Revisa los permisos del navegador.'); }
  }
});

element('create-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (saving || createSubmitted) return;
  const form = event.target as HTMLFormElement;
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const input: CreateInput = { title: String(data.get('title')), customer: String(data.get('customer')), description: String(data.get('description')), priority: data.get('priority') as Priority, category: data.get('category') as Category };
  saving = true;
  element<HTMLButtonElement>('create-submit').disabled = true;
  element('create-error').hidden = true;
  try {
    const request = createRequest(input, undefined, `MS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`);
    commitRequests([request, ...requests]);
    createSubmitted = true;
    Object.assign(filters, { query: '', status: 'all', priority: 'all', category: 'all', sort: 'newest' });
    element<HTMLInputElement>('search').value = '';
    for (const id of ['status-filter', 'priority-filter', 'category-filter']) element<HTMLSelectElement>(id).value = 'all';
    element<HTMLSelectElement>('sort-filter').value = 'newest';
    page = 1; renderQueue();
    createModal.hide();
    notify('Solicitud creada. Ya está lista para atender.');
  } catch (error) { showError('create-error', errorMessage(error)); }
  finally { saving = false; element<HTMLButtonElement>('create-submit').disabled = false; }
});

element('create-modal').addEventListener('shown.bs.modal', () => element('request-title').focus());
element('create-modal').addEventListener('hidden.bs.modal', () => { element<HTMLFormElement>('create-form').reset(); element('create-error').hidden = true; createSubmitted = false; });

element('request-detail').addEventListener('hidden.bs.offcanvas', () => {
  const buttons = document.querySelectorAll<HTMLButtonElement>(`[data-open="${CSS.escape(selectedId ?? '')}"]`);
  const visibleButton = [...buttons].find((button) => button.getClientRects().length > 0);
  (visibleButton ?? element('search')).focus();
});

element('detail-body').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  if (!form.reportValidity()) return;
  if (form.id === 'resolve-form') {
    const note = element<HTMLTextAreaElement>('resolution-note').value;
    updateSelected((request) => transitionRequest(request, 'resolved', note), 'Solicitud resuelta. Buen trabajo.', { clearResolution: true, focusId: 'detail-title' });
  } else if (form.id === 'comment-form') {
    const text = element<HTMLTextAreaElement>('comment-text').value;
    updateSelected((request) => addComment(request, text), 'Comentario añadido al historial.', { clearComment: true, focusId: 'comment-text' });
  }
});
element('detail-body').addEventListener('change', (event) => {
  if ((event.target as HTMLElement).id === 'detail-priority') {
    const priority = (event.target as HTMLSelectElement).value as Priority;
    const saved = updateSelected((request) => changePriority(request, priority), 'Prioridad actualizada.', { focusId: 'detail-priority' });
    if (!saved) (event.target as HTMLSelectElement).value = currentRequest().priority;
  }
});

element('confirm-reset').addEventListener('click', () => {
  try {
    const seeds = createSeedRequests();
    saveRequests(window.localStorage, seeds);
    writesLocked = false; requests = seeds; storageWarning = ''; page = 1;
    renderNotice(); renderQueue();
    Modal.getInstance(element('reset-modal'))?.hide();
    detailPanel.hide();
    notify('Demostración restablecida.');
  } catch (error) { showError('reset-error', errorMessage(error)); }
});
element('reset-modal').addEventListener('hidden.bs.modal', () => { element('reset-error').hidden = true; });

function download(content: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
element('export-data').addEventListener('click', () => download(JSON.stringify({ version: 1, requests }, null, 2), 'mesa-solicitudes.json'));
renderNotice();
renderQueue();

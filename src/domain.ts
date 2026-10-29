import type {
  Activity,
  Category,
  CreateInput,
  Priority,
  RequestFilters,
  RequestStatus,
  SupportRequest,
} from './types';

const statuses: readonly RequestStatus[] = ['new', 'in_progress', 'resolved'];
const priorities: readonly Priority[] = ['low', 'normal', 'urgent'];
const categories: readonly Category[] = ['access', 'software', 'billing', 'other'];
const statusLabels: Record<RequestStatus, string> = {
  new: 'Nueva',
  in_progress: 'En curso',
  resolved: 'Resuelta',
};
const priorityLabels: Record<Priority, string> = {
  low: 'Baja',
  normal: 'Normal',
  urgent: 'Urgente',
};

function text(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new Error(`${field} es obligatorio.`);
  const trimmed = value.trim();
  if (trimmed.length < min) {
    throw new Error(`${field} debe tener al menos ${min} caracteres.`);
  }
  if (trimmed.length > max) {
    throw new Error(`${field} no puede superar ${max} caracteres.`);
  }
  return trimmed;
}

function oneOf<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new Error(`${label} no es válido.`);
  }
  return value as T;
}

function timestamp(now: string | undefined, previous?: string): string {
  const value = now ?? new Date().toISOString();
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('La fecha no es válida.');
  const normalized = date.toISOString();
  if (previous && date.getTime() < Date.parse(previous)) {
    throw new Error('La fecha del cambio no puede ser anterior al último cambio.');
  }
  return normalized;
}

function updated(
  request: SupportRequest,
  kind: Activity['kind'],
  message: string,
  at: string,
  changes: Partial<SupportRequest>,
): SupportRequest {
  return {
    ...request,
    ...changes,
    updatedAt: at,
    activity: [
      ...request.activity.map((event) => ({ ...event })),
      { id: `${request.id}-${kind}-${request.activity.length}`, kind, text: message, at },
    ],
  };
}

export function createRequest(input: CreateInput, now?: string, id?: string): SupportRequest {
  if (!input || typeof input !== 'object') throw new Error('La solicitud no es válida.');
  const title = text(input.title, 'El título', 3, 120);
  const customer = text(input.customer, 'El cliente', 2, 80);
  const description = text(input.description, 'La descripción', 10, 2000);
  const category = oneOf(input.category, categories, 'La categoría');
  const priority = oneOf(input.priority, priorities, 'La prioridad');
  const at = timestamp(now);
  const requestId = id === undefined
    ? `MS-${Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}`
    : text(id, 'El identificador', 1, 150);

  return {
    id: requestId,
    title,
    description,
    customer,
    category,
    priority,
    status: 'new',
    createdAt: at,
    updatedAt: at,
    resolution: null,
    activity: [{ id: `${requestId}-created-0`, kind: 'created', text: 'Solicitud creada.', at }],
  };
}

function searchable(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es').trim();
}

function deadlineTimestamp(value: string, label: string): number {
  const parts = typeof value === 'string'
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value)
    : null;
  if (!parts) throw new Error(`${label} no es válida.`);
  const [, year, month, day, hour, minute, second] = parts.map(Number);
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)
    || calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1
    || calendar.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) {
    throw new Error(`${label} no es válida.`);
  }
  return milliseconds;
}

/** Demo policy in calendar hours, always anchored to creation and the current priority. */
export function responseDueAt(request: SupportRequest): string {
  const priority = oneOf(request.priority, priorities, 'La prioridad');
  const hours: Record<Priority, number> = { urgent: 4, normal: 24, low: 72 };
  const due = deadlineTimestamp(request.createdAt, 'La fecha de creación') + hours[priority] * 60 * 60 * 1000;
  return new Date(due).toISOString();
}

export function isOverdue(request: SupportRequest, now = new Date().toISOString()): boolean {
  const status = oneOf(request.status, statuses, 'El estado');
  const due = Date.parse(responseDueAt(request));
  const current = deadlineTimestamp(now, 'La fecha de evaluación');
  return status !== 'resolved' && current >= due;
}

export function filterRequests(
  requests: readonly SupportRequest[],
  filters: RequestFilters,
  now?: string,
): SupportRequest[] {
  const query = searchable(filters.query);
  // One evaluation instant keeps all rows consistent at a deadline boundary.
  const evaluationTime = filters.overdueOnly ? now ?? new Date().toISOString() : undefined;
  if (evaluationTime !== undefined) deadlineTimestamp(evaluationTime, 'La fecha de evaluación');
  const result = requests.filter((request) => {
    const matchesText = !query || searchable(
      `${request.id} ${request.title} ${request.description} ${request.customer}`,
    ).includes(query);
    return matchesText
      && (filters.status === 'all' || request.status === filters.status)
      && (filters.priority === 'all' || request.priority === filters.priority)
      && (filters.category === 'all' || request.category === filters.category)
      && (!filters.openOnly || request.status !== 'resolved')
      && (!filters.overdueOnly || isOverdue(request, evaluationTime));
  });

  const weight: Record<Priority, number> = { urgent: 0, normal: 1, low: 2 };
  return result.sort((a, b) => {
    if (filters.sort === 'priority') {
      return weight[a.priority] - weight[b.priority]
        || Date.parse(b.createdAt) - Date.parse(a.createdAt);
    }
    return filters.sort === 'oldest'
      ? Date.parse(a.createdAt) - Date.parse(b.createdAt)
      : Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

export function transitionRequest(
  request: SupportRequest,
  next: RequestStatus,
  note?: string,
  now?: string,
): SupportRequest {
  const current = oneOf(request.status, statuses, 'El estado actual');
  oneOf(next, statuses, 'El nuevo estado');
  const allowed: Record<RequestStatus, RequestStatus[]> = {
    new: ['in_progress'],
    in_progress: ['resolved'],
    resolved: ['in_progress'],
  };
  if (!allowed[current].includes(next)) {
    throw new Error(`No se puede cambiar de ${statusLabels[current]} a ${statusLabels[next]}.`);
  }
  const resolution = next === 'resolved' ? text(note, 'La nota de resolución', 1, 2000) : null;
  const at = timestamp(now, request.updatedAt);
  const message = next === 'resolved'
    ? `Resuelta: ${resolution}`
    : current === 'resolved'
      ? 'Solicitud reabierta: Resuelta → En curso.'
      : `Estado: ${statusLabels[current]} → ${statusLabels[next]}.`;
  return updated(request, 'status', message, at, { status: next, resolution });
}

export function addComment(request: SupportRequest, value: string, now?: string): SupportRequest {
  const comment = text(value, 'El comentario', 1, 2000);
  return updated(request, 'comment', comment, timestamp(now, request.updatedAt), {});
}

export function changePriority(
  request: SupportRequest,
  priority: Priority,
  now?: string,
): SupportRequest {
  const value = oneOf(priority, priorities, 'La prioridad');
  if (value === request.priority) return request;
  return updated(
    request,
    'priority',
    `Prioridad: ${priorityLabels[request.priority]} → ${priorityLabels[value]}.`,
    timestamp(now, request.updatedAt),
    { priority: value },
  );
}

export function getStats(requests: readonly SupportRequest[]): {
  total: number;
  new: number;
  inProgress: number;
  resolved: number;
  urgent: number;
} {
  return requests.reduce((stats, request) => ({
    total: stats.total + 1,
    new: stats.new + Number(request.status === 'new'),
    inProgress: stats.inProgress + Number(request.status === 'in_progress'),
    resolved: stats.resolved + Number(request.status === 'resolved'),
    urgent: stats.urgent + Number(request.priority === 'urgent'),
  }), { total: 0, new: 0, inProgress: 0, resolved: 0, urgent: 0 });
}

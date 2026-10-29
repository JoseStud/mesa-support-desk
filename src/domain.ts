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
  const requestId = id === undefined ? `req-${crypto.randomUUID()}` : text(id, 'El identificador', 1, 150);

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

export function filterRequests(
  requests: readonly SupportRequest[],
  filters: RequestFilters,
): SupportRequest[] {
  const query = searchable(filters.query);
  const result = requests.filter((request) => {
    const matchesText = !query || searchable(
      `${request.id} ${request.title} ${request.description} ${request.customer}`,
    ).includes(query);
    return matchesText
      && (filters.status === 'all' || request.status === filters.status)
      && (filters.priority === 'all' || request.priority === filters.priority)
      && (filters.category === 'all' || request.category === filters.category);
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

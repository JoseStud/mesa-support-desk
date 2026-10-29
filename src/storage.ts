import type { Activity, SupportRequest } from './types';

export const STORAGE_KEY = 'mesa.requests.v1';

type Loaded = {
  kind: 'empty' | 'ready' | 'invalid';
  requests: SupportRequest[];
  message?: string;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function string(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value === value.trim()
    && value.length >= min && value.length <= max;
}

function date(value: unknown): value is string {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    || !Number.isFinite(Date.parse(value))
    || Number(value.slice(11, 13)) > 23) return false;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  return calendar.getUTCFullYear() === year
    && calendar.getUTCMonth() === month - 1 && calendar.getUTCDate() === day;
}

function activity(value: unknown): value is Activity {
  return record(value)
    && string(value.id, 1, 250)
    && ['created', 'status', 'comment', 'priority'].includes(value.kind as string)
    && string(value.text, 1, 2100)
    && date(value.at);
}

export function isSupportRequest(value: unknown): value is SupportRequest {
  if (!record(value)
    || (value.version !== undefined && (!Number.isSafeInteger(value.version) || (value.version as number) < 1))
    || !string(value.id, 1, 150)
    || !string(value.title, 3, 120)
    || !string(value.customer, 2, 80)
    || !string(value.description, 10, 2000)
    || !['access', 'software', 'billing', 'other'].includes(value.category as string)
    || !['low', 'normal', 'urgent'].includes(value.priority as string)
    || !['new', 'in_progress', 'resolved'].includes(value.status as string)
    || !date(value.createdAt)
    || !date(value.updatedAt)
    || Date.parse(value.updatedAt) < Date.parse(value.createdAt)
    || !Array.isArray(value.activity)
    || value.activity.length === 0
    || !value.activity.every(activity)) return false;

  if (value.status === 'resolved' ? !string(value.resolution, 1, 2000) : value.resolution !== null) {
    return false;
  }
  const events: Activity[] = value.activity;
  if (events[0].kind !== 'created'
    || Date.parse(events[0].at) !== Date.parse(value.createdAt)
    || Date.parse(events[events.length - 1].at) !== Date.parse(value.updatedAt)
    || new Set(events.map((event) => event.id)).size !== events.length) return false;
  return events.every((event, index) => Date.parse(event.at) >= Date.parse(value.createdAt as string)
    && Date.parse(event.at) <= Date.parse(value.updatedAt as string)
    && (index === 0 || Date.parse(event.at) >= Date.parse(events[index - 1].at)));
}

export function isSupportRequestList(value: unknown): value is SupportRequest[] {
  return Array.isArray(value) && value.every(isSupportRequest)
    && new Set(value.map((item) => item.id)).size === value.length;
}

export function loadRequests(storage: Pick<Storage, 'getItem'>): Loaded {
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return {
      kind: 'invalid', requests: [],
      message: 'No se pudo leer el almacenamiento local. No se han reemplazado tus datos.',
    };
  }
  if (raw === null) return { kind: 'empty', requests: [] };
  try {
    const envelope: unknown = JSON.parse(raw);
    if (record(envelope) && envelope.version === 1 && isSupportRequestList(envelope.requests)) {
      return { kind: 'ready', requests: envelope.requests };
    }
  } catch {
    // Leave malformed saved bytes untouched so the user can inspect or export them.
  }
  return {
    kind: 'invalid', requests: [],
    message: 'Los datos guardados no tienen un formato válido. No se han reemplazado. Puedes recuperarlos o restablecer los datos de demostración.',
  };
}

export function saveRequests(
  storage: Pick<Storage, 'setItem'>,
  value: readonly SupportRequest[],
): void {
  if (!isSupportRequestList(value)) throw new Error('No se guardaron los cambios: la solicitud contiene datos no válidos.');
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, requests: value }));
  } catch {
    throw new Error('No se pudieron guardar los cambios. El almacenamiento local puede estar lleno o no disponible. Conserva el formulario e inténtalo de nuevo.');
  }
}

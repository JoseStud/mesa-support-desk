import type { CreateInput, Priority, RequestStatus, SupportRequest } from './types';
import { isSupportRequest, isSupportRequestList } from './storage';

export class ApiError extends Error {
  constructor(message: string, readonly status = 0, readonly uncertain = false) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiRepository {
  list(): Promise<SupportRequest[]>;
  create(input: CreateInput, attemptKey?: string): Promise<SupportRequest>;
  transition(request: SupportRequest, status: RequestStatus, note?: string): Promise<SupportRequest>;
  comment(request: SupportRequest, text: string): Promise<SupportRequest>;
  priority(request: SupportRequest, priority: Priority): Promise<SupportRequest>;
}

function hasVersion(request: SupportRequest): boolean {
  return Number.isSafeInteger(request.version) && Number(request.version) >= 1;
}

function version(request: SupportRequest): number {
  if (!hasVersion(request)) throw new ApiError('La solicitud no tiene una versión válida. Actualiza los datos del servidor antes de cambiarla.');
  return request.version!;
}

function serverMessage(value: unknown, status: number): string {
  if (value && typeof value === 'object' && 'detail' in value
    && typeof value.detail === 'string' && value.detail.trim()) {
    return value.detail.slice(0, 600);
  }
  if (status === 409) return 'Otra sesión cambió esta solicitud. Revisa el estado actualizado antes de volver a guardar.';
  if (status === 404) return 'No se encontró la solicitud. Actualiza los datos del servidor.';
  if (status === 422) return 'El servidor no pudo validar el cambio. Revisa los campos e inténtalo de nuevo.';
  return 'El servidor no pudo completar la operación. Inténtalo de nuevo.';
}

export function createApiRepository(options: {
  fetch?: typeof globalThis.fetch;
  baseUrl?: string;
  timeoutMs?: number;
} = {}): ApiRepository {
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  const base = (options.baseUrl ?? '/api').replace(/\/$/, '');
  const timeoutMs = options.timeoutMs ?? 10000;

  async function call(path: string, method = 'GET', body?: unknown, attemptKey?: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(`${base}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(attemptKey ? { 'Idempotency-Key': attemptKey } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
        cache: 'no-store',
      });
      let value: unknown;
      try { value = await response.json(); }
      catch {
        throw new ApiError('El servidor devolvió una respuesta no válida. Actualiza los datos para confirmar el estado.', response.status, method !== 'GET' && response.ok);
      }
      if (!response.ok) throw new ApiError(serverMessage(value, response.status), response.status, method !== 'GET' && response.status >= 500);
      return value;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(controller.signal.aborted
        ? 'El servidor tardó demasiado en responder. Actualiza los datos antes de repetir un cambio.'
        : 'No se pudo conectar con el servidor. Comprueba la conexión e inténtalo de nuevo.', 0, method !== 'GET');
    } finally { clearTimeout(timer); }
  }

  function decodeRequest(value: unknown, expectedId?: string): SupportRequest {
    if (!isSupportRequest(value) || !hasVersion(value) || (expectedId !== undefined && value.id !== expectedId)) {
      throw new ApiError('La respuesta del servidor contiene una solicitud no válida. Actualiza los datos para confirmar el estado.', 0, true);
    }
    return value;
  }

  const requestPath = (request: SupportRequest, action: string) => `/requests/${encodeURIComponent(request.id)}/${action}`;
  return {
    async list() {
      const value = await call('/requests');
      if (!isSupportRequestList(value) || !value.every(hasVersion)) {
        throw new ApiError('El servidor devolvió una lista de solicitudes no válida. No se han reemplazado los datos.');
      }
      return value;
    },
    async create(input, attemptKey) {
      return decodeRequest(await call('/requests', 'POST', input, attemptKey));
    },
    async transition(request, status, note) {
      return decodeRequest(await call(requestPath(request, 'transitions'), 'POST', { status, ...(note === undefined ? {} : { note }), expectedVersion: version(request) }), request.id);
    },
    async comment(request, text) {
      return decodeRequest(await call(requestPath(request, 'comments'), 'POST', { text, expectedVersion: version(request) }), request.id);
    },
    async priority(request, priority) {
      return decodeRequest(await call(requestPath(request, 'priority'), 'PATCH', { priority, expectedVersion: version(request) }), request.id);
    },
  };
}

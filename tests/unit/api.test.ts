import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiRepository } from '../../src/api';
import { createSeedRequests } from '../../src/seed';
import type { CreateInput } from '../../src/types';

const sample = () => ({ ...createSeedRequests('2026-10-28T15:00:00.000Z')[0], version: 1 });
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

describe('server repository contract', () => {
  it('accepts an actually empty server list without inventing demo records', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response([]));
    expect(await createApiRepository({ fetch: fetcher }).list()).toEqual([]);
    expect(fetcher.mock.calls[0][0]).toBe('/api/requests');
  });

  it.each([
    { ...sample(), version: undefined },
    { ...sample(), version: 0 },
    { ...sample(), version: 1.5 },
    { ...sample(), activity: [] },
  ])('rejects malformed or unversioned server data', async (request) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response([request]));
    await expect(createApiRepository({ fetch: fetcher }).list()).rejects.toThrow('lista de solicitudes no válida');
  });

  it('sends only command fields and expected version, then uses the acknowledged server record', async () => {
    const current = sample();
    const acknowledged = { ...current, version: 2 };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(acknowledged));
    const result = await createApiRepository({ fetch: fetcher }).transition(current, 'in_progress');
    expect(result).toEqual(acknowledged);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(`/api/requests/${current.id}/transitions`);
    expect(JSON.parse(String(init?.body))).toEqual({ status: 'in_progress', expectedVersion: 1 });
    expect(current.version).toBe(1);
  });

  it('passes an idempotency key on creation without sending client-generated history or IDs', async () => {
    const input: CreateInput = { title: 'Solicitud nueva', customer: 'Cliente de prueba', description: 'Descripción de la solicitud.', category: 'access', priority: 'normal' };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(sample(), 201));
    await createApiRepository({ fetch: fetcher }).create(input, 'attempt-123');
    const init = fetcher.mock.calls[0][1];
    expect(JSON.parse(String(init?.body))).toEqual(input);
    expect(new Headers(init?.headers).get('Idempotency-Key')).toBe('attempt-123');
  });

  it('preserves the conflict status and readable server detail for explicit refresh/review', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ detail: 'La solicitud cambió en otra sesión.' }, 409));
    await expect(createApiRepository({ fetch: fetcher }).comment(sample(), 'Nota')).rejects.toMatchObject({
      status: 409, message: 'La solicitud cambió en otra sesión.', uncertain: false,
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('marks a failed write response as uncertain without replaying the command', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Network failed'));
    await expect(createApiRepository({ fetch: fetcher }).priority(sample(), 'urgent')).rejects.toMatchObject({
      status: 0, uncertain: true,
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('rejects invalid JSON after a successful write as an unconfirmed result', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>Error</html>', { status: 200 }));
    await expect(createApiRepository({ fetch: fetcher }).comment(sample(), 'Nota')).rejects.toMatchObject({ uncertain: true });
  });

  it('aborts a slow request and returns a useful timeout instead of waiting indefinitely', async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      }));
      const pending = createApiRepository({ fetch: fetcher, timeoutMs: 100 }).list();
      const assertion = expect(pending).rejects.toMatchObject({ status: 0, uncertain: false, message: expect.stringContaining('tardó demasiado') });
      await vi.advanceTimersByTimeAsync(100);
      await assertion;
      expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    } finally { vi.useRealTimers(); }
  });

  it('does not issue an unversioned mutation', async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(createApiRepository({ fetch: fetcher }).priority({ ...sample(), version: undefined }, 'urgent')).rejects.toBeInstanceOf(ApiError);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { createSeedRequests } from '../../src/seed';
import { loadRequests, saveRequests, STORAGE_KEY } from '../../src/storage';

const now = '2026-10-28T15:00:00.000Z';
const valid = () => createSeedRequests(now);
const reader = (value: string | null) => ({ getItem: vi.fn((_key: string) => value) });

describe('versioned browser storage', () => {
  it('distinguishes missing storage and a deliberately empty saved collection', () => {
    expect(loadRequests(reader(null))).toEqual({ kind: 'empty', requests: [] });
    expect(loadRequests(reader(JSON.stringify({ version: 1, requests: [] })))).toEqual({ kind: 'ready', requests: [] });
  });

  it('round-trips demo requests, dates, resolutions and history without changing input', () => {
    const requests = valid();
    const before = JSON.stringify(requests);
    const storage = { setItem: vi.fn() };
    saveRequests(storage, requests);
    expect(storage.setItem).toHaveBeenCalledOnce();
    expect(storage.setItem.mock.calls[0][0]).toBe(STORAGE_KEY);
    const stored = storage.setItem.mock.calls[0][1];
    expect(loadRequests(reader(stored))).toEqual({ kind: 'ready', requests });
    expect(JSON.stringify(requests)).toBe(before);
  });

  it.each([
    '', '{broken', 'null', '[]',
    JSON.stringify({ version: 2, requests: [] }),
    JSON.stringify({ version: 1, requests: [{}] }),
  ])('leaves corrupt or unsupported saved content untouched: %s', (raw) => {
    const storage = { ...reader(raw), setItem: vi.fn() };
    const loaded = loadRequests(storage);
    expect(loaded.kind).toBe('invalid');
    expect(loaded.message).toBeTruthy();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it.each([
    ['invalid request date', (requests: ReturnType<typeof valid>) => { requests[0].createdAt = 'not-a-date'; }],
    ['impossible calendar date', (requests: ReturnType<typeof valid>) => { requests[0].createdAt = '2026-02-31T00:00:00.000Z'; }],
    ['noncanonical midnight accepted by Date.parse', (requests: ReturnType<typeof valid>) => {
      const endOfDay = '2026-10-28T24:00:00Z';
      requests[0].createdAt = endOfDay;
      requests[0].updatedAt = endOfDay;
      requests[0].activity[0].at = endOfDay;
    }],
    ['invalid activity timestamp', (requests: ReturnType<typeof valid>) => { requests[0].activity[0].at = 'yesterday'; }],
    ['missing history', (requests: ReturnType<typeof valid>) => { requests[0].activity = []; }],
    ['activity later than update', (requests: ReturnType<typeof valid>) => { requests[0].activity[0].at = '2027-01-01T00:00:00.000Z'; }],
    ['duplicate request identifiers', (requests: ReturnType<typeof valid>) => { requests[1].id = requests[0].id; }],
    ['resolved request without note', (requests: ReturnType<typeof valid>) => { requests[2].resolution = null; }],
  ])('rejects %s rather than importing a partial schema', (_label, corrupt) => {
    const requests = valid();
    corrupt(requests);
    expect(loadRequests(reader(JSON.stringify({ version: 1, requests }))).kind).toBe('invalid');
  });

  it('returns a readable recovery state when reading storage is unavailable', () => {
    const loaded = loadRequests({ getItem: () => { throw new Error('Storage blocked'); } });
    expect(loaded.kind).toBe('invalid');
    expect(loaded.message).toContain('No se pudo leer');
  });

  it('throws a readable save error on quota failures and supports a successful retry', () => {
    const requests = valid();
    const before = JSON.stringify(requests);
    const setItem = vi.fn().mockImplementationOnce(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    expect(() => saveRequests({ setItem }, requests)).toThrow('No se pudieron guardar los cambios');
    expect(JSON.stringify(requests)).toBe(before);
    expect(() => saveRequests({ setItem }, requests)).not.toThrow();
    expect(setItem).toHaveBeenCalledTimes(2);
  });

  it('refuses invalid data before touching browser storage', () => {
    const requests = valid();
    requests[0].title = '';
    const setItem = vi.fn();
    expect(() => saveRequests({ setItem }, requests)).toThrow('datos no válidos');
    expect(setItem).not.toHaveBeenCalled();
  });
});

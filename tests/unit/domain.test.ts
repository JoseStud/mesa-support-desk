import { describe, expect, it } from 'vitest';
import {
  addComment, changePriority, createRequest, filterRequests, getStats, transitionRequest,
} from '../../src/domain';
import { createSeedRequests } from '../../src/seed';
import type { CreateInput, RequestFilters, RequestStatus } from '../../src/types';

const now = '2026-10-28T15:00:00.000Z';
const later = '2026-10-28T16:00:00.000Z';
const input: CreateInput = {
  title: 'Error de acceso', description: 'No se puede entrar al panel de pedidos.',
  customer: 'Café de prueba', category: 'access', priority: 'normal',
};
const filters: RequestFilters = { query: '', status: 'all', priority: 'all', category: 'all', sort: 'newest' };

describe('request creation and validation', () => {
  it('trims input and records the initial event without changing the supplied input', () => {
    const dirty = { ...input, title: `  ${input.title}  `, description: ` ${input.description} ` };
    const result = createRequest(Object.freeze(dirty), now, 'test-1');
    expect(result).toMatchObject({ title: input.title, description: input.description, status: 'new', resolution: null });
    expect(result.activity).toHaveLength(1);
    expect(result.activity[0]).toMatchObject({ kind: 'created', at: now });
    expect(dirty.title).toBe(`  ${input.title}  `);
  });

  it.each([
    ['title', '  '], ['title', 'x'.repeat(121)], ['customer', 'x'],
    ['customer', 'x'.repeat(81)], ['description', 'corta'], ['description', 'x'.repeat(2001)],
    ['category', 'unsupported'], ['priority', 'critical'],
  ])('rejects invalid %s values', (field, value) => {
    expect(() => createRequest({ ...input, [field]: value }, now, 'test-1')).toThrow();
  });
});

describe('request lifecycle', () => {
  it('requires starting work and a resolution note, and preserves the resolution after reopening', () => {
    const original = createRequest(input, now, 'test-1');
    Object.freeze(original.activity[0]);
    Object.freeze(original.activity);
    Object.freeze(original);
    expect(() => transitionRequest(original, 'resolved', 'Solucionado', later)).toThrow();
    expect(() => transitionRequest(original, 'new', undefined, later)).toThrow();
    const started = transitionRequest(original, 'in_progress', undefined, later);
    expect(() => transitionRequest(started, 'resolved', '  ', later)).toThrow();
    const resolved = transitionRequest(started, 'resolved', '  Acceso restablecido.  ', later);
    const reopened = transitionRequest(resolved, 'in_progress', undefined, later);
    expect(resolved.resolution).toBe('Acceso restablecido.');
    expect(reopened.resolution).toBeNull();
    expect(reopened.activity.some((event) => event.text.includes('Acceso restablecido.'))).toBe(true);
    expect(reopened.activity).toHaveLength(4);
    expect(original.status).toBe('new');
    expect(original.activity).toHaveLength(1);
  });

  it('rejects unknown states and changes predating the previous event', () => {
    const original = createRequest(input, now, 'test-1');
    expect(() => transitionRequest(original, 'unknown' as RequestStatus)).toThrow();
    expect(() => addComment(original, 'Comentario', '2026-10-27T00:00:00.000Z')).toThrow();
  });

  it('records meaningful comments and priority changes immutably', () => {
    const original = createRequest(input, now, 'test-1');
    const commented = addComment(original, '  Se confirmó el problema.  ', later);
    const changed = changePriority(commented, 'urgent', later);
    expect(changed.activity.slice(1).map((event) => event.kind)).toEqual(['comment', 'priority']);
    expect(changed.activity[1].text).toBe('Se confirmó el problema.');
    expect(changed.priority).toBe('urgent');
    expect(original.priority).toBe('normal');
    expect(original.activity).toHaveLength(1);
    expect(() => addComment(original, '  ', later)).toThrow();
    expect(() => changePriority(original, 'invalid' as 'urgent', later)).toThrow();
  });
});

describe('filtering and summaries', () => {
  it('combines normalized text, status, priority and category without changing the input', () => {
    const access = createRequest(input, now, 'access');
    const resolved = transitionRequest(transitionRequest(createRequest({ ...input, title: 'Error de impresión' }, now, 'resolved'), 'in_progress', undefined, later), 'resolved', 'Corregido', later);
    const unrelated = createRequest({ ...input, title: 'Actualizar perfil' }, now, 'profile');
    const collection = Object.freeze([unrelated, resolved, access]);
    const before = JSON.stringify(collection);
    expect(filterRequests(collection, { ...filters, query: '  ERROR  ', status: 'new', priority: 'normal', category: 'access' }).map((item) => item.id)).toEqual(['access']);
    expect(filterRequests(collection, { ...filters, query: 'cafe' })).toHaveLength(3);
    expect(JSON.stringify(collection)).toBe(before);
  });

  it('sorts by priority then creation date, and sorts equal dates stably', () => {
    const normal = createRequest(input, now, 'normal');
    const urgentOld = createRequest({ ...input, priority: 'urgent' }, now, 'urgent-old');
    const urgentNew = createRequest({ ...input, priority: 'urgent' }, later, 'urgent-new');
    expect(filterRequests([normal, urgentOld, urgentNew], { ...filters, sort: 'priority' }).map((item) => item.id)).toEqual(['urgent-new', 'urgent-old', 'normal']);
    expect(filterRequests([normal, urgentOld], filters).map((item) => item.id)).toEqual(['normal', 'urgent-old']);
  });

  it('summarizes seeded data and creates fresh valid demo data each time', () => {
    const requests = createSeedRequests(now);
    expect(getStats(requests)).toEqual({ total: 8, new: 3, inProgress: 3, resolved: 2, urgent: 2 });
    expect(new Set(requests.map((item) => item.id)).size).toBe(8);
    expect(createSeedRequests(now)).toEqual(requests);
    expect(createSeedRequests(now)[0]).not.toBe(requests[0]);
  });
});

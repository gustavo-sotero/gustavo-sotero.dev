/**
 * Unit tests for comments repository helpers.
 *
 * Focuses on `buildCommentTree` — the pure in-memory tree builder.
 * No database access; all inputs are constructed inline.
 */

import { describe, expect, it } from 'vitest';
import { buildCommentTree } from './comments.repo';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Safely retrieve a typed element from an array.
 * Throws a descriptive error if the slot is empty (noUncheckedIndexedAccess-safe).
 */
function at<T>(arr: T[], idx: number): NonNullable<T> {
  const item = arr[idx];
  if (item === undefined || item === null) {
    throw new Error(
      `Expected element at index ${idx} to exist, but array has length ${arr.length}`
    );
  }
  return item;
}

/** Build a minimal comment row for testing. */
function makeRow(
  id: string,
  parentCommentId: string | null,
  createdAt: Date = new Date('2026-01-01')
) {
  return {
    id,
    postId: 1,
    parentCommentId,
    authorName: `Author ${id}`,
    authorRole: 'guest' as const,
    content: `Content ${id}`,
    renderedContent: `<p>Content ${id}</p>`,
    status: 'approved' as const,
    createdAt,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildCommentTree', () => {
  it('returns an empty array for empty input', () => {
    expect(buildCommentTree([])).toEqual([]);
  });

  it('returns a single root node with no replies', () => {
    const rows = [makeRow('r1', null)];
    const tree = buildCommentTree(rows);

    expect(tree).toHaveLength(1);
    expect(at(tree, 0).id).toBe('r1');
    expect(at(tree, 0).replies).toEqual([]);
    expect(at(tree, 0).parentCommentId).toBeNull();
  });

  it('returns multiple root nodes for flat comments (no replies)', () => {
    const rows = [makeRow('r1', null), makeRow('r2', null), makeRow('r3', null)];
    const tree = buildCommentTree(rows);

    expect(tree).toHaveLength(3);
    expect(tree.map((n) => n.id)).toEqual(['r1', 'r2', 'r3']);
    for (const node of tree) {
      expect(node.replies).toEqual([]);
    }
  });

  it('nests a direct reply under its parent', () => {
    const rows = [makeRow('r1', null), makeRow('c1', 'r1')];
    const tree = buildCommentTree(rows);

    expect(tree).toHaveLength(1);
    expect(at(tree, 0).id).toBe('r1');
    expect(at(tree, 0).replies).toHaveLength(1);
    expect(at(at(tree, 0).replies, 0).id).toBe('c1');
    expect(at(at(tree, 0).replies, 0).replies).toEqual([]);
  });

  it('nests multiple direct replies under the same parent', () => {
    const rows = [
      makeRow('r1', null),
      makeRow('c1', 'r1'),
      makeRow('c2', 'r1'),
      makeRow('c3', 'r1'),
    ];
    const tree = buildCommentTree(rows);

    expect(tree).toHaveLength(1);
    expect(at(tree, 0).replies).toHaveLength(3);
    expect(at(tree, 0).replies.map((n) => n.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('builds a three-level nested tree', () => {
    const rows = [makeRow('r1', null), makeRow('c1', 'r1'), makeRow('gc1', 'c1')];
    const tree = buildCommentTree(rows);

    expect(tree).toHaveLength(1);
    const root = at(tree, 0);
    expect(root.replies).toHaveLength(1);

    const child = at(root.replies, 0);
    expect(child.id).toBe('c1');
    expect(child.replies).toHaveLength(1);
    expect(at(child.replies, 0).id).toBe('gc1');
    expect(at(child.replies, 0).replies).toEqual([]);
  });

  it('handles multiple roots each with their own sub-trees', () => {
    const rows = [
      makeRow('r1', null),
      makeRow('r2', null),
      makeRow('c1', 'r1'),
      makeRow('c2', 'r1'),
      makeRow('c3', 'r2'),
    ];
    const tree = buildCommentTree(rows);

    expect(tree).toHaveLength(2);

    const root1 = tree.find((n) => n.id === 'r1');
    const root2 = tree.find((n) => n.id === 'r2');

    expect(root1).toBeDefined();
    expect(root2).toBeDefined();
    expect(root1?.replies.map((n) => n.id)).toEqual(['c1', 'c2']);
    expect(root2?.replies.map((n) => n.id)).toEqual(['c3']);
  });

  it('promotes orphaned children to root when their parent is absent', () => {
    // 'c1' claims a parent that is NOT in the rows (e.g. was deleted)
    const rows = [makeRow('r1', null), makeRow('c1', 'missing-parent-id')];
    const tree = buildCommentTree(rows);

    // Both should appear as roots since the parent is not found
    expect(tree).toHaveLength(2);
    const ids = tree.map((n) => n.id);
    expect(ids).toContain('r1');
    expect(ids).toContain('c1');
  });

  it('serialises createdAt as ISO string on the node', () => {
    const date = new Date('2026-02-15T10:30:00.000Z');
    const rows = [makeRow('r1', null, date)];
    const tree = buildCommentTree(rows);

    expect(at(tree, 0).createdAt).toBe('2026-02-15T10:30:00.000Z');
  });

  it('marks admin-authored nodes with authorRole=admin', () => {
    const row = { ...makeRow('r1', null), authorRole: 'admin' as const };
    const tree = buildCommentTree([row]);

    expect(at(tree, 0).authorRole).toBe('admin');
  });

  it('preserves renderedContent on each node', () => {
    const row = { ...makeRow('r1', null), renderedContent: '<p>hello</p>' };
    const tree = buildCommentTree([row]);

    expect(at(tree, 0).renderedContent).toBe('<p>hello</p>');
  });

  it('does not mutate the input array', () => {
    const rows = [makeRow('r1', null), makeRow('c1', 'r1')];
    const original = [...rows];
    buildCommentTree(rows);

    expect(rows).toEqual(original);
  });
});

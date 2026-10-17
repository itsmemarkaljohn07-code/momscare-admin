'use client';

import { useState } from 'react';

/**
 * Shows a growing list in pages: the first `pageSize` items, then
 * `pageSize` more on each loadMore(). Changing `resetKey` (e.g. the search
 * text or a filter) starts again from the first page. Pair with
 * <LoadMoreButton />.
 */
export function useLoadMore<T>(items: T[], pageSize = 20, resetKey = '') {
  const [state, setState] = useState({ key: resetKey, count: pageSize });

  // Reset when the search/filter changes, computed during render (no
  // effect needed).
  let count = state.count;
  if (state.key !== resetKey) {
    count = pageSize;
    setState({ key: resetKey, count: pageSize });
  }

  return {
    visible: items.slice(0, count),
    hasMore: items.length > count,
    shown: Math.min(count, items.length),
    total: items.length,
    loadMore: () => setState((s) => ({ ...s, count: s.count + pageSize })),
  };
}

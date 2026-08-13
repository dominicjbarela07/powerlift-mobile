export type MovementHistoryPageAnchor = Readonly<{
  cursor: string | null;
  contextToken: string | null;
}>;

export type MovementHistoryRequestIdentity = Readonly<{
  generation: number;
  requestId: number;
  queryKey: string;
  kind: 'full' | 'page';
  cursor: string | null;
  contextToken: string | null;
}>;

export type EmptyMovementHistoryPageState<T> = Readonly<{
  items: T[];
  cursor: null;
  contextToken: null;
  hasMore: false;
  error: null;
}>;

export function emptyMovementHistoryPageState<T>(): EmptyMovementHistoryPageState<T> {
  return { items: [], cursor: null, contextToken: null, hasMore: false, error: null };
}

export class MovementHistoryRequestGuard {
  private mounted = true;
  private generation = 0;
  private requestSequence = 0;
  private activeQueryKey = '';
  private activeFullRequestId = 0;
  private activePageRequestId = 0;

  mount() {
    this.mounted = true;
  }

  unmount() {
    this.mounted = false;
    this.generation += 1;
    this.activeFullRequestId = 0;
    this.activePageRequestId = 0;
  }

  beginFull(queryKey: string): MovementHistoryRequestIdentity {
    this.generation += 1;
    this.requestSequence += 1;
    this.activeQueryKey = queryKey;
    this.activeFullRequestId = this.requestSequence;
    this.activePageRequestId = 0;
    return {
      generation: this.generation,
      requestId: this.requestSequence,
      queryKey,
      kind: 'full',
      cursor: null,
      contextToken: null,
    };
  }

  beginPage(queryKey: string, anchor: MovementHistoryPageAnchor): MovementHistoryRequestIdentity {
    this.requestSequence += 1;
    this.activePageRequestId = this.requestSequence;
    return {
      generation: this.generation,
      requestId: this.requestSequence,
      queryKey,
      kind: 'page',
      cursor: anchor.cursor,
      contextToken: anchor.contextToken,
    };
  }

  isCurrent(request: MovementHistoryRequestIdentity, anchor?: MovementHistoryPageAnchor): boolean {
    if (
      !this.mounted
      || request.generation !== this.generation
      || request.queryKey !== this.activeQueryKey
    ) return false;
    if (request.kind === 'full') return request.requestId === this.activeFullRequestId;
    return request.requestId === this.activePageRequestId
      && !!anchor
      && request.cursor === anchor.cursor
      && request.contextToken === anchor.contextToken;
  }
}

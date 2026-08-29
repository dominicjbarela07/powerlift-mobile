export type ProgrammingWeekCopyAction = 'copy-from' | 'copy-to';

export type ProgrammingWeekCopyCandidate = {
  key: string;
  blockId: number;
  blockName: string;
  blockOrder: number;
  weekIndex: number;
  startDate: string;
  sessionCount: number;
};

function compareIsoDate(left: string, right: string) {
  return left.localeCompare(right);
}

/**
 * Product ranking for the Copy Week picker. The server remains authoritative
 * for whether a source/destination is valid; this only makes the useful weeks
 * discoverable without changing copy semantics.
 */
export function rankProgrammingWeekCopyCandidates(
  action: ProgrammingWeekCopyAction,
  anchor: ProgrammingWeekCopyCandidate,
  candidates: ProgrammingWeekCopyCandidate[],
) {
  return candidates
    .filter((candidate) => action !== 'copy-from' || candidate.sessionCount > 0)
    .slice()
    .sort((left, right) => {
      if (action === 'copy-from') {
        const sourceBucket = (candidate: ProgrammingWeekCopyCandidate) => {
          if (candidate.blockId === anchor.blockId) return 0;
          if (compareIsoDate(candidate.startDate, anchor.startDate) < 0) return 1;
          return 2;
        };
        const bucketDelta = sourceBucket(left) - sourceBucket(right);
        if (bucketDelta) return bucketDelta;
        if (left.blockId === anchor.blockId && right.blockId === anchor.blockId) {
          const distanceDelta = Math.abs(left.weekIndex - anchor.weekIndex) - Math.abs(right.weekIndex - anchor.weekIndex);
          if (distanceDelta) return distanceDelta;
        }
        return compareIsoDate(right.startDate, left.startDate);
      }

      const destinationBucket = (candidate: ProgrammingWeekCopyCandidate) => {
        if (!candidate.sessionCount && compareIsoDate(candidate.startDate, anchor.startDate) > 0) return 0;
        if (!candidate.sessionCount && candidate.blockId === anchor.blockId) return 1;
        if (!candidate.sessionCount) return 2;
        return 3;
      };
      const bucketDelta = destinationBucket(left) - destinationBucket(right);
      if (bucketDelta) return bucketDelta;
      const blockDelta = Number(right.blockId === anchor.blockId) - Number(left.blockId === anchor.blockId);
      if (blockDelta) return blockDelta;
      const leftFuture = compareIsoDate(left.startDate, anchor.startDate) > 0;
      const rightFuture = compareIsoDate(right.startDate, anchor.startDate) > 0;
      if (leftFuture !== rightFuture) return leftFuture ? -1 : 1;
      return leftFuture
        ? compareIsoDate(left.startDate, right.startDate)
        : compareIsoDate(right.startDate, left.startDate);
    });
}

const LEADING_WEEK_IDENTITY = /^(?:week|wk|w)[-_\s]*\d+\b\s*(?:[-–—:]\s*)?/i;

/** Removes only a clear leading week identity for compact candidate previews. */
export function compactCopiedSessionTitle(title: string) {
  const compact = title.trim().replace(LEADING_WEEK_IDENTITY, '').trim();
  return compact || title.trim();
}


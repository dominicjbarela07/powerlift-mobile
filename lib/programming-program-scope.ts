export type ProgramScopedBlock = {
  id: number;
  training_program_id?: number | null;
};

export type ProgramScopedSession = {
  training_block_id?: number | null;
};

export type ProgramScopedCurrentBlock = {
  id?: number | null;
} | null;

export type ProgramScopedSessionMap<TSession extends ProgramScopedSession> = Record<string, TSession[]>;

export function scopeProgrammingPayload<
  TBlock extends ProgramScopedBlock,
  TSession extends ProgramScopedSession,
  TCurrentBlock extends Exclude<ProgramScopedCurrentBlock, null>,
>({
  activeProgramId,
  blocks,
  pendingMap,
  completedMap,
  currentBlock,
}: {
  activeProgramId?: number | null;
  blocks?: TBlock[] | null;
  pendingMap?: ProgramScopedSessionMap<TSession> | null;
  completedMap?: ProgramScopedSessionMap<TSession> | null;
  currentBlock?: TCurrentBlock | null;
}) {
  const programId = Number(activeProgramId);
  if (!Number.isInteger(programId) || programId <= 0) {
    return {
      blocks: [] as TBlock[],
      pendingMap: {} as ProgramScopedSessionMap<TSession>,
      completedMap: {} as ProgramScopedSessionMap<TSession>,
      currentBlock: null,
    };
  }

  const scopedBlocks = (blocks || []).filter(
    (block) => Number(block.training_program_id) === programId,
  );
  const scopedBlockIds = new Set(scopedBlocks.map((block) => Number(block.id)));

  const scopeMap = (
    source: ProgramScopedSessionMap<TSession> | null | undefined,
  ): ProgramScopedSessionMap<TSession> => Object.fromEntries(
    scopedBlocks.map((block) => {
      const blockId = Number(block.id);
      const sessions = Array.isArray(source?.[String(blockId)])
        ? source![String(blockId)].filter(
          (session) => Number(session.training_block_id) === blockId,
        )
        : [];
      return [String(blockId), sessions];
    }),
  );

  const currentBlockId = Number(currentBlock?.id);
  return {
    blocks: scopedBlocks,
    pendingMap: scopeMap(pendingMap),
    completedMap: scopeMap(completedMap),
    currentBlock: Number.isInteger(currentBlockId) && scopedBlockIds.has(currentBlockId)
      ? currentBlock ?? null
      : null,
  };
}

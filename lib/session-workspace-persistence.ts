export type SessionWorkspacePersistedMetadata = {
  title: string;
  athleteId: number | null;
  scheduledDate: string;
  notes: string;
};

export type SessionWorkspaceMetadataPatch = {
  title?: string;
  athleteId?: number | null;
  scheduledDate?: string;
  notes?: string;
};

export function sessionWorkspaceMetadataIsDirty(
  current: SessionWorkspacePersistedMetadata,
  persisted: SessionWorkspacePersistedMetadata,
) {
  return current.title.trim() !== persisted.title.trim()
    || current.athleteId !== persisted.athleteId
    || current.scheduledDate !== persisted.scheduledDate
    || current.notes.trim() !== persisted.notes.trim();
}

export function buildSessionWorkspaceMetadataPatch(
  current: SessionWorkspacePersistedMetadata,
  persisted: SessionWorkspacePersistedMetadata,
): SessionWorkspaceMetadataPatch {
  return {
    ...(current.title.trim() !== persisted.title.trim() ? { title: current.title.trim() } : {}),
    ...(current.athleteId !== persisted.athleteId ? { athleteId: current.athleteId } : {}),
    ...(current.scheduledDate !== persisted.scheduledDate ? { scheduledDate: current.scheduledDate } : {}),
    ...(current.notes.trim() !== persisted.notes.trim() ? { notes: current.notes } : {}),
  };
}

import React, { createContext, useContext, type ReactNode } from 'react';

export type SLMotionPreviewOverrides = {
  playbackRate: number;
  entranceMs: number;
  stateMs: number;
  spatialMs: number;
  staggerMs: number;
  phaseDelayMs: number;
  spring: { stiffness: number; damping: number; mass: number };
  /** DEV-workshop geometry. Production primitives can safely ignore these. */
  distancePx?: number;
  overshootPx?: number;
  emphasisScale?: number;
};

const MotionPreviewContext = createContext<SLMotionPreviewOverrides | null>(null);

export function SLMotionPreviewProvider({ overrides, children }: { overrides: SLMotionPreviewOverrides; children: ReactNode }) {
  return <MotionPreviewContext.Provider value={overrides}>{children}</MotionPreviewContext.Provider>;
}

/** Returns null in production unless a DEV preview explicitly supplies overrides. */
export function useSLMotionPreviewOverrides() {
  return useContext(MotionPreviewContext);
}

export function previewMotionDuration(durationMs: number, overrides: SLMotionPreviewOverrides | null) {
  return Math.round(durationMs / Math.max(0.1, overrides?.playbackRate ?? 1));
}

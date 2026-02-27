import { EventEmitter } from 'eventemitter3';

/**
 * Standard render statuses shared across Client and Server renderers.
 */
export const RenderStatus = {
  Queued: 'queued',
  Rendering: 'rendering',
  Done: 'done',
  Failed: 'failed',
  Cancelled: 'cancelled',
} as const;

export type RenderStatus = (typeof RenderStatus)[keyof typeof RenderStatus];

/**
 * Event payload for progress updates.
 */
export interface ProgressEventPayload {
  percent: number; // 0 to 100
  status: RenderStatus;
  message?: string;
}

/**
 * Event payload for render mode decisions (auto-switch logic).
 */
export interface DecisionEventPayload {
  mode: 'local' | 'remote';
  reason: string;
  metrics: Record<string, unknown>; // e.g., { clientTier: 'low', serverLoad: 0.8 }
}

/**
 * Event payload for errors.
 */
export interface ErrorEventPayload {
  error: Error;
  code?: string;
}

/**
 * Event payload for successful completion.
 * The result type is generic as Client produces Blob/URL and Server produces file path/URL.
 */
export interface CompleteEventPayload<TResult = unknown> {
  result: TResult;
}

/**
 * Strict typing for the event emitter.
 */
export interface RenderEvents<TResult = unknown> {
  progress: (payload: ProgressEventPayload) => void;
  decision: (payload: DecisionEventPayload) => void;
  error: (payload: ErrorEventPayload) => void;
  complete: (payload: CompleteEventPayload<TResult>) => void;
}

/**
 * Base class for all renderers (Client, Server, Auto) to ensure consistent event API.
 */
export class RenderEventEmitter<TResult = unknown> extends EventEmitter<RenderEvents<TResult>> {
  // Add helper methods if needed, but currently just enforcing the interface is enough.
}

import { describe, it, expect, vi } from 'vitest';
import { RenderEventEmitter, RenderStatus } from './index.js';

describe('RenderEventEmitter', () => {
  it('extends EventEmitter and can be instantiated', () => {
    const emitter = new RenderEventEmitter();
    expect(emitter).toBeDefined();
    expect(emitter.on).toBeInstanceOf(Function);
    expect(emitter.emit).toBeInstanceOf(Function);
  });

  it('emits progress events with correct payload', () => {
    const emitter = new RenderEventEmitter();
    const handler = vi.fn();

    emitter.on('progress', handler);

    const payload = {
      percent: 50,
      status: RenderStatus.Rendering,
      message: 'Processing frame 100',
    };

    emitter.emit('progress', payload);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('emits decision events with metrics', () => {
    const emitter = new RenderEventEmitter();
    const handler = vi.fn();

    emitter.on('decision', handler);

    const payload = {
      mode: 'local' as const,
      reason: 'Client hardware sufficient',
      metrics: {
        clientTier: 'high',
        availableMemory: 8192,
      },
    };

    emitter.emit('decision', payload);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('emits error events', () => {
    const emitter = new RenderEventEmitter();
    const handler = vi.fn();

    emitter.on('error', handler);

    const error = new Error('Something went wrong');
    const payload = { error, code: 'RENDER_FAILED' };

    emitter.emit('error', payload);

    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('emits complete events with generic result', () => {
    // Test with string result (e.g. file path)
    const stringEmitter = new RenderEventEmitter<string>();
    const stringHandler = vi.fn();
    stringEmitter.on('complete', stringHandler);
    stringEmitter.emit('complete', { result: '/tmp/video.mp4' });
    expect(stringHandler).toHaveBeenCalledWith({ result: '/tmp/video.mp4' });

    // Test with object result (e.g. complex object)
    const objEmitter = new RenderEventEmitter<{ blobUrl: string }>();
    const objHandler = vi.fn();
    objEmitter.on('complete', objHandler);
    objEmitter.emit('complete', { result: { blobUrl: 'blob:...' } });
    expect(objHandler).toHaveBeenCalledWith({ result: { blobUrl: 'blob:...' } });
  });

  it('allows multiple listeners', () => {
    const emitter = new RenderEventEmitter();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    emitter.on('progress', handler1);
    emitter.on('progress', handler2);

    emitter.emit('progress', { percent: 10, status: RenderStatus.Rendering });

    expect(handler1).toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();
  });

  it('removes listeners correctly', () => {
    const emitter = new RenderEventEmitter();
    const handler = vi.fn();

    emitter.on('progress', handler);
    emitter.off('progress', handler);

    emitter.emit('progress', { percent: 10, status: RenderStatus.Rendering });

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('RenderStatus', () => {
  it('has correct values', () => {
    expect(RenderStatus.Queued).toBe('queued');
    expect(RenderStatus.Rendering).toBe('rendering');
    expect(RenderStatus.Done).toBe('done');
    expect(RenderStatus.Failed).toBe('failed');
    expect(RenderStatus.Cancelled).toBe('cancelled');
  });
});

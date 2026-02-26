import { describe, it, expect } from 'vitest';
import { VideoProjectSchema, ClipSchema, EffectSchema } from './index.js';

describe('Schema Validation', () => {
  describe('VideoProjectSchema', () => {
    it('should validate a correct project', () => {
      const validProject = {
        id: 'proj-1',
        version: '0.1.0',
        settings: { width: 1920, height: 1080, fps: 30 },
        tracks: [
          {
            id: 'track-1',
            zIndex: 1,
            clips: [
              {
                id: 'clip-1',
                type: 'video',
                start: 0,
                duration: 5,
                src: 'https://example.com/video.mp4',
                position: { x: 0, y: 0 },
                scale: 1,
              },
            ],
          },
        ],
      };

      const result = VideoProjectSchema.safeParse(validProject);
      expect(result.success).toBe(true);
    });

    it('should fail on unsupported version', () => {
      const invalidProject = {
        id: 'proj-2',
        version: '0.2.0', // Invalid version
        settings: { width: 1920, height: 1080 },
        tracks: [],
      };

      const result = VideoProjectSchema.safeParse(invalidProject);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("Project version must be '0.1.0'");
      }
    });

    it('should validate output settings', () => {
      const invalidSettings = {
        id: 'proj-3',
        version: '0.1.0',
        settings: { width: -100, height: 1080 }, // Negative width
        tracks: [],
      };

      const result = VideoProjectSchema.safeParse(invalidSettings);
      expect(result.success).toBe(false);
    });
  });

  describe('ClipSchema', () => {
    it('should validate video clip', () => {
      const videoClip = {
        id: 'v1',
        type: 'video',
        start: 0,
        duration: 10,
        src: 'https://video.com/1.mp4',
        trimStart: 2,
        volume: 0.8,
      };
      expect(ClipSchema.safeParse(videoClip).success).toBe(true);
    });

    it('should validate audio clip', () => {
      const audioClip = {
        id: 'a1',
        type: 'audio',
        start: 0,
        duration: 20,
        src: 'https://audio.com/1.mp3',
        volume: 1,
      };
      expect(ClipSchema.safeParse(audioClip).success).toBe(true);
    });

    it('should validate text clip', () => {
      const textClip = {
        id: 't1',
        type: 'text',
        start: 5,
        duration: 5,
        content: 'Hello World',
        fontSize: 24,
        color: '#FFFFFF',
      };
      expect(ClipSchema.safeParse(textClip).success).toBe(true);
    });

    it('should fail if missing required specific fields', () => {
      const invalidVideo = {
        id: 'v2',
        type: 'video',
        start: 0,
        duration: 10,
        // missing src
      };
      expect(ClipSchema.safeParse(invalidVideo).success).toBe(false);
    });
  });

  describe('EffectSchema', () => {
    it('should validate fade effect', () => {
      const fade = {
        id: 'e1',
        type: 'fade',
        duration: 1,
        direction: 'in',
      };
      expect(EffectSchema.safeParse(fade).success).toBe(true);
    });

    it('should validate blur effect', () => {
      const blur = {
        id: 'e2',
        type: 'blur',
        radius: 10,
      };
      expect(EffectSchema.safeParse(blur).success).toBe(true);
    });
  });
});

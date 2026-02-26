import { z } from 'zod';

// ==========================================
// 1. Output Settings
// ==========================================
export const OutputSettingsSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().positive().default(30),
  format: z.enum(['mp4', 'webm']).default('mp4'),
});

export type OutputSettings = z.infer<typeof OutputSettingsSchema>;

// ==========================================
// 2. Effects
// ==========================================
const FadeEffectSchema = z.object({
  id: z.string(),
  type: z.literal('fade'),
  duration: z.number().positive(), // in seconds
  direction: z.enum(['in', 'out']),
});

const BlurEffectSchema = z.object({
  id: z.string(),
  type: z.literal('blur'),
  radius: z.number().nonnegative(),
});

export const EffectSchema = z.discriminatedUnion('type', [FadeEffectSchema, BlurEffectSchema]);

export type Effect = z.infer<typeof EffectSchema>;

// ==========================================
// 3. Clips
// ==========================================

// Base fields for all clips
const BaseClipSchema = z.object({
  id: z.string(),
  start: z.number().nonnegative(), // timeline start time in seconds
  duration: z.number().positive(), // duration in seconds
});

// Visual fields (for Video, Image, Text)
const VisualClipMixin = z.object({
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .default({ x: 0, y: 0 }),
  scale: z.number().default(1),
  rotation: z.number().default(0), // degrees
  opacity: z.number().min(0).max(1).default(1),
  effects: z.array(EffectSchema).default([]),
});

// -- Video Clip --
export const VideoClipSchema = BaseClipSchema.merge(VisualClipMixin).extend({
  type: z.literal('video'),
  src: z.string().url(),
  trimStart: z.number().nonnegative().default(0),
  volume: z.number().min(0).max(1).default(1),
});

// -- Audio Clip --
export const AudioClipSchema = BaseClipSchema.extend({
  type: z.literal('audio'),
  src: z.string().url(),
  trimStart: z.number().nonnegative().default(0),
  volume: z.number().min(0).max(1).default(1),
  effects: z.array(EffectSchema).default([]), // For audio fades
});

// -- Image Clip --
export const ImageClipSchema = BaseClipSchema.merge(VisualClipMixin).extend({
  type: z.literal('image'),
  src: z.string().url(),
});

// -- Text Clip --
export const TextClipSchema = BaseClipSchema.merge(VisualClipMixin).extend({
  type: z.literal('text'),
  content: z.string(),
  fontSize: z.number().positive(),
  color: z.string(), // e.g., "#FFFFFF" or "rgba(255,0,0,1)"
  fontFamily: z.string().optional(),
});

export const ClipSchema = z.discriminatedUnion('type', [
  VideoClipSchema,
  AudioClipSchema,
  ImageClipSchema,
  TextClipSchema,
]);

export type Clip = z.infer<typeof ClipSchema>;
export type VideoClip = z.infer<typeof VideoClipSchema>;
export type AudioClip = z.infer<typeof AudioClipSchema>;
export type ImageClip = z.infer<typeof ImageClipSchema>;
export type TextClip = z.infer<typeof TextClipSchema>;

// ==========================================
// 4. Tracks
// ==========================================
export const TrackSchema = z.object({
  id: z.string(),
  zIndex: z.number().int().default(0),
  clips: z.array(ClipSchema).default([]),
});

export type Track = z.infer<typeof TrackSchema>;

// ==========================================
// 5. Project (Root)
// ==========================================
export const VideoProjectSchema = z.object({
  id: z.string(),
  version: z.literal('0.1.0', {
    errorMap: () => ({ message: "Project version must be '0.1.0'" }),
  }),
  settings: OutputSettingsSchema,
  tracks: z.array(TrackSchema).default([]),
});

export type VideoProject = z.infer<typeof VideoProjectSchema>;

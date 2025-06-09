import { z } from 'zod';

export const ImageUploadSchema = z.object({
  file: z.object({
    filename: z.string(),
    mimetype: z.enum(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']),
    encoding: z.string(),
  }),
});

export const MultipleImageUploadSchema = z.object({
  files: z.array(z.object({
    filename: z.string(),
    mimetype: z.enum(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']),
    encoding: z.string(),
  })).max(5),
});

export const ProcessedImageResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    partName: z.string(),
    description: z.string(),
  }).optional(),
  error: z.object({
    type: z.string(),
    message: z.string(),
  }).optional(),
});

export const ProcessedMultipleImageResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    name: z.string(),
    description: z.string(),
  }).optional(),
  error: z.object({
    type: z.string(),
    message: z.string(),
  }).optional(),
});

export type ImageUpload = z.infer<typeof ImageUploadSchema>;
export type MultipleImageUpload = z.infer<typeof MultipleImageUploadSchema>;
export type ProcessedImageResponse = z.infer<typeof ProcessedImageResponseSchema>;
export type ProcessedMultipleImageResponse = z.infer<typeof ProcessedMultipleImageResponseSchema>; 
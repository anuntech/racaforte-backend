import { z } from 'zod';

export const CreateCarSchema = z.object({
  brand: z.string().min(1, 'Marca é obrigatória').trim(),
  model: z.string().min(1, 'Modelo é obrigatório').trim(),
  year: z.number().int().min(1900, 'Ano deve ser maior que 1900').max(new Date().getFullYear() + 1, 'Ano não pode ser no futuro'),
  color: z.string().min(1, 'Cor é obrigatória').trim(),
  internal_id: z.string().min(1, 'Internal ID é obrigatório').trim(),
});

export const UpdateCarSchema = z.object({
  brand: z.string().min(1, 'Marca é obrigatória').trim().optional(),
  model: z.string().min(1, 'Modelo é obrigatório').trim().optional(),
  year: z.number().int().min(1900, 'Ano deve ser maior que 1900').max(new Date().getFullYear() + 1, 'Ano não pode ser no futuro').optional(),
  color: z.string().min(1, 'Cor é obrigatória').trim().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Pelo menos um campo deve ser fornecido para atualização',
});

export const CarParamsSchema = z.object({
  identifier: z.string().min(1, 'Identificador é obrigatório'),
});

export const CarResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: z.string(),
    internal_id: z.string(),
  }).optional(),
  error: z.object({
    type: z.string(),
    message: z.string(),
  }).optional(),
});

export const CarDetailsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: z.string(),
    internal_id: z.string(),
    brand: z.string(),
    model: z.string(),
    year: z.number(),
    color: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  }).optional(),
  error: z.object({
    type: z.string(),
    message: z.string(),
  }).optional(),
});

export const DeleteResponseSchema = z.object({
  success: z.boolean(),
  error: z.object({
    type: z.string(),
    message: z.string(),
  }).optional(),
});

export const InternalIdsResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.string()).optional(),
  error: z.object({
    type: z.string(),
    message: z.string(),
  }).optional(),
});

export const AllCarsResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.object({
    id: z.string(),
    internal_id: z.string(),
    brand: z.string(),
    model: z.string(),
    year: z.number(),
    color: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  })).optional(),
  error: z.object({
    type: z.string(),
    message: z.string(),
  }).optional(),
});

export const GenerateInternalIdSchema = z.object({
  brand: z.string().min(1, 'Marca é obrigatória').trim(),
  model: z.string().min(1, 'Modelo é obrigatório').trim(),
  year: z.number().int().min(1900, 'Ano deve ser maior que 1900').max(new Date().getFullYear() + 1, 'Ano não pode ser no futuro'),
  color: z.string().min(1, 'Cor é obrigatória').trim(),
});

export const GenerateInternalIdResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    internal_id: z.string(),
  }).optional(),
  error: z.object({
    type: z.string(),
    message: z.string(),
  }).optional(),
});

export const CarPartsResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    condition: z.enum(['BOA', 'MEDIA', 'RUIM']),
    stock_address: z.string(),
    dimensions: z.unknown().optional(),
    weight: z.number().optional(),
    compatibility: z.unknown().optional(),
    min_price: z.number().optional(),
    suggested_price: z.number().optional(),
    max_price: z.number().optional(),
    ad_title: z.string().optional(),
    ad_description: z.string().optional(),
    images: z.array(z.string()),
    created_at: z.string(),
    updated_at: z.string(),
    car_id: z.string(),
  })).optional(),
  error: z.object({
    type: z.string(),
    message: z.string(),
  }).optional(),
});

export type CreateCarRequest = z.infer<typeof CreateCarSchema>;
export type UpdateCarRequest = z.infer<typeof UpdateCarSchema>;
export type CarParams = z.infer<typeof CarParamsSchema>;
export type CarResponse = z.infer<typeof CarResponseSchema>;
export type CarDetailsResponse = z.infer<typeof CarDetailsResponseSchema>;
export type DeleteResponse = z.infer<typeof DeleteResponseSchema>;
export type InternalIdsResponse = z.infer<typeof InternalIdsResponseSchema>;
export type AllCarsResponse = z.infer<typeof AllCarsResponseSchema>;
export type GenerateInternalIdRequest = z.infer<typeof GenerateInternalIdSchema>;
export type GenerateInternalIdResponse = z.infer<typeof GenerateInternalIdResponseSchema>;
export type CarPartsResponse = z.infer<typeof CarPartsResponseSchema>; 
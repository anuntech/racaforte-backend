import { z } from 'zod';

// Schema para validação de condição da peça
export const PartConditionSchema = z.enum(['BOA', 'MEDIA', 'RUIM'], {
  errorMap: () => ({ message: 'Condição deve ser: BOA, MEDIA ou RUIM' })
});

// Schema para dimensões (JSON)
export const DimensionsSchema = z.object({
  width: z.string().optional(),
  height: z.string().optional(),
  depth: z.string().optional(),
  unit: z.string().optional(),
}).optional();

// Schema para compatibilidade (JSON array)
export const CompatibilitySchema = z.array(z.object({
  brand: z.string(),
  model: z.string(),
  year: z.string(),
})).optional();

// Schema para criar uma nova peça
export const CreatePartSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').trim(),
  description: z.string().min(1, 'Descrição é obrigatória').trim(),
  condition: PartConditionSchema,
  stock_address: z.string().min(1, 'Endereço do estoque é obrigatório').trim(),
  dimensions: DimensionsSchema,
  weight: z.number().positive('Peso deve ser positivo').optional(),
  compatibility: CompatibilitySchema,
  min_price: z.number().positive('Preço mínimo deve ser positivo').optional(),
  suggested_price: z.number().positive('Preço sugerido deve ser positivo').optional(),
  max_price: z.number().positive('Preço máximo deve ser positivo').optional(),
  ad_title: z.string().trim().optional(),
  ad_description: z.string().trim().optional(),
  car_id: z.string().min(1, 'ID do carro é obrigatório').trim(),
});

// Schema para atualizar uma peça (todos os campos são opcionais)
export const UpdatePartSchema = z.object({
  name: z.string().min(1, 'Nome não pode estar vazio').trim().optional(),
  description: z.string().min(1, 'Descrição não pode estar vazia').trim().optional(),
  condition: PartConditionSchema.optional(),
  stock_address: z.string().min(1, 'Endereço do estoque não pode estar vazio').trim().optional(),
  dimensions: DimensionsSchema,
  weight: z.number().positive('Peso deve ser positivo').optional(),
  compatibility: CompatibilitySchema,
  min_price: z.number().positive('Preço mínimo deve ser positivo').optional(),
  suggested_price: z.number().positive('Preço sugerido deve ser positivo').optional(),
  max_price: z.number().positive('Preço máximo deve ser positivo').optional(),
  ad_title: z.string().trim().optional(),
  ad_description: z.string().trim().optional(),
  car_id: z.string().min(1, 'ID do carro não pode estar vazio').trim().optional(),
});

// Schema para os parâmetros de URL
export const PartParamsSchema = z.object({
  id: z.string().min(1, 'ID da peça é obrigatório'),
});

// Schema para resposta de criação de peça
export const PartResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: z.string(),
    name: z.string(),
    images: z.array(z.string()),
    qrCode: z.object({
      qrCodeData: z.string().optional(),
      url: z.string().optional(),
    }).optional(),
  }).optional(),
  error: z.object({
    type: z.string(),
    message: z.string(),
  }).optional(),
});

// Schema para resposta detalhada da peça
export const PartDetailsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    condition: PartConditionSchema,
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
    car: z.object({
      id: z.string(),
      internal_id: z.string(),
      brand: z.string(),
      model: z.string(),
      year: z.number(),
      color: z.string(),
    }),
  }).optional(),
  error: z.object({
    type: z.string(),
    message: z.string(),
  }).optional(),
});

// Schema para resposta de atualização de peça
export const UpdatePartResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    condition: PartConditionSchema,
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
    updated_at: z.string(),
    car_id: z.string(),
    car: z.object({
      id: z.string(),
      internal_id: z.string(),
      brand: z.string(),
      model: z.string(),
      year: z.number(),
      color: z.string(),
    }),
  }).optional(),
  error: z.object({
    type: z.string(),
    message: z.string(),
  }).optional(),
});

// Schema para resposta de deleção de peça
export const DeletePartResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.object({
    type: z.string(),
    message: z.string(),
  }).optional(),
});

// Schema para resposta de listagem de peças
export const AllPartsResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    condition: PartConditionSchema,
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
    car: z.object({
      id: z.string(),
      internal_id: z.string(),
      brand: z.string(),
      model: z.string(),
      year: z.number(),
      color: z.string(),
    }),
  })).optional(),
  error: z.object({
    type: z.string(),
    message: z.string(),
  }).optional(),
});

// Tipos TypeScript inferidos dos schemas
export type CreatePartRequest = z.infer<typeof CreatePartSchema>;
export type UpdatePartRequest = z.infer<typeof UpdatePartSchema>;
export type PartParams = z.infer<typeof PartParamsSchema>;
export type PartResponse = z.infer<typeof PartResponseSchema>;
export type PartDetailsResponse = z.infer<typeof PartDetailsResponseSchema>;
export type UpdatePartResponse = z.infer<typeof UpdatePartResponseSchema>;
export type DeletePartResponse = z.infer<typeof DeletePartResponseSchema>;
export type AllPartsResponse = z.infer<typeof AllPartsResponseSchema>;
export type PartCondition = z.infer<typeof PartConditionSchema>;
export type Dimensions = z.infer<typeof DimensionsSchema>;
export type Compatibility = z.infer<typeof CompatibilitySchema>; 
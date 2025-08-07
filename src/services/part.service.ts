import { PrismaClient } from '../../generated/prisma/index.js';
import type { CreatePartRequest, UpdatePartRequest } from '../schemas/part.schema.js';
import type { UploadResult, StorageError } from './storage.service.js';
import { processAndUploadMultipleImages, deleteMultipleImagesFromS3 } from './storage.service.js';

const prisma = new PrismaClient();

export interface ServiceError {
  error: string;
  message: string;
}

export interface PartCreationResult {
  id: string;
  name: string;
  images: string[];
}

interface PartDetailsResult {
  id: string;
  name: string;
  description: string;
  condition: string;
  stock_address: string;
  dimensions: unknown;
  weight: number | null;
  compatibility: unknown;
  min_price: number | null;
  suggested_price: number | null;
  max_price: number | null;
  ad_title: string | null;
  ad_description: string | null;
  images: string[];
  created_at: Date;
  updated_at: Date;
  car_id: string;
  car: {
    id: string;
    internal_id: string;
    brand: string;
    model: string;
    year: number;
    color: string;
  };
}

/**
 * Cria uma nova peça no banco de dados
 */
export async function createPart(
  partData: CreatePartRequest,
  images: Array<{ buffer: Buffer; filename: string }>
): Promise<PartCreationResult | ServiceError> {
  try {
    // Verifica se o carro existe (tenta por ID interno primeiro)
    const car = await prisma.car.findFirst({
      where: {
        OR: [
          { id: partData.car_id },
          { internal_id: partData.car_id }
        ]
      }
    });

    if (!car) {
      return {
        error: 'car_not_found',
        message: 'Carro não encontrado.'
      };
    }

    // Cria a peça primeiro para ter o ID
    const part = await prisma.part.create({
      data: {
        name: partData.name,
        description: partData.description || '',
        condition: partData.condition,
        stock_address: partData.stock_address,
        dimensions: partData.dimensions || undefined,
        weight: partData.weight || undefined,
        compatibility: partData.compatibility || undefined,
        min_price: partData.min_price || undefined,
        suggested_price: partData.suggested_price || undefined,
        max_price: partData.max_price || undefined,
        ad_title: partData.ad_title || undefined,
        ad_description: partData.ad_description || undefined,
        car_id: car.id, // Usa o ID interno do carro
        images: [], // Inicialmente vazio, será atualizado após upload
      },
      select: {
        id: true,
        name: true,
      }
    });

    // Processa e faz upload das imagens (sem remoção de background, já feito no /part/process)
    console.log(`🖼️ Fazendo upload de ${images.length} imagens para a peça ${part.id}...`);
    const uploadResults = await processAndUploadMultipleImages(images, part.id, false);

    // Filtra apenas os uploads bem-sucedidos
    const successfulUploads = uploadResults.filter((result): result is UploadResult => !('error' in result));
    const imageUrls = successfulUploads.map(result => result.url);

    if (imageUrls.length === 0) {
      // Se nenhuma imagem foi enviada com sucesso, deleta a peça e retorna erro
      await prisma.part.delete({ where: { id: part.id } });
      return {
        error: 'image_upload_failed',
        message: 'Não foi possível fazer upload das imagens. Tente novamente.'
      };
    }

    // Atualiza a peça com as URLs das imagens
    const updatedPart = await prisma.part.update({
      where: { id: part.id },
      data: { images: imageUrls },
      select: {
        id: true,
        name: true,
        images: true,
      }
    });

    // Prepara a resposta
    const result: PartCreationResult = {
      id: updatedPart.id,
      name: updatedPart.name,
      images: updatedPart.images as string[],
    };

    return result;

  } catch (error) {
    console.error('Erro ao criar peça:', error);
    return {
      error: 'database_error',
      message: 'Erro interno do servidor. Tente novamente.'
    };
  }
}

/**
 * Busca peças por nome (busca parcial case-insensitive)
 */
export async function searchPartsByName(searchTerm: string): Promise<PartDetailsResult[] | ServiceError> {
  try {
    const parts = await prisma.part.findMany({
      where: {
        name: {
          contains: searchTerm
        }
      },
      include: {
        car: {
          select: {
            id: true,
            internal_id: true,
            brand: true,
            model: true,
            year: true,
            color: true,
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Converte as imagens de JSON para array de strings e formata preços
    const formattedParts: PartDetailsResult[] = parts.map(part => ({
      ...part,
      images: Array.isArray(part.images) ? part.images.filter(img => typeof img === 'string') as string[] : [],
      weight: part.weight ? Number(part.weight) : null,
      min_price: part.min_price ? Number(part.min_price) : null,
      suggested_price: part.suggested_price ? Number(part.suggested_price) : null,
      max_price: part.max_price ? Number(part.max_price) : null,
      car: part.car,
    }));

    return formattedParts;

  } catch (error) {
    console.error('Erro ao buscar peças por nome:', error);
    return {
      error: 'database_error',
      message: 'Erro interno do servidor. Tente novamente.'
    };
  }
}

/**
 * Busca uma peça por ID
 */
export async function getPartById(partId: string): Promise<PartDetailsResult | ServiceError> {
  try {
    const part = await prisma.part.findUnique({
      where: { id: partId },
      include: {
        car: {
          select: {
            id: true,
            internal_id: true,
            brand: true,
            model: true,
            year: true,
            color: true,
          }
        }
      }
    });

    if (!part) {
      return {
        error: 'part_not_found',
        message: 'Peça não encontrada.'
      };
    }

    return {
      id: part.id,
      name: part.name,
      description: part.description,
      condition: part.condition,
      stock_address: part.stock_address,
      dimensions: part.dimensions,
      weight: part.weight ? Number(part.weight) : null,
      compatibility: part.compatibility,
      min_price: part.min_price ? Number(part.min_price) : null,
      suggested_price: part.suggested_price ? Number(part.suggested_price) : null,
      max_price: part.max_price ? Number(part.max_price) : null,
      ad_title: part.ad_title,
      ad_description: part.ad_description,
      images: part.images as string[],
      created_at: part.created_at,
      updated_at: part.updated_at,
      car_id: part.car_id,
      car: part.car,
    };

  } catch (error) {
    console.error('Erro ao buscar peça:', error);
    return {
      error: 'database_error',
      message: 'Erro interno do servidor. Tente novamente.'
    };
  }
}

/**
 * Busca todas as peças
 */
export async function getAllParts(): Promise<PartDetailsResult[] | ServiceError> {
  try {
    const parts = await prisma.part.findMany({
      include: {
        car: {
          select: {
            id: true,
            internal_id: true,
            brand: true,
            model: true,
            year: true,
            color: true,
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    return parts.map(part => ({
      id: part.id,
      name: part.name,
      description: part.description,
      condition: part.condition,
      stock_address: part.stock_address,
      dimensions: part.dimensions,
      weight: part.weight ? Number(part.weight) : null,
      compatibility: part.compatibility,
      min_price: part.min_price ? Number(part.min_price) : null,
      suggested_price: part.suggested_price ? Number(part.suggested_price) : null,
      max_price: part.max_price ? Number(part.max_price) : null,
      ad_title: part.ad_title,
      ad_description: part.ad_description,
      images: part.images as string[],
      created_at: part.created_at,
      updated_at: part.updated_at,
      car_id: part.car_id,
      car: part.car,
    }));

  } catch (error) {
    console.error('Erro ao buscar todas as peças:', error);
    return {
      error: 'database_error',
      message: 'Erro interno do servidor. Tente novamente.'
    };
  }
}

/**
 * Atualiza uma peça no banco de dados
 */
export async function updatePart(
  partId: string,
  partData: UpdatePartRequest,
  images?: Array<{ buffer: Buffer; filename: string }>
): Promise<PartDetailsResult | ServiceError> {
  try {
    // Verifica se a peça existe
    const existingPart = await prisma.part.findUnique({
      where: { id: partId },
      include: {
        car: {
          select: {
            id: true,
            internal_id: true,
            brand: true,
            model: true,
            year: true,
            color: true,
          }
        }
      }
    });

    if (!existingPart) {
      return {
        error: 'part_not_found',
        message: 'Peça não encontrada.'
      };
    }

    // Se car_id foi fornecido, verifica se o carro existe
    const carId = await (async () => {
      if (partData.car_id) {
        const car = await prisma.car.findFirst({
          where: {
            OR: [
              { id: partData.car_id },
              { internal_id: partData.car_id }
            ]
          }
        });

        if (!car) {
          throw new Error('car_not_found');
        }
        return car.id;
      }
      return existingPart.car_id;
    })().catch((error) => {
      if (error.message === 'car_not_found') {
        throw error;
      }
      throw error;
    });

    // Processa novas imagens se fornecidas
    let newImageUrls: string[] = [];
    const oldImageUrls = existingPart.images as string[];

    if (images && images.length > 0) {
      console.log(`🖼️ Processando ${images.length} novas imagens para a peça ${partId}...`);
      
      if (images.length > 5) {
        return {
          error: 'too_many_files',
          message: 'Máximo de 5 imagens permitidas.'
        };
      }

      const uploadResults = await processAndUploadMultipleImages(images, partId, false);
      const successfulUploads = uploadResults.filter((result): result is UploadResult => !('error' in result));
      newImageUrls = successfulUploads.map(result => result.url);

      if (newImageUrls.length === 0) {
        return {
          error: 'image_upload_failed',
          message: 'Não foi possível fazer upload das novas imagens. Tente novamente.'
        };
      }

      // Se há novas imagens, deleta as antigas do S3
      if (oldImageUrls.length > 0) {
        console.log(`🗑️ Deletando ${oldImageUrls.length} imagens antigas...`);
        await deleteMultipleImagesFromS3(oldImageUrls);
      }
    } else {
      // Se não foram fornecidas novas imagens, mantém as existentes
      newImageUrls = oldImageUrls;
    }

    // Prepara os dados para atualização
    const updateData: Record<string, unknown> = {};
    
    if (partData.name !== undefined) updateData.name = partData.name;
    if (partData.description !== undefined) updateData.description = partData.description;
    if (partData.condition !== undefined) updateData.condition = partData.condition;
    if (partData.stock_address !== undefined) updateData.stock_address = partData.stock_address;
    if (partData.dimensions !== undefined) updateData.dimensions = partData.dimensions;
    if (partData.weight !== undefined) updateData.weight = partData.weight;
    if (partData.compatibility !== undefined) updateData.compatibility = partData.compatibility;
    if (partData.min_price !== undefined) updateData.min_price = partData.min_price;
    if (partData.suggested_price !== undefined) updateData.suggested_price = partData.suggested_price;
    if (partData.max_price !== undefined) updateData.max_price = partData.max_price;
    if (partData.ad_title !== undefined) updateData.ad_title = partData.ad_title;
    if (partData.ad_description !== undefined) updateData.ad_description = partData.ad_description;
    if (partData.car_id !== undefined) updateData.car_id = carId;
    
    // Sempre atualiza as imagens se foram processadas novas
    if (images && images.length > 0) {
      updateData.images = newImageUrls;
    }

    // Atualiza a peça no banco de dados
    const updatedPart = await prisma.part.update({
      where: { id: partId },
      data: updateData,
      include: {
        car: {
          select: {
            id: true,
            internal_id: true,
            brand: true,
            model: true,
            year: true,
            color: true,
          }
        }
      }
    });

    return {
      id: updatedPart.id,
      name: updatedPart.name,
      description: updatedPart.description,
      condition: updatedPart.condition,
      stock_address: updatedPart.stock_address,
      dimensions: updatedPart.dimensions,
      weight: updatedPart.weight ? Number(updatedPart.weight) : null,
      compatibility: updatedPart.compatibility,
      min_price: updatedPart.min_price ? Number(updatedPart.min_price) : null,
      suggested_price: updatedPart.suggested_price ? Number(updatedPart.suggested_price) : null,
      max_price: updatedPart.max_price ? Number(updatedPart.max_price) : null,
      ad_title: updatedPart.ad_title,
      ad_description: updatedPart.ad_description,
      images: updatedPart.images as string[],
      created_at: updatedPart.created_at,
      updated_at: updatedPart.updated_at,
      car_id: updatedPart.car_id,
      car: updatedPart.car,
    };

  } catch (error) {
    console.error('Erro ao atualizar peça:', error);
    return {
      error: 'database_error',
      message: 'Erro interno do servidor. Tente novamente.'
    };
  }
}

/**
 * Cria uma nova peça no banco de dados usando URLs S3 diretas (sem upload)
 */
export async function createPartWithS3Urls(
  partData: CreatePartRequest,
  s3ImageUrls: string[]
): Promise<PartCreationResult | ServiceError> {
  try {
    // Verifica se o carro existe (tenta por ID interno primeiro)
    const car = await prisma.car.findFirst({
      where: {
        OR: [
          { id: partData.car_id },
          { internal_id: partData.car_id }
        ]
      }
    });

    if (!car) {
      return {
        error: 'car_not_found',
        message: 'Carro não encontrado.'
      };
    }

    // Cria a peça diretamente com as URLs S3 fornecidas
    const part = await prisma.part.create({
      data: {
        name: partData.name,
        description: partData.description || '',
        condition: partData.condition,
        stock_address: partData.stock_address,
        dimensions: partData.dimensions || undefined,
        weight: partData.weight || undefined,
        compatibility: partData.compatibility || undefined,
        min_price: partData.min_price || undefined,
        suggested_price: partData.suggested_price || undefined,
        max_price: partData.max_price || undefined,
        ad_title: partData.ad_title || undefined,
        ad_description: partData.ad_description || undefined,
        car_id: car.id, // Usa o ID interno do carro
        images: s3ImageUrls, // Usa as URLs S3 diretas
      },
      select: {
        id: true,
        name: true,
        images: true,
      }
    });

    console.log(`✅ Peça criada com URLs S3 diretas: ${part.id}`);

    // Prepara a resposta
    const result: PartCreationResult = {
      id: part.id,
      name: part.name,
      images: part.images as string[],
    };

    return result;

  } catch (error) {
    console.error('Erro ao criar peça com URLs S3:', error);
    return {
      error: 'database_error',
      message: 'Erro interno do servidor. Tente novamente.'
    };
  }
}

/**
 * Busca uma peça por critérios específicos (vehicle_internal_id, nome e descrição)
 */
export async function searchPartByCriteria(
  vehicleInternalId: string,
  partName: string,
  partDescription?: string
): Promise<PartDetailsResult | ServiceError> {
  try {
    // Busca o carro primeiro
    const car = await prisma.car.findFirst({
      where: {
        OR: [
          { id: vehicleInternalId },
          { internal_id: vehicleInternalId }
        ]
      }
    });

    if (!car) {
      return {
        error: 'car_not_found',
        message: 'Veículo não encontrado.'
      };
    }

    // Busca a peça com os critérios fornecidos
    // No MySQL, o 'contains' já é case-insensitive por padrão (dependendo da collation)
    const whereClause: {
      car_id: string;
      name: { contains: string };
      description?: { contains: string };
    } = {
      car_id: car.id,
      name: {
        contains: partName
      }
    };

    // Se a descrição foi fornecida, adiciona ao filtro
    if (partDescription && partDescription.trim() !== '') {
      whereClause.description = {
        contains: partDescription
      };
    }

    const part = await prisma.part.findFirst({
      where: whereClause,
      include: {
        car: {
          select: {
            id: true,
            internal_id: true,
            brand: true,
            model: true,
            year: true,
            color: true,
          }
        }
      }
    });

    if (!part) {
      return {
        error: 'part_not_found',
        message: 'Peça não encontrada com os critérios especificados.'
      };
    }

    return {
      id: part.id,
      name: part.name,
      description: part.description,
      condition: part.condition,
      stock_address: part.stock_address,
      dimensions: part.dimensions,
      weight: part.weight ? Number(part.weight) : null,
      compatibility: part.compatibility,
      min_price: part.min_price ? Number(part.min_price) : null,
      suggested_price: part.suggested_price ? Number(part.suggested_price) : null,
      max_price: part.max_price ? Number(part.max_price) : null,
      ad_title: part.ad_title,
      ad_description: part.ad_description,
      images: part.images as string[],
      created_at: part.created_at,
      updated_at: part.updated_at,
      car_id: part.car_id,
      car: part.car,
    };

  } catch (error) {
    console.error('Erro ao buscar peça por critérios:', error);
    return {
      error: 'database_error',
      message: 'Erro interno do servidor. Tente novamente.'
    };
  }
}

/**
 * Deleta uma peça do banco de dados
 */
export async function deletePart(partId: string): Promise<true | ServiceError> {
  try {
    // Verifica se a peça existe e busca suas imagens
    const existingPart = await prisma.part.findUnique({
      where: { id: partId },
      select: {
        id: true,
        name: true,
        images: true,
      }
    });

    if (!existingPart) {
      return {
        error: 'part_not_found',
        message: 'Peça não encontrada.'
      };
    }

    const imageUrls = existingPart.images as string[];

    // Deleta as imagens do S3 se existirem
    if (imageUrls.length > 0) {
      console.log(`🗑️ Deletando ${imageUrls.length} imagens da peça ${partId}...`);
      await deleteMultipleImagesFromS3(imageUrls);
    }

    // Deleta a peça do banco de dados
    await prisma.part.delete({
      where: { id: partId }
    });

    console.log(`✅ Peça ${partId} deletada com sucesso`);
    return true;

  } catch (error) {
    console.error('Erro ao deletar peça:', error);
    return {
      error: 'database_error',
      message: 'Erro interno do servidor. Tente novamente.'
    };
  }
} 
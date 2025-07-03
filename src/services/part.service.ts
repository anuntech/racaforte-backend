import { PrismaClient } from '../../generated/prisma';
import type { CreatePartRequest } from '../schemas/part.schema';
import type { UploadResult, StorageError } from './storage.service';
import { processAndUploadMultipleImages } from './storage.service';
import { generatePartQRCode } from './qrcode.service';
import type { QRCodeResult, QRCodeError } from './qrcode.service';

const prisma = new PrismaClient();

interface ServiceError {
  error: string;
  message: string;
}

interface PartCreationResult {
  id: string;
  name: string;
  images: string[];
  qrCode?: QRCodeResult;
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
        description: partData.description,
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

    // Processa e faz upload das imagens
    console.log(`🖼️ Processando ${images.length} imagens para a peça ${part.id}...`);
    const uploadResults = await processAndUploadMultipleImages(images, part.id);

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

    // Gera o QR code para a peça
    console.log(`📱 Gerando QR code para a peça ${part.id}...`);
    const qrCodeResult = await generatePartQRCode(part.id);

    // Prepara a resposta
    const result: PartCreationResult = {
      id: updatedPart.id,
      name: updatedPart.name,
      images: updatedPart.images as string[],
    };

    // Adiciona o QR code se foi gerado com sucesso
    if ('qrCodeData' in qrCodeResult) {
      result.qrCode = qrCodeResult;
      console.log('✅ QR code gerado e incluído na resposta');
    } else {
      console.log('⚠️ Erro ao gerar QR code:', qrCodeResult.message);
      // Continua sem o QR code se houver erro
    }

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
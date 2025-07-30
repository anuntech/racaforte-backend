import { PrismaClient } from '../../generated/prisma';
import type { CreateCarRequest, UpdateCarRequest } from '../schemas/car.schema';

interface CarCreationResult {
  id: string;
  internal_id: string;
}

interface CarDetailsResult {
  id: string;
  internal_id: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  created_at: Date;
  updated_at: Date;
}

interface ServiceError {
  error: string;
  message: string;
}

interface CarPartResult {
  id: string;
  name: string;
  description: string;
  condition: 'BOA' | 'MEDIA' | 'RUIM';
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
}

// Instância compartilhada do Prisma
const prisma = new PrismaClient();

// Gera abreviação da marca com 2 caracteres
function generateBrandAbbreviation(brand: string): string {
  const brandMap: { [key: string]: string } = {
    'toyota': 'TO',
    'honda': 'HO',
    'ford': 'FO',
    'chevrolet': 'CH',
    'volkswagen': 'VW',
    'fiat': 'FI',
    'hyundai': 'HY',
    'nissan': 'NI',
    'peugeot': 'PE',
    'renault': 'RE',
    'bmw': 'BM',
    'mercedes': 'ME',
    'audi': 'AU',
    'jeep': 'JE',
    'mitsubishi': 'MI',
    'kia': 'KI',
    'subaru': 'SU',
    'mazda': 'MA',
    'suzuki': 'SZ',
    'citroen': 'CI',
  };

  const normalizedBrand = brand.toLowerCase().trim();
  return brandMap[normalizedBrand] || brand
    .normalize('NFD')                     // Remove acentos antes de abreviar
    .replace(/\u0300-\u036f/g, '')        // Remove diacríticos
    .substring(0, 2)
    .toUpperCase();
}

function generateModelAbbreviation(model: string): string {
  // Remove acentos e normaliza, depois remove apenas espaços e símbolos, mantendo letras
  const withoutAccents = model
    .normalize('NFD')                     // Decompõe acentos
    .replace(/\u0300-\u036f/g, '')        // Remove apenas os acentos
    .replace(/[^a-zA-Z0-9]/g, '')         // Remove espaços e símbolos
    .toUpperCase();
  
  return withoutAccents.substring(0, 3) || 'MOD';
}

// Gera abreviação da cor com 2 caracteres (preto=pr, prata=pt, outras=primeiras 2 letras)
function generateColorAbbreviation(color: string): string {
  const colorMap: { [key: string]: string } = {
    'preto': 'PR',
    'prata': 'PT',
    'branco': 'BR',
    'cinza': 'CI',
    'azul': 'AZ',
    'vermelho': 'VM',
    'verde': 'VD',
    'amarelo': 'AM',
    'dourado': 'DO',
    'marrom': 'MR',
    'bege': 'BE',
    'rosa': 'RS',
    'roxo': 'RX',
    'laranja': 'LA',
  };

  const normalizedColor = color.toLowerCase().trim();
  return colorMap[normalizedColor] || color
    .normalize('NFD')                     // Remove acentos antes de abreviar
    .replace(/\u0300-\u036f/g, '')        // Remove diacríticos
    .substring(0, 2)
    .toUpperCase();
}

async function generateSequence(): Promise<string> {
  // Busca a maior sequência existente nos internal_ids
  const cars = await prisma.car.findMany({
    select: { internal_id: true }
  });
  
  let maxSequence = 0;
  
  // Extrai a sequência (últimos 3 dígitos) de cada internal_id
  for (const car of cars) {
    const sequenceMatch = car.internal_id.match(/(\d{3})$/);
    if (sequenceMatch) {
      const sequence = Number.parseInt(sequenceMatch[1], 10);
      if (sequence > maxSequence) {
        maxSequence = sequence;
      }
    }
  }
  
  // Próxima sequência = maior sequência + 1
  const nextSequence = maxSequence + 1;

  // Formata com 3 dígitos (001, 002, etc.)
  return nextSequence.toString().padStart(3, '0');
}

async function generateInternalId(brand: string, model: string, year: number, color: string): Promise<string> {
  const brandAbbr = generateBrandAbbreviation(brand);
  const modelAbbr = generateModelAbbreviation(model);
  const colorAbbr = generateColorAbbreviation(color);
  
  // Utiliza apenas os 2 últimos dígitos do ano
  const yearAbbr = year.toString().slice(-2);
  
  const baseInternalId = `${brandAbbr}${modelAbbr}${yearAbbr}${colorAbbr}`;
  const sequence = await generateSequence();
  
  return `${baseInternalId}${sequence}`;
}

export async function generateInternalIdFromData(carData: { brand: string; model: string; year: number; color: string }): Promise<string | ServiceError> {
  try {
    const internal_id = await generateInternalId(
      carData.brand,
      carData.model,
      carData.year,
      carData.color
    );

    return internal_id;

  } catch (error) {
    console.error('Erro ao gerar internal_id:', error);
    
    return {
      error: 'generation_error',
      message: 'Erro interno ao gerar identificador. Tente novamente.'
    };
  }
}

export async function createCar(carData: CreateCarRequest): Promise<CarCreationResult | ServiceError> {
  try {
    // Cria o carro no banco de dados usando o internal_id fornecido
    const car = await prisma.car.create({
      data: {
        brand: carData.brand,
        model: carData.model,
        year: carData.year,
        color: carData.color,
        internal_id: carData.internal_id,
      },
      select: {
        id: true,
        internal_id: true,
      }
    });

    return {
      id: car.id,
      internal_id: car.internal_id,
    };

  } catch (error) {
    console.error('Erro ao criar carro:', error);
    
    // Verifica se é erro de internal_id duplicado
    if (error instanceof Error && error.message.includes('internal_id')) {
      return {
        error: 'duplicate_internal_id',
        message: 'Internal ID já existe. Use um identificador único.'
      };
    }

    return {
      error: 'database_error',
      message: 'Erro interno do servidor. Tente novamente.'
    };
  }
}

async function findCarByIdentifier(identifier: string) {
  // Tenta encontrar por ID primeiro
  let car = await prisma.car.findUnique({
    where: { id: identifier }
  });

  // Se não encontrou por ID, tenta por internal_id
  if (!car) {
    car = await prisma.car.findUnique({
      where: { internal_id: identifier }
    });
  }

  return car;
}

export async function updateCar(identifier: string, updateData: UpdateCarRequest): Promise<CarDetailsResult | ServiceError> {
  try {
    // Busca o carro existente
    const existingCar = await findCarByIdentifier(identifier);

    if (!existingCar) {
      return {
        error: 'car_not_found',
        message: 'Veículo não encontrado.'
      };
    }

    // Mescla os dados existentes com os novos dados
    const mergedData = {
      brand: updateData.brand || existingCar.brand,
      model: updateData.model || existingCar.model,
      year: updateData.year || existingCar.year,
      color: updateData.color || existingCar.color,
    };

    // Gera novo internal_id se algum campo relevante foi alterado
    let newInternalId = existingCar.internal_id;
    const fieldsChanged = 
      updateData.brand !== undefined ||
      updateData.model !== undefined ||
      updateData.year !== undefined ||
      updateData.color !== undefined;

    if (fieldsChanged) {
      newInternalId = await generateInternalId(
        mergedData.brand,
        mergedData.model,
        mergedData.year,
        mergedData.color
      );
    }

    // Atualiza o carro no banco de dados
    const updatedCar = await prisma.car.update({
      where: { id: existingCar.id },
      data: {
        brand: mergedData.brand,
        model: mergedData.model,
        year: mergedData.year,
        color: mergedData.color,
        internal_id: newInternalId,
      }
    });

    return {
      id: updatedCar.id,
      internal_id: updatedCar.internal_id,
      brand: updatedCar.brand,
      model: updatedCar.model,
      year: updatedCar.year,
      color: updatedCar.color,
      created_at: updatedCar.created_at,
      updated_at: updatedCar.updated_at,
    };

  } catch (error) {
    console.error('Erro ao atualizar carro:', error);
    
    // Verifica se é erro de duplicidade
    if (error instanceof Error && error.message.includes('internal_id')) {
      return {
        error: 'duplicate_internal_id',
        message: 'Erro interno ao gerar identificador único. Tente novamente.'
      };
    }

    return {
      error: 'database_error',
      message: 'Erro interno do servidor. Tente novamente.'
    };
  }
}

export async function deleteCar(identifier: string): Promise<true | ServiceError> {
  try {
    // Busca o carro existente
    const existingCar = await findCarByIdentifier(identifier);

    if (!existingCar) {
      return {
        error: 'car_not_found',
        message: 'Veículo não encontrado.'
      };
    }

    // Verifica se o carro tem peças associadas
    const partsCount = await prisma.part.count({
      where: { car_id: existingCar.id }
    });

    if (partsCount > 0) {
      return {
        error: 'car_has_parts',
        message: `Não é possível deletar o veículo. Existem ${partsCount} peça(s) associada(s) a este veículo.`
      };
    }

    // Deleta o carro
    await prisma.car.delete({
      where: { id: existingCar.id }
    });

    return true;

  } catch (error) {
    console.error('Erro ao deletar carro:', error);
    return {
      error: 'database_error',
      message: 'Erro interno do servidor. Tente novamente.'
    };
  }
}

export async function getCarById(identifier: string): Promise<CarDetailsResult | ServiceError> {
  try {
    const car = await findCarByIdentifier(identifier);

    if (!car) {
      return {
        error: 'car_not_found',
        message: 'Veículo não encontrado.'
      };
    }

    return {
      id: car.id,
      internal_id: car.internal_id,
      brand: car.brand,
      model: car.model,
      year: car.year,
      color: car.color,
      created_at: car.created_at,
      updated_at: car.updated_at,
    };

  } catch (error) {
    console.error('Erro ao buscar carro:', error);
    return {
      error: 'database_error',
      message: 'Erro interno do servidor. Tente novamente.'
    };
  }
}

export async function getAllCarInternalIds(): Promise<string[] | ServiceError> {
  try {
    const cars = await prisma.car.findMany({
      select: {
        internal_id: true
      },
      orderBy: {
        internal_id: 'asc'
      }
    });

    return cars.map(car => car.internal_id);

  } catch (error) {
    console.error('Erro ao buscar internal_ids dos carros:', error);
    
    return {
      error: 'database_error',
      message: 'Erro interno do servidor. Tente novamente.'
    };
  }
}

export async function getAllCars(): Promise<CarDetailsResult[] | ServiceError> {
  try {
    const cars = await prisma.car.findMany({
      orderBy: {
        created_at: 'desc'
      }
    });

    return cars;

  } catch (error) {
    console.error('Erro ao buscar todos os carros:', error);
    
    return {
      error: 'database_error',
      message: 'Erro interno do servidor. Tente novamente.'
    };
  }
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}

export async function getCarParts(identifier: string): Promise<CarPartResult[] | ServiceError> {
  try {
    // Busca o carro usando a função existente
    const car = await findCarByIdentifier(identifier);

    if (!car) {
      return {
        error: 'car_not_found',
        message: 'Veículo não encontrado.'
      };
    }

    // Busca todas as peças do carro
    const parts = await prisma.part.findMany({
      where: { car_id: car.id },
      select: {
        id: true,
        name: true,
        description: true,
        condition: true,
        stock_address: true,
        dimensions: true,
        weight: true,
        compatibility: true,
        min_price: true,
        suggested_price: true,
        max_price: true,
        ad_title: true,
        ad_description: true,
        images: true,
        created_at: true,
        updated_at: true,
        car_id: true,
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Converte as imagens de JSON para array de strings
    const partsWithFormattedImages: CarPartResult[] = parts.map(part => ({
      ...part,
      images: Array.isArray(part.images) ? part.images.filter(img => typeof img === 'string') as string[] : [],
      weight: part.weight ? Number(part.weight) : null,
      min_price: part.min_price ? Number(part.min_price) : null,
      suggested_price: part.suggested_price ? Number(part.suggested_price) : null,
      max_price: part.max_price ? Number(part.max_price) : null,
    }));

    return partsWithFormattedImages;

  } catch (error) {
    console.error('Erro ao buscar peças do carro:', error);
    
    return {
      error: 'database_error',
      message: 'Erro interno do servidor. Tente novamente.'
    };
  }
} 
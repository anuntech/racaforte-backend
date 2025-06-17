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

// Instância compartilhada do Prisma
const prisma = new PrismaClient();

// Falar com o João sobre abreviações
function generateBrandAbbreviation(brand: string): string {
  const brandMap: { [key: string]: string } = {
    'toyota': 'TOY',
    'honda': 'HON',
    'ford': 'FOR',
    'chevrolet': 'CHE',
    'volkswagen': 'VWN',
    'fiat': 'FIA',
    'hyundai': 'HYU',
    'nissan': 'NIS',
    'peugeot': 'PEU',
    'renault': 'REN',
    'bmw': 'BMW',
    'mercedes': 'MER',
    'audi': 'AUD',
    'jeep': 'JEE',
    'mitsubishi': 'MIT',
    'kia': 'KIA',
    'subaru': 'SUB',
    'mazda': 'MAZ',
    'suzuki': 'SUZ',
    'citroen': 'CIT',
  };

  const normalizedBrand = brand.toLowerCase().trim();
  return brandMap[normalizedBrand] || brand.substring(0, 3).toUpperCase();
}

function generateModelAbbreviation(model: string): string {
  // Remove espaços e caracteres especiais, pega as primeiras 3 letras/números
  const cleanModel = model.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return cleanModel.substring(0, 3) || 'MOD';
}

// Falar com o João sobre abreviações
function generateColorAbbreviation(color: string): string {
  const colorMap: { [key: string]: string } = {
    'preto': 'PRT',
    'branco': 'BR',
    'prata': 'PT',
    'cinza': 'CZ',
    'azul': 'AZ',
    'vermelho': 'VM',
    'verde': 'VD',
    'amarelo': 'AM',
    'dourado': 'DR',
    'marrom': 'MR',
    'bege': 'BG',
    'rosa': 'RS',
    'roxo': 'RX',
    'laranja': 'LJ',
  };

  const normalizedColor = color.toLowerCase().trim();
  return colorMap[normalizedColor] || color.substring(0, 2).toUpperCase();
}

async function generateSequence(baseInternalId: string): Promise<string> {
  // Busca o último carro com o mesmo padrão de marca, modelo e cor

  const lastCar = await prisma.car.findFirst({
    where: {
      internal_id: {
        startsWith: baseInternalId
      }
    },
    orderBy: {
      internal_id: 'desc'
    }
  });

  if (!lastCar) {
    return '001';
  }

  // Extrai a sequência do último internal_id
  const lastSequence = lastCar.internal_id.slice(baseInternalId.length);
  const sequenceNumber = Number.parseInt(lastSequence) || 0;
  const nextSequence = sequenceNumber + 1;

  // Formata com 3 dígitos (001, 002, etc.)
  return nextSequence.toString().padStart(3, '0');
}

async function generateInternalId(brand: string, model: string, year: number, color: string): Promise<string> {
  const brandAbbr = generateBrandAbbreviation(brand);
  const modelAbbr = generateModelAbbreviation(model);
  const colorAbbr = generateColorAbbreviation(color);
  
  const baseInternalId = `${brandAbbr}${modelAbbr}${year}${colorAbbr}`;
  const sequence = await generateSequence(baseInternalId);
  
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
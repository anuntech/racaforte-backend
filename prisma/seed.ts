import { PrismaClient, PartCondition } from '../generated/prisma'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seeding do banco de dados...')

  // Limpar dados existentes
  await prisma.part.deleteMany()
  console.log('🗑️  Dados existentes removidos')

  // Criar peças de teste
  const parts = await prisma.part.createMany({
    data: [
      {
        id: '1',
        name: 'Para-choque Dianteiro',
        brand: 'Toyota',
        year: 2020,
        condition: PartCondition.BOA,
        stock_address: 'Galpão A - Setor 1 - Prateleira 3',
        dimensions: {
          width: '150cm',
          height: '30cm',
          depth: '25cm',
          unit: 'cm'
        },
        weight: 15.50,
        compatibility: [
          { brand: 'Toyota', model: 'Corolla', year: '2020-2023' },
          { brand: 'Toyota', model: 'Corolla Cross', year: '2021-2023' }
        ],
        min_price: 800.00,
        suggested_price: 1200.00,
        max_price: 1500.00,
        part_description: 'Para-choque dianteiro original Toyota em excelente estado, sem riscos ou trincas.',
        images: [
          'https://example.com/parachoque1.jpg',
          'https://example.com/parachoque2.jpg',
          'https://example.com/parachoque3.jpg'
        ]
      },
      {
        id: '2',
        name: 'Farol LED Esquerdo',
        brand: 'Honda',
        year: 2019,
        condition: PartCondition.MEDIA,
        stock_address: 'Galpão B - Setor 2 - Prateleira 1',
        dimensions: {
          width: '45cm',
          height: '25cm',
          depth: '20cm',
          unit: 'cm'
        },
        weight: 3.20,
        compatibility: [
          { brand: 'Honda', model: 'Civic', year: '2017-2021' },
          { brand: 'Honda', model: 'Civic Si', year: '2017-2020' }
        ],
        min_price: 400.00,
        suggested_price: 650.00,
        max_price: 850.00,
        part_description: 'Farol LED esquerdo com pequenos sinais de uso, todos os LEDs funcionando perfeitamente.',
        images: [
          'https://example.com/farol_honda1.jpg',
          'https://example.com/farol_honda2.jpg'
        ]
      },
      {
        id: '3',
        name: 'Espelho Retrovisor Direito',
        brand: 'Volkswagen',
        year: 2018,
        condition: PartCondition.RUIM,
        stock_address: 'Galpão A - Setor 3 - Prateleira 2',
        dimensions: {
          width: '20cm',
          height: '15cm',
          depth: '10cm',
          unit: 'cm'
        },
        weight: 0.80,
        compatibility: [
          { brand: 'Volkswagen', model: 'Gol', year: '2017-2023' },
          { brand: 'Volkswagen', model: 'Voyage', year: '2017-2023' },
          { brand: 'Volkswagen', model: 'Polo', year: '2018-2023' }
        ],
        min_price: 80.00,
        suggested_price: 120.00,
        max_price: 180.00,
        part_description: 'Espelho com vidro trincado, mas estrutura plástica em bom estado. Ideal para reposição.',
        images: [
          'https://example.com/espelho_vw1.jpg'
        ]
      },
      {
        id: '4',
        name: 'Capô',
        brand: 'Ford',
        year: 2021,
        condition: PartCondition.BOA,
        stock_address: 'Galpão C - Área Externa - Seção 1',
        dimensions: {
          width: '180cm',
          height: '120cm',
          depth: '8cm',
          unit: 'cm'
        },
        weight: 25.00,
        compatibility: [
          { brand: 'Ford', model: 'Ka', year: '2018-2023' },
          { brand: 'Ford', model: 'Ka Sedan', year: '2018-2023' }
        ],
        min_price: 600.00,
        suggested_price: 900.00,
        max_price: 1200.00,
        part_description: 'Capô original Ford em ótimo estado, sem amassados. Apenas pequenos riscos superficiais.',
        images: [
          'https://example.com/capo_ford1.jpg',
          'https://example.com/capo_ford2.jpg',
          'https://example.com/capo_ford3.jpg'
        ]
      },
      {
        id: '5',
        name: 'Porta Traseira Esquerda',
        brand: 'Hyundai',
        year: 2022,
        condition: PartCondition.MEDIA,
        stock_address: 'Galpão B - Setor 4 - Área de Portas',
        dimensions: {
          width: '120cm',
          height: '100cm',
          depth: '15cm',
          unit: 'cm'
        },
        weight: 18.75,
        compatibility: [
          { brand: 'Hyundai', model: 'HB20', year: '2020-2023' },
          { brand: 'Hyundai', model: 'HB20S', year: '2020-2023' }
        ],
        min_price: 500.00,
        suggested_price: 750.00,
        max_price: 1000.00,
        part_description: 'Porta com pequenos amassados laterais, vidro e mecanismo de abertura funcionando normalmente.',
        images: [
          'https://example.com/porta_hyundai1.jpg',
          'https://example.com/porta_hyundai2.jpg'
        ]
      }
    ]
  })

  console.log(`✅ ${parts.count} peças criadas com sucesso!`)

  // Buscar e exibir as peças criadas
  const createdParts = await prisma.part.findMany({
    select: {
      id: true,
      name: true,
      brand: true,
      condition: true,
      suggested_price: true
    }
  })

  console.log('\n📦 Peças criadas:')
  for (const part of createdParts) {
    console.log(`- ${part.name} (${part.brand}) - ${part.condition} - R$ ${part.suggested_price}`)
  }

  console.log('\n🎉 Seeding concluído com sucesso!')
}

main()
  .catch((e) => {
    console.error('❌ Erro durante o seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 
import OpenAI from 'openai';

interface ProcessedImageResult {
  partName: string;
  description: string;
}

interface ProcessedMultipleImageResult {
  name: string;
  description: string;
}

interface ProcessingError {
  error: string;
  message: string;
}

// Instância compartilhada do OpenAI
let openai: OpenAI;

function initializeOpenAI() {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      console.log('OPENAI_API_KEY não encontrada nas variáveis de ambiente');
      throw new Error('OPENAI_API_KEY is required');
    }
    
    console.log('Chave OpenAI encontrada, inicializando...');
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

export function validateImage(buffer: Buffer, filename: string): boolean {
  // Verifica tamanho do arquivo (50MB = 50 * 1024 * 1024 bytes)
  const maxSizeInBytes = 52428800;
  if (buffer.length > maxSizeInBytes) {
    throw new Error('File size exceeds 50MB limit');
  }

  // Verifica formato do arquivo
  const jpegMagic = [0xFF, 0xD8, 0xFF];
  const pngMagic = [0x89, 0x50, 0x4E, 0x47];
  const webpMagic = [0x52, 0x49, 0x46, 0x46]; // Primeiros 4 bytes, seguidos por WEBP

  const isJpeg = jpegMagic.every((byte, index) => buffer[index] === byte);
  const isPng = pngMagic.every((byte, index) => buffer[index] === byte);
  const isWebp = webpMagic.every((byte, index) => buffer[index] === byte) && 
                 buffer.slice(8, 12).toString() === 'WEBP';

  if (!isJpeg && !isPng && !isWebp) {
    throw new Error('Invalid file format. Only JPEG, PNG and WEBP are allowed');
  }

  return true;
}

export function convertToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

function cleanOpenAIResponse(content: string): string {
  // Remove blocos de código markdown se presentes
  let cleanContent = content.trim();
  if (cleanContent.startsWith('```json')) {
    cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleanContent.startsWith('```')) {
    cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleanContent;
}

export async function processMultipleImages(dataUrls: string[]): Promise<ProcessedMultipleImageResult | ProcessingError> {
  try {
    const client = initializeOpenAI();
    
    console.log(`Iniciando análise de ${dataUrls.length} imagens`);
    dataUrls.forEach((url, index) => {
      const sizeInfo = url.length > 100 ? `${url.length} caracteres` : 'inválido';
      const typeMatch = url.match(/^data:([^;]+);base64,/);
      const mimeType = typeMatch ? typeMatch[1] : 'desconhecido';
      console.log(`  Imagem ${index + 1}: ${mimeType} (${sizeInfo})`);
    });

    const imageContent = dataUrls.map(url => ({
      type: "image_url" as const,
      image_url: {
        url: url
      }
    }));

    console.log('Enviando requisição para OpenAI...');
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Identifique a peça de carro na imagem e forneça seu nome e uma descrição detalhada.
Liste as informações no formato JSON:
{
  "name": "nome",
  "description": "descrição"
}

IMPORTANTE: 
- Analise todas as imagens fornecidas para ter uma visão completa da peça
- As imagens mostram a mesma peça de diferentes ângulos
- Forneça o nome específico da peça automotiva
- Inclua uma descrição detalhada com função, características e aplicações
- Se não conseguir identificar com certeza, retorne: {"error": "low_confidence", "message": "Não foi possível identificar a peça com precisão suficiente"}
- Seja específico e técnico na descrição`
            },
            ...imageContent
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.1
    });

    const content = response.choices[0]?.message?.content;
    console.log('📥 Resposta OpenAI recebida');
    console.log('📄 Conteúdo bruto:', content);
    
    if (!content) {
      console.log('❌ Nenhum conteúdo na resposta OpenAI');
      return {
        error: "api_error",
        message: "Erro na resposta da API. Tente novamente ou insira os dados manualmente."
      };
    }

    try {
      const cleanContent = cleanOpenAIResponse(content);
      console.log('🧹 Conteúdo limpo:', cleanContent);
      const parsedResponse = JSON.parse(cleanContent);
      console.log('📊 Resposta parseada:', parsedResponse);
      
      // Verifica se é uma resposta de erro
      if (parsedResponse.error) {
        console.log('⚠️ OpenAI retornou resposta de erro:', parsedResponse.error);
        return {
          error: parsedResponse.error,
          message: "Não foi possível identificar a peça com precisão suficiente. Por favor, insira os dados manualmente."
        };
      }

      // Valida campos obrigatórios
      if (!parsedResponse.name || !parsedResponse.description) {
        console.log('❌ Campos obrigatórios ausentes:', { 
          hasName: !!parsedResponse.name, 
          hasDescription: !!parsedResponse.description 
        });
        return {
          error: "invalid_response",
          message: "Resposta incompleta da API. Por favor, insira os dados manualmente."
        };
      }

      // Verifica respostas vagas
      const vaguePhrases = [
        "não encontrei",
        "não consigo identificar",
        "não é possível",
        "imagem não está clara",
        "não tenho certeza"
      ];

      const responseText = `${parsedResponse.name} ${parsedResponse.description}`.toLowerCase();
      const hasVaguePhrase = vaguePhrases.some(phrase => responseText.includes(phrase));

      if (hasVaguePhrase) {
        console.log('⚠️ Resposta vaga detectada em:', responseText);
        return {
          error: "vague_response",
          message: "Não foi possível identificar a peça com precisão suficiente. Por favor, insira os dados manualmente."
        };
      }

      console.log('✅ Identificação bem-sucedida:', { 
        name: parsedResponse.name, 
        descriptionLength: parsedResponse.description.length 
      });
      return {
        name: parsedResponse.name,
        description: parsedResponse.description
      };

    } catch (parseError) {
      console.error('Erro ao fazer parse da resposta OpenAI:', parseError);
      console.error('Resposta bruta OpenAI:', content);
      return {
        error: "parse_error",
        message: "Erro ao processar resposta da API. Por favor, insira os dados manualmente."
      };
    }

  } catch (error: unknown) {
    console.error('Erro da API OpenAI:', error);
    
    // Verifica se é erro de rate limit
    if (error && typeof error === 'object' && 'status' in error && error.status === 429) {
      const errorObj = error as { headers?: { 'retry-after'?: string } };
      const retryAfter = errorObj.headers?.['retry-after'];
      const retryMessage = retryAfter ? ` Tente novamente em ${Math.ceil(Number(retryAfter) / 60)} minutos.` : '';
      return {
        error: "rate_limit",
        message: `Limite de uso da API excedido.${retryMessage} Tente novamente mais tarde ou insira os dados manualmente.`
      };
    }
    
    return {
      error: "api_error",
      message: "Erro de conexão com a API. Tente novamente ou insira os dados manualmente."
    };
  }
}

export async function identifyAutomotivePart(base64Image: string): Promise<ProcessedImageResult | ProcessingError> {
  try {
    const client = initializeOpenAI();

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Identifique a peça de carro na imagem e forneça seu nome e uma descrição detalhada.
Liste as informações no formato JSON:
{
  "name": "nome da peça",
  "description": "descrição detalhada"
}

IMPORTANTE: 
- Forneça o nome específico da peça automotiva
- Inclua uma descrição detalhada com função, características e aplicações
- Se não conseguir identificar com certeza, retorne: {"error": "low_confidence", "message": "Não foi possível identificar a peça com precisão suficiente"}
- Seja específico e técnico na descrição`
            },
            {
              type: "image_url",
              image_url: {
                url: base64Image
              }
            }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.1
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      return {
        error: "api_error",
        message: "Erro na resposta da API. Tente novamente ou insira os dados manualmente."
      };
    }

    try {
      const cleanContent = cleanOpenAIResponse(content);
      const parsedResponse = JSON.parse(cleanContent);
      
      // Verifica se é uma resposta de erro
      if (parsedResponse.error) {
        return {
          error: parsedResponse.error,
          message: "Não foi possível identificar a peça com precisão suficiente. Por favor, insira os dados manualmente."
        };
      }

      // Valida campos obrigatórios
      if (!parsedResponse.partName || !parsedResponse.description) {
        return {
          error: "invalid_response",
          message: "Resposta incompleta da API. Por favor, insira os dados manualmente."
        };
      }

      return {
        partName: parsedResponse.partName,
        description: parsedResponse.description
      };

    } catch (parseError) {
      console.error('Erro ao fazer parse da resposta OpenAI:', parseError);
      return {
        error: "parse_error",
        message: "Erro ao processar resposta da API. Por favor, insira os dados manualmente."
      };
    }

  } catch (error) {
    console.error('Erro da API OpenAI:', error);
    return {
      error: "api_error",
      message: "Erro de conexão com a API. Tente novamente ou insira os dados manualmente."
    };
  }
}

export async function processImage(buffer: Buffer, filename: string): Promise<ProcessedImageResult | ProcessingError> {
  try {
    validateImage(buffer, filename);
    const base64 = convertToBase64(buffer);
    const dataUrl = `data:image/jpeg;base64,${base64}`;
    return await identifyAutomotivePart(dataUrl);

  } catch (error) {
    console.error('Erro no processamento da imagem:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('File size exceeds')) {
        return {
          error: "file_too_large",
          message: "Arquivo muito grande. Tamanho máximo permitido: 50MB."
        };
      }
      
      if (error.message.includes('Invalid file format')) {
        return {
          error: "invalid_format",
          message: "Formato de arquivo inválido. Apenas JPEG, PNG e WEBP são aceitos."
        };
      }
    }

    return {
      error: "processing_error",
      message: "Erro no processamento da imagem. Tente novamente ou insira os dados manualmente."
    };
  }
} 
import QRCode from 'qrcode';
import { config } from 'dotenv';

config();

export interface QRCodeResult {
  qrCodeData: string; // Base64 data URL da imagem do QR code
  url: string; // URL que o QR code aponta
}

export interface QRCodeError {
  error: string;
  message: string;
}

/**
 * Gera um QR code para uma peça específica
 */
export async function generatePartQRCode(partId: string): Promise<QRCodeResult | QRCodeError> {
  try {
    const frontEndUrl = process.env.FRONT_END_URL;
    
    if (!frontEndUrl) {
      return {
        error: 'config_error',
        message: 'URL do front-end não configurada.'
      };
    }

    // Remove barras extras no final da URL
    const baseUrl = frontEndUrl.replace(/\/+$/, '');
    
    // Constrói a URL para a página da peça
    const partUrl = `${baseUrl}/part/${partId}`;

    console.log(`📱 Gerando QR code para: ${partUrl}`);

    // Gera o QR code como data URL (base64)
    const qrCodeData = await QRCode.toDataURL(partUrl, {
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256 // Tamanho 256x256 pixels
    });

    console.log('✅ QR code gerado com sucesso');

    return {
      qrCodeData,
      url: partUrl
    };

  } catch (error) {
    console.error('❌ Erro ao gerar QR code:', error);
    
    return {
      error: 'qrcode_generation_error',
      message: 'Erro ao gerar QR code. Tente novamente.'
    };
  }
}

/**
 * Gera um QR code como buffer PNG
 */
export async function generatePartQRCodeBuffer(partId: string): Promise<Buffer | QRCodeError> {
  try {
    const frontEndUrl = process.env.FRONT_END_URL;
    
    if (!frontEndUrl) {
      return {
        error: 'config_error',
        message: 'URL do front-end não configurada.'
      };
    }

    // Remove barras extras no final da URL
    const baseUrl = frontEndUrl.replace(/\/+$/, '');
    
    // Constrói a URL para a página da peça
    const partUrl = `${baseUrl}/${partId}`;

    console.log(`📱 Gerando QR code buffer para: ${partUrl}`);

    // Gera o QR code como buffer PNG
    const qrCodeBuffer = await QRCode.toBuffer(partUrl, {
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256 // Tamanho 256x256 pixels
    });

    console.log('✅ QR code buffer gerado com sucesso');

    return qrCodeBuffer;

  } catch (error) {
    console.error('❌ Erro ao gerar QR code buffer:', error);
    
    return {
      error: 'qrcode_generation_error',
      message: 'Erro ao gerar QR code. Tente novamente.'
    };
  }
} 
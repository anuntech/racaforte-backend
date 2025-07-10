import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getAccessToken } from '../services/mercadolivre.service';

export async function authRoutes(app: FastifyInstance) {
  /**
   * @swagger
   * /auth/mercadolivre:
   *   get:
   *     summary: Redireciona para autorização do MercadoLivre
   *     tags: [Auth]
   *     description: Gera URL de autorização OAuth do MercadoLivre
   *     responses:
   *       302:
   *         description: Redirecionamento para autorização
   *       400:
   *         description: Credenciais não configuradas
   */
  app.get('/auth/mercadolivre', async (request: FastifyRequest, reply: FastifyReply) => {
    const clientId = process.env.MERCADOLIVRE_CLIENT_ID;
    const redirectUri = process.env.MERCADOLIVRE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return reply.status(400).send({
        error: 'Credenciais do MercadoLivre não configuradas',
        message: 'Configure MERCADOLIVRE_CLIENT_ID e MERCADOLIVRE_REDIRECT_URI no .env'
      });
    }

    const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    return reply.redirect(authUrl);
  });

  /**
   * @swagger
   * /auth/mercadolivre/callback:
   *   get:
   *     summary: Callback de autorização do MercadoLivre
   *     tags: [Auth]
   *     description: Processa callback OAuth e obtém tokens de acesso
   *     parameters:
   *       - in: query
   *         name: code
   *         required: true
   *         schema:
   *           type: string
   *         description: Código de autorização retornado pelo MercadoLivre
   *     responses:
   *       200:
   *         description: Autorização bem-sucedida
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 access_token:
   *                   type: string
   *                 refresh_token:
   *                   type: string
   *       400:
   *         description: Erro na autorização
   */
  app.get('/auth/mercadolivre/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, error } = request.query as { code?: string; error?: string };

    if (error) {
      return reply.status(400).send({
        success: false,
        error: 'Autorização negada',
        message: 'Usuário negou autorização ou ocorreu um erro'
      });
    }

    if (!code) {
      return reply.status(400).send({
        success: false,
        error: 'Código não fornecido',
        message: 'Código de autorização não foi fornecido'
      });
    }

    try {
      // Temporariamente define o código para obter o token
      process.env.MERCADOLIVRE_CODE = code;

      const tokenResult = await getAccessToken();

      if ('error' in tokenResult) {
        return reply.status(400).send({
          success: false,
          error: tokenResult.error,
          message: tokenResult.message
        });
      }

      // Salva os tokens (em produção, você deve salvá-los em um banco de dados)
      process.env.MERCADOLIVRE_ACCESS_TOKEN = tokenResult.access_token;
      process.env.MERCADOLIVRE_REFRESH_TOKEN = tokenResult.refresh_token;

      return reply.send({
        success: true,
        message: 'Autorização bem-sucedida! A API do MercadoLivre está configurada.',
        access_token: `${tokenResult.access_token.substring(0, 10)}...`, // Mostra apenas o início por segurança
        refresh_token: `${tokenResult.refresh_token.substring(0, 10)}...`
      });

    } catch (error) {
      console.error('Erro no callback OAuth:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erro interno',
        message: 'Erro ao processar callback de autorização'
      });
    }
  });

  /**
   * @swagger
   * /auth/mercadolivre/status:
   *   get:
   *     summary: Verifica status da autenticação MercadoLivre
   *     tags: [Auth]
   *     description: Mostra se as credenciais estão configuradas
   *     responses:
   *       200:
   *         description: Status da configuração
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 configured:
   *                   type: boolean
   *                 has_credentials:
   *                   type: boolean
   *                 has_tokens:
   *                   type: boolean
   *                 message:
   *                   type: string
   */
  app.get('/auth/mercadolivre/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const hasCredentials = !!(process.env.MERCADOLIVRE_CLIENT_ID && process.env.MERCADOLIVRE_SECRET_KEY);
    const hasTokens = !!(process.env.MERCADOLIVRE_ACCESS_TOKEN && process.env.MERCADOLIVRE_REFRESH_TOKEN);

    let message = '';
    if (!hasCredentials) {
      message = 'Configure MERCADOLIVRE_CLIENT_ID e MERCADOLIVRE_SECRET_KEY no .env';
    } else if (!hasTokens) {
      message = 'Credenciais configuradas. Acesse /auth/mercadolivre para autorizar.';
    } else {
      message = 'API do MercadoLivre configurada e autorizada ✅';
    }

    return reply.send({
      configured: hasCredentials && hasTokens,
      has_credentials: hasCredentials,
      has_tokens: hasTokens,
      message
    });
  });
} 
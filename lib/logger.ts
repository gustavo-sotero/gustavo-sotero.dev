import pino from 'pino';
import 'server-only';

// Configuração do logger
const isProduction = process.env.NODE_ENV === 'production';

// Criar logger de forma segura para evitar problemas com workers em Next.js
const createLogger = () => {
  // Em produção, usa formato JSON estruturado
  if (isProduction) {
    return pino({
      level: 'info',
      formatters: {
        level: (label) => {
          return { level: label };
        }
      }
    });
  }

  // Em desenvolvimento, usa pino básico (sem pino-pretty que usa workers)
  // O pino-pretty com transport usa workers que podem causar erros em Next.js
  return pino({
    level: 'debug',
    formatters: {
      level: (label) => {
        return { level: label };
      }
    }
  });
};

export const logger = createLogger();

// Funções de conveniência
export const logInfo = (message: string, data?: Record<string, unknown>) => {
  logger.info(data, message);
};

export const logError = (message: string, error?: unknown) => {
  logger.error(
    { error: error instanceof Error ? error.message : error },
    message
  );
};

export const logWarn = (message: string, data?: Record<string, unknown>) => {
  logger.warn(data, message);
};

export const logDebug = (message: string, data?: Record<string, unknown>) => {
  logger.debug(data, message);
};

// Logger específico para métricas de performance
export const logPerformance = (
  metric: string,
  value: number,
  unit: string = 'ms'
) => {
  logger.info(
    {
      type: 'performance',
      metric,
      value,
      unit,
      timestamp: new Date().toISOString()
    },
    `Performance metric: ${metric}`
  );
};

// Logger para eventos de usuário
export const logUserEvent = (event: string, data?: Record<string, unknown>) => {
  logger.info(
    {
      type: 'user_event',
      event,
      data,
      timestamp: new Date().toISOString()
    },
    `User event: ${event}`
  );
};

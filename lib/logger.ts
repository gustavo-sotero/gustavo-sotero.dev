import pino from 'pino';

// Configuração do logger
const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: isProduction ? 'info' : 'debug',
  ...(isProduction
    ? {
        // Em produção, usa formato JSON estruturado
        formatters: {
          level: (label) => {
            return { level: label };
          }
        }
      }
    : {
        // Em desenvolvimento, usa formato legível
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:dd-mm-yyyy HH:MM:ss',
            ignore: 'pid,hostname'
          }
        }
      })
});

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

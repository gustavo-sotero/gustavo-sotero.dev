// Hono context variable types
export interface Variables {
  requestId: string;
  adminId?: string;
  jwtPayload?: {
    sub: string;
    role: string;
    exp: number;
    iat: number;
  };
}

// Hono environment type used across the application
export type AppEnv = {
  Variables: Variables;
};

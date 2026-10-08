import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  console.error(`[M63_SERVER_ERROR] [${req.method} ${req.url}]:`, err);

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request payload validation failed.',
        details: err.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message
        }))
      }
    });
    return;
  }

  // Graceful degradation response envelope
  const isDev = process.env.NODE_ENV !== 'production';
  const errorMessage = err instanceof Error ? err.message : 'An unexpected server error occurred.';

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: errorMessage,
      ...(isDev && err instanceof Error ? { stack: err.stack } : {})
    }
  });
}

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}

import type { Response } from 'express';

export function ok(res: Response, data: unknown): void {
  res.status(200).json(data);
}

export function created(res: Response, data: unknown): void {
  res.status(201).json(data);
}

export function fail(res: Response, error: unknown, statusCode = 500): void {
  const message = error instanceof Error ? error.message : String(error);
  res.status(statusCode).json({ error: message });
}

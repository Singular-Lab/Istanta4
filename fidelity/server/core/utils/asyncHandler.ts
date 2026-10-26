import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async route handler to automatically catch and forward errors to Express error handler.
 * Eliminates the need for try-catch blocks in every controller method.
 *
 * @param fn - The async route handler function
 * @returns A wrapped function that catches errors and passes them to next()
 *
 * @example
 * // Before (repetitive try-catch)
 * async getUser(req: Request, res: Response, next: NextFunction) {
 *   try {
 *     const user = await userService.findById(req.params.id);
 *     res.json(user);
 *   } catch (error) {
 *     next(error);
 *   }
 * }
 *
 * // After (clean and simple)
 * this.router.get('/:id', asyncHandler(async (req, res) => {
 *   const user = await userService.findById(req.params.id);
 *   res.json(user);
 * }));
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Type-safe async handler that preserves request parameter types.
 * Use this when you need typed params, query, or body.
 *
 * @example
 * interface UserParams { id: string }
 * interface UserQuery { include?: string }
 *
 * router.get('/:id', typedAsyncHandler<UserParams, UserQuery>(async (req, res) => {
 *   const { id } = req.params; // typed as string
 *   const { include } = req.query; // typed as string | undefined
 *   // ...
 * }));
 */
export const typedAsyncHandler = <
  P = Record<string, string>,
  Q = Record<string, string | undefined>,
  B = any
>(
  fn: (
    req: Request<P, any, B, Q>,
    res: Response,
    next: NextFunction
  ) => Promise<any>
): RequestHandler<P, any, B, Q> => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default asyncHandler;

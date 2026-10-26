/**
 * Dependency Injection Module
 *
 * Exports the IoC container and type symbols for dependency injection.
 *
 * Usage:
 * ```typescript
 * import { container, TYPES, getService } from '@di';
 *
 * // Get a service instance
 * const userService = getService<IUserService>(TYPES.UserService);
 *
 * // Or directly from container
 * const gdoService = container.get<IGdoService>(TYPES.GdoService);
 * ```
 */

export { TYPES, type ServiceTypes } from './types';
export {
  container,
  initializeContainer,
  getService,
  hasBinding,
  resetContainer
} from './container';

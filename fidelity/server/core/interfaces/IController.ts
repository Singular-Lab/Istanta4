import { Express } from 'express';

export interface IController {
    initializeRoutes(): void;
    registerRoutes(app: Express): void;
} 
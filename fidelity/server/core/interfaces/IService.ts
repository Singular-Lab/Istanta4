export interface IService {
    initialize(): Promise<void>;
    cleanup(): Promise<void>;
} 
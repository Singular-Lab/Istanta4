export interface ITraduzioneService {
    getTraduzioni(language: string, namespace: string): Promise<Record<string, unknown>>;
} 
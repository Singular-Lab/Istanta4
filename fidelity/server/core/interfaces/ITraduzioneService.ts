import { TraduzioniAttributes } from '../../../lib/types';

export interface ITraduzioneService {
    getTraduzioni(language: string, namespace: string): Promise<any>;
} 
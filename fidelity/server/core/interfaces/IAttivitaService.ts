import type { CATEGORIA_ATTIVITA } from '../../../lib/enums';
import { AttivitaResponseDTO } from '../dto';
import type { UnreadCountResponse } from '../services/AttivitaService';

export interface GetAttivitaOptions {
  limit?: number;
  offset?: number;
  categoria?: CATEGORIA_ATTIVITA;
  soloNonLette?: boolean;
}
export interface IAttivitaService {

  get_attivita(userId?: string, limit?: number, offset?: number, options?: GetAttivitaOptions): Promise<AttivitaResponseDTO[]>;
  mark_as_read(userId: string, idAttivita: string): Promise<void>;
  mark_as_unread(userId: string, idAttivita: string): Promise<void>;
  mark_all_as_read(userId: string): Promise<void>;
  findUnreadByUser(userId: string): Promise<AttivitaResponseDTO[]>;
  findReadByUser(userId: string): Promise<AttivitaResponseDTO[]>;
  countUnreadByUser(userId: string): Promise<number>;
  markAllAsReadForUser(userId: string): Promise<[number]>;
  markAsReadWithReturn(userId: string, idAttivita: string): Promise<AttivitaResponseDTO[]>;
  getAttivitaUnreadOnly(userId: string, limit?: number): Promise<AttivitaResponseDTO[]>;
  getAttivitaReadOnly(userId: string, limit?: number, offset?: number): Promise<AttivitaResponseDTO[]>;
  getAttivitaCount(userId?: string): Promise<{ total: number; unread: number; read: number }>;
  countUnreadForUser(userId: string): Promise<UnreadCountResponse>;
}

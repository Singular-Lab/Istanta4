import { CreateFormatiDTO, FormatiResponseDTO } from '../dto';

export interface IFormatoService {
  getAllFormati(): Promise<FormatiResponseDTO[]>;
  getFormatoById(id: string): Promise<FormatiResponseDTO | null>;
  createFormato(data: CreateFormatiDTO): Promise<FormatiResponseDTO>;
  deleteFormato(id: string): Promise<any>;
}

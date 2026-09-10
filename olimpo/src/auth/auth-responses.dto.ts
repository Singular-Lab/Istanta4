import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({ description: 'Indica se l\'autenticazione ha avuto successo', example: true })
  esito: boolean;

  @ApiProperty({ description: 'Messaggio che descrive l\'esito dell\'autenticazione', example: 'Token valido' })
  message: string;

  @ApiProperty({ description: 'Codice di stato HTTP', example: 200 })
  statusCode: number;

}

import { Test, TestingModule } from '@nestjs/testing';
import { ImpostazioniController } from './impostazioni.controller';

describe('ImpostazioniController', () => {
  let controller: ImpostazioniController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImpostazioniController],
    }).compile();

    controller = module.get<ImpostazioniController>(ImpostazioniController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

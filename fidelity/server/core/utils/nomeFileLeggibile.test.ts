import { describe, expect, it } from 'vitest';
import { estensioneNota, NOME_FILE_DI_RISERVA, nomeFileLeggibile } from './nomeFileLeggibile';

// Spec dati-consultazione, "Download dei file pubblicati dalla Visualizzazione": il nome leggibile del
// file con la sua estensione; il nome archiviato su Olimpo solo di riserva.

describe('nomeFileLeggibile', () => {
  it('il nome leggibile con l\'estensione del nome archiviato, non il GUID di Olimpo', () => {
    expect(nomeFileLeggibile('SS_LI_24-09-26', '29357a16-9bfb-46db-af10-2bb9ed86180d.pdf', null)).toBe('SS_LI_24-09-26.pdf');
    expect(nomeFileLeggibile('  Banner web ', 'abc.ZIP', null)).toBe('Banner web.zip');
  });

  it('un nome che ha gia\' la sua estensione resta com\'e\'', () => {
    expect(nomeFileLeggibile('volantino.pdf', '29357a16.pdf', 'application/pdf')).toBe('volantino.pdf');
    expect(nomeFileLeggibile('Locandina.JPG', 'x.png', null)).toBe('Locandina.JPG');
  });

  it('senza estensione nel nome archiviato si prende quella del tipo del file', () => {
    expect(nomeFileLeggibile('SS_LI_24-09-26', '29357a16', 'application/pdf')).toBe('SS_LI_24-09-26.pdf');
    expect(nomeFileLeggibile('Cartello', null, 'image/jpeg; charset=binary')).toBe('Cartello.jpg');
    // Tipo sconosciuto e niente estensione: il nome leggibile com'e'
    expect(nomeFileLeggibile('Cartello', null, 'application/x-sconosciuto')).toBe('Cartello');
  });

  it('una data con i punti non e\' un\'estensione', () => {
    expect(estensioneNota('Volantino 24.09.26')).toBeNull();
    expect(nomeFileLeggibile('Volantino 24.09.26', 'f.pdf', null)).toBe('Volantino 24.09.26.pdf');
  });

  it('senza nome leggibile il nome archiviato, poi quello di riserva', () => {
    expect(nomeFileLeggibile('  ', '29357a16.pdf', null)).toBe('29357a16.pdf');
    expect(nomeFileLeggibile(null, null, null)).toBe(NOME_FILE_DI_RISERVA);
  });
});

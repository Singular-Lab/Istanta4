import { describe, expect, it } from 'vitest';
import { pianificaUrlFilesRuntime } from '../migrazioneUrlFilesRuntime';

// Migrazione di files_runtime.url (yarn migrate:olimpo-urls): il piano e' lo stesso in dry-run e in esecuzione
describe('pianificaUrlFilesRuntime', () => {
  it('azzera l URL delle righe con id Olimpo, anche se gia relativo: si ricostruisce alla lettura', () => {
    const piano = pianificaUrlFilesRuntime([
      { id: 'f1', id_olimpo_cloud: 'o1', url: 'http://olimpo:3000/materiali/getThumbnailMaterialePdfs?id=vecchio' },
      { id: 'f2', id_olimpo_cloud: 'o2', url: '/olimpo/materiali/getMaterialePDF?id=o2' },
    ]);

    expect(piano.aggiornamenti).toEqual([{ id: 'f1', url: null }, { id: 'f2', url: null }]);
    expect(piano).toMatchObject({ azzerati: 2, riscritti: 0 });
  });

  it('senza id Olimpo riscrive l URL interno nella forma relativa al proxy', () => {
    const piano = pianificaUrlFilesRuntime([
      { id: 'f1', id_olimpo_cloud: null, url: 'http://olimpo:3000/materiali/getMaterialePDF?id=l1' },
      { id: 'f2', id_olimpo_cloud: '', url: 'http://10.0.0.5:4000/olimpo/materiali/getThumbnailMaterialePdfs?id=l2' },
    ]);

    expect(piano.aggiornamenti).toEqual([
      { id: 'f1', url: '/olimpo/materiali/getMaterialePDF?id=l1' },
      { id: 'f2', url: '/olimpo/materiali/getThumbnailMaterialePdfs?id=l2' },
    ]);
    expect(piano).toMatchObject({ azzerati: 0, riscritti: 2 });
  });

  it('lascia invariate le righe senza URL, gia relative o con URL che non sono di Olimpo', () => {
    const piano = pianificaUrlFilesRuntime([
      { id: 'f1', id_olimpo_cloud: 'o1', url: null },
      { id: 'f2', id_olimpo_cloud: null, url: '' },
      { id: 'f3', id_olimpo_cloud: null, url: '/olimpo/materiali/getMaterialePDF?id=l3' },
      { id: 'f4', id_olimpo_cloud: null, url: 'https://cdn.example.com/volantino.pdf' },
    ]);

    expect(piano).toEqual({ aggiornamenti: [], azzerati: 0, riscritti: 0 });
  });
});

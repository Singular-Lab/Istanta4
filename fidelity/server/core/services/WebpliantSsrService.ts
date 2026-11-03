import { TIPO_PAGINA } from '../../../lib/enums';
import { BadRequestError, NotFoundError } from '../../../lib/errors';
import type { PageLayoutItem } from '../../../lib/types';
import type { DatiWebpliantSsr } from '../../../src/ssr/webpliant';
import type { IConfigService } from '../interfaces/IConfigService';
import type { IReferenzeService } from '../interfaces/IReferenzeService';
import type { IWebPliantService } from '../interfaces/IWebPliantService';

export class WebpliantSsrService {
  constructor(
    private readonly workspaceService: IWebPliantService,
    private readonly referenzeService: IReferenzeService,
    private readonly configService: IConfigService,
  ) {}

  async carica(url: URL): Promise<DatiWebpliantSsr> {
    const idWorkspace = url.searchParams.get('id');
    const idArea = url.searchParams.get('idArea');
    const idCanale = url.searchParams.get('idCanale');
    if (!idWorkspace || !idArea || !idCanale) {
      throw new BadRequestError({ message: 'Workspace, area e canale sono obbligatori' });
    }
    const [workspace, config, css] = await Promise.all([
      this.workspaceService.prendiWorkspaceDaID(idWorkspace, false),
      this.configService.get_config(),
      this.configService.getStiliToText(),
    ]);
    const idPagina = url.searchParams.get('idPagina')
      || workspace.webpliant?.find(pagina => pagina.tipo === TIPO_PAGINA.HOMEPAGE)?.id;
    const pagina = workspace.webpliant?.find(elemento => elemento.id === idPagina);
    if (!pagina) {
      throw new NotFoundError({
        message: 'Pagina del volantino non trovata',
        entityType: 'PaginaWebPliant',
        entityId: idPagina ?? idWorkspace,
      });
    }
    const giorno = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
    const idPV = url.searchParams.get('idPV') || undefined;
    const caricaReferenze = (item: PageLayoutItem) => this.referenzeService.getFilteredReferenze(
      idWorkspace, giorno, idArea, idCanale, idPV, item, false,
    );
    const referenze = await caricaReferenze({ id: 'ssr-global', type: 'griglia_referenze', content: {} } as PageLayoutItem);
    const elementi: PageLayoutItem[] = [];
    const visita = (items: PageLayoutItem[]) => {
      for (const item of items) {
        if (item.type === 'carousel' || item.type === 'griglia_referenze') elementi.push(item);
        if (item.children) visita(item.children);
      }
    };
    visita(pagina.struttura ?? []);
    const blocchi: DatiWebpliantSsr['blocchi'] = {};
    for (let indice = 0; indice < elementi.length; indice += 4) {
      await Promise.all(elementi.slice(indice, indice + 4).map(async item => {
        const refs = await caricaReferenze(item);
        const validita = item.type === 'carousel'
          ? await this.workspaceService.getDataValiditaPerCarosello(item.content, refs).catch(() => '')
          : '';
        blocchi[item.id] = { referenze: refs, validita };
      }));
    }
    return {
      url: url.pathname + url.search,
      giorno,
      idPagina: String(idPagina),
      dataWebPliant: workspace,
      config: { webpliant: config.webpliant, color: config.color } as typeof config,
      css,
      referenze,
      blocchi,
    };
  }
}

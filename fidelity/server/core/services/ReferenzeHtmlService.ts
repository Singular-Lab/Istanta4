/**
 * ReferenzeHtmlService.ts
 * Servizio per generare HTML server-side delle referenze del volantino
 * Usa il componente React BoxRefServer con renderToStaticMarkup
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ConfigWebpliant,
  ReferenzeIstanta
} from '../../../lib/types';
import { BoxRefServer } from '../components/BoxRefServer';
import { log } from '../logger';

interface RenderOptions {
  baseUrl: string;
}

export class ReferenzeHtmlService {
  /**
   * Inizializza il servizio (mantenuto per compatibilità)
   */
  initialize(cssText: string): void {
    log.info(`CSS disponibile: ${cssText.length} caratteri`);
  }

  /**
   * Renderizza una singola referenza in HTML usando React
   */
  renderReferenza(
    referenza: ReferenzeIstanta,
    config: ConfigWebpliant,
    options: RenderOptions
  ): string {
    try {
      // Crea il componente React
      const element = React.createElement(BoxRefServer, {
        referenza,
        config,
        options: {
          baseUrl: options.baseUrl,
        },
      });

      // Renderizza in HTML statico
      const html = renderToStaticMarkup(element);
      //HACK sostituiamo tutti i classname con class per compatibilità HTML
      let fixedHtml = html.replace(/className="/g, 'class="');

      // Inietta codice-ref sul primo tag di apertura
      const codiceRef = referenza.dataFields?.codice_referenza;
      if (codiceRef) {
        fixedHtml = fixedHtml.replace(/^(<\w+)/, `$1 codice-ref="${codiceRef}"`);
      }

      return fixedHtml;
    } catch (error) {
      log.error('Error rendering referenza', {
        error: error instanceof Error ? error.message : 'Unknown error',
        codice: referenza.dataFields?.codice_referenza
      });
      return '';
    }
  }
}

// Export singleton instance
export const referenzeHtmlService = new ReferenzeHtmlService();

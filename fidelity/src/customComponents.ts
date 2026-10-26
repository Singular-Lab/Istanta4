if (typeof window !== 'undefined') {

  class PrezzoCentesimi extends HTMLElement {
    connectedCallback() {
      let value = this.textContent?.trim();
      // Se il valore ha una sola cifra, aggiungi uno 0 alla fine
      if (value && value.length === 1) {
        value = value.padEnd(2, '0');
      }
      this.textContent = value ?? null;
    }
  }
  customElements.define('prezzo-centesimi', PrezzoCentesimi);



  class Prezzo extends HTMLElement {

  }
  customElements.define('prezzo-euro', Prezzo);


  // Definizione del custom element <descrizione-referenza>
  class DescrizioneReferenza extends HTMLDivElement {
    constructor() {
      super();
      // Creazione dello Shadow DOM
      const shadow = this.attachShadow({ mode: 'open' });

      // Creazione dello stile per disporre i contenuti in una riga
      const style = document.createElement('style');
      style.textContent = `
      :host {
        display: flex;
        flex-direction: row;
        align-items: center;
      }
      /* Facoltativo: aggiungi margine tra gli elementi se necessario */
      ::slotted(*) {
        margin-right: 2px;
      }
    `;

      // Creazione di un elemento slot per ospitare i contenuti inseriti
      const slot = document.createElement('slot');

      // Aggiungi lo stile e lo slot allo Shadow DOM
      shadow.appendChild(style);
      shadow.appendChild(slot);
    }

  }
  customElements.define('descrizione-referenza', DescrizioneReferenza, { extends: 'div' });


}


// Registra il custom element

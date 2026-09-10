/* cssFramework.js
   Editor per dbRidimensionamentiAllineamenti dentro SourceFrameworkCss.json.

   Terminologia ed enumerazioni prese dalla "Guida all’uso del Css framework":
   ridimensionamenti -> post-ridimensionamenti -> allineamenti, in quest’ordine.

   Legge il file statico come fa la scheda Source e salva con l'endpoint che
   esiste gia', FrameworkCssController/salvaSourceJsonCode: nessun controller
   nuovo, nessuna modifica lato server. */

class CssFramework {

    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.radice = null;   // l'intero SourceFrameworkCss.json
        this.db = null;       // scorciatoia su dbRidimensionamentiAllineamenti
        this.sporco = false;
    }

    /* ================= enumerazioni (dalla guida) ================= */

    static get MODO_ASSE() {
        return [
            [null, 'niente'],
            [0, 'proporzionale'],
            [1, 'ingrandimento lineare'],
            [2, 'spostamento lineare'],
            [3, 'spostamento lineare centrato']
        ];
    }

    static get LETTURA_LIVELLI() {
        return [
            [null, '—'],
            [0, 'colonne, scorre a destra'],
            [1, 'colonne, scorre a sinistra'],
            [2, 'righe, scorre in basso'],
            [3, 'righe, scorre in alto']
        ];
    }

    static get ANCORA_INTERNA() {
        return [
            [null, 'non scorre'],
            [0, 'a sinistra'],
            [1, 'a destra'],
            [2, 'in alto'],
            [3, 'in basso']
        ];
    }

    static get LATO_X() {
        return [[null, '—'], [0, 'sinistro'], [1, 'destro'], [2, 'centro']];
    }

    static get LATO_Y() {
        return [[null, '—'], [0, 'superiore'], [1, 'inferiore'], [2, 'centro']];
    }

    static get FIT() {
        return [
            [0, 'frame al contenuto'],
            [1, 'contenuto al frame'],
            [2, 'proporzionale'],
            [3, 'riempi proporzionalmente']
        ];
    }

    static get PRIORITA() {
        return [[null, 'prima X (default)'], [0, 'prima X'], [1, 'prima Y']];
    }

    static get TIPO_LAVORAZIONE() {
        return [[1, 'Volantino'], [2, 'POP']];
    }

    /* ================= utilita' ================= */

    static esc(v) {
        return String(v === null || v === undefined ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    static etichettaEnum(elenco, valore) {
        for (let i = 0; i < elenco.length; i++) {
            if (elenco[i][0] === valore) { return elenco[i][1]; }
        }
        return String(valore);
    }

    // Percorso "0.operazioniPerBox.1.ridimensionamenti.2.nomeGruppo" -> valore
    leggi(percorso) {
        let n = this.db.modificheCssPerKit;
        const p = percorso.split('.');
        for (let i = 0; i < p.length - 1; i++) {
            n = n[isNaN(p[i]) ? p[i] : parseInt(p[i], 10)];
            if (n === null || n === undefined) { return undefined; }
        }
        const ultimo = p[p.length - 1];
        return n[isNaN(ultimo) ? ultimo : parseInt(ultimo, 10)];
    }

    scrivi(percorso, valore) {
        let n = this.db.modificheCssPerKit;
        const p = percorso.split('.');
        for (let i = 0; i < p.length - 1; i++) {
            const k = isNaN(p[i]) ? p[i] : parseInt(p[i], 10);
            if (n[k] === null || n[k] === undefined) { n[k] = isNaN(p[i + 1]) ? {} : []; }
            n = n[k];
        }
        const ultimo = p[p.length - 1];
        n[isNaN(ultimo) ? ultimo : parseInt(ultimo, 10)] = valore;
        this.segnaModificato();
    }

    segnaModificato() {
        this.sporco = true;
        $('#cssfwStato').html('<span class="text-warning">Modifiche non salvate</span>');
        $('#cssfwSalva').prop('disabled', false);
    }

    /* ================= campi ================= */

    campoTesto(percorso, valore, segnaposto, classe) {
        return '<input type="text" class="form-control form-control-sm cssfw-campo ' + (classe || '') + '" '
             + 'data-percorso="' + CssFramework.esc(percorso) + '" data-tipo="testo" '
             + 'value="' + CssFramework.esc(valore) + '" placeholder="' + CssFramework.esc(segnaposto || '') + '">';
    }

    campoNumero(percorso, valore, segnaposto) {
        return '<input type="text" class="form-control form-control-sm cssfw-campo" '
             + 'data-percorso="' + CssFramework.esc(percorso) + '" data-tipo="numero" '
             + 'value="' + (valore === null || valore === undefined ? '' : CssFramework.esc(valore)) + '" '
             + 'placeholder="' + CssFramework.esc(segnaposto || 'vuoto = null') + '">';
    }

    campoLista(percorso, valore) {
        const v = (valore || []).join(', ');
        return '<input type="text" class="form-control form-control-sm cssfw-campo" '
             + 'data-percorso="' + CssFramework.esc(percorso) + '" data-tipo="lista" '
             + 'value="' + CssFramework.esc(v) + '" placeholder="etichette separate da virgola — * è il jolly">';
    }

    campoScelta(percorso, valore, elenco) {
        let h = '<select class="form-select form-select-sm cssfw-campo" '
              + 'data-percorso="' + CssFramework.esc(percorso) + '" data-tipo="enum">';
        elenco.forEach(function (o) {
            const v = (o[0] === null ? '' : o[0]);
            const sel = (o[0] === valore || (o[0] === null && (valore === null || valore === undefined))) ? ' selected' : '';
            h += '<option value="' + v + '"' + sel + '>' + CssFramework.esc(o[1]) + '</option>';
        });
        return h + '</select>';
    }

    campoBooleano(percorso, valore, etichetta) {
        const id = 'chk_' + percorso.replace(/\./g, '_');
        return '<div class="form-check form-check-inline">'
             + '<input class="form-check-input cssfw-campo" type="checkbox" id="' + id + '" '
             + 'data-percorso="' + CssFramework.esc(percorso) + '" data-tipo="bool"'
             + (valore ? ' checked' : '') + '>'
             + '<label class="form-check-label" for="' + id + '" style="font-size:.85rem;">'
             + CssFramework.esc(etichetta) + '</label></div>';
    }

    campoFit(percorso, finalFit) {
        const lista = finalFit || [];
        let h = '<div class="small text-muted mb-1">Fit finale</div>';
        if (lista.length === 0) {
            h += '<div class="text-muted fst-italic small mb-1">nessuno</div>';
        }
        const me = this;
        lista.forEach(function (f, i) {
            h += '<div class="row g-1 mb-1 align-items-center">'
               + '<div class="col-7">' + me.campoLista(percorso + '.' + i + '.nomiElementi', f.nomiElementi) + '</div>'
               + '<div class="col-4">' + me.campoScelta(percorso + '.' + i + '.fit.0', (f.fit || [])[0], CssFramework.FIT) + '</div>'
               + '<div class="col-1 text-end">'
               + '<button class="btn btn-outline-danger btn-sm cssfw-elimina" data-percorso="' + percorso + '" data-indice="' + i + '" title="Rimuovi">&times;</button>'
               + '</div></div>';
        });
        h += '<button class="btn btn-outline-secondary btn-sm cssfw-aggiungi" data-percorso="' + percorso
           + '" data-modello="fit">+ fit</button>';
        return h;
    }

    campoCondizioni(percorso, valore) {
        const n = (valore || []).length;
        const testo = (valore === null || valore === undefined) ? '' : JSON.stringify(valore);
        return '<details class="mt-2"><summary class="small text-muted" style="cursor:pointer;">'
             + 'Condizioni' + (n > 0 ? ' <span class="badge bg-warning text-dark">' + n + '</span>' : ' <span class="text-muted">(nessuna)</span>')
             + '</summary>'
             + '<div class="small text-muted my-1">Struttura non documentata nella guida: si modifica come JSON.</div>'
             + '<textarea class="form-control form-control-sm cssfw-campo" rows="3" '
             + 'data-percorso="' + CssFramework.esc(percorso) + '" data-tipo="json" '
             + 'placeholder="null">' + CssFramework.esc(testo) + '</textarea></details>';
    }

    /* ================= caricamento ================= */

    carica() {
        const me = this;
        const rnd = Math.floor(Math.random() * 999999);
        const url = '/' + getWebAppRootFolder() + 'external_source' + exPathCustom
                  + '/SourceFrameworkCss.json?v1.' + rnd;

        me.container.innerHTML = '<div class="text-muted py-4">Caricamento…</div>';

        $.getJSON(url, function (dati) {
            me.radice = dati || {};
            if (!me.radice.dbRidimensionamentiAllineamenti) {
                me.radice.dbRidimensionamentiAllineamenti = { modificheCssPerKit: [] };
            }
            me.db = me.radice.dbRidimensionamentiAllineamenti;
            if (!Array.isArray(me.db.modificheCssPerKit)) { me.db.modificheCssPerKit = []; }
            me.disegna();
            me.aggancia();
        }).fail(function () {
            me.container.innerHTML = '<div class="alert alert-warning">'
                + '<strong>Attenzione</strong>: non riesco a leggere <code>SourceFrameworkCss.json</code> '
                + 'per questo cliente.</div>';
        });
    }

    /* ================= disegno ================= */

    disegna() {
        const kits = this.db.modificheCssPerKit;
        let nOpb = 0, nRid = 0, nPost = 0, nAll = 0;
        kits.forEach(function (k) {
            (k.operazioniPerBox || []).forEach(function (o) {
                nOpb++;
                nRid += (o.ridimensionamenti || []).length;
                nPost += (o.postRidimensionamenti || []).length;
                nAll += (o.allineamenti || []).length;
            });
        });

        let h = '';

        h += '<div class="d-flex align-items-center mb-3">'
           + '<div class="me-auto small text-muted" id="cssfwStato">Nessuna modifica</div>'
           + '<button class="btn btn-success btn-sm" id="cssfwSalva" disabled>Salva</button>'
           + '</div>';

        h += '<div class="row bg-light rounded py-3 mb-3 mx-0">';
        [[kits.length, 'Kit'], [nOpb, 'Gruppi di box'], [nRid, 'Ridimensionamenti'],
         [nPost, 'Post-ridim.'], [nAll, 'Allineamenti']].forEach(function (v, i, a) {
            h += '<div class="col text-center' + (i < a.length - 1 ? ' border-end' : '') + '">'
               + '<div class="fw-semibold" style="font-size:1.6rem; line-height:1.2;">' + v[0] + '</div>'
               + '<div class="text-muted text-uppercase" style="font-size:.75rem; letter-spacing:.04em;">' + v[1] + '</div>'
               + '</div>';
        });
        h += '</div>';

        h += '<p class="text-muted small">Le tre strutture si eseguono in quest’ordine: '
           + '<strong>ridimensionamenti</strong> (l’elemento cambia in relazione al box), '
           + '<strong>post-ridimensionamenti</strong> (misure fisse o relative ad altri elementi), '
           + '<strong>allineamenti</strong> (posizione rispetto ad altri elementi). '
           + 'Nei ridimensionamenti l’ordine non conta; negli altri due sì.</p>';

        if (kits.length === 0) {
            h += '<div class="alert alert-secondary">Nessun kit definito.</div>';
        }

        const me = this;
        kits.forEach(function (kit, i) { h += me.disegnaKit(kit, i); });

        h += '<button class="btn btn-outline-primary btn-sm cssfw-aggiungi" data-percorso="" data-modello="kit">'
           + '+ Aggiungi kit</button>';

        this.container.innerHTML = h;
    }

    disegnaKit(kit, i) {
        const E = CssFramework.esc;
        const k = kit.kit || {};
        const canali = k.canaliValidi || [], aree = k.areeValide || [];
        const tipi = k.kitTipoLavorazioniValide || [];
        const isDefault = canali.length === 0 && aree.length === 0;

        let titolo = isDefault
            ? '<span class="badge bg-dark me-2">Kit di default</span>'
              + '<span class="text-muted small">vale per tutti i canali e le aree</span>'
            : (canali.length ? '<span class="me-2"><span class="text-muted small">Canali:</span> '
                               + canali.map(function (c) { return '<code>' + E(c) + '</code>'; }).join(' ') + '</span>' : '')
              + (aree.length ? '<span class="me-2"><span class="text-muted small">Aree:</span> '
                               + aree.map(function (a) { return '<code>' + E(a) + '</code>'; }).join(' ') + '</span>' : '');

        const nomiTipi = tipi.map(function (t) {
            return CssFramework.etichettaEnum(CssFramework.TIPO_LAVORAZIONE, t);
        });
        if (nomiTipi.length) {
            titolo += '<span class="badge bg-info text-dark ms-1">' + E(nomiTipi.join(' + ')) + '</span>';
        }

        let h = '<div class="card mb-3">';
        h += '<div class="card-header bg-white d-flex align-items-center py-2">'
           + '<button class="btn btn-link text-decoration-none p-0 me-3 fw-semibold text-dark" type="button" '
           + 'data-bs-toggle="collapse" data-bs-target="#kit_' + i + '">Kit ' + (i + 1) + '</button>'
           + '<div class="me-auto">' + titolo + '</div>'
           + '<button class="btn btn-outline-danger btn-sm cssfw-elimina" data-percorso="" data-indice="' + i + '">Elimina kit</button>'
           + '</div>';

        h += '<div id="kit_' + i + '" class="collapse"><div class="card-body">';

        h += '<div class="row g-2 mb-3">'
           + '<div class="col-md-4"><label class="form-label small mb-1">Canali validi</label>'
           + this.campoLista(i + '.kit.canaliValidi', canali)
           + '<div class="form-text">vuoto = tutti</div></div>'
           + '<div class="col-md-4"><label class="form-label small mb-1">Aree valide</label>'
           + this.campoLista(i + '.kit.areeValide', aree)
           + '<div class="form-text">vuoto = tutte. Canali e aree entrambi vuoti = kit di default</div></div>'
           + '<div class="col-md-4"><label class="form-label small mb-1">Tipo lavorazione</label>'
           + this.campoLista(i + '.kit.kitTipoLavorazioniValide', tipi)
           + '<div class="form-text">1 volantino, 2 POP, vuoto = entrambi</div></div>'
           + '</div>';

        const me = this;
        (kit.operazioniPerBox || []).forEach(function (opb, j) {
            h += me.disegnaOperazioni(opb, i + '.operazioniPerBox.' + j, i, j);
        });

        h += '<button class="btn btn-outline-secondary btn-sm cssfw-aggiungi" '
           + 'data-percorso="' + i + '.operazioniPerBox" data-modello="opb">+ Aggiungi gruppo di box</button>';

        h += '</div></div></div>';
        return h;
    }

    disegnaOperazioni(opb, base, i, j) {
        const E = CssFramework.esc;
        const box = opb.nomiBox || [];
        const id = 'opb_' + i + '_' + j;

        let h = '<div class="border rounded mb-3">';
        h += '<div class="bg-light px-3 py-2 d-flex align-items-center">'
           + '<button class="btn btn-link text-decoration-none p-0 me-3 text-dark" type="button" '
           + 'data-bs-toggle="collapse" data-bs-target="#' + id + '">'
           + (box.length === 0
              ? '<span class="badge bg-secondary">Box di default</span>'
              : box.map(function (b) { return '<code class="me-1">' + E(b) + '</code>'; }).join(''))
           + '</button>'
           + '<span class="text-muted small me-auto">'
           + (opb.ridimensionamenti || []).length + ' ridim. · '
           + (opb.postRidimensionamenti || []).length + ' post · '
           + (opb.allineamenti || []).length + ' allin.</span>'
           + '<button class="btn btn-outline-danger btn-sm cssfw-elimina" data-percorso="' + i
           + '.operazioniPerBox" data-indice="' + j + '">Elimina</button>'
           + '</div>';

        h += '<div id="' + id + '" class="collapse"><div class="p-3">';

        h += '<div class="mb-3"><label class="form-label small mb-1">Nomi box</label>'
           + this.campoLista(base + '.nomiBox', box)
           + '<div class="form-text">vuoto = regole di default, ereditate dai box che non hanno regole proprie</div></div>';

        h += this.sezioneRidimensionamenti(opb.ridimensionamenti || [], base + '.ridimensionamenti');
        h += this.sezionePost(opb.postRidimensionamenti || [], base + '.postRidimensionamenti');
        h += this.sezioneAllineamenti(opb.allineamenti || [], base + '.allineamenti');

        h += '</div></div></div>';
        return h;
    }

    intestazioneSezione(titolo, descrizione, n) {
        return '<div class="mt-3 mb-2 pb-1 border-bottom">'
             + '<span class="fw-semibold">' + CssFramework.esc(titolo) + '</span> '
             + '<span class="badge bg-secondary">' + n + '</span>'
             + '<div class="text-muted small">' + descrizione + '</div></div>';
    }

    sezioneRidimensionamenti(lista, base) {
        const me = this;
        let h = this.intestazioneSezione('Ridimensionamenti',
            'L’elemento cambia dimensione o posizione <em>in relazione</em> a quanto è cambiato il box. L’ordine non è rilevante.',
            lista.length);

        lista.forEach(function (r, i) {
            const p = base + '.' + i;
            const rid = r.ridimensionamento || {};
            h += '<div class="border rounded p-2 mb-2">'
               + '<div class="row g-2">'
               + '<div class="col-md-3"><label class="form-label small mb-1">Nome gruppo</label>'
               + me.campoTesto(p + '.nomeGruppo', r.nomeGruppo, 'facoltativo qui')
               + '</div>'
               + '<div class="col-md-5"><label class="form-label small mb-1">Etichette</label>'
               + me.campoLista(p + '.gruppoEtichette', r.gruppoEtichette) + '</div>'
               + '<div class="col-md-2"><label class="form-label small mb-1">Asse X</label>'
               + me.campoScelta(p + '.ridimensionamento.x', rid.x, CssFramework.MODO_ASSE) + '</div>'
               + '<div class="col-md-2"><label class="form-label small mb-1">Asse Y</label>'
               + me.campoScelta(p + '.ridimensionamento.y', rid.y, CssFramework.MODO_ASSE) + '</div>'
               + '</div>'
               + '<div class="row g-2 mt-1"><div class="col-md-8">'
               + me.campoFit(p + '.finalFit', r.finalFit) + '</div>'
               + '<div class="col-md-4">' + me.campoCondizioni(p + '.listSetCondizioni', r.listSetCondizioni)
               + '<div class="text-end mt-2">'
               + '<button class="btn btn-outline-danger btn-sm cssfw-elimina" data-percorso="' + base
               + '" data-indice="' + i + '">Elimina</button></div></div></div>'
               + '</div>';
        });

        return h + '<button class="btn btn-outline-secondary btn-sm cssfw-aggiungi" data-percorso="' + base
             + '" data-modello="rid">+ ridimensionamento</button>';
    }

    sezionePost(lista, base) {
        const me = this;
        let h = this.intestazioneSezione('Post-ridimensionamenti',
            'L’elemento assume misure precise o relative ad altri elementi, non al box. <strong>L’ordine conta.</strong>',
            lista.length);

        lista.forEach(function (r, i) {
            const p = base + '.' + i;
            const istr = (r.ridimensionamenti || [])[0] || {};
            h += '<div class="border rounded p-2 mb-2">'
               + '<div class="row g-2">'
               + '<div class="col-md-3"><label class="form-label small mb-1">Nome gruppo</label>'
               + me.campoTesto(p + '.nomeGruppo', r.nomeGruppo, 'serve per gli override')
               + '</div>'
               + '<div class="col-md-5"><label class="form-label small mb-1">Etichette</label>'
               + me.campoLista(p + '.gruppoEtichette', r.gruppoEtichette) + '</div>'
               + '<div class="col-md-2"><label class="form-label small mb-1">Ordine</label>'
               + me.campoNumero(p + '.ordine', r.ordine) + '</div>'
               + '</div>'
               + '<div class="row g-2 mt-1">'
               + '<div class="col-md-3"><label class="form-label small mb-1">Istruzione X</label>'
               + me.campoTesto(p + '.ridimensionamenti.0.instructionX', istr.instructionX, 'es. -2  oppure  -logo_x')
               + '</div>'
               + '<div class="col-md-3"><label class="form-label small mb-1">Istruzione Y</label>'
               + me.campoTesto(p + '.ridimensionamenti.0.instructionY', istr.instructionY, '0 o vuoto = niente')
               + '</div>'
               + '<div class="col-md-3"><label class="form-label small mb-1">Larghezza fissa</label>'
               + me.campoNumero(p + '.ridimensionamenti.0.setWidth', istr.setWidth, 'mm') + '</div>'
               + '<div class="col-md-3"><label class="form-label small mb-1">Altezza fissa</label>'
               + me.campoNumero(p + '.ridimensionamenti.0.setHeight', istr.setHeight, 'mm') + '</div>'
               + '</div>'
               + '<div class="row g-2 mt-1"><div class="col-md-8">'
               + me.campoFit(p + '.finalFit', r.finalFit) + '</div>'
               + '<div class="col-md-4">'
               + me.campoCondizioni(p + '.ridimensionamenti.0.listSetCondizioni', istr.listSetCondizioni)
               + '<div class="text-end mt-2">'
               + '<button class="btn btn-outline-danger btn-sm cssfw-elimina" data-percorso="' + base
               + '" data-indice="' + i + '">Elimina</button></div></div></div>'
               + '</div>';
        });

        return h + '<button class="btn btn-outline-secondary btn-sm cssfw-aggiungi" data-percorso="' + base
             + '" data-modello="post">+ post-ridimensionamento</button>';
    }

    sezioneAllineamenti(lista, base) {
        const me = this;
        let h = this.intestazioneSezione('Allineamenti',
            'Posizione degli elementi fra loro (allineamento interno) e del gruppo nel box (ancore). <strong>L’ordine conta.</strong> Le ancore di follow vincono sulle statiche.',
            lista.length);

        lista.forEach(function (a, i) {
            const p = base + '.' + i;
            h += '<div class="border rounded p-2 mb-3">';

            h += '<div class="row g-2">'
               + '<div class="col-md-3"><label class="form-label small mb-1">Nome gruppo</label>'
               + me.campoTesto(p + '.nomeGruppo', a.nomeGruppo, 'serve per gli override') + '</div>'
               + '<div class="col-md-4"><label class="form-label small mb-1">Etichette</label>'
               + me.campoLista(p + '.gruppoEtichette', a.gruppoEtichette) + '</div>'
               + '<div class="col-md-3"><label class="form-label small mb-1">Lettura livelli</label>'
               + me.campoScelta(p + '.letturaLivelli', a.letturaLivelli, CssFramework.LETTURA_LIVELLI) + '</div>'
               + '<div class="col-md-2"><label class="form-label small mb-1">Ordine</label>'
               + me.campoNumero(p + '.ordine', a.ordine) + '</div>'
               + '</div>';

            // livelli interni
            h += '<div class="mt-3 mb-1 small fw-semibold">Allineamento interno</div>';
            h += '<div class="row g-2 mb-2"><div class="col-md-3">'
               + '<label class="form-label small mb-1">Spazio fra livelli</label>'
               + me.campoNumero(p + '.spacingLivelli', a.spacingLivelli, 'vuoto = mantiene')
               + '</div></div>';

            const liv = a.ordinamentoLivelli || [];
            if (liv.length === 0) {
                h += '<div class="text-muted fst-italic small mb-1">Nessun livello.</div>';
            } else {
                h += '<div class="table-responsive"><table class="table table-sm align-middle mb-1">'
                   + '<thead><tr><th style="width:6rem;">Livello</th><th>Elementi</th>'
                   + '<th style="width:10rem;">Se manca, scorre</th><th style="width:7rem;">Spazio</th>'
                   + '<th style="width:9rem;">Text bounds</th><th style="width:4rem;"></th></tr></thead><tbody>';
                liv.forEach(function (l, k) {
                    const q = p + '.ordinamentoLivelli.' + k;
                    h += '<tr>'
                       + '<td>' + me.campoNumero(q + '.livello', l.livello) + '</td>'
                       + '<td>' + me.campoLista(q + '.elementi', l.elementi) + '</td>'
                       + '<td>' + me.campoScelta(q + '.internalAnchor', l.internalAnchor, CssFramework.ANCORA_INTERNA) + '</td>'
                       + '<td>' + me.campoNumero(q + '.spacing', l.spacing) + '</td>'
                       + '<td>' + me.campoBooleano(q + '.allineaATextBounds', l.allineaATextBounds, 'usa testo') + '</td>'
                       + '<td class="text-end"><button class="btn btn-outline-danger btn-sm cssfw-elimina" '
                       + 'data-percorso="' + p + '.ordinamentoLivelli" data-indice="' + k + '">&times;</button></td>'
                       + '</tr>';
                });
                h += '</tbody></table></div>';
            }
            h += '<button class="btn btn-outline-secondary btn-sm mb-2 cssfw-aggiungi" data-percorso="'
               + p + '.ordinamentoLivelli" data-modello="livello">+ livello</button>';

            // ancore
            h += '<div class="mt-2 mb-1 small fw-semibold">Ancore di follow '
               + '<span class="text-muted fw-normal">(seguono un altro gruppo o elemento — hanno la precedenza)</span></div>';
            const fa = a.followAnchor || [];
            if (fa.length === 0) {
                h += '<div class="text-muted fst-italic small mb-1">Nessuna.</div>';
            }
            fa.forEach(function (f, k) {
                const q = p + '.followAnchor.' + k;
                h += '<div class="border rounded p-2 mb-2 bg-light">'
                   + '<div class="row g-2">'
                   + '<div class="col-md-5"><label class="form-label small mb-1">Gruppi seguiti</label>'
                   + me.campoLista(q + '.nomiGruppiSeguiti', f.nomiGruppiSeguiti)
                   + '<div class="form-text">in ordine: usa il primo che trova</div></div>'
                   + '<div class="col-md-3"><label class="form-label small mb-1">Priorità</label>'
                   + me.campoScelta(q + '.priority', f.priority, CssFramework.PRIORITA) + '</div>'
                   + '<div class="col-md-4 d-flex align-items-end">'
                   + me.campoBooleano(q + '.useTextBounds', f.useTextBounds, 'usa i bounds del testo')
                   + '<button class="btn btn-outline-danger btn-sm ms-auto cssfw-elimina" data-percorso="'
                   + p + '.followAnchor" data-indice="' + k + '">&times;</button></div>'
                   + '</div>'
                   + me.bloccoAncora(q + '.xAnchor', f.xAnchor, 'X', CssFramework.LATO_X, true)
                   + me.bloccoAncora(q + '.yAnchor', f.yAnchor, 'Y', CssFramework.LATO_Y, true)
                   + '</div>';
            });
            h += '<button class="btn btn-outline-secondary btn-sm mb-2 cssfw-aggiungi" data-percorso="'
               + p + '.followAnchor" data-modello="follow">+ ancora di follow</button>';

            h += '<div class="mt-2 mb-1 small fw-semibold">Ancore statiche '
               + '<span class="text-muted fw-normal">(rispetto al box)</span></div>';
            const sa = a.staticAnchor || [];
            if (sa.length === 0) {
                h += '<div class="text-muted fst-italic small mb-1">Nessuna.</div>';
            }
            sa.forEach(function (s, k) {
                const q = p + '.staticAnchor.' + k;
                h += '<div class="border rounded p-2 mb-2 bg-light">'
                   + '<div class="text-end"><button class="btn btn-outline-danger btn-sm cssfw-elimina" '
                   + 'data-percorso="' + p + '.staticAnchor" data-indice="' + k + '">&times;</button></div>'
                   + me.bloccoAncora(q + '.xAnchor', s.xAnchor, 'X', CssFramework.LATO_X, false)
                   + me.bloccoAncora(q + '.yAnchor', s.yAnchor, 'Y', CssFramework.LATO_Y, false)
                   + '</div>';
            });
            h += '<button class="btn btn-outline-secondary btn-sm mb-2 cssfw-aggiungi" data-percorso="'
               + p + '.staticAnchor" data-modello="statica">+ ancora statica</button>';

            h += '<div class="row g-2 mt-2"><div class="col-md-8">'
               + me.campoFit(p + '.finalFit', a.finalFit) + '</div>'
               + '<div class="col-md-4">' + me.campoCondizioni(p + '.listSetCondizioni', a.listSetCondizioni)
               + '<div class="text-end mt-2"><button class="btn btn-outline-danger btn-sm cssfw-elimina" '
               + 'data-percorso="' + base + '" data-indice="' + i + '">Elimina allineamento</button></div>'
               + '</div></div>';

            h += '</div>';
        });

        return h + '<button class="btn btn-outline-secondary btn-sm cssfw-aggiungi" data-percorso="' + base
             + '" data-modello="allineamento">+ allineamento</button>';
    }

    bloccoAncora(percorso, ancora, asse, lati, conFollow) {
        const a = ancora || {};
        const attiva = !!ancora;
        let h = '<div class="row g-2 mt-1 align-items-end">';
        h += '<div class="col-md-2"><span class="badge bg-light text-dark border">Ancora ' + asse + '</span>'
           + this.campoBooleano(percorso + '.__attiva', attiva, 'attiva') + '</div>';
        h += '<div class="col-md-2"><label class="form-label small mb-1">Distanza mm</label>'
           + this.campoNumero(percorso + '.distance', a.distance) + '</div>';
        h += '<div class="col-md-3"><label class="form-label small mb-1">Lato del bersaglio</label>'
           + this.campoScelta(percorso + '.allineaAlLato', a.allineaAlLato, lati) + '</div>';
        h += '<div class="col-md-3"><label class="form-label small mb-1">Lato del gruppo</label>'
           + this.campoScelta(percorso + '.allineaLato', a.allineaLato, lati) + '</div>';
        h += '<div class="col-md-2">'
           + this.campoBooleano(percorso + '.applyToSingleLevels', a.applyToSingleLevels, 'per singolo livello');
        if (conFollow) {
            h += this.campoBooleano(percorso + '.stopOnCollision', a.stopOnCollision, 'ferma se collide');
        }
        h += '</div></div>';
        return h;
    }

    /* ================= interazione ================= */

    aggancia() {
        const me = this;
        const c = $(this.container);

        c.off('.cssfw');

        c.on('change.cssfw input.cssfw', '.cssfw-campo', function () {
            const el = $(this);
            const percorso = el.attr('data-percorso');
            const tipo = el.attr('data-tipo');
            let v;

            if (tipo === 'bool') {
                v = el.is(':checked');
                if (percorso.indexOf('.__attiva') > 0) {
                    const vero = percorso.replace('.__attiva', '');
                    me.scrivi(vero, v ? (me.leggi(vero) || {}) : null);
                    me.ridisegna();
                    return;
                }
            } else if (tipo === 'lista') {
                const t = $.trim(el.val());
                v = t === '' ? [] : t.split(',').map(function (x) { return $.trim(x); })
                                     .filter(function (x) { return x !== ''; });
                // le liste numeriche restano numeriche
                if (percorso.indexOf('kitTipoLavorazioniValide') >= 0 || percorso.indexOf('.fit') >= 0) {
                    v = v.map(function (x) { return parseFloat(x); }).filter(function (x) { return !isNaN(x); });
                }
            } else if (tipo === 'numero') {
                const t = $.trim(el.val());
                v = t === '' ? null : (isNaN(parseFloat(t)) ? t : parseFloat(t));
            } else if (tipo === 'enum') {
                const t = el.val();
                v = t === '' ? null : parseInt(t, 10);
            } else if (tipo === 'json') {
                const t = $.trim(el.val());
                try {
                    v = t === '' ? null : JSON.parse(t);
                    el.removeClass('is-invalid');
                } catch (e) {
                    el.addClass('is-invalid');
                    return;
                }
            } else {
                v = el.val();
            }

            me.scrivi(percorso, v);
        });

        c.on('click.cssfw', '.cssfw-elimina', function () {
            const percorso = $(this).attr('data-percorso');
            const indice = parseInt($(this).attr('data-indice'), 10);
            const lista = percorso === '' ? me.db.modificheCssPerKit : me.leggi(percorso);
            if (!Array.isArray(lista)) { return; }
            if (!window.confirm('Eliminare questo elemento?')) { return; }
            lista.splice(indice, 1);
            me.segnaModificato();
            me.ridisegna();
        });

        c.on('click.cssfw', '.cssfw-aggiungi', function () {
            const percorso = $(this).attr('data-percorso');
            const modello = $(this).attr('data-modello');
            let lista;
            if (percorso === '') {
                lista = me.db.modificheCssPerKit;
            } else {
                lista = me.leggi(percorso);
                if (!Array.isArray(lista)) { me.scrivi(percorso, []); lista = me.leggi(percorso); }
            }
            lista.push(CssFramework.modello(modello));
            me.segnaModificato();
            me.ridisegna();
        });

        c.on('click.cssfw', '#cssfwSalva', function () { me.salva(); });
    }

    ridisegna() {
        const aperti = [];
        $(this.container).find('.collapse.show').each(function () { aperti.push(this.id); });
        this.disegna();
        this.aggancia();
        const me = this;
        aperti.forEach(function (id) { $(me.container).find('#' + id).addClass('show'); });
    }

    static modello(tipo) {
        switch (tipo) {
            case 'kit':
                return { operazioniPerBox: [], kit: { canaliValidi: [], areeValide: [], kitTipoLavorazioniValide: [], kitFormatiValidi: [] } };
            case 'opb':
                return { nomiBox: [], ridimensionamenti: [], postRidimensionamenti: [], allineamenti: [], segnalazioniConflitti: [] };
            case 'rid':
                return { nomeGruppo: '', gruppoEtichette: [], itemLinks: [], ridimensionamento: { x: null, y: null, listSetCondizioni: [] }, finalFit: null, listSetCondizioni: null };
            case 'post':
                return { nomeGruppo: '', ordine: 999999, gruppoEtichette: [], itemLinks: [], ridimensionamenti: [{ instructionX: '0', instructionY: '0', setWidth: null, setHeight: null, listSetCondizioni: [] }], finalFit: null };
            case 'allineamento':
                return { nomeGruppo: '', ordine: 999999, gruppoEtichette: [], itemLinks: [], letturaLivelli: 2, ordinamentoLivelli: [], spacingLivelli: null, staticAnchor: [], followAnchor: null, finalFit: [], listSetCondizioni: null, evitaTracciaAllineamento: { evitaTracciaBase: false, useTextBounds: true, distance: 0 } };
            case 'livello':
                return { livello: 1, elementi: [], internalAnchor: null, allineaATextBounds: false, spacing: null, listSetCondizioni: null };
            case 'follow':
                return { nomiGruppiSeguiti: [], xAnchor: null, yAnchor: null, priority: 0, listSetCondizioni: null, useTextBounds: false };
            case 'statica':
                return { xAnchor: null, yAnchor: null, listSetCondizioni: null };
            case 'fit':
                return { nomiElementi: [], fit: [2] };
            default:
                return {};
        }
    }

    /* ================= salvataggio ================= */

    salva() {
        const me = this;
        if (!window.confirm('Salvare la configurazione del CssFramework?\n\n'
            + 'Il file verrà riscritto: assicurati di aver verificato le modifiche.')) { return; }

        $('#cssfwSalva').prop('disabled', true);
        $('#cssfwStato').html('<span class="text-muted">Salvataggio in corso…</span>');

        const payload = JSON.stringify(this.radice);

        // stessa chiamata che usa la scheda Source: (controller, azione, metodo, dati, mittente, callback)
        Call.doWithLargePayload('FrameworkCssController', 'salvaSourceJsonCode', 'PUT',
            { jsoncode: payload, origin: 'SourceFrameworkCss' }, this,
            function (result) {
                if (result && result.esito) {
                    me.sporco = false;
                    $('#cssfwStato').html('<span class="text-success">Salvato</span>');
                } else {
                    $('#cssfwStato').html('<span class="text-danger">Errore: '
                        + CssFramework.esc((result && result.error) || 'salvataggio non riuscito') + '</span>');
                    $('#cssfwSalva').prop('disabled', false);
                }
            });
    }
}

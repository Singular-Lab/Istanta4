/* visualSource.js
   Viste di sola lettura per le pagine di configurazione che mostravano
   "Nessuna interfaccia implementata": Aree/Canali, Formati, Naming Convention,
   Tipi di Export.

   Legge gli stessi file JSON che alimentano la scheda Source, serviti come
   file statici: nessuna chiamata ai controller, nessuna scrittura.
   La configurazione si crea da Fidelity Promotion, che la propaga qui.

   Uso:  new VisualSource('contentVisual').mostra('ACPV');
   Sorgenti ammesse: ACPV | Formati | NamingConvention | TipiDiExport   */

class VisualSource {

    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    /* ---------- utilità ---------- */

    static esc(v) {
        return String(v === null || v === undefined ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    static urlSorgente(nome) {
        const rnd = Math.floor(Math.random() * 999999);
        return '/' + getWebAppRootFolder() + 'external_source' + exPathCustom
             + '/Source' + nome + '.json?v1.' + rnd;
    }

    static badge(testo, colore) {
        return '<span class="badge bg-' + (colore || 'secondary') + '">'
             + VisualSource.esc(testo) + '</span>';
    }

    static idInfo(guid) {
        return '<span class="text-muted" style="cursor:help; font-size:.8rem;" title="'
             + VisualSource.esc(guid) + '">&#9432;</span>';
    }

    static vuoto(cosa, dove) {
        return '<div class="alert alert-secondary" role="alert">'
             + 'Per questo cliente non ' + cosa + '.<br>'
             + '<small class="text-muted">Si definiscono da Fidelity Promotion, in <em>'
             + dove + '</em>: da lì vengono propagati automaticamente qui.</small></div>';
    }

    static nota() {
        return '<div class="alert alert-light border mt-4 mb-0" role="alert" style="font-size:.9rem;">'
             + 'Vista di sola lettura. La configurazione si crea e si modifica da '
             + '<strong>Fidelity Promotion</strong>, che la propaga qui a ogni salvataggio. '
             + 'La scheda <strong>Source</strong> mostra lo stesso contenuto in JSON.</div>';
    }

    static riepilogo(voci) {
        let h = '<div class="row bg-light rounded py-3 mb-4 mx-0">';
        voci.forEach(function (v, i) {
            h += '<div class="col text-center' + (i < voci.length - 1 ? ' border-end' : '') + '">'
               + '<div style="font-size:1.75rem; font-weight:600; line-height:1.2;">' + v[0] + '</div>'
               + '<div class="text-muted" style="font-size:.8rem; text-transform:uppercase; letter-spacing:.04em;">'
               + v[1] + '</div></div>';
        });
        return h + '</div>';
    }

    errore(testo) {
        this.container.innerHTML = '<div class="alert alert-warning" role="alert">'
            + '<strong>Attenzione</strong>: ' + VisualSource.esc(testo) + '</div>';
    }

    /* ---------- ingresso ---------- */

    mostra(sorgente) {
        const me = this;
        me.container.innerHTML = '<div class="text-muted py-4">Caricamento…</div>';

        // I tipi di export citano una naming convention: la carico per mostrarne il nome.
        const extra = (sorgente === 'TipiDiExport')
            ? $.getJSON(VisualSource.urlSorgente('NamingConvention')).then(
                function (d) { return d; }, function () { return null; })
            : $.Deferred().resolve(null).promise();

        $.getJSON(VisualSource.urlSorgente(sorgente))
            .done(function (dati) {
                $.when(extra).always(function (nc) {
                    try {
                        me.render(sorgente, dati || {}, nc || null);
                    } catch (e) {
                        me.errore('errore nel disegnare la vista: ' + e.message);
                        if (window.console) { console.error(e); }
                    }
                });
            })
            .fail(function () {
                me.container.innerHTML =
                    '<div class="alert alert-secondary" role="alert">'
                  + 'Questa configurazione non è ancora stata definita per il cliente.<br>'
                  + '<small class="text-muted">Il file <code>Source' + VisualSource.esc(sorgente)
                  + '.json</code> non esiste nella cartella del cliente.</small></div>';
            });
    }

    render(sorgente, dati, nc) {
        switch (sorgente) {
            case 'ACPV':             this.renderACPV(dati); break;
            case 'Formati':          this.renderFormati(dati); break;
            case 'NamingConvention': this.renderNaming(dati); break;
            case 'TipiDiExport':     this.renderExport(dati, nc); break;
            case 'MappaStili':       this.renderMappaStili(dati); break;
            case 'Allineamenti':     this.renderAllineamenti(dati); break;
            default:                 this.errore('sorgente "' + sorgente + '" non gestita.');
        }
    }

    /* ---------- Aree, canali e combinazioni ---------- */

    renderACPV(d) {
        const E = VisualSource.esc;
        const aree = d.aree || [], canali = d.canali || [];
        const comb = d.combinazioni || [], pv = d.pv || [];

        if (aree.length === 0 && canali.length === 0) {
            this.container.innerHTML = VisualSource.vuoto(
                'sono ancora state definite aree o canali', 'Aree e Canali');
            return;
        }

        const attive = comb.filter(function (c) { return c.enabled; }).length;

        let h = VisualSource.riepilogo([
            [aree.length, 'Aree'],
            [canali.length, 'Canali'],
            [attive + '<span class="text-muted" style="font-size:1rem;">/' + comb.length + '</span>',
             'Combinazioni attive'],
            [pv.length, 'Punti vendita']
        ]);

        h += '<div class="row">'
           + '<div class="col-lg-5 mb-4">' + this.elenco('Aree', aree) + '</div>'
           + '<div class="col-lg-7 mb-4">' + this.elenco('Canali', canali) + '</div>'
           + '</div>';
        h += this.matrice(aree, canali, comb);
        if (pv.length > 0) { h += this.puntiVendita(pv, comb, aree, canali); }
        h += VisualSource.nota();

        this.container.innerHTML = h;
    }

    elenco(titolo, righe) {
        const E = VisualSource.esc;
        let h = '<h5 class="mb-2">' + titolo + ' <span class="text-muted">(' + righe.length + ')</span></h5>';
        if (righe.length === 0) { return h + '<p class="text-muted fst-italic">Nessun elemento.</p>'; }

        h += '<div class="table-responsive"><table class="table table-sm table-striped align-middle mb-0">'
           + '<thead><tr><th style="width:8rem;">Sigla</th><th>Nome</th>'
           + '<th style="width:3rem;" class="text-end"></th></tr></thead><tbody>';

        righe.slice().sort(function (a, b) {
            return String(a.nome || '').localeCompare(String(b.nome || ''));
        }).forEach(function (r) {
            h += '<tr><td><code>' + E(r.sigla) + '</code></td><td>' + E(r.nome) + '</td>'
               + '<td class="text-end">' + VisualSource.idInfo(r.guidID) + '</td></tr>';
        });
        return h + '</tbody></table></div>';
    }

    matrice(aree, canali, comb) {
        const E = VisualSource.esc;
        const stato = {};
        comb.forEach(function (c) { stato[c.guidIDCanale + '|' + c.guidIDArea] = c; });

        let h = '<h5 class="mb-2">Combinazioni canale / area</h5>';
        if (aree.length === 0 || canali.length === 0) {
            return h + '<p class="text-muted fst-italic">Servono almeno un\'area e un canale.</p>';
        }

        h += '<div class="table-responsive"><table class="table table-sm table-bordered align-middle mb-2">'
           + '<thead><tr><th style="min-width:14rem;">Canale</th>';
        aree.forEach(function (a) {
            h += '<th class="text-center" style="min-width:6rem;">' + E(a.sigla)
               + '<div class="text-muted fw-normal" style="font-size:.75rem;">' + E(a.nome) + '</div></th>';
        });
        h += '</tr></thead><tbody>';

        canali.slice().sort(function (a, b) {
            return String(a.nome || '').localeCompare(String(b.nome || ''));
        }).forEach(function (c) {
            h += '<tr><td>' + E(c.nome) + ' <code class="text-muted">' + E(c.sigla) + '</code></td>';
            aree.forEach(function (a) {
                const k = stato[c.guidID + '|' + a.guidID];
                let cella, titolo;
                if (!k) {
                    cella = '<span class="text-muted">·</span>';
                    titolo = 'Combinazione non definita';
                } else if (k.enabled) {
                    cella = '<span style="color:#198754; font-size:1.1rem;">&#10003;</span>';
                    titolo = E(c.sigla) + '_' + E(a.sigla) + ' — attiva';
                } else {
                    cella = '<span style="color:#adb5bd; font-size:1.1rem;">&#9675;</span>';
                    titolo = E(c.sigla) + '_' + E(a.sigla) + ' — disattivata';
                }
                h += '<td class="text-center" title="' + titolo + '">' + cella + '</td>';
            });
            h += '</tr>';
        });

        return h + '</tbody></table></div>'
             + '<p class="text-muted" style="font-size:.85rem;">'
             + '<span style="color:#198754;">&#10003;</span> attiva &nbsp;&nbsp;'
             + '<span style="color:#adb5bd;">&#9675;</span> definita ma disattivata &nbsp;&nbsp;'
             + '<span class="text-muted">·</span> non definita</p>';
    }

    puntiVendita(pv, comb, aree, canali) {
        const E = VisualSource.esc;
        const sigArea = {}, sigCanale = {}, perComb = {};
        aree.forEach(function (a) { sigArea[a.guidID] = a.sigla; });
        canali.forEach(function (c) { sigCanale[c.guidID] = c.sigla; });
        comb.forEach(function (c) {
            perComb[c.guidID] = (sigCanale[c.guidIDCanale] || '?') + '_' + (sigArea[c.guidIDArea] || '?');
        });

        let h = '<h5 class="mt-4 mb-2">Punti vendita <span class="text-muted">(' + pv.length + ')</span></h5>'
              + '<div class="table-responsive"><table class="table table-sm table-striped align-middle mb-0">'
              + '<thead><tr><th>Nome</th><th>Indirizzo</th><th>Città</th>'
              + '<th style="width:5rem;">CAP</th><th style="width:9rem;">Combinazione</th></tr></thead><tbody>';

        pv.forEach(function (p) {
            h += '<tr><td>' + E(p.nome) + '</td><td>' + E(p.indirizzo) + '</td>'
               + '<td>' + E(p.citta) + '</td><td>' + E(p.cap) + '</td>'
               + '<td><code>' + E(perComb[p.guidIDCombinazione] || '—') + '</code></td></tr>';
        });
        return h + '</tbody></table></div>';
    }

    /* ---------- Formati ---------- */

    renderFormati(d) {
        const E = VisualSource.esc;
        const righe = d.source || [];

        if (righe.length === 0) {
            this.container.innerHTML = VisualSource.vuoto(
                'è ancora stato definito nessun formato', 'Impostazioni di produzione → Formati');
            return;
        }

        const tipoNome = { 1: 'Volantino', 2: 'POP' };
        const tipoColore = { 1: 'primary', 2: 'info' };
        const conGriglie = righe.filter(function (f) {
            return (f.dettagliGriglie || []).length > 0;
        }).length;

        let h = VisualSource.riepilogo([
            [righe.length, 'Formati'],
            [righe.filter(function (f) { return f.tipo === 1; }).length, 'Volantino'],
            [righe.filter(function (f) { return f.tipo === 2; }).length, 'POP'],
            [conGriglie, 'Con griglie']
        ]);

        righe.forEach(function (f) {
            const dett = f.dettagliGriglie || [];
            h += '<div class="card mb-3"><div class="card-body">';
            h += '<div class="d-flex justify-content-between align-items-start mb-1">'
               + '<h5 class="card-title mb-0">' + E(f.titolo)
               + ' <code class="text-muted">' + E(f.codice) + '</code></h5>'
               + '<div>' + VisualSource.badge(tipoNome[f.tipo] || ('tipo ' + f.tipo),
                                              tipoColore[f.tipo] || 'secondary')
               + ' ' + VisualSource.idInfo(f.guidID) + '</div></div>';

            if (f.descrizione) {
                h += '<p class="text-muted mb-2">' + E(f.descrizione) + '</p>';
            }

            if (dett.length === 0) {
                h += '<p class="text-muted fst-italic mb-0" style="font-size:.9rem;">'
                   + 'Nessuna griglia definita per le pagine.</p>';
            } else {
                h += '<div class="table-responsive"><table class="table table-sm mb-0" style="font-size:.9rem;">'
                   + '<thead><tr><th style="width:6rem;">Pagina</th><th>Griglie ammesse</th></tr></thead><tbody>';
                dett.slice().sort(function (a, b) { return (a.pag || 0) - (b.pag || 0); })
                    .forEach(function (p) {
                        const g = (p.griglie || []).map(function (x) {
                            return '<code class="me-1">' + E(x) + '</code>';
                        }).join('');
                        h += '<tr><td>' + E(p.pag) + '</td><td>'
                           + (g || '<span class="text-muted fst-italic">nessuna</span>') + '</td></tr>';
                    });
                h += '</tbody></table></div>';
            }

            const regole = f.regoleGriglie || [];
            if (regole.length > 0) {
                h += '<p class="text-muted mb-0 mt-2" style="font-size:.85rem;">'
                   + regole.length + ' regola/e sulle griglie definite (visibili nel Source).</p>';
            }
            h += '</div></div>';
        });

        this.container.innerHTML = h + VisualSource.nota();
    }

    /* ---------- Naming Convention ---------- */

    renderNaming(d) {
        const E = VisualSource.esc;
        const componenti = d.components || [];
        const combinazioni = d.combinazioni || [];

        if (componenti.length === 0 && combinazioni.length === 0) {
            this.container.innerHTML = VisualSource.vuoto(
                'è ancora stata definita nessuna naming convention',
                'Impostazioni di produzione → Naming Convention');
            return;
        }

        const perId = {};
        componenti.forEach(function (c) { perId[c.Id] = c; });

        let h = VisualSource.riepilogo([
            [combinazioni.length, 'Convenzioni'],
            [componenti.length, 'Componenti disponibili']
        ]);

        h += '<h5 class="mb-2">Convenzioni</h5>';
        if (combinazioni.length === 0) {
            h += '<p class="text-muted fst-italic">Nessuna convenzione composta.</p>';
        } else {
            combinazioni.forEach(function (cb, i) {
                const pezzi = (cb.combinazione || []).map(function (t) {
                    const c = perId[t];
                    if (c) {
                        return '<span class="badge bg-primary me-1" title="' + E(c.Nome) + '">'
                             + E(c.NomeVisual || c.Nome) + '</span>';
                    }
                    return '<span class="badge bg-light text-dark border me-1" title="Testo fisso">'
                         + E(t) + '</span>';
                }).join('<span class="text-muted me-1">_</span>');

                h += '<div class="card mb-2"><div class="card-body py-2">'
                   + '<div class="d-flex justify-content-between align-items-center">'
                   + '<div>' + (pezzi || '<span class="text-muted fst-italic">vuota</span>') + '</div>'
                   + '<div>' + VisualSource.idInfo(cb.guidId) + '</div></div></div></div>';
            });
            h += '<p class="text-muted" style="font-size:.85rem;">'
               + '<span class="badge bg-primary">azzurro</span> componente dinamico &nbsp;&nbsp;'
               + '<span class="badge bg-light text-dark border">chiaro</span> testo fisso</p>';
        }

        h += '<h5 class="mt-4 mb-2">Componenti disponibili '
           + '<span class="text-muted">(' + componenti.length + ')</span></h5>';
        h += '<div class="table-responsive"><table class="table table-sm table-striped align-middle mb-0">'
           + '<thead><tr><th style="width:14rem;">Nome visuale</th><th style="width:16rem;">Campo</th>'
           + '<th>Descrizione</th></tr></thead><tbody>';
        componenti.forEach(function (c) {
            h += '<tr><td>' + E(c.NomeVisual) + '</td>'
               + '<td><code>' + E(c.Nome) + '</code></td>'
               + '<td class="text-muted">' + E(c.Descrizione) + '</td></tr>';
        });
        h += '</tbody></table></div>';

        this.container.innerHTML = h + VisualSource.nota();
    }

    /* ---------- Tipi di export ---------- */

    renderExport(d, nc) {
        const E = VisualSource.esc;
        const righe = d.source || [];

        if (righe.length === 0) {
            this.container.innerHTML = VisualSource.vuoto(
                'è ancora stato definito nessun tipo di export',
                'Impostazioni di produzione → Tipi di Export');
            return;
        }

        // Risolve la naming convention citata, se il file è disponibile.
        const perId = {}, nomeConv = {};
        if (nc) {
            (nc.components || []).forEach(function (c) { perId[c.Id] = c; });
            (nc.combinazioni || []).forEach(function (cb) {
                nomeConv[cb.guidId] = (cb.combinazione || []).map(function (t) {
                    const c = perId[t];
                    return c ? (c.NomeVisual || c.Nome) : t;
                }).join('_');
            });
        }

        const modalita = { 0: ['Tutto insieme', 'secondary'], 1: ['Per pagina', 'info'] };

        let h = VisualSource.riepilogo([
            [righe.length, 'Tipi di export'],
            [righe.filter(function (r) { return r.modalita === 1; }).length, 'Per pagina'],
            [righe.filter(function (r) { return r.guidIdNamingConvention; }).length, 'Con naming convention'],
            [righe.filter(function (r) { return (r.filtro || []).length > 0; }).length, 'Con filtro']
        ]);

        h += '<div class="table-responsive"><table class="table table-sm table-striped align-middle mb-0">'
           + '<thead><tr><th style="width:8rem;">Codice</th><th style="width:14rem;">Titolo</th>'
           + '<th style="width:9rem;">Modalità</th><th>Naming convention</th>'
           + '<th style="width:6rem;" class="text-center">Filtro</th>'
           + '<th style="width:3rem;" class="text-end"></th></tr></thead><tbody>';

        righe.slice().sort(function (a, b) {
            return String(a.codice || '').localeCompare(String(b.codice || ''));
        }).forEach(function (r) {
            const m = modalita[r.modalita] || ['modalità ' + r.modalita, 'light text-dark border'];
            let conv;
            if (!r.guidIdNamingConvention) {
                conv = '<span class="text-muted fst-italic">nessuna</span>';
            } else if (nomeConv[r.guidIdNamingConvention]) {
                conv = '<code>' + E(nomeConv[r.guidIdNamingConvention]) + '</code>';
            } else {
                conv = '<span class="text-muted" style="font-size:.85rem;">'
                     + E(r.guidIdNamingConvention) + '</span>';
            }
            const nf = (r.filtro || []).length;
            h += '<tr>'
               + '<td><code>' + E(r.codice) + '</code></td>'
               + '<td>' + E(r.titolo) + '</td>'
               + '<td>' + VisualSource.badge(m[0], m[1]) + '</td>'
               + '<td>' + conv + '</td>'
               + '<td class="text-center">'
               + (nf > 0 ? VisualSource.badge(nf, 'warning text-dark')
                         : '<span class="text-muted">·</span>') + '</td>'
               + '<td class="text-end">' + VisualSource.idInfo(r.guidID) + '</td>'
               + '</tr>';
        });

        h += '</tbody></table></div>';

        if (!nc) {
            h += '<p class="text-muted mt-2" style="font-size:.85rem;">'
               + 'Il file delle naming convention non è disponibile: le convenzioni sono mostrate '
               + 'con il loro identificativo.</p>';
        }

        this.container.innerHTML = h + VisualSource.nota();
    }

    /* ---------- Mappa stili ----------
       Può contenere decine di migliaia di righe: raggruppo per meccanica e
       disegno le righe solo quando si apre un gruppo. */

    renderMappaStili(d) {
        const E = VisualSource.esc;
        const righe = d.stileList || [];

        if (righe.length === 0) {
            this.container.innerHTML = VisualSource.vuoto(
                'è ancora stata definita nessuna mappa stili', 'Framework CSS → Mappa stili');
            return;
        }

        // Indicizzo una volta sola.
        const perMeccanica = {};
        const campi = {}, stili = {};
        righe.forEach(function (r) {
            const m = r.meccanica || '(senza meccanica)';
            (perMeccanica[m] = perMeccanica[m] || []).push(r);
            campi[r.nome_campo] = 1;
            stili[r.stile] = 1;
        });
        const meccaniche = Object.keys(perMeccanica).sort();
        this._mappaStili = perMeccanica;

        let h = VisualSource.riepilogo([
            [righe.length.toLocaleString('it-IT'), 'Associazioni'],
            [meccaniche.length, 'Meccaniche'],
            [Object.keys(campi).length, 'Campi distinti'],
            [Object.keys(stili).length, 'Stili distinti']
        ]);

        h += '<div class="row mb-3"><div class="col-md-6">'
           + '<input type="text" class="form-control form-control-sm" id="filtroMeccanica" '
           + 'placeholder="Filtra per meccanica, campo o stile…">'
           + '</div></div>';

        h += '<div class="accordion" id="accMappaStili">';
        meccaniche.forEach(function (m, i) {
            const id = 'ms' + i;
            h += '<div class="accordion-item" data-meccanica="' + E(m.toLowerCase()) + '">'
               + '<h2 class="accordion-header"><button class="accordion-button collapsed" type="button" '
               + 'data-bs-toggle="collapse" data-bs-target="#' + id + '">'
               + '<span class="me-2">' + E(m) + '</span>'
               + '<span class="badge bg-secondary">' + perMeccanica[m].length + '</span>'
               + '</button></h2>'
               + '<div id="' + id + '" class="accordion-collapse collapse" data-bs-parent="#accMappaStili">'
               + '<div class="accordion-body p-0" data-gruppo="' + E(m) + '">'
               + '<div class="text-muted p-3">Apri per caricare…</div>'
               + '</div></div></div>';
        });
        h += '</div>';

        this.container.innerHTML = h + VisualSource.nota();

        const me = this;

        // Disegno le righe di un gruppo solo alla prima apertura.
        $('#accMappaStili').on('show.bs.collapse', function (ev) {
            const corpo = $(ev.target).find('[data-gruppo]');
            if (corpo.data('caricato')) { return; }
            corpo.data('caricato', true);
            const gruppo = me._mappaStili[corpo.attr('data-gruppo')] || [];
            let t = '<div class="table-responsive"><table class="table table-sm table-striped mb-0">'
                  + '<thead><tr><th style="width:50%;">Campo</th><th>Stile</th></tr></thead><tbody>';
            gruppo.slice().sort(function (a, b) {
                return String(a.nome_campo || '').localeCompare(String(b.nome_campo || ''));
            }).forEach(function (r) {
                t += '<tr><td><code>' + E(r.nome_campo) + '</code></td>'
                   + '<td><code>' + E(r.stile) + '</code></td></tr>';
            });
            corpo.html(t + '</tbody></table></div>');
        });

        // Filtro sui gruppi.
        $('#filtroMeccanica').on('input', function () {
            const q = String($(this).val() || '').toLowerCase().trim();
            $('#accMappaStili .accordion-item').each(function () {
                const nome = $(this).attr('data-meccanica') || '';
                let visibile = (q === '' || nome.indexOf(q) >= 0);
                if (!visibile) {
                    // cerco anche dentro il gruppo, senza disegnarlo
                    const g = me._mappaStili[$(this).find('[data-gruppo]').attr('data-gruppo')] || [];
                    visibile = g.some(function (r) {
                        return String(r.nome_campo || '').toLowerCase().indexOf(q) >= 0
                            || String(r.stile || '').toLowerCase().indexOf(q) >= 0;
                    });
                }
                $(this).toggle(visibile);
            });
        });
    }

    /* ---------- Allineamenti dei box ---------- */

    renderAllineamenti(d) {
        const E = VisualSource.esc;
        const blocchi = d.Dballineamenti || [];

        if (blocchi.length === 0) {
            this.container.innerHTML = VisualSource.vuoto(
                'è ancora stato definito nessun allineamento', 'Framework CSS → Allineamenti box');
            return;
        }

        const nRid = blocchi.reduce(function (s, b) { return s + (b.Ridimensionamenti || []).length; }, 0);
        const nAll = blocchi.reduce(function (s, b) { return s + (b.Allineamenti || []).length; }, 0);

        let h = VisualSource.riepilogo([
            [blocchi.length, 'Blocchi'],
            [nRid, 'Regole di ridimensionamento'],
            [nAll, 'Gruppi di allineamento']
        ]);

        const etichette = function (lista) {
            const l = lista || [];
            if (l.length === 0) { return '<span class="text-muted fst-italic">tutte</span>'; }
            return l.map(function (x) {
                return '<code class="me-1">' + E(x === '' ? '(vuoto)' : x) + '</code>';
            }).join('');
        };

        blocchi.forEach(function (b, i) {
            const box = b.nomiBox || [];
            h += '<div class="card mb-3"><div class="card-body">';
            h += '<h5 class="card-title mb-1">Blocco ' + (i + 1) + '</h5>';
            h += '<p class="mb-3"><span class="text-muted me-2">Box:</span>'
               + (box.length ? etichette(box)
                             : '<span class="text-muted fst-italic">tutti i box</span>') + '</p>';

            const rid = b.Ridimensionamenti || [];
            h += '<h6 class="text-muted" style="font-size:.85rem; text-transform:uppercase; letter-spacing:.04em;">'
               + 'Ridimensionamenti (' + rid.length + ')</h6>';
            if (rid.length === 0) {
                h += '<p class="text-muted fst-italic" style="font-size:.9rem;">Nessuno.</p>';
            } else {
                h += '<div class="table-responsive mb-3"><table class="table table-sm mb-0" style="font-size:.9rem;">'
                   + '<thead><tr><th>Gruppo etichette</th><th style="width:12rem;">X</th>'
                   + '<th style="width:12rem;">Y</th><th style="width:7rem;">Fit</th></tr></thead><tbody>';
                rid.forEach(function (r) {
                    const rr = r.Ridimensionamento || {};
                    const v = function (x) {
                        return x ? '<code>' + E(x) + '</code>'
                                 : '<span class="text-muted">—</span>';
                    };
                    h += '<tr><td>' + etichette(r.GruppoEtichette) + '</td>'
                       + '<td>' + v(rr.X) + '</td><td>' + v(rr.Y) + '</td>'
                       + '<td>' + v(r.Fit) + '</td></tr>';
                });
                h += '</tbody></table></div>';
            }

            const all = b.Allineamenti || [];
            h += '<h6 class="text-muted" style="font-size:.85rem; text-transform:uppercase; letter-spacing:.04em;">'
               + 'Gruppi di allineamento (' + all.length + ')</h6>';
            if (all.length === 0) {
                h += '<p class="text-muted fst-italic mb-0" style="font-size:.9rem;">Nessuno.</p>';
            } else {
                all.forEach(function (g) {
                    h += '<div class="border rounded p-2 mb-2" style="font-size:.9rem;">';
                    h += '<div class="mb-1"><strong>' + E(g.NomeGruppo || '(senza nome)') + '</strong>';
                    if (g.LetturaLivelli) {
                        h += ' ' + VisualSource.badge(g.LetturaLivelli, 'light text-dark border');
                    }
                    if (g.SpacingLivelli !== undefined && g.SpacingLivelli !== null) {
                        h += ' <span class="text-muted">spacing ' + E(g.SpacingLivelli) + '</span>';
                    }
                    h += '</div>';
                    h += '<div class="mb-1">' + etichette(g.GruppoEtichette) + '</div>';

                    const ord = g.OrdinamentoLivelli || [];
                    if (ord.length > 0) {
                        h += '<table class="table table-sm mb-1" style="font-size:.85rem;">'
                           + '<thead><tr><th style="width:5rem;">Livello</th><th>Elementi</th>'
                           + '<th style="width:9rem;">Ancora interna</th>'
                           + '<th style="width:6rem;">Spacing</th></tr></thead><tbody>';
                        ord.slice().sort(function (a, b2) { return (a.Livello || 0) - (b2.Livello || 0); })
                           .forEach(function (o) {
                            h += '<tr><td>' + E(o.Livello) + '</td>'
                               + '<td>' + etichette(o.Elementi) + '</td>'
                               + '<td>' + (o.InternalAnchor ? '<code>' + E(o.InternalAnchor) + '</code>'
                                                            : '<span class="text-muted">—</span>') + '</td>'
                               + '<td>' + (o.Spacing !== undefined && o.Spacing !== null
                                           ? E(o.Spacing) : '<span class="text-muted">—</span>') + '</td></tr>';
                        });
                        h += '</tbody></table>';
                    }

                    const sa = g.StaticAnchor;
                    if (sa) {
                        const asse = function (nome, a, chiave) {
                            if (!a) { return ''; }
                            return '<span class="me-3"><span class="text-muted">' + nome + ':</span> '
                                 + '<code>' + E(a[chiave]) + '</code>'
                                 + (a.ReferenceLine ? ' <span class="text-muted">rispetto a</span> <code>'
                                                      + E(a.ReferenceLine) + '</code>' : '')
                                 + (a.AngoloAncorato ? ' <span class="text-muted">angolo</span> <code>'
                                                      + E(a.AngoloAncorato) + '</code>' : '')
                                 + '</span>';
                        };
                        const testo = asse('X', sa.XAnchor, 'X') + asse('Y', sa.YAnchor, 'Y');
                        if (testo) { h += '<div class="text-muted" style="font-size:.85rem;">' + testo + '</div>'; }
                    }
                    h += '</div>';
                });
            }
            h += '</div></div>';
        });

        this.container.innerHTML = h + VisualSource.nota();
    }
}

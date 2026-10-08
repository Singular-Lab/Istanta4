/// I20-1015: la parte foto della scheda della referenza - quale foto va su questa referenza,
/// proporla dalla cartella, mostrarne l'anteprima, sostituirla, gestire primarie, secondarie,
/// extra ed extra auto.
///
/// Non e' un modulo a se': schedaRef.js lo mescola nel proprio oggetto con Object.assign, e ogni
/// this qui dentro e' schedaRef. Per questo questi membri leggono la referenza aperta e i dati
/// della scheda (this.refSelected, this.schedeRefDati...) e la scheda chiama loro, come quando
/// stavano insieme in schedaRef.js. Da fuori si chiamano ancora schedaRef.X.
///
/// Fa parte del concetto reperimentoFoto: procurarsi la foto giusta. Le operazioni su disco e
/// server stanno in reperimentoFoto.js (ReperimentoFoto, globale dichiarata da indexNew), lo
/// scaricamento in scaricamento.js (la globale scaricamentoFoto). Da non confondere con
/// sistemazioneFoto, che decide DOVE la foto sta dentro il box.
///
/// Si carica sotto Node come schedaRef: i test schedaRef-* lo provano attraverso la scheda.

const XMLHttpRequestClient = require('../XMLHttpRequestClient');
const DataCaricamentoFoto = require('./dataCaricamento');
const NoRenderElementi = require('../noRenderElementi');

const schedaFoto = {
    /// Il cambio foto: l'elenco delle foto disponibili, l'anteprima, la
    /// scelta, lo scaricamento. 1.066 righe, ed e' il capofila delle 28 che vanno nel js nuovo.
    async openModalCambiaFoto(codice) {
        let me = this;
        var box = this.refSelected.item;

        if (box == null || box.isValid == null || !box.isValid) {
            await Modali.popup(
                "Nessun elemento selezionato",
                "Per cambiare foto è necessario selezionare un elemento in pagina."
            );
            return;
        }

        showLoading("Scaricamento dati...");
        await Utility.sleep(10);

        try {
            ReperimentoFoto.getFotoData(codice, async (objResult) => {
                try {
                    objResult.result = JSON.parse(objResult.result);
                }
                catch (e) {
                    messaggioUtente("Code SRF-48 Errore durante il parsing del risultato: " + e, "error");
                    hideLoading();
                    return;
                }

                console.log(objResult);

                var areaObj = ficoProcess.getAreaLavorazioneCorrente();
                if (areaObj == null) {
                    messaggioUtente("Code SRF-49 Area di lavorazione non trovata", "error");
                    hideLoading();
                    return;
                }
                var area = areaObj.sigla;

                var canaleObj = ficoProcess.getCanaleLavorazioneCorrente();
                if (canaleObj == null) {
                    messaggioUtente("Code SRF-50 Canale di lavorazione non trovato", "error");
                    hideLoading();
                    return;
                }
                var canale = canaleObj.sigla;

                await Modali.apriModal('dialogCambiaFoto', 'Cambia foto', true, [], true);

                const $footer = $('#footerCambiaFoto');
                $footer.empty();
                $footer.html(`
    <div style="
        display:flex;
        justify-content:flex-end;
        align-items:center;
        height:100%;
        width:100%;
        padding:10px;
        box-sizing:border-box;
    ">
        <button type="button" id="btnConfermaCambiaFoto" disabled>Conferma</button>
    </div>
`);

                const $body = $('#bodyCambiaFoto');
                $body.empty();

                const fotoList = Array.isArray(objResult.result) ? objResult.result : [];

                var schedaRef = me.schedeRefDati;
                var elementoCercato = schedaRef.find(f => f.recordInTracciato["Referenza.Codice"] == codice);
                var fotoAttuale = null;

                if (elementoCercato != null && elementoCercato.recordInTracciato != null) {
                    fotoAttuale = elementoCercato.recordInTracciato["Foto.Id"] || null;
                }

                //I20-980: il nome del file impaginato, per aprire il dialogo di scelta gia'
                //sulla foto che si sta sostituendo.
                var nomeFotoImpaginata = elementoCercato != null && elementoCercato.recordInTracciato != null
                    ? elementoCercato.recordInTracciato["Foto.Nome"]
                    : null;
                var hashFotoImpaginata = elementoCercato != null && elementoCercato.recordInTracciato != null
                    ? elementoCercato.recordInTracciato["Foto.Hash"]
                    : null;

                const state = {
                    selectedUploadFile: null,
                    selectedUploadPreviewUrl: null,
                    selectedRemotePhoto: null,
                    currentActivePhoto: null
                };

                if (fotoAttuale != null) {
                    state.currentActivePhoto = fotoList.find(x =>
                        x.Attiva !== false && x.Id === fotoAttuale
                    ) || null;
                }

                function getScopeLabel(value) {
                    switch (value) {
                        case 'globale':
                            return 'Globale';
                        case 'canale_area':
                            return canale + ' ' + area;
                        case 'canale':
                            return canale;
                        case 'area':
                            return area;
                        case 'solo_lavorazione':
                            return 'Solo lavorazione';
                        default:
                            return 'Globale';
                    }
                }

                function getScopeOptionsHtml() {
                    return `
                    <option value="globale">Globale</option>
                    <option value="canale_area">${canale} ${area}</option>
                    <option value="canale">${canale}</option>
                    <option value="area">${area}</option>
                    <option value="solo_lavorazione">Solo lavorazione</option>
                `;
                }

                function getPhotoScopeValue(item) {
                    const hasArea = item.Area != null && item.Area !== '';
                    const hasCanale = item.Canale != null && item.Canale !== '';

                    if (!hasArea && !hasCanale) {
                        return 'globale';
                    }
                    if (hasArea && hasCanale) {
                        return 'canale_area';
                    }
                    if (hasCanale) {
                        return 'canale';
                    }
                    if (hasArea) {
                        return 'area';
                    }
                    return 'globale';
                }

                function getPhotoScopeText(item) {
                    const hasArea = item.Area != null && item.Area !== '';
                    const hasCanale = item.Canale != null && item.Canale !== '';

                    if (!hasArea && !hasCanale) {
                        return 'Globale';
                    }
                    if (hasArea && hasCanale) {
                        return item.Canale + ' ' + item.Area;
                    }
                    if (hasCanale) {
                        return item.Canale;
                    }
                    if (hasArea) {
                        return item.Area;
                    }
                    return '';
                }

                function isSelectableForCurrentContext(item) {
                    const areaOk = (item.Area == null || item.Area === '' || item.Area === area);
                    const canaleOk = (item.Canale == null || item.Canale === '' || item.Canale === canale);
                    return areaOk && canaleOk;
                }

                function getFotoHash(item) {
                    if (item == null) {
                        return '';
                    }

                    return item.Hash || item.hash || item.FileHash || item.fileHash || '';
                }

                function samePhotoName(itemA, itemB) {
                    if (itemA == null || itemB == null) {
                        return false;
                    }

                    const nomeA = itemA.Nome != null ? String(itemA.Nome) : '';
                    const nomeB = itemB.Nome != null ? String(itemB.Nome) : '';

                    return nomeA !== '' &&
                        nomeA === nomeB;
                }

                function hasSamePhotoInCurrentContext(item) {
                    return fotoList.some(x =>
                        x != null &&
                        isSelectableForCurrentContext(x) &&
                        samePhotoName(x, item)
                    );
                }

                function createObjectUrlFromFd(fd) {
                    const fileName = fd.nomeFile || '';
                    const lowerName = fileName.toLowerCase();

                    let mimeType = 'application/octet-stream';
                    if (lowerName.endsWith('.png')) mimeType = 'image/png';
                    else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) mimeType = 'image/jpeg';
                    else if (lowerName.endsWith('.webp')) mimeType = 'image/webp';
                    else if (lowerName.endsWith('.gif')) mimeType = 'image/gif';
                    else if (lowerName.endsWith('.psd')) mimeType = 'image/vnd.adobe.photoshop';

                    const blob = new Blob([fd.file], { type: mimeType });
                    return URL.createObjectURL(blob);
                }

                function resetState() {
                    if (state.selectedUploadPreviewUrl) {
                        try {
                            URL.revokeObjectURL(state.selectedUploadPreviewUrl);
                        }
                        catch (e) {
                            console.log(e);
                        }
                    }

                    state.selectedUploadFile = null;
                    state.selectedUploadPreviewUrl = null;
                    state.selectedRemotePhoto = null;
                }

                function getScopeSelection() {
                    const selectEl = $('#selectScopeCambiaFoto')[0];
                    let value = 'globale';

                    if (selectEl != null && selectEl.selectedIndex != null && selectEl.selectedIndex >= 0) {
                        value = selectEl.options[selectEl.selectedIndex].value;
                    }

                    return {
                        value: value,
                        area: (value === 'area' || value === 'canale_area') ? area : null,
                        canale: (value === 'canale' || value === 'canale_area') ? canale : null,
                        validaSoloPerLavorazione: value === 'solo_lavorazione'
                    };
                }

                function updateConfirmButtonState() {
                    const enabled = state.selectedUploadFile != null || state.selectedRemotePhoto != null;
                    $('#btnConfermaCambiaFoto').prop('disabled', !enabled);
                }

                function renderBaseLayout() {
                    $body.html(`
        <div id="cambiaFotoWrapper" style="
            display:flex;
            flex-direction:column;
            height:100%;
            max-height:100%;
        ">
            <div id="cambiaFotoTopBar" style="
                flex:0 0 auto;
                padding:0 0 10px 0;
                background:#fff;
                border-bottom:1px solid #ccc;
                margin-bottom:10px;
            ">
                <select id="selectScopeCambiaFoto" style="width:100%; box-sizing:border-box;">
                    ${getScopeOptionsHtml()}
                </select>
            </div>

            <div id="cambiaFotoScrollArea" style="
                flex:1 1 auto;
                overflow-y:auto;
                overflow-x:hidden;
                padding-right:4px;
            ">
                <div id="sectionUploadFoto" style="
                    border:1px solid #ccc;
                    padding:10px;
                    margin-bottom:12px;
                ">
                    <div style="
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        gap:8px;
                        margin-bottom:10px;
                    ">
                        <button type="button" id="btnCaricaFoto">Carica foto</button>
                        <button type="button" id="btnResetFotoScelta" style="display:none;">X</button>
                    </div>

                    <div id="previewUploadFoto" style="
                        display:none;
                        text-align:center;
                    ">
                        <div style="
                            display:inline-flex;
                            align-items:center;
                            justify-content:center;
                            min-width:90px;
                            min-height:90px;
                            padding:8px;
                            border:1px solid #ddd;
                            background:#f8f8f8;
                        ">
                            <img id="imgPreviewUploadFoto" src="" style="max-width:120px; max-height:120px;">
                            <div id="txtAnteprimaNonDisponibile" style="display:none; color:#777; font-size:11px; text-align:center;"></div>
                        </div>
                        <div id="txtNomeUploadFoto" style="margin-top:6px; font-size:11px; word-break:break-word;"></div>
                    </div>
                </div>

                <div id="separatorOppure" style="
                    text-align:center;
                    margin:10px 0 14px 0;
                    font-weight:bold;
                ">Oppure</div>

                <div id="sectionFotoAttualeWrapper" style="
                    margin-bottom:12px;
                    display:none;
                ">
                    <div style="
                        margin-bottom:8px;
                        font-weight:bold;
                    ">Foto attuale</div>
                    <div id="sectionFotoAttuale"></div>
                </div>

                <div id="sectionFotoEsistenti"></div>

                <div id="sectionFotoDisattivateWrapper" style="
                    margin-top:12px;
                    display:none;
                ">
                    <div style="
                        margin-bottom:8px;
                        font-weight:bold;
                    ">Elementi disattivati</div>
                    <div id="sectionFotoDisattivate"></div>
                </div>

                <div id="sectionAltreFotoWrapper" style="
                    margin-top:12px;
                    display:none;
                ">
                    <button type="button" id="btnToggleAltreFoto">Altre foto</button>
                    <div id="sectionAltreFoto" style="
                        display:none;
                        margin-top:10px;
                    "></div>
                </div>
            </div>
        </div>
    `);

                    setScopeSelection('globale');
                }

                function setScopeSelection(value) {
                    const selectEl = $('#selectScopeCambiaFoto')[0];
                    if (selectEl == null) {
                        return;
                    }

                    for (let i = 0; i < selectEl.options.length; i++) {
                        selectEl.options[i].selected = (selectEl.options[i].value === value);
                    }
                }
                
                function buildPhotoGrid($container, list, options) {
                    $container.empty();

                    options = options || {};

                    const isOtherSection = options.isOtherSection === true;
                    const isDisabledSection = options.isDisabledSection === true;

                    if (!Array.isArray(list) || list.length === 0) {
                        if (isOtherSection || isDisabledSection) {
                            return;
                        }
                        $container.html('<div>Nessuna foto disponibile</div>');
                        return;
                    }

                    for (let i = 0; i < list.length; i += 2) {
                        const $row = $(`
            <div style="
                display:flex;
                width:100%;
                margin-bottom:10px;
            "></div>
        `);

                        var isFromMeta = elementoCercato != null && elementoCercato.recordInTracciato != null
                            ? Boolean(elementoCercato.recordInTracciato["Foto.IsMeta"])
                            : false;
                        for (let j = i; j < i + 2 && j < list.length; j++) {
                            const item = list[j];
                            const selectable = isDisabledSection
                                ? true
                                : (isOtherSection ? !hasSamePhotoInCurrentContext(item) : isSelectableForCurrentContext(item));
                            const thumbUrl = olimpoIp + 'getThumbNailOnDemand?width=80&guidId=' + encodeURIComponent(item.GuidId);
                            const scopeText = getPhotoScopeText(item);
                            const contextText = getPhotoContextText(item);
                            //I20-971: data di caricamento della foto. Quando manca o non e'
                            //plausibile il badge non viene disegnato affatto.
                            const dataCaricamento = DataCaricamentoFoto.dataDaMostrare(item);
                            const dataBadgeHtml = dataCaricamento === '' ? '' : `
                                <div style="
                                    margin-top:4px;
                                    font-size:10px;
                                    color:#333;
                                    background:#e8e8e8;
                                    border:1px solid #ccc;
                                    border-radius:10px;
                                    padding:1px 8px;
                                " title="Data di caricamento della foto">${dataCaricamento}</div>
                            `;
                            const isActive = item.Attiva !== false;
                            const isDisabledItem = item.Attiva === false;


                            const isCurrentActivePhoto =
                                state.currentActivePhoto != null &&
                                state.currentActivePhoto.Id === item.Id;

                            let backgroundStyle = '#f8f8f8';
                            let opacityStyle = '1';
                            let cursorStyle = 'pointer';
                            let borderStyle = '1px solid #ccc';
                            let currentBadgeHtml = '';
                            let boxShadowStyle = 'none';

                            if (isCurrentActivePhoto && !isFromMeta) {
                                boxShadowStyle = 'inset 0 0 0 2px #f0a500';
                                currentBadgeHtml = `
                                <div style="
                                    position:absolute;
                                    top:6px;
                                    left:6px;
                                    font-size:10px;
                                    background:#f0a500;
                                    color:#000;
                                    padding:2px 6px;
                                    border-radius:10px;
                                    z-index:2;
                                ">Attuale</div>
                            `;
                            }

                            if (isOtherSection && !selectable) {
                                backgroundStyle = '#ebebeb';
                                opacityStyle = '0.65';
                                cursorStyle = 'default';
                            }

                            if (isDisabledSection || isDisabledItem) {
                                backgroundStyle = '#f3f0e8';
                                opacityStyle = selectable ? '1' : '0.65';
                                cursorStyle = selectable ? 'pointer' : 'default';
                            }

                            const clickClass = selectable ? 'foto-cambiabile' : 'foto-non-selezionabile';
                            const actionSymbol = isActive ? '⊘' : '✕';

                            const $cell = $(`
                <div style="
                    width:50%;
                    box-sizing:border-box;
                    padding:6px;
                ">
                    <div class="foto-item ${clickClass}" style="
                        position:relative;
                        display:flex;
                        flex-direction:column;
                        align-items:center;
                        justify-content:center;
                        padding:8px;
                        min-height:150px;
                        border:${borderStyle};
                        box-shadow:${boxShadowStyle};
                        background:${backgroundStyle};
                        opacity:${opacityStyle};
                        cursor:${cursorStyle};
                    ">
                    ${currentBadgeHtml}
                        <div class="foto-item-action" style="  
                            position:absolute;
                            top:6px;
                            right:6px;
                            width:18px;
                            height:18px;
                            border-radius:50%;
                            border:1px solid #999;
                            display:none;
                            align-items:center;
                            justify-content:center;
                            font-size:10px;
                            line-height:10px;
                            background:#fff;
                            z-index:2;
                        ">${actionSymbol}</div>

                        <div class="foto-item-bg" style="
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            width:100%;
                            min-height:90px;
                            padding:6px;
                            box-sizing:border-box;
                            border-radius:4px;
                        ">
                            <img src="${thumbUrl}" style="
                                max-width:80px;
                                max-height:80px;
                                margin-bottom:0;
                            ">
                        </div>

                        <div style="
                            margin-top:6px;
                            font-size:11px;
                            text-align:center;
                            word-break:break-word;
                            width:100%;
                        ">${item.Nome}</div>

                        ${dataBadgeHtml}

                        <div style="
                            margin-top:4px;
                            font-size:10px;
                            text-align:center;
                            width:100%;
                        ">${contextText}</div>


                    </div>
                </div>
            `);

                            $cell.find('.foto-item').data('fotoData', {
                                Id: item.Id,
                                GuidId: item.GuidId,
                                Nome: item.Nome,
                                Area: item.Area,
                                Canale: item.Canale,
                                Attiva: item.Attiva,
                                scopeValue: getPhotoScopeValue(item),
                                thumbUrl: thumbUrl
                            });

                            $row.append($cell);
                        }

                        if (i + 1 >= list.length) {
                            $row.append(`
                <div style="
                    width:50%;
                    box-sizing:border-box;
                    padding:6px;
                "></div>
            `);
                        }

                        $container.append($row);
                    }
                }

                function renderPhotoSections() {
                    //I20-971: dentro ogni gruppo le foto vanno dalla piu' nuova alla piu' vecchia.
                    let fotoAttiveCompatibili = DataCaricamentoFoto.ordinaDallaPiuNuova(fotoList.filter(x =>
                        x.Attiva !== false && isSelectableForCurrentContext(x)
                    ));

                    let fotoDisattivateCompatibili = DataCaricamentoFoto.ordinaDallaPiuNuova(fotoList.filter(x =>
                        x.Attiva === false && isSelectableForCurrentContext(x)
                    ));

                    let fotoAltre = DataCaricamentoFoto.ordinaDallaPiuNuova(fotoList.filter(x =>
                        !isSelectableForCurrentContext(x)
                    ));

                    //La foto in uso si mostra per prima, sopra a tutte le sezioni. Esce dal suo
                    //gruppo per non comparire due volte, ma conserva le opzioni di quel gruppo,
                    //cosi' selezionabilita' e resa restano quelle di prima.
                    const idAttuale = state.currentActivePhoto != null ? state.currentActivePhoto.Id : null;
                    let fotoAttuale = null;
                    let opzioniAttuale = { isOtherSection: false, isDisabledSection: false };

                    const daAttive = DataCaricamentoFoto.estraiAttuale(fotoAttiveCompatibili, idAttuale);
                    if (daAttive.attuale != null) {
                        fotoAttuale = daAttive.attuale;
                        fotoAttiveCompatibili = daAttive.resto;
                    }
                    else {
                        const daDisattivate = DataCaricamentoFoto.estraiAttuale(fotoDisattivateCompatibili, idAttuale);
                        if (daDisattivate.attuale != null) {
                            fotoAttuale = daDisattivate.attuale;
                            fotoDisattivateCompatibili = daDisattivate.resto;
                            opzioniAttuale = { isOtherSection: false, isDisabledSection: true };
                        }
                        else {
                            const daAltre = DataCaricamentoFoto.estraiAttuale(fotoAltre, idAttuale);
                            if (daAltre.attuale != null) {
                                fotoAttuale = daAltre.attuale;
                                fotoAltre = daAltre.resto;
                                opzioniAttuale = { isOtherSection: true, isDisabledSection: false };
                            }
                        }
                    }

                    if (fotoAttuale != null) {
                        $('#sectionFotoAttualeWrapper').show();
                        buildPhotoGrid($('#sectionFotoAttuale'), [fotoAttuale], opzioniAttuale);
                    }
                    else {
                        $('#sectionFotoAttualeWrapper').hide();
                        $('#sectionFotoAttuale').empty();
                    }

                    buildPhotoGrid($('#sectionFotoEsistenti'), fotoAttiveCompatibili, {
                        isOtherSection: false,
                        isDisabledSection: false
                    });

                    buildPhotoGrid($('#sectionFotoDisattivate'), fotoDisattivateCompatibili, {
                        isOtherSection: false,
                        isDisabledSection: true
                    });

                    if (fotoDisattivateCompatibili.length > 0) {
                        $('#sectionFotoDisattivateWrapper').show();
                    } else {
                        $('#sectionFotoDisattivateWrapper').hide();
                        $('#sectionFotoDisattivate').empty();
                    }

                    if (fotoAltre.length > 0) {
                        $('#sectionAltreFotoWrapper').show();
                        buildPhotoGrid($('#sectionAltreFoto'), fotoAltre, {
                            isOtherSection: true,
                            isDisabledSection: false
                        });
                    } else {
                        $('#sectionAltreFotoWrapper').hide();
                        $('#sectionAltreFoto').empty();
                    }
                }

                function getPhotoContextText(item) {
                    const hasArea = item.Area != null && item.Area !== '';
                    const hasCanale = item.Canale != null && item.Canale !== '';

                    if (!hasArea && !hasCanale) {
                        return 'Globale';
                    }
                    if (hasArea && hasCanale) {
                        return item.Canale + ' ' + item.Area;
                    }
                    if (hasCanale) {
                        return item.Canale;
                    }
                    if (hasArea) {
                        return item.Area;
                    }
                    return 'Globale';
                }

                function buildScopeFromSelection() {
                    const value = $('#selectScopeCambiaFoto').val();

                    return {
                        value: value,
                        area: (value === 'area' || value === 'canale_area') ? area : null,
                        canale: (value === 'canale' || value === 'canale_area') ? canale : null,
                        validaSoloPerLavorazione: value === 'solo_lavorazione'
                    };
                }

                function getPhotoSpecificityRank(areaValue, canaleValue) {
                    const hasArea = areaValue != null && areaValue !== '';
                    const hasCanale = canaleValue != null && canaleValue !== '';

                    if (hasArea && hasCanale) return 3;
                    if (hasArea) return 2;
                    if (hasCanale) return 1;
                    return 0;
                }

                function getPhotoSpecificityText(areaValue, canaleValue) {
                    const hasArea = areaValue != null && areaValue !== '';
                    const hasCanale = canaleValue != null && canaleValue !== '';

                    if (hasArea && hasCanale) return (canaleValue + ' ' + areaValue);
                    if (hasArea) return areaValue;
                    if (hasCanale) return canaleValue;
                    return 'Globale';
                }

                function getPhotosThatWillBeDisabled(targetScope) {
                    const targetRank = getPhotoSpecificityRank(targetScope.area, targetScope.canale);
                    const currentRank = state.currentActivePhoto != null
                        ? getPhotoSpecificityRank(state.currentActivePhoto.Area, state.currentActivePhoto.Canale)
                        : null;

                    if (currentRank == null || targetRank >= currentRank) {
                        return [];
                    }

                    return fotoList.filter(item => {
                        if (item.Attiva === false) {
                            return false;
                        }

                        // Escludiamo tutto ciò che appartiene ad altri contesti
                        if (!isSelectableForCurrentContext(item)) {
                            return false;
                        }

                        const itemRank = getPhotoSpecificityRank(item.Area, item.Canale);
                        if (itemRank <= targetRank) {
                            return false;
                        }

                        // Se stiamo scegliendo una foto esistente, quella scelta non va inclusa
                        if (state.selectedRemotePhoto != null && item.Id === state.selectedRemotePhoto.Id) {
                            return false;
                        }

                        return true;
                    });
                }

                function buildDisableWarningConfirmContent(list) {
                    const $root = $(`
        <div style="
            display:flex;
            flex-direction:column;
            width:100%;
            height:100%;
            overflow:hidden;
        "></div>
    `);

                    const $text = $(`
        <div style="margin-bottom:10px;">
            <div style="font-weight:bold; margin-bottom:8px;">
                La foto che verrà impostata è di un grado più basso rispetto a quella attualmente attiva, se procedete le seguenti foto saranno disattivate:
            </div>
        </div>
    `);

                    const $list = $(`
        <div style="
            display:flex;
            flex-direction:column;
            gap:8px;
            max-height:240px;
            overflow:auto;
            border:1px solid #ccc;
            padding:8px;
            box-sizing:border-box;
            width:100%;
        "></div>
    `);

                    const $preview = $(`
        <div id="confirmFotoPreviewLarge" style="
            display:none;
            position:fixed;
            top:50%;
            left:50%;
            transform:translate(-50%, -50%);
            background:#fff;
            border:1px solid #999;
            padding:10px;
            z-index:99999;
            box-shadow:0 2px 10px rgba(0,0,0,0.35);
            pointer-events:none;
        ">
            <img src="" style="max-width:300px; max-height:300px; display:block;">
        </div>
    `);

                    for (let i = 0; i < list.length; i++) {
                        const item = list[i];
                        const thumbUrl = olimpoIp + 'getThumbNailOnDemand?width=60&guidId=' + encodeURIComponent(item.GuidId);
                        const bigUrl = olimpoIp + 'getThumbNailOnDemand?width=300&guidId=' + encodeURIComponent(item.GuidId);
                        const contextText = getPhotoSpecificityText(item.Area, item.Canale);

                        const $row = $(`
                            <div style="
                                display:flex;
                                align-items:center;
                                gap:10px;
                                width:100%;
                            ">
                                <img src="${thumbUrl}" style="
                                    width:40px;
                                    height:auto;
                                    border:1px solid #ccc;
                                    background:#f8f8f8;
                                    padding:2px;
                                    box-sizing:border-box;
                                    cursor:pointer;
                                ">
                                <div style="display:flex; flex-direction:column; min-width:0;">
                                    <div style="font-size:12px; word-break:break-word;">${item.Nome}</div>
                                    <div style="font-size:10px; opacity:0.8;">${contextText}</div>
                                </div>
                            </div>
                        `);

                        $row.find('img').on('mouseenter', function () {
                            $preview.find('img').attr('src', bigUrl);
                            $preview.css('display', 'block');
                        });

                        $row.find('img').on('mouseleave', function () {
                            $preview.css('display', 'none');
                            $preview.find('img').attr('src', '');
                        });

                        $list.append($row);
                    }

                    $root.append($text);
                    $root.append($list);
                    $root.append($preview);

                    return $root;
                }

                function resetInterface() {
                    resetState();
                    renderBaseLayout();
                    renderPhotoSections();
                    bindUiEvents();
                    updateConfirmButtonState();
                }

                function bindUiEvents() {
                    $('#btnConfermaCambiaFoto').off('click').on('click', async function () {
                        if (state.selectedUploadFile == null && state.selectedRemotePhoto == null) {
                            return;
                        }

                        const scope = getScopeSelection();

                        const fotosToDisable = getPhotosThatWillBeDisabled(scope);
                        if (fotosToDisable.length > 0) {
                            const confirmContent = buildDisableWarningConfirmContent(fotosToDisable);
                            const res = await Modali.confirm(confirmContent);

                            if (!res) {
                                return;
                            }
                        }


                        try {
                            showLoading("Aggiornamento foto...");
                            await Utility.sleep(10);

                            if (state.selectedRemotePhoto != null) {
                                const esito = await me.updateImmagineEsistente(
                                    codice,
                                    scope.area,
                                    scope.canale,
                                    scope.validaSoloPerLavorazione,
                                    state.selectedRemotePhoto.Id,
                                    fotoList
                                );

                                hideLoading();

                                if (esito) {
                                    Modali.closeAllModal();
                                }

                                return;
                            }

                            if (state.selectedUploadFile != null) {
                                await me.updateImmagine(
                                    codice,
                                    1,
                                    scope.area,
                                    scope.canale,
                                    state.selectedUploadFile,
                                    scope.validaSoloPerLavorazione,
                                    fotoList
                                );

                                hideLoading();
                                Modali.closeAllModal();
                                return;
                            }

                            hideLoading();
                        }
                        catch (e) {
                            console.log(e);
                            hideLoading();
                            await Modali.popup(
                                "Errore",
                                "Si è verificato un errore durante l'aggiornamento della foto."
                            );
                        }
                    });

                    $('#btnCaricaFoto').off('click').on('click', async function () {
                        try {
                            //I20-980: prima di mandare l'operatore a cercare, si guarda se nella
                            //cartella Links c'e' gia' il file che sta cercando e glielo si propone.
                            var fd = await me.fotoDaProporreDallaCartella(
                                codice,
                                { nome: nomeFotoImpaginata, hash: hashFotoImpaginata },
                                fotoList.map(function (foto) {
                                    return { nome: foto != null ? foto.Nome : null, hash: getFotoHash(foto) };
                                }));

                            if (fd == null) {
                                //Niente da proporre, oppure l'operatore ha detto di no: si sfoglia,
                                //partendo dalla foto attuale nella cartella della lavorazione.
                                fd = await selectFile(
                                    me.percorsoDiPartenzaPerFoto(percorsoLinks, nomeFotoImpaginata));
                            }
                            if (fd == null) {
                                return;
                            }

                            const lowerName = (fd.nomeFile || '').toLowerCase();
                            const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.psd'];
                            const isValidImage = validExtensions.some(ext => lowerName.endsWith(ext));

                            if (!isValidImage || fd.file == null) {
                                await Modali.popup(
                                    "File non valido",
                                    "Seleziona un file immagine valido."
                                );
                                return;
                            }

                            if (state.selectedUploadPreviewUrl) {
                                try {
                                    URL.revokeObjectURL(state.selectedUploadPreviewUrl);
                                }
                                catch (e) {
                                    console.log(e);
                                }
                            }

                            const previewUrl = createObjectUrlFromFd(fd);

                            state.selectedUploadFile = fd;
                            state.selectedUploadPreviewUrl = previewUrl;
                            state.selectedRemotePhoto = null;

                            setScopeSelection('globale');
                            updateConfirmButtonState();

                            me.mostraAnteprimaCaricamento(fd.nomeFile, previewUrl, fd.file);
                            $('#txtNomeUploadFoto').text(fd.nomeFile || '');
                            $('#previewUploadFoto').show();
                            $('#btnResetFotoScelta').show();

                            $('#sectionFotoAttualeWrapper').hide();
                            $('#sectionFotoEsistenti').hide();
                            $('#sectionFotoDisattivateWrapper').hide();
                            $('#sectionAltreFotoWrapper').hide();
                            $('#separatorOppure').hide();

                            $('.foto-item').css('border', '1px solid #ccc');
                            $('.foto-item-bg').css('background', 'transparent');
                        }
                        catch (e) {
                            console.log(e);
                            await Modali.popup(
                                "Errore",
                                "Errore durante il caricamento della foto."
                            );
                        }
                    });

                    $('#btnResetFotoScelta').off('click').on('click', function () {
                        resetInterface();
                    });

                    $('#btnToggleAltreFoto').off('click').on('click', function () {
                        const $section = $('#sectionAltreFoto');
                        const $scrollArea = $('#cambiaFotoScrollArea');
                        const isHidden = $section.css('display') === 'none';

                        if (isHidden) {
                            $section.css('display', 'block');
                            $(this).text('Nascondi altre foto');

                            // piccolo scroll verso il basso per far percepire che è comparso qualcosa
                            setTimeout(function () {
                                const currentScroll = $scrollArea.scrollTop();
                                $scrollArea.scrollTop(currentScroll + 80);
                            }, 30);
                        }
                        else {
                            $section.css('display', 'none');
                            $(this).text('Altre foto');
                        }
                    });

                    $('.foto-cambiabile').off('click').on('click', function () {
                        state.selectedUploadFile = null;
                        if (state.selectedUploadPreviewUrl) {
                            try {
                                URL.revokeObjectURL(state.selectedUploadPreviewUrl);
                            }
                            catch (e) {
                                console.log(e);
                            }
                        }
                        state.selectedUploadPreviewUrl = null;

                        $('#previewUploadFoto').hide();
                        $('#imgPreviewUploadFoto').attr('src', '').show();
                        $('#txtAnteprimaNonDisponibile').hide().text('');
                        $('#txtNomeUploadFoto').text('');
                        $('#btnResetFotoScelta').hide();

                        //La sezione della foto attuale torna visibile solo se ha una scheda:
                        //senza foto in uso non deve comparire un riquadro vuoto.
                        if ($('#sectionFotoAttuale .foto-item').length > 0) {
                            $('#sectionFotoAttualeWrapper').show();
                        }
                        $('#sectionFotoEsistenti').show();
                        $('#sectionFotoDisattivateWrapper').show();
                        if ($('#sectionAltreFoto .foto-item').length > 0) {
                            $('#sectionAltreFotoWrapper').show();
                        }
                        $('#separatorOppure').show();

                        $('.foto-item').css('border', '1px solid #ccc');
                        $('.foto-item-bg').css('background', 'transparent');

                        $(this).css('border', '1px solid #5b9dff');
                        $(this).find('.foto-item-bg').css('background', '#dcecff');

                        const fotoData = $(this).data('fotoData');
                        state.selectedRemotePhoto = fotoData;

                        setScopeSelection(fotoData.scopeValue);
                        updateConfirmButtonState();
                    });
                }

                resetInterface();

                hideLoading();
            });
        }
        catch (e) {
            hideLoading();
        }
    },

    /// La schermata di primarie e secondarie.
    async EditFotoPrimarieSecondarie(box) {
        var messageDelivered = false;
        var schedaRef = this.schedeRefDati;
        if (schedaRef == null || schedaRef.length < 1) {
            return;
        }
        var codice_gruppo = schedaRef[0].recordInTracciato["Scatto.CodiceGruppo"];
        let me = this;
        //L'opzione di rendering non sta sul record del box ma sulle sue foto primarie/secondarie,
        //che il server consegna dentro membriGruppoFoto del primario.
        var primarioDelGruppo = schedaRef.find(f => f.recordInTracciato.StatoSelezione == 1);
        var membriGruppoFoto = (primarioDelGruppo != null && primarioDelGruppo.recordInTracciato.membriGruppoFoto != null)
            ? primarioDelGruppo.recordInTracciato.membriGruppoFoto
            : [];
        var noRenderDiCodice = function (cod) {
            var membro = membriGruppoFoto.find(m => m.codRef == cod);
            return membro != null && membro.noRender === true;
        };
        me.resetFotoPS();
        var listFotoImpaginate = [];
        var listRectangles = [];
        for (var i = 0; i < box.allPageItems.length; i++) {
            var item = box.allPageItems[i];
            if (item.label.startsWith(pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? pluginMiddleware.getCampo("nomeFotoPrimaria") : "foto") || item.label.startsWith(pluginMiddleware.getCampo("nomeFotoSecondaria") !== null ? pluginMiddleware.getCampo("nomeFotoSecondaria") : "foto")) {
                var statoSelezione = 0;
                if (item.label.startsWith(pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? pluginMiddleware.getCampo("nomeFotoPrimaria") : "foto")){
                    statoSelezione = 1;
                }
                else if (item.label.startsWith(pluginMiddleware.getCampo("nomeFotoSecondaria") !== null ? pluginMiddleware.getCampo("nomeFotoSecondaria") : "foto")){
                    statoSelezione = 2;
                }

                if (item.graphics.length > 0 && item.graphics.item(0).itemLink != null) {
                    //calcoliamo l'hash dell'immagine
                    var res = await ReperimentoFoto.getLinkHash(item);
                    listFotoImpaginate.push({ rectangle: item, imgName: item.graphics.item(0).itemLink.name, statoSelezione: statoSelezione, hash: res.hash, missing: res.missing, mismatch: res.mismatch });
                }
                listRectangles.push(item);
            }
        }
        //chiediamo al custom se ci sono campiExtra da mostrare in schermata editPrimarieSecondarie
        let campiExtra = pluginMiddleware.getCampo("campiExtraEditPrimarieSecondarie") !== null ? pluginMiddleware.getCampo("campiExtraEditPrimarieSecondarie") : [];
        let fotoPrimaria = listFotoImpaginate.find(f => f.statoSelezione == 1);
        for (var obj = 0; obj < schedaRef.length; obj++) {
            var objItem = schedaRef[obj].recordInTracciato;
            var row = $('<div class="row align-items-center imageRow" style="margin-bottom:10px"></div>'); // Crea una nuova riga
            var iconCol = $('<div class="col-1 d-flex align-items-center"></div>');

            var fotoFound = listFotoImpaginate.find(f => f.imgName == objItem["Foto.Nome"]);
            //se la foto è presente (stesso nome) ma diversa da quella attesa
            var fotoInMismatch = fotoFound != null && fotoFound.mismatch ? true : false;
            var fotoNellaCartellaIsMissing = fotoFound != null && fotoFound.missing ? true : false;
            var nomeFoto = fotoFound != null ? fotoFound.imgName : "";

            //var imgSrc = objItem["Foto.Nome"] != "" ? 'images/immaginePresente.png' : 'images/immagineNonPresente.png';
            var imgSrc = objItem["Foto.Nome"] != "" ? olimpoIp + "getThumbNailOnDemand?width=50&guidId=" + objItem["Foto.guidid"] : 'images/immagineNonPresente.png';

            var color = "";
            if (objItem.StatoSelezione != 3) {
                color = objItem.StatoSelezione == 1 ? "blue" : "orange";
            }
            var img = $('<img>', { src: imgSrc, style: "width:50px;" + (color != "" ? "background-color:" + color + ";" : ""), 'data-codice': objItem['Referenza.Codice'] });
            // img.on('click', function () {
            //     var codice = $(this).attr('data-codice');
            //     me.updateImmagine(codice); 
            // });

            var checkboxCol = $('<div class="col-3"></div>'); // Crea la colonna per i checkbox
            var checkBoxCol_r1 = $('<div class="row" style="margin-bottom:10px;"></div>'); // Crea la riga 1 per i checkbox
            var checkBoxCol_r2 = $('<div class="row"></div>'); // Crea la riga 2 per i checkbox
            var checkBoxCol_r2_c = $('<div class="col"></div>'); // Crea la riga 2 per i checkbox
            checkboxCol.append(checkBoxCol_r1);
            checkBoxCol_r2.append(checkBoxCol_r2_c);
            checkboxCol.append(checkBoxCol_r2);

            var textCol = $('<div class="col-8" ></div>'); // Crea la colonna per il testo

            if (objItem["Scatto.CodiceGruppo"].split(",").length > 1) {
                var checkbox1 = $('<input class="primary-check" codice="' + objItem["Referenza.Codice"] + '" type="checkbox"' + (objItem["StatoSelezione"] == 1 ? ' checked ' : ' ') + 'style="vertical-align: middle;">'); // Crea il primo checkbox
                var label1 = $('<label for="checkbox1">P:</label>'); // Crea l'etichetta per il primo checkbox
                var checkbox2 = $('<input class="secondary-check" codice="' + objItem["Referenza.Codice"] + '" type="checkbox" ' + (objItem["StatoSelezione"] == 2 ? ' checked ' : ' ') + ' style="vertical-align: middle;">'); // Crea il secondo checkbox
                var label2 = $('<label for="checkbox2">S:</label>'); // Crea l'etichetta per il secondo checkbox
                //I20-968: l'opzione di rendering non si imposta piu' da qui, ma dal modal noRender.
                var text = $('<span>(' + objItem['Referenza.Codice'] + ') ' + objItem["Descrizioni.Descrizione1"] + '</span>'); // Crea il testo

                // Imposta lo stile
                label1.css({ "font-size": "12px", "color": "lightblue" });
                checkbox1.css("background-color", "blue");
                label2.css({ "font-size": "12px", "color": "yellow", "margin-left": "5px" });
                checkbox2.css("background-color", "yellow");

                text.css({ "font-size": "12px", "color": "white" });

                //checkboxCol.append(label1, checkbox1, label2, checkbox2); // Aggiunge i checkbox alla colonna dei checkbox
                checkBoxCol_r2_c.append(label1, checkbox1, label2, checkbox2, text); // Aggiunge i checkbox alla colonna dei checkbox

                //textCol.append(text); // Aggiunge il testo alla colonna del testo
            }
            else {
                var text = $('<span>(' + objItem['Referenza.Codice'] + ') ' + objItem["Descrizioni.Descrizione1"] + '</span>'); // Crea il testo
                text.css({ "font-size": "12px", "color": "white" });
                //textCol.append(text); // Aggiunge il testo alla colonna del testo
                checkBoxCol_r2_c.append(text)
            }

            //se objItem["Foto.IsMeta"] è true allora mettiamo una piccola icona di metatag con scritto From_Meta
            if (objItem["Foto.IsMeta"]) {
                //non è un'immagine, usiamo un div con angoli arrotondati e bordo colorato di un rosso chiaro
                var metaIcon = $('<div style="width: 65px; height: 20px; border-radius: 10%; background-color: rgba(255, 0, 0, 0.2); color: white; display: flex; align-items: center; justify-content: center; font-size: 10px; border: 1px solid red;" title="Foto da metatag">From_Meta</div>');
                iconCol.append(metaIcon);

                //aggiungiamo un evento onclick
                metaIcon.on('click', async function () {
                    //mandiamo un confirm (usando il componente usato nel progetto) in cui chiediamo se vogliamo rimuovere il metatag
                    let res = await Modali.confirm("Rimuovere la foto associata a questa lavorazione? Sarà ripristinata la foto da archivio.");
                    if (res) {
                        me.eliminaMetaFoto(objItem["Referenza.Codice"], 1);
                    }
                });
            }
            var btnAttachFoto = $('<button id="btnAttachFoto" data-codice="' + objItem["Referenza.Codice"] + '">Cambia foto</button>'); // Crea il secondo checkbox
            checkBoxCol_r1.append(btnAttachFoto);

            btnAttachFoto.on('click', function () {
                var codice = $(this).attr('data-codice');
                //var validaSoloPerLavorazione = $(this).siblings('.mod-check').is(':checked');
                //me.updateImmagine(codice, 1, validaSoloPerLavorazione);
                me.openModalCambiaFoto(codice)
            });

            row.append(iconCol, checkboxCol, textCol); // Aggiunge le colonne alla riga
            $("#cambiaPS").append(row); // Aggiunge la riga a #cambiaPS

            var rowNomeFoto = $('<div class="row align-items-center" style="margin-bottom:10px"></div>'); // Crea una nuova riga
            var fotoName = objItem["Foto.Nome"] != null ? objItem["Foto.Nome"] : "";
            var textNomeFoto = $('<span>Nome foto: ' + (fotoName !== "" ? fotoName : "nessuna foto") + '</span>');
            textNomeFoto.css({ "font-size": "12px", "color": "white" });

            // icona copia
            var copyIcon = $('<img src="images/copyToClipBoard.png" data-msg="' + fotoName + '" style="width:16px; margin-left:8px; cursor:pointer;" title="Copia nome">');

            copyIcon.on('click', function () {
                let textToCopy = $(this).attr("data-msg");
                navigator.clipboard.writeText(textToCopy).then(() => {
                    $(this).attr("src", "images/check.png");
                    setTimeout(() => {
                        $(this).attr("src", "images/copyToClipBoard.png");
                    }, 1000);
                });
            });

            rowNomeFoto.append(textNomeFoto, copyIcon); // Aggiunge il testo e l'icona alla riga
            textNomeFoto.css({ "font-size": "12px", "color": "white" });
            rowNomeFoto.append(textNomeFoto); // Aggiunge il testo alla riga
            $("#cambiaPS").append(rowNomeFoto); // Aggiunge la riga a #cambiaPS

            //se campiExtra è diverso da null e da [] allora creiamo una nuova riga per ogni campo extra
            //campi extra è un array di oggetti con chiave label e key, label è il testo da mostrare e key è la chiave da cui prendere il valore in objItem
            if (campiExtra != null && campiExtra.length > 0) {
                campiExtra.forEach(campo => {
                    var rowCampoExtra = $('<div class="row align-items-center" style="margin-bottom:10px"></div>'); // Crea una nuova riga
                    var valueCampo = objItem[campo.keyInRecordInTracciato] != null ? objItem[campo.keyInRecordInTracciato] : "";
                    var textCampoExtra = $('<span>' + campo.label + ': ' + (valueCampo !== "" ? valueCampo : "nessun dato") + '</span>');
                    textCampoExtra.css({ "font-size": "12px", "color": "white" });
                    rowCampoExtra.append(textCampoExtra); // Aggiunge il testo alla riga
                    $("#cambiaPS").append(rowCampoExtra); // Aggiunge la riga a #cambiaPS
                });
            }

            var hashMatch = (fotoFound != null && fotoFound.hash != null ? fotoFound.hash.toUpperCase() : null) == (objItem["Foto.Hash"] != null ? objItem["Foto.Hash"].toUpperCase() : null);

            //creiamo una nuova row
            if ((fotoFound == null || fotoInMismatch || fotoNellaCartellaIsMissing || !hashMatch) && objItem.StatoSelezione != 3 && objItem["Foto.Nome"] != "") {
                var rowSyncErrorFoto = $('<div class="row align-items-center" style="margin-bottom:10px"></div>');

                var imgSync = null;
                var errorText = null;
                //controlliamo se la foto è presente nella cartella di lavorazione
                if (fotoFound == null) {
                    var codice = objItem["Referenza.Codice"];
                    var fotoNomeDato = objItem["Foto.Nome"];
                    try {

                        //la foto non è impaginata
                        var fileBuffer = fs.readFileSync(/*pathLavorazione +*/ percorsoLinks + fotoNomeDato);
                        imgSync = $('<img>', { src: "images/impaginazione.png", style: "width:30px; cursor:pointer;", 'data-codice': objItem["Foto.guidid"] });
                        errorText = $('<span>Errore: la foto non risulta impaginata, impaginare attraverso il pulsante adiacente</span>');
                        errorText.css({ "font-size": "14px", "color": "yellow" });

                        imgSync.on('click', function () {
                            let result = FotoPlacer.updateFoto(fotoNomeDato, box, null, codice);
                            box = result.box;
                            let fotoImpaginata = result.fotoRectangle;

                            if (fotoPrimaria != null && fotoImpaginata != null) {
                                fotoImpaginata.sendToBack(fotoPrimaria.rectangle);
                            }
                            me.EditFotoPrimarieSecondarie(box);
                        });

                    }
                    catch {
                        imgSync = $('<img>', { src: "images/download.png", style: "width:30px; cursor:pointer;", 'data-codice': objItem["Foto.guidid"] });
                        errorText = $('<span>Errore: la foto non è stata trovata nei Links, scaricare l\'immagine attraverso il pulsante adiacente</span>');
                        errorText.css({ "font-size": "14px", "color": "yellow" });
                        imgSync.on('click', function () {


                            ReperimentoFoto.avviaSyncPacchettoFoto(2, function () {
                                me.EditFotoPrimarieSecondarie(box);
                            }, [codice]);
                        });
                    }
                }
                else{
    
                    if (fotoNellaCartellaIsMissing) {
                        var codice = objItem["Referenza.Codice"];
                        imgSync = $('<img>', { src: "images/download.png", style: "width:30px; cursor:pointer;", 'data-codice': objItem["Foto.guidid"] });
                        errorText = $('<span>Errore: la foto non è presente nella cartella, scaricare l\'immagine attraverso il pulsante adiacente</span>');
                        errorText.css({ "font-size": "14px", "color": "yellow" });
                        imgSync.on('click', function () {
                            ReperimentoFoto.avviaSyncPacchettoFoto(2, function () {
                                me.EditFotoPrimarieSecondarie(box);
                            }, [codice]);
                        });
                    }
                    else if (fotoInMismatch || !hashMatch) {
                        var codice = objItem["Referenza.Codice"];
                        var fotoNomeDato = objItem["Foto.Nome"];
                        var fotoRectangle = fotoFound.rectangle;
                        try {
                            //confrontiamo gli hash
                            if(hashMatch){
                                //la foto impaginata è sbagliata, in cartella c'è quella giusta
                                imgSync = $('<img>', { src: "images/impaginazione.png", style: "width:30px; cursor:pointer;", 'data-codice': objItem["Foto.guidid"] });
                                errorText = $('<span>Errore: la foto impaginata è da ricollegare, aggiornare l\'immagine</span>');
                                errorText.css({ "font-size": "14px", "color": "yellow" });
    
                                imgSync.on('click', function () {
                                    let result = FotoPlacer.updateFoto(fotoNomeDato, box, fotoRectangle, codice);
                                    box = result.box;
                                    let fotoImpaginata = result.fotoRectangle;
                                    if (fotoPrimaria != null && fotoImpaginata != null) {
                                        fotoImpaginata.sendToBack(fotoPrimaria.rectangle);
                                    }

                                    me.EditFotoPrimarieSecondarie(box);
                                });
                            }
                            else{
                                imgSync = $('<img>', { src: "images/download.png", style: "width:30px; cursor:pointer;", 'data-codice': objItem["Foto.guidid"] });
                                errorText = $('<span>Errore: la foto nei link non corrisponde al server, aggiornare l\'immagine</span>');
                                errorText.css({ "font-size": "14px", "color": "yellow" });
                                imgSync.on('click', function () {
                                    ReperimentoFoto.avviaSyncPacchettoFoto(2, function () {
                                        me.EditFotoPrimarieSecondarie(box);
                                    }, [codice]);
                                });
                            }
                        }
                        catch {
                            console.error("Foto in mismatch ma non trovata nei links");
                            messaggioUtente("Code SRF-33 La foto associata a questo elemento è diversa da quella presente nei links, ma non è stata trovata nella cartella dei links, contattare l'assistenza", "error");
                        }
                    }
                    
                }


                var iconSyncCol = $('<div class="col-1 d-flex align-items-center"></div>');
                if (imgSync != null) {
                    iconSyncCol.append(imgSync);
                    rowSyncErrorFoto.append(iconSyncCol);
                }
                var textSyncErrorCol = $('<div class="col-11"></div>');
                //facciamo la colonna con scritto l'errore
                if (errorText != null) {
                    textSyncErrorCol.append(errorText);
                    rowSyncErrorFoto.append(textSyncErrorCol);
                }

                if (rowSyncErrorFoto.children().length > 0) {
                    $("#cambiaPS").append(rowSyncErrorFoto);
                }
            }

            iconCol.append(img);

            if (obj < schedaRef.length - 1) {
                $("#cambiaPS").append('<hr>');
            }
        }

        if (objItem["Scatto.CodiceGruppo"].split(",").length > 1) {
            var confermaButton = $('<sp-action-button id="confermaButton" style="color:lightgreen; margin-right:10px;">Applica</sp-action-button>');
            confermaButton.on('click', function () {
                //Solo i checkbox di selezione: quello di rendering non concorre a primaria/secondaria
                var checkboxes = $("#cambiaPS").find("input.primary-check:checked, input.secondary-check:checked");
                var checkboxesArray = Array.from(checkboxes);
                var listaSingoli = checkboxesArray.map(function (checkbox) {
                    var statoSelezione = $(checkbox).hasClass('primary-check') ? 1 : 2;
                    var cod = $(checkbox).attr('codice');
                    var row = $(checkbox).closest('.imageRow');
                    var imgSrc = row.find('img').attr('src');
                    var hasFoto = imgSrc && imgSrc.trim() !== "" ? true : false;
                    return {
                        Codice: cod,
                        StatoSelezione: statoSelezione,
                        HasFoto: hasFoto
                    };
                });

                //ora aggiungiamo alla lista tutti i checkbox non selezionati e mettiamo lo stato selezione a 3
                var checkboxesNotSelected = $("#cambiaPS").find("input.primary-check:not(:checked), input.secondary-check:not(:checked)");
                var checkboxesNotSelectedArray = Array.from(checkboxesNotSelected);
                var listaSingoliNotSelected = checkboxesNotSelectedArray.map(function (checkbox) {
                    var cod = $(checkbox).attr('codice');
                    var row = $(checkbox).closest('.row');
                    var imgSrc = row.find('img').attr('src');
                    var hasFoto = imgSrc && imgSrc.trim() !== "" ? true : false;
                    return {
                        Codice: cod,
                        StatoSelezione: 3,
                        HasFoto: hasFoto
                    };
                });

                //scorriamo la listaSingoliNotSelected e cerchiamo se c'è un altro elemento con lo stesso codice in listaSingoliNotSelected, se non c'è lo rimuoviamo
                for (var i = listaSingoliNotSelected.length - 1; i >= 0; i--) {
                    if (listaSingoli.filter(f => f.Codice == listaSingoliNotSelected[i].Codice).length == 1) { //vuol dire che è un primario o un secondario
                        //rimuoviamo l'elemento
                        listaSingoliNotSelected.splice(i, 1);
                    }
                }

                //adesso avremo una lista di elementi duplicati, quindi dobbiamo rimuovere il duplicato
                listaSingoliNotSelected = listaSingoliNotSelected.filter((v, i, a) => a.findIndex(t => (t.Codice === v.Codice)) === i);

                listaSingoli = listaSingoli.concat(listaSingoliNotSelected);

                // Controllo per codici duplicati
                var hasDuplicates = listaSingoli.some(function (item, index, array) {
                    return array.filter(function (x) { return x.Codice == item.Codice; }).length > 1;
                });
                if (hasDuplicates) {
                    messaggioUtente("Code SRF-34 Edit P/S: Un codice è stato impostato sia come primario che secondario, correggere prima di procedere", "error");
                    return;
                }

                // Controllo per almeno un primario
                var hasPrimary = listaSingoli.some(function (item) {
                    return item.StatoSelezione == 1;
                });
                if (!hasPrimary) {
                    messaggioUtente("Code SRF-35 Edit P/S: Nessun primario selezionato, impossibile procedere", "error");
                    return;
                }

                // Controllo per più di un primario
                var primaryCount = listaSingoli.filter(function (item) {
                    return item.StatoSelezione == 1;
                }).length;
                if (primaryCount > 1) {
                    messaggioUtente("Code SRF-36 Edit P/S: C'è più di un primario selezionato, correggere prima di procedere", "error");
                    return;
                }

                // Controllo per foto mancante
                var missingFoto = listaSingoli.find(function (item) {
                    return (item.HasFoto == false && item.StatoSelezione != 3);
                });
                if (missingFoto) {
                    messaggioUtente("Code SRF-37 Edit P/S: Nessuna foto per l'elemento " + missingFoto.Codice, "error");
                    return;
                }

                //Vanno letti adesso, sul dato ancora vecchio: fra poco sara' quello nuovo.
                var codiceBoxPrecedente = me.codiceBoxDellaScheda(schedaRef);
                var avvisoCambioPrimario = me.avvisoCambioPrimario(schedaRef, listaSingoli);

                //creiamo un oggetto da mandare al server, composto da una lista di elementi con codice e stato selezione
                //scorriamo la listaRef e confrontiamo lo stato selezione con quello dell'elemento con lo stesso codice in listaSingoli, se non corrisponde creiamo un nuovo elemento da mettere in lista da mandare al server

                var objToSend = {
                    idLavorazione: idKitLavorazione,
                    CodiceGruppo: codice_gruppo,
                    ps: []
                };



                for (var i = 0; i < schedaRef.length; i++) {
                    var objItem = schedaRef[i].recordInTracciato;
                    var cod = objItem["Referenza.Codice"];
                    var item = listaSingoli.find(function (element) {
                        return element.Codice == cod;
                    });
                    if (item == null) {
                        messaggioUtente("Edit P/S: Errore durante il salvataggio delle modifiche: Elemento non trovato", "error");
                        return;
                    }

                    //if (item.StatoSelezione != objItem.StatoSelezione) {
                        //I20-977: il noRender non viaggia piu' di qui. Vive nella sua struttura,
                        //e mandarlo dentro ps lo riscriverebbe nel posto da cui la migrazione dei
                        //meta storici lo ripesca, resuscitando una foto appena riattivata.
                        objToSend.ps.push({
                            codRef: cod,
                            stato: item.StatoSelezione
                        });
                    //}
                }

                //facciamo il formData dell'objectToSend
                var formData = new FormData();
                var idRec = 0;
                try {
                    var dna = Utility.getDnaOfBox(box);
                    if (dna != null && dna.idRec != null && dna.idRec !== "" && !isNaN(parseInt(dna.idRec))) {
                        idRec = parseInt(dna.idRec);
                    }
                }
                catch (e) {
                    console.warn("Impossibile recuperare idRec dal box durante Edit P/S", e);
                }
                formData.append("idLavorazione", idKitLavorazione);
                formData.append("CodiceGruppo", codice_gruppo);
                formData.append("idRec", idRec);
                formData.append("ps", JSON.stringify(objToSend.ps));

                const xhr = new XMLHttpRequestClient();
                xhr.onload = async (objResult2, parsed) => {
                    if (!parsed) {
                        try {
                            objResult2 = JSON.parse(objResult2);
                        }
                        catch (e) {
                            messaggioUtente("Code SRF-38 Edit P/S: Errore generico durante il salvataggio delle modifiche: " + e, "error");
                            return;
                        }
                    }
                    console.log("Risposta");
                    if (!objResult2.esito) {
                        messaggioUtente("Code SRF-39 Edit P/S: Errore durante il salvataggio delle modifiche: " + objResult2.error, "error");
                        return;
                    }

                    try {
                        //aggiorniamo il dato in schedaRef
                        var primaria = null;
                        var secondarie = [];
                        for (var i = 0; i < schedaRef.length; i++) {
                            var objItem = schedaRef[i].recordInTracciato;
                            var cod = objItem["Referenza.Codice"];
                            var item = listaSingoli.find(function (element) {
                                return element.Codice == cod;
                            });

                            if (item != null && objToSend.ps.find(f => f.codRef == cod) != null) {
                                //cerchiamo in listfotoimpaginate l'elemento con l'immagine uguale a objItem["Foto.Nome"]
                                objItem.StatoSelezione = item.StatoSelezione;
                                //La scelta sul rendering si legge dove vive davvero, non dal
                                //payload P/S, che non la porta piu'.
                                var noRenderSalvato = noRenderDiCodice(cod);
                                //teniamo allineato il dato locale: la schermata viene ridisegnata da qui
                                var membroLocale = membriGruppoFoto.find(m => m.codRef == cod);
                                if (membroLocale != null) {
                                    membroLocale.noRender = noRenderSalvato;
                                }
                                var fotoFound = listFotoImpaginate.find(f => f.imgName == objItem["Foto.Nome"])
                                let imgRectangle = fotoFound != null ? fotoFound.rectangle : null;
                                //box = me.placeFoto(objItem.StatoSelezione != 3 ? objItem["Foto.Nome"] : null, box, imgRectangle, objItem["Referenza.Codice"], objItem.StatoSelezione);
                                let result = FotoPlacer.updateFoto(objItem.StatoSelezione != 3 ? objItem["Foto.Nome"] : null, box, imgRectangle, objItem["Referenza.Codice"], objItem.StatoSelezione, noRenderSalvato);
                                box = result.box;
                                imgRectangle = result.fotoRectangle;
                                if(objItem.StatoSelezione == 1){
                                    primaria = imgRectangle;
                                }
                                else if(objItem.StatoSelezione == 2){
                                    secondarie.push(imgRectangle);
                                }
                            }
                        }

                        if(secondarie.length > 0){
                            //guardiamo qual'è la secondaria che appare prima in gerarchia del box
                            var firstSecondaria = null;
                            for (var i = 0; i < box.allPageItems.length; i++) {
                                var item = box.allPageItems[i];
                                //se l'item ha lo stesso id di uno degli imgRectangle delle secondarie allora è la firstSecondaria
                                if (secondarie.find(s => s != null && s.id == item.id) != null) {
                                    firstSecondaria = item;
                                    break;
                                }
                            }
    
                            primaria.bringToFront(firstSecondaria);
                        }

                    }
                    catch (ex) {
                        console.error(ex);
                    }

                    //La scheda sul server puo' essere cambiata insieme alle primarie e secondarie:
                    //la si riscarica sempre, ed e' dal dato fresco che si capisce se il box in
                    //pagina e' ancora allineato. Prima si riscaricava solo su richiesta di agenzia.
                    showLoading("Aggiornamento della scheda in corso...");
                    var schedaRicaricata = await me.ricaricaDatiScheda(codice_gruppo, idRec);
                    hideLoading();

                    if (avvisoCambioPrimario !== "") {
                        messaggioUtente(avvisoCambioPrimario, "warning", false, 15);
                    }

                    if (schedaRicaricata) {
                        var esitoAllineamento = await me.allineaBoxDopoSalvataggioPS(box, codiceBoxPrecedente);
                        if (esitoAllineamento !== me.ESITI_ALLINEAMENTO_BOX.nessuno) {
                            //Il box e' stato rifatto: il fix foto e il refresh della lista
                            //lavorerebbero su un box che non c'e' piu'.
                            return;
                        }
                    }

                    //Il fix foto viene dopo: una reimpaginazione rifa' il box e butterebbe via
                    //il fix appena applicato, oltre a chiedere due conferme per un lavoro solo.
                    let res = await Modali.confirm("Modifiche salvate. Applicare il Fix Foto automatico?");
                    if (res) {
                        //applichiamo il fix foto automatico, che consiste nel posizionare tutte le foto primarie e secondarie al posto giusto in base alla meccanica
                        var obs = SistemazioneFoto.getSpazioImpaginazione(box);
                        SistemazioneFoto.fixFoto(box, obs.candidate, obs.obstacles);
                        messaggioUtente("Fix Foto automatico applicato", "success", false, 3);
                    }


                    //Questa funzione fa un refresh della schermata lista PRIMARIE/SECONDARIE
                    await me.EditFotoPrimarieSecondarie(box);  //serve, non è un loop
                };

                xhr.onreadystatechange = function () {
                    if (xhr.readyState == 4) {
                        if (xhr.status == 200) {
                            messaggioUtente("Edit P/S: Richiesta completata con successo", "success", false, 5);
                        } else {
                            //messaggioUtente("Edit P/S: Errore durante la richiesta: " + xhr.status, "error");
                        }
                    }
                };

                xhr.onerror = function () {
                    //messaggioUtente("Edit P/S: Errore di rete", "error");
                };

                xhr.send("Menabo/modificaPrimarieSecondarie" + "/" + 0, formData, "PUT");
                messaggioUtente("Edit P/S: Richiesta inviata", "success", true, 0, true);

            });
            $("#pulsantiExtra").append(confermaButton);
            if ($("#Tab6").css("display") == "none") {
                confermaButton.css("display", "none");
            }
        }
    },

    /// I20-1072: la decisione per questa lavorazione presa su una foto extra, o null. tipoFoto e' il
    /// tipo della foto (3 = logo): nel meta il tipo di elemento e' Logo per 3, FotoExtra per il resto.
    decisioneExtraDellaFoto(decisioni, sigla, tipoFoto) {
        if (!Array.isArray(decisioni) || sigla == null || String(sigla) === "") {
            return null;
        }
        var tipoElemento = tipoFoto == 3 ? NoRenderElementi.TIPO.logo : NoRenderElementi.TIPO.fotoExtra;
        return decisioni.find(v => v != null && String(v.sigla) === String(sigla) && v.tipo == tipoElemento) || null;
    },

    /// I20-1072: l'etichetta corta della decisione, accanto al nome della foto.
    etichettaDecisioneExtra(voce) {
        if (voce == null) {
            return "";
        }
        if (voce.azione === 1) {
            return "immagine del box per questa lavorazione";
        }
        if (voce.azione === 2) {
            return "solo per questa lavorazione";
        }
        if (voce.azione === 3) {
            return "esclusa per questa lavorazione";
        }
        return "decisa per questa lavorazione";
    },

    /// I20-1072: l'etichetta della decisione come elemento della riga.
    segnoDecisioneExtra(voce) {
        var segno = $('<span class="decisioneExtraLavorazione"></span>').text(this.etichettaDecisioneExtra(voce));
        segno.css({ "font-size": "11px", "color": "#8be28b", "font-style": "italic", "margin-left": "8px" });
        return segno;
    },

    /// I20-1072: il Togli di una riga della scheda foto extra: toglie la decisione (la scheda si
    /// riscarica, come dalla finestra delle differenze), ridisegna il pannello e aggiorna
    /// segnalazioni e segnalino.
    pulsanteTogliDecisioneExtra(voce, box) {
        var me = this;
        var togli = $('<button class="togliDecisioneExtra" style="color:lightgreen">Togli</button>');
        Tooltip.impostaTooltip(togli[0], "Toglie la decisione presa per questa lavorazione: la foto torna come la vuole il dato");
        togli.on('click', async function () {
            togli.prop("disabled", true);
            try {
                await me.togliExtraLavorazione(voce, async function () {
                    me.FotoExtraPanel(box);
                    me.memorizzaSegnalazioni(await me.differenzeDatiNelBox(box, me.schedeRefDati));
                    me.aggiornaPulsanteSegnalazioni();
                });
            }
            finally {
                togli.prop("disabled", false);
            }
        });
        return togli;
    },

    FotoExtraPanel(box) {
        let me = this;
        var schedaRef = this.schedeRefDati;
        me.resetFotoExtra();

        //troviamo il primario in schedaRef
        var primario = schedaRef.find(f => f.recordInTracciato.StatoSelezione == 1);
        if (primario == null) {
            messaggioUtente("Code SRF-47 Nessun elemento primario trovato", "error");
            return;
        }
        //I20-1072: le foto extra decise per questa lavorazione (I20-1070), dal record.
        var decisioni = Array.isArray(primario.recordInTracciato.extraLavorazione) ? primario.recordInTracciato.extraLavorazione : [];
        var extra = primario.recordInTracciato["Foto.Extra"];
        if (extra != null) {
            for (var $i = 0; $i < this.tipiFotoExtra.length; $i++) {
                var elemento = this.tipiFotoExtra[$i];
                var panel = $('<div class="panel fotoExtraPanel"></div>');
                panel.attr("val", elemento.val);
                var titolo = $('<h3>' + elemento.nome + '</h3>');
                //aggiungiamo lo stile al titolo per far apparire il testo bianco
                titolo.css({ "color": "white" });
                panel.append(titolo);
                $("#FotoExtra").append(panel);
            }

            //adesso riempiamo i panel con i valori di extra.nome_reale che hanno la chiave extra.tipo uguale al val del panel
            for (var $i = 0; $i < extra.length; $i++) {
                //troviamo l'elemento id in ogni elemento di objResult e salviamoli in una unica stringa separata da virgole
                // var idsFoto = "";
                // for (var j = 0; j < schedaRef.length; j++) {
                //     if (schedaRef[j].recordInTracciato["Foto.Extra"].find(f => f.Tipo == extra[$i].Tipo && f.NomeReale == extra[$i].NomeReale) != null) {
                //         idsFoto += schedaRef[j].recordInTracciato["Foto.Extra"].find(f => f.Tipo == extra[$i].Tipo && f.NomeReale == extra[$i].NomeReale).Id;
                //         break;
                //     }
                // }
                //idsFoto = idsFoto.slice(0, -1);

                var elemento = extra[$i];
                //troviamo il panel corrispondente a elemento.tipo cercandolo tramite la classe fotoExtraPanel e l'attr val uguale a elemento.tipo
                var panel = $("#FotoExtra").find(".fotoExtraPanel[val='" + elemento.tipo + "']");
                //creiamo una riga con dentro elemento.nome_reale e l'appendiamo al panel, mettiamo anche un attr alla riga chiamato idFoto e contentente elemento.id
                var row = $('<div class="row align-items-center" nomeFoto="' + elemento.nome + '" idFoto="' + elemento.guidId + '" sigla="' + elemento.sigla + '" style="margin-bottom:10px"></div>');
                var text = $('<span>' + elemento.nome/*nomeReale*/ + '</span>');
                text.css({ "font-size": "12px", "color": "white" });

                //creiamo un checkbox da mettere prima del testo basato sul valore di elemento.attiva
                var checkbox = $('<input type="checkbox" class="checkboxExtra" ' + (elemento.attiva ? "checked" : "") + '>');
                //I20-1072: con una decisione per questa lavorazione la casella resta ferma: attivare o
                //disattivare vale per l'articolo, e prima va tolta la decisione.
                var decisioneManuale = me.decisioneExtraDellaFoto(decisioni, elemento.sigla, elemento.tipo);
                if (decisioneManuale != null) {
                    checkbox.prop("disabled", true);
                    Tooltip.impostaTooltip(checkbox[0], "Decisa per questa lavorazione: togli la decisione per cambiarla");
                }
                checkbox.on('change', function () {
                    var sigla = $(this).parent().attr("sigla");
                    if (sigla == "")
                        sigla = null;
                    //passiamo ad attivaDisattivaFotoExtra l'id, il val del panel, il nome della foto e il box corrispondente alla current selection
                    me.attivaDisattivaFotoExtra($(this).parent().attr("idFoto"), $(this).closest(".fotoExtraPanel").attr("val"), $(this).parent().attr("nomeFoto"), box, $(this).is(":checked"), sigla);
                });
                row.append(checkbox);
                row.append(text);
                //prima del nome inseriamo un pulsante con scritto elimina che al click chiama la funzione eliminaFotoExtra passando l'id dell'elemento
                var button = $('<button id="eliminaFotoExtra" style="color:red; width:25px; height:25px;"><img src="images/icon_small_cestino.png" alt="Elimina" style="width:14px;height:14px;"></button>');
                button.on('click', function () {
                    var sigla = $(this).parent().attr("sigla");
                    if (sigla == "")
                        sigla = null;
                    //passiamo ad eliminaFoto l'id, il val del panel, il nome della foto e il box corrispondente alla current selection
                    me.eliminaFotoExtra($(this).parent().attr("idFoto"), $(this).closest(".fotoExtraPanel").attr("val"), $(this).parent().attr("nomeFoto"), me.refSelected.item, sigla);
                });
                row.append(button);

                //inseriamo un secondo pulsante con icona impaginazione.png che al click chiama la funzione impaginaFotoExtra passando il nome della foto, il tipo, il box e il path di lavorazione
                var impaginaButton = $('<button id="impaginaFotoExtra" style="color:lightgreen; width:25px; height:25px;"><img src="images/impaginaRef.png" alt="Impagina" style="width:14px;height:14px;"></button>');
                impaginaButton.on('click', function () {
                    var sigla = $(this).parent().attr("sigla");
                    if (sigla == "")
                        sigla = null;
                    box = me.impaginaFotoExtra($(this).parent().attr("nomeFoto"), $(this).closest(".fotoExtraPanel").attr("val"), me.refSelected.item, pathLavorazione, primario.recordInTracciato, sigla);
                });
                row.append(impaginaButton);

                if (decisioneManuale != null) {
                    row.append(me.segnoDecisioneExtra(decisioneManuale));
                    row.append(me.pulsanteTogliDecisioneExtra(decisioneManuale, box));
                }

                //centriamo verticalmente il testo
                row.css("display", "flex");
                row.css("align-items", "center");
                panel.append(row);
            }

            //per ogni panel a cui non è stato aggiunto nessun elemento aggiungiamo una riga con scritto, nessun elemento
            var panels = $("#FotoExtra").find(".fotoExtraPanel");
            for (var $i = 0; $i < panels.length; $i++) {
                var panel = $(panels[$i]);
                if (panel.children().length == 1) {
                    var row = $('<div class="row align-items-center" style="margin-bottom:10px"></div>');
                    var text = $('<span>Nessun elemento</span>');
                    text.css({ "font-size": "12px", "color": "white" });
                    row.append(text);
                    panel.append(row);
                }
            }
            //adesso che tutti i panel sono pieni aggiungiamo un pulsante finale per ogni panel con scritto Aggiungi + nome del panel 
            var panels = $("#FotoExtra").find(".fotoExtraPanel");
            for (var $i = 0; $i < panels.length; $i++) {
                var panel = $(panels[$i]);
                var button = $('<button id="aggiungiButton" style="color:lightgreen">Aggiungi ' + this.tipiFotoExtra.find(f => f.val == panel.attr("val")).nome + '</button>');
                //al button aggiungiamo un attr tipo con il valore del panel
                button.attr("tipo", panel.attr("val"));
                button.on('click', function () {
                    //chiamiamo la funzione updateImmagine passando il codice gruppo dell'elemento selezionato e il tipo
                    me.updateImmagine(primario.recordInTracciato["Scatto.CodiceGruppo"], $(this).attr("tipo"), null, null);
                });
                panel.append(button);
                var buttonLink = $('<button id="linkButton" style="color:lightgreen">Link ' + this.tipiFotoExtra.find(f => f.val == panel.attr("val")).nome + ' con immagine a sistema</button>');
                buttonLink.attr("tipo", panel.attr("val"));
                buttonLink.on('click', function () {
                    me.linkLogoBollo($(this).attr("tipo"));
                });
                panel.append(buttonLink);
                
                //e per ogni panel tranne l'ultimo mettiamo una linea divisoria che lo separi da quello sotto
                if ($i < panels.length - 1) {
                    panel.append('<hr>');
                }
            }
        }

        //si crea un nuovo divisorio e un nuovo panel per gli elementi extra auto
        $("#FotoExtra").append('<hr>');
        var panelExtraAuto = $('<div class="panel fotoExtraPanel"></div>');
        panelExtraAuto.attr("val", "extraAuto");
        var titoloExtraAuto = $('<h3>Extra Auto</h3>');
        titoloExtraAuto.css({ "color": "white" });
        panelExtraAuto.append(titoloExtraAuto);
        $("#FotoExtra").append(panelExtraAuto);

        //mettiamo un margine in fondo al panel
        panelExtraAuto.css("margin-bottom", "10px");
        $("#FotoExtra").append('<hr>');
        var fotoExtraAuto = primario.recordInTracciato["Foto.ExtraAuto"];

        if (fotoExtraAuto != null) {
            //foto extra auto è una lista di oggetti composti da una stringa NomeFoto e un bool Escluso, per ogni oggetto si crea una nuova riga con il nome della foto e un pulsante, il pulsante avrà scritto escludi se Escluso è false e includi se è true
            for (var $i = 0; $i < fotoExtraAuto.length; $i++) {
                var elemento = fotoExtraAuto[$i];
                var row = $('<div class="row align-items-center" sigla="' + elemento.sigla + '" nomeFoto="' + elemento.nome + '" escluso="' + elemento.escluso + '" tipo="' + elemento.tipo + '" style="margin-bottom:10px"></div>');
                var text = $('<span>' + elemento.nome + '</span>');
                text.css({ "font-size": "12px", "color": "white" });
                //I20-1072: una foto decisa per questa lavorazione si segna, e al posto di Escludi/Includi
                //(che valgono per l'articolo, e su di lei non hanno senso) ha il Togli della decisione.
                var decisione = me.decisioneExtraDellaFoto(decisioni, elemento.sigla, elemento.tipo);
                var button;
                if (decisione != null) {
                    button = me.pulsanteTogliDecisioneExtra(decisione, box);
                }
                else {
                    button = $('<button id="aggiungiButton" style="color:lightgreen">' + (elemento.escluso ? "Includi" : "Escludi") + '</button>');

                    button.on('click', function () {
                        //passiamo ad escludiFotoExtraAuto l'id, il val del panel, il nome della foto e il box corrispondente alla current selection
                        me.escludiIncludiFotoExtraAuto($(this).parent().attr("nomeFoto"), $(this).parent().attr("escluso"), box, $(this).parent(), $(this).parent().attr("tipo"), $(this).parent().attr("sigla"));
                    });
                }
                row.append(button);
                row.append(text);
                if (decisione != null) {
                    row.append(me.segnoDecisioneExtra(decisione));
                }
                row.css("display", "flex");
                row.css("align-items", "center");
                panelExtraAuto.append(row);
            }

            //se non ci sono elementi extra auto mettiamo una riga con scritto nessun elemento
            if (fotoExtraAuto.length == 0) {
                var row = $('<div class="row align-items-center" style="margin-bottom:10px"></div>');
                var text = $('<span>Nessun elemento</span>');
                text.css({ "font-size": "12px", "color": "white" });
                row.append(text);
                panelExtraAuto.append(row);
            }
        }
    },

    /// I20-980: il nome di un file diviso in radice ed estensione, quest'ultima in minuscolo.,

    async updateImmagine(codice, tipo = 1, area = null, canale = null, fd = null, validaSoloPerLavorazione = false, fotoList = []) {
        try {
            //schedeRefDati = this.schedeRefDati;
            var box = this.refSelected.item;
            let me = this;
            console.log(codice);
            if(fd == null){
                fd = await selectFile();
            }
            if (fd == null) {
                return;
            }

            //hiddenVal 0 è non specificato, 1 è sovrascrivi, 2 è mantieni
            var res = { result: true, hiddenVal: 0 };
            var nomeFotoAttuale = "";
            var FotoImpaginata = null;
            var nomeFotoOld = "";
            var canaleDiInvio = ficoProcess.getCanaleLavorazioneCorrente();
            var tracciatoCanale = canaleDiInvio.sigla;
            var areaDiInvio = ficoProcess.getAreaLavorazioneCorrente();
            var tracciatoArea = areaDiInvio.sigla;

            let element = null;

            if (this.schedeRefDati != null && !codice.includes(",")) { //se il codice è un gruppo stiamo passando una foto extra e non c'è bisogno di questo passaggio
                //troviamo l'elemento in datiRefInEsame con lo stesso codice
                element = this.schedeRefDati.find(f => f.recordInTracciato["Referenza.Codice"] == codice);
                if (tipo == 1) {
                    nomeFotoOld = element.recordInTracciato["Foto.Nome"];
                }
                else {
                    var extraGiaPresente = element.recordInTracciato["Foto.Extra"].find(f => f.tipo == tipo && f.NomeReale == fd.nomeFile);
                    if (extraGiaPresente != null) {
                        nomeFotoOld = fd.nomeFile;
                    }
                }
                if (element == null) {
                    messaggioUtente("Code SRF-65 Errore, dissincronia tra la referenza selezionata e quella che si sta provando a modificare", "error");
                    return;
                }
                nomeFotoAttuale = element.recordInTracciato["Foto.Nome"];

                for (var i = 0; i < box.allPageItems.length; i++) {
                    var item = box.allPageItems[i];
                    if (item.label.startsWith((pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? pluginMiddleware.getCampo("nomeFotoPrimaria") : "foto") ) || item.label.startsWith( (pluginMiddleware.getCampo("nomeFotoSecondaria") !== null ? pluginMiddleware.getCampo("nomeFotoSecondaria") : "foto") )) {
                        if (item.graphics.item(0).itemLink.name == nomeFotoAttuale) {
                            FotoImpaginata = item;
                            break;
                        }
                    }
                }

                if (!validaSoloPerLavorazione) {
                    res = await me.richiediMetodoUploadDaRiscontri(
                        fd.nomeFile,
                        fotoList,
                        tracciatoArea,
                        tracciatoCanale,
                        nomeFotoAttuale
                    );

                    if (res.result == false) {
                        return;
                    }
                }
            }
            else {
                var primario = this.schedeRefDati.find(f => f.recordInTracciato["StatoSelezione"] == 1);
                if (primario == null) {
                    messaggioUtente("Code SRF-66 Nessun elemento primario trovato", "error");
                    return;
                }
                //se siamo qua è per forza per una foto extra poichè le foto vengono aggiornate solo ai singoli
                var extraGiaPresente = primario.recordInTracciato["Foto.Extra"].find(f => f.tipo == tipo && f.NomeReale == fd.nomeFile);
                if (extraGiaPresente != null) {
                    nomeFotoOld = fd.nomeFile;
                }
            }

            var obj = {
                "nomeFile": fd.nomeFile,
                "file": fd.file,
                "codice": codice,
                "tipo": tipo
            };
            for (var i = 0; i < box.allPageItems.length; i++) {
                var item = box.allPageItems[i];
                if (item.label == 'foto_extra$' + fd.nomeFile + '$tipo_' + tipo) {
                    messaggioUtente("Code SRF-67 L'immagine è già presente nel box", "warning", false, 5);
                    return;
                }
            }

            var formData = new FormData();
            formData.append("nomeFile", fd.nomeFile);
            formData.append("file", fd.file);
            formData.append("codice", codice);
            formData.append("tipo", obj.tipo);
            formData.append("area", area);
            formData.append("canale", canale);
            formData.append("tracciatoCanale", tracciatoCanale);
            formData.append("tracciatoArea", tracciatoArea);
            formData.append("idLavorazione", idKitLavorazione);
            if (validaSoloPerLavorazione) {
                formData.append("uploadMethod", 3);
            }
            else {
                formData.append("uploadMethod", res.hiddenVal);
            }
            formData.append("nomeFileOld", nomeFotoOld);
            formData.append("idRec", element != null ? element.idRec : 0);
            console.log(obj);
            messaggioUtente("Code SRF-68: Richiesta inviata", "success", true, 3, true);
            showLoading("Caricamento immagine in corso...");
            indesignEvents.setBusy(true);
            var xhr = new XMLHttpRequestClient();
            xhr.onload = async (data, parsed) => {
                try {
                    if (data.error != null && data.error != "") {
                        messaggioUtente("Code SRF-69: " + data.error, "error");
                    }
                    if (data.esito == false) {
                        return;
                    }
                    console.log("Success");
                    console.log(data);
                    //inserisco nella cartella links la foto

                    //I20-967: l'impaginazione deve partire a scrittura conclusa, altrimenti il file non e'
                    //ancora nella cartella e viene impaginato il segnaposto di foto non trovata.
                    //Il file va scritto col nome deciso dal server: con uploadMethod "mantieni" il server
                    //rinomina la foto, e copiarla col nome locale lascerebbe in cartella la vecchia omonima.
                    var copiaRiuscita = false;
                    try {
                        await ReperimentoFoto.scriviFileInCartella(fd.file, /*pathLavorazione +*/ (obj.tipo != 1 ? percorsoLoghi : percorsoLinks), data.nomeReale);
                        copiaRiuscita = true;
                        console.log("fine copia");
                    }
                    catch (e) {
                        console.log("Copia della foto nella cartella fallita: " + e);
                    }

                    if (!copiaRiuscita && obj.tipo == 1) {
                        //La copia locale non e' riuscita: recuperiamo comunque il file dal server prima di impaginare.
                        await ReperimentoFoto.assicuraFotoNeiLinks(data.nomeReale, data.guidId);
                    }

                    if (obj.tipo != 1) {
                        //cerchiamo se l'immagine è già presente nel box, se lo è non eseguiamo l'impaginazione
                        let rebindData = { nome: data.nomeReale, tipo: data.tipo, guidId: data.guidId, attiva: true };
                        if (element != null) {
                            element.recordInTracciato["Foto.Extra"].push(rebindData);
                        }
                        else {
                            me.schedeRefDati.forEach(obj => {
                                obj.recordInTracciato["Foto.Extra"].push(rebindData);
                            });
                        }
                        
                        box = me.impaginaFotoExtra(data.nomeReale, obj.tipo, box, pathLavorazione, element != null ? element.recordInTracciato : null, null);
                    }
                    else {

                        //box = me.placeFoto(obj.nomeFile, box, FotoImpaginata, codice);
                        //agiorniamo il nome della foto in element
                        if (element != null) {
                            if(element.recordInTracciato.StatoSelezione!=3){
                                //I20-967: si impagina il nome deciso dal server, non quello del file locale:
                                //quando il server rinomina, il nome locale punta alla vecchia foto omonima
                                //rimasta in cartella e sulla pagina resterebbe l'immagine precedente.
                                let result = await ReperimentoFoto.impaginaFotoAppenaDisponibile(data.nomeReale, box, FotoImpaginata, codice, element.recordInTracciato.StatoSelezione);
                                box = result.box;
                                FotoImpaginata = result.fotoRectangle;
                            }
                            element.recordInTracciato["Foto.Nome"] = data.nomeReale;
                            element.recordInTracciato["Foto.guidid"] = data.guidId;
                            element.recordInTracciato["Foto.Id"] = data.id;
                            element.recordInTracciato["Foto.Hash"] = data.Hash || data.hash;
                            element.recordInTracciato["Foto.IsMeta"] = validaSoloPerLavorazione;
                        }
                        await me.EditFotoPrimarieSecondarie(box);

                    }
                }
                catch (e) {
                    console.log(e);
                    messaggioUtente("Code SRF-70: Errore generico durante l'upload dell'immagine: " + e, "error");
                }
                finally {
                    hideLoading();
                    indesignEvents.setBusy(false);
                }
            }
            xhr.onreadystatechange = function () { }
            xhr.onerror = function () {
                console.error("Errore di rete durante l'upload dell'immagine");
                messaggioUtente("Code SRF-70.5: Errore di rete durante l'upload dell'immagine", "error");
                hideLoading();
                indesignEvents.setBusy(false);
            }
            xhr.sendFiles("SyncFoto/updateFotoFromIndd" + "/" + 0, formData);
        }
        catch (e) {
            console.error(e);
            messaggioUtente("Code SRF-71: Errore generico durante l'upload dell'immagine: " + e, "error");
            hideLoading();
            indesignEvents.setBusy(false);
        }
    },

    async updateImmagineEsistente(codice, area, canale, validaSoloPerLavorazione, id, fotoList = []) {
        try {
            

            var canaleDiInvio = ficoProcess.getCanaleLavorazioneCorrente();
            if (canaleDiInvio == null) {
                messaggioUtente("Code SRF-72 Canale di lavorazione corrente non trovato", "error");
                return false;
            }

            var tracciatoCanale = canaleDiInvio.sigla;

            var areaDiInvio = ficoProcess.getAreaLavorazioneCorrente();
            if (areaDiInvio == null) {
                messaggioUtente("Code SRF-73 Area di lavorazione corrente non trovata", "error");
                return false;
            }

            var tracciatoArea = areaDiInvio.sigla;


            var box = this.refSelected.item;
            let me = this;
            console.log(codice);

            var nomeFotoAttuale = "";
            var FotoImpaginata = null;
            const fotoSelezionata = Array.isArray(fotoList)
                ? fotoList.find(item => item != null && item.Id != null && id != null && String(item.Id) === String(id))
                : null;
            const propaga = fotoSelezionata != null && !me.fotoInContestoLavorazione(fotoSelezionata, tracciatoArea, tracciatoCanale);

            let element = null;

            if (this.schedeRefDati != null && !codice.includes(",")) { //se il codice è un gruppo stiamo passando una foto extra e non c'è bisogno di questo passaggio
                //troviamo l'elemento in datiRefInEsame con lo stesso codice
                element = this.schedeRefDati.find(f => f.recordInTracciato["Referenza.Codice"] == codice);
                
                nomeFotoOld = element.recordInTracciato["Foto.Nome"];
                

                if (element == null) {
                    messaggioUtente("Code SRF-74: Errore, dissincronia tra la referenza selezionata e quella che si sta provando a modificare", "error");
                    return;
                }
                nomeFotoAttuale = element.recordInTracciato["Foto.Nome"];

                for (var i = 0; i < box.allPageItems.length; i++) {
                    var item = box.allPageItems[i];
                    if (item.label.startsWith((pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? pluginMiddleware.getCampo("nomeFotoPrimaria") : "foto")) || item.label.startsWith((pluginMiddleware.getCampo("nomeFotoSecondaria") !== null ? pluginMiddleware.getCampo("nomeFotoSecondaria") : "foto"))) {
                        if (item.graphics.item(0).itemLink.name == nomeFotoAttuale) {
                            FotoImpaginata = item;
                            break;
                        }
                    }
                }
            }

            var formData = new FormData();
            formData.append("Codice", codice != null ? codice : "");
            formData.append("scopeArea", area != null ? area : "");
            formData.append("scopeCanale", canale != null ? canale : "");
            formData.append("tracciatoArea", tracciatoArea != null ? tracciatoArea : "");
            formData.append("tracciatoCanale", tracciatoCanale != null ? tracciatoCanale : "");
            formData.append("Id", id != null ? id : "");
            formData.append("validaSoloPerLavorazione", validaSoloPerLavorazione ? "true" : "false");
            formData.append("idLavorazione", idKitLavorazione);
            formData.append("propaga", propaga ? "true" : "false");


            return await new Promise((resolve) => {
                var xhr = new XMLHttpRequestClient();

                xhr.onload = async (objResult, parsed) => {
                    try {
                        if (!parsed) {
                            try {
                                objResult = JSON.parse(objResult);
                            } catch (e) {
                                messaggioUtente("Code SRF-75: Errore durante il parsing della risposta: " + e, "error");
                                resolve(false);
                                return;
                            }
                        }

                        if (objResult != null && !objResult.esito) {
                            messaggioUtente("Code SRF-76: Errore durante l'aggiornamento della foto esistente: " + objResult.error, "error");
                        }

                        if (box == null || !box.isValid) {
                            messaggioUtente("Code SRF-77: Box non trovato o non valido", "error");
                            resolve(false);
                            return;
                        }

                        //box = me.placeFoto(objResult.nomeReale, box, FotoImpaginata, codice);
                        //agiorniamo il nome della foto in element
                        if (element != null) {
                            if (element.recordInTracciato.StatoSelezione != 3) {
                                //I20-967: la foto scelta dall'archivio puo' non essere nei Links. La scarichiamo
                                //qui, prima di impaginarla, cosi' all'operatore non resta nessun passaggio manuale.
                                await ReperimentoFoto.assicuraFotoNeiLinks(objResult.nomeReale, objResult.guidId);

                                let result = await ReperimentoFoto.impaginaFotoAppenaDisponibile(objResult.nomeReale, box, FotoImpaginata, codice);
                                box = result.box;
                                FotoImpaginata = result.fotoRectangle;
                            }
                            element.recordInTracciato["Foto.Nome"] = objResult.nomeReale;
                            element.recordInTracciato["Foto.guidid"] = objResult.guidId;
                            element.recordInTracciato["Foto.Id"] = objResult.id;
                            element.recordInTracciato["Foto.Hash"] = objResult.Hash || objResult.hash;

                            element.recordInTracciato["Foto.IsMeta"] = validaSoloPerLavorazione;
                        }
                        await me.EditFotoPrimarieSecondarie(box);


                        resolve(true);
                    } catch (e) {
                        console.error(e);
                        resolve(false);
                    }
                };

                xhr.onerror = function (e) {
                    console.error(e);
                    messaggioUtente("Code SRF-78: Errore di rete durante l'aggiornamento della foto esistente", "error");
                    resolve(false);
                };
                

                xhr.send("SyncFoto/updateImmagineEsistente/"+0, formData, "PUT");
            });
        } catch (e) {
            console.error(e);
            messaggioUtente("Code SRF-79: Errore generico durante la preparazione dell'aggiornamento della foto esistente", "error");
            return false;
        }
    },

    async linkLogoBollo(tipo) {
        let me = this;
        var box = this.refSelected.item;

        if (box == null || box.isValid == null || !box.isValid) {
            await Modali.popup(
                "Nessun elemento selezionato",
                "Per collegare un logo bollo è necessario selezionare un elemento in pagina."
            );
            return;
        }
        showLoading("Scaricamento dati...");
        await Utility.sleep(10);

        getLoghiBolliData((objResult) => {
            hideLoading();

            Modali.apriModal('dialogLinkLogoBollo', 'Seleziona immagine', true, [], true);

            const $body = $('#bodyLinkLogoBollo');
            $body.empty();

            if (!Array.isArray(objResult) || objResult.length === 0) {
                $body.html('<div>Nessuna immagine disponibile</div>');
                return;
            }

            //rimuoviamo da objResult tutti gli elementi con il tipo diverso da quello passato come parametro
            objResult = objResult.filter(item => item.tipo == tipo);

            for (let i = 0; i < objResult.length; i += 2) {


                const $row = $(`
                <div style="
                    display:flex;
                    width:100%;
                    margin-bottom:10px;
                "></div>
            `);

                for (let j = i; j < i + 2 && j < objResult.length; j++) {
                    const item = objResult[j];
                    const thumbUrl = olimpoIp + 'getThumbNailOnDemand?width=60&guidId=' + encodeURIComponent(item.id);

                    const $cell = $(`
                    <div class="row-link-logo-bollo" style="
                        width:50%;
                        display:flex;
                        flex-direction:column;
                        align-items:center;
                        justify-content:center;
                        padding:6px;
                        box-sizing:border-box;
                        margin-bottom:5px;
                    ">
                        <img src="${thumbUrl}" style="width:60px; height:auto; margin-bottom:6px;">
                        <button type="button" class="btn-link-logo-bollo">Aggiungi</button>
                    </div>
                `);

                    $cell.data('logoBollo', {
                        id: item.id,
                        fileHash: item.fileHash,
                        fileName: item.fileName,
                        idRef: item.idRef,
                        size: item.size,
                    });

                    $row.append($cell);
                }

                if (i + 1 >= objResult.length) {
                    $row.append(`
                    <div style="
                        width:50%;
                        box-sizing:border-box;
                    "></div>
                `);
                }

                $body.append($row);
            }

            $(document).off('click', '.btn-link-logo-bollo').on('click', '.btn-link-logo-bollo', async function () {
                const $cell = $(this).closest('.row-link-logo-bollo');
                const logoData = $cell.data('logoBollo');

                if (logoData == null) {
                    return;
                }

                const res = await Modali.confirm(`Confermi il collegamento del logo "${logoData.fileName}"?`);
                if (!res) {
                    return;
                }

                var schedaRef = me.schedeRefDati;

                var primario = schedaRef.find(f => f.recordInTracciato.StatoSelezione == 1);
                if (primario == null) {
                    await Modali.popup(
                        "Nessun elemento primario trovato",
                        "Non è stato possibile trovare un elemento primario selezionato."
                    );
                    Modali.closeAllModal();
                    return;
                }

                try {
                    const folder = await fs2.getEntryWithUrl("file://" + /*pathLavorazione +*/ percorsoLoghi);
                    const entries = await folder.getEntries();

                    let fileEntry = null;

                    for (const entry of entries) {
                        if (!entry.isFile) {
                            continue;
                        }

                        if (entry.name === logoData.fileName) {
                            fileEntry = entry;
                            break;
                        }
                    }

                    if (fileEntry == null) {
                        await Modali.popup(
                            "Logo non disponibile",
                            `Il logo "${logoData.fileName}" non è stato scaricato. Effettua una syncFoto e riprova.`
                        );
                        Modali.closeAllModal();
                        return;
                    }

                    const data = await fileEntry.read({ format: uxp.storage.formats.binary });
                    const byteArray = new Uint8Array(data);
                    const localMd5 = scaricamentoFoto.md5ArrayBuffer(byteArray);

                    if (localMd5 !== logoData.fileHash) {
                        await Modali.popup(
                            "Logo non aggiornato",
                            `Il logo "${logoData.fileName}" non è aggiornato. Effettua una syncFoto e riprova.`
                        );
                        Modali.closeAllModal();
                        return;
                    }

                    // QUI POI PROSEGUIRÀ LA LOGICA SUCCESSIVA
                    console.log("Logo trovato e aggiornato:", logoData);

                    var xhr = new XMLHttpRequestClient();
                    xhr.onload = async (objResult, parsed) => {
                        console.log(objResult);
                        if (!parsed) {
                            try {
                                objResult = JSON.parse(objResult);
                            }
                            catch (e) {
                                messaggioUtente("Code SRF-51 Errore durante il parsing della risposta:" + e, "error");
                                return;
                            }
                        }

                        if (objResult.esito != null && !objResult.esito) {
                            messaggioUtente("Code SRF-52 Errore durante il collegamento del logo: " + objResult.error, "error");
                            return;
                        }


                        if (box == null || box.isValid == null || !box.isValid) {
                            messaggioUtente("Code SRF-53 Box selezionato non valido, l'elemento è stato correttamente linkato ma non verrà impaginato", "error");
                            return;
                        }

                        let rebindData = { nome: objResult.nomeReale, tipo: objResult.tipo, guidId: objResult.guidId, attiva: true, puntatore: false, sigla: objResult.pathFoto };
                        me.schedeRefDati.forEach(obj => {
                            obj.recordInTracciato["Foto.Extra"].push(rebindData);
                        });

                        //dobbiamo impaginare il logo 
                        me.impaginaFotoExtra(objResult.nomeReale, parseInt(objResult.tipo), me.refSelected.item, pathLavorazione, primario.recordInTracciato, objResult.pathFoto);


                    }

                    xhr.onreadystatechange = function () {
                        console.log(xhr);
                    };

                    xhr.onerror = function () {
                        console.log("error");
                    };

                    xhr.onNoConnection = async function () {
                    }


                    var formData = new FormData();


                    formData.append("guidId", logoData.id); //quello va letto dall'elemento della lista che abbiamo scaricato prima
                    formData.append("nomeReale", logoData.fileName) //quello va letto dall'elemento della lista che abbiamo scaricato prima
                    formData.append("fileHash", logoData.fileHash) //quello va letto dall'elemento della lista che abbiamo scaricato prima
                    formData.append("codiceReferenza", primario.recordInTracciato["Referenza.Codice"]); //quello va letto dalla referenza del primario

                    xhr.send("SyncFoto/linkLogoBollo/", formData, "PUT");

                } catch (ex) {
                    console.error(ex);
                    await Modali.popup(
                        "Errore",
                        "Si è verificato un errore durante il controllo del logo."
                    );
                    Modali.closeAllModal();
                }
            });
        });
    },

    impaginaFotoExtra(fotoExtraNome, FotoExtraTipo, box, pathLavorazione, objItem, sigla = null) {
        try{
            if (sigla == null) {
                sigla = fotoExtraNome;
            }
            var nuovoElImpaginato = null;
            if (customAgenzia.impaginazioneFotoExtraCustom != null) {
                nuovoElImpaginato = customAgenzia.impaginazioneFotoExtraCustom(fotoExtraNome, FotoExtraTipo, box, pathLavorazione, objItem, sigla)
            }
            var path = /*pathLavorazione +*/ percorsoLoghi + fotoExtraNome;
            var myPage = box.parentPage;
            var doc = docInLavorazione;
    
            if (nuovoElImpaginato == null) {
    
                nuovoElImpaginato = myPage.rectangles.add(doc.layers.itemByName("InPagina"), LocationOptions.UNKNOWN, box, { geometricBounds: box.geometricBounds })
                nuovoElImpaginato.label = "foto_extra$" + sigla + "$tipo_" + FotoExtraTipo;
                nuovoElImpaginato.place(path);
                nuovoElImpaginato.fit(FitOptions.FRAME_TO_CONTENT);
                nuovoElImpaginato.fillColor = "None";
    
            }
    
    
    
            var oldGroup = box;
            var oldLabel = oldGroup.label;
            var oldItems = oldGroup.pageItems.everyItem().getElements();
            oldGroup.ungroup();
    
            var newItems = oldItems.concat(nuovoElImpaginato);
            var masterGroup = myPage.groups.add(newItems);
            masterGroup.label = oldLabel;
            app.selection = [masterGroup];
            nuovoElImpaginato.bringToFront();
            this.refSelected.item = masterGroup;
    
            this.FotoExtraPanel(masterGroup);
            return masterGroup;
        }
        catch(ex){
            //diciamo che sigla non è stato trovata nella cartella loghi
            console.error(ex);
            messaggioUtente("Code SRF-40 Foto extra "+ fotoExtraNome + " non trovata in " + /*pathLavorazione +*/ percorsoLoghi, "error");
            return false;
        }

    },

    attivaDisattivaFotoExtra(guidId, tipo, nomeFoto, box, attiva, sigla = null) {
        let me = this;

        var xhr = new XMLHttpRequestClient();
        xhr.onload = (objResult, parsed) => {
            try {
                if (!parsed) {
                    try {
                        objResult = JSON.parse(objResult);
                    }
                    catch (e) {
                        messaggioUtente("Code SRF-41 Errore durante il parsing della risposta: " + e, "error");
                        return;
                    }
                }
                console.log(objResult);
                //mi dovrebbe tornare un oggetto con due parametri, esito, error
                if (!objResult.esito) {
                    messaggioUtente("Code SRF-42 Errore durante il salvataggio delle modifiche: " + objResult.error, "error");
                    return;
                }

                if (objResult.error != null && objResult.error != "") {
                    messaggioUtente("Code SRF-43 Operazione terminata con successo ma è stato registrato l'errore: " + objResult.error, "warning");
                }

                let schedaRef = this.schedeRefDati;
                //troviamo il primario
                var primario = schedaRef.find(f => f.recordInTracciato.StatoSelezione == 1);
                if (attiva) {
                    if (schedaRef != null) {
                        for (var i = 0; i < schedaRef.length; i++) {
                            var element = schedaRef[i];
                            var fotoExtraDaAttivare = element.recordInTracciato["Foto.Extra"].find(f => f.guidId == guidId);
                            if (fotoExtraDaAttivare != null) {
                                fotoExtraDaAttivare.attiva = true;
                            }
                        }
                    }
                    //cerchiamo nel box se c'è già una foto con lo stesso nomeFoto e tipo
                    var fotoExtraPresente = null;
                    for (var $box = 0; $box < box.allPageItems.length; $box++) {
                        var item = box.allPageItems[$box];
                        if (item.label.startsWith("foto_extra$" + (sigla == null ? nomeFoto : sigla) + "$tipo_" + tipo)) {
                            fotoExtraPresente = item;
                            break;
                        }
                    }

                    if (fotoExtraPresente == null) {
                        box = this.impaginaFotoExtra(nomeFoto, tipo, box, pathLavorazione, primario.recordInTracciato, sigla);
                    }
                }
                else {
                    let schedaRef = this.schedeRefDati;
                    //troviamo il primario

                    if (schedaRef != null) {
                        for (var i = 0; i < schedaRef.length; i++) {
                            var element = schedaRef[i];
                            var fotoExtraDaDisattivare = element.recordInTracciato["Foto.Extra"].find(f => f.guidId == guidId);
                            if (fotoExtraDaDisattivare != null) {
                                fotoExtraDaDisattivare.attiva = false;
                            }
                        }
                    }

                    me.eliminaFotoNelBox(nomeFoto, tipo, box, sigla);
                }

            }
            catch (e) {
                messaggioUtente("Code SRF-44 Errore generico: " + e, "error");
            }
        };

        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                    messaggioUtente("Code SRF-45 Richiesta completata con successo", "success", false, 1);
                } else {
                }
            }
        };

        xhr.onerror = function () {
            messaggioUtente("Code SRF-46 Errore di rete", "error");
        }
        xhr.send("SyncFoto/attivaDisattivaFotoExtra/" + guidId + "/" + attiva, null, "GET");


    },

    escludiIncludiFotoExtraAuto(nomeFoto, attualmenteEscluso, box, row, tipo, sigla) {
        var schedaRef = this.schedeRefDati;
        let me = this;
        var primario = schedaRef.find(f => f.recordInTracciato.StatoSelezione == 1);
        //attualmenteEscluso è un booleano ma arriva come stringa per cui va fatto prima un cast
        attualmenteEscluso = attualmenteEscluso == "true" ? true : false;
        //se l'esito è positivo cerchiamo nel box un elemento con label uguale a foto_extra$nomeFoto e lo rimuoviamo
        
        if (attualmenteEscluso) {
            
            var box = me.impaginaFotoExtra(nomeFoto, parseInt(tipo), box, pathLavorazione, primario.recordInTracciato, sigla);
            if (box == null) {
                return;
            }
        }
        else {
            for (var i = 0; i < box.allPageItems.length; i++) {
                var el = box.allPageItems[i];
                if (el.label == "foto_extra$" + sigla + "$tipo_" + tipo) {
                    boundsElementToRemove = el.geometricBounds;
                    el.remove();
                    break;
                }
            }
        }
        var xhr = new XMLHttpRequestClient();
        xhr.onload = (objResult, parsed) => {
            try {
                if (!parsed) {
                    try {
                        objResult = JSON.parse(objResult);
                    }
                    catch (e) {
                        messaggioUtente("Code SRF-54 Errore durante il parsing della risposta: " + e, "error");
                        return;
                    }
                }
                console.log(objResult);
                //mi dovrebbe tornare un oggetto con due parametri, esito, error
                if (!objResult.esito) {
                    messaggioUtente("Code SRF-55 Errore durante il salvataggio delle modifiche: " + objResult.error, "error");
                    return;
                }

                if (objResult.error != null && objResult.error != "") {
                    messaggioUtente("Code SRF-56 Operazione terminata con successo ma è stato registrato l'errore: " + objResult.error, "warning");
                }
                //modifichiamo il colore del bottone in tomato e la scritta in escluso
                // var button = row.find("button");
                // console.log(button);
                // console.log(button.attr("id"));
                // console.log(row.attr("escluso"));
                // console.log(button.text());
                // button.text(!attualmenteEscluso ? "Includi" : "Escludi");
                // console.log(button.text());
                // row.attr("escluso", !attualmenteEscluso);
                // console.log(row.attr("escluso"));

                //cerchiamo nel primario la foto extra auto con nome uguale a nomeFoto e tipo uguale a tipo e aggiorniamo il suo stato di esclusione
                var fotoExtra = primario.recordInTracciato["Foto.ExtraAuto"].find(f => f.sigla == sigla && f.tipo == tipo);
                if (fotoExtra != null) {
                    fotoExtra.escluso = !attualmenteEscluso;
                }

                me.FotoExtraPanel(box);


            }
            catch (e) {
                messaggioUtente("Code SRF-57 Errore generico: " + e, "error");
            }
        };

        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                    messaggioUtente("Code SRF-58 Richiesta completata con successo", "success", false, 5);
                } else {
                }
            }
        };

        xhr.onerror = function () {
            messaggioUtente("Code SRF-59 Errore di rete", "error");
        }
        //recuperiamo il codice gruppo dell'elemento
        var CodiceGruppo = schedaRef.find(f => f.recordInTracciato.StatoSelezione == 1).recordInTracciato["Scatto.CodiceGruppo"];
        var formData = new FormData();
        formData.append("codiceGruppo", CodiceGruppo);
        formData.append("nomeFoto", nomeFoto);
        xhr.send("SyncFoto/escludiIncludiFotoExtraAuto/" + !attualmenteEscluso, formData, "PUT");
        messaggioUtente("Code SRF-60 Richiesta inviata", "success", true, 3, true);
    },

    resetFotoPS() {
        $("#cambiaPS").empty();
        $("#pulsantiExtra").empty();

    },

    resetFotoExtra() {
        $("#FotoExtra").empty();
        $("#pulsantiExtra").empty();

    },

    async eliminaMetaFoto(codice, tipo = 1) {
        try {
            var box = this.refSelected.item;
            let me = this;
            console.log(codice);

            var nomeFotoAttuale = "";
            var FotoImpaginata = null;

            let element = null;

            if (this.schedeRefDati != null && !codice.includes(",")) { //se il codice è un gruppo stiamo passando una foto extra e non c'è bisogno di questo passaggio
                //troviamo l'elemento in datiRefInEsame con lo stesso codice
                element = this.schedeRefDati.find(f => f.recordInTracciato["Referenza.Codice"] == codice);
                if (tipo == 1) {
                    nomeFotoOld = element.recordInTracciato["Foto.Nome"];
                }

                if (element == null) {
                    messaggioUtente("Code SRF-80: Errore, dissincronia tra la referenza selezionata e quella che si sta provando a modificare", "error");
                    return;
                }
                nomeFotoAttuale = element.recordInTracciato["Foto.Nome"];

                for (var i = 0; i < box.allPageItems.length; i++) {
                    var item = box.allPageItems[i];
                    if (item.label.startsWith((pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? pluginMiddleware.getCampo("nomeFotoPrimaria") : "foto")) || item.label.startsWith((pluginMiddleware.getCampo("nomeFotoSecondaria") !== null ? pluginMiddleware.getCampo("nomeFotoSecondaria") : "foto"))) {
                        if (item.graphics.item(0).itemLink.name == nomeFotoAttuale) {
                            FotoImpaginata = item;
                            break;
                        }
                    }
                }
            }

            // var formData = new FormData();

            // formData.append("codice", codice);
            // formData.append("tipo", tipo);
            // formData.append("idLavorazione", idKitLavorazione);
            // formData.append("idRec", element != null ? element.idRec : 0);
            var idRec = element != null ? element.idRec : 0;
            messaggioUtente("RimuoviMetaFoto: Richiesta inviata", "success", true, 3, true);
            var xhr = new XMLHttpRequestClient();
            xhr.onload = async (data, parsed) => {
                try {
                    if (data.error != null && data.error != "") {
                        messaggioUtente("Code SRF-83: " + data.error, "error");
                    }
                    if (data.esito == false) {
                        return;
                    }
                    console.log("Success");
                    console.log(data);

                    if (tipo != 1) {

                        //DA DEFINIRE
                    }
                    else {

                        //box = me.placeFoto(data.nomeReale, box, FotoImpaginata, codice);
                        let result = FotoPlacer.updateFoto(data.nomeReale, box, FotoImpaginata, codice);
                        box = result.box;
                        FotoImpaginata = result.fotoRectangle;
                        //agiorniamo il nome della foto in element
                        if (element != null) {
                            element.recordInTracciato["Foto.Nome"] = data.nomeReale;
                            element.recordInTracciato["Foto.guidid"] = data.guidId;
                            element.recordInTracciato["Foto.Id"] = data.id;
                            element.recordInTracciato["Foto.IsMeta"] = false;
                            element.recordInTracciato["Foto.Hash"] = data.hash;
                        }
                        await me.EditFotoPrimarieSecondarie(box);
                    }
                }
                catch (e) {
                    console.log(e);
                    messaggioUtente("Code SRF-81: Errore generico durante l'upload dell'immagine: " + e, "error");
                }
            }
            xhr.onreadystatechange = function () { }
            xhr.onerror = function () { }
            xhr.send("SyncFoto/RimuoviFotoDaMeta" + "/" + codice + "/" + tipo + "/" + idKitLavorazione + "/" + idRec + "/" + 0, null, "GET");
        }
        catch (e) {
            console.log(e);
            messaggioUtente("Code SRF-82: Errore generico durante l'upload dell'immagine: " + e, "error");
        }
    },

    eliminaFotoExtra(idFoto, tipo, nomeFoto, box, sigla = null) {
        //mandiamo la richiesta con xhr
        let me = this;
        let schedaRef = this.schedeRefDati;
        //troviamo il primario
        var primario = schedaRef.find(f => f.recordInTracciato.StatoSelezione == 1);

        var formData = new FormData();
        formData.append("nomeFile", nomeFoto);
        formData.append("codice", primario.recordInTracciato["Scatto.CodiceGruppo"]);
        formData.append("tipo", tipo);
        formData.append("idLavorazione", idKitLavorazione);
        formData.append("guidId", idFoto);

        var xhr = new XMLHttpRequestClient();
        xhr.onload = (objResult, parsed) => {
            try {
                if (!parsed) {
                    try {
                        objResult = JSON.parse(objResult);
                    }
                    catch (e) {
                        messaggioUtente("Code SRF-84: Errore durante il parsing della risposta: " + e, "error");
                        return;
                    }
                }
                console.log(objResult);
                //mi dovrebbe tornare un oggetto con due parametri, esito, error
                if (!objResult.esito) {
                    messaggioUtente("Code SRF-85: Errore durante il salvataggio delle modifiche: " + objResult.error, "error");
                    return;
                }

                if (objResult.error != null && objResult.error != "") {
                    messaggioUtente("Code SRF-86: Operazione terminata con successo ma è stato registrato l'errore: " + objResult.error, "warning");
                }

                let schedaRef = this.schedeRefDati;
                //troviamo il primario

                if (schedaRef != null) {
                    for (var i = 0; i < schedaRef.length; i++) {
                        var element = schedaRef[i];
                        var fotoExtraToRemove = element.recordInTracciato["Foto.Extra"].find(f => f.guidId == idFoto);
                        if (fotoExtraToRemove != null) {
                            element.recordInTracciato["Foto.Extra"].splice(element.recordInTracciato["Foto.Extra"].indexOf(fotoExtraToRemove), 1);
                        }
                    }
                }
                //var altriBollini = [];
                me.eliminaFotoNelBox(nomeFoto, tipo, box, sigla);

                //me.FotoExtraPanel();

            }
            catch (e) {
                messaggioUtente("Code SRF-87: Errore generico durante l'eliminazione della foto extra: " + e, "error");
            }
        };

        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                    messaggioUtente("Code SRF-88: Richiesta completata con successo", "success", false, 5);
                } else {
                    //messaggioUtente("eliminaFotoExtra: Errore durante la richiesta: " + xhr.status, "error");
                }
            }
        };

        xhr.onerror = function () {
            //messaggioUtente("eliminaFotoExtra: Errore di rete", "error");
        }

        xhr.send("SyncFoto/RimuoviFoto/" + 0, formData, "PUT");
        messaggioUtente("eliminaFotoExtra: Richiesta inviata", "success", true, 3, true);

    },

    eliminaFotoNelBox(nomeFoto, tipo, box, sigla = null) {

        if (sigla != null) {
            nomeFoto = sigla;
        }

        for (var i = 0; i < box.allPageItems.length; i++) {
            if (box.allPageItems[i].label == "foto_extra$" + nomeFoto + "$tipo_" + tipo) {
                box.allPageItems[i].remove();
            }
        }

        this.FotoExtraPanel(box);
    },

    /// Fra i candidati vince sempre il psd, e a parita' di formato il piu' recente.
    scegliCandidatoFoto(fileInCartella, codiceReferenza) {
        var me = this;
        var candidati = this.candidatiPerReferenza(fileInCartella, codiceReferenza);

        if (candidati.length === 0) {
            return null;
        }

        var ordinati = candidati.slice().sort(function (a, b) {
            var psdA = me.partiDelNomeFile(a.nome).estensione === "psd";
            var psdB = me.partiDelNomeFile(b.nome).estensione === "psd";

            if (psdA !== psdB) {
                return psdA ? -1 : 1;
            }

            return (b.modificato || 0) - (a.modificato || 0);
        });

        return ordinati[0];
    },

    /// Perche' proporre il candidato invece di aprire subito lo sfoglia, oppure null se non
    /// c'e' motivo. I tre casi sono quelli chiesti dall'operatore, valutati in quest'ordine.
    ///
    /// hashLocale va calcolato solo quando il nome del candidato coincide con quello della
    /// foto del box: leggere un psd da centinaia di megabyte a ogni clic, per gli altri due
    /// casi che si decidono sui soli nomi, sarebbe un costo inutile.,

    /// Perche' proporre il candidato invece di aprire subito lo sfoglia, oppure null se non
    /// c'e' motivo. I tre casi sono quelli chiesti dall'operatore, valutati in quest'ordine.
    ///
    /// hashLocale va calcolato solo quando il nome del candidato coincide con quello della
    /// foto del box: leggere un psd da centinaia di megabyte a ogni clic, per gli altri due
    /// casi che si decidono sui soli nomi, sarebbe un costo inutile.
    motivoPropostaFoto(candidato, fotoDelBox, fotoDelServer, hashLocale) {
        if (candidato == null || typeof candidato.nome !== "string" || candidato.nome === "") {
            return null;
        }

        var elencoServer = Array.isArray(fotoDelServer) ? fotoDelServer : [];
        var nomeBox = fotoDelBox != null && fotoDelBox.nome != null ? String(fotoDelBox.nome) : "";
        var maiuscolo = function (testo) { return testo != null ? String(testo).toUpperCase() : ""; };

        //Uno: stesso nome, ma il file in cartella non e' piu' quello impaginato.
        if (nomeBox !== "" && candidato.nome === nomeBox && hashLocale != null && hashLocale !== "") {
            var hashBox = fotoDelBox.hash;
            if (hashBox != null && hashBox !== "" && maiuscolo(hashBox) !== maiuscolo(hashLocale)) {
                return "hashDiverso";
            }
        }

        //Due: il server non conosce questa foto, o il box non ne ha nessuna, ma in cartella c'e'.
        var conosciutaDalServer = nomeBox !== "" && elencoServer.some(function (foto) {
            return foto != null && String(foto.nome) === nomeBox;
        });

        if (nomeBox === "" || !conosciutaDalServer) {
            return "nonSulServer";
        }

        //Tre: in cartella c'e' il psd, sul server no.
        //
        //A fermare la proposta e' solo il psd della stessa foto, non un psd qualsiasi: un altro
        //scatto della stessa referenza salvato in psd non c'entra nulla con quello che
        //l'operatore sta sostituendo, e bloccherebbe la proposta proprio quando serve.
        if (this.partiDelNomeFile(candidato.nome).estensione === "psd") {
            var radiceBox = this.partiDelNomeFile(nomeBox).base.toUpperCase();
            //I20-1015: dentro la callback this non e' la scheda. In schedaRef.js si usava il nome
            //del modulo, che in questo file non c'e'.
            var me = this;
            var psdGiaSulServer = elencoServer.some(function (foto) {
                if (foto == null) {
                    return false;
                }
                var parti = me.partiDelNomeFile(foto.nome);
                return parti.estensione === "psd" && parti.base.toUpperCase() === radiceBox;
            });

            if (!psdGiaSulServer) {
                return "psdSoloInCartella";
            }
        }

        return null;
    },

    /// I20-980: il file della cartella Links che potrebbe essere la foto cercata, proposto
    /// all'operatore prima di aprire lo sfoglia.
    ///
    /// Torna lo stesso oggetto che tornerebbe la scelta dal dialogo, cosi' chi lo riceve non
    /// distingue fra una foto confermata qui e una scelta a mano. Torna null quando non c'e'
    /// niente da proporre, quando l'operatore risponde di no, e ogni volta che qualcosa va
    /// storto: in tutti quei casi si apre lo sfoglia, che e' la strada di sempre.,

    /// I20-980: il file della cartella Links che potrebbe essere la foto cercata, proposto
    /// all'operatore prima di aprire lo sfoglia.
    ///
    /// Torna lo stesso oggetto che tornerebbe la scelta dal dialogo, cosi' chi lo riceve non
    /// distingue fra una foto confermata qui e una scelta a mano. Torna null quando non c'e'
    /// niente da proporre, quando l'operatore risponde di no, e ogni volta che qualcosa va
    /// storto: in tutti quei casi si apre lo sfoglia, che e' la strada di sempre.
    async fotoDaProporreDallaCartella(codiceReferenza, fotoDelBox, fotoDelServer) {
        try {
            var urlCartella = this.urlDiPercorso(percorsoLinks);
            if (urlCartella == null) {
                return null;
            }

            var cartella = await fs2.getEntryWithUrl(urlCartella);
            var voci = await cartella.getEntries();
            var fileInCartella = [];

            for (var i = 0; i < voci.length; i++) {
                var voce = voci[i];
                if (!voce.isFile) {
                    continue;
                }

                var quando = 0;
                var quanto = 0;
                try {
                    var dati = await voce.getMetadata();
                    quando = dati != null && dati.dateModified != null ? new Date(dati.dateModified).getTime() : 0;
                    quanto = dati != null && dati.size != null ? dati.size : 0;
                }
                catch (e) {
                    //Senza metadati il file resta candidato, semplicemente non vince per data.
                }

                fileInCartella.push({ nome: voce.name, modificato: quando, dimensione: quanto, voce: voce });
            }

            var candidato = this.scegliCandidatoFoto(fileInCartella, codiceReferenza);
            if (candidato == null) {
                return null;
            }

            var nomeBox = fotoDelBox != null && fotoDelBox.nome != null ? String(fotoDelBox.nome) : "";
            var contenuto = null;
            var hashLocale = null;

            //Il file si legge solo quando serve l'hash, cioe' quando il nome coincide: negli
            //altri casi la decisione si prende sui soli nomi e un psd grosso non va letto.
            if (candidato.nome === nomeBox) {
                contenuto = await candidato.voce.read({ format: uxp.storage.formats.binary });
                hashLocale = scaricamentoFoto.md5ArrayBuffer(new Uint8Array(contenuto));
            }

            var motivo = this.motivoPropostaFoto(candidato, fotoDelBox, fotoDelServer, hashLocale);
            if (motivo == null) {
                return null;
            }

            if (contenuto == null) {
                contenuto = await candidato.voce.read({ format: uxp.storage.formats.binary });
            }

            var conferma = await Modali.confirm(
                this.riquadroPropostaFoto(candidato, contenuto, motivo));

            if (!conferma) {
                return null;
            }

            return {
                nomeFile: candidato.nome,
                file: contenuto,
                filePath: candidato.voce.nativePath
            };
        }
        catch (e) {
            //Nessun intoppo qui deve impedire di caricare una foto a mano.
            console.log("Proposta della foto dalla cartella non riuscita: " + e);
            return null;
        }
    },

    /// Il contenuto del riquadro di proposta: la domanda, cosa si e' trovato e perche'.
    ///
    /// L'anteprima si mostra solo per i formati che il pannello sa disegnare. Un psd non lo
    /// sa disegnare, e proprio il psd e' il formato a cui diamo la precedenza: in quel caso
    /// si mostrano nome, dimensione e data, che sono cio' che serve per riconoscerlo.,

    /// Il contenuto del riquadro di proposta: la domanda, cosa si e' trovato e perche'.
    ///
    /// L'anteprima si mostra solo per i formati che il pannello sa disegnare. Un psd non lo
    /// sa disegnare, e proprio il psd e' il formato a cui diamo la precedenza: in quel caso
    /// si mostrano nome, dimensione e data, che sono cio' che serve per riconoscerlo.
    riquadroPropostaFoto(candidato, contenuto, motivo) {
        var spiegazioni = {
            hashDiverso: "Nella cartella di lavorazione c'e' un file con lo stesso nome, ma diverso da quello impaginato.",
            nonSulServer: "Questa foto non risulta su Istanta, ma nella cartella di lavorazione c'e'.",
            psdSoloInCartella: "Nella cartella di lavorazione c'e' il psd, su Istanta no."
        };

        var tipo = this.tipoAnteprimaDi(candidato.nome);

        var riquadro = $('<div style="display:flex; flex-direction:column; align-items:center; gap:8px; text-align:center;"></div>');
        riquadro.append($('<h3 style="margin:0;">E\' questa la foto che stai cercando?</h3>'));
        riquadro.append($('<div style="font-size:11px;"></div>').text(spiegazioni[motivo] || ""));

        //Un psd non si disegna, ma la miniatura che si porta dentro si': e' una JPEG.
        var daMostrare = contenuto;
        if (tipo == null && this.partiDelNomeFile(candidato.nome).estensione === "psd") {
            var miniatura = this.anteprimaDaPsd(contenuto);
            if (miniatura != null) {
                daMostrare = miniatura;
                tipo = "image/jpeg";
            }
        }

        var immagine = null;
        if (tipo != null) {
            try {
                var url = URL.createObjectURL(new Blob([daMostrare], { type: tipo }));
                immagine = $('<img style="max-width:180px; max-height:180px; border:1px solid #ddd;">').attr("src", url);
            }
            catch (e) {
                console.log("Anteprima non costruita: " + e);
            }
        }

        //Un riquadro vuoto sembrerebbe un guasto: meglio dire perche' non c'e' l'immagine.
        riquadro.append(immagine != null ? immagine : $('<div style="min-width:120px; min-height:80px; display:flex; align-items:center; justify-content:center; padding:10px; border:1px dashed #bbb; background:#f8f8f8; color:#777; font-size:11px;"></div>')
            .text(this.testoAnteprimaNonDisponibile(candidato.nome)));

        var descrizione = candidato.nome;
        if (candidato.dimensione) {
            descrizione += "  " + Math.round(candidato.dimensione / 1024) + " KB";
        }
        if (candidato.modificato) {
            descrizione += "  " + new Date(candidato.modificato).toLocaleString();
        }
        riquadro.append($('<div style="font-size:11px; font-weight:bold; word-break:break-all;"></div>').text(descrizione));

        return riquadro;
    },

    /// I20-980: da dove deve aprirsi il dialogo quando si carica una foto nuova.
    ///
    /// Si punta al file della foto attuale dentro la cartella Links della lavorazione, cosi'
    /// chi sostituisce una foto non deve piu' cercarla a mano. Senza il nome si punta alla
    /// sola cartella, e senza cartella non si punta a niente: il dialogo si apre come prima.
    ///
    /// Il separatore si deduce dal percorso ricevuto, perche' su Windows arriva con le barre
    /// rovesciate e su Mac con quelle dritte, e quello di troppo in fondo va tolto.,

    /// I20-980: da dove deve aprirsi il dialogo quando si carica una foto nuova.
    ///
    /// Si punta al file della foto attuale dentro la cartella Links della lavorazione, cosi'
    /// chi sostituisce una foto non deve piu' cercarla a mano. Senza il nome si punta alla
    /// sola cartella, e senza cartella non si punta a niente: il dialogo si apre come prima.
    ///
    /// Il separatore si deduce dal percorso ricevuto, perche' su Windows arriva con le barre
    /// rovesciate e su Mac con quelle dritte, e quello di troppo in fondo va tolto.
    percorsoDiPartenzaPerFoto(cartellaLinks, nomeFoto) {
        var cartella = typeof cartellaLinks === "string" ? cartellaLinks.trim() : "";
        if (cartella === "") {
            return null;
        }

        var separatore = cartella.indexOf("\\") >= 0 ? "\\" : "/";
        var base = cartella.replace(/[\\/]+$/, "");
        if (base === "") {
            base = separatore;
        }

        var nome = typeof nomeFoto === "string" ? nomeFoto.trim() : "";
        if (nome === "") {
            return base;
        }

        return base === separatore ? base + nome : base + separatore + nome;
    },

    /// Lo stesso percorso in forma di URL, che e' quello che il file system di UXP accetta.
    /// Un percorso di Windows diventa file:///C:/..., uno di Mac file:///Utenti/...,

    stessoNomeFoto(nomeA, nomeB) {
        if (nomeA == null || nomeB == null) {
            return false;
        }

        return String(nomeA) === String(nomeB);
    },

    fotoInContestoLavorazione(item, area, canale) {
        if (item == null) {
            return false;
        }

        const itemArea = item.Area != null ? item.Area : "";
        const itemCanale = item.Canale != null ? item.Canale : "";
        const areaCorrente = area != null ? area : "";
        const canaleCorrente = canale != null ? canale : "";

        const areaOk = itemArea === "" || itemArea === areaCorrente;
        const canaleOk = itemCanale === "" || itemCanale === canaleCorrente;

        return areaOk && canaleOk;
    },

    getContestoFotoText(item) {
        if (item == null) {
            return "Globale";
        }

        const hasArea = item.Area != null && item.Area !== "";
        const hasCanale = item.Canale != null && item.Canale !== "";

        if (!hasArea && !hasCanale) {
            return "Globale";
        }
        if (hasArea && hasCanale) {
            return item.Canale + " " + item.Area;
        }
        if (hasCanale) {
            return item.Canale;
        }
        if (hasArea) {
            return item.Area;
        }

        return "Globale";
    },

    getRiscontriFotoConNome(nomeFoto, fotoList, area, canale, nomeFotoAttuale) {
        const lista = Array.isArray(fotoList) ? fotoList : [];
        const riscontri = lista.filter(item => item != null && this.stessoNomeFoto(item.Nome, nomeFoto));

        if (
            this.stessoNomeFoto(nomeFoto, nomeFotoAttuale) &&
            !riscontri.some(item => this.fotoInContestoLavorazione(item, area, canale))
        ) {
            riscontri.push({
                Nome: nomeFotoAttuale,
                Area: area,
                Canale: canale,
                Attiva: true
            });
        }

        return riscontri;
    },

    buildMessaggioRiscontriFoto(nomeFoto, riscontri, area, canale) {
        const me = this;
        const contesti = [];
        const includeContestoAttuale = riscontri.some(item => me.fotoInContestoLavorazione(item, area, canale));

        riscontri.forEach(function (item) {
            const contesto = me.getContestoFotoText(item);
            if (!contesti.includes(contesto)) {
                contesti.push(contesto);
            }
        });

        const contestiText = contesti.length > 0 ? contesti.join(", ") : "Globale";
        const prefisso = includeContestoAttuale ? "Nelle lavorazioni" : "Anche nelle lavorazioni";

        return "" +
            "<div style='display:flex; flex-direction:column; gap:10px; width:100%; color:#111; font-size:14px; line-height:1.35;'>" +
            "  <div>Un'immagine con il nome <b>" + me.escapeHtml(nomeFoto) + "</b> è già presente.</div>" +
            "  <div>" + prefisso + ": <b>" + me.escapeHtml(contestiText) + "</b> verrà sostituita l'immagine se si procede alla sostituzione.</div>" +
            "  <div>Scegli se sostituire l'immagine esistente o mantenere entrambe.</div>" +
            "</div>";
    },

    /// Guid della foto di una ref del box, per la miniatura del modal noRender.
    guidFotoDiRef(codRef) {
        var schedaRef = this.schedeRefDati || [];
        var voce = schedaRef.find(f => f.recordInTracciato["Referenza.Codice"] == codRef);
        return voce != null && voce.recordInTracciato["Foto.guidid"] ? voce.recordInTracciato["Foto.guidid"] : "";
    },

    /// I20-978: nascondere o rimettere una foto cambia quante ne restano da mostrare, e la
    /// loro disposizione nel box va rifatta. Si propone, non si esegue d'ufficio: il fix foto
    /// muove gli elementi, e chi sta lavorando deve poter dire di no.
    async proponiFixFotoSeServe() {
        var box = this.refSelected != null ? this.refSelected.item : null;

        if (box == null || !NoRenderElementi.proporreFixFoto(this.statoFotoAllApertura, this.elementiNoRenderDelBox)) {
            return;
        }

        //Quello appena salvato diventa il nuovo punto di partenza: se l'operatore rifiuta e
        //poi risalva senza toccare le foto, non gli si ripropone la stessa cosa.
        this.statoFotoAllApertura = NoRenderElementi.statoDelleFoto(this.elementiNoRenderDelBox);

        try {
            var procedi = await Modali.confirm("Le foto mostrate nel box sono cambiate. Applicare il Fix Foto automatico?");
            if (!procedi) {
                return;
            }

            var obs = SistemazioneFoto.getSpazioImpaginazione(box);
            SistemazioneFoto.fixFoto(box, obs.candidate, obs.obstacles);
            messaggioUtente("Fix Foto automatico applicato", "success", false, 3);
        }
        catch (ex) {
            console.error(ex);
            messaggioUtente("Code SRF-55 Fix Foto non applicato: " + ex, "error");
        }
    },

    /// Riporta sui record in memoria quanto appena salvato. La reimpaginazione impagina a
    /// partire da schedeRefDati, che non viene ricaricata dal server: senza questo passaggio
    /// un elemento appena messo in noRender tornerebbe visibile alla prima reimpaginazione.,

    tipiFotoExtra: [{ val: 2, nome: "Bollini" }, { val: 3, nome: "Loghi" }, { val: 4, nome: "Foto ambientate" }, { val: 5, nome: "Sfondo" }],

    //I20-978: com'erano le foto quando il modal si e' aperto, per sapere al salvataggio se
    //qualcosa e' cambiato e vale la pena proporre il fix foto.
    statoFotoAllApertura: null,
    //I20-980: indirizzo della miniatura estratta da un psd, da liberare alla scelta successiva.,

    /// I20-980: il nome di un file diviso in radice ed estensione, quest'ultima in minuscolo.
    partiDelNomeFile(nome) {
        var testo = typeof nome === "string" ? nome.trim() : "";
        var punto = testo.lastIndexOf(".");

        if (punto <= 0) {
            return { base: testo, estensione: "" };
        }

        return { base: testo.substring(0, punto), estensione: testo.substring(punto + 1).toLowerCase() };
    },

    /// I20-980: il tipo con cui il pannello sa disegnare questo file, oppure null se non lo sa
    /// disegnare affatto. Un psd e' il caso che capita: il webview non lo rende, e i psd sono
    /// proprio i file a cui diamo la precedenza.,

    /// I file della cartella che possono essere la foto di questa referenza: il nome comincia
    /// con il suo codice, seguito da un separatore.
    ///
    /// Il separatore non e' un dettaglio: senza, il codice 6119227 pescherebbe anche
    /// 61192271_1.psd, che e' un altro articolo, e proporremmo la foto sbagliata.
    candidatiPerReferenza(fileInCartella, codiceReferenza) {
        var codice = codiceReferenza != null ? String(codiceReferenza).trim() : "";
        var elenco = Array.isArray(fileInCartella) ? fileInCartella : [];

        if (codice === "") {
            return [];
        }

        return elenco.filter(function (file) {
            if (file == null || typeof file.nome !== "string" || file.nome.indexOf(codice) !== 0) {
                return false;
            }

            var seguito = file.nome.charAt(codice.length);
            //Fine del nome, estensione o separatore: tutto tranne un'altra cifra.
            return seguito === "" || !/[0-9]/.test(seguito);
        });
    },

    /// Fra i candidati vince sempre il psd, e a parita' di formato il piu' recente.,

    async richiediMetodoUploadDaRiscontri(nomeFoto, fotoList, area, canale, nomeFotoAttuale) {
        const riscontri = this.getRiscontriFotoConNome(nomeFoto, fotoList, area, canale, nomeFotoAttuale);

        if (riscontri.length === 0) {
            return {
                result: true,
                hiddenVal: 0
            };
        }

        var loadingText = $("#loadingPanel").find("h1").text();
        hideLoading();
        const messageHtml = this.buildMessaggioRiscontriFoto(nomeFoto, riscontri, area, canale);
        const res = await this.scegliSostituisciOMantieni(messageHtml);
        showLoading(loadingText);

        return res;
    },

    /// Lo stesso percorso in forma di URL, che e' quello che il file system di UXP accetta.
    /// Un percorso di Windows diventa file:///C:/..., uno di Mac file:///Utenti/...
    urlDiPercorso(percorso) {
        if (typeof percorso !== "string" || percorso.trim() === "") {
            return null;
        }

        var pulito = percorso.trim().replace(/\\/g, "/");
        if (pulito.indexOf("file:") === 0) {
            return pulito;
        }

        return pulito.charAt(0) === "/" ? "file://" + pulito : "file:///" + pulito;
    },

    /// La cartella che contiene il percorso, per ripiegarci quando il file non c'e' piu'.,

    /// I20-980: il tipo con cui il pannello sa disegnare questo file, oppure null se non lo sa
    /// disegnare affatto. Un psd e' il caso che capita: il webview non lo rende, e i psd sono
    /// proprio i file a cui diamo la precedenza.
    tipoAnteprimaDi(nome) {
        var mostrabili = {
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            webp: "image/webp",
            gif: "image/gif"
        };

        var estensione = this.partiDelNomeFile(nome).estensione;
        return mostrabili[estensione] != null ? mostrabili[estensione] : null;
    },

    /// I20-980: la miniatura che un psd si porta dentro, in byte JPEG, oppure null.
    ///
    /// Il pannello non sa disegnare un psd, ma Photoshop dentro al file ci salva gia' una
    /// piccola JPEG della composizione finale, e quella si puo' mostrare.
    ///
    /// Struttura del file: firma 8BPS, intestazione di 26 byte, blocco del colore (lunghezza
    /// piu' dati), blocco delle risorse (lunghezza piu' voci). Ogni voce comincia con 8BIM,
    /// ha un identificativo, un nome in stile Pascal portato a lunghezza pari e i dati, anche
    /// quelli portati a lunghezza pari. La risorsa 1036 e' la miniatura: 28 byte che la
    /// descrivono e poi la JPEG vera.
    ///
    /// Si legge solo la 1036 e non la 1033, che e' la miniatura delle versioni antiche con
    /// rosso e blu invertiti: mostrarla darebbe una foto dai colori sbagliati.
    ///
    /// La miniatura c'e' se il file e' stato salvato con l'anteprima. Quando manca si torna
    /// null e resta il riquadro che lo dice.,

    /// I20-980: la miniatura che un psd si porta dentro, in byte JPEG, oppure null.
    ///
    /// Il pannello non sa disegnare un psd, ma Photoshop dentro al file ci salva gia' una
    /// piccola JPEG della composizione finale, e quella si puo' mostrare.
    ///
    /// Struttura del file: firma 8BPS, intestazione di 26 byte, blocco del colore (lunghezza
    /// piu' dati), blocco delle risorse (lunghezza piu' voci). Ogni voce comincia con 8BIM,
    /// ha un identificativo, un nome in stile Pascal portato a lunghezza pari e i dati, anche
    /// quelli portati a lunghezza pari. La risorsa 1036 e' la miniatura: 28 byte che la
    /// descrivono e poi la JPEG vera.
    ///
    /// Si legge solo la 1036 e non la 1033, che e' la miniatura delle versioni antiche con
    /// rosso e blu invertiti: mostrarla darebbe una foto dai colori sbagliati.
    ///
    /// La miniatura c'e' se il file e' stato salvato con l'anteprima. Quando manca si torna
    /// null e resta il riquadro che lo dice.
    anteprimaDaPsd(byte) {
        try {
            var dati = byte instanceof Uint8Array ? byte : new Uint8Array(byte);

            //Firma 8BPS.
            if (dati.length < 30 || dati[0] !== 0x38 || dati[1] !== 0x42 || dati[2] !== 0x50 || dati[3] !== 0x53) {
                return null;
            }

            var leggi32 = function (posizione) {
                return (dati[posizione] * 16777216) + (dati[posizione + 1] * 65536) +
                    (dati[posizione + 2] * 256) + dati[posizione + 3];
            };
            var leggi16 = function (posizione) {
                return (dati[posizione] * 256) + dati[posizione + 1];
            };

            var posizione = 26;
            posizione += 4 + leggi32(posizione);

            var fineRisorse = posizione + 4 + leggi32(posizione);
            posizione += 4;

            while (posizione + 12 <= fineRisorse && posizione + 12 <= dati.length) {
                //8BIM: fuori sincrono non si prosegue a tentoni.
                if (dati[posizione] !== 0x38 || dati[posizione + 1] !== 0x42 ||
                    dati[posizione + 2] !== 0x49 || dati[posizione + 3] !== 0x4D) {
                    return null;
                }

                var identificativo = leggi16(posizione + 4);

                var posizioneNome = posizione + 6;
                var saltoNome = 1 + dati[posizioneNome];
                if (saltoNome % 2 !== 0) {
                    saltoNome++;
                }

                var posizioneDimensione = posizioneNome + saltoNome;
                var dimensione = leggi32(posizioneDimensione);
                var posizioneDati = posizioneDimensione + 4;

                if (identificativo === 1036) {
                    if (dimensione <= 28 || posizioneDati + dimensione > dati.length) {
                        return null;
                    }
                    return dati.slice(posizioneDati + 28, posizioneDati + dimensione);
                }

                posizione = posizioneDati + dimensione + (dimensione % 2);
            }

            return null;
        }
        catch (e) {
            console.log("Miniatura del psd non leggibile: " + e);
            return null;
        }
    },

    /// Cosa scrivere al posto dell'immagine quando non si puo' mostrare.,

    /// Cosa scrivere al posto dell'immagine quando non si puo' mostrare.
    testoAnteprimaNonDisponibile(nome) {
        var estensione = this.partiDelNomeFile(nome).estensione;
        return estensione === ""
            ? "Anteprima non disponibile"
            : "Anteprima non disponibile per i file " + estensione.toUpperCase();
    },

    /// I20-980: mostra l'anteprima del file scelto, oppure dice perche' non c'e'. Un riquadro
    /// vuoto, o peggio un'immagine rotta, sembrerebbe un guasto del Plugin.,

    /// I20-980: mostra l'anteprima del file scelto, oppure dice perche' non c'e'. Un riquadro
    /// vuoto, o peggio un'immagine rotta, sembrerebbe un guasto del Plugin.
    mostraAnteprimaCaricamento(nomeFile, url, contenuto) {
        //L'indirizzo della miniatura estratta dal psd si butta a ogni scelta nuova: e' roba
        //che vive in memoria finche' qualcuno non la libera.
        if (this.urlAnteprimaPsd) {
            try { URL.revokeObjectURL(this.urlAnteprimaPsd); } catch (e) { }
            this.urlAnteprimaPsd = null;
        }

        var daMostrare = this.tipoAnteprimaDi(nomeFile) != null ? url : null;

        if (daMostrare == null && contenuto != null &&
            this.partiDelNomeFile(nomeFile).estensione === "psd") {
            var miniatura = this.anteprimaDaPsd(contenuto);
            if (miniatura != null) {
                try {
                    this.urlAnteprimaPsd = URL.createObjectURL(new Blob([miniatura], { type: "image/jpeg" }));
                    daMostrare = this.urlAnteprimaPsd;
                }
                catch (e) {
                    console.log("Miniatura del psd non mostrabile: " + e);
                }
            }
        }

        if (daMostrare) {
            $('#imgPreviewUploadFoto').attr('src', daMostrare).show();
            $('#txtAnteprimaNonDisponibile').hide().text('');
            return;
        }

        $('#imgPreviewUploadFoto').attr('src', '').hide();
        $('#txtAnteprimaNonDisponibile').text(this.testoAnteprimaNonDisponibile(nomeFile)).show();
    },

    /// I file della cartella che possono essere la foto di questa referenza: il nome comincia
    /// con il suo codice, seguito da un separatore.
    ///
    /// Il separatore non e' un dettaglio: senza, il codice 6119227 pescherebbe anche
    /// 61192271_1.psd, che e' un altro articolo, e proporremmo la foto sbagliata.,
};

module.exports = schedaFoto;

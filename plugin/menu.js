/// I20-1012: il menu flottante, i picker e il calendario, usciti da utility.js.
///
/// creaFloatingMenu e chiudiFloatingMenu sono il menu che si apre su un pulsante; setPickerValue e
/// setPickerWidthHack aggirano due limiti dei picker di UXP; registerDateMenuPicker e' il
/// calendario dei campi data, da solo 378 righe.
///
/// Gli altri file lo chiamano Menu.X, come globale dichiarata da indexNew.js. Mentre il calendario
/// e' aperto nasconde gli elementi .hideble come fanno le modali, e per questo importa Modali.
/// Non fa require('indesign'): si carica sotto Node.
const Modali = require('./modali/modali');

const Menu = {
    /// Seleziona in un picker di UXP (sp-picker) la voce con quel valore, o la prima se non c'e'.
    /// In UXP scrivere il valore non basta: si deve segnare selected sulla voce giusta e toglierlo
    /// dalle altre.
    setPickerValue(picker, value, ignoreEvents = true) {
        var options = $(picker).find('sp-menu-item');
        
        ignoreChangeEvent = true;
        let optionFound = false;
        options.each(function () {
            //console.log($(this).text());
            //console.log($(this).val());
            if ($(this).val() === value) {
                $(this).attr('selected', '');
                $(picker).attr("lastValue", value);
                optionFound = true;
            } else {
                $(this).removeAttr('selected');
            }
        });

        if (!optionFound && options.length > 0) {
            $(options[0]).attr('selected', '');
            $(picker).attr("lastValue", $(options[0]).text());
        }

        ignoreChangeEvent = false;

        return optionFound;
    },

    /// Su un pannello stretto (meno di 700 pixel) il picker si allarga al passaggio del mouse, fino
    /// a maxWidth, e torna a minWidth quando il mouse esce o si sceglie.
    setPickerWidthHack(picker)
    {        
        picker.each(function(){
            
            $(this).on("mouseover", function()
            {
                if (document.getElementById("wrapper").clientWidth < 700) {
                    let w = $(this).attr("maxWidth");
                    $(this).css("width", w);
                }

            });
            $(this).on("mouseout", function()
            {
                if (document.getElementById("wrapper").clientWidth<700)
                {
                    let w = $(this).attr("minWidth");
                    $(this).css("width", w);
                }
            });

            $(this).on("click", function()
            {
                if (document.getElementById("wrapper").clientWidth<700)
                {
                    let w = $(this).attr("minWidth");
                    $(this).css("width", w);
                }
            });

        })

    },

    /// Un menu che galleggia nel punto { x, y } col contenuto dato. Ne esiste uno alla volta, e un
    /// clic fuori lo chiude chiamando onClose.
    creaFloatingMenu(options) {
        const x = options.x;
        const y = options.y;
        const content = options.content;
        const className = options.className || "";
        const onClose = options.onClose || null;

        Menu.chiudiFloatingMenu();

        const floatingMenu = $("<div></div>")
            .addClass("utility-floating-menu")
            .addClass(className)
            .css({
                position: "fixed",
                left: x + "px",
                top: y + "px",
                zIndex: 999999,
                backgroundColor: "white",
                border: "1px solid #ccc",
                borderRadius: "6px",
                padding: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.25)"
            });

        floatingMenu.append(content);

        $("body").append(floatingMenu);

        setTimeout(function () {
            $(document).on("mousedown.utilityFloatingMenu", function (e) {
                if ($(e.target).closest(".utility-floating-menu").length === 0) {
                    Menu.chiudiFloatingMenu();

                    if (onClose != null)
                        onClose();
                }
            });
        }, 0);

        return floatingMenu;
    },

    /// Chiude il menu flottante e smette di ascoltare i clic fuori.
    chiudiFloatingMenu() {
        $(document).off("mousedown.utilityFloatingMenu");
        $(".utility-floating-menu").remove();
    },

    /// Trasforma ogni <date-menu-picker> sotto rootNode (o in tutta la pagina) in un campo data con
    /// il suo calendario. Il campo non si scrive a mano: si sceglie dal calendario, che si apre come
    /// una modale e percio' nasconde gli elementi .hideble. Da fuori si legge value, e si ascolta
    /// date-change.
    registerDateMenuPicker(rootNode = null) {
        const toInputDate = (date) => {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return day + '/' + month + '/' + year;
        };

        const parseInputDate = (value) => {
            if (!value || !/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
                return null;
            }
            const parts = value.split('/').map((v) => parseInt(v, 10));
            const date = new Date(parts[2], parts[1] - 1, parts[0]);
            if (Number.isNaN(date.getTime())) {
                return null;
            }
            return date;
        };

        const openCalendarModal = (currentValue, onPick) => {
            const monthLabels = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
            const dayLabels = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
            const dayCellSize = 32;
            const dayGap = 4;
            const daysRowWidth = (dayCellSize * 7) + (dayGap * 6);
            const selectedDate = parseInputDate(currentValue) || new Date();
            let visibleDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
            let hiddenBehind = false;

            try {
                Modali.nascondiHidebleElements();
                hiddenBehind = true;
            } catch (e) {
                console.warn('Impossibile nascondere elementi hideble per date picker:', e);
            }

            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.left = '0';
            overlay.style.top = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.background = 'rgba(0,0,0,0.45)';
            overlay.style.zIndex = '999999';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';

            const card = document.createElement('div');
            card.style.width = '292px';
            card.style.background = '#2f2f2f';
            card.style.border = '1px solid #4f4f4f';
            card.style.borderRadius = '8px';
            card.style.padding = '10px';
            card.style.color = 'white';

            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.marginBottom = '8px';

            const btnPrev = document.createElement('button');
            btnPrev.textContent = '<';
            btnPrev.style.width = '28px';
            btnPrev.style.height = '28px';
            btnPrev.style.cursor = 'pointer';

            const btnNext = document.createElement('button');
            btnNext.textContent = '>';
            btnNext.style.width = '28px';
            btnNext.style.height = '28px';
            btnNext.style.cursor = 'pointer';

            const title = document.createElement('div');
            title.style.fontSize = '13px';
            title.style.fontWeight = 'bold';

            header.appendChild(btnPrev);
            header.appendChild(title);
            header.appendChild(btnNext);

            const grid = document.createElement('div');
            grid.style.display = 'flex';
            grid.style.flexDirection = 'column';
            grid.style.gap = '4px';
            grid.style.alignItems = 'center';

            const footer = document.createElement('div');
            footer.style.display = 'flex';
            footer.style.justifyContent = 'space-between';
            footer.style.marginTop = '10px';

            const btnToday = document.createElement('button');
            btnToday.textContent = 'Oggi';
            btnToday.style.cursor = 'pointer';

            const btnClose = document.createElement('button');
            btnClose.textContent = 'Chiudi';
            btnClose.style.cursor = 'pointer';

            footer.appendChild(btnToday);
            footer.appendChild(btnClose);

            const closeModal = () => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }

                if (hiddenBehind) {
                    Modali.mostraHidebleElements();
                    hiddenBehind = false;
                }
            };

            const renderGrid = () => {
                title.textContent = monthLabels[visibleDate.getMonth()] + ' ' + visibleDate.getFullYear();
                grid.innerHTML = '';

                const headerRow = document.createElement('div');
                headerRow.style.display = 'flex';
                headerRow.style.gap = dayGap + 'px';
                headerRow.style.width = daysRowWidth + 'px';

                dayLabels.forEach((day) => {
                    const dayHead = document.createElement('div');
                    dayHead.textContent = day;
                    dayHead.style.fontSize = '10px';
                    dayHead.style.textAlign = 'center';
                    dayHead.style.opacity = '0.8';
                    dayHead.style.flex = '0 0 ' + dayCellSize + 'px';
                    dayHead.style.width = dayCellSize + 'px';
                    dayHead.style.height = '18px';
                    dayHead.style.lineHeight = '18px';
                    dayHead.style.boxSizing = 'border-box';
                    headerRow.appendChild(dayHead);
                });
                grid.appendChild(headerRow);

                const firstDay = new Date(visibleDate.getFullYear(), visibleDate.getMonth(), 1);
                const firstWeekDay = (firstDay.getDay() + 6) % 7;
                const daysInMonth = new Date(visibleDate.getFullYear(), visibleDate.getMonth() + 1, 0).getDate();

                const totalCells = firstWeekDay + daysInMonth;
                const weekCount = Math.ceil(totalCells / 7);
                let dayCounter = 1;

                for (let week = 0; week < weekCount; week++) {
                    const weekRow = document.createElement('div');
                    weekRow.style.display = 'flex';
                    weekRow.style.gap = dayGap + 'px';
                    weekRow.style.width = daysRowWidth + 'px';

                    for (let col = 0; col < 7; col++) {
                        const cellIndex = week * 7 + col;
                        const isBeforeMonth = cellIndex < firstWeekDay;
                        const isAfterMonth = dayCounter > daysInMonth;

                        if (isBeforeMonth || isAfterMonth) {
                            const empty = document.createElement('div');
                            empty.style.flex = '0 0 ' + dayCellSize + 'px';
                            empty.style.width = dayCellSize + 'px';
                            empty.style.height = '30px';
                            empty.style.boxSizing = 'border-box';
                            weekRow.appendChild(empty);
                            continue;
                        }

                        const cellDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth(), dayCounter);
                        const cell = document.createElement('div');
                        cell.textContent = String(dayCounter);
                        cell.style.flex = '0 0 ' + dayCellSize + 'px';
                        cell.style.width = dayCellSize + 'px';
                        cell.style.height = '30px';
                        cell.style.boxSizing = 'border-box';
                        cell.style.display = 'flex';
                        cell.style.alignItems = 'center';
                        cell.style.justifyContent = 'center';
                        cell.style.cursor = 'pointer';
                        cell.style.borderRadius = '4px';
                        cell.style.border = '1px solid #5a5a5a';
                        cell.style.background = '#3a3a3a';
                        cell.style.color = 'white';
                        cell.style.userSelect = 'none';

                        if (toInputDate(cellDate) === toInputDate(selectedDate)) {
                            cell.style.background = '#0a84ff';
                            cell.style.borderColor = '#0a84ff';
                        }

                        cell.addEventListener('click', () => {
                            onPick(toInputDate(cellDate));
                            closeModal();
                        });

                        weekRow.appendChild(cell);
                        dayCounter++;
                    }

                    grid.appendChild(weekRow);
                }
            };

            btnPrev.addEventListener('click', () => {
                visibleDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth() - 1, 1);
                renderGrid();
            });

            btnNext.addEventListener('click', () => {
                visibleDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth() + 1, 1);
                renderGrid();
            });

            btnToday.addEventListener('click', () => {
                onPick(toInputDate(new Date()));
                closeModal();
            });

            btnClose.addEventListener('click', closeModal);

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeModal();
                }
            });

            card.appendChild(header);
            card.appendChild(grid);
            card.appendChild(footer);
            overlay.appendChild(card);
            document.body.appendChild(overlay);

            renderGrid();
        };

        const renderPicker = () => {
            const searchRoot = rootNode && typeof rootNode.querySelectorAll === 'function' ? rootNode : document;
            const placeholders = searchRoot.querySelectorAll('date-menu-picker');
            placeholders.forEach((placeholder) => {
                const elementId = placeholder.getAttribute('id') || 'dataFiltroInput';
                const label = placeholder.getAttribute('label') || 'Data';

                const wrapper = document.createElement('div');
                wrapper.id = elementId;
                wrapper.style.display = 'flex';
                wrapper.style.flexDirection = 'column';
                wrapper.style.width = '100%';
                wrapper.style.minWidth = '0';

                const labelNode = document.createElement('sp-label');
                labelNode.textContent = label;
                labelNode.style.color = 'white';
                labelNode.style.fontSize = '11px';

                const controls = document.createElement('div');
                controls.style.display = 'flex';
                controls.style.gap = '6px';
                controls.style.alignItems = 'center';
                controls.style.width = '100%';
                controls.style.minWidth = '0';

                const inputDate = document.createElement('input');
                inputDate.id = elementId + '_value';
                inputDate.classList.add('hideble');
                inputDate.type = 'text';
                inputDate.placeholder = 'GG/MM/AAAA';
                inputDate.value = toInputDate(new Date());
                let lastValidDate = inputDate.value;
                inputDate.readOnly = true;
                inputDate.style.cursor = 'pointer';
                inputDate.style.height = '30px';
                inputDate.style.border = '1px solid #6a6a6a';
                inputDate.style.borderRadius = '4px';
                inputDate.style.background = '#2e2e2e';
                inputDate.style.color = '#ffffff';
                inputDate.style.padding = '0 8px';
                inputDate.style.width = '100%';
                inputDate.style.minWidth = '0';
                inputDate.style.flex = '1 1 auto';
                inputDate.style.boxSizing = 'border-box';
                inputDate.style.overflow = 'hidden';
                inputDate.style.textOverflow = 'ellipsis';

                const openCalendarButton = document.createElement('button');
                openCalendarButton.type = 'button';
                openCalendarButton.style.height = '30px';
                openCalendarButton.style.width = '34px';
                openCalendarButton.style.padding = '0';
                openCalendarButton.style.cursor = 'pointer';
                openCalendarButton.style.border = '1px solid #6a6a6a';
                openCalendarButton.style.borderRadius = '4px';
                openCalendarButton.style.background = '#3a3a3a';
                openCalendarButton.style.flex = '0 0 34px';

                const calendarIcon = document.createElement('img');
                calendarIcon.src = 'images/calendario.png';
                calendarIcon.alt = 'Calendario';
                calendarIcon.style.width = '16px';
                calendarIcon.style.height = '16px';
                calendarIcon.style.display = 'block';
                calendarIcon.style.margin = '0 auto';
                openCalendarButton.appendChild(calendarIcon);

                const emitChange = () => {
                    const detail = {
                        value: inputDate.value
                    };
                    wrapper.dispatchEvent(new CustomEvent('date-change', { detail: detail, bubbles: true }));
                    wrapper.dispatchEvent(new Event('change', { bubbles: true }));
                };

                const openCalendar = () => {
                    openCalendarModal(inputDate.value, (pickedValue) => {
                        inputDate.value = pickedValue;
                        lastValidDate = pickedValue;
                        emitChange();
                    });
                };

                inputDate.addEventListener('click', openCalendar);
                openCalendarButton.addEventListener('click', openCalendar);

                inputDate.addEventListener('keydown', function (e) {
                    e.preventDefault();
                    if (e.key === 'Enter' || e.key === ' ') {
                        openCalendar();
                    }
                });

                inputDate.addEventListener('beforeinput', function (e) {
                    e.preventDefault();
                });

                inputDate.addEventListener('input', function () {
                    if (inputDate.value !== lastValidDate) {
                        inputDate.value = lastValidDate;
                    }
                });

                inputDate.addEventListener('paste', function (e) {
                    e.preventDefault();
                });

                inputDate.addEventListener('drop', function (e) {
                    e.preventDefault();
                });

                Object.defineProperty(wrapper, 'value', {
                    get() {
                        return inputDate.value;
                    },
                    set(newValue) {
                        inputDate.value = String(newValue || '');
                        emitChange();
                    }
                });

                controls.appendChild(inputDate);
                controls.appendChild(openCalendarButton);
                wrapper.appendChild(labelNode);
                wrapper.appendChild(controls);

                if (placeholder.parentNode) {
                    placeholder.parentNode.replaceChild(wrapper, placeholder);
                }
            });
        };

        if (rootNode == null && document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', renderPicker, { once: true });
        }

        // In UXP alcuni flussi dinamici possono perdere il timing del DOMContentLoaded.
        // Eseguiamo sempre un tentativo immediato di mount sui placeholder presenti.
        renderPicker();
    },
};

module.exports = Menu;

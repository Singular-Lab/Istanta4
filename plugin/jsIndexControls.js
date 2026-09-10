const { app, PDFExportOptions, CompressionQuality } = require('indesign');

const jsIndexControls = {

    clearSubmenu() {
        $(".subMenuTabs").find('div[class*="subTab"]').each(function () {
            $(this).css('display', 'none');
        });
    },

    changeSubMenu(tabName) {
        let me = this;
        console.warn('changeSubMenu ' + tabName);
        var subMenu = $(".sub" + tabName);

        //cerchiamo tutti gli elementi la cui classe contiene subTab e li nascondiamo
        // $(".subMenuTabs").find('div[class*="subTab"]').each(function () {
        //   $(this).css('display', 'none');
        // });
        me.clearSubmenu();

        //mostraimo il subMenu selezionato
        $(subMenu).css('display', 'flex');
        //simuliamo un click sul primo elemento del submenu
        // $(subMenu).find('img').first().click();
        //troviamo tra i figli del subMenu il primo elemento che non sia a display none e simuliamo un click su di esso
        $(subMenu).find('img').each(function () {
            if ($(this).css('display') != 'none') {
                //leggiamo il suo attributo tab
                var tab = $(this).attr('tab');
                me.openTab(null, tab);
                console.warn('tab ' + tab);
                me.changeImage($(this));
                return false;
            }
        });

        //openTab(null, subMenu.attr("defaultTab"));
        //changeImage($(subMenu).find('img').first());
    },

    openTab(evt, tabName) {
        var i, tabcontent, tablinks;
        tabcontent = document.getElementsByClassName("tabcontent");
        for (i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
            tabcontent[i].parentNode.style.display = "none";
        }
        tablinks = document.getElementsByClassName("tablinks");
        for (i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.replace(" active", "");
        }
        document.getElementById(tabName).style.display = "block";
        document.getElementById(tabName).parentNode.style.display = "block";
        //evt.currentTarget.className += " active";
        //creiamo un eccezione per le tab della ref
        switch (tabName) {
            case 'Tab5':
                $("#salvaButton").css('display', 'block');
                $("#confermaButton").css('display', 'none');
                break;
            case 'Tab6':
                $("#salvaButton").css('display', 'none');
                $("#confermaButton").css('display', 'block');
                break;
            case 'Tab7':
                $("#salvaButton").css('display', 'none');
                $("#confermaButton").css('display', 'none');
                break;
            case 'Tab8':
                $("#salvaButton").css('display', 'none');
                $("#confermaButton").css('display', 'none');
            case 'Tab13':
                $("#salvaButton").css('display', 'none');
                $("#confermaButton").css('display', 'none');
                break;
            default:
                break;
        }        
    
        console.warn("opentab " + tabName);
        onresizeWindow();
    },

    openTabTracciato(evt, tabName) {
        var i, tabcontent, tablinks;
        tabcontent = document.getElementsByClassName("tabcontentTracciato");
        for (i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
        }
        tablinks = document.getElementsByClassName("tablinksTracciato");
        for (i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.replace(" active", "");
        }
        document.getElementById(tabName).style.display = "block";
        //evt.currentTarget.className += " active";
    },

    changeImage(sender) {
        //il sender è un oggetto di tipo img, noi dobbiamo eseguire due passaggi, il primo tornare dal sender al padre e cercare l'oggetto con l'immagine il cui nome contiene _active e sostituire l'immagine con l'immagine che non contiene _active, poi sostituire l'immagine del sender con l'immagine che contiene _active, usiamo il jquery per fare questo
        var parent = $(sender).parent();
        var img = $(parent).find('img[src*="active"]');
        var src = $(img).attr('src');

        if (img.length > 0 && img.attr('src') != sender.attr('src')) {
            console.log('cambio immagine');
            console.log(img);
            console.log(sender);
            console.log(src);
            var newSrc = src.replace('_active', '');
            $(img).attr('src', newSrc);
            $(img).attr('active', "false");
        }

        if (img == null || img.attr('src') != sender.attr('src')) {
            src = $(sender).attr('src');
            console.log(src);
            var newSrc = src.replace('.png', '_active.png');
            $(sender).attr('src', newSrc);
            $(sender).attr('active', "true");
        }

    },

    findOpenedTab() {
        //cerchiamo in #barraTab il primo elemento il cui attr active è true
        var tab = $("#barraTab").find('img[active="true"]');
        if (tab.length > 0) {
            var tabName = $(tab).attr('id');
            console.warn('findOpenTab ' + tabName);
            return tabName;
        } else {
            return null;
        }
    }

};

module.exports = jsIndexControls;
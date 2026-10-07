/* ============================================================================
   TIMONE - il piano di rimpaginazione del Marketing (j252, primo pezzo: si guarda)

   Sta in un file suo, servito da wwwroot/js, e non dentro Dettaglio.cshtml: di quel file si
   tocca solo il bottone della barra e la riga che carica questo script. Il motivo sta nella
   specifica (claude/timone-specifica.md 2.1): dentro Dettaglio.cshtml passano correzioni,
   timbri, OK visto, Edit avanzato, propagazioni, policy e semaforo, ed e' il file piu'
   delicato del progetto. Qui non si tocca nessuna riga di quella roba.

   Cosa sa fare (al 28/09): la pagina si smorza e le referenze del piano si disegnano sopra le
   loro posizioni vere, dentro la griglia scelta; si spostano trascinandole, dal numerino o dal
   bottone «sposta a pagina»; si tolgono dal volantino mandandole in uno dei tre pannelli a
   sinistra - in sospeso, fuori volantino, eliminate - e da li' si rimettono in pagina. Tutto
   resta nella bozza finche' non si preme SALVA. Restano da fare i gruppi e l'esportazione.

   Come si incastra nel telaio dell'editor (misure lette da Dettaglio.cshtml): .barra_alta e'
   alta 80px, .barra e' larga 100px a sinistra, .area sta a left:100px/top:80px,
   .pannello_pagine sta a destra (300px, z-index 98).
   Quindi: la barra del timone si mette SOTTO la barra alta per tutta la larghezza; i due
   pannelli del timone stanno a SINISTRA, sopra la barra degli strumenti, che a timone aperto
   non serve; il PANNELLO DELLE PAGINE resta dov'e' a destra, perche' cambiare pagina serve -
   si abbassa solo quel tanto che basta a non finire sotto la barra del timone. Per cambiare
   pagina ci sono sia le miniature sia le frecce nella barra, che fanno finta di cliccare la
   miniatura giusta: il codice dell'editor resta quello che e'.
   ============================================================================ */
(function () {
    'use strict';

    // la cartella sotto cui e' pubblicato Correggo4, con la barra finale (la scrive Dettaglio.cshtml)
    var C4_BASE = window.C4_BASE || '/';

    // l'id del volantino sta nell'indirizzo: /Volantini/Dettaglio/6
    var pezzi = location.pathname.split('/').filter(function (p) { return p.length > 0; });
    var ID_VOL = parseInt(pezzi[pezzi.length - 1], 10);
    if (!ID_VOL) return;

    var bottone = document.getElementById('tTimone');
    if (!bottone) return;

    /* piano   = la BOZZA su cui si lavora: e' solo nel browser, il server non ne sa niente
       salvato = una copia esatta di quello che ha risposto il server l'ultima volta
       modifiche = quante cose si sono cambiate dall'ultimo salvataggio
       La regola (specifica 10bis): quello che vedi e' tuo finche' non premi SALVA. */
    var piano = null;
    var salvato = null;
    var modifiche = 0;
    var aperto = false;

    /* ---------- lo stile: tutto qui dentro, niente nel foglio di stile dell'editor ---------- */
    var STILE = `
/* Il bottone sta in alto, nella barra verde acqua, accanto all'info (Michele, 28/09): blu con
   il bordino bianco, cosi' si stacca da tutto il resto e non si confonde con gli strumenti di
   correzione, che sono un'altra cosa. */
#tTimone { height: 36px; padding: 0 18px; border: 2px solid #fff; border-radius: 9px;
           background: #1f5fd0; color: #fff; font: inherit; font-size: 13px; font-weight: 800;
           letter-spacing: .7px; cursor: pointer; vertical-align: middle; margin-right: 6px;
           box-shadow: 0 1px 3px rgba(0,0,0,.18); }
#tTimone:hover { background: #2a72ee; }
#tTimone.acceso { background: #fff; color: #1f5fd0; }

/* la barra del timone: sotto la barra alta, a destra della barra degli strumenti */
#tim_barra { position: fixed; left: 0; right: 0; top: 80px; height: 42px; z-index: 105;
             background: #1d5b55; color: #fff; display: none; align-items: center; gap: 12px;
             padding: 0 12px; font-size: 13px; font-weight: 600; box-sizing: border-box;
             border-top: 2px solid #0f3d39; }
#tim_barra.visibile { display: flex; }
#tim_barra .tit { font-size: 15px; letter-spacing: .6px; }
#tim_barra .stato { font-weight: 400; opacity: .93; }
#tim_barra .sola_lettura { background: #ffffff26; padding: 3px 9px; border-radius: 6px; font-weight: 400; }
#tim_barra .destra { margin-left: auto; display: flex; gap: 8px; align-items: center; }
/* j309: l'icona della guida, bordeaux perche' e' del timone (il blu e' l'info dell'editor) */
#tim_guida { display: inline-flex; align-items: center; justify-content: center;
             width: 25px; height: 25px; border-radius: 50%; background: #7a1e2d; color: #fff;
             font: 700 15px/1 Georgia, serif; text-decoration: none; flex: 0 0 25px;
             border: 1px solid #ffffff55; }
#tim_guida:hover { background: #fff; color: #7a1e2d; border-color: #fff; }
#tim_barra button { border: 0; border-radius: 6px; padding: 6px 13px; cursor: pointer;
                    font: inherit; font-weight: 700; background: #ffffff2e; color: #fff; }
#tim_barra button.chiaro { background: #fff; color: #1d5b55; }
#tim_barra button[disabled] { opacity: .45; cursor: default; }
#tim_barra .freccia { padding: 4px 11px; font-size: 16px; line-height: 1; }
/* il salto di pagina scrivendo il numero (Michele, 28/09: «su altri clienti arriviamo a 40 pagine») */
#tim_barra .vaipag { display: inline-flex; gap: 3px; align-items: center; font-size: 11.5px;
                     font-weight: 400; opacity: .93; }
#tim_barra .vaipag .freccia { padding: 3px 9px; }
/* nowrap: senza questo «di 4» si spezzava su due righe dentro la barra alta 42px */
#tim_barra .vaipag .su { margin-left: 3px; white-space: nowrap; }
#tim_barra .vaipag input { width: 42px; border: 1px solid #ffffff5c; border-radius: 5px;
                           background: #ffffff1f; color: #fff; font: inherit; font-size: 12px;
                           font-weight: 800; text-align: center; padding: 3px 2px; }
#tim_barra .vaipag input:focus { outline: 0; border-color: #fff; background: #ffffff33; }
#tim_barra .vaipag .su b { font-weight: 800; }

/* Lo zoom, uguale a quello dell'editor. Serve perche' i pannelli del timone stanno sopra la
   barra degli strumenti e coprono proprio la barretta dello zoom: senza questo non si potrebbe
   piu' ingrandire (Michele, 28/09: "a tratti sembra tutto troppo piccolo e difficile da
   leggere"). Non e' uno zoom nuovo: gira la manopola di quello che c'e' gia'. */
#tim_zoom { display: inline-flex; align-items: center; gap: 5px; }
#tim_zoom button { border: 0; border-radius: 6px; background: #ffffff2e; color: #fff; font: inherit;
                   font-size: 15px; font-weight: 800; line-height: 1; width: 24px; height: 24px;
                   padding: 0; cursor: pointer; }
#tim_zoom button.testo { width: auto; padding: 0 8px; font-size: 11px; font-weight: 700; height: 24px; }
#tim_zoom button:hover { background: #fff; color: #1d5b55; }
#tim_zoom input[type=range] { width: 92px; accent-color: #ffd166; cursor: pointer; }
#tim_zoom .q { font-size: 11.5px; font-weight: 700; min-width: 34px; text-align: right; }

/* la riga di stato cede lo spazio agli altri quando la barra e' stretta */
#tim_barra .stato { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#tim_occhio { padding: 5px 9px; line-height: 0; }
#tim_occhio svg { width: 19px; height: 19px; display: block; fill: #fff; }
#tim_occhio.acceso { background: #fff; }
#tim_occhio.acceso svg { fill: #1d5b55; }
#tim_barra .sbirciando { background: #ffffff26; padding: 3px 9px; border-radius: 6px; font-weight: 400; }

/* A TIMONE APERTO: il volantino impaginato che sta sotto si spegne quasi del tutto, e i segni
   delle correzioni si fanno da parte. Michele (28/09): se la griglia ha piu' caselle dei
   prodotti veri, vedersi sotto i doppioni confonde e basta, quindi qui si va giu' pesante.
   (Questo blocco era sparito per un mio errore in j255, quando ho tolto il bottone della
   finestra dalla barra: avevo tagliato un pezzo di stile piu' largo del dovuto.) */
/* I tre pannelli del timone stanno a SINISTRA, sopra la barra degli strumenti: a timone aperto
   note, timbri e OK visto non si usano, mentre il PANNELLO DELLE PAGINE a destra serve eccome -
   Michele (28/09) se n'e' accorto subito: coprendolo non riusciva piu' a cambiare pagina. Quindi
   quello resta dov'e', si abbassa soltanto di quel tanto che serve a non finire sotto la barra
   verde del timone. */
/* j310 - LA «i» BLU DI CORREGGO SPARISCE A TIMONE APERTO. Michele (29/09): col timone aperto
   la guida che serve e' quella del timone (la «i» bordeaux nella striscia), non il manuale di
   Correggo, e due «i» vicine di due colori diversi confondono.
   Si usa visibility e NON display:none di proposito: .barra_alta .destra e' una fila float:right,
   quindi togliendo l'elemento dal flusso tutta la fila (TIMONE, il nome utente, ESCI) scivolerebbe
   di ~48px ogni volta che si apre e si chiude il timone. Con visibility il posto resta occupato e
   niente si muove - e' la regola che Michele ha dettato in j302: le icone devono stare ferme.
   L'elemento sta FUORI dal foglio, percio' il velo di sotto non lo tocca: serve questa riga. */
body.tim_on .barra_alta .legenda_btn { visibility: hidden; }
body.tim_on .area { top: 122px; left: 250px; }
body.tim_on .pannello_pagine { top: 132px; height: calc(100% - 150px); }
body.tim_on .foglio { background: #10171c; }
body.tim_on .foglio img.pagina { filter: brightness(.14) saturate(.18) contrast(.9); }
/* Questa riga spegne tutto quello che sta sul foglio e non e' del timone: e' lei che fa il velo
   sull'impaginato di prima. Le eccezioni vanno elencate una per una.
   DIFETTO DI j280, sistemato in j281: mi ero dimenticato .tim_bloccata, che nasce anche lei
   figlia del foglio. Risultato: la casella bloccata veniva disegnata giusta ma poi spenta a
   opacity .05 - si vedeva un'ombra del divieto invece del divieto - e con pointer-events none
   non si riusciva nemmeno a premere la ✕ per liberarla. Chi aggiunge un pezzo nuovo del timone
   dentro il foglio deve ricordarsi di aggiungerlo qui, sennò succede di nuovo. */
body.tim_on .foglio > *:not(img):not(.tim_casella):not(.tim_cella):not(.tim_bloccata) {
    opacity: .05; pointer-events: none; }

/* L'OCCHIETTO: si sbircia com'era impaginato prima. Il timone si toglie di mezzo per un attimo
   - caselle e griglia spariscono - e la pagina torna come si vede normalmente. Si ripreme e si
   torna al timone: non si perde niente, la bozza resta dov'e'. */
body.tim_sbircia .foglio { background: #fff; }
body.tim_sbircia .foglio img.pagina { filter: none; }
body.tim_sbircia .foglio > *:not(img):not(.tim_casella):not(.tim_cella):not(.tim_bloccata) { opacity: 1; }
body.tim_sbircia .tim_cella, body.tim_sbircia .tim_casella,
body.tim_sbircia .tim_bloccata { display: none; }
/* la bozza: quante modifiche non salvate, e i due bottoni */
#tim_barra .sporco { background: #ffd166; color: #4a3200; font-weight: 700; font-size: 12px;
                     padding: 4px 10px; border-radius: 10px; }
#tim_barra button.salva { background: #ffd166; color: #4a3200; }
/* j317: FATTO. Verde pieno e non giallo: SALVA e' una cosa che si fa dieci volte al giorno,
   questo si preme una volta sola alla fine, e si deve distinguere al volo da SALVA che gli sta
   accanto - premere l'uno per l'altro farebbe danno. */
#tim_barra button.fatto { background: #1d7a4f; color: #fff; }
#tim_barra button.fatto:hover { background: #22915d; }
#tim_barra .rimetti { font-size: 11px; font-weight: 400; opacity: .8; color: #fff;
                      text-decoration: underline; cursor: pointer; background: none; border: 0;
                      padding: 0; font-family: inherit; }
#tim_barra .rimetti:hover { opacity: 1; }

/* la scelta della griglia, nella barra */
/* Le griglie sono rettangolini in fila, non un menu a tendina (Michele, 28/09): quella in
   vigore adesso e' evidenziata, le altre sono li' da scegliere. Sparisce anche la voce "come
   impaginata": se la pagina non ha ancora una griglia scelta, si indovina dall'impaginato e si
   evidenzia quella - cosi' il rettangolo evidenziato rispecchia sempre come la pagina e' fatta
   davvero. */
/* nowrap anche qui: «griglia 2x3 \u25BE» andava a capo e si leggeva male (Michele, 29/09:
   «si vedono malissimo le cose») */
#tim_bgriglia { white-space: nowrap; height: 28px; padding: 0 12px; border: 2px solid #ffffff5c; border-radius: 7px;
                background: #ffffff1f; color: #fff; font: inherit; font-size: 12px; font-weight: 700;
                cursor: pointer; }
#tim_bgriglia:hover { background: #ffffff38; }
#tim_bgriglia.aperto { background: #fff; color: #1d5b55; border-color: #fff; }

/* La finestrella per scegliere la griglia (Michele, 28/09: non tutte in fila orizzontale, ma una
   finestra che si apre). Ogni griglia si vede disegnata in piccolo, cosi' si capisce la forma
   prima di sceglierla, e quella in vigore ha il rettangolo intorno. */
#tim_scelta { position: fixed; top: 128px; left: 258px; z-index: 106; width: 336px;
              background: #fff; border: 2px solid #1d5b55; border-radius: 10px; padding: 14px 16px;
              box-shadow: 0 12px 30px rgba(0,0,0,.4); font-size: 13px; color: #1f2a30; }
#tim_scelta h4 { margin: 0 0 3px; font-size: 14px; color: #1d5b55; }
#tim_scelta .quante { color: #7c8a91; font-size: 12px; margin-bottom: 11px; }
#tim_scelta .opzioni { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 9px; }
#tim_scelta .opzioni button { border: 2px solid #dfe5e8; border-radius: 8px; background: #fff;
                              padding: 8px 5px 6px; cursor: pointer; font: inherit; color: inherit;
                              display: flex; flex-direction: column; align-items: center; gap: 5px; }
#tim_scelta .opzioni button:hover { border-color: #46a9a2; }
#tim_scelta .opzioni button.scelta { border-color: #1d5b55; background: #e8f7f4;
                                     box-shadow: 0 0 0 2px #1d5b5540; }
#tim_scelta .opzioni button[disabled] { opacity: .3; cursor: default; }
#tim_scelta .opzioni button[disabled]:hover { border-color: #dfe5e8; }
#tim_scelta .mini { display: grid; gap: 2px; width: 46px; height: 46px; }
#tim_scelta .mini i { background: #9cdcd8; border-radius: 1px; display: block; }
#tim_scelta .opzioni button.scelta .mini i { background: #1d5b55; }
#tim_scelta .nome { font-size: 12px; font-weight: 800; line-height: 1; }
#tim_scelta .posti { font-size: 10.5px; color: #7c8a91; line-height: 1; }
#tim_scelta .fondo { margin-top: 13px; text-align: right; }
#tim_scelta .fondo button { border: 0; border-radius: 7px; padding: 7px 16px; cursor: pointer;
                            font: inherit; font-weight: 700; background: #e9edef; color: #4a5860; }
#tim_barra .etg { font-weight: 400; opacity: .9; }

/* le caselle vuote della griglia, disegnate sotto le referenze */
.tim_cella { position: absolute; z-index: 50; box-sizing: border-box;
             border: 1px dashed #ffffffb0; background: #1d5b5526; }
.tim_cella span { position: absolute; right: 2px; bottom: 1px; color: #fff; opacity: .55;
                  font-size: 11px; font-weight: 700; }

/* ---------- LE CASELLE BLOCCATE (j280) ----------
   Michele, 28/09: «l'utente puo' decidere se bloccare una posizione perche' magari non ci vuole
   niente in quel punto, perche' ci vorra' un qualcosa di grafico. Metterei tipo un divieto
   d'accesso». Si blocca da tre parti: il divieto che compare passando sopra una casella vuota,
   il divieto da trascinare che sta nella barra, e il pulsante sul box di una referenza. */
.tim_cella .blocca { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
                     display: none; border: 0; border-radius: 50%; background: #ffffffe0;
                     padding: 3px; cursor: pointer; line-height: 0; }
.tim_cella:hover .blocca { display: block; }
.tim_cella .blocca svg { width: 22px; height: 22px; display: block; fill: #e0483c; }
.tim_cella .blocca:hover svg { fill: #9b2a22; }

/* La casella bloccata (j280, rifatta in j281 su indicazione di Michele): fondo SCURO con le
   righine rosse, il divieto rosso con la striscia bianca e la scritta BLOCCATA in bianco. Il
   fondo scuro non e' un vezzo: una casella bianca sembrerebbe un box vuoto da riempire, mentre
   qui il senso e' «qui non si mette niente». */
.tim_bloccata { position: absolute; z-index: 62; box-sizing: border-box;
                border: 2px solid #e0483c; border-radius: 4px; cursor: default;
                background: #1b2226;
                background-image: repeating-linear-gradient(45deg,
                    #e0483c2e 0 10px, #ffffff00 10px 20px);
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                gap: 5px; overflow: hidden; }
.tim_bloccata svg { width: 40%; max-width: 52px; height: auto; fill: #e0483c;
                    pointer-events: none; }
.tim_bloccata .dice { font-size: 11px; font-weight: 800; color: #fff; letter-spacing: 1.2px;
                      text-transform: uppercase; pointer-events: none;
                      text-shadow: 0 1px 3px rgba(0,0,0,.6); }
.tim_bloccata .libera { position: absolute; right: 2px; top: 2px; display: none; border: 0;
                        border-radius: 4px; background: #9b2a22; color: #fff; font: inherit;
                        font-size: 12px; font-weight: 800; line-height: 1; padding: 3px 6px;
                        cursor: pointer; }
.tim_bloccata:hover .libera { display: block; }

/* il divieto da trascinare, nella barra */
#tim_divieto { display: inline-flex; align-items: center; gap: 5px; cursor: grab;
               border: 1px solid #ffffff5c; border-radius: 6px; padding: 2px 7px;
               font-size: 11px; font-weight: 700; }
#tim_divieto:hover { background: #ffffff26; }
#tim_divieto svg { width: 16px; height: 16px; fill: #e0483c; pointer-events: none; }
#tim_divieto.sipiglia { opacity: .5; }

/* le caselle disegnate sopra la pagina, alla geometria vera del box */
.tim_casella { position: absolute; z-index: 60; box-sizing: border-box;
               border: 2px solid #35c4b5; background: #fff;
               border-radius: 4px; overflow: hidden; cursor: default;
               box-shadow: 0 2px 8px rgba(0,0,0,.45); }
.tim_casella .num { position: absolute; left: 0; top: 0; z-index: 2; background: #1d5b55; color: #fff;
                    font-size: 11px; line-height: 16px; padding: 0 5px; border-radius: 0 0 4px 0;
                    font-weight: 700; }
.tim_casella.in_griglia { border-color: #ffd166; }
/* LA STRISCIA DEI COMANDI SI VEDE COL MOUSE SOPRA, E PUO' USCIRE DALLA CASELLA.
   Prima stava sempre in vista, dentro una casella che la taglia (overflow: hidden): con la griglia
   2x3 ci stava per un pelo, ma basta bloccare una casella e la pagina passa a 3x4 - le caselle si
   stringono e gli ultimi due pulsanti, graffetta e divieto, finiscono fuori. Michele, 29/09, dopo
   avere bloccato una casella: «non so cosa tu abbia fatto ma lo vedo sempre così».
   E non era una questione di misure: la striscia sta in 210 pixel e nella griglia 5x4 le caselle
   ne hanno 146. Non c'e' larghezza che basti sempre, quindi non si taglia piu': col mouse sopra la
   casella diventa overflow: visible e la striscia esce dai bordi, intera. Senza mouse resta solo
   il numero della casella, e la scheda si legge pulita.
   E' la stessa regola delle maniglie per allargare, che da j275 compaiono solo col mouse sopra. */
/* IL COLORE E' BORDEAUX e non il verde del timone: Michele, 29/09, «la barra degli strumenti
   facciamola di un altro colore.. facciamola tipo bordeaux così risalta di più». Il verde e' il
   colore di tutto il resto - le strisce dei codici, i pannelli, la griglia - e la barra ci si
   perdeva dentro. Il numero della casella resta verde: non e' la barra, e' la casella. */
.tim_casella .cmd { position: absolute; left: 0; top: 0; z-index: 3; display: none; gap: 3px;
                    align-items: center; background: #7a1e2d; border-radius: 0 0 5px 0;
                    padding: 2px 3px 3px 2px; }
.tim_casella.mobile:hover .cmd { display: flex; }
/* col mouse sopra la casella lascia uscire la striscia e passa davanti alle vicine */
.tim_casella.mobile:hover { overflow: visible; z-index: 80; }
/* il numero c'e' sempre, e si fa da parte quando arriva la striscia */
.tim_casella.mobile:hover .num { display: none; }
/* Sulle caselle dell'ultima colonna la striscia esce a SINISTRA invece che a destra, sennò
   andrebbe a finire oltre il bordo del foglio - e se il foglio taglia, si ritorna al problema di
   prima con i pulsanti mozzati. Quale delle due lo decide chi disegna, misurando il foglio. */
.tim_casella .cmd.a_sinistra { left: auto; right: 0; border-radius: 0 0 0 5px; }
/* IL MENU DEL NUMERO DI CASELLA HA UNA LARGHEZZA FISSA, e non e' un vezzo.
   Un <select> chiuso si fa largo quanto la sua opzione piu' lunga. Le caselle bloccate nell'elenco
   si chiamano «5 (bloccata)», quindi BASTAVA BLOCCARE UNA CASELLA perche' il menu di TUTTE le
   referenze della pagina diventasse cinque volte piu' largo, la striscia dei comandi si allargasse
   con lui e gli ultimi pulsanti finissero tagliati fuori dalla casella. Michele, 29/09, con la
   foto davanti: «errore di visualizzazione se si blocca un box: le icone sul box si allargano
   tutte, non va bene, devono rimanere il piu' statiche possibile».
   La larghezza fissa non taglia niente di utile: chiuso il menu mostra solo la casella scelta, che
   e' un numero, e una bloccata non si puo' scegliere. L'elenco aperto resta largo quanto serve e
   la parola «bloccata» si legge tutta. */
.tim_casella .cmd select { flex: 0 0 auto; width: 46px; height: 19px; border: 0; border-radius: 3px;
                           background: #fff; color: #7a1e2d; font: inherit; font-size: 11px;
                           font-weight: 800; padding: 0 1px; cursor: pointer; }
/* flex: 0 0 auto anche sui pulsanti: dentro un flex che non ci sta, per difendersi, i figli si
   stringono - e le icone si deformavano invece di restare quadrate. Meglio che la striscia sfori e
   venga tagliata dal bordo della casella, come faceva prima, che avere pulsanti di misura variabile:
   Michele li vuole «il piu' statici possibile». */
.tim_casella .cmd button { flex: 0 0 auto; height: 19px; border: 0; border-radius: 3px;
                           background: #ffffff33; color: #fff; font: inherit; font-size: 10px;
                           font-weight: 700; padding: 0 7px; cursor: pointer; white-space: nowrap; }
.tim_casella .cmd button:hover { background: #fff; color: #7a1e2d; }
.tim_casella .cmd button.icona { padding: 0 5px; line-height: 0; }
.tim_casella .cmd button.icona svg { width: 13px; height: 13px; display: block; fill: #fff; }
.tim_casella .cmd button.icona:hover svg { fill: #7a1e2d; }
.tim_casella .cmd button.cestino:hover { background: #fff; }
.tim_casella .cmd button.cestino:hover svg { fill: #9b2a22; }
/* il divieto sul box e' rosso anche da fermo: se prendesse il bianco degli altri, la striscia
   bianca in mezzo lo farebbe sparire */
/* Il divieto ha il pulsante BIANCO: il suo disco e' rosso, e su un fondo bordeaux un rosso su
   rosso non si vedrebbe. Bianco fa anche la cosa giusta - e' l'unico pulsante diverso, ed e'
   quello che blocca la casella. */
.tim_casella .cmd button.divieto { background: #fff; }
.tim_casella .cmd button.divieto svg { fill: #d4322a; }
.tim_casella .cmd button.matita:hover { background: #fff; }
.tim_casella .cmd button.matita:hover svg { fill: #1d5b55; }
/* la matita da sola (timone in sola lettura) sta in alto a destra, per non coprire il numero */
.tim_casella .cmd.sola_matita { left: auto; right: 0; border-radius: 0 0 0 4px; }

/* ---------- LA SCHEDA DELL'EDIT AVANZATO SOPRA IL TIMONE (j286) ----------
   La scheda e' quella che c'e' gia' nell'editor: il suo velo sta a z-index 100 e la finestra a
   101, mentre la barra e i pannelli del timone stanno a 105 e le finestrelle fino a 108. Senza
   queste due righe la scheda si aprirebbe SOTTO il timone, col titolo e il CHIUDI coperti dalla
   barra e la colonna di sinistra coperta dai pannelli: si vedrebbe ma non si potrebbe usare.
   Il «top» la fa partire sotto la barra del timone, cosi' la barra resta in vista. */
body.tim_on .velo { z-index: 109; }
/* IL RIMPICCIOLIMENTO AL 75% E' STATO TOLTO (j306), e la storia va raccontata per intero perche'
   e' un giro completo.
   In j287 Michele aveva chiesto «ok ma fai tutto più piccolo.. sennò non si vedono i loghi da
   aggiungere»: nella prima colonna il ritaglio del prodotto prendeva quasi tutta l'altezza e
   l'elenco dei loghi finiva sotto il bordo. Avevo rimpicciolito TUTTA la scheda al 75% (misure
   divise per 0.75 e poi riscalate: per questo c'erano width e height invece di right e bottom).
   Poi in j288 il ritaglio e' stato ristretto alla sola referenza, quindi la prima colonna si e'
   svuotata e i loghi si vedono senza bisogno di rimpicciolire niente: del 75% e' rimasto solo il
   difetto, cioe' che ogni scritta si vedeva a tre quarti della sua misura. Michele, 29/09: «ora la
   schermata di edit avanzato ha le scritte troppo piccole».
   Quindi adesso dal timone la scheda e' grande esattamente come nell'editor normale: una
   differenza in meno da mantenere. Restano il top (per non finire sotto la barra del timone) e i
   due z-index, che servono ancora.
   SE SI RIMETTESSE: le scritte tornerebbero a 9 pixel invece di 12, e non si guadagnerebbe niente,
   perche' il problema che il 75% risolveva l'ha risolto j288 in un altro modo. */
/* i pannelli che coprono i vicini nel ritaglio della scheda (j288). Si vedono solo col timone
   aperto: appena si chiude, la scheda dell'editor torna quella di prima anche se i pannelli
   restassero appesi. Il colore e' quello del fondo della scheda, cosi' sembra spazio vuoto e non
   una toppa; niente clic, perche' sotto ci sono le ombre delle correzioni. */
.tim_copri { display: none; }
body.tim_on .modale .ritaglio .tim_copri {
    display: block; position: absolute; z-index: 5; background: #bbbbbb; pointer-events: none; }

body.tim_on .modale {
    z-index: 110;
    top: 126px; left: 8px; right: 8px; bottom: 8px;
}
.tim_casella .cmd button.divieto:hover { background: #fff; }
.tim_casella .cmd button.divieto:hover svg { fill: #9b2a22; }

/* la finestrella del cestino: fuori volantino o eliminata, decide l'utente */
#tim_cestino { position: fixed; z-index: 107; background: #fff; border: 2px solid #1d5b55;
               border-radius: 10px; padding: 11px 13px; font-size: 13px; color: #1f2a30;
               box-shadow: 0 10px 28px rgba(0,0,0,.4); width: 250px; }
#tim_cestino h5 { margin: 0 0 8px; font-size: 13px; color: #1d5b55; }
#tim_cestino button { display: flex; gap: 8px; align-items: flex-start; width: 100%;
                      text-align: left; border: 2px solid #dfe5e8;
                      border-radius: 8px; background: #fff; padding: 7px 10px; cursor: pointer;
                      font: inherit; font-size: 12.5px; font-weight: 700; color: #1f2a30;
                      margin-bottom: 7px; }
#tim_cestino button:hover { border-color: #46a9a2; }
#tim_cestino button.rossa:hover { border-color: #9b2a22; color: #9b2a22; }
#tim_cestino button small { display: block; font-weight: 400; font-size: 11px; color: #7c8a91;
                            margin-top: 2px; }
/* la stessa icona che poi si ritrova sulla testa del pannello dove la referenza va a finire
   (Michele, 28/09): qui si scegle, la' si ritrova. */
#tim_cestino button svg { flex: 0 0 17px; width: 17px; height: 17px; margin-top: 1px;
                          fill: #1d5b55; pointer-events: none; }
#tim_cestino button.rossa svg { fill: #9b2a22; }

/* la finestrella per scegliere la pagina di destinazione */
#tim_pagine { position: fixed; z-index: 107; background: #fff; border: 2px solid #1d5b55;
              border-radius: 10px; padding: 11px 13px; font-size: 13px; color: #1f2a30;
              box-shadow: 0 10px 28px rgba(0,0,0,.4); }
#tim_pagine h5 { margin: 0 0 3px; font-size: 13px; color: #1d5b55; }
#tim_pagine .sotto { color: #7c8a91; font-size: 11.5px; margin-bottom: 9px; }
/* Michele, 28/09: «nel test ci sono 4 pagine, ma su altri clienti arriviamo a 40». Con 40 pagine
   un quadratino per pagina su 4 colonne faceva 10 file e la finestrella usciva dallo schermo.
   Adesso: si scrive il numero e si va, e i quadratini restano - piu' piccoli, su 5 colonne, in un
   riquadro di altezza fissa che scorre e si apre gia' sulla pagina di adesso. Cosi' con 4 pagine
   si vede tutto come prima, e con 40 la finestra ha la stessa forma. */
#tim_pagine { width: 266px; }
#tim_pagine .vai { display: flex; gap: 6px; align-items: center; margin-bottom: 8px;
                   font-size: 11.5px; color: #4a5860; }
#tim_pagine .vai input { width: 52px; border: 2px solid #dfe5e8; border-radius: 6px;
                         padding: 4px 6px; font: inherit; font-size: 12.5px; font-weight: 800;
                         text-align: center; color: #1f2a30; }
#tim_pagine .vai input:focus { outline: 0; border-color: #46a9a2; }
#tim_pagine .vai button { border: 0; border-radius: 6px; background: #1d5b55; color: #fff;
                          font: inherit; font-size: 11.5px; font-weight: 700; padding: 5px 11px;
                          cursor: pointer; }
#tim_pagine .righe { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px;
                     max-height: 186px; overflow-y: auto; padding: 1px; }
#tim_pagine .righe button { border: 2px solid #dfe5e8; border-radius: 7px; background: #fff;
                            padding: 5px 2px; cursor: pointer; font: inherit; font-weight: 800;
                            font-size: 12px; color: #1f2a30; }
#tim_pagine .righe button:hover { border-color: #46a9a2; }
#tim_pagine .righe button[disabled] { opacity: .3; cursor: default; }
/* la pagina piena non e' vietata - la griglia si allarga da sola - ma si vede a colpo d'occhio */
#tim_pagine .righe button.piena { border-color: #f0c98a; background: #fff8ec; }
#tim_pagine .righe button.piena small { color: #a8481f; }
#tim_pagine .righe button.qui { border-color: #1d5b55; }
#tim_pagine .righe button small { display: block; font-weight: 400; font-size: 9.5px; color: #7c8a91; }

/* l'avviso che compare e se ne va da solo */
#tim_avviso { position: fixed; left: 50%; transform: translateX(-50%); bottom: 24px; z-index: 108;
              background: #1d5b55; color: #fff; padding: 10px 18px; border-radius: 9px;
              font-size: 13px; font-weight: 600; box-shadow: 0 8px 24px rgba(0,0,0,.4);
              max-width: 60%; text-align: center; }

/* le maniglie per allargare: si vedono solo col mouse sopra la casella */
.tim_casella .maniglia { position: absolute; z-index: 4; display: none; gap: 2px; }
.tim_casella.mobile:hover .maniglia { display: flex; }
.tim_casella .maniglia.largo { right: 2px; top: 50%; transform: translateY(-50%); flex-direction: column; }
.tim_casella .maniglia.alto { bottom: 2px; left: 50%; transform: translateX(-50%); flex-direction: row; }
.tim_casella .maniglia button { width: 19px; height: 19px; padding: 0; border: 0; border-radius: 4px;
                                background: #1d5b55; color: #fff; font: inherit; font-size: 13px;
                                font-weight: 800; line-height: 1; cursor: pointer;
                                box-shadow: 0 1px 3px rgba(0,0,0,.4); }
.tim_casella .maniglia button:hover { background: #fff; color: #1d5b55; }
.tim_casella .maniglia button[disabled] { opacity: .35; cursor: default; }
.tim_casella .maniglia button[disabled]:hover { background: #1d5b55; color: #fff; }

.tim_casella.mobile { cursor: grab; user-select: none; }
.tim_casella.mobile:active { cursor: grabbing; }
.tim_casella.sipiglia { opacity: .3; }
.tim_cella.bersaglio { background: #ffd16666; border: 2px solid #ffd166; }
.tim_casella.bersaglio { box-shadow: 0 0 0 3px #ffd166, 0 2px 10px rgba(0,0,0,.5); }
/* ---------- LA SCHEDA DENTRO LA CASELLA (j300) ----------
   Michele, 29/09: «invece di fare dei ritagli sulla referenza forse gestirei l'interfaccia del box
   diversamente. Metterei uno sfondo bianco nelle ref, il dato della foto e prezzi li ricevi gia'..
   forse la creerei piu' tecnica». Ha guardato la preview e ha scelto questa: «ESATTAMENTE. Cosi' la
   voglio».
   Fondo bianco, la foto della referenza a sinistra, a destra il codice, la descrizione che va in
   stampa, il peso in basso e il prezzo in grande. */
/* LO SPAZIO PER LA BARRA DEI COMANDI. La striscia coi pulsanti (numero di casella, sposta a
   pagina, pausa, cestino, matita, graffetta, divieto) sta SEMPRE in alto a sinistra e larga quanto
   tutta la casella, non solo col mouse sopra. Nella prima versione della scheda le avevo lasciato
   17px su una colonna sola e si e' messa sopra foto, codice e descrizione (Michele, 29/09: «stai
   accavallando tutte le icone su foto e descrizione.. fai foto piu' piccole e descrizioni piu' in
   basso»). Adesso la riga in alto e' riservata a lei su TUTTA la larghezza, e la scheda comincia
   sotto. Se un domani la barra cresce di un pulsante, questo numero va cresciuto con lei.
   I pixel sono 32 e non 25: la barra e' alta 24, quindi con 25 il codice le restava appiccicato
   sotto e si leggeva come se fosse parte della barra (Michele, 29/09: «puoi staccarle un po' di
   piu' il codice dalla barra degli strumenti? mi sembra tutto appiccicato»). Otto pixel di aria
   bastano a far capire che sono due cose diverse. */
.tim_casella .sk { position: absolute; inset: 0; display: flex; background: #fff;
                   padding: 32px 0 18px; }
.tim_casella .sk .foto { position: relative; flex: 0 0 34%; display: flex; align-items: center;
                         justify-content: center; padding: 3px 4px; border-right: 1px solid #eceff1;
                         overflow: hidden; }
/* la foto non prende tutta la colonna: resta una miniatura, che qui serve a riconoscere il
   prodotto e non a guardarlo */
.tim_casella .sk .foto img { max-width: 100%; max-height: 84%; object-fit: contain; display: block; }
/* il «no foto» di sistema e' un disegno grosso (una macchina fotografica sbarrata): a tutta
   colonna diventava la cosa piu' grande della casella. Si tiene piccolo come un segnaposto. */
.tim_casella .sk .foto img.nofoto { max-width: 54px; max-height: 54px; }
/* il «no foto» e' quello di sistema, lo stesso che si vede nella scheda dell'Edit avanzato
   (Michele, 29/09: «metti quel no foto che abbiamo a sistema su istanta»): non una scritta mia. */
.tim_casella .sk .foto img.nofoto { opacity: .6; }
.tim_casella .sk .foto .carico { font-size: 9px; color: #a4b0b6; text-align: center; }
.tim_casella .sk .bolli { position: absolute; left: 2px; bottom: 2px; display: flex; gap: 2px; }
.tim_casella .sk .bolli img { width: 17px; height: 17px; object-fit: contain; }
.tim_casella .sk .info { flex: 1 1 auto; min-width: 0; padding: 1px 6px 2px;
                         display: flex; flex-direction: column; }
.tim_casella .sk .riga1 { display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
                          margin-bottom: 1px; }
.tim_casella .sk .riga1 .c { font: 600 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
                             color: #6b7a82; letter-spacing: .2px; }
.tim_casella .sk .d { font-size: 11px; font-weight: 700; line-height: 1.25; color: #1f2a30;
                      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
                      overflow: hidden; }
/* DUE RIGHE, non una. Meccanica, peso e prezzo su una riga sola non ci stanno in una casella
   strettina: il peso andava a capo e la riga si sfasciava (visto sul provino). Quindi i due dati
   tecnici stanno sopra, piccoli, e il prezzo sotto da solo, grande e a destra. */
.tim_casella .sk .tec { margin-top: auto; display: flex; align-items: center; gap: 4px;
                        overflow: hidden; }
.tim_casella .sk .giu { display: flex; justify-content: flex-end; }
.tim_casella .sk .pe { font-size: 10px; color: #6b7a82; white-space: nowrap;
                       overflow: hidden; text-overflow: ellipsis; }
/* la meccanica del box (BOX_STD, BOX_FID, ...): un'etichettina, che e' un dato tecnico e non
   deve prendersi la scena del prezzo */
.tim_casella .sk .mec { font: 700 8.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
                        color: #4a5860; background: #eef2f4; border-radius: 3px; padding: 1px 3px;
                        white-space: nowrap; }
.tim_casella .sk .pz { font-size: 14px; font-weight: 800; color: #1d5b55; white-space: nowrap; }
.tim_casella .sk .ps { font-size: 8.5px; font-weight: 800; border-radius: 3px; padding: 0 3px; }
.tim_casella .sk .ps.p { background: #a5bb9b; color: #1c3315; }
.tim_casella .sk .ps.s { background: #bbb79b; color: #3a3316; }
.tim_casella .sk .chip { font-size: 8.5px; font-weight: 800; color: #1d5b55; background: #d6f0ec;
                         border-radius: 3px; padding: 0 3px; }
/* ---------- LA SCHEDA SI ADATTA ALLA CASELLA (j304) ----------
   Michele, 29/09: «fai anche una prova mettendo la griglia 5x4... non ne entrano mezze.. che
   soluzioni abbiamo?». Le griglie fisse sono sette, e le caselle vanno da 243x180 pixel (2x3) a
   135x137 (5x4): una scheda sola non puo' andare bene per tutte. Quindi la scheda ha TRE misure, e
   chi disegna sceglie misurando la casella - non indovinando dalla griglia, perche' la stessa
   griglia su una pagina piu' piccola fa caselle piu' piccole, e lo zoom cambia tutto di continuo.
     - piena    (larga >= 200): foto, codice, descrizione su due righe, meccanica, peso, prezzo;
     - stretta  (140-199):      foto piu' piccola, descrizione su due righe, prezzo. Meccanica e
                                peso spariscono: sono due dati tecnici, e si leggono passando col
                                mouse o aprendo la graffetta;
     - minima   (< 140):        foto e prezzo, piu' il codice nella striscia in fondo che c'e' gia'.
                                Sotto i 140 pixel qualunque testo in piu' e' una riga tagliata a
                                meta', che si legge peggio di niente.
   Il codice resta SEMPRE, in tutte e tre: e' quello che identifica la referenza. */
.tim_casella.stretta .sk { padding-top: 20px; }
.tim_casella.stretta .sk .foto { flex: 0 0 38%; padding: 2px 3px; }
.tim_casella.stretta .sk .info { padding: 1px 4px 2px; }
.tim_casella.stretta .sk .riga1 .c { font-size: 9px; }
.tim_casella.stretta .sk .d { font-size: 10px; }
.tim_casella.stretta .sk .tec { display: none; }
.tim_casella.stretta .sk .pz { font-size: 13px; }
.tim_casella.stretta .sk .chip { display: none; }

.tim_casella.minima .sk { padding-top: 19px; flex-direction: column; }
.tim_casella.minima .sk .foto { flex: 1 1 auto; border-right: 0; padding: 1px 2px; min-height: 0; }
.tim_casella.minima .sk .foto img { max-height: 100%; }
.tim_casella.minima .sk .info { flex: 0 0 auto; padding: 0 4px 1px; }
.tim_casella.minima .sk .riga1 { display: none; }
.tim_casella.minima .sk .d { display: none; }
.tim_casella.minima .sk .tec { display: none; }
.tim_casella.minima .sk .giu { justify-content: flex-end; }
.tim_casella.minima .sk .pz { font-size: 12px; }

/* nei pannelli laterali ogni riga ha la sua foto, non il ritaglio del box (j300) */
.tim_pan .voce .conFoto { display: flex; gap: 6px; align-items: flex-start; }
.tim_pan .voce .conFoto .mini { flex: 0 0 40px; width: 40px; height: 40px; object-fit: contain;
                                background: #fff; border: 1px solid #eceff1; border-radius: 3px; }
.tim_pan .voce .conFoto .testo { flex: 1 1 auto; min-width: 0; }

/* Il ritaglio si vede com'e' sul volantino, senza ritocchi. In j266 avevo provato a metterci
   sopra un velo bianco al 26% piu' una spinta al contrasto, per leggere meglio i prodotti che sul
   volantino stanno su fondo nero (i taralli a pagina 3): Michele l'ha guardato e l'ha fatto
   togliere subito. Da non rifare senza chiederglielo. */
.tim_casella .rit { position: absolute; inset: 0; overflow: hidden; }
.tim_casella .rit img { position: absolute; max-width: none; filter: none; }
/* L'ETICHETTA col codice, in fondo alla casella (j294). Prima era un div solo col testo tagliato
   dai puntini; adesso e' una riga con due pezzi: il testo, che si taglia, e il pulsantino che
   copia il codice INTERO negli appunti. Michele, 29/09: coi gruppi lunghi il codice non si vede
   tutto, e lui vuole potersi incollare quello vero nelle note del pc.
   IL PEZZO CHE CONTA e' «min-width: 0» sul testo: dentro un flex un elemento non scende sotto la
   larghezza del suo contenuto, quindi senza quella riga il testo non si taglia piu' e il
   pulsantino viene spinto fuori dalla casella. */
.tim_casella .cod { position: absolute; left: 0; right: 0; bottom: 0; z-index: 2; background: #1d5b55e6;
                    color: #fff; font-size: 10px; line-height: 1.3; padding: 2px 4px;
                    display: flex; align-items: center; gap: 4px; }
.tim_casella .cod .txt { flex: 1 1 auto; min-width: 0;
                         white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tim_casella .cod button.copia { flex: 0 0 auto; width: 15px; height: 13px; padding: 0; border: 0;
                                 border-radius: 3px; background: #ffffff2e; cursor: pointer;
                                 line-height: 0; }
.tim_casella .cod button.copia svg { width: 10px; height: 10px; display: block; margin: 0 auto;
                                     fill: #fff; pointer-events: none; }
.tim_casella .cod button.copia:hover { background: #fff; }
.tim_casella .cod button.copia:hover svg { fill: #1d5b55; }
.tim_casella .cod button.copia.fatto { background: #7ad3a0; }
.tim_casella .cod button.copia.fatto svg { fill: #12482f; }

/* ---------- L'ELENCO DELLE REFERENZE DI UN GRUPPO (j295) ----------
   Michele, 29/09: dentro un gruppo vuole vedere le referenze una per una - foto, descrizione,
   PESO («aggiungici anche l'info del peso che e' importante»), prezzo, primario/secondario - e
   poterne staccare una. Sta sopra al foglio come la finestrella del cestino, e si chiude con un
   clic fuori. Piu' alta di #tim_cestino di un filo perche' la si apre anche da sopra di lui. */
#tim_gruppo { position: fixed; z-index: 107; background: #fff; border: 2px solid #1d5b55;
              border-radius: 10px; padding: 10px 11px; font-size: 13px; color: #1f2a30;
              box-shadow: 0 10px 28px rgba(0,0,0,.4); width: 350px;
              max-height: 76vh; overflow-y: auto; }
#tim_gruppo h5 { margin: 0 0 2px; font-size: 13px; color: #1d5b55; }
#tim_gruppo .sotto { color: #7c8a91; font-size: 11.5px; margin-bottom: 9px; }
#tim_gruppo .ref { display: flex; gap: 8px; align-items: flex-start; border: 2px solid #dfe5e8;
                   border-radius: 8px; padding: 6px 7px; margin-bottom: 6px; }
#tim_gruppo .ref.capo { border-color: #46a9a2; background: #f2fbfa; }
#tim_gruppo .ref img { flex: 0 0 46px; width: 46px; height: 46px; object-fit: contain;
                       background: #fff; border-radius: 4px; }
/* quando la foto non c'e' si mette il «no foto» di sistema, lo stesso che usa la scheda
   dell'Edit avanzato: in j295 avevo disegnato un quadratino con «senza foto» scritto dentro, e
   Michele l'ha fatto cambiare il giorno stesso (29/09). Un segnaposto solo, in tutte le schermate. */
#tim_gruppo .ref .nofoto { flex: 0 0 46px; width: 46px; height: 46px; border-radius: 4px;
                           object-fit: contain; background: #fff; opacity: .75; }
#tim_gruppo .ref .dati { flex: 1 1 auto; min-width: 0; }
#tim_gruppo .ref .codice { font-size: 12px; font-weight: 800; color: #1d5b55;
                           overflow-wrap: anywhere; }
#tim_gruppo .ref .desc { font-size: 11px; line-height: 1.3; color: #1f2a30;
                         overflow-wrap: anywhere; }
#tim_gruppo .ref .numeri { font-size: 11px; color: #4a5860; margin-top: 2px; }
#tim_gruppo .ref .numeri b { color: #1f2a30; }
#tim_gruppo .ref .ps { display: inline-block; font-size: 9.5px; font-weight: 800;
                       border-radius: 3px; padding: 0 4px; margin-right: 5px; }
#tim_gruppo .ref .ps.p { background: #a5bb9b; color: #1c3315; }
#tim_gruppo .ref .ps.s { background: #bbb79b; color: #3a3316; }
#tim_gruppo .ref .ps.n { background: #dfe5e8; color: #6b7a82; }
#tim_gruppo .ref .qui { display: inline-block; font-size: 9.5px; font-weight: 800; color: #1d5b55;
                        background: #d6f0ec; border-radius: 3px; padding: 0 4px; }
#tim_gruppo .ref .via { flex: 0 0 auto; align-self: center; border: 2px solid #dfe5e8;
                        border-radius: 7px; background: #fff; cursor: pointer; padding: 5px 6px;
                        line-height: 0; }
#tim_gruppo .ref .via svg { width: 15px; height: 15px; fill: #4a5860; pointer-events: none; }
#tim_gruppo .ref .via:hover { border-color: #a8481f; }
#tim_gruppo .ref .via:hover svg { fill: #a8481f; }
#tim_gruppo .ref .via[disabled] { opacity: .3; cursor: default; }
#tim_gruppo .ref .via[disabled]:hover { border-color: #dfe5e8; }
#tim_gruppo .ref .via[disabled]:hover svg { fill: #4a5860; }
#tim_gruppo .avvisino { font-size: 11px; color: #a8481f; margin: -2px 0 8px; }
#tim_gruppo .chi { border: 2px solid #a8481f; border-radius: 8px; padding: 7px 8px;
                   margin-bottom: 7px; background: #fdf4f0; }
#tim_gruppo .chi p { margin: 0 0 6px; font-size: 11.5px; color: #7a3a19; }
#tim_gruppo .chi button { display: block; width: 100%; text-align: left; border: 2px solid #dfe5e8;
                          border-radius: 7px; background: #fff; padding: 5px 8px; cursor: pointer;
                          font: inherit; font-size: 11.5px; font-weight: 700; margin-bottom: 5px; }
#tim_gruppo .chi button:hover { border-color: #46a9a2; }
#tim_gruppo .chi .lascia { border: 0; background: none; color: #7c8a91; font-weight: 400;
                           text-decoration: underline; padding: 0; width: auto; }

/* ---------- UNIRE (j296): la parte di sotto della stessa finestra ----------
   Michele, 29/09: «se volessero mettere un singolo e unirlo con altre referenze per prendere meno
   spazio in volantino?». Si sceglie da un elenco: le referenze in casella di QUESTA pagina e gli
   elementi in sospeso, che e' dove finisce chi viene staccato - cosi' staccare e riunire sono un
   giro chiuso. */
#tim_gruppo .unisci { border-top: 2px solid #dfe5e8; margin-top: 9px; padding-top: 8px; }
#tim_gruppo .unisci h6 { margin: 0 0 2px; font-size: 12px; color: #1d5b55; }
#tim_gruppo .unisci .sotto { margin-bottom: 7px; }
#tim_gruppo .unisci .gruppetto { font-size: 10.5px; font-weight: 800; color: #7c8a91;
                                 text-transform: uppercase; letter-spacing: .3px; margin: 6px 0 4px; }
#tim_gruppo .unisci button.c { display: flex; align-items: center; gap: 7px; width: 100%;
                               text-align: left; border: 2px solid #dfe5e8; border-radius: 7px;
                               background: #fff; padding: 5px 8px; cursor: pointer; font: inherit;
                               font-size: 11.5px; color: #1f2a30; margin-bottom: 5px; }
#tim_gruppo .unisci button.c:hover { border-color: #46a9a2; }
#tim_gruppo .unisci button.c .cod2 { font-weight: 800; color: #1d5b55; overflow-wrap: anywhere; }
#tim_gruppo .unisci button.c .dove { margin-left: auto; flex: 0 0 auto; color: #7c8a91;
                                     font-size: 10.5px; }
#tim_gruppo .unisci button.c .pr { flex: 0 0 auto; font-weight: 800; }
/* il pallino arancione: il prezzo promo non e' lo stesso. Non impedisce niente - Michele ha detto
   «Si', ma con un avviso» - ma si vede prima di premere. */
#tim_gruppo .unisci button.c .pr.diverso { color: #a8481f; }
#tim_gruppo .unisci button.c .pr.diverso::after { content: ' ●'; }
#tim_gruppo .unisci .niente { font-size: 11px; color: #7c8a91; }

/* i tre pannelli laterali */
.tim_pan { position: fixed; left: 0; width: 240px; z-index: 105; background: #fff;
           border-right: 2px solid #1d5b55; display: none; flex-direction: column; box-sizing: border-box; }
.tim_pan.visibile { display: flex; }
/* tre pannelli, uno per stato (Michele, 28/09): in sospeso, fuori volantino, eliminate */
#tim_sospesi   { top: 122px; height: calc((100vh - 122px) / 3); }
#tim_fuori     { top: calc(122px + (100vh - 122px) / 3); height: calc((100vh - 122px) / 3);
                 border-top: 2px solid #1d5b55; }
#tim_eliminate { top: calc(122px + 2 * (100vh - 122px) / 3); bottom: 0;
                 border-top: 2px solid #1d5b55; }
#tim_eliminate .testa { background: #9b2a22; }
.tim_pan.bersaglio { box-shadow: inset 0 0 0 3px #ffd166; }
.tim_pan .voce .prezzo { font-weight: 800; color: #1d5b55; }
.tim_pan .voce .rimetti_qui { margin-top: 4px; border: 1px solid #dfe5e8; border-radius: 5px;
                              background: #fff; color: #4a5860; font: inherit; font-size: 10.5px;
                              font-weight: 700; padding: 2px 7px; cursor: pointer; }
.tim_pan .voce .rimetti_qui:hover { border-color: #46a9a2; color: #1d5b55; }
.tim_pan .testa { background: #1d5b55; color: #fff; font-size: 12px; font-weight: 700;
                  padding: 7px 9px; display: flex; gap: 6px; align-items: center; }
#tim_sospesi .testa { background: #a8481f; }
.tim_pan .testa .n { margin-left: auto; background: #ffffff2e; border-radius: 9px;
                     padding: 0 7px; font-size: 11px; }
/* L'ICONA SULLA TESTA DEL PANNELLO (Michele, 28/09): e' la stessa del pulsante che ci manda le
   referenze - la pausa per gli elementi sospesi, la freccia in uscita per il fuori volantino, il
   cestino per le eliminate - cosi' guardando il box si capisce dove finira'. */
/* pointer-events: none perche' i tre pannelli sono anche bersagli del trascinamento e l'icona non
   deve mai diventare lei il bersaglio dell'evento. */
.tim_pan .testa svg { flex: 0 0 15px; width: 15px; height: 15px; fill: #fff; pointer-events: none; }
.tim_pan .corpo { overflow-y: auto; flex: 1 1 auto; padding: 6px; }
.tim_pan .voce { border: 1px solid #ccc; border-radius: 5px; padding: 4px 6px; margin-bottom: 5px;
                 font-size: 11px; line-height: 1.3; }
.tim_pan .voce .da { color: #a8481f; font-weight: 700; font-size: 10px; }
.tim_pan .vuoto { color: #777; font-size: 11px; font-style: italic; padding: 8px 4px; }

#tim_messaggio { position: fixed; left: calc(50% - 30px); top: 52%; transform: translate(-50%, -50%);
                 z-index: 106; background: #fff; border-radius: 10px; padding: 22px 26px;
                 max-width: 470px; text-align: center; font-size: 13px; line-height: 1.55;
                 box-shadow: 0 12px 34px rgba(0,0,0,.45); }
#tim_messaggio h3 { margin: 0 0 8px; font-size: 16px; color: #1d5b55; }
#tim_messaggio button { margin-top: 15px; border: 0; border-radius: 6px; padding: 8px 18px;
                        background: #1d5b55; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
#tim_messaggio button + button { margin-left: 8px; }
#tim_messaggio button.no { background: #e9edef; color: #4a5860; }
`;

/* Il foglio di stile del REPORT sta in una costante SUA e non dentro STILE (j313): serve due
   volte, qui dentro e nella finestra separata dell'ESPORTA PDF, che e' un documento nuovo e vuoto
   e deve portarsi dietro solo questo - non tutto il vestito del timone. */
var STILE_REPORT = `
/* ============================ IL REPORT DELLE MODIFICHE (j312) ============================
   Michele, 29/09: «farei un tasto visibile solo per l'agenzia dove c'e' un report con tutti gli
   spostamenti, le modifiche sulle referenze... Magari un Visual che uno puo' esportare poi anche
   in PDF... Partendo da pagina 1 a finire con l'ultima pagina». Il foglio sta sopra tutto (z-index
   130: sopra la barra del timone, che e' 105, e sopra le finestrelle, che sono 110) e non sta
   dentro .foglio, quindi il velo del timone non lo riguarda. */

#tim_report { position: fixed; inset: 0; z-index: 130; background: #f4f6f7; overflow: auto;
              font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
              color: #1b2429; }
#tim_report .rp_barra { position: sticky; top: 0; z-index: 3; display: flex; align-items: center;
                        gap: 10px; padding: 10px 18px; background: #7a1e2d; color: #fff; }
#tim_report .rp_barra b { font-size: 15px; letter-spacing: .5px; }
#tim_report .rp_barra .destra { margin-left: auto; display: flex; gap: 8px; }
#tim_report .rp_barra button { border: 0; border-radius: 6px; padding: 7px 14px; cursor: pointer;
                               font: inherit; font-weight: 700; background: #fff; color: #7a1e2d; }
#tim_report .rp_barra button.vuoto { background: #ffffff26; color: #fff; }
#tim_report .rp_foglio { max-width: 880px; margin: 0 auto; padding: 18px 16px 60px; }
#tim_report .rp_testa { background: #fff; border: 1px solid #dfe5e8; border-radius: 10px;
                        padding: 16px 18px; }
#tim_report .rp_testa h1 { margin: 0 0 4px; font-size: 19px; letter-spacing: .3px; }
#tim_report .rp_testa .vol { font-size: 15px; font-weight: 700; color: #1d5b55; }
#tim_report .rp_testa .riga { margin-top: 7px; font-size: 12px; color: #55646c; }
#tim_report .rp_come { background: #fffdf3; border: 1px solid #e8dcae; border-radius: 10px;
                       padding: 14px 18px; margin-top: 12px; }
#tim_report .rp_come h2 { margin: 0 0 8px; font-size: 14px; letter-spacing: .3px; }
#tim_report .rp_come ol { margin: 0; padding-left: 20px; }
#tim_report .rp_come li { margin: 5px 0; }
#tim_report .rp_come .att { display: block; margin-top: 9px; padding: 9px 11px; background: #fff;
                            border-left: 4px solid #d9a13b; border-radius: 4px; }
#tim_report .rp_numeri { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
#tim_report .rp_numeri .n { flex: 1 1 128px; background: #fff; border: 1px solid #dfe5e8;
                            border-radius: 9px; padding: 10px 12px; }
#tim_report .rp_numeri .n b { display: block; font-size: 23px; line-height: 1.1; }
#tim_report .rp_numeri .n span { font-size: 11.5px; color: #55646c; }
#tim_report .rp_numeri .n.zero { opacity: .5; }
#tim_report .rp_legenda { background: #fff; border: 1px solid #dfe5e8; border-radius: 10px;
                          padding: 14px 18px; margin-top: 12px; }
#tim_report .rp_legenda h2 { margin: 0 0 9px; font-size: 14px; }
#tim_report .rp_legenda div { margin: 5px 0; }
#tim_report h2.rp_pag { margin: 22px 0 0; padding: 9px 14px; background: #1d5b55; color: #fff;
                        border-radius: 8px 8px 0 0; font-size: 15px; letter-spacing: .4px;
                        display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
#tim_report h2.rp_pag .gri { font-size: 12px; font-weight: 400; opacity: .95; }
#tim_report h2.rp_pag .flag { font-size: 11px; font-weight: 700; background: #ffffff2e;
                              padding: 2px 8px; border-radius: 10px; }
#tim_report .rp_pagina { background: #fff; border: 1px solid #dfe5e8; border-top: 0;
                         border-radius: 0 0 8px 8px; padding: 12px 14px; }
#tim_report .rp_niente { color: #55646c; padding: 4px 2px; }
#tim_report .rp_riga { display: flex; gap: 12px; padding: 11px 0; border-top: 1px solid #eef2f4; }
#tim_report .rp_riga:first-child { border-top: 0; }
#tim_report .rp_foto { flex: 0 0 86px; height: 86px; display: flex; align-items: center;
                       justify-content: center; background: #fbfcfc; border: 1px solid #eef2f4;
                       border-radius: 7px; overflow: hidden; }
#tim_report .rp_foto img { max-width: 100%; max-height: 100%; object-fit: contain; }
#tim_report .rp_foto img.nofoto { max-width: 42px; max-height: 42px; opacity: .75; }
#tim_report .rp_corpo { flex: 1 1 auto; min-width: 0; }
#tim_report .rp_cod { font-weight: 800; font-size: 14px; letter-spacing: .3px; }
#tim_report .rp_des { color: #2b3940; }
#tim_report .rp_tec { margin-top: 3px; font-size: 11.5px; color: #55646c; }
#tim_report .rp_tec b { color: #1b2429; }
#tim_report .rp_dove { margin-top: 7px; display: flex; align-items: center; gap: 9px;
                       flex-wrap: wrap; font-size: 12.5px; }
#tim_report .rp_dove .q { background: #f1f4f6; border-radius: 6px; padding: 4px 9px; }
#tim_report .rp_dove .q u { text-decoration: none; color: #55646c; font-size: 10.5px;
                            display: block; letter-spacing: .4px; }
#tim_report .rp_dove .fre { color: #7a1e2d; font-weight: 800; }
#tim_report .rp_nota { margin-top: 6px; font-size: 12px; color: #55646c; }
#tim_report .bdg { display: inline-block; font-size: 10.5px; font-weight: 800; letter-spacing: .5px;
                   padding: 3px 8px; border-radius: 10px; margin: 0 5px 3px 0; color: #fff;
                   white-space: nowrap; }
#tim_report .bdg.spo { background: #b8860b; }
#tim_report .bdg.pag { background: #1f5fd0; }
#tim_report .bdg.fuo { background: #dd7800; }
#tim_report .bdg.eli { background: #b3261e; }
#tim_report .bdg.gru { background: #6b3fa0; }
#tim_report .bdg.lar { background: #1d7a4f; }
#tim_report .bdg.blo { background: #55646c; }
#tim_report .rp_fine { margin-top: 26px; }
#tim_report table.rp_tab { width: 100%; border-collapse: collapse; font-size: 12.5px; }
#tim_report table.rp_tab th, #tim_report table.rp_tab td { text-align: left; padding: 6px 8px;
                                                           border-bottom: 1px solid #eef2f4; }
#tim_report table.rp_tab th { background: #f4f6f7; font-size: 11px; letter-spacing: .4px;
                              color: #55646c; }
#tim_report .rp_coda { margin-top: 18px; font-size: 11.5px; color: #55646c; }
/* DEPRECATO (j315): l'avviso della finestra ESPORTA PDF di j313. Diceva all'utente di scegliere
   «Salva come PDF» nella finestra di stampa, perche' senza una riga che lo dicesse chi premeva
   ESPORTA PDF si trovava davanti una stampante.
   Cosa si e' scoperto: quella strada non era un export (Michele: «deve andare direttamente nei
   download.. fine»). Oggi il PDF lo fa il server e non c'e' nessuna finestra, quindi questa regola
   non la usa nessuno - se non la funzione esportaPdfInFinestra(), tenuta come via di scorta.
   Si vede a schermo e NON va nel PDF: era il suo punto. */
#tim_report .rp_avviso { max-width: 880px; margin: 14px auto -6px; padding: 11px 14px;
                         background: #fffdf3; border: 1px solid #e8dcae; border-radius: 9px;
                         font-size: 12.5px; }
#tim_report .rp_avviso b { color: #7a1e2d; }

/* ---- LA STAMPA. Michele (29/09) vuole poterlo esportare in PDF: si usa la stampa del browser,
   che fa il PDF da se' ed e' identico a quello che si vede. Qui si tolgono di mezzo l'editor
   sotto e la barra dei comandi, si aprono i colori (printBackground non e' garantito) e si evita
   che un cartoncino venga tagliato in due da un salto pagina. */
@media print {
    body.tim_stampa_report > *:not(#tim_report) { display: none !important; }
    body.tim_stampa_report { background: #fff; }
    #tim_report { position: static; inset: auto; overflow: visible; background: #fff; }
    #tim_report .rp_barra, #tim_report .rp_avviso { display: none; }
    #tim_report .rp_foglio { max-width: none; padding: 0; }
    /* si tiene insieme il singolo cartoncino, NON tutta la pagina: tenendo insieme il blocco
       intero il browser lo buttava sul foglio dopo e lasciava mezzo foglio bianco. */
    /* La LEGENDA si puo' spezzare (j313): tenendola insieme finiva sul foglio dopo e lasciava
       mezza pagina bianca in cima al report esportato. Sono righe indipendenti, spezzarle non
       fa danno. */
    #tim_report .rp_riga, #tim_report .rp_numeri .n,
    #tim_report .rp_come { break-inside: avoid; page-break-inside: avoid; }
    #tim_report h2.rp_pag { break-after: avoid; page-break-after: avoid;
                            break-inside: avoid; page-break-inside: avoid;
                            -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    #tim_report .bdg, #tim_report h2.rp_pag, #tim_report .rp_come, #tim_report .rp_dove .q {
        -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    #tim_report .rp_testa, #tim_report .rp_pagina { border-color: #c8d2d7; }
}
`;

    var stile = document.createElement('style');
    stile.textContent = STILE + STILE_REPORT;
    document.head.appendChild(stile);

    /* ---------- pezzi di pagina, creati qui e non nella vista ---------- */
    var barra = document.createElement('div');
    barra.id = 'tim_barra';
    barra.innerHTML =
        '<span class="tit">TIMONE</span>' +
        /* IL GRUPPO DELLA PAGINA (rifatto in j282). Michele, 29/09: «invece che freccette pag. 2/4
           io metterei freccetta a sinistra, numero di pagina, freccetta a destra, dove all'interno
           del numero di pagina si possa editare la pagina, così che se sono tante uno se le
           gestisca come gli pare». Il numero sta in mezzo alle due freccette ed e' scrivibile: si
           batte il numero, Invio, e ci si salta. Si aggiorna da solo cambiando pagina in altro
           modo - ma non mentre ci si sta scrivendo dentro, sennò sparirebbe sotto le dita. */
        '<span class="vaipag" id="tim_vaipag">' +
        '  <button type="button" class="freccia" id="tim_prec" title="Pagina precedente">&#8249;</button>' +
        '  <input type="text" inputmode="numeric" maxlength="4" id="tim_npag" ' +
        'title="Scrivi il numero della pagina e premi Invio" aria-label="numero di pagina">' +
        '  <button type="button" class="freccia" id="tim_succ" title="Pagina successiva">&#8250;</button>' +
        '  <span class="su">di <b id="tim_tot">1</b></span>' +
        '</span>' +
        /* la griglia della pagina, subito dopo il numero: e' della pagina, quindi sta con la
           pagina (Michele, 29/09: «la griglia selezionata con la possibilita' di poterla
           modificare la metterei tra il numero di pagina e lo zoom»). Prima era in fondo a
           destra, lontanissima da quello a cui si riferisce. */
        '<button type="button" id="tim_bgriglia" style="display:none"></button>' +
        '<button type="button" id="tim_occhio" title="Guarda com\'era impaginato prima">' +
        '  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5C6.5 5 2.3 9.1 1 12c1.3 2.9 5.5 7 11 7s9.7-4.1 11-7c-1.3-2.9-5.5-7-11-7zm0 11.5A4.5 4.5 0 1 1 16.5 12 4.5 4.5 0 0 1 12 16.5zm0-7A2.5 2.5 0 1 0 14.5 12 2.5 2.5 0 0 0 12 9.5z"/></svg>' +
        '</button>' +
        '<span class="zoomini" id="tim_zoom">' +
        '  <button type="button" id="tim_zmeno" title="Rimpicciolisci">&#8722;</button>' +
        '  <input type="range" id="tim_zbarra" min="20" max="200" step="2">' +
        '  <button type="button" id="tim_zpiu" title="Ingrandisci">+</button>' +
        '  <span class="q" id="tim_zq">48%</span>' +
        '  <button type="button" class="testo" id="tim_zfit" title="Adatta la pagina allo spazio che resta">adatta</button>' +
        '</span>' +
        /* il divieto da trascinare: seconda strada per bloccare una casella, si prende da qui e
           si molla dove si vuole (Michele, 28/09: «metterei il divieto d'accesso da trascinare e
           mettere all'interno di una certa posizione»). L'icona gliela si mette appena sotto,
           perche' qui non e' ancora stata scritta. */
        '<span id="tim_divieto" draggable="true" style="display:none" ' +
        'title="Trascinalo su una casella per bloccarla"></span>' +
        '<span class="stato" id="tim_stato"></span>' +
        '<span class="destra">' +
        /* j309: LA GUIDA. Michele, 29/09: «quando si clicca sul timone mi fai apparire un'icona
           info magari di un altro colore rispetto al blu delle info di correggo normale (magari
           bordeaux) e all'interno mi metti un PDF con una guida che mi devi fare te con tutta la
           spiegazione di ogni singolo pulsante».
           E' un collegamento e non un pulsante: si apre in una finestra nuova, il browser il PDF lo
           sa mostrare da se', e chi vuole se lo scarica o se lo stampa senza chiedere niente a noi.
           Sta per primo nel gruppo di destra perche' SALVA e ANNULLA vanno e vengono: se stesse in
           mezzo, si sposterebbe da sola ogni volta che tocchi qualcosa.
           La versione nell'indirizzo va cambiata quando si rifa' la guida, sennò chi l'ha gia'
           aperta continua a vedere quella vecchia dalla cache. */
        /* j312: IL REPORT, solo per l'Agenzia. Parte nascosto e lo scopre carica() quando il
           server dice che chi guarda e' l'Agenzia (puoGestireFinestra, che vale proprio quello).
           Non e' un controllo di sicurezza - dentro ci sono dati che il Marketing vede comunque -
           e' che al Marketing non serve: il report racconta il lavoro suo. */
        /* j317: FATTO. Lo preme l'Agenzia quando ha riportato sull'impaginato quello che il
           Marketing ha chiesto col timone, e spegne la casella «TIMONE» che lampeggia nella home.
           Parte nascosto: lo accende carica() solo se il server dice che c'e' del lavoro che
           aspetta (daSistemare), cioe' la stessa regola che accende la casella nella home. */
        '  <button type="button" id="tim_sistemato" class="fatto" style="display:none" ' +
        'title="Ho riportato sull\'impaginato le modifiche del Marketing: spegni l\'avviso nella home">' +
        'FATTO</button>' +
        '  <button type="button" id="tim_report_apri" style="display:none" ' +
        'title="Report delle modifiche: cosa ha cambiato il Marketing, pagina per pagina">REPORT</button>' +
        /* j324: I FILTRI PER IL PLUG-IN. Solo per l'Agenzia e solo a finestra chiusa - gli stessi
           due paletti che il server controlla da se' (ServizioTimone.Esporta.cs): qui si nasconde
           il bottone, la', se qualcuno chiamasse la rotta a mano, si risponde 403 o 423.
           Sta accanto a REPORT perche' sono le due cose che fa l'Agenzia a fine giro: prima guarda
           cosa e' cambiato, poi porta il pacchetto al plug-in. */
        '  <button type="button" id="tim_filtri" style="display:none" ' +
        'title="Scarica il pacchetto dei filtri da copiare nella cartella di lavorazione del plug-in">' +
        'FILTRI</button>' +
        '  <a id="tim_guida" href="' + C4_BASE + 'guide/guida-timone.pdf?v=j309" target="_blank" rel="noopener" ' +
        'title="Guida del timone: cosa fa ogni pulsante (PDF, 5 pagine)">i</a>' +
        '  <span class="sporco" id="tim_sporco" style="display:none"></span>' +
        '  <button type="button" id="tim_annulla" style="display:none">ANNULLA LE MODIFICHE</button>' +
        '  <button type="button" id="tim_salva" class="salva" style="display:none">SALVA</button>' +
        '  <button type="button" id="tim_chiudi" class="chiaro">CHIUDI</button>' +
        '</span>';
    document.body.appendChild(barra);

    /* LE TRE ICONE, scritte una volta sola e usate in tre posti: sul pulsante del box, dentro la
       finestrella del cestino e sulla testa del pannello di destinazione. Michele, 28/09: «per far
       capire meglio le icone degli elementi in sospeso e fuori volantino ed eliminati metti accanto
       l'icona, cosi' l'utente capisce dove andranno le referenze». Il punto e' proprio che sia la
       STESSA in tutti e tre i posti: se cambi una, cambiala qui e cambia da sola anche altrove. */
    var ICO_PAUSA = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                    '<rect x="6.5" y="5" width="4" height="14" rx="1.2"/>' +
                    '<rect x="13.5" y="5" width="4" height="14" rx="1.2"/></svg>';
    /* fuori volantino: il foglio a sinistra e la freccia che ne esce. Non e' un cestino, perche'
       non e' buttata via: e' una scelta, sta fuori dal volantino e basta. */
    var ICO_FUORI = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                    '<path d="M4.5 3h8.5v2H6.5v14H13v2H4.5a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 4.5 3z"/>' +
                    '<path d="M16.6 7.4 15.2 8.8l2.2 2.2H9.5v2h7.9l-2.2 2.2 1.4 1.4L21.4 12z"/></svg>';
    /* il divieto d'accesso: cerchio pieno con la barra bianca in mezzo. Si legge anche piccolo e
       non si confonde con niente altro. */
    /* il divieto d'accesso vero: disco PIENO rosso e striscia BIANCA in mezzo, come il segnale
       stradale (Michele, 29/09: «il segnale di divieto lo farei rosso con la striscia bianca»).
       Il disco prende il colore dal CSS, cosi' si puo' scurire al passaggio del mouse; la
       striscia e' bianca scritta qui, perche' bianca deve restare sempre. */
    var ICO_DIVIETO = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                      '<circle cx="12" cy="12" r="10"/>' +
                      '<rect x="5.6" y="10.5" width="12.8" height="3" rx="1.2" fill="#fff"/></svg>';
    /* la MATITA: apre la scheda dell'Edit avanzato su questa referenza (Michele, 29/09: «ci devi
       fare una matita come icona che sta a significare modifica referenza»). */
    var ICO_MATITA = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                     '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 ' +
                     '0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
    var ICO_CESTINO = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                      '<path d="M9 3h6l1 2h4v2H4V5h4l1-2zM6 8h12l-1 12.2A1.8 1.8 0 0 1 15.2 22H8.8a1.8 1.8 0 0 1-1.8-1.8L6 8zm4 2v9h1.5v-9H10zm3.5 0v9H15v-9h-1.5z"/></svg>';
    /* j294 - COPIA IL CODICE. Michele, 29/09: «se sono tanti i codici in un gruppo ci metti "..."
       e poi dai la possibilita' all'utente con un pulsantino di copiare tutto il codice anche se
       non lo vede. nel caso lo incollera' sulle sue note del pc».
       Due fogli sovrapposti: e' l'icona che tutti leggono come «copia». Il segno di spunta la
       sostituisce per un attimo dopo il clic, cosi' si vede che e' andata. */
    var ICO_COPIA = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                    '<path d="M9 2h9a2 2 0 0 1 2 2v12h-2V4H9V2z"/>' +
                    '<path d="M5 6h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm0 2v12h9V8H5z"/></svg>';
    var ICO_FATTO = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                    '<path d="M9.6 17.6 4.4 12.4l1.7-1.7 3.5 3.5 8.3-8.3 1.7 1.7z"/></svg>';
    /* DEPRECATO dal j296 - non e' piu' usata da nessuno, e si tiene qui perche' sapere com'e'
       andata serve.
       In j295 era l'icona del pulsante sulla casella che apriva l'elenco del gruppo: tre fogli
       sovrapposti, «qui dentro ce n'e' piu' di una». In j296 e' arrivata la graffetta per unire le
       referenze, e sulla stessa casella sarebbe stato il SETTIMO pulsante (numero di casella,
       sposta a pagina, pausa, cestino, matita, fogli, graffetta) su una striscia larga un dito:
       Michele si era gia' lamentato una volta di un menu' troppo pieno. Quindi le due cose sono
       diventate una finestra sola, e l'icona e' la graffetta - che e' quella che aveva chiesto lui.
       Se si riattivasse: non si romperebbe niente, ma tornerebbero due pulsanti dove ne basta uno,
       e l'utente dovrebbe indovinare quale dei due apre cosa. Prima di rimetterla, chiedere. */
    var ICO_GRUPPO = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                     '<path d="M4 6h13v2H4V6zm0 4.5h13v2H4v-2zM4 15h13v2H4v-2z"/>' +
                     '<path d="M19.5 6h1.5v11h-1.5z"/></svg>';
    /* j296 - LA GRAFFETTA. Michele, 29/09, su come unire le referenze: «Una graffetta sulla
       casella». Apre la finestra del gruppo: da li' si vedono le referenze che ci sono dentro, si
       staccano, e si uniscono quelle di fuori. */
    /* IL «NO FOTO» DI SISTEMA. Michele, 29/09: «quando non c'e' la foto non mettere senza foto,
       metti quel no foto che abbiamo a sistema su istanta». E' lo stesso file che usa la scheda
       dell'Edit avanzato (in Dettaglio.cshtml la riga e' IMG + 'nofoto.png', con IMG che vale
       C4_BASE + 'immagini-correggo/'): non una scritta inventata da me. */
    var VIA_NOFOTO = C4_BASE + 'immagini-correggo/nofoto.png';

    var ICO_GRAFFETTA = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                        '<path d="M16.1 6.3 8.4 14a2.1 2.1 0 0 0 3 3l7.2-7.2a4.2 4.2 0 0 0-6-6L4.9 ' +
                        '11.4a6.3 6.3 0 0 0 8.9 8.9l6.3-6.3-1.4-1.4-6.3 6.3a4.3 4.3 0 0 1-6.1-6.1l7.7-7.7a2.2 ' +
                        '2.2 0 0 1 3.1 3.1l-7.2 7.2a.1.1 0 0 1-.2-.2l7.7-7.7-1.3-1.2z"/></svg>';
    /* lo strappo: la referenza esce dal gruppo. Una forbice si legge subito e non si confonde col
       cestino, che vuol dire un'altra cosa (via dal volantino). */
    var ICO_SGRUPPA = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                      '<path d="M6 2h1.8l5.2 8.4-1.6 2.6L6 4.6V2zm12 0h-1.8l-3.4 5.5 1.6 2.6L18 4.6V2z"/>' +
                      '<path d="M5.5 15a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4zm0 1.8a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8z"/>' +
                      '<path d="M18.5 15a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4zm0 1.8a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8z"/></svg>';

    function pannello(id, titolo, icona) {
        var p = document.createElement('div');
        p.className = 'tim_pan';
        p.id = id;
        p.innerHTML = '<div class="testa">' + (icona || '') + titolo + '<span class="n">0</span></div>' +
                      '<div class="corpo"></div>';
        document.body.appendChild(p);
        return p;
    }
    var panSospesi = pannello('tim_sospesi', 'Elementi sospesi', ICO_PAUSA);
    var panFuori = pannello('tim_fuori', 'Referenze fuori volantino', ICO_FUORI);
    var panEliminate = pannello('tim_eliminate', 'Referenze eliminate', ICO_CESTINO);
    var pannelli = [panSospesi, panFuori, panEliminate];

    var etDivieto = document.getElementById('tim_divieto');
    etDivieto.innerHTML = ICO_DIVIETO + '<span>blocca</span>';

    /* L'etichetta arriva dal dna del box e porta dentro i tag del tracciato, tipo
       "<DESCRIZIONE_TITOLO>MAGNUM X4 MANDORLE</DESCRIZIONE_TITOLO>". A schermo sono rumore:
       si tolgono e si stringono gli spazi. Il testo vero non si perde, si nasconde solo la
       impalcatura. */
    function leggibile(s) {
        return String(s === null || s === undefined ? '' : s)
            .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function esc(s) {
        return (s === null || s === undefined) ? '' : String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function token() {
        var i = document.querySelector('input[name="__RequestVerificationToken"]');
        return i ? i.value : '';
    }

    function chiedi(via) {
        return fetch(via, { credentials: 'same-origin' }).then(function (r) { return r.json(); });
    }

    function manda(via, corpo) {
        return fetch(via, {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'RequestVerificationToken': token() },
            body: JSON.stringify(corpo || {})
        }).then(function (r) { return r.json(); });
    }

    function quando(d) {
        if (!d) return '';
        var x = new Date(d);
        return isNaN(x) ? '' : x.toLocaleString('it-IT',
            { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    /* DEPRECATO (j255, 28/09) - per il campo datetime-local ci vuole l'ora locale scritta come
       2026-10-05T18:30. Serviva alla finestrella che apriva la finestra del Marketing dalla barra
       del timone, tolta su richiesta di Michele (vedi la nota piu' sotto): oggi nessuno la chiama.
       Non e' cancellata perche' e' il pezzo che servirebbe a qualsiasi campo data futuro dentro il
       timone - per esempio se un domani si mettera' qui una scadenza del piano. Riattivandola non
       succede niente di suo: e' una funzione pura, restituisce solo una stringa. */
    function perIlCampo(d) {
        var p = function (n) { return (n < 10 ? '0' : '') + n; };
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
               'T' + p(d.getHours()) + ':' + p(d.getMinutes());
    }

    /* ---------- quale pagina si sta guardando ---------- */
    /* Le pagine che si stanno guardando. Di solito una, ma l'editor sa fare anche la lettura
       affiancata (due pagine insieme): in quel caso si disegna su tutte e due. */
    function fogliVisibili() {
        var fuori = [];
        document.querySelectorAll('.foglio').forEach(function (f) {
            if (f.offsetParent !== null) fuori.push(f);
        });
        if (!fuori.length) {
            var primo = document.querySelector('.foglio');
            if (primo) fuori.push(primo);
        }
        return fuori;
    }

    function foglioVisibile() {
        return fogliVisibili()[0] || null;
    }

    function numeroPaginaVisibile() {
        var f = foglioVisibile();
        return f ? parseInt(f.dataset.numero, 10) : 1;
    }

    /* Cambiare pagina senza toccare il codice dell'editor: si finge il clic sulla miniatura,
       che ha gia' il suo gestore (Dettaglio.cshtml, vaiAPagina). Funziona anche col pannello
       delle pagine nascosto. */
    function vaiA(numero) {
        var cella = document.querySelector('.pannello_pagine .cella[data-pagina="' + numero + '"]');
        if (!cella) return false;
        cella.click();
        setTimeout(disegna, 40);
        return true;
    }

    function quantePagine() {
        return document.querySelectorAll('.foglio').length;
    }

    /* ---------- il disegno ---------- */
    function pulisci() {
        chiudiPagine();
        chiudiCestino();
        document.querySelectorAll('.tim_casella, .tim_cella, .tim_bloccata').forEach(function (c) { c.remove(); });
        var m = document.getElementById('tim_messaggio');
        if (m) m.remove();
    }

    function messaggio(titolo, testo, bottoneTesto, azione) {
        var d = document.getElementById('tim_messaggio');
        if (d) d.remove();
        d = document.createElement('div');
        d.id = 'tim_messaggio';
        d.innerHTML = '<h3>' + esc(titolo) + '</h3><div>' + esc(testo) + '</div>';
        if (bottoneTesto) {
            var b = document.createElement('button');
            b.type = 'button';
            b.textContent = bottoneTesto;
            b.addEventListener('click', function () { b.disabled = true; d.remove(); azione(); });
            d.appendChild(b);
            // quando c'e' qualcosa da confermare ci vuole sempre anche il modo di non farlo
            var n = document.createElement('button');
            n.type = 'button';
            n.className = 'no';
            n.textContent = 'Lascia stare';
            n.addEventListener('click', function () { d.remove(); });
            d.appendChild(n);
        } else {
            // anche un avviso senza scelte deve potersi chiudere: prima se ne andava solo al
            // ridisegno, e chi lo leggeva restava li' senza capire come toglierlo
            var c2 = document.createElement('button');
            c2.type = 'button';
            c2.textContent = 'Ho capito';
            c2.addEventListener('click', function () { d.remove(); });
            d.appendChild(c2);
        }
        document.body.appendChild(d);
    }

    /* Una domanda con piu' di due risposte: serve all'uscita con modifiche non salvate.
       scelte = [{testo, chiaro, fai}] */
    function domanda(titolo, testo, scelte) {
        var d = document.getElementById('tim_messaggio');
        if (d) d.remove();
        d = document.createElement('div');
        d.id = 'tim_messaggio';
        d.innerHTML = '<h3>' + esc(titolo) + '</h3><div>' + esc(testo) + '</div>';
        scelte.forEach(function (s) {
            var b = document.createElement('button');
            b.type = 'button';
            if (!s.chiaro) b.className = 'no';
            b.textContent = s.testo;
            b.addEventListener('click', function () { d.remove(); s.fai(); });
            d.appendChild(b);
        });
        document.body.appendChild(d);
    }

    /* Una casella sta sopra il prodotto vero, alla sua geometria, e dentro ci si mette il
       ritaglio della pagina: la stessa tecnica della finestra delle propagazioni (j232). La
       pagina e' un file statico, il taglio lo fa il browser spostando l'immagine. */
    /* Il riquadro di una casella bloccata (j280): righine diagonali, il divieto grosso in mezzo e
       la parola «bloccata». Ci si passa sopra col mouse e compare la ✕ per liberarla. */
    function disegnaBloccata(foglio, pagina, b, q) {
        if (!q) return;
        var pw = Number(pagina.larghezza), ph = Number(pagina.altezza);
        if (!pw || !ph) return;
        var d = document.createElement('div');
        d.className = 'tim_bloccata';
        d.dataset.pag = pagina.id;
        d.dataset.k = b.posizione;
        d.style.left = (q.x / pw * 100) + '%';
        d.style.top = (q.y / ph * 100) + '%';
        d.style.width = (q.w / pw * 100) + '%';
        d.style.height = (q.h / ph * 100) + '%';
        d.title = 'Casella ' + b.posizione + ' bloccata: qui non va nessuna referenza';
        d.innerHTML = ICO_DIVIETO + '<span class="dice">bloccata</span>' +
            (piano.puoScrivere === true
                ? '<button type="button" class="libera" data-pag="' + pagina.id + '" data-k="' +
                  b.posizione + '" title="Libera questa casella">&#10005;</button>'
                : '');
        foglio.appendChild(d);
    }

    /* Il bottone della matita, uguale nei due posti in cui compare. Michele, 29/09: «un bottone
       che metterai vicino al cestino, con una matita come icona, che sta a significare modifica
       referenza: se ci cliccano devono vedere la stessa cosa che vedono in edit avanzato e poter
       fare le stesse identiche cose - prezzi, foto, loghi, azioni». */
    function bottoneMatita(v) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'icona matita';
        b.dataset.voce = v.id;
        b.title = 'Modifica referenza: prezzi, foto, loghi e azioni (Edit avanzato)';
        b.innerHTML = ICO_MATITA;
        return b;
    }

    function disegnaCasella(foglio, v, pagina, dove) {
        var vw = Number(v.w), vh = Number(v.h);
        if (!vw || !vh) return;

        /* DUE PAGINE IN BALLO, e non e' un dettaglio (Michele, 28/09: spostando gli occhi di bue
           da pagina 1 a pagina 2 si vedeva la foto sbagliata).
           - "pagina" e' dove la referenza va disegnata ADESSO;
           - "orig" e' la pagina da cui viene, ed e' l'unica su cui le sue coordinate x, y, w, h
             vogliono dire qualcosa. Il ritaglio va preso da li': dall'immagine di quel foglio e
             con le misure di quella pagina. Se si ritaglia dalla pagina di arrivo si prende un
             pezzo a caso di un'altra pagina. */
        var orig = (piano.pagine || []).filter(function (p) { return p.numero === v.paginaOrigine; })[0] || pagina;
        var pw = Number(orig.larghezza), ph = Number(orig.altezza);
        var dw = Number(pagina.larghezza) || pw, dh = Number(pagina.altezza) || ph;
        if (!pw || !ph || !dw || !dh) return;

        // "dove" e' la casella della griglia in cui mettere la referenza: se non c'e' griglia,
        // la referenza resta dov'e' davvero sulla pagina - ma solo se e' ancora la sua
        if (!dove && v.paginaOrigine !== pagina.numero) return;
        var q = dove || { x: Number(v.x), y: Number(v.y), w: vw, h: vh };

        var c = document.createElement('div');
        var mobile = piano && piano.puoScrivere === true && dove;   // si sposta solo dentro una griglia
        c.className = 'tim_casella' + (dove ? ' in_griglia' : '') + (mobile ? ' mobile' : '');
        if (mobile) c.draggable = true;
        // la casella si posiziona sulla pagina di ARRIVO
        c.style.left = (q.x / dw * 100) + '%';
        c.style.top = (q.y / dh * 100) + '%';
        c.style.width = (q.w / dw * 100) + '%';
        c.style.height = (q.h / dh * 100) + '%';
        var quanteQui = quanteNelGruppo(v);
        c.title = codiceDi(v) + (v.etichetta ? '\n' + leggibile(v.etichetta) : '') +
                  (quanteQui > 1 ? '\n\nGruppo di ' + quanteQui + ' referenze: occupano una casella sola.' : '') +
                  (mobile ? '\n\nTrascinala su un\'altra casella per spostarla.' : '');
        c.dataset.voce = v.id;

        /* j304: QUANTO E' GRANDE QUESTA CASELLA, in pixel veri sullo schermo. Serve a scegliere
           quanta roba ci sta nella scheda. Si misura, non si indovina dalla griglia: la stessa
           griglia su una pagina di formato diverso fa caselle diverse, e lo zoom le cambia tutte
           in continuazione (per questo disegna() viene richiamata a ogni cambio di zoom). */
        var largoFoglio0 = foglio.clientWidth || 0, altoFoglio0 = foglio.clientHeight || 0;
        var largaPx = largoFoglio0 ? q.w / dw * largoFoglio0 : 999;
        var altaPx = altoFoglio0 ? q.h / dh * altoFoglio0 : 999;
        if (largaPx < 140 || altaPx < 92) c.classList.add('minima');
        else if (largaPx < 200 || altaPx < 128) c.classList.add('stretta');

        /* j300: DENTRO LA CASELLA VA LA SCHEDA, non piu' il ritaglio della pagina stampata.
           Michele, 29/09: «invece di fare dei ritagli sulla referenza forse gestirei l'interfaccia
           del box diversamente. Metterei uno sfondo bianco nelle ref, il dato della foto e prezzi
           li ricevi gia'.. forse la creerei piu' tecnica». Ha visto la preview e ha risposto
           «ESATTAMENTE. Cosi' la voglio».
           Il ritaglio resta qui sotto, marcato deprecato, perche' spiega da dove veniamo. */
        disegnaScheda(c, v);

        /* IL NUMERO DELLA CASELLA, sempre. Prima lo disegnavo solo sulle caselle che non si
           possono spostare, perche' sulle altre il numero lo diceva il menu a tendina della
           striscia; ma da quando la striscia si vede solo col mouse sopra (j304), senza questo
           la casella non direbbe piu' il suo numero. */
        if (v.posizione) {
            var nm = document.createElement('div');
            nm.className = 'num';
            nm.textContent = v.posizione;
            c.appendChild(nm);
        }

        if (v.posizione && mobile) {
            // il numerino della casella diventa un menu a tendina, e accanto ci sta il bottone
            // per mandare la referenza su un'altra pagina (Michele, 28/09)
            var cmd = document.createElement('div');
            cmd.className = 'cmd';
            cmd.draggable = false;        // qui sopra non si comincia a trascinare

            var sel = document.createElement('select');
            sel.title = 'Sposta in un\'altra casella di questa pagina';
            var quante = Number(pagina.capienza) || 0;
            for (var k = 1; k <= quante; k++) {
                var o = document.createElement('option');
                o.value = k; o.textContent = k;
                // j280: le caselle bloccate si vedono anche qui, e non si possono scegliere
                // la parola resta (l'elenco aperto la mostra tutta) ma si scrive corta: cosi'
                // anche dove un select a larghezza fissa non arrivasse, il danno e' piccolo
                if (bloccoIn(pagina.id, k)) { o.textContent = k + ' bloccata'; o.disabled = true; }
                if (k === v.posizione) o.selected = true;
                sel.appendChild(o);
            }
            sel.dataset.voce = v.id;
            cmd.appendChild(sel);

            /* DA CHE PARTE ESCE LA STRISCIA. E' larga circa 290 pixel: se la casella sta troppo a
               destra, uscendo a destra finirebbe fuori dal foglio. In quel caso esce a sinistra.
               Si misura il foglio adesso, perche' con lo zoom cambia di continuo. */
            var largoFoglio = foglio.clientWidth || 0;
            if (largoFoglio && (q.x / dw * largoFoglio) + 300 > largoFoglio) {
                cmd.classList.add('a_sinistra');
            }

            var bp = document.createElement('button');
            bp.type = 'button';
            bp.className = 'vaipag';
            bp.textContent = 'sposta a pagina';
            bp.dataset.voce = v.id;
            cmd.appendChild(bp);

            /* La PAUSA: mette la referenza in sospeso. Il gesto e' proprio quello - non e' tolta,
               e' messa in pausa finche' non si decide dove farla andare - e l'icona la conoscono
               tutti, si legge anche piccolissima e non si confonde col cestino (Michele, 28/09). */
            var bs = document.createElement('button');
            bs.type = 'button';
            bs.className = 'icona pausa';
            bs.dataset.voce = v.id;
            bs.title = 'Metti in sospeso: la togli dalla pagina ma resta da sistemare';
            bs.innerHTML = ICO_PAUSA;
            cmd.appendChild(bs);

            /* Il CESTINO: non butta via da solo, chiede se fuori volantino o eliminata. */
            var bc = document.createElement('button');
            bc.type = 'button';
            bc.className = 'icona cestino';
            bc.dataset.voce = v.id;
            bc.title = 'Togli dal volantino: scegli se fuori volantino o eliminata';
            bc.innerHTML = ICO_CESTINO;
            cmd.appendChild(bc);

            // j286: la matita, accanto al cestino come ha chiesto Michele
            if (v.idElemento) cmd.appendChild(bottoneMatita(v));

            /* j296: LA GRAFFETTA, su OGNI casella. Apre la finestra del gruppo, che da j296 fa
               tutte e due le cose: fa vedere le referenze che stanno in questa casella (e le
               stacca), e unisce a questa casella una referenza che sta da un'altra parte.
               In j295 erano due pulsanti; uno solo basta e la striscia resta leggibile. */
            var bg = document.createElement('button');
            bg.type = 'button';
            bg.className = 'icona graffetta';
            bg.draggable = false;
            bg.dataset.voce = v.id;
            bg.title = quanteQui > 1
                ? 'Gruppo di ' + quanteQui + ' referenze: guardale, staccane una, o unisci un\'altra'
                : 'Unisci a questa casella un\'altra referenza, per farle stare in una casella sola';
            bg.innerHTML = ICO_GRAFFETTA;
            cmd.appendChild(bg);

            /* Il DIVIETO sul box (j280). Michele l'ha voluto anche qui, oltre che sulla casella
               vuota e da trascinare: blocca la casella dove la referenza sta adesso, e la
               referenza «scorre di una posizione» - va nella prima casella buona dopo e le altre
               scalano dietro di lei. */
            var bd = document.createElement('button');
            bd.type = 'button';
            bd.className = 'icona divieto';
            bd.dataset.voce = v.id;
            bd.title = 'Blocca questa casella: la referenza scorre nella prima libera dopo';
            bd.innerHTML = ICO_DIVIETO;
            cmd.appendChild(bd);

            c.appendChild(cmd);

            /* LE MANIGLIE PER ALLARGARE (j275). Compaiono col mouse sopra il box: una striscia
               sul bordo destro per la larghezza, una sul bordo di sotto per l'altezza. Il meno
               si spegne quando si e' gia' a una casella sola. */
            function maniglia(verso, meno, piu) {
                var m = document.createElement('div');
                m.className = 'maniglia ' + verso;
                m.draggable = false;
                m.innerHTML =
                    '<button type="button" data-' + verso + '="1" data-voce="' + v.id + '" title="' + piu + '">+</button>' +
                    '<button type="button" data-' + verso + '="-1" data-voce="' + v.id + '" title="' + meno + '"' +
                    ((verso === 'largo' ? (v.colonne || 1) : (v.righe || 1)) <= 1 ? ' disabled' : '') +
                    '>&#8722;</button>';
                c.appendChild(m);
            }
            maniglia('largo', 'Stringi di una casella', 'Allarga di una casella');
            maniglia('alto', 'Abbassa di una casella', 'Alza di una casella');
        } else if (v.posizione) {
            /* j286: LA MATITA C'E' ANCHE QUANDO IL TIMONE E' IN SOLA LETTURA per chi guarda.
               Non e' una dimenticanza: la scheda dell'Edit avanzato ha permessi suoi - il
               Marketing salva, l'Agenzia conferma - e non c'entrano niente con chi in questo
               momento puo' spostare le referenze nel timone. Michele, 29/09: «se fanno modifiche
               l'agenzia deve poter salvare o confermare la correzione».
               Sta in alto a destra per non finire sopra il numero della casella. */
            if (v.idElemento) {
                var cm2 = document.createElement('div');
                cm2.className = 'cmd sola_matita';
                cm2.draggable = false;
                cm2.appendChild(bottoneMatita(v));
                c.appendChild(cm2);
            }
        }
        /* j291: sull'etichetta torna il CODICE GRUPPO per intero, come era prima di j290
           (Michele: «non mi garba che sia scomparso il codice gruppo dalle referenze»).
           j292b: e SENZA il «3x» davanti, che gli avevo messo per far vedere quante sono quando
           il codice e' lungo e la striscia lo taglia. Michele, 29/09: «togli anche quel 2x che hai
           messo davanti ai gruppi, non si può vedere». Quante sono si legge nel suggerimento del
           mouse e nei pannelli laterali, e nell'elenco del gruppo che arriva col passo dopo: non
           serve sporcare l'etichetta, che deve dire il codice e basta. */
        var cod = document.createElement('div');
        cod.className = 'cod';
        var testoCod = codiceDi(v);
        var tx = document.createElement('span');
        tx.className = 'txt';
        tx.textContent = testoCod;
        cod.appendChild(tx);
        /* j294: IL PULSANTINO CHE COPIA IL CODICE. Michele, 29/09: «se sono tanti i codici in un
           gruppo ci metti "..." e poi dai la possibilita' all'utente con un pulsantino di copiare
           tutto il codice anche se non lo vede. nel caso lo incollera' sulle sue note del pc».
           j305: c'e' SU TUTTE, anche sulle referenze singole. In j294 l'avevo messo solo sui
           gruppi, ragionando che un codice corto si legge e si ricopia a mano; ma chi lavora
           incolla, non ricopia, e non deve stare a guardare se quella casella e' un gruppo o no.
           Michele: «ho notato che nei singoli non mi hai messo il pulsante per copiare il codice..
           ne ho bisogno».
           draggable = false perche' la casella si trascina, e il tasto del mouse premuto sul
           pulsantino non deve far partire lo spostamento della referenza. */
        var bcp = document.createElement('button');
        bcp.type = 'button';
        bcp.className = 'icona copia';
        bcp.draggable = false;
        bcp.dataset.voce = v.id;
        bcp.title = quanteQui > 1
            ? 'Copia tutto il codice del gruppo (' + quanteQui + ' referenze):\n' + testoCod
            : 'Copia il codice: ' + testoCod;
        bcp.innerHTML = ICO_COPIA;
        cod.appendChild(bcp);
        c.appendChild(cod);

        foglio.appendChild(c);
    }

    /* DEPRECATO dal j300 - non la chiama piu' nessuno, e si tiene perche' sapere com'era fatta
       serve a chi legge.
       Era il contenuto della casella dal j254 al j296: un RITAGLIO della pagina stampata. La
       pagina e' un file statico gia' caricato nell'editor, e il taglio lo faceva il browser
       spostando l'immagine dentro un riquadro (la stessa tecnica della finestra delle
       propagazioni, j232) - quindi costava zero, nemmeno una chiamata.
       PERCHE' E' MORTA. Il ritaglio e' il BOX, non la referenza: dentro un gruppo si vedono tutte
       insieme, e una referenza staccata dal gruppo si vedrebbe ancora accanto alle compagne
       (Michele, 29/09: «quando sgruppiamo una referenza non si deve vedere il ritaglio del
       volantino, ci deve essere la foto del singolo caricata a sistema»). E mostrava la pagina
       GIA' STAMPATA, quindi una foto cambiata dalla scheda si vedeva solo dopo aver ricaricato.
       Al suo posto c'e' disegnaScheda, che usa la foto vera della referenza presa da Istanta.
       SE SI RIATTIVASSE: tornerebbero quei due difetti, e in piu' i due disegni si sovrapporrebbero
       nella stessa casella, perche' sono entrambi a tutta casella. Prima di rimetterla, chiedere. */
    function ritaglioDellaPagina(c, v, q, foglio, pw, ph, vw, vh) {
        var fOrig = document.querySelector('.foglio[data-numero="' + v.paginaOrigine + '"]') || foglio;
        var img = fOrig.querySelector('img.pagina');
        if (!img || !img.getAttribute('src')) return;
        var rit = document.createElement('div');
        rit.className = 'rit';
        var formaCasella = q.w / q.h, formaBox = vw / vh;
        if (formaBox >= formaCasella) {
            var alt = formaCasella / formaBox * 100;
            rit.style.left = '0'; rit.style.width = '100%';
            rit.style.height = alt + '%'; rit.style.top = ((100 - alt) / 2) + '%';
        } else {
            var lar = formaBox / formaCasella * 100;
            rit.style.top = '0'; rit.style.height = '100%';
            rit.style.width = lar + '%'; rit.style.left = ((100 - lar) / 2) + '%';
        }
        var i2 = document.createElement('img');
        i2.draggable = false;
        i2.src = img.getAttribute('src');
        i2.style.width = (pw / vw * 100) + '%';
        i2.style.height = (ph / vh * 100) + '%';
        i2.style.left = (-Number(v.x) / vw * 100) + '%';
        i2.style.top = (-Number(v.y) / vh * 100) + '%';
        rit.appendChild(i2);
        c.appendChild(rit);
    }

    /* Il riquadro che contiene tutte le referenze della pagina, in unita' di pagina. La griglia si
       disegna li' dentro e non su tutto il foglio: cosi' testata, piede e fasce restano fuori e le
       caselle cadono dove stanno davvero i prodotti. */
    function riquadro(voci, pagina) {
        var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
        (voci || []).forEach(function (v) {
            x1 = Math.min(x1, Number(v.x)); y1 = Math.min(y1, Number(v.y));
            x2 = Math.max(x2, Number(v.x) + Number(v.w)); y2 = Math.max(y2, Number(v.y) + Number(v.h));
        });
        if (isFinite(x1)) return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };

        // Nessun prodotto nato su questa pagina (per esempio perche' sono stati spostati tutti
        // altrove e ne sono arrivati di nuovi): il riquadro non si puo' dedurre, quindi si prende
        // la pagina intera con un margine, che e' la cosa piu' onesta.
        if (!pagina) return null;
        var l = Number(pagina.larghezza), h = Number(pagina.altezza);
        if (!l || !h) return null;
        return { x: l * 0.04, y: h * 0.06, w: l * 0.92, h: h * 0.88 };
    }

    /* Le caselle vuote della griglia, disegnate sotto le referenze: si vede subito quanti posti
       ci sono e quali sono liberi. Si contano per righe, da sinistra a destra. */
    function cellaDi(r, pagina, posizione) {
        var col = pagina.colonne, rig = pagina.righe;
        if (!col || !rig || !r) return null;
        var i = posizione - 1;
        if (i < 0 || i >= col * rig) return null;
        var cw = r.w / col, ch = r.h / rig;
        return { x: r.x + (i % col) * cw, y: r.y + Math.floor(i / col) * ch, w: cw, h: ch };
    }

    /* Da j275 una referenza puo' occupare piu' di una casella: la sua posizione e' quella in
       alto a sinistra, colonne e righe dicono quanto e' grande. Qui si ricava il rettangolo che
       tiene tutte le caselle. Null se sfora: in quel caso non si disegna, perche' sarebbe una
       bugia. */
    function rettangoloDi(r, pagina, posizione, colonne, righe) {
        var col = pagina.colonne, rig = pagina.righe;
        if (!col || !rig || !r || !posizione) return null;
        colonne = Math.max(1, Number(colonne) || 1);
        righe = Math.max(1, Number(righe) || 1);
        var i = posizione - 1;
        if (i < 0 || i >= col * rig) return null;
        var c0 = i % col, r0 = Math.floor(i / col);
        if (c0 + colonne > col || r0 + righe > rig) return null;
        var cw = r.w / col, ch = r.h / rig;
        return { x: r.x + c0 * cw, y: r.y + r0 * ch, w: cw * colonne, h: ch * righe };
    }

    function disegnaGriglia(foglio, pagina, r) {
        var pw = Number(pagina.larghezza), ph = Number(pagina.altezza);
        for (var k = 1; k <= pagina.righe * pagina.colonne; k++) {
            var q = cellaDi(r, pagina, k);
            var d = document.createElement('div');
            d.className = 'tim_cella';
            d.dataset.k = k;
            d.style.left = (q.x / pw * 100) + '%';
            d.style.top = (q.y / ph * 100) + '%';
            d.style.width = (q.w / pw * 100) + '%';
            d.style.height = (q.h / ph * 100) + '%';
            /* j280: passando sopra una casella vuota compare il divieto. E' la strada piu' corta
               per bloccare un posto: e' proprio li' che si vuole che non vada niente. */
            d.innerHTML = '<span>' + k + '</span>' +
                (piano.puoScrivere === true
                    ? '<button type="button" class="blocca" data-pag="' + pagina.id + '" data-k="' + k +
                      '" title="Blocca questa casella: qui non andra' + '\' niente">' + ICO_DIVIETO + '</button>'
                    : '');
            foglio.appendChild(d);
        }
    }

    function disegna() {
        pulisci();
        if (!piano || !piano.esiste) return;

        var fogli = fogliVisibili();
        var prima = null, primoNumero = numeroPaginaVisibile(), primoQuante = 0, primoReferenze = 0;

        fogli.forEach(function (foglio) {
            var numero = parseInt(foglio.dataset.numero, 10);
            var pagina = (piano.pagine || []).filter(function (p) { return p.numero === numero; })[0];
            if (!pagina) return;

            /* Fuori, eliminate e sospese non stanno in pagina.
               E da j290 il piano tiene UNA VOCE PER REFERENZA, non per box: un gruppo di tre
               referenze sono tre voci, ma occupano UNA casella - quella del capogruppo, l'unico
               con la posizione. Qui si disegnano le caselle, quindi si prendono solo i
               capogruppo: gli altri gli stanno dietro e non hanno un posto loro.
               Senza questo filtro le tre referenze di un gruppo si disegnerebbero una sopra
               l'altra, tutte alla geometria dello stesso box. */
            var tutteInPagina = (piano.voci || []).filter(function (v) {
                return v.stato === 0 && v.idPagina === pagina.id;
            });
            var dentro = tutteInPagina.filter(function (v) { return !!v.posizione; });
            // la FORMA della pagina la danno solo i prodotti nati qui: quelli arrivati da
            // un'altra pagina hanno coordinate che su questo foglio non vogliono dire niente
            var nativi = dentro.filter(function (v) { return v.paginaOrigine === pagina.numero; });
            // se la pagina non ha ancora una griglia scelta, le si mette quella che ha gia'
            // nell'impaginato: cosi' il rettangolino evidenziato dice sempre la verita'
            grigliaDiPartenza(pagina, nativi, dentro.length);
            // se la griglia arriva da un salvataggio, e' lei il pavimento: allargando si puo'
            // salire, stringendo si torna fin qui
            if (!pagina.grigliaBase && pagina.griglia) pagina.grigliaBase = pagina.griglia;
            var r = riquadro(nativi, pagina);
            var conGriglia = pagina.righe > 0 && pagina.colonne > 0 && r;
            if (conGriglia) disegnaGriglia(foglio, pagina, r);
            dentro.forEach(function (v) {
                disegnaCasella(foglio, v, pagina,
                    conGriglia ? rettangoloDi(r, pagina, v.posizione, v.colonne, v.righe) : null);
            });
            // j280: sopra a tutto, le caselle bloccate. Si disegnano per ultime apposta: devono
            // vedersi, sono la cosa che dice «qui non mettere niente».
            if (conGriglia) blocchiDi(pagina.id).forEach(function (b) {
                disegnaBloccata(foglio, pagina, b, cellaDi(r, pagina, b.posizione));
            });

            if (!prima) {
                prima = pagina; primoNumero = numero;
                primoQuante = dentro.length;                 // le CASELLE occupate
                primoReferenze = tutteInPagina.length;       // le REFERENZE, gruppi sciolti nel conto
            }
        });

        /* il numero di pagina adesso sta nel campo della barra, non piu' nel testo di stato.
           Non si tocca il campo mentre ci si sta scrivendo dentro. */
        var cn = document.getElementById('tim_npag');
        document.getElementById('tim_tot').textContent = quantePagine();
        if (cn && document.activeElement !== cn) cn.value = primoNumero;

        // il divieto da trascinare si vede solo a chi puo' scrivere (j280)
        etDivieto.style.display = (piano.puoScrivere === true) ? '' : 'none';
        var quanteBloccate = prima ? blocchiDi(prima.id).length : 0;

        document.getElementById('tim_stato').textContent =
            /* j290: caselle e referenze non sono piu' la stessa cosa. Una pagina puo' avere 6
               caselle e 9 referenze, perche' un gruppo occupa una casella e dentro ne tiene tre.
               Quando i due numeri coincidono si scrive solo quello, sennò la barra direbbe due
               volte la stessa cifra. */
            primoQuante + (primoQuante === 1 ? ' casella' : ' caselle') +
            (primoReferenze !== primoQuante
                ? ' · ' + primoReferenze + (primoReferenze === 1 ? ' referenza' : ' referenze')
                : (primoQuante === 1 ? ' (1 referenza)' : '')) +
            (quanteBloccate ? ' · ' + quanteBloccate +
                (quanteBloccate === 1 ? ' casella bloccata' : ' caselle bloccate') : '') +
            /* j282: qui la griglia non si scrive piu'. Michele, 29/09: «leverei sicuramente la
               specifica del (2 colonne × 3 righe)». E il nome della griglia lo dice gia' il
               pulsante qui accanto, che ora sta appiccicato al numero di pagina: scriverlo due
               volte a un metro di distanza era solo roba in piu' da leggere. Le colonne e le
               righe restano nel «title» del pulsante, per chi le vuole. */
            (piano.finestraAperta ? ' · finestra Marketing aperta fino al ' + quando(piano.finestraFine) : '');

        document.getElementById('tim_prec').disabled = primoNumero <= 1;
        document.getElementById('tim_succ').disabled = primoNumero >= quantePagine();

        aggiornaGriglia(prima, primoQuante);
        disegnaPannelli();
    }

    function disegnaPannelli() {
        var voci = (piano && piano.voci) ? piano.voci : [];
        var puo = piano && piano.puoScrivere === true;

        /* Una riga di pannello: da che pagina viene, il codice, il prezzo promo e - se si puo'
           scrivere - il modo di rimetterla in pagina. Il codice da solo non basta a riconoscere
           una referenza tolta dal volantino (Michele, 28/09). */
        function riempi(pan, lista, vuoto) {
            /* j291: UNA RIGA PER GRUPPO, non per referenza. Un gruppo di tre referenze mandato
               fuori volantino sono tre voci nel piano, ma e' un gesto solo e deve restare una
               riga sola: sennò premi il cestino una volta e ti compaiono tre schede.
               Il numeretto sulla testa conta le righe, cioe' le cose che l'utente ha spostato. */
            lista = lista.filter(eIlCapo);
            pan.querySelector('.n').textContent = lista.length;
            var corpo = pan.querySelector('.corpo');
            if (!lista.length) { corpo.innerHTML = '<div class="vuoto">' + vuoto + '</div>'; return; }
            /* j300: OGNI RIGA CON LA SUA FOTO. Michele, 29/09, sulla referenza staccata: «non si
               deve vedere il ritaglio del volantino, ci deve essere la foto del singolo caricata a
               sistema o il no foto nel caso non ci sia». Qui prima non c'era nessuna immagine; la
               foto e' quella della referenza (la primaria del gruppo, se e' un gruppo), chiesta a
               Istanta come per le caselle. */
            corpo.innerHTML = lista.map(function (v) {
                var quanteG = quanteNelGruppo(v);
                var pr = primariaDi(v);
                if (v.idElemento && !schedePerBox[String(v.idElemento)]) {
                    chiediSchedaBox(v.idElemento, function () { ridisegnaFraPoco(); });
                }
                var via = (pr.f && (pr.f.guidFoto || '').trim())
                    ? miniaturaDi(pr.f.guidFoto, 120) : VIA_NOFOTO;
                return '<div class="voce" data-voce="' + v.id + '">' +
                       '<div class="conFoto">' +
                       '<img class="mini" src="' + esc(via) + '" alt="" draggable="false">' +
                       '<div class="testo">' +
                       '<div class="da">da pagina ' + esc(v.paginaOrigine || '?') +
                       ((v.meccanica || '').trim() ? ' · ' + esc(v.meccanica) : '') +
                       (quanteG > 1 ? ' · gruppo di ' + quanteG : '') + '</div>' +
                       '<b>' + esc(codiceDi(v)) + '</b>' +
                       (v.prezzo ? ' <span class="prezzo">' + esc(v.prezzo) + '</span>' : '') +
                       '<br>' + esc(leggibile(v.etichetta).substring(0, 70)) +
                       '</div></div>' +
                       (puo ? '<button type="button" class="rimetti_qui" data-voce="' + v.id +
                              '">rimettila in pagina</button>' : '') +
                       '</div>';
            }).join('');
        }

        /* Le tre scritte di pannello vuoto le ha dettate Michele (29/09): «mi scrivi "Niente
           fuori volantino", mi ci devi scrivere "Nessun elemento in fuori volantino." e al posto
           di "Niente eliminato" mi scrivi "Nessun elemento eliminato"». Tutte e tre cominciano
           con «Nessun elemento»: in tre pannelli in fila, uno sotto l'altro, tre modi diversi di
           dire la stessa cosa si leggono come tre cose diverse. */
        riempi(panSospesi, voci.filter(function (v) { return v.stato === 3; }),
               'Nessun elemento in sospeso.');
        riempi(panFuori, voci.filter(function (v) { return v.stato === 1; }),
               'Nessun elemento in fuori volantino.');
        riempi(panEliminate, voci.filter(function (v) { return v.stato === 2; }),
               'Nessun elemento eliminato.');
    }

    /* ---------- la griglia della pagina (j254) ----------
       Le griglie sono sette e fisse (1x3 … 5x4): nel nome il primo numero sono le COLONNE e il
       secondo le RIGHE. Quindi la 2x3 e' 2 colonne e 3 righe, e la 1x3 e' una striscia verticale.
       Le caselle si contano per righe, da sinistra a destra, e il numero che si vede sulla
       referenza e' proprio la sua casella.

       QUESTO COMMENTO ERA SBAGLIATO, ed e' stato corretto il 02/10 (j326): diceva «il primo
       numero sono le RIGHE». Era rimasto dalla prima versione (j254): il verso e' stato girato il
       28/09 (j261), quando Michele l'ha visto a schermo - «nella 2x3 mi stai facendo 3 colonne e
       2 righe, io voglio 3 righe e 2 colonne» - ma il commento qui non e' stato aggiornato. Il
       codice invece era giusto: prende righe e colonne da griglieAmmesse, che le riceve dal
       server (Servizi/GriglieFormato.cs), dove il verso e' quello buono. Lo si corregge perche'
       un commento che dice il contrario del codice fa perdere mezz'ora a chi cerca un difetto
       nelle griglie - a me e' successo oggi. */
    var bGriglia = document.getElementById('tim_bgriglia');

    /* Indovina che griglia ha gia' la pagina, guardando dove stanno davvero i prodotti.
       Si contano le colonne e le righe raggruppando i box che si sovrappongono in orizzontale
       (stessa colonna) e in verticale (stessa riga): e' come le conterebbe un occhio umano. */
    function indovinaGriglia(perForma, quante) {
        if (!perForma || !perForma.length) return null;
        var dentro = perForma;
        var amm = piano.griglieAmmesse || [];
        quante = quante || perForma.length;

        function quantiGruppi(inizio, fine) {
            var v = dentro.map(function (x) { return { a: Number(x[inizio]), b: Number(x[inizio]) + Number(x[fine]) }; })
                          .sort(function (p, q) { return p.a - q.a; });
            var gruppi = 0, limite = -Infinity;
            v.forEach(function (x) {
                // un po' di tolleranza: due box che si sfiorano appena sono nella stessa fila
                if (x.a >= limite - (x.b - x.a) * 0.35) { gruppi++; limite = x.b; }
                else if (x.b > limite) { limite = x.b; }
            });
            return gruppi;
        }

        var colonne = quantiGruppi('x', 'w');
        var righe = quantiGruppi('y', 'h');

        // 1) una griglia che combacia esattamente
        var g = amm.filter(function (x) { return x.colonne === colonne && x.righe === righe; })[0];
        // 2) altrimenti: stesse colonne, la piu' piccola che contiene tutti
        if (!g) g = amm.filter(function (x) { return x.colonne === colonne && x.posti >= quante; })[0];
        // 3) altrimenti: la piu' piccola che contiene tutti, e pazienza
        if (!g) g = amm.filter(function (x) { return x.posti >= quante; })[0];
        // e comunque non puo' essere piu' piccola di quante referenze ci sono davvero
        if (g && g.posti < quante) g = amm.filter(function (x) { return x.posti >= quante; })[0];
        return g || null;
    }

    /* Se la pagina non ha ancora una griglia, le si mette quella indovinata. Non conta come una
       modifica dell'utente: non ha scelto niente lui, si sta solo mostrando com'e' fatta la
       pagina. Al primo SALVA quella griglia diventa ufficiale, ed e' giusto cosi'. */
    function grigliaDiPartenza(pagina, nativi, quante) {
        if (pagina.griglia) return;
        var g = indovinaGriglia(nativi, quante);
        if (!g) return;
        pagina.griglia = g.nome;
        pagina.righe = g.righe;
        pagina.colonne = g.colonne;
        pagina.capienza = g.posti;
        // questa e' la griglia "di base" della pagina: allargando una referenza si puo' salire,
        // ma stringendola si torna fin qui e non piu' in giu' (Michele, 28/09)
        pagina.grigliaBase = g.nome;
    }

    /* ---------- la finestrella della scelta ----------
       Michele (28/09): non i sette rettangolini in fila nella barra, ma una finestra che si apre.
       Nella barra resta un bottone solo, che dice quale griglia ha la pagina adesso. */
    function aggiornaGriglia(pagina, quante) {
        var si = !!(piano && pagina);
        bGriglia.style.display = si ? '' : 'none';
        if (!si) { chiudiScelta(); return; }

        bGriglia.textContent = pagina.griglia
            ? 'griglia ' + pagina.griglia + '  \u25BE'
            : 'scegli la griglia  \u25BE';
        bGriglia.title = pagina.griglia
            ? pagina.colonne + (pagina.colonne === 1 ? ' colonna' : ' colonne') + ' \u00D7 ' +
              pagina.righe + (pagina.righe === 1 ? ' riga' : ' righe') + ', ' + pagina.capienza + ' posti'
            : 'Scegli come dividere la pagina';
        bGriglia.dataset.pagina = pagina.id;
        bGriglia.dataset.quante = quante;

        // se la finestrella e' aperta si ridisegna, cosi' segue il cambio di pagina
        if (document.getElementById('tim_scelta')) apriScelta();
    }

    function chiudiScelta() {
        var q = document.getElementById('tim_scelta');
        if (q) q.remove();
        bGriglia.classList.remove('aperto');
    }

    function apriScelta() {
        chiudiScelta();
        var idPag = Number(bGriglia.dataset.pagina);
        var quante = Number(bGriglia.dataset.quante || 0);
        var pagina = (piano.pagine || []).filter(function (p) { return p.id === idPag; })[0];
        if (!pagina) return;
        var puo = piano.puoScrivere === true;

        var q = document.createElement('div');
        q.id = 'tim_scelta';
        var dentro = '<h4>Griglia della pagina ' + pagina.numero + '</h4>' +
                     '<div class="quante">' + quante +
                     (quante === 1 ? ' referenza in pagina' : ' referenze in pagina') +
                     (puo ? '' : ' \u00B7 sola lettura') + '</div><div class="opzioni">';

        (piano.griglieAmmesse || []).forEach(function (g) {
            var celle = '';
            for (var k = 0; k < g.posti; k++) celle += '<i></i>';
            var spenta = !puo || g.posti < quante;
            dentro += '<button type="button" data-g="' + esc(g.nome) + '"' +
                      (g.nome === pagina.griglia ? ' class="scelta"' : '') +
                      (spenta ? ' disabled' : '') +
                      ' title="' + g.colonne + (g.colonne === 1 ? ' colonna' : ' colonne') + ' \u00D7 ' +
                      g.righe + (g.righe === 1 ? ' riga' : ' righe') +
                      (g.posti < quante ? ' \u2014 non bastano per le ' + quante + ' referenze' : '') + '">' +
                      '<span class="mini" style="grid-template-columns:repeat(' + g.colonne + ',1fr);' +
                      'grid-template-rows:repeat(' + g.righe + ',1fr)">' + celle + '</span>' +
                      '<span class="nome">' + esc(g.nome) + '</span>' +
                      '<span class="posti">' + g.posti + ' posti</span>' +
                      '</button>';
        });
        dentro += '</div><div class="fondo"><button type="button" id="tim_scelta_no">Chiudi</button></div>';
        q.innerHTML = dentro;
        document.body.appendChild(q);
        bGriglia.classList.add('aperto');

        document.getElementById('tim_scelta_no').addEventListener('click', chiudiScelta);
        q.querySelector('.opzioni').addEventListener('click', function (e) {
            var b = e.target.closest ? e.target.closest('button') : null;
            if (!b || b.disabled) return;
            scegliGriglia(idPag, b.dataset.g);
        });
    }

    bGriglia.addEventListener('click', function () {
        if (document.getElementById('tim_scelta')) chiudiScelta(); else apriScelta();
    });

    /* La griglia si cambia SOLO nella bozza: niente va al server finche' non si preme SALVA. */
    function scegliGriglia(idPag, nome) {
        var pagina = (piano.pagine || []).filter(function (p) { return p.id === idPag; })[0];
        if (!pagina || nome === pagina.griglia) { chiudiScelta(); return; }

        var g = (piano.griglieAmmesse || []).filter(function (x) { return x.nome === nome; })[0];
        var dentro = (piano.voci || []).filter(function (v) { return v.stato === 0 && v.idPagina === idPag; });
        if (!g) return;

        /* CASELLE E REFERENZE NON SONO LA STESSA COSA, e qui stava un bug che Michele ha chiamato
           «gigantesco» - a ragione.
           «dentro» sono tutte le referenze della pagina. Di queste, quelle di un gruppo che non
           tengono la casella hanno posizione null e NON OCCUPANO NIENTE: il gruppo sta tutto in
           una casella (j290). «caselle» sono quelle che una casella ce l'hanno davvero.
           Questo pezzo e' scritto prima che i gruppi esistessero, e trattava le due cose come una:
           contava dieci referenze dove le caselle occupate erano sei, e soprattutto rinumerava
           TUTTE le voci da 1 a N - quindi dava una casella anche alle referenze dei gruppi, che
           comparivano una seconda volta in pagina. Michele, 29/09: «ho provato a mettere una 4x3
           alla prima pagina che ha solo 6 referenze ed e' spuntato questo, come se si fossero
           sdoppiate le referenze». Erano proprio i quattro compagni di gruppo.
           REGOLA: per i POSTI si contano le caselle; per dire all'utente quante referenze ci sono
           si contano le referenze. */
        var caselle = dentro.filter(function (x) { return !!x.posizione; });

        // j280: le caselle bloccate occupano posto come le referenze
        var bl = blocchiDi(idPag);
        if (caselle.length + bl.length > g.posti) {
            var quanti = caselle.length + bl.length;
            var basta = (piano.griglieAmmesse || []).filter(function (x) { return x.posti >= quanti; })[0];
            chiudiScelta();
            messaggio('Non ci stanno',
                'In questa pagina ci sono ' + caselle.length +
                (caselle.length === 1 ? ' casella occupata' : ' caselle occupate') +
                (dentro.length !== caselle.length ? ' (' + dentro.length + ' referenze, perche\' i ' +
                 'gruppi stanno in una casella sola)' : '') +
                (bl.length ? ' e ' + bl.length + (bl.length === 1 ? ' casella bloccata' : ' caselle bloccate') : '') +
                ', e nella ' + nome + ' di posti ce ne sono ' + g.posti + '. ' +
                (basta ? 'La piu\' piccola che le contiene tutte e\' la ' + basta.nome + '.'
                       : 'Nessuna griglia e\' abbastanza grande: vanno prima tolte delle referenze.'));
            return;
        }

        var gVecchia = grigliaDi(pagina);

        if (qualcunoAllargato(dentro) || bl.length) {
            /* Con referenze allargate - o con caselle bloccate (j280) - non si puo' rinumerare
               alla cieca: si prova a sistemare la pagina nella griglia scelta, tenendo ognuno
               dov'e' se ci sta. I blocchi non si spostano mai: se non ci stanno, la griglia non
               va bene e non si fa niente. */
            var prova = provaSistemare(null, 1, 1, gVecchia || g, g, dentro, bl);
            if (!prova || prova.sospesi.length) {
                messaggio('Non ci stanno tutte',
                    'Nella ' + nome + ' quello che c\'e\' in questa pagina non ci sta come e\' ' +
                    'messo adesso. Restringi prima qualche referenza, libera una casella bloccata, ' +
                    'oppure scegli una griglia piu\' grande.');
                return;
            }
            dentro.concat(bl).forEach(function (x) {
                if (prova.posizioni[x.id] !== undefined) x.posizione = prova.posizioni[x.id];
            });
        } else {
            /* Le caselle tornano 1, 2, 3… senza buchi, tenendo l'ordine che hanno adesso.
               Si rinumerano SOLO quelle che una casella ce l'hanno: prima qui c'era «dentro», e
               le referenze dei gruppi - che hanno posizione null - finivano in coda e si
               prendevano una casella a testa. Era il bug delle referenze sdoppiate. */
            caselle.sort(function (a, b2) { return a.posizione - b2.posizione; })
                   .forEach(function (v, i2) { v.posizione = i2 + 1; });
        }

        pagina.griglia = g.nome;
        pagina.righe = g.righe;
        pagina.colonne = g.colonne;
        pagina.capienza = g.posti;
        // l'utente ha scelto: da qui in giu' non si scende da soli
        pagina.grigliaBase = g.nome;

        chiudiScelta();
        segnaModifica();
        disegna();
    }

    /* ---------- SPOSTARE LE REFERENZE DENTRO LA PAGINA (j268) ----------
       Si prende una referenza e la si trascina su un'altra casella. Le due regole le ha scelte
       Michele il 28/09:

       - su una casella GIA' OCCUPATA: la referenza si infila li' e le altre scalano, come quando
         si sposta una riga in un elenco. Chi sta in mezzo fra la partenza e l'arrivo si sposta di
         una casella nel verso opposto, e il buco lasciato dalla partenza viene riassorbito;
       - su una casella VUOTA: ci va e basta, e dov'era resta un buco. Se il Marketing vuole
         lasciare un posto libero apposta, deve poterlo fare.

       Per adesso si sposta solo DENTRO la stessa pagina: da una pagina all'altra e' il pezzo
       dopo, e finche' non c'e' un trascinamento su un'altra pagina viene semplicemente ignorato.

       Come sempre: si tocca solo la bozza, in banca dati non va niente finche' non si preme
       SALVA. */
    var trascinata = null;      // la voce che si sta spostando
    var evidenziato = null;     // l'ultima casella illuminata

    function vocePerId(id) {
        return (piano && piano.voci || []).filter(function (v) { return v.id === id; })[0] || null;
    }

    function spegniBersaglio() {
        if (evidenziato) { evidenziato.classList.remove('bersaglio'); evidenziato = null; }
    }

    /* Dove sta puntando il mouse: una casella occupata, una casella vuota, o niente di buono. */
    function bersaglioDi(e) {
        if (!aperto || !trascinata || !piano || piano.puoScrivere !== true) return null;

        /* j280: il divieto trascinato dalla barra. Va bene su qualunque casella di qualunque
           pagina - anche su una gia' occupata, li' la referenza scorre - ma non sui pannelli. */
        if (trascinata === DIVIETO) {
            var td = e.target && e.target.closest
                ? e.target.closest('.tim_casella, .tim_cella') : null;
            /* Se da e.target non si arriva a una casella - per esempio perche' sotto il cursore
               c'e' finito qualcos'altro - si guarda chi c'e' davvero in quel punto dello schermo.
               Il divieto si molla su una casella qualunque, quindi vale la pena insistere. */
            if (!td && document.elementsFromPoint) {
                var sotto = document.elementsFromPoint(e.clientX, e.clientY);
                for (var si = 0; si < sotto.length; si++) {
                    var el = sotto[si];
                    if (el.classList && (el.classList.contains('tim_casella')
                                         || el.classList.contains('tim_cella'))) { td = el; break; }
                    if (el.closest) {
                        var su = el.closest('.tim_casella, .tim_cella');
                        if (su) { td = su; break; }
                    }
                }
            }
            if (!td) return null;
            var fd = td.closest('.foglio');
            if (!fd) return null;
            var pd = (piano.pagine || []).filter(function (p) {
                return p.numero === parseInt(fd.dataset.numero, 10);
            })[0];
            if (!pd) return null;
            var kd;
            if (td.classList.contains('tim_casella')) {
                var vd = vocePerId(Number(td.dataset.voce));
                if (!vd || !vd.posizione) return null;
                kd = vd.posizione;
            } else {
                kd = Number(td.dataset.k);
            }
            if (!kd || bloccoIn(pd.id, kd)) return null;
            return { dove: td, tipo: 'divieto', pos: kd, pagina: pd };
        }

        // si puo' lasciare anche su uno dei tre pannelli: la referenza esce dalla pagina
        var pan = e.target && e.target.closest ? e.target.closest('.tim_pan') : null;
        if (pan) {
            var st = pan.id === 'tim_sospesi' ? 3 : pan.id === 'tim_fuori' ? 1 : pan.id === 'tim_eliminate' ? 2 : null;
            if (st === null || trascinata.stato === st) return null;
            return { dove: pan, tipo: 'pannello', stato: st };
        }

        var t = e.target && e.target.closest ? e.target.closest('.tim_casella, .tim_cella') : null;
        if (!t) return null;
        var foglio = t.closest('.foglio');
        if (!foglio) return null;

        var numero = parseInt(foglio.dataset.numero, 10);
        var pagina = (piano.pagine || []).filter(function (p) { return p.numero === numero; })[0];
        // per adesso solo dentro la stessa pagina
        if (!pagina || pagina.id !== trascinata.idPagina) return null;

        if (t.classList.contains('tim_casella')) {
            var v = vocePerId(Number(t.dataset.voce));
            if (!v || v.id === trascinata.id || !v.posizione) return null;
            return { dove: t, tipo: 'piena', pos: v.posizione, pagina: pagina };
        }
        var k = Number(t.dataset.k);
        if (!k) return null;
        return { dove: t, tipo: 'vuota', pos: k, pagina: pagina };
    }

    function sposta(v, b) {
        var partenza = v.posizione, arrivo = b.pos;
        if (!partenza || !arrivo || partenza === arrivo) return;

        var dentro = (piano.voci || []).filter(function (x) {
            return x.stato === 0 && x.idPagina === b.pagina.id;
        });

        /* ATTENZIONE AI RETTANGOLI (j275). Far scalare tutti di una casella funziona finche'
           ognuno ne occupa una: un rettangolo largo, spostato di uno, finirebbe a cavallo di due
           righe. Quindi se in pagina c'e' qualcosa di allargato non si fa scalare niente:
           - sulla casella VUOTA la referenza ci va lo stesso, se il suo rettangolo ci sta;
           - sulla casella PIENA le due si scambiano di posto, ma solo se sono della stessa
             misura; altrimenti si dice perche' non si puo' e non si tocca niente. */
        var g = grigliaDi(b.pagina);
        var allargati = qualcunoAllargato(dentro);

        if (allargati) {
            var altro = dentro.filter(function (x) { return x.id !== v.id && x.posizione === arrivo; })[0];
            if (b.tipo === 'piena' && altro) {
                var stessa = (altro.colonne || 1) === (v.colonne || 1) && (altro.righe || 1) === (v.righe || 1);
                if (!stessa) {
                    messaggio('Di misura diversa',
                        'In questa pagina ci sono referenze allargate, e «' + codiceDi(v) +
                        '» e «' + (altro.codice || '') + '» non occupano lo stesso numero di caselle: ' +
                        'scambiandole una delle due finirebbe fuori posto. Riportale prima alla stessa ' +
                        'misura, oppure spostale su caselle libere.');
                    return;
                }
                altro.posizione = partenza;
                v.posizione = arrivo;
            } else {
                // casella libera: ci va solo se tutto il suo rettangolo ci sta ed e' libero
                if (!ciStaLibero(g, conBlocchi(dentro, b.pagina.id), v.id, arrivo, v.colonne || 1, v.righe || 1)) {
                    messaggio('Non ci sta',
                        '«' + codiceDi(v) + '» occupa ' + (v.colonne || 1) + ' per ' + (v.righe || 1) +
                        ' caselle e da li\' non ci sta. Va messa dove c\'e\' spazio, o prima ristretta.');
                    return;
                }
                v.posizione = arrivo;
            }
        } else {
            if (b.tipo === 'piena') {
                /* Le altre scalano di una casella nel verso opposto. Da j280 lo scalamento non
                   puo' piu' essere un semplice +1 o -1: in mezzo ci puo' essere una casella
                   BLOCCATA, e scavalcandola due referenze finirebbero sopra il divieto. Allora si
                   prendono le caselle BUONE fra partenza e arrivo, in ordine, si guarda chi le
                   occupa, si toglie la referenza che si muove e la si rimette dove e' stata
                   lasciata: le altre scorrono da sole. Senza caselle bloccate il risultato e'
                   esattamente quello di prima. */
                var da = Math.min(partenza, arrivo), a = Math.max(partenza, arrivo);
                var buone = [];
                for (var k = da; k <= a; k++) if (!bloccoIn(b.pagina.id, k)) buone.push(k);
                var occ = buone.map(function (k2) {
                    return dentro.filter(function (x) { return x.posizione === k2; })[0] || null;
                });
                var iPart = buone.indexOf(partenza), iArr = buone.indexOf(arrivo);
                if (iPart >= 0 && iArr >= 0) {
                    occ.splice(iPart, 1);
                    occ.splice(iArr, 0, v);
                    occ.forEach(function (x, i2) { if (x) x.posizione = buone[i2]; });
                    segnaModifica();
                    disegna();
                    return;
                }
            }
            // sulla casella vuota non scala nessuno: dov'era resta un buco
            v.posizione = arrivo;
        }

        segnaModifica();
        disegna();
    }

    /* il divieto che si trascina dalla barra: non e' una voce, e' un segnaposto. Si riconosce da
       qui in poi perche' trascinata === DIVIETO (j280). */
    var DIVIETO = { divieto: true };

    document.addEventListener('dragstart', function (e) {
        var dv = e.target && e.target.closest ? e.target.closest('#tim_divieto') : null;
        if (dv) {
            if (!aperto || !piano || piano.puoScrivere !== true) return;
            trascinata = DIVIETO;
            dv.classList.add('sipiglia');
            try {
                /* 'move' e non 'copy' (difetto di j280, sistemato in j284): il dragover dice
                   dropEffect = 'move', e se qui si dichiara 'copy' il browser considera la
                   combinazione non ammessa e il rilascio non arriva mai. Sul box funzionava per
                   caso, perche' li' l'effetto era 'move' da entrambe le parti. */
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', 'divieto');
            } catch (x) { }
            return;
        }

        var c = e.target && e.target.closest ? e.target.closest('.tim_casella') : null;
        if (!aperto || !c || !c.classList.contains('mobile')) return;
        var v = vocePerId(Number(c.dataset.voce));
        if (!v) return;
        trascinata = v;
        c.classList.add('sipiglia');
        try {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(v.id));
        } catch (x) { /* qualche browser e' schizzinoso, ma il trascinamento parte lo stesso */ }
    });

    document.addEventListener('dragend', function () {
        trascinata = null;
        spegniBersaglio();
        document.querySelectorAll('.tim_casella.sipiglia, #tim_divieto.sipiglia').forEach(function (c) {
            c.classList.remove('sipiglia');
        });
    });

    document.addEventListener('dragover', function (e) {
        var b = bersaglioDi(e);
        if (!b) { spegniBersaglio(); return; }
        e.preventDefault();
        try { e.dataTransfer.dropEffect = 'move'; } catch (x) { }
        if (evidenziato !== b.dove) {
            spegniBersaglio();
            evidenziato = b.dove;
            evidenziato.classList.add('bersaglio');
        }
    });

    document.addEventListener('drop', function (e) {
        var b = bersaglioDi(e);
        if (!b) return;
        e.preventDefault();
        var v = trascinata;
        spegniBersaglio();
        trascinata = null;
        if (!v) return;
        if (b.tipo === 'divieto') { bloccaCasella(b.pagina, b.pos); return; }
        if (b.tipo === 'pannello') mandaA(v, b.stato); else sposta(v, b);
    });

    /* ---------- SPOSTARE DAL NUMERINO E DA UNA PAGINA ALL'ALTRA (j269) ----------
       Michele, 28/09: oltre al trascinamento, il numerino in alto a sinistra della casella
       diventa un menu a tendina con tutte le posizioni, e accanto c'e' un bottone «sposta a
       pagina». Scegliendo un'altra pagina la referenza ci arriva in POSIZIONE 1 e tutti gli
       altri box di quella pagina scalano; se la griglia e' gia' piena, si passa da soli alla
       griglia piu' grande.

       Come si fa scalare senza fare disastri: si cerca il PRIMO BUCO della pagina di arrivo e si
       spostano di uno solo le referenze che stanno prima di quel buco. Cosi' la casella 1 si
       libera, nessuno finisce fuori dalla griglia, e i buchi che il Marketing aveva lasciato piu'
       in la' restano dove sono. Se buchi non ce ne sono, la pagina e' piena: allora si prende la
       griglia piu' piccola che basti, e il primo buco diventa la prima casella nuova.

       Anche qui si tocca solo la bozza: in banca dati ci va solo premendo SALVA. */

    /* NEGLI APPUNTI (j294). Due strade, e la seconda serve davvero.
       navigator.clipboard esiste solo in «contesto sicuro»: https, oppure localhost. Correggo4 in
       casa gira dietro https e va; ma se un giorno lo si apre per prova su http con l'indirizzo
       della macchina, quella riga non c'e' e il pulsantino non farebbe niente, in silenzio.
       Percio' la seconda strada: una casella di testo nascosta, si seleziona, document.execCommand
       copia. E' vecchia e sconsigliata, ma e' l'unica che funziona anche su http, quindi resta.
       Torna true o false: chi chiama fa vedere l'esito, non si da' mai per scontato. */
    function negliAppunti(testo) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
                navigator.clipboard.writeText(testo);
                return true;
            }
        } catch (e) { /* si passa alla seconda strada */ }
        try {
            var ta = document.createElement('textarea');
            ta.value = testo;
            ta.setAttribute('readonly', '');
            // fuori dallo schermo, ma NON display:none: una casella nascosta non si puo' selezionare
            ta.style.cssText = 'position:fixed;top:-100px;left:-100px;opacity:0;';
            document.body.appendChild(ta);
            ta.select();
            ta.setSelectionRange(0, testo.length);
            var fatto = document.execCommand('copy');
            ta.remove();
            return !!fatto;
        } catch (e2) { return false; }
    }

    function avviso(testo) {
        var vecchio = document.getElementById('tim_avviso');
        if (vecchio) vecchio.remove();
        var a = document.createElement('div');
        a.id = 'tim_avviso';
        a.textContent = testo;
        document.body.appendChild(a);
        setTimeout(function () { if (a.parentNode) a.remove(); }, 4500);
    }

    function grigliaDi(pagina) {
        return (piano.griglieAmmesse || []).filter(function (g) { return g.nome === pagina.griglia; })[0] || null;
    }

    /* ---------- I GRUPPI, NEL BROWSER (j291) ----------
       Da j290 il piano tiene una voce per REFERENZA: un box che sul volantino ne contiene tre
       sono tre voci con lo stesso idGruppo, e la casella la tiene una sola - il capogruppo.

       Due cose, scoperte appena Michele ha guardato lo schermo.

       LA PRIMA, sua: «non mi garba che sia scomparso il codice gruppo dalle referenze». Aveva
       ragione: prima sull'etichetta del box c'era scritto «96807-1,96807-2,96807-3» e si capiva a
       colpo d'occhio che li' dentro ce n'erano tre. Dopo j290 la voce disegnata e' il capogruppo e
       sull'etichetta restava «96807-1»: sembrava una referenza sola. Il codice gruppo si rimette,
       ricostruito dalle voci del gruppo.

       LA SECONDA, mia, ed era peggio: il timone spostava SOLO il capogruppo. Mandando un gruppo su
       un'altra pagina, o nel cestino, i compagni restavano indietro - e al salvataggio il server
       rifiutava tutto («gruppo_pagine_diverse», «gruppo_senza_capo»). Il rifiuto era giusto, il
       gesto no: un gruppo e' un corpo solo e deve viaggiare tutto insieme. Adesso lo fa.

       IL CAPOGRUPPO e' la voce col numero piu' piccolo: e' stabile, e' quella che nello spezzare
       i codici ha preso il primo, e non dipende dalla casella - cosi' si riconosce anche quando il
       gruppo e' fuori pagina, dove nessuno ha piu' una casella. */
    function gruppoDi(v) {
        if (!v || v.idGruppo === null || v.idGruppo === undefined) return v ? [v] : [];
        return (piano.voci || []).filter(function (x) { return x.idGruppo === v.idGruppo; })
            .sort(function (a, b) { return a.id - b.id; });
    }

    function eIlCapo(v) {
        if (!v || v.idGruppo === null || v.idGruppo === undefined) return true;
        var g = gruppoDi(v);
        return g.length === 0 || g[0].id === v.id;
    }

    /* il codice da mostrare: per un gruppo sono i codici di tutte le sue referenze, come era
       scritto nel box del volantino */
    /* CHI TIENE LA CASELLA non e' sempre il «capogruppo» di eIlCapo, che e' soltanto quello col
       numero piu' basso. Finche' i gruppi nascevano da Istanta i due coincidevano: il primo codice
       si prendeva la casella. Ma da j295 si puo' staccare proprio quella che tiene la casella e
       passarla a un'altra, e da quel momento i due ruoli stanno su referenze diverse.
       Difetto mio, trovato in j296 guardando il codice: l'elenco del gruppo evidenziava la riga
       sbagliata e non scriveva piu' «casella N» da nessuna parte, e lo stacca non riconosceva piu'
       di stare staccando quella con la casella - quindi non la passava a nessuno e al salvataggio
       il server rifiutava (gruppo_senza_capo), giustamente.
       REGOLA: per tutto quello che riguarda la CASELLA conta tieneLaCasella; eIlCapo serve solo a
       scegliere UNA riga per gruppo nei pannelli laterali, dove nessuno ha una casella. */
    function tieneLaCasella(x) { return !!(x && x.posizione); }

    /* Chi rappresenta il gruppo: chi tiene la casella se c'e', sennò il primo per numero. */
    function capoDi(v) {
        var g = gruppoDi(v);
        return g.filter(tieneLaCasella)[0] || g[0] || v;
    }

    function codiceDi(v) {
        if (!v) return '';
        var g = gruppoDi(v);
        if (g.length < 2) return v.codice || '';
        return g.map(function (x) { return x.codice; }).join(',');
    }

    function quanteNelGruppo(v) {
        return gruppoDi(v).length;
    }

    /* Il gruppo segue il capo: stessa pagina, stesso stato. La casella la tiene solo il capo,
       quindi i compagni restano senza - ed e' l'invariante che il server pretende. */
    function seguiIlCapo(v) {
        if (!v || v.idGruppo === null || v.idGruppo === undefined) return;
        gruppoDi(v).forEach(function (x) {
            if (x.id === v.id) return;
            x.idPagina = v.idPagina;
            x.stato = v.stato;
            x.posizione = null;
            x.colonne = 1;
            x.righe = 1;
        });
    }

    /* ---------- LE CASELLE BLOCCATE (j280) ----------
       Una casella bloccata e' un posto dove non deve andare nessuna referenza, perche' li' ci
       andra' un elemento grafico. Nel browser le si tratta come se fossero referenze di una
       casella sola: cosi' tutti i conti gia' scritti - il primo buco, se un rettangolo ci sta,
       quanto serve di griglia - funzionano senza toccarli, basta passargli la lista allungata.
       L'id e' una stringa («b3») proprio per non confondersi mai con l'id di una voce, che e' un
       numero: cosi' un filtro per id non puo' prendere un blocco per una referenza.
       Il blocco prende UNA casella sola, per decisione di Michele (28/09). */
    var contaBlocchi = 0;

    function sistemaBlocchi() {
        if (!piano) return;
        if (!piano.blocchi) piano.blocchi = [];
        contaBlocchi = 0;
        piano.blocchi.forEach(function (b) {
            b.id = 'b' + (++contaBlocchi);
            b.colonne = 1;
            b.righe = 1;
            b.bloccata = true;
        });
    }

    function blocchiDi(idPagina) {
        return (piano && piano.blocchi ? piano.blocchi : []).filter(function (b) {
            return b.idPagina === idPagina && b.posizione;
        });
    }

    /* la lista delle voci in pagina piu' le caselle bloccate: e' quella che vuole ogni conto
       sull'occupazione delle caselle */
    function conBlocchi(dentro, idPagina) {
        return dentro.concat(blocchiDi(idPagina));
    }

    function bloccoIn(idPagina, posizione) {
        return blocchiDi(idPagina).filter(function (b) { return b.posizione === posizione; })[0] || null;
    }

    /* Infila qualcosa nella casella «casella» facendo SCORRERE chi c'e' gia': chi sta li' va
       nella prima casella buona dopo, e se anche quella e' occupata la catena continua. Le
       caselle bloccate si saltano. Michele (28/09), sul divieto messo dove c'e' gia' una
       referenza: «scorre di una posizione».
       Torna false se non c'e' dove farli scorrere: allora non si tocca niente. */
    function infilaIn(dentro, bl, g, casella) {
        if (!g || !g.posti || !casella) return false;
        var bloccate = {};
        bl.forEach(function (b) { if (b.posizione) bloccate[b.posizione] = true; });
        var chi = {};
        dentro.forEach(function (x) { if (x.posizione) chi[x.posizione] = x; });

        var celle = [];
        var k = casella;
        while (true) {
            celle.push(k);
            if (!chi[k]) break;              // qui e' libero: la catena finisce
            var s = k + 1;
            while (s <= g.posti && bloccate[s]) s++;
            if (s > g.posti) return false;   // non c'e' piu' posto dopo
            k = s;
        }
        // si risale la catena all'indietro, sennò ci si sovrascriverebbe addosso
        for (var i = celle.length - 2; i >= 0; i--) chi[celle[i]].posizione = celle[i + 1];
        return true;
    }

    /* La prima casella libera. Da j275 una referenza puo' occuparne piu' d'una, quindi non basta
       segnare la sua posizione: si segnano tutte le caselle del suo rettangolo. */
    function celleOccupate(dentro, g) {
        var prese = {};
        if (!g || !g.colonne) return prese;
        dentro.forEach(function (x) {
            if (!x.posizione) return;
            var i = x.posizione - 1, c0 = i % g.colonne, r0 = Math.floor(i / g.colonne);
            var cc = Math.max(1, x.colonne || 1), rr = Math.max(1, x.righe || 1);
            for (var r = r0; r < r0 + rr; r++)
                for (var c = c0; c < c0 + cc; c++) prese[r * g.colonne + c + 1] = true;
        });
        return prese;
    }

    /* ---------- QUANTI POSTI SERVONO DAVVERO IN UNA PAGINA (j326) ----------
       Michele, 02/10: «hai un problema con le griglie.. non vengono riadattate secondo il numero
       di prodotti in pagina. ho lasciato 6 elementi in pagina e poi ho messo un blocco e in
       automatico mi ha messo una 5x4 a caso».

       LA REGOLA, che e' una sola: si contano le CASELLE OCCUPATE, non le referenze. Un GRUPPO sta
       in una casella sola - il capogruppo tiene la posizione, i compagni hanno posizione null e
       non occupano niente (j290). Una referenza ALLARGATA invece occupa colonne x righe caselle
       (j275). Le caselle bloccate occupano una casella ciascuna (j279).

       PERCHE' QUESTA FUNZIONE ESISTE. La stessa regola serviva in TRE punti - quando si sposta
       una referenza su un'altra pagina, quando si blocca una casella, quando si allarga una
       referenza - ed era scritta tre volte. Il 29/09 (j305) l'errore e' stato corretto in UNO dei
       tre, e gli altri due hanno continuato a contare le referenze: sulla pagina 4 di Michele,
       che ha 6 caselle occupate e 16 referenze perche' dieci sono compagni di gruppo, bloccare
       una casella chiedeva una griglia da 17 posti invece che da 7, e la piu' piccola con 17
       posti e' proprio la 5x4. E' lo stesso difetto che Michele aveva gia' visto il 29/09 - «come
       se si fossero sdoppiate le referenze» - tornato da un'altra porta.
       Da qui in avanti il conto si fa QUI e in nessun altro posto: correggerlo una volta vuol
       dire correggerlo per tutti e tre.

       I due parametri in coda:
         piu  = quante caselle in piu' bisogna far stare (1 quando sta arrivando un blocco o una
                referenza nuova);
         sost = { id, colonne, righe } quando una referenza va contata con una misura diversa da
                quella che ha adesso, cioe' mentre la si sta allargando o restringendo. Quella
                referenza si conta SEMPRE, anche se per qualche motivo non avesse una posizione:
                e' lei il motivo del conto. */
    function postiCheServono(dentro, bl, piu, sost) {
        var area = (bl ? bl.length : 0) + (piu || 0);
        (dentro || []).forEach(function (x) {
            var e = !!(sost && x.id === sost.id);
            // compagno di gruppo: il gruppo sta in una casella sola, lui non ne occupa nessuna
            if (!x.posizione && !e) return;
            area += e ? Math.max(1, sost.colonne || 1) * Math.max(1, sost.righe || 1)
                      : Math.max(1, x.colonne || 1) * Math.max(1, x.righe || 1);
        });
        return area;
    }

    /* ---------- LA GRIGLIA TORNA GIU' DA SOLA (j327) ----------
       Michele, 02/10: «se io ho 6 referenze impaginate in una griglia 2x3 e aggiungo il blocco su
       una casella giustamente lui mi mette una 2x4, ma se io tolgo il blocco allora la griglia
       deve tornare una 2x3».

       Fino a j326 la griglia sapeva solo CRESCERE: si allargava quando serviva e poi restava
       grande per sempre, con le caselle vuote in mezzo. Da qui scende anche, e scende da sola nei
       quattro momenti in cui una pagina si svuota: si libera una casella bloccata, una referenza
       va in uno dei tre pannelli (fuori volantino, eliminata, in sospeso), una referenza se ne va
       su un'altra pagina, delle referenze si raggruppano (anche raggruppare libera caselle,
       perche' un gruppo sta in una casella sola).

       DUE PALETTI, e sono entrambi scelte di Michele:

       1. NON SI SCENDE SOTTO «grigliaBase», cioe' la griglia che l'utente ha scelto a mano o
          quella che la pagina aveva all'apertura del timone. Michele, scegliendo fra tre strade
          il 02/10: «sì, ma non sotto quella che ho scelto io». Serve a questo: se uno mette
          apposta una 3x4 su una pagina con sei referenze per tenersi lo spazio libero, bloccare e
          sbloccare una casella non gli deve portare via quello spazio.
          ⚠ UN LIMITE DA SAPERE: grigliaBase vive solo nel browser. Dopo un SALVA e una riapertura
          del timone, la griglia salvata diventa la nuova grigliaBase - quindi se si salva stando
          in 2x4 e il giorno dopo si toglie il blocco, la pagina resta 2x4. Per farla tornare 2x3
          anche in quel caso servirebbe una colonna nuova in banca dati (volantini_timone_pagine.
          griglia_base): non e' stata fatta, e quando servira' si parte da qui.

       2. NESSUNA REFERENZA SI MUOVE. Si scende solo in una griglia che ha abbastanza colonne e
          abbastanza righe per lasciare tutti esattamente dove sono. Se per scendere bisognerebbe
          rimescolare la pagina, NON si scende: meglio una casella vuota in piu' che le referenze
          che ballano sotto gli occhi di chi guarda.
          Conseguenza, scritta perche' si veda: da una 3x4 con sei referenze nelle caselle 1-6 si
          torna alla 3x3 e non alla 2x3, perche' la terza colonna serve a tenerle ferme. Dalla 2x4
          alla 2x3 invece si scende sempre: le colonne sono le stesse, le posizioni non cambiano
          nemmeno di numero.

       Restituisce il nome del cambio ('2x4 a 2x3') per l'avviso, o null se non c'e' niente da
       fare. Non segna la modifica e non ridisegna: lo fa chi la chiama, che sta gia' facendo
       entrambe le cose. */
    /* ---------- SI CHIUDE IL BUCO (j327) ----------
       L'operazione INVERSA di infilaIn. Quando si mette qualcosa in una casella occupata, chi
       c'era «scorre» avanti e gli altri scalano dietro di lui (scelta di Michele, 28/09). Quindi
       quando si TOGLIE qualcosa, chi sta subito dopo deve scalare indietro: sennò resta un buco e
       le referenze restano piu' in basso di dove dovrebbero, e la griglia non puo' tornare giu'.

       E' proprio questo che mancava: nella prima prova di j327, togliendo il blocco da una 2x4 le
       sei referenze restavano nelle caselle 2-7 - cioe' su quattro righe - e nessuna griglia da
       tre righe le poteva contenere. La griglia restava 2x4 e Michele avrebbe rivisto lo stesso
       difetto da un'altra parte.

       LA REGOLA: si chiude un buco solo se SUBITO DOPO c'e' qualcuno. Se dopo il buco la fila e'
       vuota, non si tocca niente - non si va a ripescare roba da altre righe.
       Le caselle BLOCCATE non si muovono mai: il divieto sta dove l'ha messo l'utente, e chi
       scala indietro lo salta. E' anche il modo di tenersi un posto libero: se si vuole una
       casella vuota, si blocca. Una casella semplicemente vuota, nel timone, non e' uno spazio
       riservato - e' solo una casella vuota.
       Una referenza ALLARGATA non si fa scalare: spostata di una casella andrebbe a cavallo di due
       righe. Se il primo dopo il buco e' allargato, si lascia tutto com'e' (e' la stessa cautela
       che infilaIn ha dall'altro verso).

       Torna quante referenze sono scalate. */
    function chiudiIBuchi(pagina) {
        if (!piano || !pagina) return 0;
        var g = grigliaDi(pagina);
        if (!g || !g.posti) return 0;
        var dentro = vociInPagina(pagina.id);
        var bloccate = {};
        blocchiDi(pagina.id).forEach(function (b) { if (b.posizione) bloccate[b.posizione] = true; });

        var mossi = 0, ancora = true;
        while (ancora) {
            ancora = false;
            /* j328: «prese» sono TUTTE le caselle occupate, comprese quelle COPERTE da una
               referenza allargata - non solo quelle dove una referenza e' ancorata. Nella prima
               versione (j327) si guardava solo l'ancora: su una pagina con un box allargato, la
               casella che il box copre sembrava un buco e ci si infilava dentro la referenza
               successiva, una sopra l'altra. Si vedeva solo allargando, ed e' il motivo per cui
               questa riga c'e'. */
            var prese = celleOccupate(dentro, g);
            var chi = {};
            dentro.forEach(function (x) { if (x.posizione) chi[x.posizione] = x; });
            for (var k = 1; k <= g.posti; k++) {
                if (bloccate[k] || prese[k]) continue;      // qui non c'e' nessun buco
                var s = k + 1;
                while (s <= g.posti && bloccate[s]) s++;    // il divieto si salta, non si sposta
                if (s > g.posti || !prese[s]) break;        // dopo il buco non c'e' nessuno: finito
                var x = chi[s];
                // c'e' qualcosa, ma non e' l'ancora di nessuno: e' il corpo di una referenza
                // allargata, e il corpo non si stacca dalla sua testa
                if (!x) break;
                if (Math.max(1, x.colonne || 1) > 1 || Math.max(1, x.righe || 1) > 1) break;
                x.posizione = k;
                mossi++; ancora = true;
                break;
            }
        }
        return mossi;
    }

    function riadattaGiu(pagina) {
        if (!piano || !pagina) return null;
        var g = grigliaDi(pagina);
        if (!g) return null;

        var dentro = vociInPagina(pagina.id);
        var bl = blocchiDi(pagina.id);
        var area = postiCheServono(dentro, bl, 0);

        // quanta griglia serve per lasciare tutti dove sono: si guardano le posizioni vere, non
        // la griglia di adesso, sennò da quella non si scenderebbe mai
        var serveCol = 1, serveRig = 1;
        dentro.concat(bl).forEach(function (x) {
            if (!x.posizione) return;
            var q = x.posizione - 1;
            serveCol = Math.max(serveCol, (q % g.colonne) + Math.max(1, x.colonne || 1));
            serveRig = Math.max(serveRig, Math.floor(q / g.colonne) + Math.max(1, x.righe || 1));
        });

        var base = (piano.griglieAmmesse || []).filter(function (x) {
            return x.nome === pagina.grigliaBase;
        })[0];
        var pavimento = base ? base.posti : 0;

        var nuova = (piano.griglieAmmesse || []).filter(function (x) {
            return x.colonne >= serveCol && x.righe >= serveRig
                && x.posti >= area && x.posti >= pavimento;
        })[0];
        // da qui si scende e non si sale: salire e' il mestiere degli altri tre punti, che sanno
        // anche far scorrere le referenze e mandare in sospeso chi non ci sta
        if (!nuova || nuova.posti >= g.posti) return null;

        rifaiPosizioni(dentro.concat(bl), g, nuova);
        pagina.griglia = nuova.nome;
        pagina.righe = nuova.righe;
        pagina.colonne = nuova.colonne;
        pagina.capienza = nuova.posti;
        return g.nome + ' a ' + nuova.nome;
    }

    function primoBuco(dentro, g) {
        if (!g || !g.posti) return 0;
        var prese = celleOccupate(dentro, g);
        for (var k = 1; k <= g.posti; k++) if (!prese[k]) return k;
        return 0;      // nessun buco: la pagina e' piena
    }

    /* Il rettangolo che parte dalla casella "posizione" ci sta ed e' tutto libero?
       "escludiId" e' chi si sta spostando: le sue caselle di adesso non contano. */
    function ciStaLibero(g, dentro, escludiId, posizione, col, rig) {
        if (!g || !g.colonne || !posizione) return false;
        var i = posizione - 1, c0 = i % g.colonne, r0 = Math.floor(i / g.colonne);
        if (c0 + col > g.colonne || r0 + rig > g.righe) return false;
        // una casella bloccata non si esclude mai: l'id di un blocco e' una stringa, quello di
        // una voce un numero, ma il controllo si scrive lo stesso per chiarezza (j280)
        var prese = celleOccupate(dentro.filter(function (x) {
            return x.bloccata || x.id !== escludiId;
        }), g);
        for (var r = r0; r < r0 + rig; r++)
            for (var c = c0; c < c0 + col; c++)
                if (prese[r * g.colonne + c + 1]) return false;
        return true;
    }

    function qualcunoAllargato(dentro) {
        return dentro.some(function (x) { return (x.colonne || 1) > 1 || (x.righe || 1) > 1; });
    }

    /* Cambiare griglia cambia il SIGNIFICATO del numero di casella, perche' si conta per righe.
       Si tiene la posizione vera (riga e colonna) e si ricalcola il numero. */
    function rifaiPosizioni(dentro, gv, gn) {
        if (!gv || !gn || gv.colonne === gn.colonne) return;
        dentro.forEach(function (x) {
            if (!x.posizione) return;
            var i = x.posizione - 1;
            x.posizione = Math.floor(i / gv.colonne) * gn.colonne + (i % gv.colonne) + 1;
        });
    }

    function spostaInPagina(v, dest) {
        if (!v || !dest || v.idPagina === dest.id) return;

        // j327: la pagina da cui parte, letta prima di spostare. Perde una casella, quindi alla
        // fine la sua griglia puo' tornare giu'.
        var daDove = paginaDi(v.idPagina);

        var dentro = (piano.voci || []).filter(function (x) {
            return x.stato === 0 && x.idPagina === dest.id;
        });

        // se la pagina di arrivo non ha ancora una griglia, le si mette quella che ha nell'impaginato
        grigliaDiPartenza(dest, dentro.filter(function (x) { return x.paginaOrigine === dest.numero; }),
                          dentro.length);
        var g = grigliaDi(dest);
        // j280: le caselle bloccate contano come occupate, sennò la referenza andrebbe a finirci sopra
        var bl = blocchiDi(dest.id);
        var buco = g ? primoBuco(conBlocchi(dentro, dest.id), g) : dentro.length + 1;
        var cambiata = null;

        if (g && !buco) {
            /* Pagina piena: si cerca la piu' piccola griglia che basti. E non basta che abbia piu'
               POSTI: deve avere abbastanza COLONNE e abbastanza RIGHE per tutto quello che c'e'
               gia', perche' le griglie non crescono in modo ordinato (dalla 2x4 alla 3x3 si
               guadagna una colonna ma si perde una riga). */
            // j326: il conto dei posti si fa in un posto solo, postiCheServono. Il «+1» e' la
            // referenza che sta arrivando. Prima questo conto era scritto qui a mano (j305) e in
            // altri due punti, dove era rimasto sbagliato: vedi il commento su postiCheServono.
            var area = postiCheServono(dentro, blocchiDi(dest.id), 1);
            var serveCol = g.colonne, serveRig = g.righe;
            conBlocchi(dentro, dest.id).forEach(function (x) {
                var cc = Math.max(1, x.colonne || 1), rr = Math.max(1, x.righe || 1);
                if (!x.posizione) return;
                var q = x.posizione - 1;
                serveCol = Math.max(serveCol, (q % g.colonne) + cc);
                serveRig = Math.max(serveRig, Math.floor(q / g.colonne) + rr);
            });
            var nuova = (piano.griglieAmmesse || []).filter(function (x) {
                return x.colonne >= serveCol && x.righe >= serveRig && x.posti >= area;
            })[0];
            if (!nuova) {
                messaggio('Non ci sta da nessuna parte',
                    'La pagina ' + dest.numero + ' e\' piena e non c\'e\' nessuna griglia abbastanza ' +
                    'grande per una referenza in piu\'. Va tolto prima qualcosa da quella pagina.');
                return;
            }
            cambiata = g.nome + ' a ' + nuova.nome;
            // il numero della casella cambia significato con le colonne: si ricalcola (j275).
            // Anche le caselle bloccate devono seguire, sennò il divieto si sposterebbe da solo.
            rifaiPosizioni(conBlocchi(dentro, dest.id), g, nuova);
            dest.griglia = nuova.nome;
            dest.righe = nuova.righe;
            dest.colonne = nuova.colonne;
            dest.capienza = nuova.posti;
            g = nuova;
            buco = primoBuco(conBlocchi(dentro, dest.id), g);     // adesso un buco c'e' di sicuro
        }

        /* Far scalare di una casella va bene finche' tutti occupano una casella sola: un
           rettangolo largo, spostato di uno, andrebbe a cavallo di due righe. Se in pagina c'e'
           qualcosa di allargato, invece di combinare guai si mette la referenza nella prima
           casella libera e lo si dice. */
        var casella = 1;
        if (g && (qualcunoAllargato(dentro) || bloccoIn(dest.id, 1))) {
            // con referenze allargate, o con la casella 1 bloccata, non si fa scalare niente:
            // la referenza va nella prima casella libera
            casella = buco || 1;
        } else if (g) {
            // j280: lo scorrimento salta le caselle bloccate
            if (!infilaIn(dentro, bl, g, 1)) casella = buco || 1;
        } else {
            dentro.forEach(function (x) {
                if (x.posizione && x.posizione < buco) x.posizione += 1;
            });
        }

        // se veniva da uno dei tre pannelli, torna in pagina a tutti gli effetti
        v.stato = 0;
        v.idPagina = dest.id;
        v.posizione = casella;
        v.colonne = 1;
        v.righe = 1;
        // j291: i compagni del gruppo vanno sulla pagina nuova con lui, sennò il gruppo
        // resterebbe a cavallo di due pagine e il salvataggio rifiuterebbe tutto
        seguiIlCapo(v);

        // j327: la pagina di partenza si e' liberata di una casella
        chiudiIBuchi(daDove);
        var tornata = riadattaGiu(daDove);
        segnaModifica();
        disegna();
        avviso('«' + codiceDi(v) + '» e\' andata in pagina ' + dest.numero + ', casella ' + casella +
               (casella !== 1 ? ' (in quella pagina ci sono referenze allargate, quindi non si fa scalare tutto)' : '') +
               (cambiata ? '. La pagina ' + dest.numero + ' e\' passata da ' + cambiata : '.') +
               (tornata && daDove ? ' La pagina ' + daDove.numero + ' e\' tornata da ' + tornata + '.' : ''));
    }

    var NOMESTATO = { 0: 'in pagina', 1: 'fuori volantino', 2: 'eliminata', 3: 'in sospeso' };

    /* Togliere una referenza dalla pagina: va in uno dei tre pannelli. Non si cancella niente -
       resta nel piano, con la sua pagina d'origine e il suo prezzo - e da li' si puo' rimettere
       in pagina quando si vuole. Gli elementi in sospeso bloccano il salvataggio (specifica 6.7);
       fuori volantino ed eliminate no, quelle sono una scelta. */
    function mandaA(v, stato) {
        if (!v || v.stato === stato) return;
        var quante = quanteNelGruppo(v);
        var nome = codiceDi(v);
        // j327: la pagina da cui esce, letta PRIMA di azzerarla: dopo non si saprebbe piu' quale
        // pagina e' rimasta con una casella in meno
        var daDove = paginaDi(v.idPagina);
        v.stato = stato;
        v.idPagina = null;
        v.posizione = null;
        // j291: un gruppo e' un corpo solo. Se va fuori pagina ci va tutto, sennò i compagni
        // restano in pagina senza casella e al salvataggio il server rifiuta (gruppo_senza_capo).
        seguiIlCapo(v);
        // j327: la pagina si e' liberata di una casella: si chiude il buco e la griglia puo'
        // tornare giu'
        chiudiIBuchi(daDove);
        var tornata = riadattaGiu(daDove);
        segnaModifica();
        disegna();
        avviso('«' + nome + '»' + (quante > 1 ? ' (gruppo di ' + quante + ')' : '') +
               ' e\' adesso ' + NOMESTATO[stato] +
               (stato === 3 ? '. Gli elementi in sospeso vanno sistemati prima di poter salvare.' : '.') +
               (tornata && daDove ? ' La pagina ' + daDove.numero + ' e\' tornata da ' + tornata + '.' : ''));
    }

    /* ================= L'ELENCO DELLE REFERENZE DI UN GRUPPO (j295) =================

       Michele, 29/09: «mi chiedono di poter sgruppare o raggruppare referenze... nell'edit
       avanzato esiste questa funzionalita', ma non e' visivo... se loro visivamente volessero
       vedere direttamente il prodotto eliminato dal gruppo e decidere se metterlo in pagina?».

       Qui c'e' la prima meta': VEDERE e STACCARE. Il raggruppare (la graffetta) viene dopo.

       DOVE STANNO I DATI. Le voci del timone sanno solo il codice: peso, descrizione della
       singola, prezzo e foto stanno in Istanta, e si chiedono alla stessa scheda che apre la
       matita - GET /Correzioni/Edit/{idBox}/Scheda - che da j293 porta anche il peso. La scheda
       e' per BOX, non per referenza: torna tutte le referenze di quel box, e si accostano al
       codice della voce. Si tiene da parte per box, cosi' riaprendo l'elenco non si richiede
       niente a Istanta.

       COSA NON FA. Non tocca il volantino: sciogliere un gruppo qui vuol dire che nel TIMONE
       quelle referenze non stanno piu' nella stessa casella. Michele, sul mettere anche l'azione
       nell'Edit avanzato: «No, basta il timone». */
    var schedePerBox = {};          // idElemento -> { stato: 'carico'|'ok'|'errore', foto, errore }

    function chiediSchedaBox(idElemento, poi) {
        var k = String(idElemento);
        var s = schedePerBox[k];
        if (s && s.stato !== 'carico') { poi(s); return; }
        /* Se la richiesta e' gia' in viaggio, la chiamata si METTE IN CODA. Se invece uscissi qui
           senza dire niente - come avevo scritto prima - chi chiude e riapre l'elenco mentre
           Istanta risponde resterebbe con «Chiedo a Istanta...» per sempre: la risposta arriva,
           ma nessuno gliel'ha piu' chiesta. */
        if (s && s.stato === 'carico') { s.attesa.push(poi); return; }
        var mio = { stato: 'carico', attesa: [poi] };
        schedePerBox[k] = mio;
        function finito(esito) {
            schedePerBox[k] = esito;
            mio.attesa.forEach(function (cb) { cb(esito); });
        }
        chiedi(C4_BASE + 'Correzioni/Edit/' + encodeURIComponent(k) + '/Scheda').then(function (j) {
            finito((j && j.ok)
                ? { stato: 'ok', foto: (j.dati && j.dati.foto) || [] }
                // il messaggio arriva sempre come campo, ma vale null: senza il «or» qui si
                // stampa la parola «null» all'utente
                : { stato: 'errore', errore: (j && (j.messaggio || '')) || 'Istanta non ha risposto.' });
        }).catch(function () {
            finito({ stato: 'errore', errore: 'Non si e\' riusciti a chiedere la scheda.' });
        });
    }

    /* La miniatura la serve Correggo4, non Istanta: /Foto/Miniatura?width=..&guidId=.. , la stessa
       che usa la scheda dell'Edit avanzato (Views/Volantini/Dettaglio.cshtml, funzione miniatura).
       Il browser non parla mai con Istanta direttamente. */
    function miniaturaDi(guid, larghezza) {
        return C4_BASE + 'Foto/Miniatura?width=' + larghezza + '&guidId=' + encodeURIComponent(guid);
    }

    /* QUANDO ARRIVA UNA SCHEDA si ridisegna, ma non una volta per scheda: le pagine con venti box
       sono venti risposte che arrivano a raffica, e venti ridisegni di fila si vedono. Si aspetta
       un attimo e si ridisegna una volta per tutte quelle arrivate nel frattempo.
       E non si ridisegna MENTRE si trascina una referenza: rifare il foglio sotto il mouse
       interrompe il trascinamento a metà. */
    var ridisegnoInAttesa = false;
    function ridisegnaFraPoco() {
        if (ridisegnoInAttesa) return;
        ridisegnoInAttesa = true;
        setTimeout(function () {
            ridisegnoInAttesa = false;
            if (document.querySelector('.tim_casella.sipiglia, #tim_divieto.sipiglia')) {
                ridisegnaFraPoco();          // si sta trascinando: si riprova piu' tardi
                return;
            }
            if (aperto) disegna();
        }, 90);
    }

    /* La referenza di un codice, come la manda Istanta: null se la scheda di quel box non e'
       ancora arrivata (o non e' arrivata affatto). */
    function refDiCodice(idElemento, codice) {
        if (!idElemento) return null;
        var s = schedePerBox[String(idElemento)];
        if (!s || s.stato !== 'ok') return null;
        return (s.foto || []).filter(function (f) { return f.codice === codice; })[0] || null;
    }

    /* CHI SI VEDE NELLA CASELLA. Non chi tiene il posto, ma la PRIMARIA di Istanta: e' quella che
       va in stampa. Sui dati veri di Michele le due cose spesso non coincidono - nella casella 1
       il posto lo tiene 152346-1 (i Kinderini) ma la primaria e' 237740-1 (Nutella Biscuits), e
       nei Magnum tiene il posto 96807-1 mentre la primaria e' 96807-2. Col ritaglio non si notava,
       perche' il ritaglio e' il box intero e la primaria ce l'ha dentro per forza.
       Se la scheda non e' ancora arrivata, o nessuna e' selezionata, si ripiega su chi tiene il
       posto: e' l'unica cosa che si sa per certo. */
    function primariaDi(v) {
        var g = gruppoDi(v);
        for (var i = 0; i < g.length; i++) {
            var f = refDiCodice(g[i].idElemento, g[i].codice);
            if (f && f.statoSelezione === 1) return { voce: g[i], f: f };
        }
        var q = capoDi(v);
        return { voce: q, f: refDiCodice(q.idElemento, q.codice) };
    }

    /* La scheda dentro la casella: fondo bianco, foto della referenza, codice, descrizione, peso,
       prezzo. Se la scheda del box non e' ancora arrivata la chiede e intanto disegna quello che
       sa gia' dal piano (codice, descrizione, prezzo): la casella non resta mai vuota. */
    function disegnaScheda(c, v) {
        var s = v.idElemento ? schedePerBox[String(v.idElemento)] : null;
        if (v.idElemento && !s) {
            chiediSchedaBox(v.idElemento, function () { ridisegnaFraPoco(); });
            s = schedePerBox[String(v.idElemento)];
        }
        var pr = primariaDi(v);
        var f = pr.f;
        var quanti = quanteNelGruppo(v);

        var sk = document.createElement('div');
        sk.className = 'sk';

        var box = document.createElement('div');
        box.className = 'foto';
        if (f && (f.guidFoto || '').trim()) {
            var im = document.createElement('img');
            im.draggable = false;
            im.setAttribute('alt', '');
            im.setAttribute('src', miniaturaDi(f.guidFoto, 220));
            box.appendChild(im);
        } else if (s && s.stato === 'carico') {
            var att = document.createElement('div');
            att.className = 'carico';
            att.textContent = 'carico…';
            box.appendChild(att);
        } else {
            var nf = document.createElement('img');
            nf.className = 'nofoto';
            nf.draggable = false;
            nf.setAttribute('src', VIA_NOFOTO);
            nf.setAttribute('alt', 'nessuna foto');
            nf.title = s && s.stato === 'errore'
                ? 'Foto non disponibili: ' + s.errore
                : 'A sistema non c\'e' + '\' una foto per questa referenza';
            box.appendChild(nf);
        }
        var loghi = (f && f.loghi) || [];
        if (loghi.length) {
            var bo = document.createElement('div');
            bo.className = 'bolli';
            loghi.slice(0, 3).forEach(function (l) {
                if (!l || !l.guidId) return;
                var li = document.createElement('img');
                li.draggable = false;
                li.setAttribute('alt', '');
                li.setAttribute('src', miniaturaDi(l.guidId, 60));
                li.title = l.sigla || l.nome || '';
                bo.appendChild(li);
            });
            box.appendChild(bo);
        }
        sk.appendChild(box);

        var info = document.createElement('div');
        info.className = 'info';
        var r1 = document.createElement('div');
        r1.className = 'riga1';
        var cc = document.createElement('span');
        cc.className = 'c';
        cc.textContent = pr.voce.codice;
        r1.appendChild(cc);
        if (f && (f.statoSelezione === 1 || f.statoSelezione === 2)) {
            var ps = document.createElement('span');
            ps.className = 'ps ' + (f.statoSelezione === 1 ? 'p' : 's');
            ps.textContent = f.statoSelezione === 1 ? 'P' : 'S';
            ps.title = f.statoSelezione === 1 ? 'Primaria in Istanta' : 'Secondaria in Istanta';
            r1.appendChild(ps);
        }
        if (quanti > 1) {
            var ch = document.createElement('span');
            ch.className = 'chip';
            ch.textContent = 'gruppo di ' + quanti;
            r1.appendChild(ch);
        }
        info.appendChild(r1);

        var dd = document.createElement('div');
        dd.className = 'd';
        // la descrizione del BOX: e' quella che va in stampa. Quella della singola referenza si
        // legge nell'elenco del gruppo (la graffetta), dove serve a distinguerle.
        dd.textContent = leggibile(v.etichetta) || (f && f.descrizione) || '';
        info.appendChild(dd);

        var tec = document.createElement('div');
        tec.className = 'tec';
        /* LA MECCANICA (j300). Michele, 29/09: «tra le info mettiamo anche la meccanica applicata
           per quella referenza (ad esempio BOX_STD o BOX_FID....)». Viene dal piano - e' il
           boxName del box, che sta nel database di Correggo4 - quindi si vede subito, senza
           aspettare Istanta. */
        if ((v.meccanica || '').trim()) {
            var mc = document.createElement('span');
            mc.className = 'mec';
            mc.textContent = v.meccanica;
            mc.title = 'Meccanica applicata a questo box';
            tec.appendChild(mc);
        }
        var pe = document.createElement('span');
        pe.className = 'pe';
        pe.textContent = (f && (f.peso || '').trim())
            ? (f.peso + (f.um ? ' ' + f.um : '')) : '';
        tec.appendChild(pe);
        info.appendChild(tec);

        var giu = document.createElement('div');
        giu.className = 'giu';
        var pz = document.createElement('span');
        pz.className = 'pz';
        // il prezzo del BOX, non quello di Istanta: e' quello che si stampa. Sui dati veri i due
        // a volte non coincidono (il 32664-1 sul box e' 4,52 € e in Istanta 4.53).
        pz.textContent = v.prezzo || '';
        giu.appendChild(pz);
        info.appendChild(giu);
        sk.appendChild(info);

        c.appendChild(sk);
    }

    function chiudiGruppo() {
        var q = document.getElementById('tim_gruppo');
        if (q) q.remove();
    }

    /* IL PULSANTE SI RITROVA, NON SI TIENE DA PARTE. Dopo un'unione il foglio si ridisegna da
       capo: la casella e i suoi pulsanti vengono buttati e rifatti, quindi il pulsante di prima
       non e' piu' attaccato alla pagina. Chiedergli dove sta darebbe zero, e la finestra
       schizzerebbe nell'angolo in alto a sinistra. Quindi ogni volta si ricerca quello nuovo. */
    function bottoneDi(v) {
        return document.querySelector('.tim_casella .cmd button.graffetta[data-voce="' + v.id + '"]');
    }

    function apriGruppo(bottone, v) {
        chiudiGruppo();
        var q = document.createElement('div');
        q.id = 'tim_gruppo';
        document.body.appendChild(q);
        q.dataset.voce = v.id;
        disegnaGruppo(v, null);
        mettiVicino(q, bottone);
        if (v.idElemento) {
            chiediSchedaBox(v.idElemento, function () {
                // se nel frattempo l'elenco e' stato chiuso o e' un altro, non si tocca niente
                var q2 = document.getElementById('tim_gruppo');
                if (q2 && q2.dataset.voce !== String(v.id)) return;
                disegnaGruppo(v, null);
                var b2 = bottoneDi(v) || bottone;
                mettiVicino(q2, b2);
            });
        }
    }

    /* la finestrella sta sotto al bottone se ci sta, sennò sopra; e mai fuori dallo schermo.
       E' la stessa regola di apriCestino, scritta una volta sola perche' ora la usano in due. */
    function mettiVicino(q, bottone) {
        var r = bottone.getBoundingClientRect();
        var lar = q.offsetWidth, alt = q.offsetHeight;
        q.style.left = Math.max(8, Math.min(window.innerWidth - lar - 8, r.left)) + 'px';
        q.style.top = (r.bottom + alt + 8 < window.innerHeight ? r.bottom + 6
                                                               : Math.max(8, r.top - alt - 6)) + 'px';
    }

    /* Disegna l'elenco. «chiCapo» diverso da null vuol dire che si sta staccando il capogruppo e
       si sta chiedendo chi tiene la casella: in quel caso l'elenco lascia il posto alla domanda. */
    function disegnaGruppo(v, chiCapo) {
        var q = document.getElementById('tim_gruppo');
        if (!q) return;
        var g = gruppoDi(v);
        var s = v.idElemento ? schedePerBox[String(v.idElemento)] : null;
        q.innerHTML = '';

        var h = document.createElement('h5');
        h.textContent = g.length > 1 ? 'Gruppo di ' + g.length + ' referenze' : v.codice;
        q.appendChild(h);
        var sub = document.createElement('div');
        sub.className = 'sotto';
        sub.textContent = g.length > 1
            ? 'Occupano una casella sola. Staccarne una la manda in sospeso, poi la rimetti in ' +
              'pagina da dove vuoi.'
            : 'Questa referenza sta da sola nella casella ' + (v.posizione || '') + '.';
        q.appendChild(sub);

        if (s && s.stato === 'carico') {
            var att = document.createElement('div');
            att.className = 'avvisino';
            att.textContent = 'Chiedo a Istanta foto, peso e prezzi…';
            q.appendChild(att);
        } else if (s && s.stato === 'errore') {
            var er = document.createElement('div');
            er.className = 'avvisino';
            er.textContent = 'Foto, peso e prezzi non disponibili: ' + s.errore +
                             ' I codici sotto sono quelli giusti.';
            q.appendChild(er);
        }

        if (chiCapo) {
            var box = document.createElement('div');
            box.className = 'chi';
            var pp = document.createElement('p');
            pp.textContent = '«' + chiCapo.codice + '» tiene la casella ' + chiCapo.posizione +
                             '. Staccandola, quella casella a chi resta?';
            // le altre del gruppo, in ordine di codice: e' come le legge lui sull'etichetta
            box.appendChild(pp);
            g.forEach(function (x) {
                if (x.id === chiCapo.id) return;
                var b = document.createElement('button');
                b.type = 'button';
                b.dataset.nuovocapo = x.id;
                b.textContent = x.codice + ' — tiene lei la casella';
                box.appendChild(b);
            });
            var la = document.createElement('button');
            la.type = 'button';
            la.className = 'lascia';
            la.dataset.lascia = '1';
            la.textContent = 'lascia stare';
            box.appendChild(la);
            q.appendChild(box);
            return;
        }

        g.forEach(function (x) {
            var f = null;
            if (s && s.stato === 'ok') {
                f = (s.foto || []).filter(function (y) { return y.codice === x.codice; })[0] || null;
            }
            var r = document.createElement('div');
            r.className = 'ref' + (tieneLaCasella(x) ? ' capo' : '');

            if (f && f.guidFoto) {
                var im = document.createElement('img');
                im.setAttribute('src', miniaturaDi(f.guidFoto, 92));
                im.setAttribute('alt', '');
                im.draggable = false;
                r.appendChild(im);
            } else {
                /* j300: anche qui il «no foto» e' quello di sistema, non una scritta mia (Michele,
                   29/09). Prima era un quadratino con «senza foto» scritto dentro: due segnaposti
                   diversi nella stessa schermata si leggono come due cose diverse. */
                var nf = document.createElement('img');
                nf.className = 'nofoto';
                nf.draggable = false;
                nf.setAttribute('src', VIA_NOFOTO);
                nf.setAttribute('alt', 'nessuna foto');
                nf.title = s && s.stato === 'ok'
                    ? 'A sistema non c\'e' + '\' una foto per questa referenza'
                    : 'Foto non ancora arrivate da Istanta';
                r.appendChild(nf);
            }

            var d = document.createElement('div');
            d.className = 'dati';
            var cc = document.createElement('div');
            cc.className = 'codice';
            if (f) {
                var ps = document.createElement('span');
                var st = (f.statoSelezione === 1 || f.statoSelezione === 2) ? f.statoSelezione : 3;
                ps.className = 'ps ' + (st === 1 ? 'p' : st === 2 ? 's' : 'n');
                ps.textContent = st === 1 ? 'P' : st === 2 ? 'S' : '–';
                ps.title = st === 1 ? 'Primaria in Istanta' : st === 2 ? 'Secondaria in Istanta'
                                                                       : 'Non selezionata in Istanta';
                cc.appendChild(ps);
            }
            cc.appendChild(document.createTextNode(x.codice));
            if (tieneLaCasella(x)) {
                var qq = document.createElement('span');
                qq.className = 'qui';
                qq.textContent = 'casella ' + x.posizione;
                qq.title = 'E\' lei che tiene la casella per tutto il gruppo';
                cc.appendChild(document.createTextNode(' '));
                cc.appendChild(qq);
            }
            d.appendChild(cc);

            if (f && f.descrizione) {
                var de = document.createElement('div');
                de.className = 'desc';
                de.textContent = f.descrizione;
                d.appendChild(de);
            }
            /* IL PESO e' il motivo per cui questo elenco esiste: dentro un gruppo descrizione,
               foto e prezzo del box sono uno solo, il peso invece distingue una referenza
               dall'altra (Michele: «aggiungici anche l'info del peso che e' importante»). */
            var pezzi = [];
            if (f && (f.peso || '').trim()) pezzi.push('peso ' + f.peso + (f.um ? ' ' + f.um : ''));
            if (f && (f.prezzoPromo || '').trim()) pezzi.push('prezzo ' + f.prezzoPromo);
            if (pezzi.length) {
                var nu = document.createElement('div');
                nu.className = 'numeri';
                nu.textContent = pezzi.join(' · ');
                d.appendChild(nu);
            }
            r.appendChild(d);

            var bv = document.createElement('button');
            bv.type = 'button';
            bv.className = 'via';
            bv.dataset.stacca = x.id;
            bv.innerHTML = ICO_SGRUPPA;
            if (g.length < 2) {
                bv.disabled = true;
                bv.title = 'Non e\' in un gruppo: non c\'e' + '\' niente da staccare';
            } else if (piano && piano.puoScrivere === true) {
                bv.title = 'Stacca «' + x.codice + '» dal gruppo: va negli elementi in sospeso';
            } else {
                bv.disabled = true;
                bv.title = 'Il timone e\' in sola lettura: staccare non si puo\'';
            }
            r.appendChild(bv);
            q.appendChild(r);
        });

        /* ---- e in fondo: UNISCI (j296). Solo a chi puo' scrivere: a chi guarda mostrare un
           elenco di cose che non puo' fare sarebbe una presa in giro. */
        if (!piano || piano.puoScrivere !== true) return;
        var u = document.createElement('div');
        u.className = 'unisci';
        var h6 = document.createElement('h6');
        h6.textContent = g.length > 1 ? 'Unisci un\'altra referenza a questo gruppo'
                                      : 'Unisci un\'altra referenza a questa casella';
        u.appendChild(h6);
        var su = document.createElement('div');
        su.className = 'sotto';
        su.textContent = 'Va nella casella ' + (v.posizione || '') + ' insieme a questa, e la sua ' +
                         'casella si libera.';
        u.appendChild(su);

        var cand = candidatiPer(v);
        if (cand.length === 0) {
            var nn = document.createElement('div');
            nn.className = 'niente';
            nn.textContent = 'In questa pagina non c\'e' + '\' nessun\'altra referenza da unire, e ' +
                             'non ci sono elementi in sospeso.';
            u.appendChild(nn);
            q.appendChild(u);
            return;
        }
        var mio = prezzoDi(v);
        var titolato = { pagina: false, sospesi: false };
        cand.forEach(function (x) {
            var sosp = x.stato === 3;
            var chiave = sosp ? 'sospesi' : 'pagina';
            if (!titolato[chiave]) {
                titolato[chiave] = true;
                var ti = document.createElement('div');
                ti.className = 'gruppetto';
                ti.textContent = sosp ? 'in sospeso' : 'in questa pagina';
                u.appendChild(ti);
            }
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'c';
            b.dataset.unisci = x.id;
            var c1 = document.createElement('span');
            c1.className = 'cod2';
            c1.textContent = codiceDi(x);
            b.appendChild(c1);
            var suo = prezzoDi(x);
            if (suo) {
                var pr = document.createElement('span');
                pr.className = 'pr' + (mio && suo !== mio ? ' diverso' : '');
                pr.textContent = suo;
                if (mio && suo !== mio) pr.title = 'Prezzo promo diverso da questa casella (' + mio + ')';
                b.appendChild(pr);
            }
            var dv = document.createElement('span');
            dv.className = 'dove';
            var quanteX = quanteNelGruppo(x);
            dv.textContent = (sosp ? 'in sospeso' : 'casella ' + x.posizione) +
                             (quanteX > 1 ? ' · gruppo di ' + quanteX : '');
            b.appendChild(dv);
            u.appendChild(b);
        });
        q.appendChild(u);
    }

    /* ================= UNIRE DUE REFERENZE IN UNA CASELLA (j296) =================

       Michele, 29/09: «se volessero mettere un singolo e unirlo con altre referenze per prendere
       meno spazio in volantino?». Meno spazio vuol dire una casella per tutte.

       CHI SI PUO' UNIRE. Una referenza per riga (il capogruppo: se e' un gruppo, entra tutto), e
       solo due razze:
        - quelle IN CASELLA IN QUESTA PAGINA: un gruppo sta su una pagina sola, il server rifiuta
          quelli a cavallo (gruppo_pagine_diverse), quindi da un'altra pagina non si puo' pescare;
        - quelle IN SOSPESO, da qualunque pagina vengano: e' dove finisce chi viene staccato, e
          unirla e' anche il modo di togliersela dai piedi (in sospeso il timone non si salva).
       Quelle fuori volantino ed eliminate no: sono state messe via di proposito, e ripescarle di
       nascosto da questa finestra sarebbe una sorpresa. Si rimettono in pagina dal loro pannello.

       IL PREZZO. Michele, sul cosa fare se i prezzi promo sono diversi: «Si', ma con un avviso».
       Quindi si unisce lo stesso, ma prima si vede il pallino arancione sulla riga e poi si legge
       una domanda che dice i DUE numeri. Il prezzo e' quello del box, e ce l'ho gia' nella voce
       (campo "prezzo", che il server riempie da prezzo_promo): non serve chiedere niente a Istanta. */
    function prezzoDi(v) {
        return ((v && v.prezzo) || '').trim();
    }

    function candidatiPer(v) {
        var mio = gruppoDi(v).map(function (x) { return x.id; });
        return (piano.voci || []).filter(function (x) {
            if (mio.indexOf(x.id) >= 0) return false;
            if (capoDi(x).id !== x.id) return false;    // una riga per gruppo: entra tutto lui
            if (x.stato === 3) return true;             // in sospeso: sempre
            return x.stato === 0 && x.idPagina === v.idPagina && !!x.posizione;
        }).sort(function (a, b) {
            // prima quelle in casella in questa pagina, in ordine di casella; poi i sospesi
            if ((a.stato === 3) !== (b.stato === 3)) return a.stato === 3 ? 1 : -1;
            return (a.posizione || 0) - (b.posizione || 0) || a.id - b.id;
        });
    }

    /* Un numero di gruppo che in questo piano non c'e' ancora. Il server non pretende niente su
       questo numero: gli serve solo per sapere chi sta con chi dentro lo stesso piano. */
    function nuovoIdGruppo() {
        var max = 0;
        (piano.voci || []).forEach(function (x) {
            if (x.idGruppo !== null && x.idGruppo !== undefined && x.idGruppo > max) max = x.idGruppo;
        });
        return max + 1;
    }

    function unisci(v, c) {
        if (!v || !c || !piano || piano.puoScrivere !== true) return;
        var pv = prezzoDi(v), pc = prezzoDi(c);
        if (pv && pc && pv !== pc) {
            messaggio('I prezzi promo sono diversi',
                '«' + codiceDi(v) + '» sta a ' + pv + ' e «' + codiceDi(c) + '» sta a ' + pc + '. ' +
                'Unendole finiscono in una casella sola, e sul volantino il prezzo che si stampa e\' ' +
                'uno: quello di «' + codiceDi(v) + '», che tiene la casella. Se non e\' quello ' +
                'giusto, il prezzo si cambia dalla matita.',
                'UNISCI COMUNQUE', function () { unisciDavvero(v, c); });
            return;
        }
        unisciDavvero(v, c);
    }

    function unisciDavvero(v, c) {
        var gid = (v.idGruppo === null || v.idGruppo === undefined) ? nuovoIdGruppo() : v.idGruppo;
        v.idGruppo = gid;
        var quanti = 0;
        /* Si prende il gruppo di «c» PRIMA di toccargli il numero: dopo, gruppoDi non lo
           ritroverebbe piu' insieme ai suoi, e i compagni resterebbero indietro - in pagina e
           senza casella, che al salvataggio e' proprio quello che il server rifiuta. */
        gruppoDi(c).forEach(function (x) {
            x.idGruppo = gid;
            x.idPagina = v.idPagina;
            x.stato = v.stato;
            x.posizione = null;        // la casella la tiene v: e' tutto il punto dell'unione
            x.colonne = 1;
            x.righe = 1;
            quanti++;
        });
        var nome = codiceDi(c);
        /* j327: unendo si LIBERANO caselle - le referenze che entrano nel gruppo lasciano la
           loro, perche' il gruppo sta in una casella sola. Quindi anche qui la griglia puo'
           tornare giu'. E' il caso meno evidente dei quattro, ed e' proprio per questo che va
           scritto: a guardare lo schermo sembra che non si sia tolto niente dalla pagina. */
        var paginaUnione = paginaDi(v.idPagina);
        chiudiIBuchi(paginaUnione);
        var tornata = riadattaGiu(paginaUnione);
        segnaModifica();
        disegna();
        disegnaGruppo(v, null);
        var bn = bottoneDi(v);
        if (bn) mettiVicino(document.getElementById('tim_gruppo'), bn);
        avviso('«' + nome + '»' + (quanti > 1 ? ' (gruppo di ' + quanti + ')' : '') +
               ' e\' entrata nella casella ' + v.posizione + ' con «' + v.codice + '»: adesso il ' +
               'gruppo e\' di ' + quanteNelGruppo(v) + ' referenze e occupa una casella sola.' +
               (tornata ? ' La pagina e\' tornata da ' + tornata + '.' : ''));
    }

    /* Stacca una referenza dal gruppo. Michele, sul dove finisce: «Negli elementi sospesi».
       TRE CASI, e il terzo e' quello che poteva far male:
       1. non e' il capogruppo: esce e basta;
       2. e' il capogruppo e nel gruppo restano in due: chi resta prende la casella senza chiedere
          niente, perche' non c'e' un'altra risposta possibile;
       3. e' il capogruppo e restano in tre o piu': la casella e' UNA e bisogna sapere a chi va.
          Michele: «Il timone lo chiede». Se non lo chiedessi e scegliessi io, al salvataggio il
          server avrebbe ragione a lamentarsi (gruppo_senza_capo) o sposterei una referenza in una
          casella che non ha scelto nessuno. */
    function stacca(v, nuovoCapoId) {
        if (!v || !piano || piano.puoScrivere !== true) return;
        var g = gruppoDi(v);
        if (g.length < 2) return;
        var restano = g.filter(function (x) { return x.id !== v.id; });

        if (tieneLaCasella(v)) {
            var nuovo = null;
            if (nuovoCapoId) nuovo = restano.filter(function (x) { return x.id === Number(nuovoCapoId); })[0] || null;
            else if (restano.length === 1) nuovo = restano[0];
            if (!nuovo) { disegnaGruppo(v, v); return; }       // la domanda: chi tiene la casella
            nuovo.posizione = v.posizione;
            nuovo.colonne = v.colonne || 1;
            nuovo.righe = v.righe || 1;
            nuovo.idPagina = v.idPagina;
            nuovo.stato = v.stato;
        }

        // prima si esce dal gruppo, POI si manda in sospeso: mandaA chiama seguiIlCapo, e se la
        // voce fosse ancora nel gruppo si porterebbe dietro tutti gli altri.
        v.idGruppo = null;
        v.colonne = 1;
        v.righe = 1;
        // un gruppo di uno non e' un gruppo: chi resta solo torna una referenza normale
        if (restano.length === 1) restano[0].idGruppo = null;

        var nome = v.codice;
        chiudiGruppo();
        mandaA(v, 3);
        /* IL MIO AVVISO CANCELLA QUELLO DI mandaA (ce n'e' uno per volta), e quello diceva la cosa
           piu' importante: un elemento in sospeso BLOCCA IL SALVATAGGIO - il server risponde
           «elementi_in_sospeso» e non scrive niente. Quindi la frase va ripetuta qui, sennò
           l'utente stacca, prova a salvare, si becca un rifiuto e non capisce perche'. Trovato dal
           collaudo di j295, che si era preso quel 409 in faccia. */
        avviso('«' + nome + '» e\' uscita dal gruppo ed e\' in sospeso. Adesso rimettila in pagina ' +
               'dove vuoi, oppure mandala fuori volantino o nel cestino: finche\' resta in sospeso ' +
               'il timone non si puo\' salvare.');
    }

    function chiudiCestino() {
        var q = document.getElementById('tim_cestino');
        if (q) q.remove();
    }

    function apriCestino(bottone, v) {
        chiudiCestino();
        var q = document.createElement('div');
        q.id = 'tim_cestino';
        q.innerHTML =
            '<h5>Togli «' + esc(codiceDi(v)) + '» dal volantino</h5>' +
            '<button type="button" data-s="1">' + ICO_FUORI + '<span>Fuori volantino' +
            '<small>Non va in pagina, ma resta una scelta fatta apposta. Non blocca il salvataggio.</small></span></button>' +
            '<button type="button" class="rossa" data-s="2">' + ICO_CESTINO + '<span>Eliminata' +
            '<small>Non deve piu' + '\' andare sul volantino. Non blocca il salvataggio.</small></span></button>';
        document.body.appendChild(q);

        mettiVicino(q, bottone);

        q.addEventListener('click', function (e) {
            var b = e.target.closest ? e.target.closest('button') : null;
            if (!b) return;
            chiudiCestino();
            mandaA(v, Number(b.dataset.s));
        });
    }

    function chiudiPagine() {
        var q = document.getElementById('tim_pagine');
        if (q) q.remove();
    }

    function apriPagine(bottone, v) {
        chiudiPagine();
        var sua = (piano.pagine || []).filter(function (p) { return p.id === v.idPagina; })[0];
        var q = document.createElement('div');
        q.id = 'tim_pagine';
        var ordinate = (piano.pagine || []).slice().sort(function (a, b) { return a.numero - b.numero; });
        var dentro = '<h5>Sposta «' + esc(codiceDi(v)) + '»</h5>' +
                     '<div class="sotto">Arriva in casella 1 e le altre scalano.</div>' +
                     '<div class="vai">manda a pagina' +
                     '<input type="text" inputmode="numeric" maxlength="4" ' +
                     'placeholder="n°" aria-label="numero di pagina">' +
                     '<button type="button" class="ok">vai</button></div>' +
                     '<div class="righe">';
        ordinate.forEach(function (p) {
            var quante = (piano.voci || []).filter(function (x) {
                return x.stato === 0 && x.idPagina === p.id;
            }).length;
            var piena = p.capienza > 0 && quante >= p.capienza;
            var cl = (p.id === v.idPagina ? 'qui' : '') + (piena ? ' piena' : '');
            dentro += '<button type="button" data-p="' + p.id + '" data-n="' + p.numero + '"' +
                      (cl.trim() ? ' class="' + cl.trim() + '"' : '') +
                      (p.id === v.idPagina ? ' disabled' : '') +
                      (piena ? ' title="Pagina piena: la griglia si allarga da sola"' : '') +
                      '>' + p.numero +
                      '<small>' + quante + (p.griglia ? '/' + p.capienza : '') + '</small></button>';
        });
        dentro += '</div>';
        q.innerHTML = dentro;
        document.body.appendChild(q);

        /* si va sulla pagina scritta a mano: e' il modo piu' veloce quando le pagine sono tante,
           perche' chi lavora sa gia' dove vuole mandare la referenza e non la cerca con gli occhi. */
        var campo = q.querySelector('.vai input');
        function vaiScritto() {
            var n = parseInt(campo.value, 10);
            var dest = ordinate.filter(function (p) { return p.numero === n; })[0];
            if (!dest) { campo.value = ''; campo.focus(); return; }
            if (dest.id === v.idPagina) { chiudiPagine(); return; }
            chiudiPagine();
            spostaInPagina(v, dest);
        }
        campo.addEventListener('keydown', function (e) {
            // l'Escape non si tocca: se lo chiudessi io, il gestore generale non troverebbe piu'
            // la finestrella e chiuderebbe tutto il timone
            if (e.key === 'Enter') { e.preventDefault(); vaiScritto(); }
        });
        q.querySelector('.vai button.ok').addEventListener('click', vaiScritto);

        // si apre accanto al bottone, senza uscire dallo schermo
        var r = bottone.getBoundingClientRect();
        var lar = q.offsetWidth, alt = q.offsetHeight;
        q.style.left = Math.max(8, Math.min(window.innerWidth - lar - 8, r.left)) + 'px';
        q.style.top = (r.bottom + alt + 8 < window.innerHeight ? r.bottom + 6 : Math.max(8, r.top - alt - 6)) + 'px';

        /* il riquadro si apre gia' sulla pagina dove la referenza sta adesso, cosi' con 40 pagine
           non si comincia sempre dalla 1. Si sposta solo lui, non la finestra del browser. */
        var righe = q.querySelector('.righe');
        var qui = righe.querySelector('button.qui');
        if (qui && righe.scrollHeight > righe.clientHeight) {
            righe.scrollTop = Math.max(0, qui.offsetTop - (righe.clientHeight / 2) + (qui.offsetHeight / 2));
        }
        // il cursore e' gia' nel campo: si scrive il numero e si preme Invio, senza altri clic
        try { campo.focus({ preventScroll: true }); } catch (e2) { campo.focus(); }

        righe.addEventListener('click', function (e) {
            var b = e.target.closest ? e.target.closest('button') : null;
            if (!b || b.disabled) return;
            var dest = (piano.pagine || []).filter(function (p) { return p.id === Number(b.dataset.p); })[0];
            chiudiPagine();
            spostaInPagina(v, dest);
        });
        if (sua) { /* niente: serviva solo a sapere da dove viene */ }
    }

    /* il menu a tendina del numerino: scegliere una casella e' come trascinarci sopra */
    document.addEventListener('change', function (e) {
        var sel = e.target;
        if (!aperto || !sel || sel.tagName !== 'SELECT' || !sel.closest('.tim_casella')) return;
        var v = vocePerId(Number(sel.dataset.voce));
        if (!v || piano.puoScrivere !== true) return;
        var arrivo = Number(sel.value);
        var pagina = (piano.pagine || []).filter(function (p) { return p.id === v.idPagina; })[0];
        if (!pagina || !arrivo || arrivo === v.posizione) return;
        // j280: sulla casella bloccata non ci si va nemmeno dal numerino
        if (bloccoIn(pagina.id, arrivo)) {
            disegna();
            avviso('La casella ' + arrivo + ' e\' bloccata: li\' non va nessuna referenza.');
            return;
        }
        var occupata = (piano.voci || []).some(function (x) {
            return x.stato === 0 && x.idPagina === pagina.id && x.id !== v.id && x.posizione === arrivo;
        });
        sposta(v, { tipo: occupata ? 'piena' : 'vuota', pos: arrivo, pagina: pagina });
    });

    document.addEventListener('click', function (e) {
        var puo = aperto && piano && piano.puoScrivere === true;
        var q = e.target && e.target.closest ? e.target : null;
        if (!q) return;

        var b = q.closest('.tim_casella .cmd button.vaipag');
        if (b) { if (puo) { var v1 = vocePerId(Number(b.dataset.voce)); if (v1) apriPagine(b, v1); }
                 e.stopPropagation(); return; }

        var bs = q.closest('.tim_casella .cmd button.pausa');
        if (bs) { if (puo) mandaA(vocePerId(Number(bs.dataset.voce)), 3); e.stopPropagation(); return; }

        var bc = q.closest('.tim_casella .cmd button.cestino');
        if (bc) { if (puo) { var v2 = vocePerId(Number(bc.dataset.voce)); if (v2) apriCestino(bc, v2); }
                  e.stopPropagation(); return; }

        /* j295 - l'elenco delle referenze del gruppo. Aprirlo non cambia niente, quindi lo puo'
           fare anche chi guarda: e' dentro l'elenco che lo strappo si spegne in sola lettura. */
        var bg2 = q.closest('.tim_casella .cmd button.graffetta');
        if (bg2) {
            var vg = vocePerId(Number(bg2.dataset.voce));
            if (vg) apriGruppo(bg2, vg);
            e.stopPropagation(); return;
        }

        var bst = q.closest('#tim_gruppo button[data-stacca]');
        if (bst) {
            if (puo) stacca(vocePerId(Number(bst.dataset.stacca)), null);
            e.stopPropagation(); return;
        }

        var bnc = q.closest('#tim_gruppo button[data-nuovocapo]');
        if (bnc) {
            var qg = document.getElementById('tim_gruppo');
            var vv = qg ? vocePerId(Number(qg.dataset.voce)) : null;
            if (puo && vv) stacca(vv, bnc.dataset.nuovocapo);
            e.stopPropagation(); return;
        }

        var bla = q.closest('#tim_gruppo button[data-lascia]');
        if (bla) { chiudiGruppo(); e.stopPropagation(); return; }

        /* j296 - unisci: la referenza scelta entra nella casella di questa. */
        var bun = q.closest('#tim_gruppo button[data-unisci]');
        if (bun) {
            var qg2 = document.getElementById('tim_gruppo');
            var vt = qg2 ? vocePerId(Number(qg2.dataset.voce)) : null;
            if (puo && vt) unisci(vt, vocePerId(Number(bun.dataset.unisci)));
            e.stopPropagation(); return;
        }

        /* j294 - il pulsantino che copia il codice del gruppo. Non passa da «puo»: copiare non
           cambia niente, quindi lo puo' fare anche chi il timone lo guarda e basta. */
        var bcp2 = q.closest('.tim_casella .cod button.copia');
        if (bcp2) {
            var v5 = vocePerId(Number(bcp2.dataset.voce));
            var testo5 = v5 ? codiceDi(v5) : '';
            if (testo5 && negliAppunti(testo5)) {
                // il segno di spunta per un attimo, poi torna il foglietto: si vede che e' andata
                bcp2.classList.add('fatto');
                bcp2.innerHTML = ICO_FATTO;
                setTimeout(function () {
                    bcp2.classList.remove('fatto');
                    bcp2.innerHTML = ICO_COPIA;
                }, 1400);
                avviso('Codice copiato: ' + testo5);
            } else {
                avviso('Il codice non si e\' potuto copiare. E\' questo, da copiare a mano: ' + testo5);
            }
            e.stopPropagation(); return;
        }

        /* j286 - la matita: apre la scheda dell'Edit avanzato. Non passa da «puo»: i permessi di
           quella scheda sono suoi e valgono anche quando il timone e' in sola lettura. */
        var bm = q.closest('.tim_casella .cmd button.matita');
        if (bm) {
            apriSchedaBox(vocePerId(Number(bm.dataset.voce)));
            e.stopPropagation(); return;
        }

        /* j280 - le tre strade per bloccare una casella, e quella per liberarla */
        var bd2 = q.closest('.tim_casella .cmd button.divieto');
        if (bd2) {
            if (puo) {
                var v4 = vocePerId(Number(bd2.dataset.voce));
                var pg4 = v4 ? paginaDi(v4.idPagina) : null;
                if (v4 && pg4 && v4.posizione) bloccaCasella(pg4, v4.posizione);
            }
            e.stopPropagation(); return;
        }

        var bb = q.closest('.tim_cella .blocca');
        if (bb) {
            if (puo) bloccaCasella(paginaDi(Number(bb.dataset.pag)), Number(bb.dataset.k));
            e.stopPropagation(); return;
        }

        var bx = q.closest('.tim_bloccata .libera');
        if (bx) {
            if (puo) liberaCasella(Number(bx.dataset.pag), Number(bx.dataset.k));
            e.stopPropagation(); return;
        }

        // dai pannelli si rimette in pagina: si sceglie quale, e arriva in casella 1
        var br = q.closest('.tim_pan .voce .rimetti_qui');
        if (br) { if (puo) { var v3 = vocePerId(Number(br.dataset.voce)); if (v3) apriPagine(br, v3); }
                  e.stopPropagation(); return; }

        // un clic fuori chiude le finestrelle
        if (document.getElementById('tim_pagine') && !q.closest('#tim_pagine')) chiudiPagine();
        if (document.getElementById('tim_cestino') && !q.closest('#tim_cestino')) chiudiCestino();
        if (document.getElementById('tim_gruppo') && !q.closest('#tim_gruppo')
            && !q.closest('.tim_casella .cmd button.gruppo')) chiudiGruppo();
    });

    /* ---------- ALLARGARE UNA REFERENZA (j275) ----------
       Michele, 28/09: una referenza deve poter prendere piu' di un posto, in larghezza o in
       altezza, «sempre rispettando la grandezza della griglia». E allargandola, le altre scalano.

       DUE COSE DA SAPERE, e la seconda e' un difetto che ho introdotto io in j269.

       1. La casella si conta PER RIGHE: in una griglia da 2 colonne la casella 3 e' la prima
          della seconda riga, in una da 3 colonne e' l'ultima della prima. Quindi il NUMERO della
          casella vuol dire cose diverse a seconda di quante colonne ha la griglia. Ogni volta che
          la griglia cambia bisogna tenere la posizione VERA (riga e colonna) e ricalcolare il
          numero. In j269, cambiando griglia da solo perche' la pagina era piena, questo non lo
          facevo: se la griglia nuova aveva un numero di colonne diverso, tutte le referenze di
          quella pagina finivano altrove senza che nessuno le avesse toccate. Qui e' sistemato, e
          spostaInPagina passa dalla stessa strada.

       2. Le griglie non crescono in modo ordinato: dalla 2x4 (2 colonne, 4 righe) alla 3x3 si
          guadagna una colonna ma si PERDE una riga. Quindi non basta cercare una griglia con piu'
          posti: ci vogliono abbastanza colonne E abbastanza righe E abbastanza posti.

       Come si fa scalare: si prova la griglia di adesso; se non basta si provano, dalla piu'
       piccola alla piu' grande, quelle che potrebbero bastare. Per ognuna: la referenza allargata
       si prende il suo rettangolo, chi non e' toccato resta dov'e', e chi e' stato scacciato va
       nella prima casella libera dove ci sta. Si tiene la prima griglia in cui non resta fuori
       nessuno. Se non ce n'e' nessuna, si prende comunque la migliore e chi resta fuori va in
       sospeso - che e' esattamente quello che dice la specifica (6.2). */

    /* ---------- BLOCCARE E LIBERARE UNA CASELLA (j280) ----------
       Se la casella e' gia' occupata da una referenza, quella SCORRE: va nella prima casella
       buona dopo e le altre scalano dietro di lei (scelta di Michele, 28/09). Se non c'e' piu'
       dove scorrere, si passa da soli alla griglia piu' piccola che basti - la stessa regola che
       vale gia' quando si sposta una referenza su una pagina piena. Se non basta nemmeno quella,
       non si fa niente e si dice perche'. */
    function bloccaCasella(pagina, posizione) {
        if (!piano || piano.puoScrivere !== true || !pagina || !posizione) return;
        var g = grigliaDi(pagina);
        if (!g) {
            messaggio('Prima la griglia',
                'Per bloccare una casella la pagina deve avere una griglia: senza griglia le ' +
                'caselle non ci sono.');
            return;
        }
        if (posizione > g.posti) return;
        if (bloccoIn(pagina.id, posizione)) return;       // gia' bloccata, non si fa niente

        var dentro = vociInPagina(pagina.id);
        var bl = blocchiDi(pagina.id);
        var prese = celleOccupate(dentro, g);
        var sopra = dentro.filter(function (x) { return x.posizione === posizione; })[0] || null;

        // una referenza ALLARGATA sopra la casella: non la si fa scorrere, sarebbe un disastro
        if (prese[posizione] && (!sopra || (sopra.colonne || 1) > 1 || (sopra.righe || 1) > 1)) {
            messaggio('C\'e\' una referenza allargata',
                'La casella ' + posizione + ' e\' presa da una referenza che ne occupa piu\' di una. ' +
                'Prima va ristretta o spostata, poi la casella si puo\' bloccare.');
            return;
        }

        var cambiata = null;
        if (sopra && !infilaIn(dentro, bl, g, posizione)) {
            /* non c'e' dove farle scorrere: si cerca la griglia piu' piccola che basti, come si fa
               gia' quando arriva una referenza su una pagina piena */
            var serveCol = g.colonne, serveRig = g.righe;
            /* j326 - ERA QUI IL DIFETTO CHE MICHELE HA TROVATO IL 02/10. Il conto diceva
                   area = somma di TUTTE le voci della pagina + le bloccate + 1
               e contava anche i compagni di gruppo, che non occupano nessuna casella. Sulla sua
               pagina 4 - 6 caselle occupate, 16 referenze - chiedeva 17 posti invece di 7, e
               l'unica griglia con 17 posti e' la 5x4: ecco la «5x4 a caso». Adesso il conto e'
               quello di postiCheServono, lo stesso per tutti e tre i punti. */
            var area = postiCheServono(dentro, bl, 1);
            dentro.concat(bl).forEach(function (x) {
                if (!x.posizione) return;
                var q = x.posizione - 1;
                serveCol = Math.max(serveCol, (q % g.colonne) + Math.max(1, x.colonne || 1));
                serveRig = Math.max(serveRig, Math.floor(q / g.colonne) + Math.max(1, x.righe || 1));
            });
            var nuova = (piano.griglieAmmesse || []).filter(function (x) {
                return x.colonne >= serveCol && x.righe >= serveRig && x.posti >= area;
            })[0];
            if (!nuova) {
                messaggio('Non c\'e\' dove farla scorrere',
                    'La pagina ' + pagina.numero + ' e\' piena e non c\'e\' nessuna griglia piu\' ' +
                    'grande fra quelle a sistema. Va prima tolta una referenza da questa pagina.');
                return;
            }
            cambiata = g.nome + ' a ' + nuova.nome;
            rifaiPosizioni(dentro.concat(bl), g, nuova);
            posizione = rifaiUna(posizione, g, nuova);
            pagina.griglia = nuova.nome;
            pagina.righe = nuova.righe;
            pagina.colonne = nuova.colonne;
            pagina.capienza = nuova.posti;
            g = nuova;
            if (!infilaIn(dentro, bl, g, posizione)) {
                messaggio('Non c\'e\' dove farla scorrere',
                    'Anche con la ' + g.nome + ' non si riesce a far scorrere le referenze di ' +
                    'questa pagina. Va prima tolto qualcosa.');
                return;
            }
        }

        piano.blocchi.push({ id: 'b' + (++contaBlocchi), idPagina: pagina.id, posizione: posizione,
                             colonne: 1, righe: 1, bloccata: true });
        segnaModifica();
        disegna();
        avviso('Casella ' + posizione + ' di pagina ' + pagina.numero + ' bloccata' +
               (sopra ? ': «' + codiceDi(sopra) + '» e\' scorsa di una posizione' : '') +
               (cambiata ? '. La pagina e\' passata da ' + cambiata : '.'));
    }

    /* il numero di una casella cambia significato quando cambiano le colonne: qui si ricalcola
       per un numero solo (rifaiPosizioni lo fa per una lista) */
    function rifaiUna(posizione, gv, gn) {
        if (!gv || !gn || gv.colonne === gn.colonne || !posizione) return posizione;
        var i = posizione - 1;
        return Math.floor(i / gv.colonne) * gn.colonne + (i % gv.colonne) + 1;
    }

    function liberaCasella(idPagina, posizione) {
        if (!piano || piano.puoScrivere !== true) return;
        var b = bloccoIn(idPagina, posizione);
        if (!b) return;
        piano.blocchi = piano.blocchi.filter(function (x) { return x !== b; });
        var pag = paginaDi(idPagina);
        /* j327 - LA RICHIESTA DI MICHELE: «se io ho 6 referenze impaginate in una griglia 2x3 e
           aggiungo il blocco su una casella giustamente lui mi mette una 2x4, ma se io tolgo il
           blocco allora la griglia deve tornare una 2x3». Bloccare e sbloccare sono la stessa
           operazione nei due versi, e la griglia deve seguire in entrambi. */
        var scalate = chiudiIBuchi(pag);
        var tornata = riadattaGiu(pag);
        segnaModifica();
        disegna();
        avviso('Casella ' + posizione + (pag ? ' di pagina ' + pag.numero : '') + ' liberata' +
               (scalate ? ': ' + scalate + (scalate === 1 ? ' referenza e\' scalata indietro'
                                                          : ' referenze sono scalate indietro') : '') +
               (tornata ? '. La pagina e\' tornata da ' + tornata : '.'));
    }

    /* ---------- LA MATITA: LA SCHEDA DELL'EDIT AVANZATO (j286) ----------
       La scheda non si rifa': e' quella che c'e' nell'editor da j200/j206, con descrizione, foto,
       loghi, prezzi, azioni e propagazioni. Il timone la apre sul box vero della referenza
       (v.idElemento, che il piano porta da sempre) attraverso l'unico gancio esposto dalla vista.

       PERCHE' SERVE UN GANCIO: tutto lo script di Dettaglio.cshtml sta dentro un involucro
       `(function () { ... })()`, e timone.js viene caricato dopo. Da qui apri() non si vede
       nemmeno. Quindi in fondo a quell'involucro c'e' UNA riga in piu' - additiva, non cambia
       niente di quello che c'era - che espone window.correggo4.schedaBox.

       PERMESSI: non li decide il timone. Li decide la scheda, che li ha giusti dal primo giorno -
       il Marketing salva e annulla, l'Agenzia conferma - e il server rifiuta comunque quello che
       non si puo' fare. Il Category il timone non lo vede nemmeno (403).

       PRIMA SI SALVA IL TIMONE: scelta di Michele (29/09). La scheda scrive in banca dati appena
       si preme il suo bottone, mentre gli spostamenti del timone restano nel browser fino al
       SALVA. Mescolare le due cose vuol dire che al primo ricaricamento della pagina uno si
       ritrova la correzione salvata e gli spostamenti persi, senza capire perche'. */
    function apriSchedaBox(v) {
        if (!v || !v.idElemento) return;

        var gancio = window.correggo4 && window.correggo4.schedaBox;
        if (!gancio || typeof gancio.apri !== 'function') {
            messaggio('Scheda non disponibile',
                'Questa pagina non espone la scheda dell\'Edit avanzato. Va ricaricata; se il ' +
                'problema resta, la vista del volantino e' + '\' piu\' vecchia del timone.');
            return;
        }

        if (modifiche > 0) {
            messaggio('Prima salva il timone',
                'Hai ' + modifiche + (modifiche === 1 ? ' modifica' : ' modifiche') + ' non ancora ' +
                'salvate nel timone. La correzione della scheda invece si salva subito: se le due ' +
                'cose si mescolano, al primo ricaricamento della pagina ti ritrovi la correzione ' +
                'salvata e gli spostamenti persi. Salva il timone e poi riapri la matita.',
                'SALVA IL TIMONE', function () { salva(); });
            return;
        }

        var esito = gancio.apri(v.idElemento);
        if (esito === 'fuori_policy') {
            messaggio('Non e\' fra i tuoi prodotti',
                '«' + codiceDi(v) + '» non e\' fra i prodotti che puoi correggere.');
            return;
        }
        if (esito !== 'ok') {
            messaggio('Scheda non disponibile',
                'Non si e\' trovato il prodotto di «' + codiceDi(v) + '» in questa pagina: ' +
                'puo\' capitare se il volantino e\' stato riesportato dopo l\'apertura del timone.');
            return;
        }
        soloLaReferenza(v);
    }

    /* ---------- NEL RITAGLIO SI VEDE SOLO LA REFERENZA (j288) ----------
       Michele, 29/09: «no così non va bene.. il focus deve essere solo sulla referenza.. qui si
       vedono 3 referenze.. così si fa casino».

       Com'e' fatto il ritaglio della scheda: la pagina intera viene rimpicciolita quel tanto che
       basta perche' il prodotto ci stia TUTTO dentro il riquadro, e poi spostata per centrarlo.
       Ma il riquadro e il prodotto hanno forme diverse: quello che resta ai lati (o sopra e sotto)
       si riempie con la pagina vera, cioe' con i prodotti vicini. Piu' il riquadro e' grande
       rispetto al prodotto, piu' vicini si vedono - e col rimpicciolimento di j287 il riquadro e'
       diventato un terzo piu' grande, quindi da uno o due se ne vedevano tre.

       Qui NON si rifa' il ritaglio: si coprono i lati. Quattro pannelli grigi, tutti attorno al
       rettangolo del prodotto, e quel rettangolo si calcola con lo stesso conto che fa l'editor
       (la scala e' il minimo fra larghezza e altezza disponibili). Cosi' dentro resta tutto quello
       che c'era - la foto, e anche le ombre rosse e verdi che segnano i pezzi corretti - e fuori
       non si vede piu' niente.

       Tutto vive sotto body.tim_on: appena il timone si chiude, i pannelli spariscono da soli e
       la scheda dell'editor torna esattamente come prima. */
    function soloLaReferenza(v) {
        var cont = document.getElementById('mRitaglio');
        if (!cont || !v) return;

        var vecchi = cont.querySelectorAll('.tim_copri');
        for (var k = 0; k < vecchi.length; k++) vecchi[k].remove();

        var vw = Number(v.w), vh = Number(v.h);
        cont.style.width = '';
        cont.style.height = '';
        var lc = cont.clientWidth, hc = cont.clientHeight;
        if (!vw || !vh || !lc || !hc) return;

        // il riquadro dove l'editor ha messo il prodotto: stesso conto suo
        var s = Math.min(lc / vw, hc / vh);
        var lp = vw * s, ap = vh * s;

        /* PRIMA COSA, ed e' quella che risolve: il riquadro si restringe alla FORMA DEL PRODOTTO.
           Cosi' non resta piu' spazio da riempire con la pagina, i vicini non ci entrano
           nemmeno, e quello che si risparmia in altezza lo guadagna l'elenco dei loghi che sta
           sotto - che era il problema di j287. Il riquadro non cresce mai: si restringe e basta. */
        var orig = (piano.pagine || []).filter(function (p) { return p.numero === v.paginaOrigine; })[0];
        var pagW = orig ? Number(orig.larghezza) : 0, pagH = orig ? Number(orig.altezza) : 0;
        var im = document.getElementById('mRitaglioImg');
        if (pagW && pagH && im && im.getAttribute('src')) {
            cont.style.width = lp + 'px';
            cont.style.height = ap + 'px';
            // rifatto il riquadro, la pagina va rimessa a posto con lo stesso conto dell'editor,
            // ma senza piu' il centramento: adesso il prodotto riempie il riquadro esatto
            im.style.width = (pagW * s) + 'px';
            im.style.height = (pagH * s) + 'px';
            im.style.left = (-Number(v.x) * s) + 'px';
            im.style.top = (-Number(v.y) * s) + 'px';
            lc = cont.clientWidth; hc = cont.clientHeight;
        }

        /* SECONDA COSA, la cintura di sicurezza: se per un arrotondamento o per un bordo il
           riquadro resta un filo piu' grande del prodotto, ai lati si vedrebbe una striscia del
           vicino. I quattro pannelli la coprono. Quando il conto e' esatto sono di misura zero e
           non vengono nemmeno creati. */
        var x0 = Math.max(0, (lc - lp) / 2), y0 = Math.max(0, (hc - ap) / 2);

        // i pannelli si appendono dentro il riquadro: se non e' posizionato, lo si posiziona -
        // controllando com'e' davvero invece di dare per scontato com'e' scritto nel foglio di stile
        if (window.getComputedStyle(cont).position === 'static') cont.style.position = 'relative';

        function copri(sin, su, lar, alt) {
            if (lar <= 0.5 || alt <= 0.5) return;
            var d = document.createElement('div');
            d.className = 'tim_copri';
            d.style.left = sin + 'px';
            d.style.top = su + 'px';
            d.style.width = lar + 'px';
            d.style.height = alt + 'px';
            cont.appendChild(d);
        }
        copri(0, 0, lc, y0);                          // sopra
        copri(0, y0 + ap, lc, hc - (y0 + ap));        // sotto
        copri(0, y0, x0, ap);                         // a sinistra
        copri(x0 + lp, y0, lc - (x0 + lp), ap);       // a destra
    }

    function paginaDi(idPagina) {
        return (piano.pagine || []).filter(function (p) { return p.id === idPagina; })[0] || null;
    }

    function vociInPagina(idPagina) {
        return (piano.voci || []).filter(function (v) {
            return v.stato === 0 && v.idPagina === idPagina;
        });
    }

    /* Prova a sistemare tutte le voci di una pagina dentro la griglia "gn", partendo dalle
       posizioni che hanno nella griglia "gv" e dando a "v" la misura nuova.
       Restituisce { posizioni, sospesi } oppure null se nemmeno la referenza allargata ci sta. */
    function provaSistemare(v, col, rig, gv, gn, dentro, bl) {
        function coord(p, g) { var i = p - 1; return { r: Math.floor(i / g.colonne), c: i % g.colonne }; }
        function numero(r, c, g) { return r * g.colonne + c + 1; }

        var mappa = new Array(gn.posti);
        for (var k = 0; k < mappa.length; k++) mappa[k] = 0;

        function ciSta(r0, c0, cc, rr) {
            if (c0 < 0 || r0 < 0 || c0 + cc > gn.colonne || r0 + rr > gn.righe) return false;
            for (var r = r0; r < r0 + rr; r++)
                for (var c = c0; c < c0 + cc; c++)
                    if (mappa[r * gn.colonne + c]) return false;
            return true;
        }
        function scrivi(id, r0, c0, cc, rr) {
            for (var r = r0; r < r0 + rr; r++)
                for (var c = c0; c < c0 + cc; c++) mappa[r * gn.colonne + c] = id;
        }

        var posizioni = {};

        /* 0) LE CASELLE BLOCCATE PRIME DI TUTTO (j280). Non si spostano mai da sole: tengono la
           loro riga e la loro colonna, e il numero si ricalcola nella griglia nuova. Se una non
           ci sta piu', questa griglia non va bene e si restituisce null: meglio scartarla che
           spostare il divieto sotto il naso dell'utente. */
        (bl || []).forEach(function (b) {
            if (posizioni === null || !b.posizione) return;
            var pb = coord(b.posizione, gv);
            if (!ciSta(pb.r, pb.c, 1, 1)) { posizioni = null; return; }
            scrivi(b.id, pb.r, pb.c, 1, 1);
            posizioni[b.id] = numero(pb.r, pb.c, gn);
        });
        if (posizioni === null) return null;

        // 1) la referenza allargata: resta dov'e', con la misura nuova.
        //    v puo' essere null: vuol dire che non si sta ridimensionando niente, si sta solo
        //    provando a far stare la pagina in un'altra griglia.
        if (v) {
            if (!v.posizione) return null;
            var pv = coord(v.posizione, gv);
            if (!ciSta(pv.r, pv.c, col, rig)) return null;
            scrivi(v.id, pv.r, pv.c, col, rig);
            posizioni[v.id] = numero(pv.r, pv.c, gn);
        }

        // 2) chi non e' toccato resta dov'e'
        var scacciati = [];
        dentro.forEach(function (x) {
            if ((v && x.id === v.id) || !x.posizione) return;
            var q = coord(x.posizione, gv);
            var cc = Math.max(1, x.colonne || 1), rr = Math.max(1, x.righe || 1);
            if (ciSta(q.r, q.c, cc, rr)) {
                scrivi(x.id, q.r, q.c, cc, rr);
                posizioni[x.id] = numero(q.r, q.c, gn);
            } else {
                scacciati.push(x);
            }
        });

        // 3) gli scacciati vanno nella prima casella libera dove ci stanno, nell'ordine che avevano
        var sospesi = [];
        scacciati.sort(function (a, b) { return (a.posizione || 0) - (b.posizione || 0); });
        scacciati.forEach(function (x) {
            var cc = Math.max(1, x.colonne || 1), rr = Math.max(1, x.righe || 1);
            for (var r = 0; r <= gn.righe - rr; r++) {
                for (var c = 0; c <= gn.colonne - cc; c++) {
                    if (ciSta(r, c, cc, rr)) {
                        scrivi(x.id, r, c, cc, rr);
                        posizioni[x.id] = numero(r, c, gn);
                        return;
                    }
                }
            }
            sospesi.push(x);
        });

        return { posizioni: posizioni, sospesi: sospesi };
    }

    function allarga(v, dcol, drig) {
        if (!piano || piano.puoScrivere !== true || !v || v.stato !== 0) return;
        var pagina = paginaDi(v.idPagina);
        if (!pagina) return;
        var g = grigliaDi(pagina);
        if (!g) { messaggio('Prima la griglia', 'Per allargare una referenza la pagina deve avere una griglia.'); return; }

        var col = Math.max(1, (v.colonne || 1) + dcol);
        var rig = Math.max(1, (v.righe || 1) + drig);
        if (col === (v.colonne || 1) && rig === (v.righe || 1)) return;

        var dentro = vociInPagina(pagina.id);
        // j280: le caselle bloccate occupano posto anche loro, sia nel conto dell'area sia in
        // quello di quanta griglia serve
        var bl = blocchiDi(pagina.id);
        /* j326: anche qui il conto era sbagliato nello stesso modo - sommava tutte le voci della
           pagina, compagni di gruppo compresi. Allargare una referenza su una pagina con dei
           gruppi faceva saltare la griglia molto piu' in alto del necessario, esattamente come
           bloccare una casella. Adesso il conto e' uno solo: postiCheServono, con la referenza
           che si sta allargando contata con la misura NUOVA. */
        var area = postiCheServono(dentro, bl, 0, { id: v.id, colonne: col, righe: rig });

        /* Quanto serve DAVVERO, guardando le referenze una per una - non la griglia di adesso.
           Michele (28/09): «se uno allarga di troppo e poi rimpicciolisce, rimetti subito la
           griglia di prima». Se qui si usasse la griglia attuale come pavimento, una volta
           cresciuta non si potrebbe piu' tornare indietro. */
        var serveCol = 1, serveRig = 1;
        dentro.concat(bl).forEach(function (x) {
            if (!x.posizione) return;
            var cc = x.id === v.id ? col : Math.max(1, x.colonne || 1);
            var rr = x.id === v.id ? rig : Math.max(1, x.righe || 1);
            var q = x.posizione - 1;
            serveCol = Math.max(serveCol, (q % g.colonne) + cc);
            serveRig = Math.max(serveRig, Math.floor(q / g.colonne) + rr);
        });

        /* Piu' in giu' della griglia "di base" non si scende da soli: quella e' la griglia che ha
           scelto l'utente, o quella indovinata dall'impaginato all'apertura. Si sale se serve, si
           torna fin li' e ci si ferma. */
        var base = (piano.griglieAmmesse || []).filter(function (x) {
            return x.nome === pagina.grigliaBase;
        })[0];
        var pavimento = base ? base.posti : 0;

        // le griglie che potrebbero bastare, dalla piu' piccola alla piu' grande
        var candidate = (piano.griglieAmmesse || []).filter(function (x) {
            return x.colonne >= serveCol && x.righe >= serveRig && x.posti >= area && x.posti >= pavimento;
        });
        // se non ne basta nessuna col pavimento, si lascia perdere il pavimento
        if (!candidate.length) {
            candidate = (piano.griglieAmmesse || []).filter(function (x) {
                return x.colonne >= serveCol && x.righe >= serveRig && x.posti >= area;
            });
        }

        var scelta = null, esito = null;
        for (var k = 0; k < candidate.length; k++) {
            var e = provaSistemare(v, col, rig, g, candidate[k], dentro, bl);
            if (!e) continue;
            if (!scelta || e.sospesi.length < esito.sospesi.length) { scelta = candidate[k]; esito = e; }
            if (e.sospesi.length === 0) break;
        }

        if (!scelta) {
            messaggio('Non ci sta',
                'Allargando «' + codiceDi(v) + '» a ' + col + ' per ' + rig +
                ' non si riesce a sistemare la pagina con nessuna delle griglie a sistema. ' +
                'Va prima tolto qualcosa da questa pagina.');
            return;
        }

        // si applica: prima la griglia (che cambia il significato dei numeri), poi le posizioni
        var cambiata = scelta.nome !== g.nome ? g.nome + ' a ' + scelta.nome : null;
        pagina.griglia = scelta.nome;
        pagina.colonne = scelta.colonne;
        pagina.righe = scelta.righe;
        pagina.capienza = scelta.posti;

        var quantiMossi = 0;
        dentro.concat(bl).forEach(function (x) {
            var p = esito.posizioni[x.id];
            if (p === undefined) return;
            if (x.id !== v.id && x.posizione !== p && !x.bloccata) quantiMossi++;
            x.posizione = p;
        });
        v.colonne = col;
        v.righe = rig;

        esito.sospesi.forEach(function (x) {
            x.stato = 3; x.idPagina = null; x.posizione = null; x.colonne = 1; x.righe = 1;
            seguiIlCapo(x);      // j291: se va in sospeso un capogruppo, ci va tutto il gruppo
        });

        /* j328 - STRINGENDO SI TORNA INDIETRO. Michele, 02/10: «stessa cosa deve fare quando io
           allargo un box di una posizione per esempio e poi decido di restringerlo».

           Cos'era: allargando, la pagina passava per esempio da 2x3 a 2x4 e la referenza che non
           ci stava piu' veniva spinta nell'ultima casella. Restringendo, la referenza allargata
           tornava di una casella sola - e basta: la griglia restava 2x4 e quella spinta via
           restava in fondo. La cercava poi l'utente.

           Qui si fa lo stesso giro di j327, quello del blocco: prima si CHIUDONO I BUCHI (chi era
           stato scacciato scala indietro), poi la griglia TORNA GIU' fino alla piu' piccola che
           basta, mai sotto quella scelta dall'utente.

           Il pezzo sopra - provaSistemare e la ricerca con il pavimento - non si tocca: serve
           quando si ALLARGA, perche' sa anche mandare in sospeso chi non ci sta piu'. Questi due
           servono quando si STRINGE. Le due cose non si pestano i piedi: con la referenza
           allargata non ci sono buchi da chiudere (le caselle che copre risultano occupate, j328)
           e riadattaGiu non sale mai. */
        var scalate = chiudiIBuchi(pagina);
        var tornata = riadattaGiu(pagina);

        segnaModifica();
        disegna();

        var dice = '«' + codiceDi(v) + '» adesso occupa ' + col + (col === 1 ? ' casella' : ' caselle') +
                   ' in larghezza e ' + rig + (rig === 1 ? ' in altezza' : ' in altezza') + '.';
        if (cambiata) dice += ' La pagina ' + pagina.numero + ' e\' passata da ' + cambiata + '.';
        if (tornata) dice += ' La pagina ' + pagina.numero + ' e\' tornata da ' + tornata + '.';
        if (quantiMossi) dice += ' ' + quantiMossi + (quantiMossi === 1 ? ' referenza si e\' spostata' : ' referenze si sono spostate') + '.';
        if (scalate) dice += ' ' + scalate + (scalate === 1 ? ' e\' scalata indietro' : ' sono scalate indietro') + '.';
        if (esito.sospesi.length) dice += ' ' + esito.sospesi.length + ' non ci stava piu\': e\' finita in sospeso.';
        avviso(dice);
    }

    document.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('.tim_casella .maniglia button') : null;
        if (!b || b.disabled) return;
        e.stopPropagation();
        var v = vocePerId(Number(b.dataset.voce));
        if (!v) return;
        if (b.dataset.largo) allarga(v, Number(b.dataset.largo), 0);
        else if (b.dataset.alto) allarga(v, 0, Number(b.dataset.alto));
    });

    /* ---------- la bozza: SALVA e ANNULLA (j256) ----------
       Fino a j255 la griglia si scriveva subito in banca dati. Michele, provando, si e' ritrovato
       le sue prove addosso riaprendo il timone pur non avendo mai salvato: aveva ragione lui, e
       la specifica lo dice chiaro (10bis). Da qui in avanti tutto quello che si fa resta nel
       browser, e in banca dati ci va solo premendo SALVA. */
    var bSalva = document.getElementById('tim_salva');
    var bAnnulla = document.getElementById('tim_annulla');
    var etSporco = document.getElementById('tim_sporco');

    function segnaModifica() {
        modifiche++;
        aggiornaBozza();
    }

    function aggiornaBozza() {
        var puo = piano && piano.esiste === true && piano.puoScrivere === true;
        bSalva.style.display = puo ? '' : 'none';
        bAnnulla.style.display = puo ? '' : 'none';
        bSalva.disabled = modifiche === 0;
        bAnnulla.disabled = modifiche === 0;
        etSporco.style.display = modifiche > 0 ? '' : 'none';
        etSporco.textContent = modifiche === 1 ? '1 modifica non salvata'
                                               : modifiche + ' modifiche non salvate';
    }

    /* La bozza riparte dall'ultima risposta del server: e' una copia, non lo stesso oggetto,
       altrimenti lavorando si sporcherebbe anche quello che si vuole poter rimettere. */
    function rifaiBozza() {
        piano = salvato ? JSON.parse(salvato) : null;
        sistemaBlocchi();
        modifiche = 0;
        aggiornaBozza();
    }

    function salva() {
        if (!piano || modifiche === 0) return;
        bSalva.disabled = true;
        var corpo = {
            revisione: piano.revisione,
            pagine: (piano.pagine || []).map(function (p) {
                return { id: p.id, griglia: p.griglia, ordine: p.ordine, attiva: p.attiva, bloccata: p.bloccata };
            }),
            voci: (piano.voci || []).map(function (v) {
                return { id: v.id, idPagina: v.idPagina, posizione: v.posizione, stato: v.stato,
                         idGruppo: v.idGruppo,
                         // j275: quante caselle occupa
                         colonne: Math.max(1, v.colonne || 1), righe: Math.max(1, v.righe || 1) };
            }),
            // j280: le caselle bloccate. Si manda sempre la lista intera - anche vuota - perche'
            // per il server la lista che arriva e' la verita' e sostituisce quella salvata.
            blocchi: (piano.blocchi || []).filter(function (b) { return b.idPagina && b.posizione; })
                .map(function (b) { return { idPagina: b.idPagina, posizione: b.posizione }; })
        };
        manda(C4_BASE + 'Timone/' + ID_VOL + '/Salva', corpo).then(function (r) {
            if (!r.ok) {
                aggiornaBozza();
                messaggio('Non si e\' potuto salvare', r.messaggio || '');
                return;
            }
            salvato = JSON.stringify(r.dati);
            rifaiBozza();
            disegna();
            /* j317: dopo un salvataggio il lavoro che aspetta l'Agenzia e' cambiato, quindi il
               pulsante FATTO si rifa' guardare dal server. Attenzione, ed e' voluto: se a salvare
               e' stata l'AGENZIA, il piano e' di nuovo piu' nuovo dell'ultimo «fatto» e il
               pulsante tornera' acceso. E' giusto cosi': vuol dire che l'impaginato non e' ancora
               allineato a quello che c'e' scritto adesso nel piano. */
            mostraFatto();
            /* j308: adesso l'editor sotto e' vecchio di un salvataggio. Le pagine che questo
               salvataggio ha cambiato aspettano l'Agenzia (j307) e vanno oscurate: l'elenco pero'
               sta nello stato dell'editor, che non se ne accorge da solo. Glielo si chiede.
               Senza questa chiamata il velo compare solo ricaricando la pagina a mano, ed e'
               esattamente quello che e' successo a Michele appena uscito dal timone. */
            var rs = window.correggo4 && window.correggo4.ricaricaStato;
            if (typeof rs === 'function') rs();
        }).catch(function () {
            aggiornaBozza();
            messaggio('Salvataggio', 'Server non raggiungibile: non e\' stato salvato niente.');
        });
    }

    function annulla() {
        if (modifiche === 0) return;
        // non serve chiamare il server: la bozza era solo nostra
        rifaiBozza();
        disegna();
    }

    bSalva.addEventListener('click', salva);
    bAnnulla.addEventListener('click', annulla);
    /* TOLTO DA QUI (j263, 28/09) - il bottone «rimetti com'era all'inizio».
       Michele guardando la barra: «qui ci sono troppi pulsanti, si fa casino». Restano i tre che
       servono davvero tutti i giorni: ANNULLA LE MODIFICHE, SALVA, CHIUDI.

       Quello che faceva: rifaceva la fotografia dal volantino impaginato, buttando via griglie,
       spostamenti e anche i salvataggi gia' fatti. Era il bottone "di emergenza", quello che si
       usa una volta ogni tanto - ed e' proprio per questo che non merita di stare in mezzo agli
       altri tre.

       La rotta del server POST /Timone/{id}/RimettiComeEra NON e' stata cancellata: e' segnata
       DEPRECATA in TimoneController e funziona ancora. Se un domani serve, il posto giusto per
       rimetterla e' un menu «altro» o la pagina Gestisci promo, non questa barra. */

    /* Ricarico della pagina, tasto indietro, chiusura della scheda, ESCI: se c'e' qualcosa di non
       salvato il browser deve fermarsi e chiedere conferma (Michele, 28/09: senno' uno ricarica
       e perde tutto quello che ha fatto).

       Due cose da sapere, e sono del browser, non nostre:
       - il testo dell'avviso lo decide il browser e non si puo' cambiare ("Vuoi ricaricare il
         sito? Le modifiche apportate potrebbero non essere salvate" o simile). Si puo' solo
         decidere SE farlo comparire;
       - il browser lo mostra solo se prima si e' fatto almeno un clic nella pagina. Nel nostro
         caso e' sempre cosi': per avere modifiche bisogna per forza aver cliccato qualcosa.

       La condizione e' solo "ci sono modifiche": non si guarda piu' se il timone e' aperto,
       perche' uno puo' avere la bozza sporca e il pannello chiuso davanti agli occhi. */
    function avvisaSeSporco(e) {
        if (modifiche <= 0) return undefined;
        e.preventDefault();
        e.returnValue = '';      // serve ai browser vecchi
        return '';               // e a qualcun altro ancora
    }
    window.addEventListener('beforeunload', avvisaSeSporco);

    /* ---------- la finestra del Marketing: TOLTA DA QUI (j255, 28/09) ----------
       Qui c'era il bottone «APRI LA FINESTRA AL MARKETING» / «CHIUDI LA FINESTRA DEL MARKETING»
       con la finestrella per scegliere la data (j253). Michele l'ha fatto togliere lo stesso
       giorno: avere lo stesso comando in due posti rendeva tutto confusionario, e soprattutto
       la finestra vale per TUTTA LA PROMO mentre il bottone stava dentro un singolo volantino,
       il che traeva in inganno.

       La finestra adesso si apre e si chiude SOLO da «Gestisci promo», card «Finestra per
       timone», dove le promo si vedono una alla volta e si capisce bene su cosa si sta agendo.

       Quello che resta qui: nella riga di stato della barra si continua a leggere «finestra
       Marketing aperta fino al …», e chi non puo' scrivere vede il cartellino «sola lettura».
       Si vede, ma non si tocca.

       Le due rotte del server (POST /Timone/{id}/Finestra/Apri e /Chiudi) non sono state
       cancellate, sono segnate DEPRECATE in TimoneController: rimetterle in piedi vorrebbe dire
       solo rimettere qui un bottone che le chiami. */

    /* ---------- aprire e chiudere ---------- */
    function apri() {
        aperto = true;
        aggiornaZoom();
        document.body.classList.add('tim_on');
        bottone.classList.add('acceso');
        barra.classList.add('visibile');
        pannelli.forEach(function (p) { p.classList.add('visibile'); });
        carica();
    }

    function chiudi() {
        if (modifiche > 0) {
            domanda('Ci sono modifiche non salvate',
                modifiche + (modifiche === 1 ? ' modifica non e\' ancora stata salvata. ' : ' modifiche non sono ancora state salvate. ') +
                'Uscendo cosi\' si perdono.',
                [{ testo: 'Salva ed esci', chiaro: true, fai: function () { salva(); chiudiDavvero(); } },
                 { testo: 'Esci senza salvare', fai: function () { rifaiBozza(); chiudiDavvero(); } },
                 { testo: 'Torna indietro', fai: function () { } }]);
            return;
        }
        chiudiDavvero();
    }

    function chiudiDavvero() {
        chiudiScelta();
        chiudiPagine();
        chiudiCestino();
        /* j288: si rimette il ritaglio della scheda come lo vuole l'editor - via i pannelli e via
           la misura che gli avevamo dato noi. La prossima volta che la scheda si apre dall'editor
           normale, ritaglia() rifa' tutto suo. */
        document.querySelectorAll('#mRitaglio .tim_copri').forEach(function (d) { d.remove(); });
        var rit = document.getElementById('mRitaglio');
        if (rit) { rit.style.width = ''; rit.style.height = ''; }
        sbircia(false);
        aperto = false;
        document.body.classList.remove('tim_on');
        bottone.classList.remove('acceso');
        barra.classList.remove('visibile');
        pannelli.forEach(function (p) { p.classList.remove('visibile'); });
        chiudiReport();
        pulisci();
    }

    function carica() {
        chiedi(C4_BASE + 'Timone/' + ID_VOL + '/Piano').then(function (j) {
            if (!j.ok) { messaggio('Timone', j.messaggio || 'Il timone non e\' disponibile.'); return; }
            salvato = JSON.stringify(j.dati);
            rifaiBozza();

            var sl = barra.querySelector('.sola_lettura');
            if (sl) sl.remove();

            // j312: il report c'e' solo se c'e' un piano, e solo per l'Agenzia
            bReport.style.display = (piano.esiste === true && piano.puoGestireFinestra === true)
                ? '' : 'none';
            /* j324: i FILTRI, alle stesse condizioni del report piu' una: la finestra del
               Marketing deve essere CHIUSA. A finestra aperta il Marketing sta ancora spostando
               roba, e un pacchetto esportato adesso fra cinque minuti racconta un'altra storia. */
            bFiltri.style.display = (piano.esiste === true && piano.puoGestireFinestra === true
                                     && piano.finestraAperta !== true) ? '' : 'none';
            // j317: FATTO si accende solo quando c'e' davvero del lavoro che aspetta l'Agenzia.
            // La regola la decide il server (daSistemare), qui si guarda e basta.
            mostraFatto();

            if (!piano.esiste) {
                pulisci();
                document.getElementById('tim_stato').textContent = 'non ancora aperto';
                if (piano.puoAprire) {
                    messaggio('Il timone non e\' ancora stato aperto',
                        'Aprendolo si fotografa il volantino com\'e\' adesso: pagine e referenze entrano ' +
                        'nel piano, e da li\' il Marketing puo\' spostarle. Il volantino non viene toccato.',
                        'Apri il timone', function () {
                            manda(C4_BASE + 'Timone/' + ID_VOL + '/Apri').then(function (r) {
                                if (!r.ok) { messaggio('Non si e\' potuto aprire', r.messaggio || ''); return; }
                                salvato = JSON.stringify(r.dati);
                                rifaiBozza();
                                disegna();
                            });
                        });
                } else {
                    messaggio('Il timone non e\' ancora stato aperto',
                        'Lo apre l\'Agenzia. Fino ad allora qui non c\'e\' niente da spostare.');
                }
                disegnaPannelli();
                return;
            }

            disegna();
            if (!piano.puoScrivere) {
                var s = document.createElement('span');
                s.className = 'sola_lettura';
                s.textContent = 'sola lettura — ' + (piano.motivoSolaLettura || '');
                barra.querySelector('.destra').insertBefore(s, document.getElementById('tim_chiudi'));
            }
        }).catch(function () {
            messaggio('Timone', 'Server non raggiungibile.');
        });
    }


    /* ======================================================================================
       IL REPORT DELLE MODIFICHE, PER L'AGENZIA (j312).

       Michele, 29/09: «ora per semplificare la vita all'agenzia farei una cosa. Farei un tasto
       visibile solo per l'agenzia dove c'e' un report con tutti gli spostamenti, le modifiche
       sulle referenze.. insomma tutto quello che e' stato salvato dopo la fine della finestra del
       marketing. Magari un Visual che uno puo' esportare poi anche in PDF in modo che se lo
       posssano leggere come vogliono. Partendo da pagina 1 a finire con l'ultima pagina. Anche la
       roba messa in vol o eliminate. Mi raccomando deve essere super chiara la spiegazione».

       COSA LEGGE: il PIANO SALVATO, non la bozza che si ha sotto le mani. Si parte da `salvato`,
       che e' l'ultima risposta del server, per due motivi: il report deve dire quello che il
       Marketing ha consegnato, e l'Agenzia che apre il timone e sposta due cose per provare non
       si deve trovare le sue prove dentro il foglio da stampare.

       COSA CONFRONTA: l'impaginato di partenza (pagina_origine e posizione_origine, scritte nella
       fotografia di quando il timone e' stato aperto) con il piano di adesso. Non c'e' una
       cronologia dei salvataggi in banca dati: se una referenza va e torna, il report tace, ed e'
       giusto - all'Agenzia serve sapere cosa rifare, non tutti i passaggi. Questo e' scritto anche
       dentro il foglio, nel riquadro «come si legge».

       IL PDF: lo fa la stampa del browser, non noi. Si mette addosso al body la classe
       tim_stampa_report (il foglio di stile nasconde tutto il resto), si chiama window.print() e
       si toglie la classe. Cosi' quello che esce e' identico a quello che si vede, non c'e' niente
       da mantenere sul server e chi vuole se lo salva, se lo manda o se lo stampa come gli pare.

       LE FOTO e LE DESCRIZIONI arrivano dalle schede di Istanta, le stesse che usano le caselle.
       La descrizione va chiesta PER CODICE: l'etichetta della voce e' quella del box, e dentro un
       gruppo e' la stessa per tutte - senza questo due prodotti diversi comparirebbero col nome
       dello stesso (152346-1 Kinderini e 237740-1 Nutella hanno lo stesso box, e sul foglio si
       leggevano entrambi «NUTELLA BISCUITS»). Il foglio si disegna subito col «no foto» e si
       ridisegna da se' quando le schede arrivano: aspettare Istanta a schermo bianco, con venti
       box, si vede.
       ====================================================================================== */

/* ------------------------------------------------------------------ i pezzi di testo, in chiaro */
function rpEsc(t) {
    return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* La descrizione arriva con le etichette dentro (<DESCRIZIONE_TITOLO>...</DESCRIZIONE_TITOLO>):
   sul report si vuole la frase, non il tracciato. */
function rpPulisci(t) {
    return String(t || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function rpData(iso, conOra) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    function z(n) { return (n < 10 ? '0' : '') + n; }
    var s = z(d.getDate()) + '/' + z(d.getMonth() + 1) + '/' + d.getFullYear();
    return conOra ? s + ' alle ' + z(d.getHours()) + ':' + z(d.getMinutes()) : s;
}

function rpPlurale(n, uno, molti) { return n === 1 ? uno : molti; }

/* ---------------------------------------------------------------- il confronto, cuore del report
   Restituisce, per ogni voce, cosa le e' successo fra l'impaginato di partenza e adesso.
   Non inventa niente: ogni campo viene da una colonna del database. */
function rpConfronta(piano) {
    var voci = piano.voci || [];
    var pagine = piano.pagine || [];
    var numeroDi = {}, pagPerId = {};
    pagine.forEach(function (p) { numeroDi[p.id] = p.numero; pagPerId[p.id] = p; });

    // il gruppo DI PARTENZA: chi stava nello stesso box dell'impaginato
    var compagniDiBox = {};
    voci.forEach(function (v) {
        if (!v.idElemento) return;
        var k = String(v.idElemento);
        (compagniDiBox[k] = compagniDiBox[k] || []).push(v);
    });
    // il gruppo DI ADESSO
    var gruppoOra = {};
    voci.forEach(function (v) {
        if (!v.idGruppo) return;
        var k = String(v.idGruppo);
        (gruppoOra[k] = gruppoOra[k] || []).push(v);
    });
    // chi tiene la casella di ogni gruppo di adesso
    var capoDelGruppo = {};
    Object.keys(gruppoOra).forEach(function (k) {
        var c = null;
        gruppoOra[k].forEach(function (v) { if (v.posizione && !c) c = v; });
        capoDelGruppo[k] = c || gruppoOra[k][0];
    });

    return voci.map(function (v) {
        var r = {
            voce: v,
            codice: v.codice,
            descrizione: rpPulisci(v.etichetta),
            prezzo: v.prezzo || '',
            meccanica: v.meccanica || '',
            paginaPrima: v.paginaOrigine || null,
            ordinePrima: v.posizioneOrigine || null,
            paginaOra: null,
            casellaOra: null,
            conChi: [],            // con chi condivide la casella adesso
            stavaCon: [],          // con chi stava nel box di partenza
            tipi: [],              // le etichette colorate
            note: []
        };

        // DOVE STA ADESSO. Dentro un gruppo la casella e' una: se questa voce non la tiene,
        // il suo posto e' quello del capo-casella del suo gruppo.
        var tiene = v;
        if (v.idGruppo && !v.posizione) tiene = capoDelGruppo[String(v.idGruppo)] || v;
        if (v.stato === 0) {
            r.paginaOra = tiene.idPagina ? numeroDi[tiene.idPagina] : null;
            r.casellaOra = tiene.posizione || null;
        }
        if (v.idGruppo) {
            (gruppoOra[String(v.idGruppo)] || []).forEach(function (x) {
                if (x.id !== v.id) r.conChi.push(x.codice);
            });
        }
        if (v.idElemento) {
            (compagniDiBox[String(v.idElemento)] || []).forEach(function (x) {
                if (x.id !== v.id) r.stavaCon.push(x.codice);
            });
        }

        // CHE COS'E' SUCCESSO
        if (v.stato === 2) {
            r.tipi.push('eli');
        } else if (v.stato === 1) {
            r.tipi.push('fuo');
        } else if (v.stato === 3) {
            r.tipi.push('sos');
        } else {
            if (r.paginaPrima && r.paginaOra && r.paginaOra !== r.paginaPrima) r.tipi.push('pag');
            else if (r.ordinePrima && r.casellaOra && r.casellaOra !== r.ordinePrima) r.tipi.push('spo');
        }
        // il gruppo: si guarda il box di partenza, non id_gruppo, che e' quello di adesso
        var eraInGruppo = r.stavaCon.length > 0;
        var eInGruppo = r.conChi.length > 0;
        if (eraInGruppo && !eInGruppo) r.tipi.push('sta');
        else if (!eraInGruppo && eInGruppo) r.tipi.push('uni');
        else if (eraInGruppo && eInGruppo) {
            // stesso box prima, gruppo adesso: e' cambiata la compagnia?
            var prima = r.stavaCon.slice().sort().join('|');
            var ora = r.conChi.slice().sort().join('|');
            if (prima !== ora) r.tipi.push('cam');
        }
        var col = v.colonne || 1, rig = v.righe || 1;
        if (v.stato === 0 && (col > 1 || rig > 1)) r.tipi.push('lar');

        return r;
    });
}

var RP_ETICHETTE = {
    spo: ['spo', 'SPOSTATA'],
    pag: ['pag', 'CAMBIATA DI PAGINA'],
    fuo: ['fuo', 'TOLTA DAL VOLANTINO'],
    eli: ['eli', 'ELIMINATA'],
    sos: ['eli', 'IN SOSPESO'],
    sta: ['gru', 'SCIOLTA DAL GRUPPO'],
    uni: ['gru', 'UNITA A UN GRUPPO'],
    cam: ['gru', 'GRUPPO CAMBIATO'],
    lar: ['lar', 'ALLARGATA']
};

/* --------------------------------------------------------------------------- il foglio, in HTML
   fotoDi(codice) -> l'indirizzo della miniatura, oppure '' se a sistema non c'e' una foto.
   La passa chi chiama, perche' nel prodotto le foto arrivano dalle schede di Istanta e nella
   preview da una cartella. */
function rpCostruisci(piano, opzioni) {
    var o = opzioni || {};
    /* infoRef(codice, voce) -> { foto: indirizzo o '', descrizione: testo o '' }.
       La da' chi chiama: nel prodotto viene dalle schede di Istanta, nella preview da una
       cartella. La DESCRIZIONE e' per codice e non per voce di proposito: dentro un gruppo
       l'etichetta della voce e' quella del box, uguale per tutte le referenze che ci stavano -
       senza questo, due prodotti diversi comparirebbero col nome dello stesso. */
    var infoRef = o.infoRef || function () { return {}; };
    var nofoto = o.nofoto || '';
    var chiStampa = o.chiStampa || '';
    var righe = rpConfronta(piano);
    var pagine = (piano.pagine || []).slice().sort(function (a, b) { return a.numero - b.numero; });
    var blocchi = piano.blocchi || [];
    var numeroDi = {};
    pagine.forEach(function (p) { numeroDi[p.id] = p.numero; });

    function ha(r, t) { return r.tipi.indexOf(t) >= 0; }
    var toccate = righe.filter(function (r) { return r.tipi.length > 0; });
    var conta = {
        spo: righe.filter(function (r) { return ha(r, 'spo'); }).length,
        pag: righe.filter(function (r) { return ha(r, 'pag'); }).length,
        fuo: righe.filter(function (r) { return ha(r, 'fuo'); }).length,
        eli: righe.filter(function (r) { return ha(r, 'eli'); }).length,
        gru: righe.filter(function (r) { return ha(r, 'sta') || ha(r, 'uni') || ha(r, 'cam'); }).length,
        lar: righe.filter(function (r) { return ha(r, 'lar'); }).length,
        blo: blocchi.length,
        fermi: righe.length - toccate.length
    };

    var h = [];
    // la striscia bordeaux coi pulsanti: nella finestra dell'ESPORTA PDF non ci va, quel documento
    // e' fatto per essere stampato e non ha niente da premere
    if (o.conBarra !== false) h.push('<div class="rp_barra">' +
           '<b>REPORT DELLE MODIFICHE</b>' +
           '<span>il timone del Marketing, pagina per pagina</span>' +
           '<span class="destra">' +
           '<button type="button" id="rp_esporta">ESPORTA PDF</button>' +
           '<button type="button" class="vuoto" id="rp_stampa">STAMPA</button>' +
           '<button type="button" class="vuoto" id="rp_chiudi">CHIUDI</button>' +
           '</span></div>');
    h.push('<div class="rp_foglio">');

    // ---- intestazione
    h.push('<div class="rp_testa">' +
           '<h1>Report delle modifiche del timone</h1>' +
           '<div class="vol">' + rpEsc(piano.titolo || '') +
           ' &ndash; versione n&deg; ' + rpEsc(piano.versione) +
           (piano.promo ? ' &middot; promo ' + rpEsc(piano.promo) : '') + '</div>' +
           '<div class="riga">Piano del timone n&deg; ' + rpEsc(piano.id) +
           ' &middot; salvataggi fatti finora: ' + rpEsc(piano.revisione) +
           (piano.dataSalvataggio
               ? ' &middot; ultimo salvataggio ' + rpEsc(rpData(piano.dataSalvataggio, true)) +
                 (piano.chiHaSalvato ? ' da ' + rpEsc(piano.chiHaSalvato) : '')
               : ' &middot; mai salvato') +
           '</div>' +
           '<div class="riga">Foglio stampato il ' + rpEsc(rpData(new Date().toISOString(), true)) +
           (chiStampa ? ' da ' + rpEsc(chiStampa) : '') + '</div>' +
           '</div>');

    // ---- come si legge
    h.push('<div class="rp_come"><h2>COME SI LEGGE QUESTO FOGLIO</h2><ol>' +
           '<li>Si mettono a confronto <b>due cose sole</b>: il volantino <b>com\'era impaginato</b> ' +
           'quando l\'Agenzia ha aperto il timone, e <b>com\'&egrave; adesso</b> nel piano che il ' +
           'Marketing ha salvato.</li>' +
           '<li>Si va <b>in ordine, dalla pagina 1 all\'ultima</b>. Sotto ogni pagina ci sono solo le ' +
           'referenze su cui &egrave; stato fatto qualcosa; di quelle rimaste al loro posto si dice ' +
           'soltanto quante sono.</li>' +
           '<li>In fondo al foglio ci sono le cose che non stanno su una pagina: le referenze ' +
           '<b>tolte dal volantino</b>, quelle <b>eliminate</b>, le <b>caselle tenute per la ' +
           'grafica</b> e la tabella di tutte le pagine.</li>' +
           '<li>Se il Marketing ha spostato una referenza e poi l\'ha rimessa dov\'era, qui non ' +
           'compare: il foglio dice <b>come &egrave; adesso</b>, non tutti i passaggi.</li>' +
           '</ol>' +
           '<span class="att"><b>Attenzione ai numeri, sono due cose diverse.</b><br>' +
           '&laquo;<b>3&deg; in ordine di lettura</b>&raquo; &egrave; il posto di partenza: il terzo ' +
           'prodotto della pagina impaginata, contando dall\'alto a sinistra e andando per righe. ' +
           'Non &egrave; una casella, perch&eacute; l\'impaginato non ha una griglia.<br>' +
           '&laquo;<b>casella 3</b>&raquo; &egrave; il posto di arrivo: la casella della griglia ' +
           'scelta nel timone per quella pagina. Anche le caselle si contano per righe: prima riga ' +
           'da sinistra a destra, poi la seconda.</span></div>');

    // ---- i numeri
    function num(n, testo) {
        return '<div class="n' + (n ? '' : ' zero') + '"><b>' + n + '</b><span>' + testo + '</span></div>';
    }
    h.push('<div class="rp_numeri">' +
           num(conta.spo, 'spostate di casella, nella stessa pagina') +
           num(conta.pag, rpPlurale(conta.pag, 'finita su un\'altra pagina', 'finite su un\'altra pagina')) +
           num(conta.fuo, 'tolte dal volantino') +
           num(conta.eli, 'eliminate') +
           num(conta.gru, 'staccate o unite a un gruppo') +
           num(conta.lar, 'allargate su pi&ugrave; caselle') +
           num(conta.blo, 'caselle tenute per la grafica') +
           num(conta.fermi, 'rimaste dove erano') +
           '</div>');

    // ---- legenda
    var leg = [
        ['spo', 'ha cambiato casella, ma &egrave; rimasta nella stessa pagina'],
        ['pag', 'adesso sta su un\'altra pagina del volantino'],
        ['fuo', 'non va stampata: resta nell\'elenco del timone, fuori dalle pagine'],
        ['eli', 'buttata via dal piano: per il Marketing non esiste pi&ugrave;'],
        ['sta', 'sull\'impaginato stava in un box insieme ad altre referenze, adesso ha una casella sua'],
        ['uni', 'adesso condivide la casella con altre referenze'],
        ['lar', 'occupa pi&ugrave; di una casella della griglia']
    ];
    h.push('<div class="rp_legenda"><h2>LE ETICHETTE COLORATE</h2>' +
           leg.map(function (x) {
               var e = RP_ETICHETTE[x[0]];
               return '<div><span class="bdg ' + e[0] + '">' + e[1] + '</span> ' + x[1] + '</div>';
           }).join('') +
           '<div><span class="bdg blo">CASELLA TENUTA</span> una casella vuota che il Marketing ha ' +
           'bloccato perch&eacute; l&igrave; ci va un elemento grafico</div></div>');

    // ---------------------------------------------------------------- una sezione per ogni pagina
    function cartoncino(r) {
        var info = infoRef(r.codice, r.voce) || {};
        var foto = info.foto || '';
        var descrizione = info.descrizione || r.descrizione;
        var s = '<div class="rp_riga"><div class="rp_foto">' +
                (foto ? '<img src="' + rpEsc(foto) + '" alt="">'
                      : '<img class="nofoto" src="' + rpEsc(nofoto) + '" alt="nessuna foto">') +
                '</div><div class="rp_corpo">';
        s += '<div>' + r.tipi.map(function (t) {
            var e = RP_ETICHETTE[t]; return e ? '<span class="bdg ' + e[0] + '">' + e[1] + '</span>' : '';
        }).join('') + '</div>';
        s += '<div class="rp_cod">' + rpEsc(r.codice) + '</div>';
        s += '<div class="rp_des">' + rpEsc(descrizione) + '</div>';
        var tec = [];
        if (r.prezzo) tec.push('prezzo sul volantino <b>' + rpEsc(r.prezzo) + '</b>');
        if (r.meccanica) tec.push('meccanica <b>' + rpEsc(r.meccanica) + '</b>');
        if (tec.length) s += '<div class="rp_tec">' + tec.join(' &middot; ') + '</div>';

        var prima = r.paginaPrima
            ? 'pagina ' + r.paginaPrima + (r.ordinePrima ? ' &middot; ' + r.ordinePrima + '&deg; in ordine di lettura' : '')
            : 'non era impaginata';
        var ora;
        if (r.tipi.indexOf('eli') >= 0) ora = 'eliminata dal piano';
        else if (r.tipi.indexOf('fuo') >= 0) ora = 'fuori dal volantino';
        else if (r.tipi.indexOf('sos') >= 0) ora = 'in sospeso, senza un posto';
        else if (r.paginaOra) ora = 'pagina ' + r.paginaOra + (r.casellaOra ? ' &middot; casella ' + r.casellaOra : '');
        else ora = 'senza posto';
        s += '<div class="rp_dove">' +
             '<span class="q"><u>DOV\'ERA</u>' + prima + '</span>' +
             '<span class="fre">&rarr;</span>' +
             '<span class="q"><u>ADESSO</u>' + ora + '</span></div>';

        var note = [];
        if (r.tipi.indexOf('sta') >= 0 && r.stavaCon.length)
            note.push('Sull\'impaginato stava in un box solo insieme a <b>' +
                      rpEsc(r.stavaCon.join(', ')) + '</b>: adesso ha una casella sua.');
        if (r.conChi.length)
            note.push('Adesso divide la casella con: <b>' + rpEsc(r.conChi.join(', ')) + '</b>' +
                      (r.voce.posizione ? ' (la casella la tiene questa referenza)' : '') + '.');
        var col = r.voce.colonne || 1, rig = r.voce.righe || 1;
        if (col > 1 || rig > 1)
            note.push('Occupa <b>' + (col * rig) + ' caselle</b> (' + col + ' in larghezza, ' +
                      rig + ' in altezza), a partire da quella indicata.');
        if (note.length) s += '<div class="rp_nota">' + note.join('<br>') + '</div>';
        return s + '</div></div>';
    }

    pagine.forEach(function (p) {
        var dentro = righe.filter(function (r) { return r.paginaOra === p.numero; });
        var arrivate = dentro.filter(function (r) { return r.tipi.length > 0; });
        var partite = righe.filter(function (r) {
            return r.paginaPrima === p.numero && r.paginaOra !== p.numero;
        });
        var fermi = dentro.length - arrivate.length;
        var bloccateQui = blocchi.filter(function (b) { return numeroDi[b.idPagina] === p.numero; });

        // quante caselle sono davvero occupate: un gruppo ne prende una, un allargamento piu' di una
        var occupate = 0;
        dentro.forEach(function (r) {
            if (r.voce.posizione) occupate += (r.voce.colonne || 1) * (r.voce.righe || 1);
        });
        var libere = Math.max(0, p.capienza - occupate - bloccateQui.length);
        var gri;
        if (p.griglia) {
            gri = 'griglia ' + p.griglia + ' = ' + p.capienza + ' caselle &middot; ' +
                  occupate + ' ' + rpPlurale(occupate, 'occupata', 'occupate') + ' &middot; ' +
                  libere + ' ' + rpPlurale(libere, 'libera', 'libere');
            if (bloccateQui.length)
                gri += ' &middot; ' + bloccateQui.length + ' ' +
                       rpPlurale(bloccateQui.length, 'tenuta', 'tenute') + ' per la grafica';
        } else {
            gri = 'nessuna griglia scelta: la pagina &egrave; ancora come era impaginata';
        }
        var flag = '';
        if (p.bloccata) flag += '<span class="flag">SEGNATA COME BLOCCATA</span>';
        if (!p.attiva) flag += '<span class="flag">SEGNATA COME SPENTA</span>';
        if (p.ordine && p.ordine !== p.numero) flag += '<span class="flag">ORDINE DI STAMPA: ' + p.ordine + '</span>';

        h.push('<h2 class="rp_pag">PAGINA ' + p.numero + '<span class="gri">' + gri + '</span>' + flag + '</h2>');
        h.push('<div class="rp_pagina">');
        // Michele si accorgerebbe subito dello scarto: 19 referenze in 9 caselle sembra un errore
        // e invece e' il gruppo, che prende una casella sola. Va detto, non lasciato indovinare.
        if (p.griglia && dentro.length > occupate) {
            h.push('<div class="rp_niente">Su questa pagina ci sono <b>' + dentro.length +
                   ' referenze</b> in <b>' + occupate + ' ' +
                   rpPlurale(occupate, 'casella', 'caselle') + '</b>: le referenze raggruppate ' +
                   'stanno tutte in una casella sola.</div>');
        }
        if (p.bloccata || !p.attiva) {
            h.push('<div class="rp_niente">Nel piano questa pagina risulta <b>' +
                   (p.bloccata ? 'bloccata' : '') + (p.bloccata && !p.attiva ? ' e ' : '') +
                   (!p.attiva ? 'spenta' : '') + '</b>: non l\'ha fatto il timone, che oggi non ha ' +
                   'nessun pulsante per farlo (vedi la nota sotto la tabella delle pagine).</div>');
        }
        if (!arrivate.length && !partite.length && !bloccateQui.length) {
            h.push('<div class="rp_niente">Sulle referenze di questa pagina <b>non &egrave; stato ' +
                   'cambiato niente</b>: le ' + dentro.length + ' ' +
                   rpPlurale(dentro.length, 'referenza', 'referenze') + ' ' +
                   rpPlurale(dentro.length, 'sta', 'stanno') + ' dove ' +
                   rpPlurale(dentro.length, 'stava', 'stavano') + '.</div>');
        }
        else {
            arrivate.sort(function (a, b) { return (a.casellaOra || 99) - (b.casellaOra || 99); });
            arrivate.forEach(function (r) { h.push(cartoncino(r)); });
            if (partite.length) {
                h.push('<div class="rp_nota" style="margin-top:10px"><b>Queste referenze erano su questa ' +
                       'pagina e non ci sono pi&ugrave;:</b><br>' +
                       partite.map(function (r) {
                           var dove = r.tipi.indexOf('eli') >= 0 ? 'eliminata'
                               : r.tipi.indexOf('fuo') >= 0 ? 'tolta dal volantino'
                               : r.paginaOra ? 'spostata alla pagina ' + r.paginaOra +
                                 (r.casellaOra ? ', casella ' + r.casellaOra : '')
                               : 'senza posto';
                           var i2 = infoRef(r.codice, r.voce) || {};
                           return '&bull; ' + rpEsc(r.codice) + ' &mdash; ' +
                                  rpEsc(i2.descrizione || r.descrizione) +
                                  ' &rarr; <b>' + dove + '</b>';
                       }).join('<br>') + '</div>');
            }
            if (bloccateQui.length) {
                h.push('<div class="rp_nota"><span class="bdg blo">CASELLA TENUTA</span> ' +
                       rpPlurale(bloccateQui.length, 'la casella', 'le caselle') + ' ' +
                       bloccateQui.map(function (b) { return b.posizione; }).join(', ') +
                       ' ' + rpPlurale(bloccateQui.length, 'resta vuota', 'restano vuote') +
                       ': il Marketing ' + rpPlurale(bloccateQui.length, 'la', 'le') +
                       ' ha bloccata per un elemento grafico.</div>');
            }
            if (fermi > 0) {
                h.push('<div class="rp_niente">Le altre <b>' + fermi + '</b> ' +
                       rpPlurale(fermi, 'referenza', 'referenze') + ' di questa pagina ' +
                       rpPlurale(fermi, '&egrave;', 'sono') + ' rimaste dove ' +
                       rpPlurale(fermi, 'era', 'erano') + '.</div>');
            }
        }
        h.push('</div>');
    });

    // ------------------------------------------------------------------ quello che non sta in pagina
    h.push('<div class="rp_fine">');
    var fuori = righe.filter(function (r) { return r.tipi.indexOf('fuo') >= 0; });
    h.push('<h2 class="rp_pag">TOLTE DAL VOLANTINO<span class="gri">non vanno stampate, ma restano ' +
           'nell\'elenco del timone e si possono rimettere dentro</span></h2><div class="rp_pagina">');
    if (!fuori.length) h.push('<div class="rp_niente">Nessuna referenza &egrave; stata tolta dal volantino.</div>');
    else fuori.forEach(function (r) { h.push(cartoncino(r)); });
    h.push('</div>');

    var eli = righe.filter(function (r) { return r.tipi.indexOf('eli') >= 0; });
    h.push('<h2 class="rp_pag">ELIMINATE<span class="gri">buttate via dal piano del Marketing</span></h2>' +
           '<div class="rp_pagina">');
    if (!eli.length) h.push('<div class="rp_niente">Nessuna referenza &egrave; stata eliminata.</div>');
    else eli.forEach(function (r) { h.push(cartoncino(r)); });
    h.push('</div>');

    // ---- la tabella delle pagine
    h.push('<h2 class="rp_pag">TUTTE LE PAGINE, IN UNA TABELLA</h2><div class="rp_pagina">' +
           '<table class="rp_tab"><tr><th>Pagina</th><th>Griglia</th><th>Referenze</th>' +
           '<th>Caselle usate</th><th>Tenute per la grafica</th><th>Ordine di stampa</th>' +
           '<th>Stato</th></tr>');
    pagine.forEach(function (p) {
        var dentro = righe.filter(function (r) { return r.paginaOra === p.numero; });
        var usate = 0;
        dentro.forEach(function (r) {
            if (r.voce.posizione) usate += (r.voce.colonne || 1) * (r.voce.righe || 1);
        });
        var st = [];
        if (p.bloccata) st.push('bloccata');
        if (!p.attiva) st.push('spenta');
        h.push('<tr><td><b>' + p.numero + '</b></td><td>' + (p.griglia || '&mdash;') + '</td><td>' +
               dentro.length + '</td><td>' + usate + '</td><td>' +
               blocchi.filter(function (b) { return numeroDi[b.idPagina] === p.numero; }).length +
               '</td><td>' + (p.ordine || p.numero) + '</td><td>' +
               (st.length ? st.join(', ') : 'normale') + '</td></tr>');
    });
    h.push('</table>' +
           '<div class="rp_coda" style="margin-top:10px">Le colonne <b>ordine di stampa</b> e ' +
           '<b>stato</b> arrivano dal piano cos&igrave; come sono: oggi il timone non ha pulsanti ' +
           'per cambiarle, quindi restano come erano quando il piano &egrave; stato aperto.</div>' +
           '</div>');

    h.push('<div class="rp_coda">Le referenze <b>in sospeso</b> non compaiono in questo foglio: il ' +
           'timone non si lascia salvare finch&eacute; ce n\'&egrave; anche una sola, quindi in un ' +
           'piano salvato non ce ne sono mai.<br>' +
           'Il foglio &egrave; fatto con i dati del piano salvato: se il Marketing salva di nuovo, ' +
           'basta riaprire il report per averlo aggiornato.</div>');
    h.push('</div>');   // rp_fine
    h.push('</div>');   // rp_foglio
    return h.join('');
}

    /* la scheda della singola referenza: foto e descrizione, dalle schede di Istanta gia' in casa */
    function rpInfoRef(codice, v) {
        if (!v || !v.idElemento) return {};
        var s = schedePerBox[String(v.idElemento)];
        if (!s || s.stato !== 'ok') return {};
        var mia = null;
        (s.foto || []).forEach(function (x) {
            if (!mia && String(x.codice || '').trim() === String(codice).trim()) mia = x;
        });
        if (!mia) return {};
        return {
            foto: (mia.guidFoto || '').trim() ? miniaturaDi(mia.guidFoto, 220) : '',
            descrizione: (mia.descrizione || '').trim()
        };
    }

    var elReport = null;

    function pianoSalvato() { return salvato ? JSON.parse(salvato) : null; }

    function disegnaReport() {
        var p = pianoSalvato();
        if (!elReport || !p) return;
        var chi = document.querySelector('.barra_alta .utente');
        elReport.innerHTML = rpCostruisci(p, {
            infoRef: rpInfoRef,
            nofoto: VIA_NOFOTO,
            chiStampa: chi ? (chi.textContent || '').trim() : ''
        });
        elReport.querySelector('#rp_chiudi').addEventListener('click', chiudiReport);
        elReport.querySelector('#rp_stampa').addEventListener('click', function () {
            /* La classe la mette e la toglie il browser intorno alla stampa: senza il ritardo, su
               Chrome window.print() torna subito e la pagina resterebbe mezza nascosta mentre
               l'anteprima e' ancora aperta. */
            document.body.classList.add('tim_stampa_report');
            window.print();
            setTimeout(function () { document.body.classList.remove('tim_stampa_report'); }, 500);
        });
        elReport.querySelector('#rp_esporta').addEventListener('click', esportaPdf);
    }

    /* ======================================================================================
       ESPORTA PDF: IL FILE VA DIRETTO NEI DOWNLOAD (j315).

       Michele, 29/09: «quando faccio esporta pdf deve andare direttamente nei download.. fine non
       devi fare nient'altro».

       COME: il browser disegna il report - e' lui che ha il piano e le foto - e lo manda al
       server, che lo passa al motore di stampa di Chrome e lo rimanda come ALLEGATO. Un allegato
       il browser lo scarica e basta: nessuna finestra, nessuna scelta da fare, il file finisce nei
       Download col nome giusto.

       LE FOTO VANNO DENTRO IL FOGLIO, come data:. Il motore sul server gira SENZA RETE di
       proposito (vedi Servizi/ServizioPdf.cs), e comunque non avrebbe la sessione dell'utente per
       chiedere /Foto/Miniatura, che e' protetto: mandando gli indirizzi, il PDF uscirebbe con
       tutti i buchi al posto delle foto. Quindi prima si scaricano qui - dal browser, che e'
       autenticato e le ha gia' in cache - e si infilano dentro l'HTML.

       IL TRABOCCHETTO DEGLI INDIRIZZI: dentro l'HTML gli indirizzi delle miniature sono scritti
       con &amp; (ci passano da rpEsc, che e' giusto che ci sia), ma per chiederli al server ci
       vuole la & vera. Chi lo dimentica scarica zero foto e non capisce perche'.

       SE QUALCOSA NON VA - il motore non c'e', il server risponde male, il foglio e' troppo
       grosso - non si resta con un pulsante muto: si dice cos'e' successo e si ricorda che con
       STAMPA si puo' sempre scegliere «Salva come PDF». */
    function nomeFilePdf(p) {
        var d = new Date();
        function z(n) { return (n < 10 ? '0' : '') + n; }
        var data = z(d.getDate()) + '-' + z(d.getMonth() + 1) + '-' + d.getFullYear();
        var titolo = String(p.titolo || 'volantino')
            // i caratteri che nei nomi dei file non si possono usare: via, sennò il browser
            // propone un nome tagliato a meta' o rifiuta il salvataggio
            .replace(/[\\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
        return 'Report timone - ' + titolo + ' - v' + (p.versione || 0) + ' - ' + data;
    }

    /* Le immagini dentro l'HTML: si scaricano e si rimettono come data:. Quella che non arriva si
       lascia com'e' - nel PDF sara' un buco, ma il resto del foglio si salva. */
    function foteDentro(html) {
        var vie = [];
        var re = /src="([^"]+)"/g, m;
        while ((m = re.exec(html)) !== null) {
            var u = m[1];
            if (u.indexOf('data:') === 0 || vie.indexOf(u) >= 0) continue;
            vie.push(u);
        }
        if (!vie.length) return Promise.resolve(html);
        return Promise.all(vie.map(function (u) {
            // la & vera, non &amp;: vedi il trabocchetto nel commento in cima
            var vero = u.replace(/&amp;/g, '&');
            return fetch(vero, { credentials: 'same-origin' }).then(function (r) {
                return r.ok ? r.blob() : null;
            }).then(function (b) {
                if (!b) return null;
                return new Promise(function (risolvi) {
                    var l = new FileReader();
                    l.onload = function () { risolvi(String(l.result)); };
                    l.onerror = function () { risolvi(null); };
                    l.readAsDataURL(b);
                });
            }).catch(function () { return null; });
        })).then(function (dati) {
            var fuori = html;
            vie.forEach(function (u, i) {
                if (!dati[i]) return;
                fuori = fuori.split('src="' + u + '"').join('src="' + dati[i] + '"');
            });
            return fuori;
        });
    }

    /* Il foglio di stile che serve solo al PDF: la misura della pagina e i margini. Sta qui e non
       dentro STILE_REPORT perche' una regola @page vale per qualunque stampa, e non c'e' motivo di
       imporla a chi stampa l'editor. */
    var STILE_PDF = '\n@page { size: A4; margin: 12mm 10mm 14mm; }\n' +
                    'body { margin: 0; background: #fff; }\n';

    function esportaPdf() {
        var p = pianoSalvato();
        if (!p || p.esiste !== true) return;
        var b = elReport ? elReport.querySelector('#rp_esporta') : null;
        function aspetta(si) {
            if (!b) return;
            b.disabled = si;
            b.textContent = si ? 'PREPARO IL PDF…' : 'ESPORTA PDF';
        }
        aspetta(true);

        var chi = document.querySelector('.barra_alta .utente');
        var nome = nomeFilePdf(p);
        var foglio = rpCostruisci(p, {
            infoRef: rpInfoRef,
            nofoto: VIA_NOFOTO,
            chiStampa: chi ? (chi.textContent || '').trim() : '',
            conBarra: false
        });

        foteDentro(foglio).then(function (conFoto) {
            var documento =
                '<!doctype html><html lang="it"><head><meta charset="utf-8">' +
                '<title>' + rpEsc(nome) + '</title>' +
                '<style>' + STILE_REPORT + STILE_PDF + '</style></head>' +
                '<body class="tim_stampa_report"><div id="tim_report">' + conFoto +
                '</div></body></html>';
            return fetch(C4_BASE + 'Timone/' + ID_VOL + '/Pdf', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', 'RequestVerificationToken': token() },
                body: JSON.stringify({ html: documento, nome: nome })
            });
        }).then(function (r) {
            if (r.ok) return r.blob();
            // il server risponde nella busta di sempre: si prova a leggere il perche'
            return r.json().then(function (j) {
                throw new Error((j && j.messaggio) || 'Il server non ha fatto il PDF.');
            }, function () {
                throw new Error('Il server non ha fatto il PDF (errore ' + r.status + ').');
            });
        }).then(function (blob) {
            /* Il file si fa scaricare da un collegamento finto con l'attributo download: e' il
               modo che lascia scegliere il nome. Il collegamento si butta subito, e l'indirizzo
               temporaneo si libera dopo un attimo - non prima, sennò su certi browser il
               salvataggio parte e trova il nulla. */
            var via = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = via;
            a.download = nome + '.pdf';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(function () { URL.revokeObjectURL(via); }, 8000);
            aspetta(false);
        }).catch(function (e) {
            aspetta(false);
            messaggio('Esporta PDF', ((e && e.message) || 'Non si e\' riusciti a fare il PDF.') +
                      ' Puoi sempre usare STAMPA e scegliere «Salva come PDF».');
        });
    }

    /* DEPRECATA (j315, 29/09) - l'ESPORTA PDF di j313, che apriva una finestra nuova col report
       dentro e chiamava la stampa da li'.
       Cosa si e' scoperto: per Michele non era un export. «Non ci stiamo capendo.. quando faccio
       esporta pdf deve andare direttamente nei download.. fine». Aprire la finestra di stampa,
       anche col nome del file gia' giusto, vuol dire far scegliere qualcosa all'utente - e il
       punto era esattamente non fargli scegliere niente.
       Resta scritta qui perche' e' l'unica strada che funziona SENZA il motore sul server: se un
       domani /opt/chrome-pdf non ci fosse piu' (server nuovo, macchina rifatta), questa si
       riattacca al pulsante e il report si porta via comunque. Le due cose che ci vogliono e che
       si dimenticano: il <base>, sennò le foto non si trovano perche' il documento nuovo non ha
       un indirizzo suo, e l'attesa delle immagini, perche' window.print() non le aspetta.
       Oggi NESSUNO la chiama. */
    function esportaPdfInFinestra() {
        var p = pianoSalvato();
        if (!p || p.esiste !== true) return;
        var f = window.open('', '_blank');
        if (!f) {
            messaggio('Esporta PDF',
                'Il browser ha bloccato la finestra nuova. Consentila per questo indirizzo, ' +
                'oppure usa STAMPA e scegli «Salva come PDF».');
            return;
        }
        var chi = document.querySelector('.barra_alta .utente');
        var foglio = rpCostruisci(p, {
            infoRef: rpInfoRef,
            nofoto: VIA_NOFOTO,
            chiStampa: chi ? (chi.textContent || '').trim() : '',
            conBarra: false
        });
        var nome = nomeFilePdf(p);
        f.document.open();
        f.document.write(
            '<!doctype html><html lang="it"><head><meta charset="utf-8">' +
            '<base href="' + location.origin + C4_BASE + '">' +
            '<title>' + rpEsc(nome) + '</title>' +
            '<style>' + STILE_REPORT + '</style></head>' +
            '<body class="tim_stampa_report"><div id="tim_report">' +
            '<div class="rp_avviso">Si sta aprendo la finestra di stampa: scegli come ' +
            'destinazione <b>Salva come PDF</b> (su Windows anche <b>Microsoft Print to PDF</b>). ' +
            'Il file ti verr&agrave; proposto col nome <b>' + rpEsc(nome) + '.pdf</b>.<br>' +
            'Questo avviso non finisce nel PDF. Se la finestra non si e\' aperta, premi ' +
            'Ctrl+P (su Mac Cmd+P).</div>' +
            foglio + '</div></body></html>');
        f.document.close();

        var scaduto = false;
        setTimeout(function () { scaduto = true; }, 6000);
        (function aspettaLeFoto() {
            var img = f.document ? f.document.images : null;
            var pronte = true;
            if (img) {
                for (var i = 0; i < img.length; i++) if (!img[i].complete) { pronte = false; break; }
            }
            if (!pronte && !scaduto) { setTimeout(aspettaLeFoto, 120); return; }
            try { f.focus(); f.print(); } catch (e) { /* la finestra e' stata chiusa a mano */ }
        })();
    }

    /* RIMESSA IN PIEDI (j319, 01/10) - questa funzione era stata CANCELLATA PER SBAGLIO da me in
       j315, quando ho sostituito il blocco dell'ESPORTA PDF: il pezzo che ho rimpiazzato arrivava
       fino a «function chiudiReport», e si e' portato via anche apriReport, che stava in mezzo.
       COSA SUCCEDEVA, ed e' il motivo per cui va capito bene: il file restava sintatticamente
       valido (node --check non diceva niente) e i collaudi, che guardano se certe parole ci sono,
       passavano lo stesso. Ma al caricamento la riga
           bReport.addEventListener('click', apriReport);
       lanciava «apriReport is not defined» e TUTTO QUELLO CHE VIENE DOPO non girava piu' - compresa
       l'ultima riga del file, quella che toglie la classe «nascosto» al pulsante TIMONE.
       Risultato visto da Michele: «ho chiuso la finestra per il marketing, ma io agenzia non sto
       vedendo il timone», e il pulsante non c'era davvero, dalla sera di j315.
       Come si evita la prossima volta: non basta che il file compili e che le parole ci siano, va
       APERTA LA PAGINA VERA IN UN BROWSER e guardato che non ci siano errori. */
    function apriReport() {
        var p = pianoSalvato();
        if (!p || p.esiste !== true) return;
        if (!elReport) {
            elReport = document.createElement('div');
            elReport.id = 'tim_report';
            document.body.appendChild(elReport);
        }
        elReport.style.display = '';
        disegnaReport();

        // le schede che servono: solo i box delle referenze che finiranno sul foglio
        var manca = {};
        (p.voci || []).forEach(function (v) {
            if (!v.idElemento) return;
            var s = schedePerBox[String(v.idElemento)];
            if (!s || s.stato === 'carico') manca[String(v.idElemento)] = true;
        });
        var quanti = Object.keys(manca).length;
        if (!quanti) return;
        var arrivate = 0;
        Object.keys(manca).forEach(function (k) {
            chiediSchedaBox(k, function () {
                arrivate++;
                // si ridisegna una volta sola, alla fine: venti ridisegni di fila si vedono
                if (arrivate >= quanti && elReport && elReport.style.display !== 'none') disegnaReport();
            });
        });
    }

    function chiudiReport() {
        if (elReport) elReport.style.display = 'none';
    }

    /* ======================== I FILTRI PER IL PLUG-IN (j324) ========================
       Michele, 01/10: «dobbiamo esportare un json (lo puo' vedere solo l'agenzia non il
       marketing) dove riportiamo tutte le info del timone sui filtri del plug-in».

       Qui non c'e' niente da costruire: il pacchetto lo fa il server e arriva come file. Il
       browser fa tre cose sole - lo chiede, lo mette nei Download, e se il server dice no
       fa vedere il perche' a parole.

       PERCHE' UNA fetch E NON UN SEMPLICE COLLEGAMENTO: con un collegamento, quando il server
       risponde 403 o 423, il browser aprirebbe una pagina bianca con dentro il json della busta.
       Cosi' invece l'errore si legge nel riquadro di sempre.

       IL NOME DEL FILE lo decide il server e lo scrive nell'intestazione Content-Disposition:
       si legge da li', perche' il nome giusto e' quello - non uno ricostruito a mano che poi,
       il giorno che il server lo cambia, diventa diverso. Se l'intestazione non si leggesse,
       si ripiega su un nome fatto col titolo del volantino. */
    function nomeDaIntestazione(r, ripiego) {
        var cd = r.headers.get('Content-Disposition') || '';
        // filename*=UTF-8''... ha la precedenza, com'e' scritto nello standard
        var m = /filename\*=UTF-8''([^;]+)/i.exec(cd);
        if (m) { try { return decodeURIComponent(m[1]); } catch (e) { } }
        m = /filename="?([^";]+)"?/i.exec(cd);
        return m ? m[1] : ripiego;
    }

    function esportaFiltri() {
        var p = pianoSalvato();
        if (!p || p.esiste !== true) return;
        /* Si esporta il piano SALVATO, non la bozza: il server legge la banca dati e non sa
           niente di quello che hai davanti. Se ci sono modifiche in sospeso lo si dice, sennò
           l'operatore porta al plug-in un pacchetto che non contiene il suo ultimo lavoro e lo
           scopre un'ora dopo. */
        if (modifiche > 0) {
            messaggio('Esporta i filtri',
                      'Prima salva: il pacchetto si costruisce su quello che e\' stato salvato, ' +
                      'non su quello che hai davanti adesso.');
            return;
        }
        var ripiego = 'timone-' + (p.titolo || 'volantino') + '.zip';
        function aspetta(si) {
            bFiltri.disabled = si;
            bFiltri.textContent = si ? 'PREPARO…' : 'FILTRI';
        }
        aspetta(true);
        fetch(C4_BASE + 'Timone/' + ID_VOL + '/Esporta', { credentials: 'same-origin' })
            .then(function (r) {
                if (r.ok) return r.blob().then(function (b) {
                    return { blob: b, nome: nomeDaIntestazione(r, ripiego) };
                });
                return r.json().then(function (j) {
                    throw new Error((j && j.messaggio) || 'Il server non ha fatto il pacchetto.');
                }, function () {
                    throw new Error('Il server non ha fatto il pacchetto (errore ' + r.status + ').');
                });
            })
            .then(function (p) {
                var via = URL.createObjectURL(p.blob);
                var a = document.createElement('a');
                a.href = via;
                a.download = p.nome;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(function () { URL.revokeObjectURL(via); }, 8000);
                aspetta(false);
                messaggio('Filtri esportati',
                          'Il pacchetto e\' nei tuoi Download. Dentro c\'e\' il LEGGIMI.txt che ' +
                          'dice dove va copiato ogni file - leggilo, perche\' i gruppi e le ' +
                          'caselle i filtri non li sanno portare.');
            })
            .catch(function (e) {
                aspetta(false);
                messaggio('Esporta i filtri',
                          (e && e.message) || 'Non si e\' riusciti a scaricare il pacchetto.');
            });
    }

    var bReport = document.getElementById('tim_report_apri');
    bReport.addEventListener('click', apriReport);
    var bFiltri = document.getElementById('tim_filtri');
    bFiltri.addEventListener('click', esportaFiltri);

    /* ======================================================================================
       IL PULSANTE «FATTO» (j317).

       Michele, 01/10: «una volta che il marketing ha chiuso la finestra farei apparire una casella
       con scritto TIMONE che lampeggia. cosi' che l'agenzia possa capire subito che deve entrare
       nel volantino e fare prima le modifiche del marketing». E, alla domanda su cosa spegne la
       casella: «quando l'agenzia preme FATTO nel timone».

       Cosa fa: scrive sul piano la data del «fatto» e chi e' stato. NON tocca il piano - non
       sposta, non chiude, non esporta: e' un segnalibro fra due persone. Se il Marketing salva di
       nuovo dopo, la casella nella home torna ad accendersi da se', perche' il server confronta le
       due date (vedi VolantiniDaSistemareAsync in Servizi/ServizioTimone.cs).

       Si chiede conferma perche' e' un gesto che un'altra persona vede: all'Agenzia costa un clic,
       al Marketing costa sapere se qualcuno sta lavorando o no. */
    var bFatto = document.getElementById('tim_sistemato');

    function mostraFatto() {
        var puo = piano && piano.esiste === true && piano.puoGestireFinestra === true;
        bFatto.style.display = (puo && piano.daSistemare === true) ? '' : 'none';
    }

    bFatto.addEventListener('click', function () {
        if (!piano || piano.daSistemare !== true) return;
        /* La bozza non salvata non c'entra niente col «fatto», ma chi ha modifiche aperte e preme
           FATTO quasi sempre voleva premere SALVA: glielo si dice prima, non dopo. */
        if (modifiche > 0) {
            messaggio('Prima SALVA',
                'Hai ' + modifiche + ' ' +
                (modifiche === 1 ? 'modifica non salvata' : 'modifiche non salvate') +
                ' nel timone. Il «fatto» non le salva: salva prima, poi premi FATTO.');
            return;
        }
        messaggio('Hai finito con questo volantino?',
            'Premendo FATTO dici che hai riportato sull\'impaginato le modifiche che il Marketing ' +
            'ha chiesto col timone. L\'avviso «TIMONE» sparisce dalla home. Se il Marketing salva ' +
            'altre modifiche, l\'avviso torna da se\'.',
            'Sì, ho finito', function () {
                bFatto.disabled = true;
                manda(C4_BASE + 'Timone/' + ID_VOL + '/Sistemato').then(function (r) {
                    bFatto.disabled = false;
                    if (!r.ok) { messaggio('Non si e\' potuto', r.messaggio || ''); return; }
                    salvato = JSON.stringify(r.dati);
                    rifaiBozza();
                    mostraFatto();
                    avviso('Fatto: l\'avviso del timone e\' stato spento nella home.');
                }).catch(function () {
                    bFatto.disabled = false;
                    messaggio('Non si e\' potuto', 'Server non raggiungibile.');
                });
            });
    });

    document.getElementById('tim_chiudi').addEventListener('click', chiudi);
    document.getElementById('tim_prec').addEventListener('click', function () {
        vaiA(numeroPaginaVisibile() - 1);
    });
    document.getElementById('tim_succ').addEventListener('click', function () {
        vaiA(numeroPaginaVisibile() + 1);
    });

    /* Scrivere il numero e premere Invio. Se la pagina non esiste il campo torna a quella di
       adesso, senza avvisi: si e' solo sbagliato a battere. */
    var campoPag = document.getElementById('tim_npag');
    function saltaAScritto() {
        var n = parseInt(campoPag.value, 10);
        if (!n || n < 1 || n > quantePagine() || !vaiA(n)) campoPag.value = numeroPaginaVisibile();
        campoPag.blur();
    }
    campoPag.addEventListener('keydown', function (e) {
        // l'Escape lo lascio al gestore generale; qui rimetto solo il numero di adesso
        if (e.key === 'Enter') { e.preventDefault(); saltaAScritto(); }
    });
    campoPag.addEventListener('blur', function () {
        campoPag.value = numeroPaginaVisibile();
    });
    campoPag.addEventListener('focus', function () { campoPag.select(); });

    /* l'occhietto: si sbircia l'impaginato di prima e si torna. Non tocca la bozza. */
    var bOcchio = document.getElementById('tim_occhio');
    function sbircia(si) {
        document.body.classList.toggle('tim_sbircia', si);
        bOcchio.classList.toggle('acceso', si);
        bOcchio.title = si ? 'Torna al timone' : 'Guarda com\'era impaginato prima';
        var e = barra.querySelector('.sbirciando');
        if (si && !e) {
            e = document.createElement('span');
            e.className = 'sbirciando';
            e.textContent = 'stai guardando l\'impaginato di prima';
            barra.insertBefore(e, barra.querySelector('.destra'));
        } else if (!si && e) { e.remove(); }
    }
    bOcchio.addEventListener('click', function () {
        sbircia(!document.body.classList.contains('tim_sbircia'));
    });
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        // prima si chiudono le finestrelle, poi semmai il timone
        // j312: il report sta sopra tutto, quindi l'Escape tocca prima a lui
        if (elReport && elReport.style.display !== 'none') { chiudiReport(); return; }
        if (document.getElementById('tim_cestino')) { chiudiCestino(); return; }
        if (document.getElementById('tim_pagine')) { chiudiPagine(); return; }
        if (document.getElementById('tim_scelta')) { chiudiScelta(); return; }
        if (aperto) chiudi();
    });
    bottone.addEventListener('click', function () { aperto ? chiudi() : apri(); });

    // se si rimpicciolisce la finestra o si cambia zoom, le caselle si rifanno
    /* SI CAMBIA PAGINA: bisogna accorgersene comunque sia successo.
       Michele (28/09) ha cambiato pagina dal pannello delle miniature a destra e ha trovato la
       pagina nuova tutta scura e senza referenze: il timone non se n'era accorto. C'era un
       aggancio al clic sulle miniature, ma si e' perso in uno dei passaggi di oggi e soprattutto
       non copriva gli altri modi di cambiare pagina (la lettura affiancata, il libro in alto a
       destra, lo zoom).

       Adesso invece si guardano i fogli stessi: quando uno cambia il suo 'style' - ed e' quello
       che succede sempre, perche' cambiare pagina vuol dire accendere un foglio e spegnere
       l'altro - si ridisegna. Non si rischia di girare a vuoto: il disegno aggiunge figli ai
       fogli, non cambia il loro style. */
    var riDisegno = null;
    var osservatore = new MutationObserver(function () {
        if (!aperto) return;
        clearTimeout(riDisegno);
        riDisegno = setTimeout(disegna, 50);
    });
    document.querySelectorAll('.foglio').forEach(function (f) {
        osservatore.observe(f, { attributes: true, attributeFilter: ['style', 'class'] });
    });

    window.addEventListener('resize', function () { if (aperto) disegna(); });
    var zoom = document.getElementById('zoom');
    if (zoom) zoom.addEventListener('input', function () { if (aperto) setTimeout(disegna, 30); });

    /* ---------- LO ZOOM NELLA BARRA DEL TIMONE (j273) ----------
       Non e' uno zoom nuovo: gira la manopola di quello che c'e' gia' nell'editor. Si scrive il
       valore nella barretta #zoom e le si manda un evento 'input': da li' in poi fa tutto il
       codice dell'editor, che e' quello collaudato da mesi. Cosi' non c'e' un secondo modo di
       ingrandire che puo' andare fuori sincrono col primo.
       I bottoni «adatta» e il valore percentuale fanno lo stesso: «adatta» preme il bottone che
       c'e' gia' (#zoomFit), che calcola sullo spazio VERO rimasto - e col timone aperto l'area e'
       piu' stretta di 250px, quindi il conto viene giusto da solo. */
    var zBarra = document.getElementById('tim_zbarra');
    var zQuanto = document.getElementById('tim_zq');
    var zGruppo = document.getElementById('tim_zoom');

    function leggiZoom() {
        return zoom ? Number(zoom.value) || 48 : 48;
    }

    function aggiornaZoom() {
        if (!zoom) { zGruppo.style.display = 'none'; return; }
        zBarra.min = zoom.min || 20;
        zBarra.max = zoom.max || 200;
        zBarra.value = leggiZoom();
        zQuanto.textContent = leggiZoom() + '%';
    }

    function metteZoom(v) {
        if (!zoom) return;
        var min = Number(zoom.min) || 20, max = Number(zoom.max) || 200;
        v = Math.max(min, Math.min(max, Math.round(v)));
        zoom.value = v;
        // l'evento e' quello che ascolta gia' l'editor: da qui in poi fa tutto lui
        zoom.dispatchEvent(new Event('input', { bubbles: true }));
        aggiornaZoom();
    }

    zBarra.addEventListener('input', function () { metteZoom(Number(zBarra.value)); });
    document.getElementById('tim_zmeno').addEventListener('click', function () { metteZoom(leggiZoom() - 10); });
    document.getElementById('tim_zpiu').addEventListener('click', function () { metteZoom(leggiZoom() + 10); });
    document.getElementById('tim_zfit').addEventListener('click', function () {
        var f = document.getElementById('zoomFit');
        if (f) { f.click(); setTimeout(aggiornaZoom, 60); }
    });
    // se lo zoom viene cambiato da un'altra parte, la barretta del timone lo segue
    if (zoom) zoom.addEventListener('input', aggiornaZoom);

    /* Il bottone si vede solo a chi puo' usare il timone: Marketing e Agenzia. Al Category il
       server risponde 403 e il bottone resta nascosto: nessuna regola di ruolo scritta due volte. */
    chiedi(C4_BASE + 'Timone/' + ID_VOL + '/Piano').then(function (j) {
        if (j && j.ok) bottone.classList.remove('nascosto');
    }).catch(function () { });
})();

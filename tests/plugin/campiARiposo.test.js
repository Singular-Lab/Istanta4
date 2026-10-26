/*
 * I20-1123: i campi di testo a riposo.
 *
 * In UXP i campi di testo nativi stanno sopra a qualunque elemento HTML: suggerimenti, popup e
 * finestre finivano sotto le caselle, e i campi si spegnevano a mano con .hideble. Ora ogni campo,
 * quando non ci si scrive, ha accanto un riquadro HTML con il suo testo e lui resta invisibile; al
 * passaggio del mouse torna il campo vero, che cosi' riceve il clic dell'operatore (un campo nativo di
 * UXP attivato da codice non scrive); all'uscita, o quando qualcosa gli compare sopra, torna il
 * riquadro con il testo nuovo.
 *
 * campiARiposo.js si carica sotto Node; la pagina e' un documento finto, con quel che serve al
 * giro: elementi, attributi, stile, figli, eventi.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { fileDelPlugin, leggiFileDelPlugin } = require("./fileDelPlugin");

const CampiARiposo = require("../../plugin/campiARiposo.js");

/* ---- il documento finto ---- */

class Elemento {
    constructor(tag) {
        this.tagName = tag.toUpperCase();
        this.style = {};
        this.attributi = {};
        this.childNodes = [];
        this.parentNode = null;
        this.ascoltatori = {};
        this.offsetWidth = 0;
        this.offsetHeight = 0;
        this.value = "";
        this.disabled = false;
        this.clic = 0;
        this._testo = null;
    }
    get className() { return this.attributi["class"] || ""; }
    set className(v) { this.attributi["class"] = v; }
    setAttribute(n, v) { this.attributi[n] = String(v); }
    getAttribute(n) { return n in this.attributi ? this.attributi[n] : null; }
    hasAttribute(n) { return n in this.attributi; }
    removeAttribute(n) { delete this.attributi[n]; }
    addEventListener(t, f) { (this.ascoltatori[t] = this.ascoltatori[t] || []).push(f); }
    removeEventListener(t, f) { this.ascoltatori[t] = (this.ascoltatori[t] || []).filter(x => x !== f); }
    manda(t) { (this.ascoltatori[t] || []).slice().forEach(f => f({ type: t, target: this })); }
    appendChild(n) { return this.insertBefore(n, null); }
    insertBefore(n, rif) {
        if (n.parentNode) { n.parentNode.removeChild(n); }
        const i = rif == null ? this.childNodes.length : this.childNodes.indexOf(rif);
        this.childNodes.splice(i, 0, n);
        n.parentNode = this;
        return n;
    }
    removeChild(n) {
        this.childNodes = this.childNodes.filter(x => x !== n);
        n.parentNode = null;
        return n;
    }
    get firstChild() { return this.childNodes[0] || null; }
    get previousSibling() {
        if (!this.parentNode) { return null; }
        const fratelli = this.parentNode.childNodes;
        return fratelli[fratelli.indexOf(this) - 1] || null;
    }
    get textContent() {
        return this._testo != null ? this._testo : this.childNodes.map(n => n.textContent).join("");
    }
    set textContent(v) { this._testo = v; this.childNodes = []; }
    querySelector(sel) { return tutti(this).find(n => corrisponde(n, sel)) || null; }
    contains(n) {
        for (let x = n; x != null; x = x.parentNode) {
            if (x === this) { return true; }
        }
        return false;
    }
    focus() { documento.activeElement = this; this.manda("focus"); }
    blur() { if (documento.activeElement === this) { documento.activeElement = null; } this.manda("blur"); }
    click() { this.clic++; this.manda("click"); }
}

function tutti(radice) {
    const elenco = [];
    (radice.childNodes || []).forEach(n => {
        if (n instanceof Elemento) {
            elenco.push(n);
            elenco.push(...tutti(n));
        }
    });
    return elenco;
}

function corrisponde(n, sel) {
    if (sel.startsWith(".")) {
        return n.className.split(/\s+/).indexOf(sel.substring(1)) >= 0;
    }
    return n.tagName.toLowerCase() === sel;
}

let documento = null;

function nuovoDocumento() {
    const body = new Elemento("body");
    documento = {
        body,
        activeElement: null,
        createElement: (tag) => new Elemento(tag),
        createTextNode: (testo) => ({ nodeType: 3, textContent: testo, parentNode: null }),
        querySelectorAll: (selettori) => {
            const lista = selettori.split(",").map(s => s.trim());
            return tutti(body).filter(n => lista.some(s => corrisponde(n, s)));
        }
    };
    global.document = documento;
    CampiARiposo._campi = [];
    CampiARiposo._mostrati = [];
    return body;
}

/// Un campo che si vede, messo in un contenitore.
function campo(tag, opzioni = {}) {
    const el = new Elemento(tag);
    el.offsetWidth = opzioni.larghezza != null ? opzioni.larghezza : 120;
    el.offsetHeight = opzioni.altezza != null ? opzioni.altezza : 40;
    Object.entries(opzioni.attributi || {}).forEach(([n, v]) => el.setAttribute(n, v));
    Object.assign(el.style, opzioni.stile || {});
    el.value = opzioni.valore || "";
    const contenitore = new Elemento("div");
    contenitore.appendChild(el);
    documento.body.appendChild(contenitore);
    return el;
}

/// Il livello interno del riquadro: bordo grigio nativo, margine, interlinea e testo.
function internoDi(riquadro) {
    return riquadro.childNodes[0];
}

/// Il testo che il riquadro mostra, con gli a capo.
function testoDi(riquadro) {
    return internoDi(riquadro).childNodes.map(n => (n instanceof Elemento && n.tagName === "BR") ? "\n" : n.textContent).join("");
}

function riquadroDi(el) {
    return el.__riposo ? el.__riposo.riquadro : null;
}

/* ---- le regole ---- */

test("a riposo il testo ha il corpo dello stile del campo, se c'e', altrimenti quello nativo", () => {
    //TASK-19c18841: i campi delle pagine di Svuota e Bolli sono a 14 px anche mentre ci si scrive.
    assert.strictEqual(CampiARiposo.corpo({ style: { fontSize: "14px" } }), "14px");
    assert.strictEqual(CampiARiposo.corpo({ style: { fontSize: "" } }), CampiARiposo.CORPO);
    assert.strictEqual(CampiARiposo.corpo({ style: {} }), CampiARiposo.CORPO);
    assert.strictEqual(CampiARiposo.corpo(null), CampiARiposo.CORPO);
    assert.match(leggiFileDelPlugin("campiARiposo.js"), /dentro\.fontSize = CampiARiposo\.corpo\(campo\);/);
});

test("sono campi di testo le caselle, gli input di testo e i sp-textfield, non password, spunte e pulsanti", () => {
    nuovoDocumento();
    const conTipo = (tag, tipo) => { const e = new Elemento(tag); if (tipo != null) { e.setAttribute("type", tipo); } return e; };

    assert.strictEqual(CampiARiposo.eCampoDiTesto(conTipo("textarea")), true);
    assert.strictEqual(CampiARiposo.eCampoDiTesto(conTipo("input")), true);
    ["text", "number", "search", "TEXT"].forEach(t => assert.strictEqual(CampiARiposo.eCampoDiTesto(conTipo("input", t)), true, t));
    ["password", "checkbox", "button", "radio", "date", "file"].forEach(t => assert.strictEqual(CampiARiposo.eCampoDiTesto(conTipo("input", t)), false, t));
    assert.strictEqual(CampiARiposo.eCampoDiTesto(conTipo("sp-textfield")), true);
    assert.strictEqual(CampiARiposo.eCampoDiTesto(conTipo("sp-textfield", "password")), false);
    assert.strictEqual(CampiARiposo.eCampoDiTesto(conTipo("sp-picker")), false);
    assert.strictEqual(CampiARiposo.eCampoDiTesto(conTipo("div")), false);
    assert.strictEqual(CampiARiposo.eCampoDiTesto(null), false);

    const nativo = conTipo("textarea");
    nativo.setAttribute("data-sempre-nativo", "");
    assert.strictEqual(CampiARiposo.eCampoDiTesto(nativo), false);
});

test("il riquadro mostra il valore, o il testo d'esempio se e' vuoto, con tutti gli a capo", () => {
    assert.deepStrictEqual(CampiARiposo.testoDaMostrare("al kg", "Es: 2-5"), { testo: "al kg", segnaposto: false });
    assert.deepStrictEqual(CampiARiposo.testoDaMostrare("", "Es: 2-5"), { testo: "Es: 2-5", segnaposto: true });
    assert.deepStrictEqual(CampiARiposo.testoDaMostrare(null, null), { testo: "", segnaposto: true });
    assert.deepStrictEqual(CampiARiposo.testoDaMostrare(0, null), { testo: "0", segnaposto: false });
    assert.deepStrictEqual(CampiARiposo.righe("a\nb\r\nc\rd"), ["a", "b", "c", "d"]);
});

/* ---- il giro ---- */

test("il giro mette a riposo i campi che si vedono: riquadro prima del campo, campo invisibile", () => {
    nuovoDocumento();
    const casella = campo("textarea", { larghezza: 100, altezza: 50, valore: "prodotto italiano\nCategoria I", stile: { width: "100px", height: "50px", backgroundColor: "white", color: "black" } });
    const nascosta = campo("textarea", { larghezza: 0, altezza: 0 });
    const password = campo("input", { attributi: { type: "password" } });

    CampiARiposo.giro();

    const riquadro = riquadroDi(casella);
    assert.ok(riquadro != null);
    assert.strictEqual(casella.previousSibling, riquadro);
    assert.strictEqual(riquadro.className, "campoARiposo");
    assert.strictEqual(casella.style.visibility, "hidden");
    assert.strictEqual(casella.style.position, "absolute");
    assert.strictEqual(casella.hasAttribute("data-a-riposo"), true);
    assert.strictEqual(testoDi(riquadro), "prodotto italiano\nCategoria I");

    //Fuori le misure, lo sfondo e il bordo dello stile del campo (qui nessuno).
    assert.strictEqual(riquadro.style.width, "100px");
    assert.strictEqual(riquadro.style.height, "50px");
    assert.strictEqual(riquadro.style.backgroundColor, "white");
    ["borderTop", "borderBottom", "borderLeft", "borderRight"].forEach(lato => assert.strictEqual(riquadro.style[lato], "none", lato));
    //Dentro il bordo grigio nativo e il testo, come lo disegna UXP: misurati al pixel sugli screenshot
    //del riquadro e del campo vero, niente sopra, 5px ai lati, interlinea 13px.
    const interno = internoDi(riquadro);
    assert.strictEqual(interno.style.border, "1px solid #747474");
    assert.strictEqual(interno.style.color, "black");
    assert.strictEqual(interno.style.fontSize, "10px");
    assert.strictEqual(interno.style.fontFamily, "system-ui");
    assert.strictEqual(interno.style.padding, "0px 5px");
    assert.strictEqual(interno.style.lineHeight, "13px");
    assert.strictEqual(interno.style.height, "100%");
    //Il riquadro non prende lo stato attivo: col Tab non ci si arriva.
    assert.strictEqual(riquadro.hasAttribute("tabindex"), false);

    //Un campo che non si vede non ha misure da copiare: aspetta. La password resta nativa.
    assert.strictEqual(nascosta.__riposo, undefined);
    assert.strictEqual(password.__riposo, undefined);

    //Un secondo giro non ne aggiunge un altro.
    CampiARiposo.giro();
    assert.strictEqual(casella.parentNode.childNodes.filter(n => n.className === "campoARiposo").length, 1);
});

test("senza misure di stile il riquadro prende quelle del campo, e i colori del campo nativo", () => {
    nuovoDocumento();
    const ordine = campo("input", { larghezza: 40, altezza: 22, attributi: { type: "text" }, valore: "3" });
    CampiARiposo.giro();
    const riquadro = riquadroDi(ordine);
    assert.strictEqual(riquadro.style.width, "40px");
    assert.strictEqual(riquadro.style.height, "22px");
    //Misurati sulla casella Ordine del Menabo': sfondo #444444; sopra e sotto una riga chiara fuori e
    //una piu' scura dentro, ai lati il grigio, angoli arrotondati.
    assert.strictEqual(riquadro.style.backgroundColor, "#444444");
    assert.strictEqual(riquadro.style.borderTop, "1px solid #bcbcbc");
    assert.strictEqual(riquadro.style.borderBottom, "1px solid #bcbcbc");
    assert.strictEqual(riquadro.style.borderLeft, "none");
    assert.strictEqual(riquadro.style.borderRadius, "2px");
    const interno = internoDi(riquadro);
    assert.strictEqual(interno.style.borderTop, "1px solid #8e8e8e");
    assert.strictEqual(interno.style.borderBottom, "1px solid #8e8e8e");
    assert.strictEqual(interno.style.border, "1px solid #747474");
    //Un input e' una riga sola, a meta' altezza come nel campo nativo: interlinea = interno, bordi esclusi.
    //"pre" e non "nowrap": non va a capo e tiene gli spazi (I20-1139).
    assert.strictEqual(interno.style.whiteSpace, "pre");
    assert.strictEqual(interno.style.lineHeight, "18px");
});

test("il testo sta a sinistra anche se lo stile dice centro, e la larghezza e' quella vera del campo", () => {
    nuovoDocumento();
    //La casella Ordine: stile 40px e text-align center; il campo nativo occupa 45px e ignora il centro.
    const ordine = campo("input", { larghezza: 45, altezza: 22, attributi: { type: "text" }, valore: "1", stile: { width: "40px", textAlign: "center" } });
    //Un campo largo in percentuale segue il pannello.
    const filtro = campo("textarea", { larghezza: 150, altezza: 30, stile: { width: "30%", height: "30px" } });
    CampiARiposo.giro();

    assert.strictEqual(internoDi(riquadroDi(ordine)).style.textAlign, "left");
    assert.strictEqual(riquadroDi(ordine).style.width, "45px");
    assert.strictEqual(riquadroDi(filtro).style.width, "30%");
    assert.strictEqual(riquadroDi(filtro).style.height, "30px");
});

test("una casella col bordo giallo: fuori il giallo, dentro il grigio nativo, come la disegna UXP", () => {
    nuovoDocumento();
    //Misurata al pixel: 2px giallo, 1px grigio #747474, poi il testo a 5px. Prima il riquadro aveva
    //solo il giallo, e il testo stava 1px piu' in alto e a sinistra.
    const gialla = campo("textarea", { valore: "un esempio: di chia", stile: { width: "200px", height: "100px", border: "2px solid gold", backgroundColor: "white", color: "black" } });
    CampiARiposo.giro();
    const riquadro = riquadroDi(gialla);
    ["borderTop", "borderBottom", "borderLeft", "borderRight"].forEach(lato => assert.strictEqual(riquadro.style[lato], "2px solid gold", lato));
    assert.strictEqual(internoDi(riquadro).style.border, "1px solid #747474");
    assert.strictEqual(internoDi(riquadro).style.padding, "0px 5px");
    assert.strictEqual(testoDi(riquadro), "un esempio: di chia");

    //Il bordo cambiato da codice (la descrizione esce dal mismatch) si segue.
    gialla.style.border = "";
    CampiARiposo.giro();
    assert.strictEqual(riquadro.style.borderTop, "none");
});

test("l'interlinea: 13px nelle caselle, l'interno del campo in quelli di una riga", () => {
    nuovoDocumento();
    const conAltezza = (tag, altezza, bordo) => { const e = new Elemento(tag); e.offsetHeight = altezza; if (bordo) { e.style.border = bordo; } return e; };
    assert.strictEqual(CampiARiposo.interlinea(conAltezza("textarea", 50)), "13px");
    assert.strictEqual(CampiARiposo.interlinea(conAltezza("input", 22)), "18px");
    assert.strictEqual(CampiARiposo.interlinea(conAltezza("input", 30, "2px solid gold")), "24px");
    assert.strictEqual(CampiARiposo.interlinea(conAltezza("input", 0)), "13px");
    const conEtichetta = conAltezza("sp-textfield", 50);
    const etichetta = new Elemento("sp-label");
    etichetta.textContent = "Codice";
    conEtichetta.appendChild(etichetta);
    assert.strictEqual(CampiARiposo.interlinea(conEtichetta), "13px");

    assert.strictEqual(CampiARiposo.spessoreBordo("2px solid gold"), 2);
    assert.strictEqual(CampiARiposo.spessoreBordo(""), 0);
    assert.strictEqual(CampiARiposo.spessoreBordo(null), 0);
});

/* ---- scrivere ---- */

test("il mouse sul riquadro mostra il campo vero, senza dargli lo stato attivo e senza clic da codice", () => {
    nuovoDocumento();
    const casella = campo("textarea", { valore: "al kg", stile: { position: "", visibility: "" } });
    CampiARiposo.giro();
    const riquadro = riquadroDi(casella);

    riquadro.manda("mouseenter");

    assert.strictEqual(riquadro.style.display, "none");
    assert.strictEqual(casella.style.visibility, "");
    assert.strictEqual(casella.style.position, "");
    assert.strictEqual(casella.hasAttribute("data-a-riposo"), false);
    //Lo stato attivo e il clic sono dell'operatore: da codice il campo nativo non scriverebbe.
    assert.strictEqual(documento.activeElement, null);
    assert.strictEqual(casella.clic, 0);
    assert.deepStrictEqual(CampiARiposo._mostrati, [casella]);

    //Una seconda entrata non cambia niente.
    riquadro.manda("mouseenter");
    assert.deepStrictEqual(CampiARiposo._mostrati, [casella]);
});

test("se l'entrata del mouse non arriva, basta il tasto premuto", () => {
    nuovoDocumento();
    const casella = campo("textarea", { valore: "x" });
    CampiARiposo.giro();
    riquadroDi(casella).manda("mousedown");
    assert.strictEqual(riquadroDi(casella).style.display, "none");
    assert.strictEqual(casella.hasAttribute("data-a-riposo"), false);
    assert.deepStrictEqual(CampiARiposo._mostrati, [casella]);
});

test("dopo averci scritto, all'uscita il riquadro mostra il testo nuovo", () => {
    nuovoDocumento();
    const casella = campo("textarea", { valore: "al kg" });
    CampiARiposo.giro();
    const riquadro = riquadroDi(casella);

    riquadro.manda("mouseenter");
    casella.focus();
    casella.value = "cad.";
    casella.blur();

    assert.strictEqual(casella.style.visibility, "hidden");
    assert.strictEqual(riquadro.style.display, "inline-block");
    assert.strictEqual(testoDi(riquadro), "cad.");
    assert.deepStrictEqual(CampiARiposo._mostrati, []);
});

test("un clic altrove rimette a riposo il campo solo sfiorato, non quello in cui si scrive", () => {
    nuovoDocumento();
    const sfiorato = campo("textarea", { valore: "a" });
    const attivo = campo("textarea", { valore: "b" });
    CampiARiposo.giro();
    riquadroDi(attivo).manda("mouseenter");
    attivo.focus();
    riquadroDi(sfiorato).manda("mouseenter");

    //Il clic che apre il campo, sul campo o sul suo riquadro (anche sul livello interno), non lo chiude.
    CampiARiposo._clicNellaPagina({ target: sfiorato });
    CampiARiposo._clicNellaPagina({ target: riquadroDi(sfiorato) });
    CampiARiposo._clicNellaPagina({ target: internoDi(riquadroDi(sfiorato)) });
    assert.strictEqual(CampiARiposo._mostrati.indexOf(sfiorato) >= 0, true);

    CampiARiposo._clicNellaPagina({ target: documento.body });
    assert.strictEqual(sfiorato.style.visibility, "hidden");
    assert.strictEqual(CampiARiposo._mostrati.indexOf(attivo) >= 0, true);
});

test("passando su un altro campo, quello solo sfiorato torna a riposo; quello in cui si scrive resta", () => {
    nuovoDocumento();
    const nome = campo("textarea", { valore: "Mele" });
    const marca = campo("textarea", { valore: "CONAD" });
    const tipo = campo("textarea", { valore: "prodotto italiano" });
    CampiARiposo.giro();

    riquadroDi(nome).manda("mouseenter");
    riquadroDi(marca).manda("mouseenter");
    assert.strictEqual(nome.style.visibility, "hidden");
    assert.deepStrictEqual(CampiARiposo._mostrati, [marca]);

    marca.focus();
    riquadroDi(tipo).manda("mouseenter");
    assert.deepStrictEqual(CampiARiposo._mostrati, [marca, tipo]);
});

test("un campo disattivato resta a riposo", () => {
    nuovoDocumento();
    const spento = campo("input", { valore: "0" });
    spento.disabled = true;
    CampiARiposo.giro();
    riquadroDi(spento).manda("mouseenter");
    assert.strictEqual(spento.style.visibility, "hidden");
    assert.deepStrictEqual(CampiARiposo._mostrati, []);
    assert.strictEqual(internoDi(riquadroDi(spento)).style.color, CampiARiposo.TESTO_SPENTO);
});

test("quando qualcosa compare sopra, tutti i campi tornano a riposo, anche quello in cui si scrive; non quello da cui parte", () => {
    nuovoDocumento();
    const sfiorato = campo("textarea", { valore: "a" });
    const attivo = campo("textarea", { valore: "b" });
    CampiARiposo.giro();
    assert.strictEqual(CampiARiposo.tuttiARiposo(), false);

    riquadroDi(attivo).manda("mouseenter");
    attivo.focus();
    riquadroDi(sfiorato).manda("mouseenter");
    assert.strictEqual(CampiARiposo.tuttiARiposo(), true);
    assert.deepStrictEqual(CampiARiposo._mostrati, []);
    assert.strictEqual(documento.activeElement, null);
    assert.strictEqual(attivo.style.visibility, "hidden");

    //Il suggerimento del campo stesso (il suo title) non lo chiude.
    riquadroDi(attivo).manda("mouseenter");
    attivo.focus();
    assert.strictEqual(CampiARiposo.tuttiARiposo(attivo), false);
    assert.deepStrictEqual(CampiARiposo._mostrati, [attivo]);
    assert.strictEqual(documento.activeElement, attivo);
});

/* ---- il riquadro segue il campo ---- */

test("il riquadro segue il valore scritto da codice, il campo nascosto o mostrato, il campo spostato o tolto", () => {
    nuovoDocumento();
    const casella = campo("textarea", { valore: "prima" });
    CampiARiposo.giro();
    const riquadro = riquadroDi(casella);

    casella.value = "dopo";
    CampiARiposo.giro();
    assert.strictEqual(testoDi(riquadro), "dopo");

    //jQuery hide e show lavorano su display: il riquadro va con loro.
    casella.style.display = "none";
    CampiARiposo.giro();
    assert.strictEqual(riquadro.style.display, "none");
    casella.style.display = "";
    CampiARiposo.giro();
    assert.strictEqual(riquadro.style.display, "inline-block");

    //Spostato altrove da codice: il riquadro gli va dietro.
    const altrove = new Elemento("div");
    documento.body.appendChild(altrove);
    altrove.appendChild(casella);
    CampiARiposo.giro();
    assert.strictEqual(casella.previousSibling, riquadro);

    //Tolto: via anche il riquadro.
    altrove.parentNode.removeChild(altrove);
    CampiARiposo.giro();
    assert.strictEqual(CampiARiposo._campi.indexOf(casella), -1);
    assert.strictEqual(riquadro.parentNode, null);
    assert.strictEqual(casella.__riposo, null);
});

test("un riquadro copiato senza il suo campo se ne va, e il campo copiato si rimette a riposo col suo stile", () => {
    nuovoDocumento();
    //La copia di una schermata (cloneElementWithEvents): riquadro senza campo, campo con lo stile spento.
    const copia = new Elemento("div");
    copia.className = "campoARiposo";
    const contenitore = new Elemento("div");
    contenitore.appendChild(copia);
    const casella = new Elemento("textarea");
    casella.offsetWidth = 100;
    casella.offsetHeight = 30;
    casella.setAttribute("data-a-riposo", "");
    casella.style.visibility = "hidden";
    casella.style.position = "absolute";
    contenitore.appendChild(casella);
    documento.body.appendChild(contenitore);

    CampiARiposo.giro();

    assert.strictEqual(copia.parentNode, null);
    riquadroDi(casella).manda("mouseenter");
    //Lo stile spento non era il suo: aperto, il campo si vede.
    assert.strictEqual(casella.style.visibility, "");
    assert.strictEqual(casella.style.position, "");
});

test("un campo vuoto mostra in grigio il testo d'esempio, un sp-textfield anche la sua etichetta", () => {
    nuovoDocumento();
    const pagine = campo("sp-textfield", { attributi: { placeholder: "Es: 2-5,7,9,14-18" } });
    const codice = campo("sp-textfield", { valore: "6745551" });
    const etichetta = new Elemento("sp-label");
    etichetta.textContent = "Codice";
    codice.appendChild(etichetta);

    CampiARiposo.giro();

    assert.strictEqual(testoDi(riquadroDi(pagine)), "Es: 2-5,7,9,14-18");
    assert.strictEqual(internoDi(riquadroDi(pagine)).style.color, CampiARiposo.TESTO_SPENTO);
    const righe = internoDi(riquadroDi(codice)).childNodes;
    assert.strictEqual(righe[0].textContent, "Codice");
    assert.strictEqual(righe[1].textContent, "6745551");
});

test("senza pagina il giro non fa niente", () => {
    delete global.document;
    assert.doesNotThrow(() => CampiARiposo.giro());
});

/* ---- sul sorgente ---- */

test("chi apre qualcosa sopra il pannello rimette a riposo i campi: anche suggerimenti, menu e Info del report", () => {
    const tooltip = leggiFileDelPlugin("tooltip/tooltip.js").replace(/\r/g, "");
    const mostra = tooltip.substring(tooltip.indexOf("    _mostraTooltip(elemento, testo) {"), tooltip.indexOf("    _creaRiquadroTooltip() {"));
    assert.match(mostra, /CampiARiposo\.tuttiARiposo\(elemento\);[\s\S]*this\._creaRiquadroTooltip\(\)/);
    const menu = leggiFileDelPlugin("menu.js").replace(/\r/g, "");
    assert.match(menu, /Menu\.chiudiFloatingMenu\(\);\s*\/\/I20-1123[^\n]*\n\s*CampiARiposo\.tuttiARiposo\(\);/);
    const pannelli = leggiFileDelPlugin("reportIntegrita/pannelli.js").replace(/\r/g, "");
    assert.match(pannelli, /_apriOverlayInfoReport\(titolo\) \{\s*\$\("#confrontoInfoOverlay"\)\.remove\(\);\s*\/\/I20-1123[^\n]*\n\s*CampiARiposo\.tuttiARiposo\(\);/);

    //E il campo non si attiva mai da codice: niente focus() ne' click() su un campo.
    const codice = leggiFileDelPlugin("campiARiposo.js").replace(/\r/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(codice, /campo\.focus\(\)|campo\.click\(\)/);
    //Il clic altrove si ascolta sulla pagina, all'avvio.
    assert.match(codice, /document\.addEventListener\("click", \(evento\) => CampiARiposo\._clicNellaPagina\(evento\)\);/);
});

test("il Plugin avvia i campi a riposo all'apertura, e .hideble non c'e' piu'", () => {
    const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    assert.match(indexNew, /const CampiARiposo = require\('\.\/campiARiposo'\);/);
    assert.match(indexNew, /Tooltip\.abilitaTooltipGlobali\(\);\s*\/\/I20-1123[^\n]*\n\s*CampiARiposo\.avvia\(\);/);

    //Ne' la classe ne' le funzioni che la spegnevano e riaccendevano, fuori dai commenti.
    const senzaCommenti = (testo) => testo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/<!--[\s\S]*?-->/g, "");
    const file = fileDelPlugin().concat(["index.html"]);
    const trovati = file.filter(f => /hideble|HidebleElements|dopoLaDomanda/.test(senzaCommenti(leggiFileDelPlugin(f))));
    assert.deepStrictEqual(trovati, []);
});

test("le caselle della descrizione tengono il primo class, vuoto: il secondo non deve accendersi", () => {
    const scheda = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    const caselle = scheda.match(/var textarea = \$\('<textarea ' \+ [^\n]*/g) || [];
    assert.strictEqual(caselle.length, 3);
    caselle.forEach(riga => {
        assert.ok(riga.indexOf(' class="" labelCorrispondente="descrizione"') > 0, riga.substring(0, 120));
        //Il secondo class resta dov'era, dopo il primo.
        assert.ok(riga.indexOf('class="textArea nonCancellareSeVuoto') > riga.indexOf(' class=""'));
    });
});

test("la documentazione del Plugin ha la sua pagina", () => {
    const pagina = path.join(__dirname, "..", "..", "sorgenti", "documentazione", "plugin", "campiARiposo.md");
    assert.ok(fs.existsSync(pagina));
});

/* ---- I20-1137: i campi dei cambi strutturali restano nativi ---- */

//Nella finestra "Cambia prezzo promo" il campo a riposo, al passaggio del mouse, rientrava nella riga
//e UXP non la ridisponeva: il campo si spostava sopra la sua etichetta. Misurato in console con
//l'operatore il 26/10/2026: UXP non ricalcola la riga quando un elemento gia' disposto esce o rientra
//nel flusso, e non applica margini negativi. Quei campi restano nativi e fermi.

test("ogni casella dei cambi strutturali della scheda ref resta nativa", () => {
    const scheda = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    const caselle = scheda.match(/<input[^>]*fieldCambioStrutturale[^>]*>/g) || [];

    assert.strictEqual(caselle.length, 4, "riga dell'azione e finestra, per il valore libero e per quello forzato");
    caselle.forEach(casella => assert.ok(casella.includes("data-sempre-nativo"), casella.substring(0, 120)));
});

test("una casella dei cambi strutturali sotto la sua etichetta resta nativa e ferma dopo il giro", () => {
    nuovoDocumento();
    const etichetta = new Elemento("div");
    etichetta.textContent = "prezzo_promo_kgl";
    const casella = campo("input", {
        larghezza: 387, altezza: 31, valore: "32.79",
        attributi: { type: "text", "class": "fieldCambioStrutturale singular-inputTextfield", "data-sempre-nativo": "" },
        stile: { width: "90%", color: "black", backgroundColor: "white" }
    });
    const contenitore = casella.parentNode;
    documento.body.insertBefore(etichetta, contenitore);
    //Accanto, una casella qualunque va a riposo come sempre.
    const altra = campo("input", { attributi: { type: "text" }, valore: "altro" });

    CampiARiposo.giro();
    CampiARiposo.giro();

    assert.strictEqual(casella.__riposo, undefined);
    assert.strictEqual(casella.hasAttribute("data-a-riposo"), false);
    assert.strictEqual(casella.style.position, undefined);
    assert.strictEqual(casella.style.visibility, undefined);
    assert.deepStrictEqual(contenitore.childNodes, [casella]);
    assert.strictEqual(document.querySelectorAll(".campoARiposo").length, 1);
    assert.ok(riquadroDi(altra) != null);

    //Il mouse che ci passa sopra non cambia niente: non c'e' riquadro da scambiare.
    assert.strictEqual(CampiARiposo.mostra(casella), false);
    assert.strictEqual(casella.style.position, undefined);
});

/* ---- I20-1139: gli spazi del testo come nel campo nativo ---- */

//La descrizione " OSELLA" (valore letto in console con l'operatore il 26/10/2026) a riposo stava 3px
//piu' a sinistra che nel campo vero: il riquadro, con white-space normal, perdeva lo spazio iniziale.
//Il campo nativo mostra tutti gli spazi; il riquadro li tiene con pre-wrap (caselle) e pre (una riga).

test("una descrizione che comincia con uno spazio lo tiene anche a riposo", () => {
    nuovoDocumento();
    const osella = campo("textarea", { valore: " OSELLA", stile: { width: "200px", height: "50px", backgroundColor: "white", color: "black" } });
    CampiARiposo.giro();

    const interno = internoDi(riquadroDi(osella));
    assert.strictEqual(interno.style.whiteSpace, "pre-wrap", "tiene gli spazi e va a capo come la casella");
    assert.strictEqual(testoDi(riquadroDi(osella)), " OSELLA");
    //Il margine misurato in I20-1123 non cambia: lo spostamento era lo spazio, non il margine.
    assert.strictEqual(interno.style.padding, "0px 5px");
});

test("spazi ripetuti e a capo restano quelli del campo", () => {
    nuovoDocumento();
    const grammatura = campo("textarea", { valore: "\n90 g" });
    const doppi = campo("textarea", { valore: "prodotto  italiano \nCategoria I" });
    CampiARiposo.giro();

    assert.strictEqual(testoDi(riquadroDi(grammatura)), "\n90 g");
    assert.strictEqual(testoDi(riquadroDi(doppi)), "prodotto  italiano \nCategoria I");
    assert.strictEqual(internoDi(riquadroDi(doppi)).style.whiteSpace, "pre-wrap");
});

test("un campo di una riga tiene lo spazio iniziale e non va a capo", () => {
    nuovoDocumento();
    const riga = campo("input", { larghezza: 120, altezza: 22, attributi: { type: "text" }, valore: "  12" });
    CampiARiposo.giro();

    assert.strictEqual(internoDi(riquadroDi(riga)).style.whiteSpace, "pre");
    assert.strictEqual(testoDi(riquadroDi(riga)), "  12");
});

test("un valore scritto da codice con lo spazio, e quello scritto dall'operatore, si vedono con lo spazio", () => {
    nuovoDocumento();
    const casella = campo("textarea", { valore: "OSELLA" });
    CampiARiposo.giro();
    const riquadro = riquadroDi(casella);
    assert.strictEqual(testoDi(riquadro), "OSELLA");

    casella.value = " OSELLA";
    CampiARiposo.giro();
    assert.strictEqual(testoDi(riquadro), " OSELLA");
    assert.strictEqual(internoDi(riquadro).style.whiteSpace, "pre-wrap");

    //L'operatore ci passa sopra, scrive due spazi in fondo ed esce: il riquadro torna con quelli.
    CampiARiposo.mostra(casella);
    casella.value = " OSELLA  ";
    CampiARiposo.aRiposo(casella);
    assert.strictEqual(testoDi(riquadro), " OSELLA  ");
    assert.strictEqual(internoDi(riquadro).style.whiteSpace, "pre-wrap");
});

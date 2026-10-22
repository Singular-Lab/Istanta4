#!/usr/bin/env python3
"""Spazi colore dichiarati e usati da un PDF (o da un .ai PDF-compatible).

Uso: pdf_colorspace.py <file> <pagine_max> <oggetti_max>

Stampa su stdout un JSON con:
  spazi        famiglie di spazio colore trovate (DeviceCMYK, ICCBased, ...)
  processo     componenti di processo osservate: "cmyk", "rgb", "gray", "lab"
  tinte        nomi delle tinte piatte (Separation / DeviceN)
  outputIntent output intent del documento, se presenti
  pagine       pagine del documento, pagineAnalizzate, troncato

Il file viene solo letto. Lo script non usa la rete e non scrive file.
Esce con 3 se il PDF richiede una password, con 2 se non si puo' aprire.
"""
import json
import sys

import pikepdf
from pikepdf import Array, Dictionary, Name, Stream

DEVICE = {
    "/DeviceRGB": "rgb", "/RGB": "rgb", "/CalRGB": "rgb",
    "/DeviceCMYK": "cmyk", "/CMYK": "cmyk",
    "/DeviceGray": "gray", "/G": "gray", "/CalGray": "gray",
    "/Lab": "lab",
}
ICC_COMPONENTI = {1: "gray", 3: "rgb", 4: "cmyk"}
OPERATORI_COLORE = {"rg": "/DeviceRGB", "RG": "/DeviceRGB", "k": "/DeviceCMYK",
                    "K": "/DeviceCMYK", "g": "/DeviceGray", "G": "/DeviceGray"}


class Limite(Exception):
    pass


class Analisi:
    def __init__(self, oggetti_max):
        self.spazi = set()
        self.processo = set()
        self.tinte = set()
        self.visitati = set()
        self.oggetti_max = oggetti_max
        self.oggetti = 0

    def conta(self):
        self.oggetti += 1
        if self.oggetti > self.oggetti_max:
            raise Limite()

    def gia_visto(self, obj):
        """True se l'oggetto indiretto e' gia' stato analizzato (evita cicli)."""
        try:
            if not obj.is_indirect:
                return False
            chiave = obj.objgen
        except Exception:
            return False
        if chiave in self.visitati:
            return True
        self.visitati.add(chiave)
        return False

    def famiglia(self, nome):
        nome = str(nome)
        self.spazi.add(nome.lstrip("/"))
        if nome in DEVICE:
            self.processo.add(DEVICE[nome])

    def spazio(self, cs, risorse):
        """Registra uno spazio colore: nome, nome di risorsa o array."""
        self.conta()
        if cs is None:
            return
        if isinstance(cs, Name):
            nome = str(cs)
            if nome in DEVICE or nome == "/Pattern":
                self.famiglia(nome)
                return
            # nome di una risorsa /ColorSpace della pagina o del form
            dizionario = risorse.get("/ColorSpace") if risorse is not None else None
            if dizionario is not None and nome in dizionario:
                self.spazio(dizionario[nome], risorse)
            return
        if not isinstance(cs, Array) or len(cs) == 0:
            return
        if self.gia_visto(cs):
            return
        tipo = str(cs[0])
        self.spazi.add(tipo.lstrip("/"))
        if tipo == "/ICCBased" and len(cs) > 1:
            profilo = cs[1]
            componenti = int(profilo.get("/N", 0)) if isinstance(profilo, Stream) else 0
            if componenti in ICC_COMPONENTI:
                self.processo.add(ICC_COMPONENTI[componenti])
        elif tipo in ("/CalRGB", "/CalGray", "/Lab"):
            self.processo.add(DEVICE[tipo])
        elif tipo == "/Indexed" and len(cs) > 1:
            self.spazio(cs[1], risorse)
        elif tipo == "/Pattern" and len(cs) > 1:
            self.spazio(cs[1], risorse)
        elif tipo == "/Separation" and len(cs) > 1:
            self.tinta(cs[1])
        elif tipo == "/DeviceN" and len(cs) > 1:
            for nome in cs[1]:
                self.tinta(nome)
            if len(cs) > 4 and isinstance(cs[4], Dictionary):
                attributi = cs[4]
                colorants = attributi.get("/Colorants")
                if isinstance(colorants, Dictionary):
                    for chiave in colorants.keys():
                        self.spazio(colorants[chiave], risorse)
                process = attributi.get("/Process")
                if isinstance(process, Dictionary):
                    self.spazio(process.get("/ColorSpace"), risorse)

    def tinta(self, nome):
        nome = str(nome).lstrip("/")
        if nome in ("Cyan", "Magenta", "Yellow", "Black"):
            # componenti di processo dichiarate come DeviceN
            self.processo.add("cmyk")
        elif nome not in ("All", "None"):
            self.tinte.add(nome)

    def risorse(self, risorse):
        """Spazi colore di risorse, immagini, form, shading e pattern."""
        if not isinstance(risorse, Dictionary) or self.gia_visto(risorse):
            return
        self.conta()
        spazi = risorse.get("/ColorSpace")
        if isinstance(spazi, Dictionary):
            for chiave in spazi.keys():
                self.spazio(spazi[chiave], risorse)
        shading = risorse.get("/Shading")
        if isinstance(shading, Dictionary):
            for chiave in shading.keys():
                self.shading(shading[chiave], risorse)
        pattern = risorse.get("/Pattern")
        if isinstance(pattern, Dictionary):
            for chiave in pattern.keys():
                self.pattern(pattern[chiave])
        xobject = risorse.get("/XObject")
        if isinstance(xobject, Dictionary):
            for chiave in xobject.keys():
                self.xobject(xobject[chiave])

    def shading(self, shading, risorse):
        if isinstance(shading, (Dictionary, Stream)) and not self.gia_visto(shading):
            self.spazio(shading.get("/ColorSpace"), risorse)

    def pattern(self, pattern):
        if not isinstance(pattern, (Dictionary, Stream)) or self.gia_visto(pattern):
            return
        if int(pattern.get("/PatternType", 0)) == 1 and isinstance(pattern, Stream):
            self.contenuto(pattern, pattern.get("/Resources"))
        else:
            self.shading(pattern.get("/Shading"), None)

    def xobject(self, xobject):
        if not isinstance(xobject, Stream) or self.gia_visto(xobject):
            return
        sottotipo = str(xobject.get("/Subtype", ""))
        if sottotipo == "/Image":
            # le maschere (ImageMask, SMask) non portano colore del documento
            if not bool(xobject.get("/ImageMask", False)):
                self.spazio(xobject.get("/ColorSpace"), None)
        elif sottotipo == "/Form":
            self.contenuto(xobject, xobject.get("/Resources"))

    def contenuto(self, contenitore, risorse):
        """Operatori di colore del content stream (decompresso da pikepdf)."""
        self.risorse(risorse)
        for operandi, operatore in pikepdf.parse_content_stream(contenitore):
            op = str(operatore)
            self.conta()
            if op in OPERATORI_COLORE:
                self.famiglia(OPERATORI_COLORE[op])
            elif op in ("cs", "CS") and operandi:
                self.spazio(operandi[0], risorse)
            elif op == "INLINE IMAGE" and operandi:
                try:
                    cs = operandi[0].obj.get("/CS", operandi[0].obj.get("/ColorSpace"))
                    self.spazio(cs, risorse)
                except Exception:
                    pass


def risorse_pagina(pagina):
    """Risorse della pagina, anche quando sono ereditate dal nodo /Pages."""
    nodo = pagina
    for _ in range(64):
        if nodo is None:
            return None
        risorse = nodo.get("/Resources")
        if risorse is not None:
            return risorse
        nodo = nodo.get("/Parent")
    return None


def output_intent(pdf):
    risultato = []
    for intento in pdf.Root.get("/OutputIntents", []) or []:
        profilo = intento.get("/DestOutputProfile")
        componenti = int(profilo.get("/N", 0)) if isinstance(profilo, Stream) else None
        risultato.append({
            "sottotipo": str(intento.get("/S", "")).lstrip("/") or None,
            "condizione": str(intento.get("/OutputConditionIdentifier", "")) or None,
            "processo": ICC_COMPONENTI.get(componenti) if componenti else None,
        })
    return risultato


def main():
    if len(sys.argv) != 4:
        print("uso: pdf_colorspace.py <file> <pagine_max> <oggetti_max>", file=sys.stderr)
        return 64
    percorso, pagine_max, oggetti_max = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    try:
        pdf = pikepdf.open(percorso)
    except pikepdf.PasswordError:
        print("pdf protetto da password", file=sys.stderr)
        return 3
    except Exception as errore:
        print(f"pdf non leggibile: {errore}", file=sys.stderr)
        return 2
    with pdf:
        analisi = Analisi(oggetti_max)
        totale = len(pdf.pages)
        analizzate = 0
        troncato = totale > pagine_max
        try:
            for pagina in pdf.pages[:pagine_max]:
                analisi.contenuto(pagina, risorse_pagina(pagina.obj))
                analizzate += 1
        except Limite:
            troncato = True
        print(json.dumps({
            "spazi": sorted(analisi.spazi),
            "processo": sorted(analisi.processo),
            "tinte": sorted(analisi.tinte),
            "outputIntent": output_intent(pdf),
            "pagine": totale,
            "pagineAnalizzate": analizzate,
            "troncato": troncato,
        }))
    return 0


if __name__ == "__main__":
    sys.exit(main())

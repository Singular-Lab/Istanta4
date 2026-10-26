#!/bin/sh
# Rigenera le fixture .ai dei test di Olimpo (src/illustrator/*.spec.ts).
# Richiede Ghostscript e Python 3. Tutti i contenuti sono sintetici:
# nessun file cliente.
set -eu
cd "$(dirname "$0")"
pdf() {
  gs -q -dSAFER -dBATCH -dNOPAUSE -sDEVICE=pdfwrite -dCompatibilityLevel=1.6 \
    -sColorConversionStrategy=LeaveColorUnchanged "$@"
}
pdf -sOutputFile=vettoriale-cmyk.ai sorgenti/vettoriale-cmyk.ps
pdf -sOutputFile=raster-rgb.ai sorgenti/raster-rgb.ps
pdf -sOutputFile=multipagina.ai sorgenti/multipagina.ps
pdf -sOutputFile=senza-contenuto-pdf.ai sorgenti/senza-contenuto-pdf.ps
pdf -sOwnerPassword=proprietario -sUserPassword=utente -sOutputFile=cifrato.ai sorgenti/vettoriale-cmyk.ps
# PDF troncato a meta': intestazione %PDF valida, nessun %%EOF finale.
python3 -I -c "import sys; d=open(sys.argv[1],'rb').read(); open(sys.argv[2],'wb').write(d[:len(d)//2])" vettoriale-cmyk.ai troncato.ai
# Dati binari senza intestazione PDF o PostScript (Illustrator nativo non interpretabile).
python3 -I -c "import sys; open(sys.argv[1],'wb').write(b'\x00AIPrivateData\x00' + bytes((i * 37) % 251 for i in range(2048)))" proprietario.ai
# Archivio zip reale con estensione .ai.
python3 -I -c "import sys, zipfile; z=zipfile.ZipFile(sys.argv[1],'w'); z.writestr('leggimi.txt','non sono un file Illustrator'); z.close()" incoerente.ai

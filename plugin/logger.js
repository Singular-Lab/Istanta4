/// I20-1002: log su file nella cartella di lavorazione, uno al giorno per tipo.
/// Il percorso e' la cartella dei log, cartellaDeiLog (indexNew.js): questo modulo da solo non
/// gira. I20-1065: e' logs sotto la cartella del documento; finche' non e' pronta non si scrive.
/// Riscrive tutto il file a ogni riga: va bene finche' i log restano corti.

const fs = require('fs');

const Logger=
{
    /// Antepone l'orario ISO e passa ad append. Non dice se ha scritto.
    log: (message, type) => {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;

        //fs.writeFileSync(filePath, logMessage);
        Logger.append(logMessage, type);
        //fs.appendFileSync(filePath, logMessage);
        //console.log(logMessage.trim());
    },
    /// Scrive la riga nel log del giorno, rileggendo e riscrivendo tutto il file.
    /// Torna false su qualunque errore, compreso il percorso inesistente: nessuno oggi lo guarda.
    append: (message, type) => {
        try {
            let date = new Date();
            let prefixDate =  "log_" + date.getDate() + "-" + (date.getMonth() + 1) + "-" + date.getFullYear();

            const cartellaLog = cartellaDeiLog();
            if (cartellaLog === "") {
                return false;
            }
            let filePath = cartellaLog + "["+ type +"]-" + prefixDate +'.log';

            let existingContent="";
            try {
                existingContent = fs.readFileSync(filePath, 'utf8');
            }
            catch {
                //console.log("File non trovato, verrà creato");
            }

            existingContent += "\n"+message;
            


            // Scrivi l'array aggiornato nel file
            fs.writeFileSync(filePath, existingContent);

            return true;
        }
        catch (ex) {
            console.log(ex);
            return false;
        }
    }
}

module.exports.Logger = Logger;
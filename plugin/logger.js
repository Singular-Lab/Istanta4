const fs = require('fs');

const Logger=
{
    log: (message, type) => {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;

        //fs.writeFileSync(filePath, logMessage);
        Logger.append(logMessage, type);
        //fs.appendFileSync(filePath, logMessage);
        //console.log(logMessage.trim());
    },
    append: (message, type) => {
        try {
            let date = new Date();
            let prefixDate =  "log_" + date.getDate() + "-" + (date.getMonth() + 1) + "-" + date.getFullYear();

            let filePath=/*pathLavorazione +*/ percorsoLogs + "["+ type +"]-" + prefixDate +'.log';

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
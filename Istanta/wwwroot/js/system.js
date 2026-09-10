function getWebAppRootFolder() {
    var rootFolder = "";
    switch (document.location.hostname) {
        case '192.168.1.193':
        case 'navcovesviluppo':
            var rootFolder = 'istanta3/'; break;
        case '192.168.1.248':
        case '192.168.1.63':
        case '100.96.1.5':
        case 'produzione':
            var rootFolder = 'istanta2/'; break;
        default:  // set whatever you want
    }

    return rootFolder;
}

function getWebAppRootUrl() {

    return "";
}

function uuidv4() {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
        (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
    );
}

let webRootFolder = getWebAppRootFolder();
if (webRootFolder != "")
    webRootFolder = "/" + webRootFolder;

const socketEndPoint = (location.protocol === "https:" ? "wss://" : "ws://")
    + location.host + webRootFolder + "/ws";

//let exPathCustom = $("#ExteranlSourceCustom").val();
//console.log("exPathCustom -> " + exPathCustom);
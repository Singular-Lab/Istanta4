import { FastifyReply } from 'fastify';



class ServerUtils {
    static getServerTime() {
        return new Date().getTime();
    }

    static getServerDate() {
        return new Date();
    }

    static getServerDateFormatted() {
        return new Date().toLocaleDateString();
    }
    // deve ritorna Observable<SSEMessage> per poter essere usato in un controller
    static sendSSE(event: string, data: any, res: FastifyReply) {
        res.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }


}

export { ServerUtils }; // esporta il modello FotoReferenze per poterlo usare in altri file

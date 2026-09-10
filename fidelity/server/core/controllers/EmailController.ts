import { Request, Response } from 'express';
import 'express-session';
import { log } from '../logger';
import nodemailer from 'nodemailer';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { decryptString, encryptString } from '../../../lib/encryption';
import { BaseController } from '../base/BaseController';
import config from '../config';
import type { UtenteResponseDTO } from '../dto';
import { RecuperoPasswordEmail } from '../email-templates/RecuperoPasswordEmail';
import type { IUserService } from '../interfaces/IUserService';

export class EmailController extends BaseController {
    private transporter: nodemailer.Transporter;

    constructor(
        private userService: IUserService
    ) {
        super('/api/email');

        // Configura il transporter SMTP
        this.transporter = nodemailer.createTransport({
            host: config.SMTP_HOST,
            port: config.SMTP_PORT,
            secure: config.SMTP_PORT === 465,
            auth: {
                user: config.SMTP_USER,
                pass: config.SMTP_PASSWORD
            }
        });
    }

    protected setupRoutes(): void {
        this.router.post("/recupero-password", this.recuperoPassword.bind(this));
        this.router.get("/validate-reset-token", this.validateResetToken.bind(this));
        this.router.post("/reset-password", this.resetPassword.bind(this));
    }


    /**
     * Renderizza un componente React in HTML statico per email
     */
    private renderEmailTemplate(component: React.ReactElement): string {
        const html = renderToStaticMarkup(component);
        return `<!DOCTYPE html>${html}`;
    }

    private generateContextJson(user: UtenteResponseDTO): string {
        const encryptedString = encryptString(JSON.stringify({
            email: user.email,
            timestamp: new Date().toISOString()
        }), config.FICO_SECRET);
        // Sostituisci + con -pl- per evitare che diventi spazio nell'URL
        return encryptedString.replace(/\+/g, "-pl-");
    }

    private async recuperoPassword(req: Request, res: Response): Promise<void> {
        try {
            const { email } = req.body as { email: string };

            // Messaggio generico per sicurezza (non rivela se l'email esiste)
            const genericMessage = "Se l'email è registrata nel sistema, riceverai a breve le istruzioni per reimpostare la password.";

            // Verifica se l'utente esiste
            const user = await this.userService.getUserByEmail(email);

            if (!user) {
                // Non rivelare che l'email non esiste
                res.status(200).json({ message: genericMessage });
                return;
            }

            // Genera token di reset
            const resetToken = this.generateContextJson(user);


            // Costruisci il link di reset
            const resetLink = `${config.CLIENT_URL}/reset-password?ctx=${resetToken}`;

            // Renderizza il template email con React
            const emailHtml = this.renderEmailTemplate(
                React.createElement(RecuperoPasswordEmail, {
                    userName: user.nome_completo || user.email,
                    resetLink: resetLink,
                    expiresIn: '24 ore'
                })
            );

            // Invia l'email
            const fromAddress = config.SMTP_FROM || config.SMTP_USER;
            await this.transporter.sendMail({
                from: `"Istanta 2 GDO Suite" <${fromAddress}>`,
                to: email,
                subject: 'Recupero Password - Istanta 2 GDO Suite',
                html: emailHtml
            });

            res.status(200).json({ message: genericMessage });

        } catch (error: any) {
            log.error('Errore invio email recupero password', error);
            // Non rivelare errori interni all'utente
            res.status(200).json({
                message: "Se l'email è registrata nel sistema, riceverai a breve le istruzioni per reimpostare la password."
            });
        }
    }

    /**
     * Decodifica e valida il context token
     */
    private decodeContext(ctx: string): { email: string; timestamp: string } | null {
        try {
            // Riconverti -pl- in + (che era stato sostituito per evitare problemi URL)
            const restoredCtx = ctx.replace(/-pl-/g, "+");
            const decrypted = decryptString(restoredCtx, config.FICO_SECRET);
            return JSON.parse(decrypted);
        } catch (error) {
            log.warn('Errore nella decodifica del context token', { error });
            return null;
        }
    }

    /**
     * Verifica se il token è scaduto (24 ore)
     */
    private isTokenExpired(timestamp: string): boolean {
        const tokenDate = new Date(timestamp);
        const now = new Date();
        const hoursDiff = (now.getTime() - tokenDate.getTime()) / (1000 * 60 * 60);
        return hoursDiff > 24;
    }

    /**
     * Valida il reset token e restituisce i dati utente
     */
    private async validateResetToken(req: Request, res: Response): Promise<void> {
        try {
            const { ctx } = req.query as { ctx: string };

            if (!ctx) {
                res.status(400).json({ error: 'Token mancante' });
                return;
            }

            const contextData = this.decodeContext(ctx);

            if (!contextData) {
                res.status(400).json({ error: 'Token non valido' });
                return;
            }

            if (this.isTokenExpired(contextData.timestamp)) {
                res.status(400).json({ error: 'Token scaduto' });
                return;
            }

            const user = await this.userService.getUserByEmail(contextData.email);

            if (!user) {
                res.status(404).json({ error: 'Utente non trovato' });
                return;
            }

            res.status(200).json({
                valid: true,
                user: {
                    nome: user.nome,
                    cognome: user.cognome,
                    nome_completo: user.nome_completo,
                    email: user.email
                }
            });

        } catch (error: any) {
            log.error('Errore nella validazione del reset token', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    /**
     * Resetta la password dell'utente
     */
    private async resetPassword(req: Request, res: Response): Promise<void> {
        try {
            const { ctx, password } = req.body as { ctx: string; password: string };

            if (!ctx || !password) {
                res.status(400).json({ error: 'Parametri mancanti' });
                return;
            }

            if (password.length < 6) {
                res.status(400).json({ error: 'La password deve contenere almeno 6 caratteri' });
                return;
            }

            const contextData = this.decodeContext(ctx);

            if (!contextData) {
                res.status(400).json({ error: 'Token non valido' });
                return;
            }

            if (this.isTokenExpired(contextData.timestamp)) {
                res.status(400).json({ error: 'Token scaduto. Richiedi un nuovo link di reset.' });
                return;
            }

            const user = await this.userService.getUserByEmail(contextData.email);

            if (!user) {
                res.status(404).json({ error: 'Utente non trovato' });
                return;
            }

            // Aggiorna la password
            await this.userService.updatePassword(user.id, password);

            res.status(200).json({ message: 'Password aggiornata con successo' });

        } catch (error: any) {
            log.error('Errore nel reset della password', error);
            res.status(500).json({ error: 'Errore durante il reset della password' });
        }
    }
}

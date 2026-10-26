import { FICO_ORIGIN, TIPO_UTENTE_FICO_FINALE } from '@enums/enums';
import { mapTipoUtente } from '@lib/mapping';
import { Body, Controller, Get, Headers, HttpException, HttpStatus, Injectable, Post, Put, Req, Res } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OlympusUserPolicyRuolo } from '@server_types/types';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Auth } from 'src/models/auth.model';
import { v4 as uuidv4 } from 'uuid';
import { AuthResponseDto } from './auth-responses.dto';
import { AuthService } from './auth.service';



@Injectable()
@Controller('auth')
export class AuthController {
    constructor(private readonly auth_service: AuthService) { }

    @Put("/public-key-from-private-key")
    async getPublicKeyFromPrivateKey(
        @Body('private_key') private_key: string,
        @Res() res: FastifyReply
    ): Promise<void> {
        try {
            const publicKey = await this.auth_service.getPublicKey(private_key);
            res.send({ publicKey });
        } catch (error: any) {
            let httpError = new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
            console.error(httpError);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(httpError);
        }
    }


    @ApiTags('Authentication')
    @Put("/is-auth-valid")
    @ApiOperation({ summary: 'Verifica se il token di autorizzazione è valido' })
    @ApiHeader({
        name: 'authorization',
        description: 'Bearer token',
        required: true,
    })
    @ApiHeader({
        name: 'FICOFrom',
        description: 'Parametro che censisce da dove è arrivata la chiamata',
        required: false,
    })
    @ApiHeader({
        name: 'FICOto',
        description: 'Parametro che censisce dove è diretta la chiamata',
        required: false,
    })
    @ApiResponse({
        status: 200, description: 'Autenticazione valida.', type: AuthResponseDto, example: {
            esito: true,
            message: 'Token valido',
            statusCode: 200,
        }
    })
    @ApiResponse({
        status: 401, description: 'Unauthorized. Token mancante o non valido.', type: AuthResponseDto, example: {
            esito: false,
            message: 'Token non valido',
            statusCode: 401,
        }
    })
    async getIfAuthIsValidFromPrivateKey(
        @Headers('authorization') authorization: string,
        @Headers('FICOFrom') fico_from: string,
        @Headers("FICOto") fico_to: string,
        @Res() res: FastifyReply
    ): Promise<void> {
        try {
            if (!authorization || !authorization.startsWith('Bearer ')) {
                throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
            }

            const token = authorization.split(' ')[1];
            const result = await this.auth_service.getIfAuthIsValidFromPrivateKey(token);

            if (result === null) {
                res.send({
                    esito: false,
                    message: 'Token non valido',
                    statusCode: HttpStatus.UNAUTHORIZED,
                } as AuthResponseDto);
            } else {
                res.send({
                    esito: true,
                    message: 'Token valido',
                    statusCode: HttpStatus.OK,
                } as AuthResponseDto);
            }
        } catch (error: any) {
            let httpError = new HttpException(error.message, HttpStatus.UNAUTHORIZED);
            console.error(httpError);

            res.status(HttpStatus.UNAUTHORIZED).send({
                esito: false,
                message: error.message,
                statusCode: HttpStatus.UNAUTHORIZED,
            } as AuthResponseDto);
        }
    }




    @Put("/getPassport")
    async getPassport(
        @Headers('fico-secret') secret_key: string,
        @Headers('authorization') authorization: string,
        @Body() body: {
            origin: FICO_ORIGIN,
            username: string, // Cambiato da email a username
            tipoUtente: number | TIPO_UTENTE_FICO_FINALE,
            campi_aggiuntivi: {
                nome: string,
                cognome: string,
                email: string,
                stato: string,
                residenza: string,
                dataDiNascita: string,
                tipo: string
            },
            ruoli?: OlympusUserPolicyRuolo[],
        },
        @Res() res: FastifyReply,
        @Req() req: FastifyRequest
    ): Promise<void> {
        try {
            if (typeof body === 'string') {
                body = JSON.parse(body);
            }
            if (authorization && authorization.startsWith('Bearer ')) {
                const privateKey = authorization.split(' ')[1];
                const authRecord = await this.auth_service.getIfAuthIsValidFromPrivateKey(privateKey) as Auth;
                if (authRecord && authRecord.public_key) {
                    console.log("Autenticazione con chiave privata, record trovato: ", authRecord);
                    if (body?.campi_aggiuntivi) {
                        let tipo_utente_mappato = null;
                        if (body.tipoUtente !== undefined) {
                            if (!isNaN(Number(body.tipoUtente))) {
                                tipo_utente_mappato = mapTipoUtente(body.tipoUtente as number);
                            } else {
                                tipo_utente_mappato = body.tipoUtente;
                            }
                        }
                        const updatedMeta = {
                            campi_essenziali: {
                                nome: body.campi_aggiuntivi.nome,
                                cognome: body.campi_aggiuntivi.cognome,
                                email: body.campi_aggiuntivi.email,
                                stato: body.campi_aggiuntivi.stato,
                                residenza: body.campi_aggiuntivi.residenza,
                                dataDiNascita: body.campi_aggiuntivi.dataDiNascita,
                                tipo: body.campi_aggiuntivi.tipo
                            },
                            ruoli: body.ruoli ?? authRecord.meta_utente?.ruoli ?? []
                        };
                        console.log(`Meta utente aggiornato (senza secret): ${JSON.stringify(updatedMeta)}`);
                        const metaChanged = JSON.stringify(updatedMeta) !== JSON.stringify(authRecord.meta_utente);
                        const tipoChanged = tipo_utente_mappato !== null && tipo_utente_mappato !== authRecord.tipo_utente;
                        const isLocked = authRecord.meta_utente?.lockedEdit ?? false;
                        console.log(`metaChanged (senza secret): ${metaChanged}, tipoChanged: ${tipoChanged}, isLocked: ${isLocked}`);
                        if ((metaChanged || tipoChanged) && !isLocked) {
                            await this.auth_service.updateAuthMeta(
                                authRecord.email,
                                authRecord.origine,
                                updatedMeta as any,
                                tipo_utente_mappato
                            );
                            console.log(`Meta utente aggiornato nel database (senza secret) per email: ${authRecord.email}`);
                        }
                    }
                    console.log(`Autenticazione riuscita per email: ${authRecord.email}, origine: ${authRecord.origine}`);
                    res.send({
                        esito: true,
                        error: '',
                        statusCode: HttpStatus.OK,
                        publicKey: authRecord.public_key,
                        privateKey: null
                    });
                    return;
                } else {
                    res.send({
                        esito: false,
                        error: 'Chiave pubblica non trovata',
                        statusCode: HttpStatus.UNAUTHORIZED,
                        publicKey: null,
                        privateKey: null
                    });
                    return;
                }
            }

            if (secret_key) {
                if (secret_key !== process.env.FICO_SECRET) {
                    res.send({
                        esito: false,
                        error: 'Chiave segreta non valida',
                        statusCode: HttpStatus.UNAUTHORIZED,
                        publicKey: null,
                        privateKey: null
                    });
                } else {
                    if (body.tipoUtente === TIPO_UTENTE_FICO_FINALE.GUEST) {
                        res.send({
                            esito: false,
                            error: 'I guest non possono avere un passaporto',
                            statusCode: HttpStatus.BAD_REQUEST,
                        });
                    }
                    if (!body.username && !body.tipoUtente && !body.origin && !body.campi_aggiuntivi) {
                        res.send({
                            esito: false,
                            error: 'Dati mancanti o non validi',
                            statusCode: HttpStatus.BAD_REQUEST,
                            publicKey: null,
                            privateKey: null
                        });
                        return;
                    } else {
                        if (!body.campi_aggiuntivi.nome || !body.campi_aggiuntivi.cognome) {
                            res.send({
                                esito: false,
                                error: 'Nome e cognome sono campi obbligatori',
                                statusCode: HttpStatus.BAD_REQUEST,
                                publicKey: null,
                                privateKey: null
                            });
                            return;
                        }
                    }
                    let tipo_utente_mappato = null;
                    if (!isNaN(Number(body.tipoUtente))) {
                        tipo_utente_mappato = mapTipoUtente(body.tipoUtente as number);;
                    } else {
                        tipo_utente_mappato = body.tipoUtente;
                    }
                    const authData = {
                        email: body.username,
                        public_key: uuidv4(),
                        private_key: uuidv4(),
                        tipo_utente: tipo_utente_mappato,
                        origine: body.origin,
                        meta_utente: {
                            campi_essenziali: {
                                nome: body.campi_aggiuntivi.nome,
                                cognome: body.campi_aggiuntivi.cognome,
                                email: body.campi_aggiuntivi.email,
                                stato: body.campi_aggiuntivi.stato,
                                residenza: body.campi_aggiuntivi.residenza,
                                dataDiNascita: body.campi_aggiuntivi.dataDiNascita,
                                tipo: body.campi_aggiuntivi.tipo
                            },
                            ruoli: body.ruoli ?? []
                        }

                    } as unknown as Auth;

                    const authRecord = await this.auth_service.createAuthRecord(authData);
                    if (authRecord.newRecord) {
                        res.send({
                            esito: true,
                            error: '',
                            statusCode: HttpStatus.OK,
                            publicKey: authRecord.risultato.public_key,
                            privateKey: authRecord.risultato.private_key,
                            userPolicy: authRecord.risultato.meta_utente ?? null
                        });
                    } else {
                        if (authRecord.risultato.origine !== body.origin && authData.email !== authRecord.risultato.email) {
                            res.send({
                                esito: false,
                                error: 'Origine non valida',
                                statusCode: HttpStatus.BAD_REQUEST,
                                publicKey: null,
                                privateKey: null
                            });
                            return;
                        }
                        const updatedMeta = {
                            campi_essenziali: {
                                nome: body.campi_aggiuntivi.nome,
                                cognome: body.campi_aggiuntivi.cognome,
                                email: body.campi_aggiuntivi.email,
                                stato: body.campi_aggiuntivi.stato,
                                residenza: body.campi_aggiuntivi.residenza,
                                dataDiNascita: body.campi_aggiuntivi.dataDiNascita,
                                tipo: body.campi_aggiuntivi.tipo
                            },
                            ruoli: body.ruoli ?? authRecord.risultato.meta_utente?.ruoli ?? []
                        };
                        const metaChanged = JSON.stringify(updatedMeta) !== JSON.stringify(authRecord.risultato.meta_utente);
                        const tipoChanged = tipo_utente_mappato !== null && tipo_utente_mappato !== authRecord.risultato.tipo_utente;
                        const isLocked = authRecord.risultato.meta_utente?.lockedEdit ?? false;
                        let resultRecord = authRecord.risultato;
                        console.log(`Meta utente aggiornato (secret key): ${JSON.stringify(updatedMeta)}`);
                        console.log(`metaChanged (secret key): ${metaChanged}, tipoChanged: ${tipoChanged}, isLocked: ${isLocked}`);
                        if ((metaChanged || tipoChanged) && !isLocked) {
                            resultRecord = await this.auth_service.updateAuthMeta(
                                authData.email,
                                body.origin,
                                updatedMeta as any,
                                tipo_utente_mappato
                            ) ?? authRecord.risultato;
                        }
                        res.send({
                            esito: true,
                            error: '',
                            statusCode: HttpStatus.OK,
                            publicKey: resultRecord.public_key,
                            privateKey: resultRecord.private_key,
                            userPolicy: resultRecord.meta_utente ?? null
                        });
                    }
                }
            } else {
                throw new HttpException('Chiave segreta non presente', HttpStatus.UNAUTHORIZED);
            }
        } catch (error: any) {
            res.send({
                esito: false,
                error: error.message,
                statusCode: HttpStatus.UNAUTHORIZED,
                publicKey: null,
                privateKey: null
            });
        }
    }

    @Put("/dashboard-login")
    async dashboardLogin(
        @Body('secret') secretFromBody: string,
        @Headers('fico-secret') secretFromHeader: string,
        @Req() req: FastifyRequest,
        @Res() res: FastifyReply
    ): Promise<void> {
        try {
            const providedSecret = secretFromHeader || secretFromBody;
            const clientIp = this.auth_service.getClientIp(req);
            const loginAvailability = this.auth_service.isDashboardLoginAllowed(clientIp);

            res.header('Cache-Control', 'no-store');

            if (!this.auth_service.isPrivateDashboardIpAllowed(req)) {
                throw new HttpException('Accesso dashboard non consentito da questo IP', HttpStatus.FORBIDDEN);
            }

            if (!loginAvailability.allowed) {
                if (loginAvailability.retryAfterSeconds) {
                    res.header('Retry-After', String(loginAvailability.retryAfterSeconds));
                }
                throw new HttpException('Troppi tentativi di accesso. Riprova più tardi.', HttpStatus.TOO_MANY_REQUESTS);
            }

            if (!this.auth_service.getConfiguredDashboardSecret()) {
                throw new HttpException('Secret privata dashboard non configurata', HttpStatus.INTERNAL_SERVER_ERROR);
            }

            if (!providedSecret || !this.auth_service.validateDashboardSecret(providedSecret)) {
                const rateLimitState = this.auth_service.registerDashboardLoginFailure(clientIp);
                if (rateLimitState.retryAfterSeconds) {
                    res.header('Retry-After', String(rateLimitState.retryAfterSeconds));
                }
                throw new HttpException('Credenziali non valide', HttpStatus.UNAUTHORIZED);
            }

            this.auth_service.clearDashboardLoginFailures(clientIp);
            await this.auth_service.revokePrivateSessionFromRequest(req);
            const session = await this.auth_service.createDashboardSession(req);
            this.auth_service.applyPrivateSessionCookies(res, req, session.sessionToken, session.csrfToken);

            res.send({
                esito: true,
                error: '',
                statusCode: HttpStatus.OK,
                expiresAt: session.expiresAt.toISOString(),
                profile: session.profile,
            });
        } catch (error: any) {
            const statusCode = error?.getStatus?.() ?? HttpStatus.UNAUTHORIZED;
            res.status(statusCode).send({
                esito: false,
                error: error.message,
                statusCode,
                expiresAt: null,
                profile: null
            });
        }
    }

    @Post("/dashboard-logout")
    async dashboardLogout(
        @Req() req: FastifyRequest,
        @Res() res: FastifyReply
    ): Promise<void> {
        try {
            const accessContext = await this.auth_service.resolveAccessContext(req);
            if (accessContext?.mode === 'session') {
                await this.auth_service.revokePrivateSessionFromRequest(req);
            }
            this.auth_service.clearPrivateSessionCookies(res, req);
            res.header('Cache-Control', 'no-store');
            res.header('Clear-Site-Data', '"cache", "cookies", "storage"');
            res.send({
                esito: true,
                error: '',
                statusCode: HttpStatus.OK,
            });
        } catch (error: any) {
            this.auth_service.clearPrivateSessionCookies(res, req);
            res.header('Clear-Site-Data', '"cache", "cookies", "storage"');
            res.status(HttpStatus.OK).send({
                esito: true,
                error: '',
                statusCode: HttpStatus.OK,
            });
        }
    }

    @Get("/checkIdentity")
    async checkIdentity(
        @Req() req: FastifyRequest,
        @Res() res: FastifyReply
    ) {
        try {
            res.header('Cache-Control', 'no-store');
            const accessContext = await this.auth_service.resolveAccessContext(req);
            if (!accessContext) {
                res.send({
                    origin: "",
                    username: "",
                    tipoUtente: "",
                    userPolicy: [],
                    autorizzato: false
                });
                return;
            }

            res.send(accessContext.profile);
        } catch (error: any) {
            res.send({
                origin: "",
                username: "",
                tipoUtente: "",
                userPolicy: [],
                autorizzato: false
            });
        }
    }
}

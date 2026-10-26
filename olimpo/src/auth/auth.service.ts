"use strict";
import { TIPO_UTENTE_FICO_FINALE } from '@enums/enums';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as crypto from 'crypto';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Op } from 'sequelize';
import { Auth } from '../models/auth.model';
import { PrivateSession } from '../models/private_session.model';
import { AuthPolicy } from '@server_types/types';

export const PRIVATE_SESSION_COOKIE_NAME = 'olimpo_session';
export const PRIVATE_CSRF_COOKIE_NAME = 'olimpo_csrf';

type AuthAccessProfile = {
    origin: string;
    username: string;
    tipoUtente: string;
    userPolicy: any;
    autorizzato: true;
};

export type AuthAccessContext = {
    mode: 'bearer' | 'session';
    auth?: Auth;
    session?: PrivateSession;
    profile: AuthAccessProfile;
};

type LoginAttemptState = {
    count: number;
    windowStartedAt: number;
    blockedUntil: number;
};

type CookieBuildOptions = {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
    path?: string;
    maxAge?: number;
};

@Injectable()
export class AuthService {
    constructor(
        @InjectModel(Auth)
        private authModel: typeof Auth,
        @InjectModel(PrivateSession)
        private privateSessionModel: typeof PrivateSession,
    ) { }

    private readonly logger = new Logger(AuthService.name);
    private readonly dashboardLoginAttempts = new Map<string, LoginAttemptState>();
    private readonly dashboardSessionSubject = 'olimpo-private-dashboard';
    private readonly defaultSessionTtlHours = 8;
    private readonly defaultSessionIdleMinutes = 30;
    private readonly defaultMaxActiveDashboardSessions = 3;
    private readonly dashboardLoginWindowMs = 15 * 60 * 1000;
    private readonly dashboardLoginMaxAttempts = 5;
    private readonly dashboardLoginBlockMs = 15 * 60 * 1000;
    private readonly privateSessionCleanupIntervalMs = 15 * 60 * 1000;
    private readonly privateSessionTouchIntervalMs = 5 * 60 * 1000;
    private lastPrivateSessionCleanupAt = 0;

    public async getPublicKey(privateKey: string): Promise<string | null> {
        try {
            await this.authModel.sync({ force: false });
            const record = await this.authModel.findOne({
                where: { private_key: privateKey },
            });

            if (!this.isAuthRecordUsable(record)) {
                return null;
            }

            if (typeof record.public_key !== 'string' || !record.public_key) {
                return null;
            }

            return record.public_key;
        } catch (error) {
            this.logger.error(error);
            return null;
        }
    }

    public async createAuthRecord(auth: Auth): Promise<{ risultato: Auth, newRecord: boolean }> {
        try {
            await this.authModel.sync({ force: false });

            if (auth.is_valid === undefined || auth.is_valid === null) {
                auth.is_valid = true;
            }

            const checkIfUserExist = await this.authModel.findOne({
                where: {
                    email: auth.email,
                    origine: auth.origine,
                    tipo_utente: {
                        [Op.ne]: TIPO_UTENTE_FICO_FINALE.GUEST
                    }
                },
            });

            if (checkIfUserExist != null) {
                return { risultato: checkIfUserExist, newRecord: false };
            }

            const result = await this.authModel.create(auth);
            return { risultato: result, newRecord: true };
        } catch (error) {
            this.logger.error(error);
            return null;
        }
    }

    public async updateAuthMeta(
        email: string,
        origine: string,
        metaUtente: AuthPolicy,
        tipoUtente?: string,
    ): Promise<Auth | null> {
        try {
            await this.authModel.sync({ force: false });
            const record = await this.authModel.findOne({
                where: {
                    email,
                    origine,
                    tipo_utente: { [Op.ne]: TIPO_UTENTE_FICO_FINALE.GUEST },
                },
            });

            if (!record) {
                return null;
            }

            record.meta_utente = metaUtente;
            if (tipoUtente) {
                record.tipo_utente = tipoUtente as TIPO_UTENTE_FICO_FINALE;
            }
            await record.save();
            return record;
        } catch (error) {
            this.logger.error(error);
            return null;
        }
    }

    public async getIfAuthIsValidFromPrivateKey(private_key: string): Promise<Auth | Error> {
        try {
            await this.authModel.sync({ force: false });
            const record = await this.authModel.findOne({
                where: { private_key: private_key },
            });

            if (!this.isAuthRecordUsable(record)) {
                return null;
            }

            return record;
        } catch (error) {
            this.logger.error(error);
            return null;
        }
    }

    public async getIfAuthIsValidFromPublicKey(public_key: string): Promise<Auth | Error> {
        try {
            await this.authModel.sync({ force: false });
            const record = await this.authModel.findOne({
                where: { public_key: public_key },
            });

            if (!this.isAuthRecordUsable(record)) {
                return null;
            }

            return record;
        } catch (error) {
            this.logger.error(error);
            return null;
        }
    }

    public getConfiguredDashboardSecret(): string | null {
        const privateDashboardSecret = process.env.PRIVATE_DASHBOARD_SECRET?.trim();
        const fallbackSecret = process.env.FICO_SECRET?.trim();
        return privateDashboardSecret || fallbackSecret || null;
    }

    public getDashboardSessionTtlSeconds(): number {
        return Math.floor(this.getDashboardSessionTtlMs() / 1000);
    }

    public isPublicRoute(requestUrl: string): boolean {
        const normalizedUrl = this.normalizeRequestUrl(requestUrl);

        // React build assets are public (served at /olimpo/assets/, content-hashed, no sensitive data)
        if (normalizedUrl.startsWith('/olimpo/assets/') || normalizedUrl.startsWith('/olimpo/foto')) {
            return true;
        }

        return [
            '/favicon.ico',
            '/olimpo/private',
            '/olimpo/private-forbidden',
            '/olimpo/private-login',
            '/olimpo/auth/dashboard-login',
            '/olimpo/auth/dashboard-logout',
            '/olimpo/auth/checkIdentity',
            '/olimpo/auth/getPassport',
            '/olimpo/auth/is-auth-valid',
            '/olimpo/auth/public-key-from-private-key',
            '/olimpo/materiali/getMaterialePDF',
            '/olimpo/materiali/getMaterialeSVG',
            '/olimpo/materiali/getPagineMaterialePDF',
            '/olimpo/materiali/getThumbnailMaterialePdfs',
            '/olimpo/materiali/getVideoOnDemand',
        ].includes(normalizedUrl);
    }

    public isSessionOnlyRoute(requestUrl: string): boolean {
        const normalizedUrl = this.normalizeRequestUrl(requestUrl);
        return this.isProtectedPrivatePageRoute(normalizedUrl)
            || normalizedUrl.startsWith('/olimpo/impostazioni/');
    }

    public isProtectedPrivatePageRoute(requestUrl: string): boolean {
        const normalizedUrl = this.normalizeRequestUrl(requestUrl);
        return [
            '/olimpo/private-dashboard',
            '/olimpo/private-foto',
            '/olimpo/private-materiali',
            '/olimpo/private-utenti',
        ].includes(normalizedUrl);
    }

    public isLoginPageRoute(requestUrl: string): boolean {
        return this.normalizeRequestUrl(requestUrl) === '/olimpo/private-login';
    }

    public isPrivateDashboardIpAllowed(req: FastifyRequest): boolean {
        const allowedIps = this.getPrivateDashboardAllowedIps();
        if (allowedIps.length === 0) {
            return true;
        }

        const clientIpCandidates = this.getClientIpCandidates(this.getClientIp(req));
        return clientIpCandidates.some((ip) => allowedIps.includes(ip));
    }

    public getClientIp(req: FastifyRequest): string {
        const forwardedFor = req.headers['x-forwarded-for'];
        if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
            return forwardedFor.split(',')[0].trim();
        }

        if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
            return forwardedFor[0].split(',')[0].trim();
        }

        return req.ip || 'unknown';
    }

    public getCookieValue(req: FastifyRequest, cookieName: string): string | null {
        const cookies = this.parseCookies(req.headers.cookie);
        return cookies[cookieName] || null;
    }

    public applyPrivateSessionCookies(reply: FastifyReply, req: FastifyRequest, sessionToken: string, csrfToken: string): void {
        const secureCookies = this.shouldUseSecureCookies(req);
        const maxAge = this.getDashboardSessionTtlSeconds();
        const currentSetCookie = reply.getHeader('Set-Cookie');
        const cookieHeaders = Array.isArray(currentSetCookie)
            ? currentSetCookie.slice()
            : currentSetCookie
                ? [String(currentSetCookie)]
                : [];

        cookieHeaders.push(
            this.buildCookieHeader(PRIVATE_SESSION_COOKIE_NAME, sessionToken, {
                httpOnly: true,
                secure: secureCookies,
                sameSite: 'Strict',
                path: '/',
                maxAge,
            }),
            this.buildCookieHeader(PRIVATE_CSRF_COOKIE_NAME, csrfToken, {
                httpOnly: false,
                secure: secureCookies,
                sameSite: 'Strict',
                path: '/',
                maxAge,
            }),
        );

        reply.header('Set-Cookie', cookieHeaders);
    }

    public clearPrivateSessionCookies(reply: FastifyReply, req: FastifyRequest): void {
        const secureCookies = this.shouldUseSecureCookies(req);
        const currentSetCookie = reply.getHeader('Set-Cookie');
        const cookieHeaders = Array.isArray(currentSetCookie)
            ? currentSetCookie.slice()
            : currentSetCookie
                ? [String(currentSetCookie)]
                : [];

        cookieHeaders.push(
            this.buildCookieHeader(PRIVATE_SESSION_COOKIE_NAME, '', {
                httpOnly: true,
                secure: secureCookies,
                sameSite: 'Strict',
                path: '/',
                maxAge: 0,
            }),
            this.buildCookieHeader(PRIVATE_CSRF_COOKIE_NAME, '', {
                httpOnly: false,
                secure: secureCookies,
                sameSite: 'Strict',
                path: '/',
                maxAge: 0,
            }),
        );

        reply.header('Set-Cookie', cookieHeaders);
    }

    public isDashboardLoginAllowed(clientIp: string): { allowed: boolean; retryAfterSeconds?: number } {
        const now = Date.now();
        const currentState = this.dashboardLoginAttempts.get(clientIp);
        if (!currentState) {
            return { allowed: true };
        }

        if (currentState.blockedUntil > now) {
            return {
                allowed: false,
                retryAfterSeconds: Math.ceil((currentState.blockedUntil - now) / 1000),
            };
        }

        if ((now - currentState.windowStartedAt) > this.dashboardLoginWindowMs) {
            this.dashboardLoginAttempts.delete(clientIp);
            return { allowed: true };
        }

        return { allowed: true };
    }

    public registerDashboardLoginFailure(clientIp: string): { retryAfterSeconds?: number } {
        const now = Date.now();
        const currentState = this.dashboardLoginAttempts.get(clientIp);
        const shouldResetWindow = !currentState || (now - currentState.windowStartedAt) > this.dashboardLoginWindowMs;
        const nextState: LoginAttemptState = shouldResetWindow
            ? {
                count: 1,
                windowStartedAt: now,
                blockedUntil: 0,
            }
            : {
                ...currentState,
                count: currentState.count + 1,
            };

        if (nextState.count >= this.dashboardLoginMaxAttempts) {
            nextState.blockedUntil = now + this.dashboardLoginBlockMs;
            nextState.count = 0;
            nextState.windowStartedAt = now;
            this.dashboardLoginAttempts.set(clientIp, nextState);
            return { retryAfterSeconds: Math.ceil(this.dashboardLoginBlockMs / 1000) };
        }

        this.dashboardLoginAttempts.set(clientIp, nextState);
        return {};
    }

    public clearDashboardLoginFailures(clientIp: string): void {
        this.dashboardLoginAttempts.delete(clientIp);
    }

    public validateDashboardSecret(providedSecret: string): boolean {
        const configuredSecret = this.getConfiguredDashboardSecret();
        if (!configuredSecret || !providedSecret) {
            return false;
        }

        const configuredBuffer = Buffer.from(configuredSecret);
        const providedBuffer = Buffer.from(providedSecret);
        if (configuredBuffer.length !== providedBuffer.length) {
            return false;
        }

        return crypto.timingSafeEqual(configuredBuffer, providedBuffer);
    }

    public async createDashboardSession(req: FastifyRequest): Promise<{
        sessionToken: string;
        csrfToken: string;
        expiresAt: Date;
        profile: AuthAccessProfile;
    }> {
        await this.privateSessionModel.sync({ force: false });
        await this.cleanupPrivateSessionsIfNeeded();

        const sessionToken = this.generateOpaqueToken(48);
        const csrfToken = this.generateOpaqueToken(24);
        const expiresAt = new Date(Date.now() + this.getDashboardSessionTtlMs());
        const profile = this.getDashboardProfile();

        await this.privateSessionModel.create({
            token_hash: this.hashOpaqueToken(sessionToken),
            csrf_token_hash: this.hashOpaqueToken(csrfToken),
            session_subject: this.dashboardSessionSubject,
            ip_address: this.getClientIp(req),
            user_agent: this.getUserAgent(req),
            is_valid: true,
            expires_at: expiresAt,
            last_seen_at: new Date(),
            revoked_at: null,
            meta: {
                profile,
            },
        });

        await this.enforceDashboardSessionLimit();

        return {
            sessionToken,
            csrfToken,
            expiresAt,
            profile,
        };
    }

    public async revokePrivateSessionFromRequest(req: FastifyRequest): Promise<void> {
        const sessionToken = this.getCookieValue(req, PRIVATE_SESSION_COOKIE_NAME);
        if (!sessionToken) {
            return;
        }

        await this.revokePrivateSessionByToken(sessionToken);
    }

    public async resolveAccessContext(req: FastifyRequest): Promise<AuthAccessContext | null> {
        const bearerToken = this.extractBearerToken(req.headers.authorization);
        if (bearerToken) {
            const authRecord = await this.getIfAuthIsValidFromPublicKey(bearerToken) as Auth;
            if (!authRecord) {
                return null;
            }

            return {
                mode: 'bearer',
                auth: authRecord,
                profile: {
                    origin: authRecord.origine,
                    username: authRecord.email,
                    tipoUtente: authRecord.tipo_utente,
                    userPolicy: authRecord.meta_utente ?? [],
                    autorizzato: true,
                },
            };
        }

        const sessionToken = this.getCookieValue(req, PRIVATE_SESSION_COOKIE_NAME);
        if (!sessionToken) {
            return null;
        }

        if (!this.isPrivateDashboardIpAllowed(req)) {
            return null;
        }

        const session = await this.getValidPrivateSession(sessionToken, req);
        if (!session) {
            return null;
        }

        if (!this.isSafeMethod(req.method)) {
            const csrfHeader = this.getHeaderValue(req.headers['x-olimpo-csrf']);
            if (!csrfHeader || !this.doesOpaqueTokenMatchHash(csrfHeader, session.csrf_token_hash)) {
                return null;
            }
        }

        return {
            mode: 'session',
            session,
            profile: (session.meta?.profile || this.getDashboardProfile()) as AuthAccessProfile,
        };
    }

    private normalizeRequestUrl(requestUrl: string): string {
        return (requestUrl || '').split('?')[0];
    }

    private getDashboardProfile(): AuthAccessProfile {
        return {
            origin: 'OL',
            username: 'dashboard@olimpo.local',
            tipoUtente: TIPO_UTENTE_FICO_FINALE.SUPERADMIN,
            userPolicy: [],
            autorizzato: true,
        };
    }

    private getDashboardSessionTtlMs(): number {
        const rawHours = Number(process.env.PRIVATE_SESSION_TTL_HOURS || this.defaultSessionTtlHours);
        if (Number.isNaN(rawHours) || rawHours <= 0) {
            return this.defaultSessionTtlHours * 60 * 60 * 1000;
        }

        return rawHours * 60 * 60 * 1000;
    }

    private getDashboardSessionIdleTimeoutMs(): number {
        const rawMinutes = Number(process.env.PRIVATE_SESSION_IDLE_MINUTES || this.defaultSessionIdleMinutes);
        if (Number.isNaN(rawMinutes) || rawMinutes <= 0) {
            return this.defaultSessionIdleMinutes * 60 * 1000;
        }

        return rawMinutes * 60 * 1000;
    }

    private getPrivateSessionMaxActive(): number {
        const rawMax = Number(process.env.PRIVATE_SESSION_MAX_ACTIVE || this.defaultMaxActiveDashboardSessions);
        if (Number.isNaN(rawMax) || rawMax < 1) {
            return this.defaultMaxActiveDashboardSessions;
        }

        return Math.floor(rawMax);
    }

    private buildCookieHeader(name: string, value: string, options: CookieBuildOptions): string {
        const segments = [`${name}=${encodeURIComponent(value)}`];
        const path = options.path || '/';
        segments.push(`Path=${path}`);

        if (typeof options.maxAge === 'number') {
            segments.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
        }

        segments.push(`SameSite=${options.sameSite || 'Strict'}`);

        if (options.httpOnly) {
            segments.push('HttpOnly');
        }

        if (options.secure) {
            segments.push('Secure');
        }

        return segments.join('; ');
    }

    private shouldUseSecureCookies(req: FastifyRequest): boolean {
        if ((process.env.FORCE_SECURE_COOKIES || '').toLowerCase() === 'true') {
            return true;
        }

        const forwardedProto = req.headers['x-forwarded-proto'];
        if (typeof forwardedProto === 'string' && forwardedProto.split(',')[0].trim() === 'https') {
            return true;
        }

        return process.env.NODE_ENV === 'production';
    }

    private shouldBindSessionToUserAgent(): boolean {
        return (process.env.PRIVATE_SESSION_BIND_USER_AGENT || 'true').toLowerCase() !== 'false';
    }

    private shouldBindSessionToIp(): boolean {
        return (process.env.PRIVATE_SESSION_BIND_IP || '').toLowerCase() === 'true';
    }

    private shouldUseSlidingSessionExpiry(): boolean {
        return (process.env.PRIVATE_SESSION_SLIDING || 'true').toLowerCase() !== 'false';
    }

    private parseCookies(cookieHeader?: string): Record<string, string> {
        if (!cookieHeader) {
            return {};
        }

        return cookieHeader
            .split(';')
            .map((part) => part.trim())
            .filter(Boolean)
            .reduce((accumulator, currentCookie) => {
                const separatorIndex = currentCookie.indexOf('=');
                if (separatorIndex <= 0) {
                    return accumulator;
                }

                const cookieName = currentCookie.slice(0, separatorIndex).trim();
                const cookieValue = currentCookie.slice(separatorIndex + 1).trim();
                accumulator[cookieName] = decodeURIComponent(cookieValue);
                return accumulator;
            }, {} as Record<string, string>);
    }

    private getUserAgent(req: FastifyRequest): string {
        const userAgent = req.headers['user-agent'];
        if (!userAgent) {
            return '';
        }

        return Array.isArray(userAgent) ? userAgent.join(' | ') : userAgent;
    }

    private extractBearerToken(authorizationHeader?: string): string | null {
        if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
            return null;
        }

        return authorizationHeader.split(' ')[1] || null;
    }

    private async getValidPrivateSession(rawSessionToken: string, req: FastifyRequest): Promise<PrivateSession | null> {
        await this.privateSessionModel.sync({ force: false });
        await this.cleanupPrivateSessionsIfNeeded();

        const session = await this.privateSessionModel.findOne({
            where: {
                token_hash: this.hashOpaqueToken(rawSessionToken),
                is_valid: true,
            },
        });

        if (!session) {
            return null;
        }

        if (session.revoked_at) {
            await this.invalidatePrivateSession(session);
            return null;
        }

        const now = Date.now();
        const currentUserAgent = this.getUserAgent(req);
        if (session.expires_at && new Date(session.expires_at).getTime() <= now) {
            await this.invalidatePrivateSession(session, new Date(now));
            return null;
        }

        if (this.shouldBindSessionToUserAgent() && session.user_agent && currentUserAgent && session.user_agent !== currentUserAgent) {
            await this.invalidatePrivateSession(session, new Date(now));
            return null;
        }

        if (this.shouldBindSessionToIp() && session.ip_address) {
            const currentIpCandidates = this.getClientIpCandidates(this.getClientIp(req));
            const sessionIpCandidates = this.getClientIpCandidates(session.ip_address);
            const hasIpMatch = currentIpCandidates.some((ip) => sessionIpCandidates.includes(ip));
            if (!hasIpMatch) {
                await this.invalidatePrivateSession(session, new Date(now));
                return null;
            }
        }

        const lastSeenAt = session.last_seen_at ? new Date(session.last_seen_at).getTime() : now;
        if ((now - lastSeenAt) > this.getDashboardSessionIdleTimeoutMs()) {
            await this.invalidatePrivateSession(session, new Date(now));
            return null;
        }

        if (!session.last_seen_at || (now - lastSeenAt) >= this.privateSessionTouchIntervalMs) {
            session.last_seen_at = new Date(now);
            if (this.shouldUseSlidingSessionExpiry()) {
                session.expires_at = new Date(now + this.getDashboardSessionTtlMs());
            }
            await session.save();
        }

        return session;
    }

    private async revokePrivateSessionByToken(rawSessionToken: string): Promise<void> {
        await this.privateSessionModel.sync({ force: false });

        const session = await this.privateSessionModel.findOne({
            where: {
                token_hash: this.hashOpaqueToken(rawSessionToken),
                is_valid: true,
            },
        });

        if (!session) {
            return;
        }

        await this.invalidatePrivateSession(session);
    }

    private async invalidatePrivateSession(session: PrivateSession, revokedAt: Date = new Date()): Promise<void> {
        if (session.is_valid === false && session.revoked_at) {
            return;
        }

        session.is_valid = false;
        session.revoked_at = session.revoked_at || revokedAt;
        session.last_seen_at = new Date();
        await session.save();
    }

    private async cleanupPrivateSessionsIfNeeded(now: number = Date.now()): Promise<void> {
        if ((now - this.lastPrivateSessionCleanupAt) < this.privateSessionCleanupIntervalMs) {
            return;
        }

        this.lastPrivateSessionCleanupAt = now;
        const revocationDate = new Date(now);

        try {
            await this.privateSessionModel.update(
                {
                    is_valid: false,
                    revoked_at: revocationDate,
                },
                {
                    where: {
                        is_valid: true,
                        [Op.or]: [
                            {
                                expires_at: {
                                    [Op.lte]: revocationDate,
                                },
                            },
                            {
                                revoked_at: {
                                    [Op.ne]: null,
                                },
                            },
                        ],
                    },
                },
            );
        } catch (error) {
            this.logger.error(error);
        }
    }

    private async enforceDashboardSessionLimit(now: number = Date.now()): Promise<void> {
        const maxActiveSessions = this.getPrivateSessionMaxActive();
        if (maxActiveSessions < 1) {
            return;
        }

        const activeSessions = await this.privateSessionModel.findAll({
            where: {
                session_subject: this.dashboardSessionSubject,
                is_valid: true,
                revoked_at: null,
                expires_at: {
                    [Op.gt]: new Date(now),
                },
            },
            order: [['created_at', 'DESC']],
        });

        if (activeSessions.length <= maxActiveSessions) {
            return;
        }

        await Promise.all(
            activeSessions.slice(maxActiveSessions).map((session) => this.invalidatePrivateSession(session, new Date(now))),
        );
    }

    private hashOpaqueToken(value: string): string {
        return crypto.createHash('sha256').update(value).digest('hex');
    }

    private generateOpaqueToken(byteLength: number): string {
        return crypto.randomBytes(byteLength).toString('base64url');
    }

    private doesOpaqueTokenMatchHash(value: string, expectedHash: string): boolean {
        if (!value || !expectedHash) {
            return false;
        }

        const calculatedHash = this.hashOpaqueToken(value);
        const calculatedBuffer = Buffer.from(calculatedHash);
        const expectedBuffer = Buffer.from(expectedHash);
        if (calculatedBuffer.length !== expectedBuffer.length) {
            return false;
        }

        return crypto.timingSafeEqual(calculatedBuffer, expectedBuffer);
    }

    private isSafeMethod(method?: string): boolean {
        return ['GET', 'HEAD', 'OPTIONS'].includes((method || 'GET').toUpperCase());
    }

    private getHeaderValue(headerValue: string | string[] | undefined): string | null {
        if (!headerValue) {
            return null;
        }

        if (Array.isArray(headerValue)) {
            return headerValue[0] || null;
        }

        return headerValue;
    }

    private isAuthRecordUsable(record: Auth | null): boolean {
        if (!record) {
            return false;
        }
        // if (record.is_valid === false) {
        //     return false;
        // }
        // if (record.expires_at && new Date(record.expires_at).getTime() <= Date.now()) {
        //     return false;
        // }
        return true;
    }

    private getPrivateDashboardAllowedIps(): string[] {
        return (process.env.PRIVATE_DASHBOARD_ALLOWED_IPS || '')
            .split(',')
            .map((ip) => this.normalizeIp(ip))
            .filter(Boolean);
    }

    private getClientIpCandidates(rawIp?: string): string[] {
        const normalizedIp = this.normalizeIp(rawIp || '');
        if (!normalizedIp) {
            return [];
        }

        if (normalizedIp === '::1') {
            return ['::1', '127.0.0.1'];
        }

        if (normalizedIp === '127.0.0.1') {
            return ['127.0.0.1', '::1'];
        }

        return [normalizedIp];
    }

    private normalizeIp(rawIp: string): string {
        const normalized = String(rawIp || '').trim().toLowerCase();
        if (!normalized) {
            return '';
        }

        if (normalized.startsWith('::ffff:')) {
            return normalized.slice(7);
        }

        return normalized;
    }
}

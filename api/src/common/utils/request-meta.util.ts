import type { Request } from 'express';

export interface RequestMeta {
    ipAddress?: string;
    userAgent?: string;
}

export function getRequestMeta(req: Request): RequestMeta {
    return {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
    };
}

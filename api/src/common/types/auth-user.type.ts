import type { Role } from '../../generated/prisma/client';

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    role: Role;
}

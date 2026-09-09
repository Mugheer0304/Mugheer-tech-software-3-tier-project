import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'mugheer:roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const PERMISSIONS_KEY = 'mugheer:permissions';
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

export const PUBLIC_KEY = 'mugheer:public';
export const Public = () => SetMetadata(PUBLIC_KEY, true);

export const CurrentUser = () => SetMetadata('mugheer:current-user', true);

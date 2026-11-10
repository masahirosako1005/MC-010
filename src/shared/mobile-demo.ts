export const MOBILE_APP_PATH = '/demo/mobile/app';

const sharedPagePath = /^\/share\/([a-f0-9]{64})\/?$/;
const mobileSharedPagePath = /^\/demo\/mobile\/share\/([a-f0-9]{64})\/?$/;

export function getSharedPageToken(pathname: string): string | undefined {
  return sharedPagePath.exec(pathname)?.[1] ?? mobileSharedPagePath.exec(pathname)?.[1];
}

export function isMobileDemoContentPath(pathname: string): boolean {
  return pathname === MOBILE_APP_PATH || mobileSharedPagePath.test(pathname);
}

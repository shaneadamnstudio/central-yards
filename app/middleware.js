import { NextResponse } from 'next/server';

/**
 * Central Yards gate.
 *
 * Two codes, one cookie. The cookie carries a scope claim so the server knows
 * which team signed in, not merely that somebody did. Internal items are
 * filtered against that scope before they ever reach the page.
 *
 * Codes are compared as salted SHA-256, never in plaintext.
 */

const COOKIE = 'cy_access';
const SECRET = process.env.GATE_SECRET || '';

const PUBLIC = ['/login', '/auth/gate', '/auth/signout'];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const raw = request.cookies.get(COOKIE)?.value || '';
  const [scope, sig] = raw.split(':');

  if (SECRET && sig && sig === SECRET && (scope === 'adam' || scope === 'cy')) {
    const headers = new Headers(request.headers);
    headers.set('x-cy-scope', scope);
    return NextResponse.next({ request: { headers } });
  }

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  if (pathname !== '/') {
    url.searchParams.set('next', pathname + (request.nextUrl.search || ''));
  }
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

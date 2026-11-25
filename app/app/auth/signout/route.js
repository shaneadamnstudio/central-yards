import { NextResponse } from 'next/server';

export async function GET(request) {
  const res = NextResponse.redirect(new URL('/login', request.url), { status: 303 });
  res.cookies.set('cy_access', '', { path: '/', maxAge: 0 });
  return res;
}

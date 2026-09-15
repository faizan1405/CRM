import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession, decrypt } from './lib/auth';

const protectedRoutes = [
  '/dashboard',
  '/leads',
  '/follow-ups',
  '/pipeline',
  '/settings',
  '/analytics',
  '/notifications',
  '/daily-briefing',
  '/whatsapp-templates',
  '/personal-notes',
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  const isAuthRoute = pathname === '/login';

  const sessionCookie = request.cookies.get('session')?.value;
  let isAuthenticated = false;

  if (sessionCookie) {
    try {
      const payload = await decrypt(sessionCookie);
      if (payload) isAuthenticated = true;
    } catch {
      isAuthenticated = false;
    }
  }

  // Redirect authenticated users away from login
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Redirect unauthenticated users away from protected routes
  if (isProtectedRoute && !isAuthenticated) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Update session expiration
  const response = NextResponse.next();
  if (isAuthenticated && sessionCookie) {
    const updatedSession = await updateSession(request);
    if (updatedSession) {
      response.cookies.set({
        name: 'session',
        value: updatedSession,
        httpOnly: true,
        path: '/',
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

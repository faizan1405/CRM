import { jwtVerify, SignJWT, JWTPayload } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const secretKey = process.env.AUTH_SECRET;
const key = new TextEncoder().encode(secretKey);

export async function encrypt(payload: JWTPayload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(key);
}

export async function decrypt(input: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ["HS256"],
  });
  return payload;
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;
  if (!session) return null;
  try {
    return await decrypt(session);
  } catch {
    return null;
  }
}

export async function updateSession(request: NextRequest) {
  const session = request.cookies.get("session")?.value;
  if (!session) return;
  try {
    const parsed = await decrypt(session);
    parsed.exp = new Date(Date.now() + 24 * 60 * 60 * 1000).getTime() / 1000;
    const res = await encrypt(parsed);
    // Note: To actually extend session in Next.js middleware, 
    // the caller sets the cookie on the response.
    return res;
  } catch {
    return null;
  }
}

export class AuthError extends Error {}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const userId = typeof session.id === "string" ? session.id : typeof session.userId === "string" ? session.userId : null;
  if (!userId && (!session.email || typeof session.email !== "string")) return null;

  try {
    const { db } = await import("@/lib/db");
    if (userId) {
      const user = await db.user.findUnique({ where: { id: userId } });
      if (user) return user;
    }
    if (typeof session.email === "string" && session.email) {
      const userByEmail = await db.user.findUnique({ where: { email: session.email } });
      if (userByEmail) return userByEmail;
    }
    return null;
  } catch {
    return null;
  }
}

export async function requireAuthenticatedUser() {
  const session = await getSession();
  if (!session) {
    throw new AuthError("You must be logged in to perform this action.");
  }
  const userId = typeof session.id === "string" ? session.id : typeof session.userId === "string" ? session.userId : null;
  if (!userId && (!session.email || typeof session.email !== "string")) {
    throw new AuthError("You must be logged in to perform this action.");
  }

  const { db } = await import("@/lib/db");
  let user = null;
  if (userId) {
    user = await db.user.findUnique({ where: { id: userId } });
  }
  if (!user && typeof session.email === "string" && session.email) {
    user = await db.user.findUnique({ where: { email: session.email } });
  }

  if (!user) {
    try {
      const cookieStore = await cookies();
      cookieStore.set("session", "", {
        httpOnly: true,
        expires: new Date(0),
        path: "/",
      });
    } catch {
      // safe in non-cookie mutation context
    }
    throw new AuthError("Your session is invalid or user account no longer exists. Please log in again.");
  }

  return user;
}


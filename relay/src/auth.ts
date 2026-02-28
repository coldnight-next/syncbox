import { createRemoteJWKSet, jwtVerify } from 'jose'

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

/**
 * Verify a Clerk JWT and return the userId (sub claim).
 * Uses Clerk's JWKS endpoint for key discovery.
 */
export async function verifyToken(token: string): Promise<string> {
  if (!jwks) {
    const issuer = process.env.CLERK_ISSUER
    if (!issuer) throw new Error('CLERK_ISSUER env var not set')
    jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))
  }

  const { payload } = await jwtVerify(token, jwks, {
    issuer: process.env.CLERK_ISSUER,
  })

  if (!payload.sub) throw new Error('JWT missing sub claim')
  return payload.sub
}

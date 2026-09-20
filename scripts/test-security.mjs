import assert from 'node:assert/strict';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import worker from '../src/cloudflare-entry-v2.js';
import { adminRequestBlocked } from '../src/admin-auth.js';
import { transformAdminHtmlResponse } from '../src/cloudflare-entry.js';

const adminUrl=new URL('https://archive.example/api/admin/health');
const domain='https://archive-test.cloudflareaccess.com',audience='archive-aud';
const {publicKey,privateKey}=await generateKeyPair('RS256');
const publicJwk=await exportJWK(publicKey);publicJwk.kid='archive-test-key';publicJwk.alg='RS256';publicJwk.use='sig';
const jwks=createLocalJWKSet({keys:[publicJwk]});
const validToken=await new SignJWT({email:'admin@example.com'}).setProtectedHeader({alg:'RS256',kid:publicJwk.kid}).setIssuer(domain).setAudience(audience).setIssuedAt().setExpirationTime('5m').sign(privateKey);
const env={TEAM_DOMAIN:domain,POLICY_AUD:audience};

{
  const response=await adminRequestBlocked(new Request(adminUrl),{},adminUrl,{jwks});
  assert.equal(response.status,503);
  assert.equal((await response.json()).error,'CF_ACCESS_AUTH_NOT_CONFIGURED');
}

{
  const response=await adminRequestBlocked(new Request(adminUrl),env,adminUrl,{jwks});
  assert.equal(response.status,401);
  assert.equal((await response.json()).error,'CF_ACCESS_AUTH_REQUIRED');
}

{
  const request=new Request(adminUrl,{headers:{'cf-access-jwt-assertion':validToken}});
  assert.equal(await adminRequestBlocked(request,env,adminUrl,{jwks}),null);
}

{
  const request=new Request(adminUrl,{headers:{origin:'https://attacker.example','cf-access-jwt-assertion':validToken}});
  assert.equal((await adminRequestBlocked(request,env,adminUrl,{jwks})).status,403);
}

{
  const wrongAudience=await new SignJWT({email:'admin@example.com'}).setProtectedHeader({alg:'RS256',kid:publicJwk.kid}).setIssuer(domain).setAudience('wrong-aud').setIssuedAt().setExpirationTime('5m').sign(privateKey);
  const request=new Request(adminUrl,{headers:{'cf-access-jwt-assertion':wrongAudience}});
  const response=await adminRequestBlocked(request,env,adminUrl,{jwks});
  assert.equal(response.status,403);
  assert.equal((await response.json()).error,'CF_ACCESS_AUTH_INVALID');
}

{
  const response=await worker.fetch(new Request('https://archive.example/api/debug/datacat'),{},{});
  assert.equal(response.status,404);
  assert.match(response.headers.get('content-security-policy')||'',/frame-ancestors 'none'/);
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  assert.equal(response.headers.get('x-frame-options'),'DENY');
  assert.equal(response.headers.get('referrer-policy'),'strict-origin-when-cross-origin');
}

{
  const request=new Request('https://archive.example/admin/');
  const source=new Response('<!doctype html><html><head></head><body>ADMIN</body></html>',{headers:{'content-type':'text/html'}});
  const response=await transformAdminHtmlResponse(request,source);
  const html=await response.text();
  assert.doesNotMatch(html,/data-admin-auth-client/);
  assert.match(html,/data-admin-back-script/);
  assert.equal(response.headers.get('cache-control'),'no-store');
}

console.log('ARCHIVE.EXE security behavior OK · fail-closed Cloudflare Access JWT validation + response headers checked');

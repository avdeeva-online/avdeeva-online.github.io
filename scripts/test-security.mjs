import assert from 'node:assert/strict';
import worker from '../src/cloudflare-entry-v2.js';
import { adminRequestBlocked } from '../src/admin-auth.js';
import { transformAdminHtmlResponse } from '../src/cloudflare-entry.js';

const adminUrl=new URL('https://archive.example/api/admin/health');

{
  const response=adminRequestBlocked(new Request(adminUrl),{},adminUrl);
  assert.equal(response.status,503);
  assert.equal((await response.json()).error,'ADMIN_AUTH_NOT_CONFIGURED');
}

{
  const response=adminRequestBlocked(new Request(adminUrl),{ADMIN_ACCESS_TOKEN:'secret'},adminUrl);
  assert.equal(response.status,401);
  assert.equal((await response.json()).error,'ADMIN_AUTH_REQUIRED');
}

{
  const request=new Request(adminUrl,{headers:{'x-archive-admin-token':'secret'}});
  assert.equal(adminRequestBlocked(request,{ADMIN_ACCESS_TOKEN:'secret'},adminUrl),null);
}

{
  const request=new Request(adminUrl,{headers:{origin:'https://attacker.example','x-archive-admin-token':'secret'}});
  assert.equal(adminRequestBlocked(request,{ADMIN_ACCESS_TOKEN:'secret'},adminUrl).status,403);
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
  assert.match(html,/data-admin-auth-client/);
  assert.match(html,/data-admin-back-script/);
  assert.equal(response.headers.get('cache-control'),'no-store');
}

console.log('ARCHIVE.EXE security behavior OK · fail-closed admin auth + response headers + admin client injection checked');

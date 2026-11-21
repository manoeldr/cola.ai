const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ctx = {Uint8Array, TextDecoder}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + '/pdf-download.js', 'utf8'), ctx);
(async () => {
 const bytes = await ctx.readFullPdf(new Response('%PDF-1.7\nexample'));
 assert.equal(bytes.length, 16);
 await assert.rejects(ctx.readFullPdf(new Response('<html>login</html>')), /assinatura PDF/);
 await assert.rejects(ctx.readFullPdf(new Response('%PDF-1.7\nexample'), 5), /limite/);
 await assert.rejects(ctx.readFullPdf(new Response('Denied', {status:403})), /403/);
 console.log('4 testes de recebimento passaram.');
})().catch(e => { console.error(e); process.exitCode=1; });

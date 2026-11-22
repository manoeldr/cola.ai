import forge from 'node-forge/dist/forge.min.js';
export type EncryptionInfo={publicKey:string;fingerprint:string;configured:boolean;model:string};
export function fingerprint(value:string):string{const clean=value.replace(/\s/g,'').toLowerCase();if(!/^[a-f0-9]{64}$/.test(clean))throw Error('Copie o identificador de segurança exibido em /mobile-setup no Mac.');return clean;}
export function keyEnvelope(key:string,info:EncryptionInfo,expected:string,seed:Uint8Array){
 const normalized=key.trim();if(!/^[A-Za-z0-9_.-]{20,160}$/.test(normalized))throw Error('Cole somente a chave Gemini, sem aspas ou comandos.');
 if(seed.length!==32)throw Error('Não foi possível preparar o envio seguro.');
 if(info.publicKey.length>2000)throw Error('Identidade do Mac inválida.');
 const der=forge.util.decode64(info.publicKey),digest=forge.md.sha256.create();digest.update(der);
 const pin=fingerprint(expected);
 if(digest.digest().toHex()!==pin||info.fingerprint!==pin)throw Error('O identificador não corresponde a este Mac. Confira a página /mobile-setup antes de enviar a chave.');
 const publicKey=forge.pki.publicKeyFromAsn1(forge.asn1.fromDer(der));
 const options={md:forge.md.sha256.create(),mgf1:{md:forge.md.sha256.create()},seed:Array.from(seed,b=>String.fromCharCode(b)).join('')};
 return {encryptedKey:forge.util.encode64(publicKey.encrypt(normalized,'RSA-OAEP',options)),freeTierProjectConfirmed:true};
}

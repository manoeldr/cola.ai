using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
namespace ColaAI.Web.Services;
public sealed record RuntimeGeminiKey(string ApiKey,bool FreeTierProjectConfirmed);
public sealed record GeminiKeyEnvelope(string EncryptedKey,bool FreeTierProjectConfirmed);
public sealed class GeminiKeyStore:IDisposable
{
    private readonly RSA rsa;
    private readonly object gate=new();
    private RuntimeGeminiKey? current;
    public string PublicKey {get;}
    public string Fingerprint {get;}
    public RuntimeGeminiKey? Current=>Volatile.Read(ref current);
    public GeminiKeyStore(string? privateKeyPath=null)
    {
        rsa=RSA.Create(2048);
        if(privateKeyPath is not null)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(privateKeyPath))!);
            if(File.Exists(privateKeyPath))rsa.ImportFromPem(File.ReadAllText(privateKeyPath));
            else
            {
                using var file=new FileStream(privateKeyPath,FileMode.CreateNew,FileAccess.Write,FileShare.None);
                if(!OperatingSystem.IsWindows())File.SetUnixFileMode(privateKeyPath,UnixFileMode.UserRead|UnixFileMode.UserWrite);
                file.Write(Encoding.UTF8.GetBytes(rsa.ExportPkcs8PrivateKeyPem()));
            }
        }
        var bytes=rsa.ExportSubjectPublicKeyInfo();PublicKey=Convert.ToBase64String(bytes);Fingerprint=Convert.ToHexStringLower(SHA256.HashData(bytes));
    }
    public void Apply(GeminiKeyEnvelope envelope)
    {
        if(!envelope.FreeTierProjectConfirmed)throw new InvalidDataException("Confirme que o projeto Gemini está no nível gratuito.");
        byte[] cipher;
        try{cipher=Convert.FromBase64String(envelope.EncryptedKey??"");}catch(FormatException){throw new InvalidDataException("Envio de chave inválido.");}
        if(cipher.Length!=256)throw new InvalidDataException("Envio de chave inválido.");
        byte[] plain;
        try{lock(gate)plain=rsa.Decrypt(cipher,RSAEncryptionPadding.OaepSHA256);}catch(CryptographicException){throw new InvalidDataException("Não foi possível abrir a chave. Confira o identificador do Mac.");}
        try
        {
            var key=Encoding.UTF8.GetString(plain).Trim();
            if(!Regex.IsMatch(key,"^[A-Za-z0-9_-]{20,160}$"))throw new InvalidDataException("Cole somente a chave Gemini, sem aspas ou comandos.");
            Volatile.Write(ref current,new(key,true));
        }
        finally{CryptographicOperations.ZeroMemory(plain);}
    }
    public void Dispose()=>rsa.Dispose();
}

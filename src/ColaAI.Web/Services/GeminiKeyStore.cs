using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Text.Json;
namespace ColaAI.Web.Services;
public sealed record RuntimeGeminiKey(string ApiKey,bool FreeTierProjectConfirmed);
public sealed record GeminiKeyEnvelope(string EncryptedKey,bool FreeTierProjectConfirmed);
public sealed class GeminiKeyStore:IDisposable
{
    private readonly RSA rsa;
    private readonly object gate=new();
    private readonly string? savedKeyPath;
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
        savedKeyPath=privateKeyPath is null?null:privateKeyPath+".gemini.json";
        if(savedKeyPath is not null&&File.Exists(savedKeyPath))
        {
            try
            {
                var saved=JsonSerializer.Deserialize<GeminiKeyEnvelope>(File.ReadAllText(savedKeyPath));
                if(saved is not null)ApplyCore(saved,false);
            }
            catch(Exception e)when(e is JsonException or InvalidDataException)
            {
                // A damaged or obsolete saved envelope must not prevent starting the app.
                // Leave the existing file intact; a new explicit save replaces it.
            }
        }
        var bytes=rsa.ExportSubjectPublicKeyInfo();PublicKey=Convert.ToBase64String(bytes);Fingerprint=Convert.ToHexStringLower(SHA256.HashData(bytes));
    }
    public void Apply(GeminiKeyEnvelope envelope)
    {
        lock(gate)ApplyCore(envelope,true);
    }
    private void ApplyCore(GeminiKeyEnvelope envelope,bool persist)
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
            if(!Regex.IsMatch(key,"^[A-Za-z0-9_.-]{20,160}$"))throw new InvalidDataException("Cole somente a chave Gemini, sem aspas ou comandos.");
            if(persist&&savedKeyPath is not null)
            {
                // Store only the encrypted envelope; never persist the plaintext API key.
                var temp=savedKeyPath+"."+Guid.NewGuid().ToString("N")+".tmp";
                try
                {
                    using(var file=new FileStream(temp,FileMode.CreateNew,FileAccess.Write,FileShare.None))
                    {
                        if(!OperatingSystem.IsWindows())File.SetUnixFileMode(temp,UnixFileMode.UserRead|UnixFileMode.UserWrite);
                        var data=JsonSerializer.SerializeToUtf8Bytes(envelope);file.Write(data);file.Flush(true);
                    }
                    File.Move(temp,savedKeyPath,true);
                }
                catch(Exception e)when(e is IOException or UnauthorizedAccessException)
                {
                    throw new InvalidDataException("Não foi possível salvar a chave no Mac. Confira o acesso à pasta App_Data e tente novamente.");
                }
                finally{if(File.Exists(temp))File.Delete(temp);}
            }
            Volatile.Write(ref current,new(key,true));
        }
        finally{CryptographicOperations.ZeroMemory(plain);}
    }
    public void Dispose()=>rsa.Dispose();
}

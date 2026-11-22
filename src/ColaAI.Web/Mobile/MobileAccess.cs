using System.Net;
using System.Security.Cryptography;
using System.Text;
namespace ColaAI.Web.Mobile;
public sealed class MobileAccess
{
    public bool Enabled { get; }
    public string? Host { get; }
    private readonly string token;
    public MobileAccess(bool enabled, string? host, string token)
    {
        if(enabled && (!IPAddress.TryParse(host,out var ip) || !IsPrivate(ip)))
            throw new InvalidOperationException("MobileApi:Host deve ser o IPv4 privado do Mac na rede Wi-Fi.");
        if(enabled && token.Length<32)throw new InvalidOperationException("Código de acesso mobile inválido.");
        Enabled=enabled;Host=host;this.token=token;
    }
    public static bool IsPrivate(IPAddress ip)
    {
        var b=ip.GetAddressBytes();return b.Length==4&&(b[0]==10||b[0]==172&&b[1]>=16&&b[1]<=31||b[0]==192&&b[1]==168);
    }
    public static MobileAccess FromConfiguration(IConfiguration config,string root)
    {
        var enabled=config.GetValue<bool>("MobileApi:Enabled");
        if(!enabled)return new(false,null,"");
        var folder=Path.Combine(root,"App_Data");Directory.CreateDirectory(folder);
        var path=Path.Combine(folder,"mobile-access.key");
        if(!File.Exists(path))
        {
            using var stream=new FileStream(path,FileMode.CreateNew,FileAccess.Write,FileShare.None);
            if(!OperatingSystem.IsWindows())File.SetUnixFileMode(path,UnixFileMode.UserRead|UnixFileMode.UserWrite);
            var bytes=Encoding.UTF8.GetBytes(Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(32)));stream.Write(bytes);
        }
        return new(true,config["MobileApi:Host"],File.ReadAllText(path).Trim());
    }
    public bool Authorizes(string? header)
    {
        if(!Enabled||header is null||!header.StartsWith("Bearer ",StringComparison.Ordinal))return false;
        var candidate=header[7..];
        return candidate.Length==token.Length&&CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(candidate),Encoding.UTF8.GetBytes(token));
    }
    public string PairingHtml(int port,string fingerprint="")=>$"<!doctype html><meta charset=utf-8><title>Cola.ai · Conectar iPhone</title><main style='font-family:system-ui;max-width:650px;margin:60px auto'><h1>Conectar o iPhone</h1><p>No app, abra <b>Configurações</b> e preencha:</p><p>Endereço do Mac: <code>http://{Host}:{port}</code></p><p>Código de acesso:</p><pre style='white-space:pre-wrap;word-break:break-all'>{System.Net.WebUtility.HtmlEncode(token)}</pre><p>Identificador de segurança do Mac (cole nas Configurações do app):</p><pre style='white-space:pre-wrap;word-break:break-all'>{fingerprint}</pre><p>Este código conecta ao seu Mac. A chave Gemini pode ser salva no iPhone e aplicada à memória do servidor. Mantenha os dois aparelhos na mesma rede Wi-Fi.</p></main>";
}

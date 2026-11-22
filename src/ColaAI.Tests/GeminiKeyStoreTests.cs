using System.Security.Cryptography;
using System.Text;
using ColaAI.Web.Services;
namespace ColaAI.Tests;
public class GeminiKeyStoreTests
{
    private static GeminiKeyEnvelope Envelope(GeminiKeyStore store,string key,bool confirmed=true)
    {
        using var rsa=RSA.Create();rsa.ImportSubjectPublicKeyInfo(Convert.FromBase64String(store.PublicKey),out _);
        return new(Convert.ToBase64String(rsa.Encrypt(Encoding.UTF8.GetBytes(key),RSAEncryptionPadding.OaepSHA256)),confirmed);
    }
    [Fact] public void AppliesEncryptedKeyAndPreservesItOnRejectedUpdates()
    {
        using var store=new GeminiKeyStore();const string key="test_gemini_key_123456789012345";
        Assert.Null(store.Current);store.Apply(Envelope(store,key));Assert.Equal(key,store.Current!.ApiKey);
        Assert.Throws<InvalidDataException>(()=>store.Apply(Envelope(store,key,false)));
        Assert.Throws<InvalidDataException>(()=>store.Apply(new("invalid",true)));
        Assert.Equal(key,store.Current.ApiKey);
    }
    [Fact] public void AcceptsDottedAuthorizationKey()
    {
        using var store=new GeminiKeyStore();const string key="AQ.synthetic_key_for_format_test_12345678901234567890";
        store.Apply(Envelope(store,key));Assert.Equal(key,store.Current!.ApiKey);
    }
    [Fact] public void DamagedSavedEnvelopeAllowsReplacingKey()
    {
        var folder=Path.Combine(Path.GetTempPath(),Guid.NewGuid().ToString());var file=Path.Combine(folder,"rsa.pem");
        try
        {
            using(var first=new GeminiKeyStore(file)){first.Apply(Envelope(first,"test_gemini_key_123456789012345"));}
            File.WriteAllText(file+".gemini.json","invalid json");
            using(var second=new GeminiKeyStore(file)){Assert.Null(second.Current);second.Apply(Envelope(second,"replacement_gemini_key_1234567890"));}
            using var third=new GeminiKeyStore(file);Assert.Equal("replacement_gemini_key_1234567890",third.Current!.ApiKey);
        }
        finally{Directory.Delete(folder,true);}
    }
    [Fact] public void RestoresEncryptedKeyAfterRestartWithoutPlaintextOnDisk()
    {
        var folder=Path.Combine(Path.GetTempPath(),Guid.NewGuid().ToString());var file=Path.Combine(folder,"rsa.pem");
        try
        {
            string fingerprint;
            using(var first=new GeminiKeyStore(file)){fingerprint=first.Fingerprint;first.Apply(Envelope(first,"test_gemini_key_123456789012345"));}
            using var second=new GeminiKeyStore(file);Assert.Equal(fingerprint,second.Fingerprint);Assert.Equal("test_gemini_key_123456789012345",second.Current!.ApiKey);
            Assert.DoesNotContain("test_gemini",File.ReadAllText(file));
            Assert.DoesNotContain("test_gemini",File.ReadAllText(file+".gemini.json"));
            Assert.Throws<InvalidDataException>(()=>second.Apply(new("invalid",true)));
            using var third=new GeminiKeyStore(file);Assert.Equal(second.Current.ApiKey,third.Current!.ApiKey);
        }
        finally{Directory.Delete(folder,true);}
    }
}

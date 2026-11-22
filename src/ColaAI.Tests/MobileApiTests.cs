using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using ColaAI.Web.Mobile;
using ColaAI.Web.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Data.Sqlite;
namespace ColaAI.Tests;
public sealed class MobileApiTests:IAsyncLifetime
{
    private readonly string folder=Path.Combine(Path.GetTempPath(),"cola-mobile-tests-"+Guid.NewGuid());
    private readonly FakeGemini fake=new();private WebApplication app=null!;private HttpClient client=null!;
    private const string Token="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    private static object Acervo(string text="Overfitting e redes neurais.")=>new {schemaVersion=1,source="blackboard-batch",course=new {title="IA teste",url="https://example.test/course"},coverage="nao-confirmada",files=new[]{new {name="Material.pdf",status="concluido",pageCount=1,pages=new[]{new {page=1,text,needsOcr=false}}}}};
    public async Task InitializeAsync()
    {
        var b=WebApplication.CreateBuilder();b.Logging.ClearProviders();
        b.Configuration["AllowedHosts"]="localhost;127.0.0.1";
        b.Services.PostConfigure<Microsoft.AspNetCore.HostFiltering.HostFilteringOptions>(o=>o.AllowedHosts=["localhost","127.0.0.1","192.168.1.10"]);
        b.WebHost.UseUrls("http://127.0.0.1:0");
        b.Services.AddSingleton(new LocalLibrary(Path.Combine(folder,"test.db")));b.Services.AddSingleton<CorpusReader>();b.Services.AddTransient<StudyService>();
        b.Services.Configure<GeminiOptions>(o=>{o.ApiKey="fake-test-key";o.FreeTierProjectConfirmed=true;});
        b.Services.AddHttpClient<GeminiSummaryService>().ConfigurePrimaryHttpMessageHandler(()=>fake);
        b.Services.AddSingleton<MobileSummaryJobs>();b.Services.AddHostedService(p=>p.GetRequiredService<MobileSummaryJobs>());
        app=b.Build();
        app.Use(async(context,next)=>{if(context.Request.Headers["X-Test-Lan"]=="true")context.Connection.RemoteIpAddress=IPAddress.Parse("192.168.1.20");await next(context);});
        app.MapMobileApi(new MobileAccess(true,"192.168.1.10",Token),5180);await app.StartAsync();
        client=new HttpClient{BaseAddress=new Uri(app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single())};
        client.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",Token);
    }
    public async Task DisposeAsync(){client.Dispose();await app.StopAsync();await app.DisposeAsync();SqliteConnection.ClearAllPools();Directory.Delete(folder,true);}
    [Fact]public async Task ApiRequiresAccessCodeAndRejectsBrowserOrigin()
    {
        using var req=new HttpRequestMessage(HttpMethod.Get,"/api/mobile/health");req.Headers.Authorization=new AuthenticationHeaderValue("Bearer","wrong");
        Assert.Equal(HttpStatusCode.Unauthorized,(await client.SendAsync(req)).StatusCode);
        using var browser=new HttpRequestMessage(HttpMethod.Get,"/api/mobile/health");browser.Headers.Add("Origin","https://example.com");
        Assert.Equal(HttpStatusCode.Unauthorized,(await client.SendAsync(browser)).StatusCode);
        var health=await client.GetStringAsync("/api/mobile/health");Assert.Contains("cola-ai-mobile",health);Assert.DoesNotContain("fake-test-key",health);
    }
    [Fact]public async Task ImportIndexesCorpusWithoutCallingGemini()
    {
        var c=await Import();Assert.Equal(1,c.GetProperty("documentCount").GetInt32());Assert.Equal(1,c.GetProperty("pageCount").GetInt32());Assert.Equal(0,fake.Calls);
        var saved=app.Services.GetRequiredService<LocalLibrary>().Load(c.GetProperty("key").GetString()!);Assert.StartsWith("D",saved!.Documents[0].Id);
        Assert.Single(app.Services.GetRequiredService<LocalLibrary>().Search(saved,"overfitting"));
    }
    [Fact]public async Task InvalidCorpusDoesNotReplaceLibrary()
    {
        Assert.Equal(HttpStatusCode.BadRequest,(await client.PostAsJsonAsync("/api/mobile/courses/import",new {schemaVersion=1,source="diagnostic"})).StatusCode);
        Assert.Empty(app.Services.GetRequiredService<LocalLibrary>().List());Assert.Equal(0,fake.Calls);
    }
    [Fact]public async Task JobGeneratesCitedSummaryAndReusesCache()
    {
        var c=await Import();var key=c.GetProperty("key").GetString()!;
        var job=await Generate(key);Assert.Equal("completed",job.GetProperty("state").GetString());Assert.Equal(2,fake.Calls);
        Assert.Equal(1,job.GetProperty("result").GetProperty("documentCount").GetInt32());
        var again=await Generate(key);Assert.Equal("completed",again.GetProperty("state").GetString());Assert.Equal(2,fake.Calls);
        var info=await Json(client.GetAsync("/api/mobile/courses/"+key));Assert.Equal(1,info.GetProperty("cachedDocuments").GetInt32());Assert.Equal(JsonValueKind.Object,info.GetProperty("summary").ValueKind);
    }
    [Fact]public async Task QuotaStopsWithoutRetryAndManualResumeUsesSavedDocument()
    {
        var c=await Import();var key=c.GetProperty("key").GetString()!;fake.FailAt=2;
        var failed=await Generate(key);Assert.Equal("failed",failed.GetProperty("state").GetString());Assert.Contains("429",failed.GetProperty("error").GetString());Assert.Equal(2,fake.Calls);
        fake.FailAt=0;var resumed=await Generate(key);Assert.Equal("completed",resumed.GetProperty("state").GetString());Assert.Equal(3,fake.Calls);
    }
    [Fact]public async Task LanCannotAccessPairingCodeOrExistingWebPages()
    {
        foreach(var path in new[]{"/mobile-setup","/","/foto"}){
            using var req=new HttpRequestMessage(HttpMethod.Get,path);req.Headers.Add("X-Test-Lan","true");
            Assert.Equal(HttpStatusCode.Forbidden,(await client.SendAsync(req)).StatusCode);
        }
        using var health=new HttpRequestMessage(HttpMethod.Get,"/api/mobile/health");health.Headers.Add("X-Test-Lan","true");
        Assert.Equal(HttpStatusCode.OK,(await client.SendAsync(health)).StatusCode);
    }
    [Fact]public async Task DuplicateStartReturnsSameJobAndCancelStopsIt()
    {
        var c=await Import();var key=c.GetProperty("key").GetString()!;fake.Block=true;
        var first=await Json(client.PostAsync($"/api/mobile/courses/{key}/summary",null));
        var second=await Json(client.PostAsync($"/api/mobile/courses/{key}/summary",null));
        Assert.Equal(first.GetProperty("id").GetString(),second.GetProperty("id").GetString());
        await client.PostAsync("/api/mobile/jobs/"+first.GetProperty("id").GetString()+"/cancel",null);
        for(var i=0;i<100;i++){
            var view=await Json(client.GetAsync("/api/mobile/jobs/"+first.GetProperty("id").GetString()));
            if(view.GetProperty("state").GetString()=="cancelled"){Assert.Equal(JsonValueKind.Null,view.GetProperty("result").ValueKind);return;}
            await Task.Delay(20);
        }
        throw new TimeoutException("Cancel did not finish.");
    }
    [Fact]public async Task PrivateMacHostnameIsAcceptedButOtherHostnamesAreRejected()
    {
        using var lan=new HttpRequestMessage(HttpMethod.Get,"/api/mobile/health");lan.Headers.Host="192.168.1.10:5180";
        Assert.Equal(HttpStatusCode.OK,(await client.SendAsync(lan)).StatusCode);
        using var wrong=new HttpRequestMessage(HttpMethod.Get,"/api/mobile/health");wrong.Headers.Host="untrusted.example";
        Assert.Equal(HttpStatusCode.BadRequest,(await client.SendAsync(wrong)).StatusCode);
    }
    [Fact]public async Task MindMapRequiresReadySummaryWithoutCallingGemini()
    {
        var c=await Import();var key=c.GetProperty("key").GetString();
        Assert.Equal(HttpStatusCode.Conflict,(await client.PostAsync($"/api/mobile/courses/{key}/mind-map",null)).StatusCode);Assert.Equal(0,fake.Calls);
    }
    [Fact]public async Task MindMapUsesOnlySummaryAndReusesCache()
    {
        var c=await Import();var key=c.GetProperty("key").GetString()!;await Generate(key);
        var map=await Json(client.PostAsync($"/api/mobile/courses/{key}/mind-map",null));
        Assert.Equal("Overfitting",map.GetProperty("map").GetProperty("themes")[0].GetProperty("topics")[0].GetProperty("label").GetString());
        Assert.Equal(3,fake.Calls);Assert.Contains("summary",fake.MapInput);Assert.DoesNotContain("redes neurais",fake.MapInput);Assert.DoesNotContain("documents",fake.MapInput);
        await Json(client.PostAsync($"/api/mobile/courses/{key}/mind-map",null));await Json(client.GetAsync($"/api/mobile/courses/{key}/mind-map"));Assert.Equal(3,fake.Calls);
        await Json(client.PostAsJsonAsync("/api/mobile/courses/import",Acervo("Material atualizado sobre regularização.")));
        Assert.Equal(HttpStatusCode.NotFound,(await client.GetAsync($"/api/mobile/courses/{key}/mind-map")).StatusCode);
    }
    [Fact]public async Task MindMapQuotaFailureDoesNotRetryOrSavePartialMap()
    {
        var c=await Import();var key=c.GetProperty("key").GetString()!;await Generate(key);fake.FailAt=3;
        using var failed=await client.PostAsync($"/api/mobile/courses/{key}/mind-map",null);Assert.Equal(HttpStatusCode.Conflict,failed.StatusCode);Assert.Contains("429",await failed.Content.ReadAsStringAsync());Assert.Equal(3,fake.Calls);
        Assert.Equal(HttpStatusCode.NotFound,(await client.GetAsync($"/api/mobile/courses/{key}/mind-map")).StatusCode);
        fake.FailAt=0;await Json(client.PostAsync($"/api/mobile/courses/{key}/mind-map",null));Assert.Equal(4,fake.Calls);
    }
    [Theory][InlineData("0.0.0.0")][InlineData("8.8.8.8")][InlineData("127.0.0.1")]
    public void LanModeRejectsNonPrivateBindAddress(string host)=>Assert.Throws<InvalidOperationException>(()=>new MobileAccess(true,host,Token));
    private Task<JsonElement> Import()=>Json(client.PostAsJsonAsync("/api/mobile/courses/import",Acervo()));
    private async Task<JsonElement> Generate(string key)
    {
        var initial=await Json(client.PostAsync($"/api/mobile/courses/{key}/summary",null));var id=initial.GetProperty("id").GetString();
        for(var i=0;i<100;i++){var job=await Json(client.GetAsync("/api/mobile/jobs/"+id));if(job.GetProperty("state").GetString() is not ("queued" or "running"))return job;await Task.Delay(20);}
        throw new TimeoutException("Test job did not finish.");
    }
    private static async Task<JsonElement> Json(Task<HttpResponseMessage> pending){using var r=await pending;r.EnsureSuccessStatusCode();using var d=JsonDocument.Parse(await r.Content.ReadAsStringAsync());return d.RootElement.Clone();}
    private sealed class FakeGemini:HttpMessageHandler
    {
        public int Calls,FailAt;public bool Block;public string MapInput="";
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct)
        {
            Calls++;if(Block)await Task.Delay(Timeout.Infinite,ct);if(Calls==FailAt)return new(HttpStatusCode.TooManyRequests);
            using var body=JsonDocument.Parse(await request.Content!.ReadAsStringAsync(ct));
            using var input=JsonDocument.Parse(body.RootElement.GetProperty("contents")[0].GetProperty("parts")[0].GetProperty("text").GetString()!);
            var mapInput=input.RootElement.TryGetProperty("summary",out var source);
            if(mapInput)MapInput=input.RootElement.GetRawText();
            var id=mapInput?source.GetProperty("sections")[0].GetProperty("references")[0].GetProperty("documentId").GetString():input.RootElement.TryGetProperty("documents",out var docs)?docs[0].GetProperty("documentId").GetString():input.RootElement.GetProperty("documentSummaries")[0].GetProperty("sections")[0].GetProperty("references")[0].GetProperty("documentId").GetString();
            object output=mapInput
                ?new {title="IA",themes=new[]{new {label="Generalização",topics=new[]{new {label="Overfitting",references=new[]{new {documentId=id,page=1}}}}}}}
                :new {title="Resumo teste",sections=new[]{new {title="Conceitos",text="Overfitting deve ser reduzido para melhorar a generalização.",references=new[]{new {documentId=id,page=1}}}}};
            var response=new {candidates=new[]{new {finishReason="STOP",content=new {parts=new[]{new {text=JsonSerializer.Serialize(output)}}}}},usageMetadata=new {totalTokenCount=10}};
            return new(HttpStatusCode.OK){Content=JsonContent.Create(response)};
        }
    }
}

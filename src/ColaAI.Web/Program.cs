using ColaAI.Web.Components;
using ColaAI.Web.Services;
using ColaAI.Web.Mobile;

var builder = WebApplication.CreateBuilder(args);
// Local-only default; no cloud services or paid fallback.
builder.WebHost.UseStaticWebAssets();
var localPort = builder.Configuration.GetValue("LocalServer:Port", 5180);
if (localPort is < 1 or > 65535) throw new InvalidOperationException("Porta local inválida.");
var mobileAccess=MobileAccess.FromConfiguration(builder.Configuration,builder.Environment.ContentRootPath);
if(mobileAccess.Enabled)
    builder.Services.PostConfigure<Microsoft.AspNetCore.HostFiltering.HostFilteringOptions>(options=>options.AllowedHosts=["localhost","127.0.0.1",mobileAccess.Host!]);
builder.WebHost.UseUrls(mobileAccess.Enabled
    ? [$"http://127.0.0.1:{localPort}",$"http://{mobileAccess.Host}:{localPort}"]
    : [$"http://127.0.0.1:{localPort}"]);
builder.WebHost.ConfigureKestrel(options=>options.Limits.MaxRequestBodySize=CorpusReader.MaxUploadBytes);
builder.Services.AddSingleton<MobileSummaryJobs>();
builder.Services.AddHostedService(provider=>provider.GetRequiredService<MobileSummaryJobs>());
builder.Services.AddRazorComponents().AddInteractiveServerComponents();
builder.Services.AddSingleton<CorpusReader>();
builder.Services.AddSingleton(new LocalLibrary(Path.Combine(builder.Environment.ContentRootPath, "App_Data", "cola-ai.db")));
builder.Services.AddTransient<StudyService>();
builder.Services.AddTransient<PhotoService>();
builder.Services.AddSingleton(new GeminiKeyStore(Path.Combine(builder.Environment.ContentRootPath,"App_Data","settings-rsa.pem")));
builder.Services.Configure<GeminiOptions>(builder.Configuration.GetSection("Gemini"));
builder.Services.AddHttpClient<GeminiSummaryService>(client => client.Timeout = TimeSpan.FromMinutes(4));
var app = builder.Build();
app.MapMobileApi(mobileAccess,localPort);
app.UseAntiforgery();
app.MapStaticAssets();
app.MapGet("/favicon.ico", () => Results.Redirect("/favicon.svg"));
app.MapRazorComponents<App>().AddInteractiveServerRenderMode();
app.Run();

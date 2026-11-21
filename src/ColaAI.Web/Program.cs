using ColaAI.Web.Components;
using ColaAI.Web.Services;

var builder = WebApplication.CreateBuilder(args);
// Local-only default; no cloud services or paid fallback.
builder.WebHost.UseStaticWebAssets();
var localPort = builder.Configuration.GetValue("LocalServer:Port", 5180);
if (localPort is < 1 or > 65535) throw new InvalidOperationException("Porta local inválida.");
builder.WebHost.UseUrls($"http://127.0.0.1:{localPort}");
builder.Services.AddRazorComponents().AddInteractiveServerComponents();
builder.Services.AddSingleton<CorpusReader>();
builder.Services.AddSingleton(new LocalLibrary(Path.Combine(builder.Environment.ContentRootPath, "App_Data", "cola-ai.db")));
builder.Services.AddTransient<StudyService>();
builder.Services.AddTransient<PhotoService>();
builder.Services.Configure<GeminiOptions>(builder.Configuration.GetSection("Gemini"));
builder.Services.AddHttpClient<GeminiSummaryService>(client => client.Timeout = TimeSpan.FromMinutes(4));
var app = builder.Build();
app.UseAntiforgery();
app.MapStaticAssets();
app.MapGet("/favicon.ico", () => Results.Redirect("/favicon.svg"));
app.MapRazorComponents<App>().AddInteractiveServerRenderMode();
app.Run();

using ColaAI.Web.Components;
using ColaAI.Web.Services;

var builder = WebApplication.CreateBuilder(args);
// Local-only default; no cloud services or paid fallback.
builder.WebHost.UseStaticWebAssets();
builder.WebHost.UseUrls("http://127.0.0.1:5180");
builder.Services.AddRazorComponents().AddInteractiveServerComponents();
builder.Services.AddSingleton<CorpusReader>();
builder.Services.AddSingleton(new LocalLibrary(Path.Combine(builder.Environment.ContentRootPath, "App_Data", "cola-ai.db")));
builder.Services.AddTransient<StudyService>();
builder.Services.Configure<GeminiOptions>(builder.Configuration.GetSection("Gemini"));
builder.Services.AddHttpClient<GeminiSummaryService>(client => client.Timeout = TimeSpan.FromMinutes(4));
var app = builder.Build();
app.UseAntiforgery();
app.MapStaticAssets();
app.MapRazorComponents<App>().AddInteractiveServerRenderMode();
app.Run();

using System.Net;
using System.Text.Json;
using ColaAI.Web.Services;
namespace ColaAI.Web.Mobile;
public static class MobileEndpoints
{
    public static void MapMobileApi(this WebApplication app,MobileAccess access,int port)
    {
        app.Use(async(context,next)=>
        {
            var mobile=context.Request.Path.StartsWithSegments("/api/mobile");
            var loopback=context.Connection.RemoteIpAddress is {} ip&&IPAddress.IsLoopback(ip);
            if(mobile)
            {
                context.Response.Headers.CacheControl="no-store";
                if(!access.Enabled){context.Response.StatusCode=404;return;}
                // Native requests do not have Origin; browser pages cannot operate this API.
                if(context.Request.Headers.ContainsKey("Origin")||!access.Authorizes(context.Request.Headers.Authorization.ToString())){context.Response.StatusCode=401;return;}
            }
            else if(!loopback){context.Response.StatusCode=403;return;}
            await next(context);
        });
        app.MapGet("/mobile-setup",(HttpResponse response)=>{response.Headers.CacheControl="no-store";return access.Enabled?Results.Content(access.PairingHtml(port),"text/html; charset=utf-8"):Results.NotFound();});
        var api=app.MapGroup("/api/mobile");
        api.MapGet("/health",(GeminiSummaryService gemini)=>Results.Ok(new {service="cola-ai-mobile",version=1,geminiConfigured=gemini.Configured,model=gemini.Model}));
        api.MapPost("/courses/import",async(HttpRequest request,CorpusReader reader,LocalLibrary library,StudyService study,MobileSummaryJobs jobs,CancellationToken ct)=>
        {
            if(request.ContentLength>CorpusReader.MaxUploadBytes)return Results.Json(new{error="O acervo excede 20 MB."},statusCode:413);
            if(!request.HasJsonContentType())return Results.Json(new{error="Envie o acervo em JSON."},statusCode:415);
            try
            {
                // Limit even chunked uploads; never trust only Content-Length.
                using var buffer=new MemoryStream();var chunk=new byte[65536];int read;
                while((read=await request.Body.ReadAsync(chunk,ct))>0){if(buffer.Length+read>CorpusReader.MaxUploadBytes)return Results.Json(new{error="O acervo excede 20 MB."},statusCode:413);await buffer.WriteAsync(chunk.AsMemory(0,read),ct);}
                buffer.Position=0;
                var corpus=LocalLibrary.Stable(await reader.ReadAsync(buffer,ct));var key=LocalLibrary.CourseKey(corpus);
                if(jobs.IsActive(key))return Results.Json(new{error="Aguarde o resumo desta disciplina antes de atualizar o acervo."},statusCode:409);
                library.Save(corpus);
                return Results.Ok(Describe(key,library,study));
            }
            catch(Exception e)when(e is InvalidDataException or JsonException){return Results.BadRequest(new{error=e is InvalidDataException?e.Message:"JSON inválido."});}
        });
        api.MapGet("/courses",(LocalLibrary library)=>Results.Ok(library.List()));
        api.MapGet("/courses/{key}",(string key,LocalLibrary library,StudyService study)=>library.Load(key) is null?Results.NotFound():Results.Ok(Describe(key,library,study)));
        api.MapPost("/courses/{key}/summary",(string key,LocalLibrary library,MobileSummaryJobs jobs,GeminiSummaryService gemini,StudyService study)=>
        {
            var corpus=library.Load(key);if(corpus is null)return Results.NotFound();
            if(!gemini.Configured&&study.SavedSummary(corpus) is null)return Results.Json(new{error="Configure o Gemini no Mac e confirme o nível gratuito."},statusCode:409);
            try{var job=jobs.Start(corpus);return Results.Accepted($"/api/mobile/jobs/{job.Id}",job);}
            catch(InvalidOperationException e){return Results.Json(new{error=e.Message},statusCode:409);}
        });
        api.MapGet("/jobs/{id}",(string id,MobileSummaryJobs jobs)=>jobs.Get(id) is {} job?Results.Ok(job):Results.NotFound());
        api.MapPost("/jobs/{id}/cancel",(string id,MobileSummaryJobs jobs)=>jobs.Cancel(id)?Results.Ok(new{cancelRequested=true}):Results.NotFound());
    }
    private static object Describe(string key,LocalLibrary library,StudyService study)
    {
        var c=library.Load(key)!;
        return new{key,title=c.Title,fingerprint=LocalLibrary.Fingerprint(c),documents=c.Documents.Select(d=>new{id=d.Id,name=d.Name,pages=d.Pages.Count}),documentCount=c.Documents.Count,pageCount=c.PageCount,characterCount=c.CharacterCount,coverage=c.Coverage,warnings=c.Warnings,cachedDocuments=study.CachedDocuments(c),summary=study.SavedSummary(c)};
    }
}

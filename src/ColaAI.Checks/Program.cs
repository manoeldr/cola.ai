using System.Net;
using System.Text;
using System.Text.Json;
using ColaAI.Web.Models;
using ColaAI.Web.Services;
using Microsoft.Extensions.Options;

var checks = 0;
void Check(bool valid, string name) { if (!valid) throw new Exception(name); Console.WriteLine("OK · " + name); checks++; }
async Task Reject(Func<Task> action, string name) { try { await action(); } catch (Exception e) when(e is InvalidDataException or InvalidOperationException) { Check(true,name); return; } throw new Exception("Não rejeitou: " + name); }
var reader = new CorpusReader();
var fixture = """{"schemaVersion":1,"source":"blackboard-batch","course":{"title":"Teste"},"files":[{"name":"A.pdf","status":"concluido","pageCount":1,"pages":[{"page":1,"text":"Conceito A"}]},{"name":"B.pdf","status":"concluido","pageCount":1,"pages":[{"page":1,"text":"Conceito B"}]}]}""";
var corpus = await reader.ReadAsync(new MemoryStream(Encoding.UTF8.GetBytes(fixture)));
Check(corpus.Documents.Count==2 && corpus.PageCount==2,"Importação de todos os documentos");
Check(GeminiSummaryService.BuildInput(corpus).Contains("Conceito B"),"Prompt inclui segundo documento");
await Reject(async()=>await reader.ReadAsync(new MemoryStream(Encoding.UTF8.GetBytes(fixture.Replace("\"page\":1","\"page\":9")))),"Numeração inválida rejeitada");
await Reject(async()=>await reader.ReadAsync(new MemoryStream(Encoding.UTF8.GetBytes(fixture.Replace("blackboard-batch","blackboard-course-crawl")))),"Diagnóstico não é confundido com acervo");
GeneratedSummary valid = new("Resumo",[new("Tema","Explicação",[new("D001",1),new("D002",1)])]);
SummaryValidator.Validate(valid,corpus);Check(true,"Citações reais e cobertura por documento aceitas");
await Reject(()=>{SummaryValidator.Validate(new("Resumo",[new("Tema","Texto",[new("D001",99)])]),corpus);return Task.CompletedTask;},"Página inventada rejeitada");
await Reject(()=>{SummaryValidator.Validate(new("Resumo",[new("Tema","Texto",[new("D001",1)])]),corpus);return Task.CompletedTask;},"Documento omitido rejeitado");
await Reject(()=>{GeminiSummaryService.BuildInput(corpus with{Documents=[new("D001","Grande",[new(1,new string('a',500001),false)])]});return Task.CompletedTask;},"Acervo grande não é truncado");
var handler = new FakeHandler();
var settings=Options.Create(new GeminiOptions{ApiKey="test-key-not-real",FreeTierProjectConfirmed=true});
var service=new GeminiSummaryService(new HttpClient(handler),settings);
var json=JsonSerializer.Serialize(valid,CorpusReader.JsonOptions);
handler.Body=JsonSerializer.Serialize(new{candidates=new[]{new{finishReason="STOP",content=new{parts=new[]{new{text=json}}}}}});
var result=await service.GenerateAsync(corpus,default);Check(result.DocumentCount==2,"Resposta HTTP estruturada validada");
handler.Status=HttpStatusCode.TooManyRequests;
var before=handler.Calls;
await Reject(async()=>await service.GenerateAsync(corpus,default),"Cota 429 interrompe geração");
Check(handler.Calls==before+1,"Sem repetição automática nem fallback");
handler.Status=HttpStatusCode.OK;handler.Body=handler.Body.Replace("STOP","MAX_TOKENS");
await Reject(async()=>await service.GenerateAsync(corpus,default),"Resposta truncada rejeitada");
if(args.Length>0){await using var real=File.OpenRead(args[0]);var imported=await reader.ReadAsync(real);Check(imported.Documents.Count==19&&imported.PageCount==445&&imported.CharacterCount==217042,"Acervo real: 19 PDFs, 445 páginas, 217042 caracteres");var input=GeminiSummaryService.BuildInput(imported);Check(imported.Documents.All(d=>input.Contains(d.Id)),"Todos os documentos reais incluídos no pedido");}
Console.WriteLine($"{checks} verificações concluídas; nenhuma chamada ao Gemini real.");
sealed class FakeHandler:HttpMessageHandler
{
 public HttpStatusCode Status=HttpStatusCode.OK; public string Body="{}";public int Calls;
 protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct){Calls++;return Task.FromResult(new HttpResponseMessage(Status){Content=new StringContent(Body,Encoding.UTF8,"application/json")});}
}

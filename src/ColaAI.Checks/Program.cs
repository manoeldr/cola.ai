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

handler.Status=HttpStatusCode.BadRequest;
handler.Body="""{"error":{"status":"INVALID_ARGUMENT","message":"API key test-key-not-real is invalid. https://example.com/?key=test-key-not-real"}}""";
try { await service.GenerateAsync(corpus, default); throw new Exception("Erro 400 não rejeitado"); }
catch(InvalidOperationException e)
{
 Check(e.Message.Contains("INVALID_ARGUMENT"),"Erro HTTP 400 mostra o motivo retornado pelo Google");
 Check(!e.Message.Contains("test-key-not-real")&&!e.Message.Contains("https://"),"Diagnóstico não revela chave ou URL sensível");
}
Check(GeminiSummaryService.FormatApiError(400,"not-json","secret").Contains("HTTP 400"),"Erro não JSON recebe diagnóstico seguro");
var oneSource=new GeneratedSummary("Síntese",[new("Tema geral","Síntese do material A",[new("D001",1)])]);
var individualA=new GeneratedSummary("A",[new("Assunto A","Texto individual A",[new("D001",1)])]);
var individualB=new GeneratedSummary("B",[new("Assunto B","Texto individual B",[new("D002",1)])]);
var partial=new SummaryResult(oneSource,"fake",DateTimeOffset.UtcNow,[],2,2,20,null);
var completed=StudyService.CompleteCoverage(partial,corpus,[individualA,individualB]);
Check(completed.SupplementedDocuments==1 && completed.Summary.Sections.Count==2,"Omissão na síntese recebe complemento do resumo individual validado");
Check(completed.Summary.Sections[1].Text=="Texto individual B" && completed.Summary.Sections[1].Title.StartsWith("Complemento por material"),"Complemento preserva texto original e identifica a origem");
Check(completed.Summary.Sections[0].References.Count==1 && completed.Summary.Sections[0].References[0].DocumentId=="D001","Não acrescenta citações decorativas à prosa da síntese");
Check(StudyService.CompleteCoverage(completed,corpus,[individualA,individualB]).Summary.Sections.Count==2,"Resumo com cobertura não recebe complementos duplicados");
await Reject(()=>{StudyService.CompleteCoverage(partial,corpus,[individualA]);return Task.CompletedTask;},"Sem resumo individual não inventa complemento");
var dbPath=Path.Combine(Path.GetTempPath(),"cola-check-"+Guid.NewGuid()+".db");
try
{
 var library=new LocalLibrary(dbPath);
 var stable=LocalLibrary.Stable(corpus with{SourceKey="test-course"});
 library.Save(stable);library.Save(stable);
 Check(library.List().Count==1,"Reimportação idempotente de disciplina");
 var reopened=new LocalLibrary(dbPath);
 Check(reopened.Load(LocalLibrary.CourseKey(stable))!.PageCount==2,"Acervo persiste ao reabrir SQLite");
 Check(reopened.Search(stable,"Conceito").Count==2,"Índice FTS encontra trechos com página e arquivo");
 Check(reopened.Search(stable,"\" OR * --").Count==0,"Sintaxe FTS do usuário é neutralizada");
 var another=LocalLibrary.Stable(corpus with{Title="Outra",SourceKey="other-course",Documents=[new("old","Outro.pdf",[new(1,"exclusivo",false)])]});
 library.Save(another);
 Check(library.Search(stable,"exclusivo").Count==0,"Pesquisa isolada por disciplina");
 var pipelineHandler=new FakeHandler();
 pipelineHandler.Reply=body=>{
  using var request=JsonDocument.Parse(body);
  var input=request.RootElement.GetProperty("contents")[0].GetProperty("parts")[0].GetProperty("text").GetString()!;
  using var data=JsonDocument.Parse(input);
  List<Citation> citations;
  if(data.RootElement.TryGetProperty("documents",out var documents))citations=documents.EnumerateArray().Select(d=>new Citation(d.GetProperty("documentId").GetString()!,d.GetProperty("pages")[0].GetProperty("page").GetInt32())).ToList();
  else if(data.RootElement.TryGetProperty("documentSummaries",out var abstracts))citations=abstracts.EnumerateArray().SelectMany(d=>d.GetProperty("sections").EnumerateArray()).SelectMany(d=>d.GetProperty("references").EnumerateArray()).Select(d=>new Citation(d.GetProperty("documentId").GetString()!,d.GetProperty("page").GetInt32())).Distinct().ToList();
  else citations=data.RootElement.GetProperty("excerpts").EnumerateArray().Select(d=>new Citation(d.GetProperty("documentId").GetString()!,d.GetProperty("page").GetInt32())).Distinct().ToList();
  var answer=JsonSerializer.Serialize(new GeneratedSummary("Teste",[new("Tema","Resumo de teste",citations)]),CorpusReader.JsonOptions);
  return JsonSerializer.Serialize(new{candidates=new[]{new{finishReason="STOP",content=new{parts=new[]{new{text=answer}}}}}});
 };
 var pipelineGemini=new GeminiSummaryService(new HttpClient(pipelineHandler),settings);
 var study=new StudyService(library,pipelineGemini);
 pipelineHandler.FailAt=2;
 await Reject(async()=>await study.SummarizeAsync(stable,_=>{},default),"Interrupção de cota durante resumos individuais");
 Check(study.CachedDocuments(stable)==1,"Resumo concluído é salvo antes da interrupção");
 pipelineHandler.FailAt=0;var requestsBefore=pipelineHandler.Calls;
 await study.SummarizeAsync(stable,_=>{},default);
 Check(pipelineHandler.Calls==requestsBefore+2,"Retomada gera só o material faltante e a consolidação");
 requestsBefore=pipelineHandler.Calls;await study.SummarizeAsync(stable,_=>{},default);
 Check(pipelineHandler.Calls==requestsBefore,"Resumo geral repetido não chama a IA");
 Check(!pipelineHandler.Bodies.Last().Contains("Conceito A"),"Consolidação recebe resumos, não o texto original");
 var changed=LocalLibrary.Stable(corpus with{SourceKey="test-course",Documents=[corpus.Documents[0],corpus.Documents[1] with{Pages=[new(1,"conteudo atualizado",false)]}]});
 library.Save(changed);requestsBefore=pipelineHandler.Calls;
 await study.SummarizeAsync(changed,_=>{},default);
 Check(pipelineHandler.Calls==requestsBefore+2,"Arquivo alterado invalida só seu resumo e a síntese geral");
 Check(library.Search(changed,"Conceito B").All(h=>h.DocumentId!=stable.Documents[1].Id),"Versão antiga removida do índice ativo");
 await study.AskAsync(changed,"atualizado",default);
 Check(!pipelineHandler.Bodies.Last().Contains("Conceito A"),"Pergunta envia só trechos recuperados");
 requestsBefore=pipelineHandler.Calls;
 await Reject(async()=>await study.AskAsync(changed,"palavrainexistente",default),"Pergunta sem evidência não é enviada à IA");
 Check(pipelineHandler.Calls==requestsBefore,"Busca sem resultado não consome chamada");
 var otherModel=new StudyService(library,new GeminiSummaryService(new HttpClient(pipelineHandler),Options.Create(new GeminiOptions{ApiKey="fake",FreeTierProjectConfirmed=true,Model="test-other-model"})));
 requestsBefore=pipelineHandler.Calls;await otherModel.SummarizeAsync(changed,_=>{},default);
 Check(pipelineHandler.Calls==requestsBefore+3,"Troca de modelo não reutiliza resumos do modelo anterior");

 var png=Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4WQAAAAASUVORK5CYII=");
 Check(PhotoRules.DetectMime(png)=="image/png","Foto PNG reconhecida pela assinatura real");
 await Reject(()=>{PhotoRules.DetectMime(Encoding.UTF8.GetBytes("<svg></svg>"));return Task.CompletedTask;},"Imagem não suportada rejeitada antes da IA");
 await Reject(()=>{PhotoRules.DetectMime(new byte[PhotoRules.MaxImageBytes+1]);return Task.CompletedTask;},"Foto maior que 8 MB rejeitada");
 await Reject(()=>{PhotoRules.Validate(new(false,[],[]));return Task.CompletedTask;},"Leitura ilegível não passa para resolução");
 await Reject(()=>{PhotoRules.Validate(new(true,[],[new(1,"A"),new(1,"B")]));return Task.CompletedTask;},"Questões duplicadas rejeitadas");
 await Reject(()=>{PhotoRules.Validate(new(true,[],Enumerable.Range(1,11).Select(i=>new PhotoQuestion(i,"Texto")).ToList()));return Task.CompletedTask;},"Mais de dez questões não são truncadas");
 library.Save(stable);
 var photoHandler=new FakeHandler();
 photoHandler.Reply=body=>{
  using var request=JsonDocument.Parse(body);
  var parts=request.RootElement.GetProperty("contents")[0].GetProperty("parts");
  string answer;
  if(parts.EnumerateArray().Any(x=>x.TryGetProperty("inlineData",out _)))
   answer=JsonSerializer.Serialize(new PhotoTranscription(true,[],[new(1,"Conceito A"),new(2,"Conceito B")]),CorpusReader.JsonOptions);
  else{
   using var input=JsonDocument.Parse(parts[0].GetProperty("text").GetString()!);
   var refs=input.RootElement.GetProperty("excerpts").EnumerateArray().Select(x=>new Citation(x.GetProperty("documentId").GetString()!,x.GetProperty("page").GetInt32())).Distinct().ToList();
   answer=JsonSerializer.Serialize(new GeneratedSummary("Resolução",[new("Resposta","Explicação fundamentada",refs)]),CorpusReader.JsonOptions);
  }
  return JsonSerializer.Serialize(new{candidates=new[]{new{finishReason="STOP",content=new{parts=new[]{new{text=answer}}}}}});
 };
 var vision=new GeminiSummaryService(new HttpClient(photoHandler),settings);
 var photos=new PhotoService(library,vision);
 var photo=await photos.ReadAsync(stable,"foto.png",png,default);
 Check(photo.Transcription.Questions.Count==2,"Leitura multimodal retorna enunciados sem resolver");
 using(var imageRequest=JsonDocument.Parse(photoHandler.Bodies[0])){var inline=imageRequest.RootElement.GetProperty("contents")[0].GetProperty("parts")[1].GetProperty("inlineData");Check(inline.GetProperty("mimeType").GetString()=="image/png"&&Convert.FromBase64String(inline.GetProperty("data").GetString()!).SequenceEqual(png),"Imagem enviada inline com MIME e base64");}
 Check(library.LoadPhoto(photo.Id,LocalLibrary.CourseKey(stable))!.Image.SequenceEqual(png),"Foto original e transcrição persistem no SQLite");
 Check(library.LoadPhoto(photo.Id,LocalLibrary.CourseKey(another)) is null,"Histórico de fotos isolado por disciplina");
 photoHandler.FailAt=3;
 await Reject(async()=>await photos.SolveAsync(stable,photo,photo.Transcription,_=>{},default),"Interrupção 429 durante resolução por foto");
 photo=library.LoadPhoto(photo.Id,photo.CourseKey)!;
 Check(photo.Result!.Answers.Count==1,"Resposta já concluída preservada após falha");
 photoHandler.FailAt=0;requestsBefore=photoHandler.Calls;
 photo=await photos.SolveAsync(stable,photo,photo.Transcription,_=>{},default);
 Check(photo.Result!.Answers.Count==2&&photoHandler.Calls==requestsBefore+1,"Retomada resolve apenas a questão faltante");
 requestsBefore=photoHandler.Calls;
 photo=await photos.SolveAsync(stable,photo,photo.Transcription,_=>{},default);
 Check(photoHandler.Calls==requestsBefore,"Questões concluídas não são resolvidas novamente");
 var edited=photo.Transcription with{Questions=[new(1,"Conceito A atualizado"),new(2,"Conceito B")]};
 requestsBefore=photoHandler.Calls;photo=await photos.SolveAsync(stable,photo,edited,_=>{},default);
 Check(photoHandler.Calls==requestsBefore+1,"Editar um enunciado invalida só sua resposta");
 requestsBefore=photoHandler.Calls;
 var noSources=photo.Transcription with{Questions=[new(5,"mitocondria cloroplasto")]};
 photo=await photos.SolveAsync(stable,photo,noSources,_=>{},default);
 Check(photo.Result!.Answers[0].Status=="sem-fontes"&&photoHandler.Calls==requestsBefore,"Questão sem evidência sinalizada sem chamada à IA");
 var unreadable=new FakeHandler{Body=JsonSerializer.Serialize(new{candidates=new[]{new{finishReason="STOP",content=new{parts=new[]{new{text="{\"readable\":false,\"warnings\":[\"Foto borrada\"],\"questions\":[]}"}}}}}})};
 await Reject(async()=>await new GeminiSummaryService(new HttpClient(unreadable),settings).TranscribeAsync(png,default),"Transcrição real no formato ilegível é rejeitada");
 var noKey=new StudyService(library,new GeminiSummaryService(new HttpClient(new FakeHandler()),Options.Create(new GeminiOptions())));
 Check((await noKey.SummarizeAsync(changed,_=>{},default)).DocumentCount==2,"Resumo salvo pode ser lido sem chave");
}
finally
{
 Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
 foreach(var file in Directory.GetFiles(Path.GetDirectoryName(dbPath)!,Path.GetFileName(dbPath)+"*"))File.Delete(file);
}
if(args.Length>1)
{
 var realLibrary=new LocalLibrary(args[1]);
 var realCorpus=realLibrary.Load(realLibrary.List()[0].Key)!;
 Check(realLibrary.Search(realCorpus,"overfitting").Count>0,"Banco real retorna evidências sobre overfitting");
}
Console.WriteLine($"{checks} verificações concluídas; nenhuma chamada ao Gemini real.");
sealed class FakeHandler:HttpMessageHandler
{
 public HttpStatusCode Status=HttpStatusCode.OK; public string Body="{}";public int Calls; public int FailAt; public Func<string,string>? Reply; public List<string> Bodies=[];
 protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct){Calls++; var input=await request.Content!.ReadAsStringAsync(ct);Bodies.Add(input);return new HttpResponseMessage(Calls==FailAt?HttpStatusCode.TooManyRequests:Status){Content=new StringContent(Reply?.Invoke(input)??Body,Encoding.UTF8,"application/json")};}
}

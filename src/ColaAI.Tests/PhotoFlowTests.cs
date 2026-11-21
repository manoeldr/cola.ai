using System.Net;
using System.Text;
using System.Text.Json;
using ColaAI.Web.Models;
using ColaAI.Web.Services;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Options;

namespace ColaAI.Tests;
// Uses a real temporary SQLite file, and an entirely in-memory HTTP transport.
// No key, network request, quota or real exam is required.
public sealed class PhotoFlowTests:IDisposable
{
    private readonly string directory=Path.Combine(Path.GetTempPath(),"cola-photo-tests-"+Guid.NewGuid());
    private readonly LocalLibrary library;
    private readonly Corpus corpus;
    private readonly TestHandler handler=new();
    private readonly PhotoService photos;
    private readonly GeminiSummaryService gemini;
    private readonly HttpClient client;
    private static readonly byte[] Png=Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4WQAAAAASUVORK5CYII=");
    public PhotoFlowTests()
    {
        library=new LocalLibrary(Path.Combine(directory,"test.db"));
        corpus=LocalLibrary.Stable(new Corpus("IA",[new("original","Material.pdf",[new(1,"Overfitting: treino excelente e teste ruim. Underfitting: ambos ruins. Early stopping e dropout reduzem overfitting.",false),new(2,"Um perceptron simples não resolve XOR porque não é linearmente separável.",false)])],[],1,0,"nao-confirmada","course-test"));
        library.Save(corpus);client=new HttpClient(handler);
        gemini=new GeminiSummaryService(client,Options.Create(new GeminiOptions{ApiKey="fake-unit-test-key",FreeTierProjectConfirmed=true}));
        photos=new PhotoService(library,gemini);
    }
    private Task<PhotoSession> Read()=>photos.ReadAsync(corpus,"foto-teste.png",Png,default);
    [Fact]public async Task ReadingOnlyTranscribesAndSavesPhoto()
    {
        var photo=await Read();
        Assert.Equal(1,handler.Calls);Assert.Equal(2,photo.Transcription.Questions.Count);Assert.Null(photo.Result);
        var saved=library.LoadPhoto(photo.Id,photo.CourseKey)!;
        Assert.Equal(Png,saved.Image);Assert.Equal("image/png",saved.MimeType);
    }
    [Fact]public async Task ImageTransportIncludesCorrectMimeAndBytes()
    {
        await Read();using var request=JsonDocument.Parse(handler.Requests.Single());
        var inline=request.RootElement.GetProperty("contents")[0].GetProperty("parts")[1].GetProperty("inlineData");
        Assert.Equal("image/png",inline.GetProperty("mimeType").GetString());
        Assert.Equal(Png,Convert.FromBase64String(inline.GetProperty("data").GetString()!));
    }
    [Fact]public async Task UnsupportedImageDoesNotCallGemini()
    {await Assert.ThrowsAsync<InvalidDataException>(()=>photos.ReadAsync(corpus,"bad.svg",Encoding.UTF8.GetBytes("<svg/>"),default));Assert.Equal(0,handler.Calls);}
    [Fact]public async Task UnreadableResponseIsNotSavedOrSolved()
    {handler.Transcription=new(false,["Imagem ilegível"],[]);await Assert.ThrowsAsync<InvalidDataException>(Read);Assert.Empty(library.PhotoHistory(LocalLibrary.CourseKey(corpus)));Assert.Equal(1,handler.Calls);}
    [Fact]public async Task AnswersAllQuestionsWithExistingReferences()
    {
        var photo=await Read();photo=await photos.SolveAsync(corpus,photo,photo.Transcription,_=>{},default);
        Assert.Equal(2,photo.Result!.Answers.Count);
        Assert.All(photo.Result.Answers,a=>{Assert.Equal("concluido",a.Status);SummaryValidator.Validate(a.Answer!,corpus,false);});
    }
    [Fact]public async Task EditedTextIsSentInsteadOfOriginalOcrText()
    {
        var photo=await Read();var edited=photo.Transcription with{Questions=[new(1,"Explique o early stopping no overfitting.")]};
        photo=await photos.SolveAsync(corpus,photo,edited,_=>{},default);
        using var request=JsonDocument.Parse(handler.Requests.Last());
        using var input=JsonDocument.Parse(request.RootElement.GetProperty("contents")[0].GetProperty("parts")[0].GetProperty("text").GetString()!);
        Assert.Equal(edited.Questions[0].Text,input.RootElement.GetProperty("question").GetString());
        Assert.Equal(edited.Questions[0].Text,photo.Result!.Answers[0].Question);
    }
    [Fact]public async Task NoSourcesProducesNoInventedAnswerOrApiCall()
    {
        var photo=await Read();var before=handler.Calls;
        photo=await photos.SolveAsync(corpus,photo,photo.Transcription with{Questions=[new(1,"mitocondria cloroplasto")]},_=>{},default);
        Assert.Equal(before,handler.Calls);Assert.Equal("sem-fontes",photo.Result!.Answers.Single().Status);Assert.Null(photo.Result.Answers.Single().Answer);
    }
    [Fact]public async Task StopsOnQuotaAndPersistsCompletedAnswers()
    {
        var photo=await Read();handler.FailAt=3;
        await Assert.ThrowsAsync<InvalidOperationException>(()=>photos.SolveAsync(corpus,photo,photo.Transcription,_=>{},default));
        Assert.Equal(3,handler.Calls);Assert.Single(library.LoadPhoto(photo.Id,photo.CourseKey)!.Result!.Answers);
    }
    [Fact]public async Task ResumeDoesNotRepeatCompletedQuestion()
    {
        var photo=await Read();handler.FailAt=3;
        await Assert.ThrowsAsync<InvalidOperationException>(()=>photos.SolveAsync(corpus,photo,photo.Transcription,_=>{},default));
        photo=library.LoadPhoto(photo.Id,photo.CourseKey)!;handler.FailAt=0;var before=handler.Calls;
        photo=await photos.SolveAsync(corpus,photo,photo.Transcription,_=>{},default);
        Assert.Equal(before+1,handler.Calls);Assert.Equal(2,photo.Result!.Answers.Count);
    }
    [Fact]public async Task RepeatedSolveUsesSavedAnswers()
    {var photo=await Read();photo=await photos.SolveAsync(corpus,photo,photo.Transcription,_=>{},default);var before=handler.Calls;await photos.SolveAsync(corpus,photo,photo.Transcription,_=>{},default);Assert.Equal(before,handler.Calls);}
    [Fact]public async Task ChangedQuestionInvalidatesOnlyItsAnswer()
    {
        var photo=await Read();photo=await photos.SolveAsync(corpus,photo,photo.Transcription,_=>{},default);var before=handler.Calls;
        await photos.SolveAsync(corpus,photo,photo.Transcription with{Questions=[new(1,"Como reduzir overfitting usando dropout?"),photo.Transcription.Questions[1]]},_=>{},default);
        Assert.Equal(before+1,handler.Calls);
    }
    [Fact]public async Task FabricatedCitationIsRejectedAndNotSavedAsAnswer()
    {var photo=await Read();handler.InventPage=true;await Assert.ThrowsAsync<InvalidDataException>(()=>photos.SolveAsync(corpus,photo,photo.Transcription,_=>{},default));Assert.Empty(library.LoadPhoto(photo.Id,photo.CourseKey)!.Result!.Answers);}
    [Fact]public async Task CancelledSolveDoesNotSendQuestions()
    {var photo=await Read();using var cts=new CancellationTokenSource();cts.Cancel();var before=handler.Calls;await Assert.ThrowsAnyAsync<OperationCanceledException>(()=>photos.SolveAsync(corpus,photo,photo.Transcription,_=>{},cts.Token));Assert.Equal(before,handler.Calls);}
    [Fact]public async Task PhotoCannotBeOpenedOrSolvedUnderAnotherCourse()
    {
        var photo=await Read();var other=corpus with{SourceKey="other-course"};library.Save(other);
        Assert.Null(library.LoadPhoto(photo.Id,LocalLibrary.CourseKey(other)));
        await Assert.ThrowsAsync<InvalidDataException>(()=>photos.SolveAsync(other,photo,photo.Transcription,_=>{},default));
    }
    [Fact]public async Task StaleCorpusFailsClearlyBeforeSendingQuestion()
    {
        var photo=await Read();var updated=LocalLibrary.Stable(corpus with{Documents=[corpus.Documents[0] with{Pages=[new(1,"Texto atualizado sobre overfitting",false)]}]});library.Save(updated);
        var before=handler.Calls;var ex=await Assert.ThrowsAsync<InvalidDataException>(()=>photos.SolveAsync(corpus,photo,photo.Transcription,_=>{},default));Assert.Contains("acervo",ex.Message);Assert.Equal(before,handler.Calls);
    }
    [Fact]public async Task HistorySurvivesReopeningDatabase()
    {var photo=await Read();var reopened=new LocalLibrary(Path.Combine(directory,"test.db"));Assert.Single(reopened.PhotoHistory(photo.CourseKey));Assert.Equal(photo.Transcription.Questions.Count,reopened.LoadPhoto(photo.Id,photo.CourseKey)!.Transcription.Questions.Count);}
    public void Dispose(){client.Dispose();SqliteConnection.ClearAllPools();Directory.Delete(directory,true);}

    private sealed class TestHandler:HttpMessageHandler
    {
        public int Calls;public int FailAt;public bool InventPage;public List<string> Requests=[];
        public PhotoTranscription Transcription=new(true,[],[new(1,"Qual é a diferença entre overfitting e underfitting?"),new(2,"Por que um perceptron simples não resolve XOR?")]);
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct)
        {
            ct.ThrowIfCancellationRequested();Calls++;var body=await request.Content!.ReadAsStringAsync(ct);Requests.Add(body);
            if(Calls==FailAt)return new(HttpStatusCode.TooManyRequests){Content=new StringContent("{}")};
            using var parsed=JsonDocument.Parse(body);var parts=parsed.RootElement.GetProperty("contents")[0].GetProperty("parts");
            string answer;
            if(parts.EnumerateArray().Any(p=>p.TryGetProperty("inlineData",out _)))answer=JsonSerializer.Serialize(Transcription,CorpusReader.JsonOptions);
            else{
                using var input=JsonDocument.Parse(parts[0].GetProperty("text").GetString()!);
                var references=input.RootElement.GetProperty("excerpts").EnumerateArray().Select(x=>new Citation(x.GetProperty("documentId").GetString()!,InventPage?999:x.GetProperty("page").GetInt32())).Distinct().ToList();
                answer=JsonSerializer.Serialize(new GeneratedSummary("Resposta de teste",[new("Explicação","Texto simulado para validar o fluxo",references)]),CorpusReader.JsonOptions);
            }
            var output=JsonSerializer.Serialize(new{candidates=new[]{new{finishReason="STOP",content=new{parts=new[]{new{text=answer}}}}}});
            return new(HttpStatusCode.OK){Content=new StringContent(output,Encoding.UTF8,"application/json")};
        }
    }
}

using System.Threading.Channels;
using ColaAI.Web.Models;
using ColaAI.Web.Services;
namespace ColaAI.Web.Mobile;
public sealed record MobileDocument(string Id,string Name);
public sealed record MobileJobView(string Id,string CourseKey,string State,string Progress,string? Error,SummaryResult? Result,IReadOnlyList<MobileDocument> Documents);
public sealed class MobileSummaryJobs(IServiceScopeFactory scopes,IHostApplicationLifetime lifetime):BackgroundService
{
    private sealed class Job(string id,Corpus corpus)
    {
        public string Id=id; public Corpus Corpus=corpus;
        public string State="queued",Progress="Aguardando geração…";public string? Error;
        public SummaryResult? Result;public CancellationTokenSource Cancellation=new();
        public MobileJobView View()=>new(Id,LocalLibrary.CourseKey(Corpus),State,Progress,Error,Result,Corpus.Documents.Select(d=>new MobileDocument(d.Id,d.Name)).ToArray());
    }
    private readonly object gate=new();
    private readonly Dictionary<string,Job> jobs=[];
    private readonly Channel<Job> queue=Channel.CreateBounded<Job>(1);
    public MobileJobView Start(Corpus corpus)
    {
        lock(gate)
        {
            var active=jobs.Values.FirstOrDefault(j=>j.State is "queued" or "running");
            if(active is not null)
            {
                if(LocalLibrary.CourseKey(active.Corpus)==LocalLibrary.CourseKey(corpus)&&LocalLibrary.Fingerprint(active.Corpus)==LocalLibrary.Fingerprint(corpus))return active.View();
                throw new InvalidOperationException("Já existe um resumo em andamento. Aguarde ou cancele.");
            }
            while(jobs.Count>=32){var old=jobs.Values.First();jobs.Remove(old.Id);old.Cancellation.Dispose();}
            var job=new Job(Guid.NewGuid().ToString("N"),corpus);jobs.Add(job.Id,job);
            if(!queue.Writer.TryWrite(job)){jobs.Remove(job.Id);job.Cancellation.Dispose();throw new InvalidOperationException("A fila está ocupada. Aguarde.");}
            return job.View();
        }
    }
    public MobileJobView? Get(string id){lock(gate)return jobs.GetValueOrDefault(id)?.View();}
    public bool Cancel(string id){lock(gate){if(!jobs.TryGetValue(id,out var j))return false;if(j.State is "queued" or "running")j.Cancellation.Cancel();return true;}}
    public bool IsActive(string key){lock(gate)return jobs.Values.Any(j=>LocalLibrary.CourseKey(j.Corpus)==key&&j.State is "queued" or "running");}
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await foreach(var job in queue.Reader.ReadAllAsync(stoppingToken))
            {
                using var scope=scopes.CreateScope();using var linked=CancellationTokenSource.CreateLinkedTokenSource(job.Cancellation.Token,stoppingToken,lifetime.ApplicationStopping);
                lock(gate)job.State="running";
                try
                {
                    var service=scope.ServiceProvider.GetRequiredService<StudyService>();
                    var result=await service.SummarizeAsync(job.Corpus,msg=>{lock(gate)job.Progress=msg;},linked.Token);
                    lock(gate){job.Result=result;job.State="completed";job.Progress="Resumo salvo.";}
                }
                catch(OperationCanceledException){lock(gate){job.State="cancelled";job.Error="Geração cancelada ou tempo de resposta excedido. Resumos concluídos foram preservados.";}}
                catch(Exception e)
                {
                    var error=e switch {InvalidDataException or InvalidOperationException=>e.Message,HttpRequestException=>"Falha de conexão com o Gemini. Nenhuma nova tentativa foi feita.",_=>"Não foi possível gerar o resumo. Consulte o servidor."};
                    lock(gate){job.State="failed";job.Error=error;}
                }
            }
        }
        catch(OperationCanceledException)when(stoppingToken.IsCancellationRequested){}
    }
}

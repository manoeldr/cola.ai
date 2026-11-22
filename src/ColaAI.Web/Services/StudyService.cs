using ColaAI.Web.Models;
namespace ColaAI.Web.Services;
public sealed partial class StudyService(LocalLibrary library, GeminiSummaryService gemini)
{
    // Bump when prompts or extraction policy changes. Model is also part of every cache key.
    public const string PipelineVersion="hierarchical-v1";
    public const string ConsolidationVersion="coverage-supplements-v2";
    private static readonly SemaphoreSlim Gate=new(1,1);
    private string DocKey(Document doc)=>$"doc:{PipelineVersion}:{gemini.Model}:{doc.Id}";
    private string FinalKey(Corpus corpus)=>$"final:{ConsolidationVersion}:{PipelineVersion}:{gemini.Model}:{LocalLibrary.Hash(corpus.Title)}:{LocalLibrary.Fingerprint(corpus)}";
    public int CachedDocuments(Corpus corpus)=>corpus.Documents.Count(d=>library.Cached<GeneratedSummary>(DocKey(d)) is not null);
    public SummaryResult? SavedSummary(Corpus corpus)=>library.Cached<SummaryResult>(FinalKey(corpus)) is {} saved
        ? saved with {Warnings=corpus.Warnings}:null;
    public async Task<SummaryResult> SummarizeAsync(Corpus corpus,Action<string> progress,CancellationToken ct)
    {
        if(!await Gate.WaitAsync(0,ct))throw new InvalidOperationException("Já há um processamento de IA em andamento. Aguarde.");
        try
        {
            if(SavedSummary(corpus) is {} saved){SummaryValidator.Validate(saved.Summary,corpus);progress("Resumo geral recuperado, sem chamada à IA.");return saved;}
            var summaries=new List<GeneratedSummary>();int index=0;int totalTokens=0;
            foreach(var doc in corpus.Documents)
            {
                ct.ThrowIfCancellationRequested();index++;
                var summary=library.Cached<GeneratedSummary>(DocKey(doc));
                var single=corpus with {Documents=[doc]};
                if(summary is null)
                {
                    progress($"Material {index}/{corpus.Documents.Count}: resumindo {doc.Name}…");
                    var generated=await gemini.GenerateAsync(single,ct);summary=generated.Summary;totalTokens+=generated.TotalTokens??0;
                    library.Cache(DocKey(doc),summary);
                }
                else {SummaryValidator.Validate(summary,single);progress($"Material {index}/{corpus.Documents.Count}: resumo salvo reutilizado.");}
                summaries.Add(summary);
            }
            ct.ThrowIfCancellationRequested();progress("Consolidando todos os materiais…");
            var result=await gemini.ConsolidateAsync(corpus,summaries,ct);
            // Consolidation only sees summaries: reject references not present in those inputs.
            var allowed=summaries.SelectMany(s=>s.Sections).SelectMany(s=>s.References).Select(r=>(r.DocumentId,r.Page)).ToHashSet();
            if(result.Summary.Sections.SelectMany(s=>s.References).Any(r=>!allowed.Contains((r.DocumentId,r.Page))))
                throw new InvalidDataException("A síntese citou uma página ausente dos resumos recebidos. Resultado rejeitado.");
            result=CompleteCoverage(result,corpus,summaries);
            result=result with {TotalTokens=totalTokens+(result.TotalTokens??0)};
            library.Cache(FinalKey(corpus),result);progress("Resumo geral salvo localmente.");return result;
        }
        finally{Gate.Release();}
    }
    public static SummaryResult CompleteCoverage(SummaryResult synthesis, Corpus corpus, IReadOnlyList<GeneratedSummary> summaries)
    {
        // Never add decorative citations to generated prose. Copy the actual validated
        // individual summary and its original references into a clearly labelled supplement.
        var covered=synthesis.Summary.Sections.SelectMany(s=>s.References).Select(r=>r.DocumentId).ToHashSet();
        var missing=corpus.Documents.Where(d=>!covered.Contains(d.Id)).ToArray();
        var sections=synthesis.Summary.Sections.ToList();
        foreach(var doc in missing)
        {
            var original=summaries.Where(s=>s.Sections.Any(section=>section.References.Any(r=>r.DocumentId==doc.Id))).ToArray();
            if(original.Length!=1)throw new InvalidDataException($"Resumo individual ausente ou ambíguo: {doc.Name}.");
            SummaryValidator.Validate(original[0],corpus with{Documents=[doc]});
            foreach(var section in original[0].Sections)
                sections.Add(new SummarySection($"Complemento por material — {doc.Name}: {section.Title}",section.Text,section.References.ToList()));
        }
        var completed=synthesis with {Summary=synthesis.Summary with{Sections=sections},SupplementedDocuments=missing.Length};
        SummaryValidator.Validate(completed.Summary,corpus);
        return completed;
    }
    public async Task<SummaryResult> AskAsync(Corpus corpus,string question,CancellationToken ct)
    {
        var hits=library.Search(corpus,question);
        if(hits.Count==0)throw new InvalidDataException("Nenhum trecho encontrado. Tente termos presentes nos materiais.");
        var ids=hits.Select(h=>h.DocumentId).ToHashSet();
        var subset=corpus with {Documents=corpus.Documents.Where(d=>ids.Contains(d.Id)).Select(d=>d with {Pages=d.Pages.Where(p=>hits.Any(h=>h.DocumentId==d.Id&&h.Page==p.Page)).ToArray()}).ToArray()};
        return await gemini.AnswerAsync(subset,question,hits,ct);
    }
}

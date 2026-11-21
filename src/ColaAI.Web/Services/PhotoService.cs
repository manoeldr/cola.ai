using ColaAI.Web.Models;
namespace ColaAI.Web.Services;
public sealed class PhotoService(LocalLibrary library,GeminiSummaryService gemini)
{
    public async Task<PhotoSession> ReadAsync(Corpus corpus,string name,byte[] image,CancellationToken ct)
    {
        var mime=PhotoRules.DetectMime(image);
        var transcription=await gemini.TranscribeAsync(image,ct);
        var session=new PhotoSession(Guid.NewGuid().ToString("N"),LocalLibrary.CourseKey(corpus),name,mime,image,transcription,null,DateTimeOffset.UtcNow);
        library.SavePhoto(session);return session;
    }
    public async Task<PhotoSession> SolveAsync(Corpus corpus,PhotoSession session,PhotoTranscription edited,Action<string> progress,CancellationToken ct)
    {
        PhotoRules.Validate(edited);
        if(session.CourseKey!=LocalLibrary.CourseKey(corpus))throw new InvalidDataException("A foto pertence a outra disciplina.");
        var active=library.Load(session.CourseKey);
        if(active is null || LocalLibrary.Fingerprint(active)!=LocalLibrary.Fingerprint(corpus))
            throw new InvalidDataException("O acervo desta disciplina mudou. Reabra a disciplina antes de resolver a foto.");
        var fingerprint=LocalLibrary.Fingerprint(corpus);
        var answers=session.Result?.Model==gemini.Model&&session.Result.CorpusFingerprint==fingerprint?session.Result.Answers.ToList():new List<PhotoAnswer>();
        answers=answers.Where(a=>edited.Questions.Any(q=>q.Id==a.Id&&q.Text==a.Question)&&a.Status=="concluido").ToList();
        session=session with{Transcription=edited,Result=new PhotoResult(gemini.Model,fingerprint,answers)};
        library.SavePhoto(session);
        foreach(var question in edited.Questions)
        {
            ct.ThrowIfCancellationRequested();
            if(answers.Any(a=>a.Id==question.Id))continue;
            progress($"Resolvendo questão {question.Id}…");
            var hits=library.Search(corpus,question.Text);
            if(hits.Count==0)
                answers.Add(new(question.Id,question.Text,"sem-fontes",null,"Nenhum trecho encontrado para fundamentar esta questão. Nenhuma resposta foi inventada."));
            else
            {
                var ids=hits.Select(h=>h.DocumentId).ToHashSet();
                var subset=corpus with{Documents=corpus.Documents.Where(d=>ids.Contains(d.Id)).Select(d=>d with{Pages=d.Pages.Where(p=>hits.Any(h=>h.DocumentId==d.Id&&h.Page==p.Page)).ToArray()}).ToArray()};
                var result=await gemini.AnswerAsync(subset,question.Text,hits,ct);
                answers.Add(new(question.Id,question.Text,"concluido",result.Summary,null));
            }
            session=session with{Result=new PhotoResult(gemini.Model,fingerprint,answers.ToList())};
            library.UpdatePhotoResult(session.Id,session.Result);
        }
        return session;
    }
}

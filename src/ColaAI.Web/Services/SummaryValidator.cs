using ColaAI.Web.Models;
namespace ColaAI.Web.Services;
public static class SummaryValidator
{
    public static void Validate(GeneratedSummary summary, Corpus corpus, bool requireEveryDocument = true)
    {
        if (string.IsNullOrWhiteSpace(summary.Title) || summary.Sections is null || summary.Sections.Count == 0)
            throw new InvalidDataException("A IA retornou um resumo vazio ou incompleto.");
        var documents = corpus.Documents.ToDictionary(d => d.Id);
        var covered = new HashSet<string>();
        foreach (var section in summary.Sections)
        {
            if (section is null || string.IsNullOrWhiteSpace(section.Title) || string.IsNullOrWhiteSpace(section.Text)
                || section.References is null || section.References.Count == 0)
                throw new InvalidDataException("A IA retornou uma seção sem conteúdo ou sem fontes.");
            foreach (var reference in section.References)
            {
                if (reference is null || string.IsNullOrWhiteSpace(reference.DocumentId)
                    || !documents.TryGetValue(reference.DocumentId, out var doc)
                    || !doc.Pages.Any(p => p.Page == reference.Page && !string.IsNullOrWhiteSpace(p.Text)))
                    throw new InvalidDataException("A IA citou documento ou página inexistente/sem texto. O resultado foi rejeitado.");
                covered.Add(reference.DocumentId);
            }
        }
        var missing = documents.Keys.Except(covered).ToArray();
        if (requireEveryDocument && missing.Length > 0)
            throw new InvalidDataException($"O resumo não referenciou todos os materiais ({string.Join(", ", missing)}). Não foi aceito como resumo geral.");
    }
}

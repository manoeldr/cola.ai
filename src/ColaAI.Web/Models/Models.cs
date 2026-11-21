namespace ColaAI.Web.Models;

public sealed record Acervo(int SchemaVersion, string Source, Course Course, List<SourceFile> Files, string? Coverage);
public sealed record Course(string? Title, string? Url);
public sealed record SourceFile(string Name, string Status, string? SourcePage, string? Sha256,
    int? PageCount, List<SourcePage>? Pages, string? DuplicateOf);
public sealed record SourcePage(int Page, string Text, bool NeedsOcr);
public sealed record Document(string Id, string Name, IReadOnlyList<SourcePage> Pages);
public sealed record Corpus(string Title, IReadOnlyList<Document> Documents, IReadOnlyList<string> Warnings,
    int TotalFiles, int ExcludedFiles, string Coverage, string? SourceKey = null)
{
    public int PageCount => Documents.Sum(d => d.Pages.Count);
    public int CharacterCount => Documents.Sum(d => d.Pages.Sum(p => p.Text.Length));
}
public sealed record Citation(string DocumentId, int Page);
public sealed record SummarySection(string Title, string Text, List<Citation> References);
public sealed record GeneratedSummary(string Title, List<SummarySection> Sections);
public sealed record SummaryResult(GeneratedSummary Summary, string Model, DateTimeOffset CreatedAt,
    IReadOnlyList<string> Warnings, int DocumentCount, int PageCount, int CharacterCount, int? TotalTokens, int SupplementedDocuments = 0);

using System.Text.Json;
using ColaAI.Web.Models;

namespace ColaAI.Web.Services;
public sealed class CorpusReader
{
    public const int MaxUploadBytes = 20 * 1024 * 1024;
    public static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    public async Task<Corpus> ReadAsync(Stream stream, CancellationToken ct = default)
    {
        Acervo data;
        try { data = await JsonSerializer.DeserializeAsync<Acervo>(stream, JsonOptions, ct)
            ?? throw new InvalidDataException("JSON vazio."); }
        catch (JsonException) { throw new InvalidDataException("O arquivo não é um JSON de acervo válido."); }
        if (data.SchemaVersion != 1 || data.Source != "blackboard-batch" || data.Course is null || data.Files is null)
            throw new InvalidDataException("Selecione o acervo exportado pelo lote, não o diagnóstico da varredura.");
        if (data.Files.Count is < 1 or > 100) throw new InvalidDataException("O acervo deve conter de 1 a 100 arquivos.");
        var warnings = new List<string>();
        var docs = new List<Document>();
        var names = new HashSet<string>(StringComparer.Ordinal);
        var excluded = 0;
        for (var i = 0; i < data.Files.Count; i++)
        {
            var file = data.Files[i];
            if (file is null || string.IsNullOrWhiteSpace(file.Name)) throw new InvalidDataException("Arquivo sem nome no acervo.");
            if (file.Status == "duplicado")
            {
                var original = data.Files.FirstOrDefault(f => f is not null && f.SourcePage == file.DuplicateOf && f.Status == "concluido");
                if (original is null || string.IsNullOrWhiteSpace(file.Sha256) || original.Sha256 != file.Sha256)
                    throw new InvalidDataException($"Duplicata sem original válido: {file.Name}.");
                warnings.Add($"Conteúdo duplicado: {file.Name}; representado por {original.Name}.");
                continue;
            }
            if (file.Status != "concluido") { excluded++; warnings.Add($"Arquivo não processado: {file.Name}."); continue; }
            if (file.Pages is null || file.Pages.Count is < 1 or > 500 || file.PageCount != file.Pages.Count)
                throw new InvalidDataException($"Contagem de páginas inválida: {file.Name}.");
            if (file.Pages.Where((p, index) => p is null || p.Page != index + 1 || p.Text is null).Any())
                throw new InvalidDataException($"Texto ou numeração de páginas inválidos: {file.Name}.");
            if (!file.Pages.Any(p => !string.IsNullOrWhiteSpace(p.Text)))
            { excluded++; warnings.Add($"Arquivo sem texto extraível: {file.Name}. Precisa de OCR."); continue; }
            var empty = file.Pages.Count(p => p.NeedsOcr || string.IsNullOrWhiteSpace(p.Text));
            if (empty > 0) warnings.Add($"{file.Name}: {empty} página(s) com indicação de OCR ou sem texto.");
            if (!names.Add(file.Name)) warnings.Add($"Nome repetido no acervo: {file.Name}; use o identificador do documento para distinguir.");
            docs.Add(new Document($"D{i + 1:000}", file.Name, file.Pages));
        }
        if (docs.Count == 0) throw new InvalidDataException("Nenhum material com texto disponível.");
        warnings.Add("A cobertura total do Blackboard não foi comprovada. Avaliações e informações somente em imagens não estão garantidas neste acervo.");
        return new Corpus(data.Course.Title ?? "Disciplina", docs, warnings, data.Files.Count, excluded, data.Coverage ?? "nao-confirmada");
    }
}

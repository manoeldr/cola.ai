namespace ColaAI.Web.Models;
public sealed record PhotoQuestion(int Id, string Text);
public sealed record PhotoTranscription(bool Readable, List<string> Warnings, List<PhotoQuestion> Questions);
public sealed record PhotoAnswer(int Id, string Question, string Status, GeneratedSummary? Answer, string? Note);
public sealed record PhotoResult(string Model, string CorpusFingerprint, List<PhotoAnswer> Answers);
public sealed record PhotoSession(string Id, string CourseKey, string Name, string MimeType, byte[] Image,
    PhotoTranscription Transcription, PhotoResult? Result, DateTimeOffset CreatedAt);
public sealed record PhotoHistoryItem(string Id, string Name, DateTimeOffset CreatedAt);

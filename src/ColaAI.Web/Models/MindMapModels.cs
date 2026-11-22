namespace ColaAI.Web.Models;
public sealed record MindMapTopic(string Label,List<Citation> References,string Brief="",string Explanation="");
public sealed record MindMapTheme(string Label,List<MindMapTopic> Topics);
public sealed record GeneratedMindMap(string Title,List<MindMapTheme> Themes);
public sealed record MindMapResult(GeneratedMindMap Map,string CourseKey,string Model,DateTimeOffset CreatedAt,DateTimeOffset SummaryCreatedAt);

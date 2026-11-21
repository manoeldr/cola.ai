using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using ColaAI.Web.Models;
using Microsoft.Data.Sqlite;

namespace ColaAI.Web.Services;
public sealed record SavedCourse(string Key, string Title, DateTimeOffset UpdatedAt);
public sealed record SearchHit(string DocumentId, string Name, int Page, string Text);
public sealed class LocalLibrary
{
    private static readonly HashSet<string> SearchStopWords = new("a o as os um uma uns umas de do da dos das em no na nos nas e ou que qual quais como por para com sem ao aos pelo pela pelos pelas se esse essa isso este esta isto aquele aquela ser sao são é não nao tem ter sua seu suas seus sobre explique descreva assinale alternativa alternativas correta correto incorreta incorreto questão questao seguintes seguinte exemplo exemplos".Split(' '),StringComparer.OrdinalIgnoreCase);
    private readonly string connectionString;
    public LocalLibrary(string path)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path))!);
        connectionString = new SqliteConnectionStringBuilder { DataSource = path, DefaultTimeout = 10 }.ToString();
        using var db = Open();
        Execute(db, """
            CREATE TABLE IF NOT EXISTS courses (id TEXT PRIMARY KEY, title TEXT NOT NULL, corpus TEXT NOT NULL, fingerprint TEXT NOT NULL, updated TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, course TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, image BLOB NOT NULL, transcription TEXT NOT NULL, result TEXT, created TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS cache (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
            CREATE VIRTUAL TABLE IF NOT EXISTS chunks USING fts5(course UNINDEXED, document UNINDEXED, name UNINDEXED, page UNINDEXED, text, tokenize='unicode61 remove_diacritics 2');
            """);
    }
    public static string Hash(string value) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    public static string CourseKey(Corpus corpus) => Hash(corpus.SourceKey ?? corpus.Title);
    public static string Fingerprint(Corpus corpus) => Hash(string.Join("|", corpus.Documents.Select(d => d.Id).Order(StringComparer.Ordinal)));
    public static Corpus Stable(Corpus corpus) => corpus with { Documents = corpus.Documents.Select(d =>
        d with { Id = "D" + Hash(JsonSerializer.Serialize(new {d.Name, d.Pages}, CorpusReader.JsonOptions)) }).ToArray() };
    private SqliteConnection Open() { var db = new SqliteConnection(connectionString); db.Open(); return db; }
    private static void Execute(SqliteConnection db, string sql, params (string, object?)[] values)
    { using var cmd = db.CreateCommand(); cmd.CommandText = sql; foreach (var (k,v) in values) cmd.Parameters.AddWithValue(k,v ?? DBNull.Value); cmd.ExecuteNonQuery(); }
    public void Save(Corpus corpus)
    {
        var key = CourseKey(corpus); var fingerprint = Fingerprint(corpus);
        using var db = Open(); using var transaction = db.BeginTransaction();
        using var query = db.CreateCommand(); query.CommandText = "SELECT fingerprint FROM courses WHERE id=$id"; query.Parameters.AddWithValue("$id",key);
        var old = query.ExecuteScalar() as string;
        Execute(db, "INSERT INTO courses VALUES($id,$title,$corpus,$fingerprint,$time) ON CONFLICT(id) DO UPDATE SET title=excluded.title,corpus=excluded.corpus,fingerprint=excluded.fingerprint,updated=excluded.updated",
            ("$id",key),("$title",corpus.Title),("$corpus",JsonSerializer.Serialize(corpus,CorpusReader.JsonOptions)),("$fingerprint",fingerprint),("$time",DateTimeOffset.UtcNow.ToString("O")));
        if (old != fingerprint)
        {
            Execute(db,"DELETE FROM chunks WHERE course=$id",("$id",key));
            foreach (var document in corpus.Documents)
            foreach (var page in document.Pages)
            {
                for (var start=0; start<page.Text.Length; start+=1800)
                {
                    var text=page.Text.Substring(start,Math.Min(2000,page.Text.Length-start));
                    if (string.IsNullOrWhiteSpace(text)) continue;
                    Execute(db,"INSERT INTO chunks(course,document,name,page,text) VALUES($course,$doc,$name,$page,$text)",
                        ("$course",key),("$doc",document.Id),("$name",document.Name),("$page",page.Page),("$text",text));
                }
            }
        }
        transaction.Commit();
    }
    public IReadOnlyList<SavedCourse> List()
    {
        using var db=Open(); using var cmd=db.CreateCommand();cmd.CommandText="SELECT id,title,updated FROM courses ORDER BY updated DESC";
        using var reader=cmd.ExecuteReader();var result=new List<SavedCourse>();
        while(reader.Read())result.Add(new(reader.GetString(0),reader.GetString(1),DateTimeOffset.Parse(reader.GetString(2))));return result;
    }
    public Corpus? Load(string key)
    {
        using var db=Open();using var cmd=db.CreateCommand();cmd.CommandText="SELECT corpus FROM courses WHERE id=$id";cmd.Parameters.AddWithValue("$id",key);
        return cmd.ExecuteScalar() is string data ? JsonSerializer.Deserialize<Corpus>(data,CorpusReader.JsonOptions):null;
    }
    public IReadOnlyList<SearchHit> Search(Corpus corpus,string query,int limit=8)
    {
        var words=Regex.Matches(query, @"[\p{L}\p{N}]+").Select(m=>m.Value).Where(x=>x.Length>=2&&!SearchStopWords.Contains(x)).Select(x=>x.ToLowerInvariant()).Distinct().Take(24).ToArray();
        if(words.Length==0)return [];
        // Terms are quoted; SQL parameters alone do not escape the FTS query language.
        var match=string.Join(" OR ",words.Select(w=>"\""+w+"\""));
        using var db=Open();using var cmd=db.CreateCommand();
        cmd.CommandText="SELECT document,name,page,text FROM chunks WHERE chunks MATCH $query AND course=$course ORDER BY bm25(chunks) LIMIT $limit";
        cmd.Parameters.AddWithValue("$query",match);cmd.Parameters.AddWithValue("$course",CourseKey(corpus));cmd.Parameters.AddWithValue("$limit",Math.Clamp(limit,1,20));
        using var reader=cmd.ExecuteReader();var hits=new List<SearchHit>();
        while(reader.Read())hits.Add(new(reader.GetString(0),reader.GetString(1),reader.GetInt32(2),reader.GetString(3)));return hits;
    }
    public T? Cached<T>(string key)
    {
        using var db=Open();using var cmd=db.CreateCommand();cmd.CommandText="SELECT payload FROM cache WHERE id=$id";cmd.Parameters.AddWithValue("$id",key);
        return cmd.ExecuteScalar() is string data?JsonSerializer.Deserialize<T>(data,CorpusReader.JsonOptions):default;
    }
    public void Cache<T>(string key,T value)
    {using var db=Open();Execute(db,"INSERT INTO cache VALUES($id,$payload) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",("$id",key),("$payload",JsonSerializer.Serialize(value,CorpusReader.JsonOptions)));}
    public void SavePhoto(PhotoSession session)
    {
        using var db=Open();Execute(db,"INSERT INTO photos VALUES($id,$course,$name,$mime,$image,$transcription,$result,$created) ON CONFLICT(id) DO UPDATE SET transcription=excluded.transcription,result=excluded.result",
            ("$id",session.Id),("$course",session.CourseKey),("$name",session.Name),("$mime",session.MimeType),("$image",session.Image),
            ("$transcription",JsonSerializer.Serialize(session.Transcription,CorpusReader.JsonOptions)),("$result",session.Result is null?null:JsonSerializer.Serialize(session.Result,CorpusReader.JsonOptions)),("$created",session.CreatedAt.ToString("O")));
    }
    public void UpdatePhotoResult(string id,PhotoResult result)
    {using var db=Open();Execute(db,"UPDATE photos SET result=$result WHERE id=$id",("$id",id),("$result",JsonSerializer.Serialize(result,CorpusReader.JsonOptions)));}
    public IReadOnlyList<PhotoHistoryItem> PhotoHistory(string courseKey)
    {
        using var db=Open();using var cmd=db.CreateCommand();cmd.CommandText="SELECT id,name,created FROM photos WHERE course=$course ORDER BY created DESC LIMIT 30";cmd.Parameters.AddWithValue("$course",courseKey);
        using var r=cmd.ExecuteReader();var items=new List<PhotoHistoryItem>();while(r.Read())items.Add(new(r.GetString(0),r.GetString(1),DateTimeOffset.Parse(r.GetString(2))));return items;
    }
    public PhotoSession? LoadPhoto(string id,string courseKey)
    {
        using var db=Open();using var cmd=db.CreateCommand();cmd.CommandText="SELECT name,mime,image,transcription,result,created FROM photos WHERE id=$id AND course=$course";cmd.Parameters.AddWithValue("$id",id);cmd.Parameters.AddWithValue("$course",courseKey);
        using var r=cmd.ExecuteReader();if(!r.Read())return null;
        return new(id,courseKey,r.GetString(0),r.GetString(1),(byte[])r[2],JsonSerializer.Deserialize<PhotoTranscription>(r.GetString(3),CorpusReader.JsonOptions)!,r.IsDBNull(4)?null:JsonSerializer.Deserialize<PhotoResult>(r.GetString(4),CorpusReader.JsonOptions),DateTimeOffset.Parse(r.GetString(5)));
    }

}

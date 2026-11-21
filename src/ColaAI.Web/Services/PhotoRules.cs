using ColaAI.Web.Models;
namespace ColaAI.Web.Services;
public static class PhotoRules
{
    public const int MaxImageBytes=8*1024*1024;
    public static string DetectMime(byte[] bytes)
    {
        if(bytes.Length==0||bytes.Length>MaxImageBytes)throw new InvalidDataException("Selecione uma imagem de até 8 MB.");
        if(bytes.Length>=8 && bytes.AsSpan(0,8).SequenceEqual(new byte[]{137,80,78,71,13,10,26,10}))return "image/png";
        if(bytes.Length>=3 && bytes[0]==255&&bytes[1]==216&&bytes[2]==255)return "image/jpeg";
        if(bytes.Length>=12&&System.Text.Encoding.ASCII.GetString(bytes,0,4)=="RIFF"&&System.Text.Encoding.ASCII.GetString(bytes,8,4)=="WEBP")return "image/webp";
        throw new InvalidDataException("Formato não suportado. Use uma foto JPEG, PNG ou WebP; converta HEIC antes de enviar.");
    }
    public static void Validate(PhotoTranscription transcription)
    {
        if(transcription is null||transcription.Questions is null||transcription.Warnings is null)
            throw new InvalidDataException("A leitura da imagem retornou um formato inválido.");
        if(!transcription.Readable||transcription.Questions.Count==0)
            throw new InvalidDataException("Não foi possível ler questões com segurança. Envie uma foto mais nítida ou recortada.");
        if(transcription.Questions.Count>10)throw new InvalidDataException("A foto contém mais de dez questões. Divida em fotos menores; nenhuma questão será descartada silenciosamente.");
        if(transcription.Questions.Any(q=>q is null||q.Id<1||string.IsNullOrWhiteSpace(q.Text)||q.Text.Length>8000)
            ||transcription.Questions.Select(q=>q.Id).Distinct().Count()!=transcription.Questions.Count)
            throw new InvalidDataException("Confira os enunciados: IDs únicos e positivos, texto de até 8.000 caracteres por questão.");
    }
}

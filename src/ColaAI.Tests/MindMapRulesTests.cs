using ColaAI.Web.Models;
using ColaAI.Web.Services;
namespace ColaAI.Tests;
public sealed class MindMapRulesTests
{
    private static SummaryResult Source()=>new(new("Resumo",[new("Tema","Conteúdo validado",[new("D1",1)])]),"test",DateTimeOffset.UtcNow,[],1,1,100,null);
    private static GeneratedMindMap Map(string topic="Overfitting",Citation? citation=null)=>new("Inteligência Artificial",[new("Generalização",[new(topic,[citation??new("D1",1)])])]);
    [Fact]public void AcceptsShortLabelsAndSourceReferences()=>MindMapRules.Validate(Map(),Source());
    [Fact]public void RejectsParagraphInsteadOfTopic()=>Assert.Throws<InvalidDataException>(()=>MindMapRules.Validate(Map("Um texto explicativo com mais de seis palavras aqui"),Source()));
    [Fact]public void RejectsInventedReference()=>Assert.Throws<InvalidDataException>(()=>MindMapRules.Validate(Map(citation:new("D1",999)),Source()));
    [Fact]public void RejectsTooManyThemes()=>Assert.Throws<InvalidDataException>(()=>MindMapRules.Validate(new("IA",Enumerable.Range(1,9).Select(i=>new MindMapTheme("Tema "+i,[new("Conceito",[new("D1",1)])])).ToList()),Source()));
    [Fact]public void RejectsDuplicateThemes(){var m=Map();Assert.Throws<InvalidDataException>(()=>MindMapRules.Validate(m with{Themes=[..m.Themes,..m.Themes]},Source()));}
    [Fact]public void RejectsHtmlOrMultilineLabels()=>Assert.Throws<InvalidDataException>(()=>MindMapRules.Validate(Map("<script>"),Source()));
}

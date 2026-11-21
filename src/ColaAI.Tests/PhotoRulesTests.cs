using ColaAI.Web.Models;
using ColaAI.Web.Services;

namespace ColaAI.Tests;
public sealed class PhotoRulesTests
{
    [Theory]
    [InlineData("image/png",new byte[]{137,80,78,71,13,10,26,10})]
    [InlineData("image/jpeg",new byte[]{255,216,255,224})]
    [InlineData("image/webp",new byte[]{82,73,70,70,0,0,0,0,87,69,66,80})]
    public void DetectsSupportedSignatures(string expected,byte[] input)=>Assert.Equal(expected,PhotoRules.DetectMime(input));

    [Theory]
    [InlineData(0)]
    [InlineData(PhotoRules.MaxImageBytes+1)]
    public void RejectsEmptyOrOversizedImages(int size)=>Assert.Throws<InvalidDataException>(()=>PhotoRules.DetectMime(new byte[size]));

    [Theory]
    [InlineData("<svg>script</svg>")]
    [InlineData("%PDF-1.7")]
    [InlineData("not an image")]
    public void RejectsNonImageData(string text)=>Assert.Throws<InvalidDataException>(()=>PhotoRules.DetectMime(System.Text.Encoding.UTF8.GetBytes(text)));

    [Fact]public void AcceptsEditableTranscription()=>PhotoRules.Validate(new(true,[],[new(1,"Qual é a diferença entre overfitting e underfitting?"),new(2,"Por que XOR não é linearmente separável?")]));
    [Fact]public void RejectsUnreadablePhoto()=>Assert.Throws<InvalidDataException>(()=>PhotoRules.Validate(new(false,["Foto borrada"],[])));
    [Fact]public void RejectsEmptyQuestionList()=>Assert.Throws<InvalidDataException>(()=>PhotoRules.Validate(new(true,[],[])));
    [Fact]public void RejectsDuplicateIds()=>Assert.Throws<InvalidDataException>(()=>PhotoRules.Validate(new(true,[],[new(1,"A"),new(1,"B")])));
    [Fact]public void RejectsMoreThanTenQuestions()=>Assert.Throws<InvalidDataException>(()=>PhotoRules.Validate(new(true,[],Enumerable.Range(1,11).Select(i=>new PhotoQuestion(i,"Questão")).ToList())));
    [Theory]
    [InlineData(0,"Questão")]
    [InlineData(-1,"Questão")]
    [InlineData(1,"")]
    [InlineData(1,"  ")]
    public void RejectsInvalidQuestion(int id,string text)=>Assert.Throws<InvalidDataException>(()=>PhotoRules.Validate(new(true,[],[new(id,text)])));
    [Fact]public void RejectsOversizedQuestionWithoutTruncating()=>Assert.Throws<InvalidDataException>(()=>PhotoRules.Validate(new(true,[],[new(1,new string('a',8001))])));
}

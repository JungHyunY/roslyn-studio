namespace RoslynStudio.Models;

public class AiTransformResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string UpdatedXaml { get; set; } = string.Empty;
    public string UpdatedCSharp { get; set; } = string.Empty;
    public List<string> ChangesSummary { get; set; } = [];
}

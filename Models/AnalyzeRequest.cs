namespace RoslynStudio.Models;

public class AnalyzeRequest
{
    public string Code { get; set; } = string.Empty;
    public string? FilePath { get; set; }
}

namespace RoslynStudio.Models;

public class AnalyzeResponse
{
    public bool HasErrors { get; set; }
    public List<DiagnosticItem> Diagnostics { get; set; } = [];
}

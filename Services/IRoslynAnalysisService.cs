using RoslynStudio.Models;

namespace RoslynStudio.Services;

public interface IRoslynAnalysisService
{
    AnalyzeResponse AnalyzeCode(string code, string? filePath = null);
    AnalyzeResponse AnalyzeWorkspace(string workspaceRoot, string? currentFilePath = null, string? currentFileCode = null);
}

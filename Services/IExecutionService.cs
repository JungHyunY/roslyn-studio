using RoslynStudio.Models;

namespace RoslynStudio.Services;

public interface IExecutionService
{
    Task<ExecutionResult> ExecuteAsync(string command, string workingDirectory);
}

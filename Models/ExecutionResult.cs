namespace RoslynStudio.Models;

public class ExecutionResult
{
    public bool Success { get; set; }
    public int ExitCode { get; set; }
    public string Output { get; set; } = string.Empty;
    public long ElapsedMilliseconds { get; set; }
}

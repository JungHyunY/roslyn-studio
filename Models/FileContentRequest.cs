namespace RoslynStudio.Models;

public class FileContentRequest
{
    public string RelativePath { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
}

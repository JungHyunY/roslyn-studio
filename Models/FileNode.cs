namespace RoslynStudio.Models;

public class FileNode
{
    public string Name { get; set; } = string.Empty;
    public string RelativePath { get; set; } = string.Empty;
    public bool IsDirectory { get; set; }
    public List<FileNode> Children { get; set; } = [];
}

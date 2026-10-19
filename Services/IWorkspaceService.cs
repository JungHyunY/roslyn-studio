using RoslynStudio.Models;

namespace RoslynStudio.Services;

public interface IWorkspaceService
{
    string WorkspaceRoot { get; }
    void SetWorkspaceRoot(string path);
    FileNode GetWorkspaceTree();
    string ReadFile(string relativePath);
    void SaveFile(string relativePath, string content);
    void CreateFile(string relativePath);
    void DeleteFile(string relativePath);
}

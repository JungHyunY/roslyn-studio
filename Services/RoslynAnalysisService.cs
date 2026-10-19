using System.Reflection;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using RoslynStudio.Models;

namespace RoslynStudio.Services;

public class RoslynAnalysisService : IRoslynAnalysisService
{
    private readonly List<MetadataReference> _references = [];
    private readonly HashSet<string> _loadedAssemblyNames = new(StringComparer.OrdinalIgnoreCase);
    private readonly string _workspaceRoot;

    public RoslynAnalysisService(IWebHostEnvironment env)
    {
        _workspaceRoot = Path.Combine(env.ContentRootPath, "SampleProject");
        InitializeReferences();
    }

    private void InitializeReferences()
    {
        if (AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES") is string trustedAssemblies)
        {
            var paths = trustedAssemblies.Split(Path.PathSeparator);
            foreach (var path in paths)
            {
                AddReferenceFromFile(path, useMemoryImage: false);
            }
        }

        EnsureWorkspaceBinReferencesLoaded();
    }

    private void EnsureWorkspaceBinReferencesLoaded()
    {
        var binDir = Path.Combine(_workspaceRoot, "bin", "Debug", "net10.0");
        if (!Directory.Exists(binDir))
        {
            return;
        }

        foreach (var dllPath in Directory.EnumerateFiles(binDir, "*.dll", SearchOption.TopDirectoryOnly))
        {
            var fileName = Path.GetFileName(dllPath);
            // Skip project's own output assembly to avoid duplicate type definitions with source trees
            if (string.Equals(fileName, "SampleApp.dll", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (_loadedAssemblyNames.Contains(fileName))
            {
                continue;
            }

            // Load via memory image so we never lock files in SampleProject/bin during dotnet build
            AddReferenceFromFile(dllPath, useMemoryImage: true);
        }
    }

    private void AddReferenceFromFile(string path, bool useMemoryImage)
    {
        if (string.IsNullOrEmpty(path) || !File.Exists(path))
        {
            return;
        }

        var fileName = Path.GetFileName(path);
        if (_loadedAssemblyNames.Contains(fileName))
        {
            return;
        }

        try
        {
            if (useMemoryImage)
            {
                var bytes = File.ReadAllBytes(path);
                _references.Add(MetadataReference.CreateFromImage(bytes, filePath: path));
            }
            else
            {
                _references.Add(MetadataReference.CreateFromFile(path));
            }
            _loadedAssemblyNames.Add(fileName);
        }
        catch
        {
            // Ignore native or non-managed DLLs
        }
    }

    public AnalyzeResponse AnalyzeCode(string code, string? filePath = null)
    {
        return AnalyzeWorkspace(_workspaceRoot, filePath, code);
    }

    public AnalyzeResponse AnalyzeWorkspace(string workspaceRoot, string? currentFilePath = null, string? currentFileCode = null)
    {
        if (!Directory.Exists(workspaceRoot))
        {
            return new AnalyzeResponse { HasErrors = false, Diagnostics = [] };
        }

        EnsureWorkspaceBinReferencesLoaded();

        var excludedDirs = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".git", ".vs", "bin", "obj", ".idea", ".vscode" };
        var csFiles = Directory.EnumerateFiles(workspaceRoot, "*.cs", SearchOption.AllDirectories)
            .Where(f =>
            {
                var rel = Path.GetRelativePath(workspaceRoot, f);
                var parts = rel.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
                return !parts.Any(p => excludedDirs.Contains(p));
            })
            .ToList();

        var syntaxTrees = new List<SyntaxTree>();

        foreach (var file in csFiles)
        {
            var relPath = Path.GetRelativePath(workspaceRoot, file).Replace('\\', '/');
            string text;

            if (currentFilePath != null &&
                string.Equals(relPath, currentFilePath.Replace('\\', '/'), StringComparison.OrdinalIgnoreCase) &&
                currentFileCode != null)
            {
                text = currentFileCode;
            }
            else
            {
                try
                {
                    text = File.ReadAllText(file);
                }
                catch
                {
                    continue;
                }
            }

            syntaxTrees.Add(CSharpSyntaxTree.ParseText(text, path: relPath));
        }

        // Also include generated GlobalUsings.g.cs and Avalonia NameGenerator *.g.cs files from obj/
        var objDebugDir = Path.Combine(workspaceRoot, "obj", "Debug", "net10.0");
        if (Directory.Exists(objDebugDir))
        {
            var globalUsingsFile = Path.Combine(objDebugDir, "SampleApp.GlobalUsings.g.cs");
            if (File.Exists(globalUsingsFile))
            {
                try
                {
                    syntaxTrees.Add(CSharpSyntaxTree.ParseText(File.ReadAllText(globalUsingsFile), path: "__generated__/GlobalUsings.g.cs"));
                }
                catch { }
            }

            var generatedDir = Path.Combine(objDebugDir, "generated");
            if (Directory.Exists(generatedDir))
            {
                foreach (var genFile in Directory.EnumerateFiles(generatedDir, "*.g.cs", SearchOption.AllDirectories))
                {
                    try
                    {
                        syntaxTrees.Add(CSharpSyntaxTree.ParseText(File.ReadAllText(genFile), path: "__generated__/" + Path.GetFileName(genFile)));
                    }
                    catch { }
                }
            }
        }

        // Use WindowsApplication OutputKind so multiple or custom entry points don't conflict with WinExe settings
        var compilation = CSharpCompilation.Create("RoslynStudioWorkspaceAnalysis")
            .WithOptions(new CSharpCompilationOptions(OutputKind.WindowsApplication))
            .AddReferences(_references)
            .AddSyntaxTrees(syntaxTrees);

        var rawDiagnostics = compilation.GetDiagnostics();
        var diagnosticItems = new List<DiagnosticItem>();

        foreach (var diag in rawDiagnostics)
        {
            if (diag.Severity == DiagnosticSeverity.Hidden)
            {
                continue;
            }

            var lineSpan = diag.Location.GetMappedLineSpan();
            var diagPath = lineSpan.Path ?? string.Empty;

            // Skip compiler diagnostics inside auto-generated obj/ files
            if (diagPath.StartsWith("__generated__/", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            diagnosticItems.Add(new DiagnosticItem
            {
                Id = diag.Id,
                Message = diag.GetMessage(),
                Severity = diag.Severity switch
                {
                    DiagnosticSeverity.Error => "Error",
                    DiagnosticSeverity.Warning => "Warning",
                    DiagnosticSeverity.Info => "Info",
                    _ => "Info"
                },
                FilePath = string.IsNullOrEmpty(diagPath) ? "" : diagPath.Replace('\\', '/'),
                StartLine = lineSpan.StartLinePosition.Line + 1,
                StartColumn = lineSpan.StartLinePosition.Character + 1,
                EndLine = lineSpan.EndLinePosition.Line + 1,
                EndColumn = lineSpan.EndLinePosition.Character + 1
            });
        }

        return new AnalyzeResponse
        {
            HasErrors = diagnosticItems.Any(d => d.Severity == "Error"),
            Diagnostics = diagnosticItems
        };
    }
}

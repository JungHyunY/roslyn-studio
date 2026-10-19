using RoslynStudio.Models;

namespace RoslynStudio.Services;

public class WorkspaceService : IWorkspaceService
{
    private string _workspaceRoot;
    private static readonly HashSet<string> ExcludedDirectories = new(StringComparer.OrdinalIgnoreCase)
    {
        ".git", ".vs", "bin", "obj", ".idea", ".vscode"
    };

    public string WorkspaceRoot => _workspaceRoot;

    public WorkspaceService(IHostEnvironment environment)
    {
        // Default to a sample workspace or current content root
        _workspaceRoot = Path.Combine(environment.ContentRootPath, "SampleProject");
        EnsureSampleProject();
    }

    public void SetWorkspaceRoot(string path)
    {
        if (Directory.Exists(path))
        {
            _workspaceRoot = path;
        }
    }

    private void EnsureSampleProject()
    {
        if (!Directory.Exists(_workspaceRoot))
        {
            Directory.CreateDirectory(_workspaceRoot);

            var sampleCs = Path.Combine(_workspaceRoot, "Program.cs");
            if (!File.Exists(sampleCs))
            {
                File.WriteAllText(sampleCs, @"using System;
using Avalonia;

namespace SampleApp;

public class Program
{
    [STAThread]
    public static void Main(string[] args) => BuildAvaloniaApp()
        .StartWithClassicDesktopLifetime(args);

    public static AppBuilder BuildAvaloniaApp()
        => AppBuilder.Configure<App>()
            .UsePlatformDetect()
            .WithInterFont()
            .LogToTrace();
}
");
            }

            var sampleProj = Path.Combine(_workspaceRoot, "SampleApp.csproj");
            if (!File.Exists(sampleProj))
            {
                File.WriteAllText(sampleProj, @"<Project Sdk=""Microsoft.NET.Sdk"">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <BuiltInComInteropSupport>true</BuiltInComInteropSupport>
    <ApplicationManifest>app.manifest</ApplicationManifest>
    <AvaloniaUseCompiledBindingsByDefault>true</AvaloniaUseCompiledBindingsByDefault>
    <CopyLocalLockFileAssemblies>true</CopyLocalLockFileAssemblies>
    <EmitCompilerGeneratedFiles>true</EmitCompilerGeneratedFiles>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include=""Avalonia"" Version=""12.1.4"" />
    <PackageReference Include=""Avalonia.Desktop"" Version=""12.1.4"" />
    <PackageReference Include=""Avalonia.Themes.Fluent"" Version=""12.1.4"" />
    <PackageReference Include=""Avalonia.Fonts.Inter"" Version=""12.1.4"" />
  </ItemGroup>
</Project>
");
            }

            var sampleAppAxaml = Path.Combine(_workspaceRoot, "App.axaml");
            if (!File.Exists(sampleAppAxaml))
            {
                File.WriteAllText(sampleAppAxaml, @"<Application xmlns=""https://github.com/avaloniaui""
             xmlns:x=""http://schemas.microsoft.com/winfx/2006/xaml""
             x:Class=""SampleApp.App""
             RequestedThemeVariant=""Dark"">
    <Application.Styles>
        <FluentTheme />
    </Application.Styles>
</Application>
");
            }

            var sampleAppAxamlCs = Path.Combine(_workspaceRoot, "App.axaml.cs");
            if (!File.Exists(sampleAppAxamlCs))
            {
                File.WriteAllText(sampleAppAxamlCs, @"using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;

namespace SampleApp;

public partial class App : Application
{
    public override void Initialize()
    {
        AvaloniaXamlLoader.Load(this);
    }

    public override void OnFrameworkInitializationCompleted()
    {
        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            desktop.MainWindow = new MainWindow();
        }

        base.OnFrameworkInitializationCompleted();
    }
}
");
            }

            var sampleXaml = Path.Combine(_workspaceRoot, "MainWindow.axaml");
            if (!File.Exists(sampleXaml))
            {
                File.WriteAllText(sampleXaml, @"<Window xmlns=""https://github.com/avaloniaui""
        xmlns:x=""http://schemas.microsoft.com/winfx/2006/xaml""
        x:Class=""SampleApp.MainWindow""
        Title=""RoslynStudio Avalonia 미리보기 대시보드"" Height=""460"" Width=""520""
        Background=""#0f172a"">
    <Grid Margin=""20"">
        <Grid.RowDefinitions>
            <RowDefinition Height=""Auto""/>
            <RowDefinition Height=""*""/>
            <RowDefinition Height=""Auto""/>
        </Grid.RowDefinitions>

        <Border Grid.Row=""0"" Background=""#1e293b"" CornerRadius=""8"" Padding=""16"" Margin=""0,0,0,16"" BorderBrush=""#334155"" BorderThickness=""1"">
            <StackPanel Orientation=""Vertical"">
                <TextBlock Text=""⚡ Avalonia UI 실시간 비주얼 디자이너"" FontSize=""16"" FontWeight=""Bold"" Foreground=""#38bdf8"" Margin=""0,0,0,4""/>
                <TextBlock Text=""AXAML 코드를 수정하면 실시간으로 오른쪽 미리보기가 핫 리로드됩니다."" FontSize=""12"" Foreground=""#94a3b8""/>
            </StackPanel>
        </Border>

        <Border Grid.Row=""1"" Background=""#1e293b"" CornerRadius=""8"" Padding=""16"" BorderBrush=""#334155"" BorderThickness=""1"">
            <StackPanel Orientation=""Vertical"">
                <TextBlock Text=""사용자 설정"" FontSize=""14"" FontWeight=""SemiBold"" Foreground=""#f8fafc"" Margin=""0,0,0,12""/>
                <TextBlock Text=""프로젝트 이름"" FontSize=""12"" Foreground=""#94a3b8"" Margin=""0,0,0,4""/>
                <TextBox Text=""RoslynStudio.Avalonia"" Height=""36"" Padding=""8"" Background=""#0f172a"" Foreground=""#f8fafc"" BorderBrush=""#475569"" CornerRadius=""6"" Margin=""0,0,0,12""/>
                <TextBlock Text=""빌드 진행률 (75%)"" FontSize=""12"" Foreground=""#94a3b8"" Margin=""0,0,0,4""/>
                <ProgressBar Value=""75"" Height=""10"" Margin=""0,0,0,14"" Background=""#334155"" Foreground=""#0ea5e9""/>
                <CheckBox Content=""AOT 네이티브 컴파일 활성화"" IsChecked=""True"" Foreground=""#cbd5e1"" Margin=""0,0,0,8""/>
                <CheckBox Content=""실시간 Roslyn 진단 자동 동기화"" IsChecked=""True"" Foreground=""#cbd5e1"" Margin=""0,0,0,8""/>
            </StackPanel>
        </Border>

        <StackPanel Grid.Row=""2"" Orientation=""Horizontal"" HorizontalAlignment=""Right"" Margin=""0,16,0,0"">
            <Button Content=""취소"" Width=""80"" Height=""34"" Margin=""0,0,8,0"" Background=""#334155"" Foreground=""#cbd5e1"" CornerRadius=""6""/>
            <Button Content=""설정 저장"" Width=""100"" Height=""34"" Background=""#0284c7"" Foreground=""#ffffff"" FontWeight=""Bold"" CornerRadius=""6""/>
        </StackPanel>
    </Grid>
</Window>
");
            }

            var sampleXamlCs = Path.Combine(_workspaceRoot, "MainWindow.axaml.cs");
            if (!File.Exists(sampleXamlCs))
            {
                File.WriteAllText(sampleXamlCs, @"using Avalonia.Controls;

namespace SampleApp;

/// <summary>
/// MainWindow.axaml에 대한 상호 작용 논리 (Code-Behind)
/// </summary>
public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }
}
");
            }
        }
    }

    public FileNode GetWorkspaceTree()
    {
        return BuildNode(_workspaceRoot, string.Empty);
    }

    private FileNode BuildNode(string fullPath, string relativePath)
    {
        var dirInfo = new DirectoryInfo(fullPath);
        var node = new FileNode
        {
            Name = string.IsNullOrEmpty(relativePath) ? dirInfo.Name : Path.GetFileName(fullPath),
            RelativePath = relativePath,
            IsDirectory = true,
            Children = []
        };

        try
        {
            foreach (var dir in dirInfo.GetDirectories().OrderBy(d => d.Name))
            {
                if (ExcludedDirectories.Contains(dir.Name))
                {
                    continue;
                }

                var childRel = string.IsNullOrEmpty(relativePath) ? dir.Name : Path.Combine(relativePath, dir.Name);
                node.Children.Add(BuildNode(dir.FullName, childRel));
            }

            var allFiles = dirInfo.GetFiles().OrderBy(f => f.Name).ToList();
            var xamlCodeBehindNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            // Group *.xaml.cs / *.axaml.cs under their parent *.xaml / *.axaml file (Visual Studio Solution Explorer structure)
            foreach (var f in allFiles)
            {
                if (f.Name.EndsWith(".xaml.cs", StringComparison.OrdinalIgnoreCase) ||
                    f.Name.EndsWith(".axaml.cs", StringComparison.OrdinalIgnoreCase))
                {
                    var parentXamlName = f.Name[..^3];
                    if (allFiles.Any(x => string.Equals(x.Name, parentXamlName, StringComparison.OrdinalIgnoreCase)))
                    {
                        xamlCodeBehindNames.Add(f.Name);
                    }
                }
            }

            foreach (var file in allFiles)
            {
                if (xamlCodeBehindNames.Contains(file.Name))
                {
                    continue;
                }

                var childRel = string.IsNullOrEmpty(relativePath) ? file.Name : Path.Combine(relativePath, file.Name);
                var fileNode = new FileNode
                {
                    Name = file.Name,
                    RelativePath = childRel,
                    IsDirectory = false,
                    Children = []
                };

                if (file.Name.EndsWith(".xaml", StringComparison.OrdinalIgnoreCase) ||
                    file.Name.EndsWith(".axaml", StringComparison.OrdinalIgnoreCase))
                {
                    var cbName = file.Name + ".cs";
                    var cbFile = allFiles.FirstOrDefault(x => string.Equals(x.Name, cbName, StringComparison.OrdinalIgnoreCase));
                    if (cbFile != null)
                    {
                        var cbRel = string.IsNullOrEmpty(relativePath) ? cbFile.Name : Path.Combine(relativePath, cbFile.Name);
                        fileNode.Children.Add(new FileNode
                        {
                            Name = cbFile.Name,
                            RelativePath = cbRel,
                            IsDirectory = false,
                            Children = []
                        });
                    }
                }

                node.Children.Add(fileNode);
            }
        }
        catch
        {
            // Ignore permission issues for specific directories
        }

        return node;
    }

    public string ReadFile(string relativePath)
    {
        var fullPath = Path.Combine(_workspaceRoot, relativePath);
        if (!File.Exists(fullPath))
        {
            throw new FileNotFoundException($"File not found: {relativePath}");
        }

        return File.ReadAllText(fullPath);
    }

    public void SaveFile(string relativePath, string content)
    {
        var fullPath = Path.Combine(_workspaceRoot, relativePath);
        var directory = Path.GetDirectoryName(fullPath);
        if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
        }

        File.WriteAllText(fullPath, content);
    }

    public void CreateFile(string relativePath)
    {
        var fullPath = Path.Combine(_workspaceRoot, relativePath);
        var directory = Path.GetDirectoryName(fullPath);
        if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
        }

        bool isXaml = relativePath.EndsWith(".xaml", StringComparison.OrdinalIgnoreCase) ||
                      relativePath.EndsWith(".axaml", StringComparison.OrdinalIgnoreCase);

        if (!File.Exists(fullPath))
        {
            if (isXaml)
            {
                var className = Path.GetFileNameWithoutExtension(relativePath);
                var xamlTemplate = $@"<Window xmlns=""https://github.com/avaloniaui""
        xmlns:x=""http://schemas.microsoft.com/winfx/2006/xaml""
        xmlns:d=""http://schemas.microsoft.com/expression/blend/2008""
        xmlns:mc=""http://schemas.openxmlformats.org/markup-compatibility/2006""
        x:Class=""SampleApp.{className}""
        Title=""{className}"" Height=""420"" Width=""500""
        Background=""#0f172a"">
    <Grid Margin=""20"">
        <Grid.RowDefinitions>
            <RowDefinition Height=""Auto""/>
            <RowDefinition Height=""*""/>
        </Grid.RowDefinitions>

        <Border Grid.Row=""0"" Background=""#1e293b"" CornerRadius=""8"" Padding=""14"" Margin=""0,0,0,14"" BorderBrush=""#334155"" BorderThickness=""1"">
            <StackPanel Orientation=""Vertical"">
                <TextBlock Text=""⚡ {className}"" FontSize=""16"" FontWeight=""Bold"" Foreground=""#38bdf8""/>
                <TextBlock Text=""{className} 뷰 및 Avalonia 코드 비하인드가 연동됩니다."" FontSize=""12"" Foreground=""#94a3b8"" Margin=""0,4,0,0""/>
            </StackPanel>
        </Border>

        <Border Grid.Row=""1"" Background=""#1e293b"" CornerRadius=""8"" Padding=""16"" BorderBrush=""#334155"" BorderThickness=""1"">
            <StackPanel Orientation=""Vertical"">
                <TextBlock Text=""컴포넌트 영역"" FontSize=""14"" FontWeight=""SemiBold"" Foreground=""#f8fafc"" Margin=""0,0,0,10""/>
                <Button Content=""클릭 이벤트 테스트"" Height=""34"" Background=""#0284c7"" Foreground=""#ffffff"" CornerRadius=""6""/>
            </StackPanel>
        </Border>
    </Grid>
</Window>
";
                File.WriteAllText(fullPath, xamlTemplate);
            }
            else
            {
                File.WriteAllText(fullPath, string.Empty);
            }
        }

        // When creating a XAML / AXAML file, automatically generate the matching code-behind file
        if (isXaml)
        {
            var codeBehindPath = fullPath + ".cs";
            if (!File.Exists(codeBehindPath))
            {
                var className = Path.GetFileNameWithoutExtension(relativePath);
                var codeBehindTemplate = $@"using Avalonia.Controls;

namespace SampleApp;

/// <summary>
/// {className}에 대한 상호 작용 논리 (Avalonia Code-Behind)
/// </summary>
public partial class {className} : Window
{{
    public {className}()
    {{
        InitializeComponent();
    }}
}}
";
                File.WriteAllText(codeBehindPath, codeBehindTemplate);
            }
        }
    }

    public void DeleteFile(string relativePath)
    {
        var fullPath = Path.Combine(_workspaceRoot, relativePath);
        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);

            // If deleting a .xaml or .axaml file, also clean up its matching code-behind
            if (relativePath.EndsWith(".xaml", StringComparison.OrdinalIgnoreCase) ||
                relativePath.EndsWith(".axaml", StringComparison.OrdinalIgnoreCase))
            {
                var codeBehindPath = fullPath + ".cs";
                if (File.Exists(codeBehindPath))
                {
                    File.Delete(codeBehindPath);
                }
            }
        }
        else if (Directory.Exists(fullPath))
        {
            Directory.Delete(fullPath, recursive: true);
        }
    }
}

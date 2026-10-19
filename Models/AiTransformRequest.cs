namespace RoslynStudio.Models;

public class AiTransformRequest
{
    public string Intent { get; set; } = string.Empty;
    public string? TargetTag { get; set; }
    public int? TargetLine { get; set; }
    public string XamlContent { get; set; } = string.Empty;
    public string CSharpContent { get; set; } = string.Empty;
    public string XamlFilePath { get; set; } = "MainWindow.xaml";
}

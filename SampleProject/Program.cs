using System;
using Avalonia;

namespace SampleApp;

public class Program
{
    // Avalonia desktop entry point
    [STAThread]
    public static void Main(string[] args)
    {
        Console.WriteLine("⚡ Avalonia UI Desktop Application 시작...");
        BuildAvaloniaApp().StartWithClassicDesktopLifetime(args);
    }

    public static AppBuilder BuildAvaloniaApp()
        => AppBuilder.Configure<App>()
            .UsePlatformDetect()
            .WithInterFont()
            .LogToTrace();
}

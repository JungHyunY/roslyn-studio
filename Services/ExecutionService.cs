using System.Diagnostics;
using System.Text;
using RoslynStudio.Models;

namespace RoslynStudio.Services;

public class ExecutionService : IExecutionService
{
    private Process? _runningGuiProcess;
    private readonly object _processLock = new();

    public async Task<ExecutionResult> ExecuteAsync(string command, string workingDirectory)
    {
        if (string.Equals(command, "run", StringComparison.OrdinalIgnoreCase))
        {
            return await ExecuteDesktopRunAsync(workingDirectory);
        }

        return await RunDotnetCommandAsync(command, workingDirectory, createNoWindow: true, timeoutSeconds: 30);
    }

    private void StopPreviousGuiProcess()
    {
        lock (_processLock)
        {
            if (_runningGuiProcess != null)
            {
                try
                {
                    if (!_runningGuiProcess.HasExited)
                    {
                        _runningGuiProcess.Kill(entireProcessTree: true);
                        _runningGuiProcess.WaitForExit(1500);
                    }
                }
                catch
                {
                    // Ignore if already exited
                }
                finally
                {
                    _runningGuiProcess.Dispose();
                    _runningGuiProcess = null;
                }
            }
        }
    }

    private async Task<ExecutionResult> ExecuteDesktopRunAsync(string workingDirectory)
    {
        var totalSw = Stopwatch.StartNew();

        // 1. Stop any previously running GUI instance so bin/ files are not locked
        StopPreviousGuiProcess();

        // 2. Build the project first
        var buildResult = await RunDotnetCommandAsync("build", workingDirectory, createNoWindow: true, timeoutSeconds: 30);
        if (!buildResult.Success)
        {
            return buildResult;
        }

        // 3. Launch the compiled Avalonia desktop executable non-blockingly
        var exePath = Path.Combine(workingDirectory, "bin", "Debug", "net10.0", "SampleApp.exe");
        var dllPath = Path.Combine(workingDirectory, "bin", "Debug", "net10.0", "SampleApp.dll");
        var dotnetPath = GetDotnetPath();

        var psi = new ProcessStartInfo
        {
            FileName = File.Exists(exePath) ? exePath : dotnetPath,
            Arguments = File.Exists(exePath) ? "" : $"\"{dllPath}\"",
            WorkingDirectory = workingDirectory,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = false
        };

        ConfigureDotnetEnv(psi, dotnetPath);

        var outputBuilder = new StringBuilder();
        outputBuilder.AppendLine(buildResult.Output.TrimEnd());

        try
        {
            var process = new Process { StartInfo = psi };
            process.OutputDataReceived += (_, args) =>
            {
                if (args.Data != null) outputBuilder.AppendLine(args.Data);
            };
            process.ErrorDataReceived += (_, args) =>
            {
                if (args.Data != null) outputBuilder.AppendLine(args.Data);
            };

            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();

            lock (_processLock)
            {
                _runningGuiProcess = process;
            }

            // Wait briefly (1.2s) to ensure the GUI window initializes without immediate startup exception
            await Task.Delay(1200);
            totalSw.Stop();

            if (process.HasExited && process.ExitCode != 0)
            {
                return new ExecutionResult
                {
                    Success = false,
                    ExitCode = process.ExitCode,
                    Output = outputBuilder.ToString(),
                    ElapsedMilliseconds = totalSw.ElapsedMilliseconds
                };
            }

            outputBuilder.AppendLine($"\n⚡ Avalonia 데스크톱 GUI 애플리케이션(PID: {process.Id})이 정상 실행되었습니다.");
            return new ExecutionResult
            {
                Success = true,
                ExitCode = 0,
                Output = outputBuilder.ToString(),
                ElapsedMilliseconds = totalSw.ElapsedMilliseconds
            };
        }
        catch (Exception ex)
        {
            totalSw.Stop();
            return new ExecutionResult
            {
                Success = false,
                ExitCode = -1,
                Output = outputBuilder + $"\nExecution failed: {ex.Message}",
                ElapsedMilliseconds = totalSw.ElapsedMilliseconds
            };
        }
    }

    private static string GetDotnetPath()
    {
        var dotnetPath = @"D:\projects\.dotnet\dotnet.exe";
        return File.Exists(dotnetPath) ? dotnetPath : "dotnet";
    }

    private static void ConfigureDotnetEnv(ProcessStartInfo psi, string dotnetPath)
    {
        if (File.Exists(dotnetPath))
        {
            psi.Environment["DOTNET_ROOT"] = @"D:\projects\.dotnet";
            psi.Environment["PATH"] = @"D:\projects\.dotnet;" + Environment.GetEnvironmentVariable("PATH");
        }
    }

    private static async Task<ExecutionResult> RunDotnetCommandAsync(string command, string workingDirectory, bool createNoWindow, int timeoutSeconds)
    {
        var stopwatch = Stopwatch.StartNew();
        var outputBuilder = new StringBuilder();
        var dotnetPath = GetDotnetPath();

        var processStartInfo = new ProcessStartInfo
        {
            FileName = dotnetPath,
            Arguments = command,
            WorkingDirectory = workingDirectory,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = createNoWindow
        };

        ConfigureDotnetEnv(processStartInfo, dotnetPath);

        using var process = new Process { StartInfo = processStartInfo };

        process.OutputDataReceived += (_, args) =>
        {
            if (args.Data != null) outputBuilder.AppendLine(args.Data);
        };

        process.ErrorDataReceived += (_, args) =>
        {
            if (args.Data != null) outputBuilder.AppendLine(args.Data);
        };

        try
        {
            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSeconds));
            await process.WaitForExitAsync(cts.Token);
            stopwatch.Stop();

            return new ExecutionResult
            {
                Success = process.ExitCode == 0,
                ExitCode = process.ExitCode,
                Output = outputBuilder.ToString(),
                ElapsedMilliseconds = stopwatch.ElapsedMilliseconds
            };
        }
        catch (OperationCanceledException)
        {
            try
            {
                process.Kill(entireProcessTree: true);
            }
            catch { }

            return new ExecutionResult
            {
                Success = false,
                ExitCode = -1,
                Output = outputBuilder + $"\n[Process timed out after {timeoutSeconds} seconds]",
                ElapsedMilliseconds = stopwatch.ElapsedMilliseconds
            };
        }
        catch (Exception ex)
        {
            return new ExecutionResult
            {
                Success = false,
                ExitCode = -1,
                Output = $"Execution failed: {ex.Message}",
                ElapsedMilliseconds = stopwatch.ElapsedMilliseconds
            };
        }
    }
}

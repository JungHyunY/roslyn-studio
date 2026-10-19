using RoslynStudio.Models;
using RoslynStudio.Services;

var builder = WebApplication.CreateBuilder(args);

// Register services
builder.Services.AddSingleton<IRoslynAnalysisService, RoslynAnalysisService>();
builder.Services.AddSingleton<IWorkspaceService, WorkspaceService>();
builder.Services.AddSingleton<IExecutionService, ExecutionService>();
builder.Services.AddSingleton<IAiAssistantService, AiAssistantService>();

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

// Workspace APIs
app.MapGet("/api/workspace/tree", (IWorkspaceService workspace) =>
{
    var tree = workspace.GetWorkspaceTree();
    return Results.Ok(new { root = workspace.WorkspaceRoot, tree });
});

app.MapGet("/api/workspace/file", (string path, IWorkspaceService workspace) =>
{
    try
    {
        var content = workspace.ReadFile(path);
        return Results.Ok(new { path, content });
    }
    catch (FileNotFoundException)
    {
        return Results.NotFound(new { message = $"File '{path}' not found." });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
});

app.MapPost("/api/workspace/file", (FileContentRequest request, IWorkspaceService workspace) =>
{
    try
    {
        workspace.SaveFile(request.RelativePath, request.Content);
        return Results.Ok(new { success = true });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
});

app.MapPost("/api/workspace/create", (FileContentRequest request, IWorkspaceService workspace) =>
{
    try
    {
        workspace.CreateFile(request.RelativePath);
        return Results.Ok(new { success = true });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
});

app.MapDelete("/api/workspace/file", (string path, IWorkspaceService workspace) =>
{
    try
    {
        workspace.DeleteFile(path);
        return Results.Ok(new { success = true });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
});

// Roslyn Analysis API
app.MapPost("/api/roslyn/analyze", (AnalyzeRequest request, IRoslynAnalysisService roslyn) =>
{
    var result = roslyn.AnalyzeCode(request.Code, request.FilePath);
    return Results.Ok(result);
});

app.MapPost("/api/roslyn/analyze-workspace", (AnalyzeWorkspaceRequest request, IRoslynAnalysisService roslyn, IWorkspaceService workspace) =>
{
    var result = roslyn.AnalyzeWorkspace(workspace.WorkspaceRoot, request.CurrentFilePath, request.CurrentFileCode);
    return Results.Ok(result);
});

// Execution APIs
app.MapPost("/api/execute/build", async (IExecutionService execution, IWorkspaceService workspace) =>
{
    var result = await execution.ExecuteAsync("build", workspace.WorkspaceRoot);
    return Results.Ok(result);
});

app.MapPost("/api/execute/run", async (IExecutionService execution, IWorkspaceService workspace) =>
{
    var result = await execution.ExecuteAsync("run", workspace.WorkspaceRoot);
    return Results.Ok(result);
});

// AI Transformation API
app.MapPost("/api/ai/transform", (AiTransformRequest request, IAiAssistantService ai) =>
{
    var result = ai.TransformFeature(request);
    return Results.Ok(result);
});

app.Run();

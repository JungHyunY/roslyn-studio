using RoslynStudio.Models;

namespace RoslynStudio.Services;

public interface IAiAssistantService
{
    AiTransformResponse TransformFeature(AiTransformRequest request);
}

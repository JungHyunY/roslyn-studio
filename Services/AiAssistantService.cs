using System.Text.RegularExpressions;
using RoslynStudio.Models;

namespace RoslynStudio.Services;

public class AiAssistantService : IAiAssistantService
{
    public AiTransformResponse TransformFeature(AiTransformRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Intent))
        {
            return new AiTransformResponse
            {
                Success = false,
                Message = "지시할 의도(Intent)가 비어 있습니다.",
                UpdatedXaml = request.XamlContent,
                UpdatedCSharp = request.CSharpContent
            };
        }

        var intent = request.Intent.Trim();
        var xaml = request.XamlContent;
        var csharp = request.CSharpContent;
        var summary = new List<string>();

        // 1. Element-specific directive (Visual Inspector Prompting)
        if (!string.IsNullOrEmpty(request.TargetTag))
        {
            return HandleElementDirective(intent, request.TargetTag, request.TargetLine, xaml, csharp);
        }

        // 2. Global Canvas Feature Directives
        return HandleGlobalDirective(intent, xaml, csharp);
    }

    private static string ReplaceTagOnTargetLine(string xaml, string tag, int? targetLine, Func<string, string> tagTransformer)
    {
        var lines = xaml.Split('\n');
        var tagPattern = new Regex($@"<{tag}\b[^>]*?(\s*/?>)", RegexOptions.IgnoreCase);

        if (targetLine.HasValue && targetLine.Value >= 1 && targetLine.Value <= lines.Length)
        {
            var idx = targetLine.Value - 1;
            if (tagPattern.IsMatch(lines[idx]))
            {
                lines[idx] = tagPattern.Replace(lines[idx], m => tagTransformer(m.Value), 1);
                return string.Join("\n", lines);
            }
        }

        if (tagPattern.IsMatch(xaml))
        {
            return tagPattern.Replace(xaml, m => tagTransformer(m.Value), 1);
        }

        return xaml;
    }

    private static string SetOrUpdateXmlAttributes(string openTagText, Dictionary<string, string> attributes)
    {
        var updated = openTagText;
        foreach (var kvp in attributes)
        {
            var attrRegex = new Regex($@"\s+{Regex.Escape(kvp.Key)}\s*=\s*""[^""]*""", RegexOptions.IgnoreCase);
            updated = attrRegex.Replace(updated, "");
        }

        var closeMatch = Regex.Match(updated, @"\s*/?>$");
        if (!closeMatch.Success)
        {
            return updated;
        }

        var prefix = updated[..closeMatch.Index];
        var suffix = closeMatch.Value;
        var attrString = string.Join("", attributes.Select(kv => $" {kv.Key}=\"{kv.Value}\""));
        return $"{prefix}{attrString}{suffix}";
    }

    private static string EnsureCSharpUsings(string csharp, params string[] namespaces)
    {
        var updated = csharp;
        foreach (var ns in namespaces)
        {
            var usingDirective = $"using {ns};";
            if (!updated.Contains(usingDirective, StringComparison.Ordinal))
            {
                updated = usingDirective + "\n" + updated;
            }
        }
        return updated;
    }

    private AiTransformResponse HandleElementDirective(string intent, string tag, int? line, string xaml, string csharp)
    {
        var summary = new List<string>();
        var updatedXaml = xaml;
        var updatedCSharp = csharp;
        var lowerIntent = intent.ToLowerInvariant();

        // Case A: Click event wiring (XAML + C# paired transformation)
        if (lowerIntent.Contains("이벤트") || lowerIntent.Contains("클릭") || lowerIntent.Contains("핸들러") || lowerIntent.Contains("click"))
        {
            var handlerName = line.HasValue ? $"On{tag}Line{line.Value}Click" : $"On{tag}ActionClick";
            if (lowerIntent.Contains("저장")) handlerName = "OnSaveActionClick";
            else if (lowerIntent.Contains("새로고침") || lowerIntent.Contains("리프레시")) handlerName = "OnRefreshDataClick";
            else if (lowerIntent.Contains("취소") || lowerIntent.Contains("닫기")) handlerName = "OnCancelActionClick";

            updatedXaml = ReplaceTagOnTargetLine(updatedXaml, tag, line, openTag =>
                SetOrUpdateXmlAttributes(openTag, new Dictionary<string, string>
                {
                    ["Click"] = handlerName
                }));
            summary.Add($"XAML <{tag}> (Line {line ?? 1}) 요소에 Click=\"{handlerName}\" 이벤트 속성을 주입했습니다.");

            // Inject matching C# method in code-behind with Avalonia.Interactivity
            if (!string.IsNullOrWhiteSpace(updatedCSharp) && !updatedCSharp.Contains(handlerName, StringComparison.Ordinal))
            {
                updatedCSharp = EnsureCSharpUsings(updatedCSharp, "System", "Avalonia.Interactivity");
                var methodCode = $@"
    /// <summary>
    /// AI 자동 생성 이벤트 핸들러: {intent}
    /// </summary>
    private void {handlerName}(object? sender, RoutedEventArgs e)
    {{
        Console.WriteLine(""⚡ {handlerName} 실행됨: {intent}"");
    }}";
                var lastBraceIdx = updatedCSharp.LastIndexOf('}');
                if (lastBraceIdx > 0)
                {
                    updatedCSharp = updatedCSharp.Insert(lastBraceIdx, methodCode + "\n");
                    summary.Add($"C# 코드 비하인드에 'private void {handlerName}(object? sender, RoutedEventArgs e)' 핸들러를 구현했습니다.");
                }
            }
        }
        // Case B: Styling (Emerald, Azure Blue, Modern Dark)
        else if (lowerIntent.Contains("에메랄드") || lowerIntent.Contains("초록") || lowerIntent.Contains("emerald") || lowerIntent.Contains("green"))
        {
            updatedXaml = ReplaceTagOnTargetLine(updatedXaml, tag, line, openTag =>
                SetOrUpdateXmlAttributes(openTag, new Dictionary<string, string>
                {
                    ["Background"] = "#059669",
                    ["Foreground"] = "#ffffff",
                    ["CornerRadius"] = "8",
                    ["FontWeight"] = "SemiBold",
                    ["BorderThickness"] = "0"
                }));
            summary.Add($"<{tag}> (Line {line ?? 1})에 모던 에메랄드 테마(Background='#059669', CornerRadius='8')를 적용했습니다.");
        }
        else if (lowerIntent.Contains("인디고") || lowerIntent.Contains("블루") || lowerIntent.Contains("파랑") || lowerIntent.Contains("blue"))
        {
            updatedXaml = ReplaceTagOnTargetLine(updatedXaml, tag, line, openTag =>
                SetOrUpdateXmlAttributes(openTag, new Dictionary<string, string>
                {
                    ["Background"] = "#0284c7",
                    ["Foreground"] = "#ffffff",
                    ["CornerRadius"] = "8",
                    ["FontWeight"] = "Bold",
                    ["BorderBrush"] = "#38bdf8",
                    ["BorderThickness"] = "1"
                }));
            summary.Add($"<{tag}> (Line {line ?? 1})에 시그니처 아주르 블루 테마(Background='#0284c7', CornerRadius='8')를 적용했습니다.");
        }
        else if (lowerIntent.Contains("크기") || lowerIntent.Contains("확대") || lowerIntent.Contains("large") || lowerIntent.Contains("높이"))
        {
            updatedXaml = ReplaceTagOnTargetLine(updatedXaml, tag, line, openTag =>
                SetOrUpdateXmlAttributes(openTag, new Dictionary<string, string>
                {
                    ["Height"] = "44",
                    ["Padding"] = "16,8",
                    ["FontSize"] = "15"
                }));
            summary.Add($"<{tag}> (Line {line ?? 1})의 높이(Height=44)와 내부 패딩 및 글꼴 크기를 확대했습니다.");
        }
        else if (lowerIntent.Contains("삭제") || lowerIntent.Contains("제거") || lowerIntent.Contains("delete"))
        {
            var lines = updatedXaml.Split('\n').ToList();
            if (line.HasValue && line.Value >= 1 && line.Value <= lines.Count &&
                Regex.IsMatch(lines[line.Value - 1], $@"<{tag}\b[^>]*/>", RegexOptions.IgnoreCase))
            {
                lines.RemoveAt(line.Value - 1);
                updatedXaml = string.Join("\n", lines);
                summary.Add($"<{tag}> (Line {line.Value}) 요소를 XAML에서 안전하게 제거했습니다.");
            }
            else
            {
                var removeRegex = new Regex($@"<{tag}\b[^>]*>.*?</{tag}>|<{tag}\b[^>]*/>", RegexOptions.Singleline | RegexOptions.IgnoreCase);
                if (removeRegex.IsMatch(updatedXaml))
                {
                    updatedXaml = removeRegex.Replace(updatedXaml, "", 1);
                    summary.Add($"<{tag}> 요소를 XAML에서 안전하게 제거했습니다.");
                }
            }
        }
        else
        {
            // General element enhancement using Avalonia-valid ToolTip.Tip attached property
            updatedXaml = ReplaceTagOnTargetLine(updatedXaml, tag, line, openTag =>
                SetOrUpdateXmlAttributes(openTag, new Dictionary<string, string>
                {
                    ["Tag"] = "AIGenerated",
                    ["ToolTip.Tip"] = intent
                }));
            summary.Add($"<{tag}> (Line {line ?? 1}) 요소에 Avalonia 표준 ToolTip.Tip='{intent}' 메타데이터를 주입했습니다.");
        }

        return new AiTransformResponse
        {
            Success = true,
            Message = string.Join(" ", summary),
            UpdatedXaml = updatedXaml,
            UpdatedCSharp = updatedCSharp,
            ChangesSummary = summary
        };
    }

    private AiTransformResponse HandleGlobalDirective(string intent, string xaml, string csharp)
    {
        var summary = new List<string>();
        var updatedXaml = xaml;
        var updatedCSharp = csharp;
        var lowerIntent = intent.ToLowerInvariant();

        if (lowerIntent.Contains("통계") || lowerIntent.Contains("카드") || lowerIntent.Contains("지표") || lowerIntent.Contains("stat") || lowerIntent.Contains("metric"))
        {
            var statCardSnippet = @"
        <!-- AI 생성: 실시간 통계 메트릭 카드 그리드 -->
        <Border Grid.Row=""1"" Background=""#1e293b"" CornerRadius=""10"" Padding=""16"" Margin=""0,0,0,16"" BorderBrush=""#334155"" BorderThickness=""1"">
            <StackPanel Orientation=""Vertical"">
                <TextBlock Text=""실시간 메트릭 모니터링"" FontSize=""14"" FontWeight=""Bold"" Foreground=""#f8fafc"" Margin=""0,0,0,12""/>
                <WrapPanel Orientation=""Horizontal"">
                    <Border Background=""#0f172a"" CornerRadius=""8"" Padding=""12"" Margin=""0,0,10,8"" Width=""140"" BorderBrush=""#1e293b"" BorderThickness=""1"">
                        <StackPanel>
                            <TextBlock Text=""CPU 부하율"" FontSize=""11"" Foreground=""#94a3b8""/>
                            <TextBlock Text=""24.8%"" FontSize=""18"" FontWeight=""Bold"" Foreground=""#38bdf8"" Margin=""0,2,0,0""/>
                        </StackPanel>
                    </Border>
                    <Border Background=""#0f172a"" CornerRadius=""8"" Padding=""12"" Margin=""0,0,10,8"" Width=""140"" BorderBrush=""#1e293b"" BorderThickness=""1"">
                        <StackPanel>
                            <TextBlock Text=""메모리 사용"" FontSize=""11"" Foreground=""#94a3b8""/>
                            <TextBlock Text=""1.2 GB"" FontSize=""18"" FontWeight=""Bold"" Foreground=""#10b981"" Margin=""0,2,0,0""/>
                        </StackPanel>
                    </Border>
                    <Border Background=""#0f172a"" CornerRadius=""8"" Padding=""12"" Margin=""0,0,0,8"" Width=""140"" BorderBrush=""#1e293b"" BorderThickness=""1"">
                        <StackPanel>
                            <TextBlock Text=""컴파일 속도"" FontSize=""11"" Foreground=""#94a3b8""/>
                            <TextBlock Text=""142 ms"" FontSize=""18"" FontWeight=""Bold"" Foreground=""#f59e0b"" Margin=""0,2,0,0""/>
                        </StackPanel>
                    </Border>
                </WrapPanel>
            </StackPanel>
        </Border>";

            var insertIdx = updatedXaml.LastIndexOf("</Grid>", StringComparison.OrdinalIgnoreCase);
            if (insertIdx > 0)
            {
                updatedXaml = updatedXaml.Insert(insertIdx, statCardSnippet + "\n");
                summary.Add("XAML 메인 영역에 3종 실시간 메트릭 카드(CPU, 메모리, 컴파일 속도)를 자동 주입했습니다.");
            }
        }
        else if (lowerIntent.Contains("폼") || lowerIntent.Contains("입력") || lowerIntent.Contains("로그인") || lowerIntent.Contains("form"))
        {
            var formSnippet = @"
        <!-- AI 생성: 사용자 입력 양식 및 전송 폼 -->
        <Border Grid.Row=""1"" Background=""#1e293b"" CornerRadius=""10"" Padding=""18"" Margin=""0,0,0,16"" BorderBrush=""#334155"" BorderThickness=""1"">
            <StackPanel Orientation=""Vertical"">
                <TextBlock Text=""새로운 작업 등록"" FontSize=""15"" FontWeight=""Bold"" Foreground=""#38bdf8"" Margin=""0,0,0,12""/>
                <TextBlock Text=""작업 타이틀"" FontSize=""12"" Foreground=""#94a3b8"" Margin=""0,0,0,4""/>
                <TextBox Text=""신규 빌드 파이프라인 검증"" Height=""36"" Padding=""8"" Background=""#0f172a"" Foreground=""#f8fafc"" CornerRadius=""6"" Margin=""0,0,0,12""/>
                <TextBlock Text=""비밀번호 / 토큰"" FontSize=""12"" Foreground=""#94a3b8"" Margin=""0,0,0,4""/>
                <TextBox Text=""secure_token_key"" PasswordChar=""*"" Height=""36"" Padding=""8"" Background=""#0f172a"" Foreground=""#f8fafc"" CornerRadius=""6"" Margin=""0,0,0,14""/>
                <Button Content=""작업 등록 실행"" Click=""OnSubmitFormActionClick"" Height=""36"" Background=""#0284c7"" Foreground=""#ffffff"" FontWeight=""Bold"" CornerRadius=""6""/>
            </StackPanel>
        </Border>";

            var insertIdx = updatedXaml.LastIndexOf("</Grid>", StringComparison.OrdinalIgnoreCase);
            if (insertIdx > 0)
            {
                updatedXaml = updatedXaml.Insert(insertIdx, formSnippet + "\n");
                summary.Add("사용자 입력 폼(텍스트박스, 마스킹 패스워드 TextBox, 액션 버튼)을 자동 주입했습니다.");
            }

            if (!string.IsNullOrWhiteSpace(updatedCSharp) && !updatedCSharp.Contains("OnSubmitFormActionClick", StringComparison.Ordinal))
            {
                updatedCSharp = EnsureCSharpUsings(updatedCSharp, "System", "Avalonia.Interactivity");
                var methodCode = @"
    /// <summary>
    /// AI 자동 생성: 폼 제출 핸들러
    /// </summary>
    private void OnSubmitFormActionClick(object? sender, RoutedEventArgs e)
    {
        Console.WriteLine(""⚡ 신규 작업 등록 폼 제출이 완료되었습니다."");
    }";
                var lastBraceIdx = updatedCSharp.LastIndexOf('}');
                if (lastBraceIdx > 0)
                {
                    updatedCSharp = updatedCSharp.Insert(lastBraceIdx, methodCode + "\n");
                    summary.Add("C# 코드 비하인드에 'OnSubmitFormActionClick(object? sender, RoutedEventArgs e)' 처리 메서드를 추가했습니다.");
                }
            }
        }
        else
        {
            // General component injection
            var generalSnippet = $@"
        <!-- AI 생성: {intent} -->
        <Border Grid.Row=""1"" Background=""#1e293b"" CornerRadius=""8"" Padding=""16"" Margin=""0,0,0,12"" BorderBrush=""#38bdf8"" BorderThickness=""1"">
            <StackPanel Orientation=""Vertical"">
                <TextBlock Text=""✨ AI 어시스턴트 적용: {intent}"" FontSize=""14"" FontWeight=""Bold"" Foreground=""#38bdf8"" Margin=""0,0,0,6""/>
                <TextBlock Text=""의도에 맞춰 실시간으로 동기화된 UI 블록입니다."" FontSize=""12"" Foreground=""#94a3b8""/>
            </StackPanel>
        </Border>";

            var insertIdx = updatedXaml.LastIndexOf("</Grid>", StringComparison.OrdinalIgnoreCase);
            if (insertIdx > 0)
            {
                updatedXaml = updatedXaml.Insert(insertIdx, generalSnippet + "\n");
                summary.Add($"의도('{intent}')에 따른 커스텀 UI 블록을 XAML 뷰에 주입했습니다.");
            }
        }

        return new AiTransformResponse
        {
            Success = true,
            Message = string.Join(" ", summary),
            UpdatedXaml = updatedXaml,
            UpdatedCSharp = updatedCSharp,
            ChangesSummary = summary
        };
    }
}

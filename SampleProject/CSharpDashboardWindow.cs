using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;

namespace SampleApp;

/// <summary>
/// XAML 없이 순수 C# 코드(C# Markup)만으로 구성된 Avalonia UI 윈도우
/// </summary>
public class CSharpDashboardWindow : Window
{
    public CSharpDashboardWindow()
    {
        Title = "C# Code-Only 실시간 UI 대시보드";
        Width = 520;
        Height = 460;
        Background = Brush.Parse("#0f172a");

        Content = new StackPanel
        {
            Margin = new Thickness(20),
            Orientation = Orientation.Vertical,
            Children =
            {
                new Border
                {
                    Background = Brush.Parse("#1e293b"),
                    CornerRadius = new CornerRadius(8),
                    Padding = new Thickness(16),
                    Margin = new Thickness(0, 0, 0, 16),
                    BorderBrush = Brush.Parse("#334155"),
                    BorderThickness = new Thickness(1),
                    Child = new StackPanel
                    {
                        Orientation = Orientation.Vertical,
                        Children =
                        {
                            new TextBlock
                            {
                                Text = "⚡ C# 순수 코드 UI (No-XAML) 디자이너",
                                FontSize = 16,
                                FontWeight = FontWeight.Bold,
                                Foreground = Brush.Parse("#38bdf8"),
                                Margin = new Thickness(0, 0, 0, 4)
                            },
                            new TextBlock
                            {
                                Text = "C# 객체 초기화 코드를 실시간으로 파싱하여 화면에 렌더링하고 양방향으로 편집합니다.",
                                FontSize = 12,
                                Foreground = Brush.Parse("#94a3b8")
                            }
                        }
                    }
                },
                new Border
                {
                    Background = Brush.Parse("#1e293b"),
                    CornerRadius = new CornerRadius(8),
                    Padding = new Thickness(16),
                    Margin = new Thickness(0, 0, 0, 16),
                    BorderBrush = Brush.Parse("#334155"),
                    BorderThickness = new Thickness(1),
                    Child = new StackPanel
                    {
                        Orientation = Orientation.Vertical,
                        Children =
                        {
                            new TextBlock
                            {
                                Text = "C# 컴포넌트 설정",
                                FontSize = 14,
                                FontWeight = FontWeight.SemiBold,
                                Foreground = Brush.Parse("#f8fafc"),
                                Margin = new Thickness(0, 0, 0, 12)
                            },
                            new TextBlock
                            {
                                Text = "서비스 엔드포인트",
                                FontSize = 12,
                                Foreground = Brush.Parse("#94a3b8"),
                                Margin = new Thickness(0, 0, 0, 4)
                            },
                            new TextBox
                            {
                                Text = "https://api.roslynstudio.local/v1",
                                Height = 36,
                                Padding = new Thickness(8),
                                Background = Brush.Parse("#0f172a"),
                                Foreground = Brush.Parse("#f8fafc"),
                                BorderBrush = Brush.Parse("#475569"),
                                CornerRadius = new CornerRadius(6),
                                Margin = new Thickness(0, 0, 0, 12)
                            },
                            new TextBlock
                            {
                                Text = "메모리 최적화율 (82%)",
                                FontSize = 12,
                                Foreground = Brush.Parse("#94a3b8"),
                                Margin = new Thickness(0, 0, 0, 4)
                            },
                            new ProgressBar
                            {
                                Value = 82,
                                Height = 10,
                                Margin = new Thickness(0, 0, 0, 14),
                                Background = Brush.Parse("#334155"),
                                Foreground = Brush.Parse("#0ea5e9")
                            },
                            new CheckBox
                            {
                                Content = "C# 코드 ↔ 비주얼 캔버스 양방향 동기화",
                                IsChecked = true,
                                Foreground = Brush.Parse("#cbd5e1"),
                                Margin = new Thickness(0, 0, 0, 8)
                            }
                        }
                    }
                },
                new StackPanel
                {
                    Orientation = Orientation.Horizontal,
                    HorizontalAlignment = HorizontalAlignment.Right,
                    Children =
                    {
                        new Button
                        {
                            Content = "초기화",
                            Width = 80,
                            Height = 34,
                            Margin = new Thickness(0, 0, 8, 0),
                            Background = Brush.Parse("#334155"),
                            Foreground = Brush.Parse("#cbd5e1"),
                            CornerRadius = new CornerRadius(6)
                        },
                        new Button
                        {
                            Content = "C# UI 적용",
                            Width = 110,
                            Height = 34,
                            Background = Brush.Parse("#0284c7"),
                            Foreground = Brush.Parse("#ffffff"),
                            FontWeight = FontWeight.Bold,
                            CornerRadius = new CornerRadius(6)
                        }
                    }
                }
            }
        };
    }
}

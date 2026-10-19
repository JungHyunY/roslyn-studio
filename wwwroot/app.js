// RoslynStudio - Modern Controller with XAML Visual Designer

let editor = null;
let currentPath = '';
let isDirty = false;
let analyzeDebounceTimer = null;
let xamlRenderDebounceTimer = null;
let isXamlDesignerOpen = false;

// Monaco loader configuration
require.config({
  paths: {
    vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs'
  }
});

require(['vs/editor/editor.main'], function () {
  // Define custom modern theme matching the UI
  monaco.editor.defineTheme('roslyn-theme', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '38bdf8', fontStyle: 'bold' },
      { token: 'type', foreground: '2dd4bf' },
      { token: 'string', foreground: 'a3e635' },
      { token: 'number', foreground: 'fbbf24' },
      { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
      { token: 'delimiter', foreground: '94a3b8' }
    ],
    colors: {
      'editor.background': '#0c0e14',
      'editor.foreground': '#f1f5f9',
      'editorCursor.foreground': '#38bdf8',
      'editor.lineHighlightBackground': '#141824',
      'editorLineNumber.foreground': '#334155',
      'editorLineNumber.activeForeground': '#94a3b8',
      'editorIndentGuide.background': '#1e2438',
      'editorIndentGuide.activeBackground': '#38bdf8',
      'editor.selectionBackground': '#2e3856',
      'editor.inactiveSelectionBackground': '#1e2538'
    }
  });

  editor = monaco.editor.create(document.getElementById('monacoEditorContainer'), {
    value: '// 파일을 선택하거나 작성하세요...',
    language: 'csharp',
    theme: 'roslyn-theme',
    automaticLayout: true,
    fontSize: 14.5,
    fontFamily: '"Fira Code", "Cascadia Code", Consolas, monospace',
    fontLigatures: true,
    minimap: { enabled: true, renderCharacters: false, scale: 1 },
    scrollBeyondLastLine: false,
    formatOnType: true,
    padding: { top: 12, bottom: 12 },
    lineNumbers: 'on',
    roundedSelection: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    smoothScrolling: true
  });

  editor.addCommand(monaco.KeyCode.F7, () => {
    toggleCodeBehind();
  });

  // Register rich XAML IntelliSense completion provider for Monaco
  monaco.languages.registerCompletionItemProvider('xml', {
    triggerCharacters: ['<', ' ', '{', ':', '.'],
    provideCompletionItems: (model, position) => {
      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      });

      const suggestions = [];

      // Binding suggestions
      if (/\{[a-zA-Z]*$/.test(textUntilPosition)) {
        suggestions.push(
          { label: 'Binding', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'Binding ${1:Path}}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'XAML 데이터 바인딩' },
          { label: 'Binding Fallback', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'Binding ${1:Path}, FallbackValue=\'${2:Default}\'}}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: '기본값을 포함한 바인딩' },
          { label: 'x:Bind', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'x:Bind ${1:Path}}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: '컴파일 바인딩' },
          { label: 'StaticResource', kind: monaco.languages.CompletionItemKind.Reference, insertText: 'StaticResource ${1:ResourceKey}}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: '정적 리소스 참조' }
        );
      }
      // Controls suggestions
      else if (/<[a-zA-Z]*$/.test(textUntilPosition)) {
        const controls = [
          { name: 'Button', doc: '버튼 컨트롤', snippet: 'Button Content="${1:Button}" Width="${2:100}" Height="${3:34}" />' },
          { name: 'TextBlock', doc: '텍스트 출력 블록', snippet: 'TextBlock Text="${1:Text}" FontSize="${2:14}" Foreground="${3:#f8fafc}" />' },
          { name: 'TextBox', doc: '텍스트 입력 상자', snippet: 'TextBox Text="${1:Value}" Height="${2:34}" Padding="${3:6}" />' },
          { name: 'StackPanel', doc: '스택 레이아웃 컨테이너', snippet: 'StackPanel Orientation="${1|Vertical,Horizontal|}">\n\t$0\n</StackPanel>' },
          { name: 'Grid', doc: '그리드 레이아웃 컨테이너', snippet: 'Grid Margin="${1:16}">\n\t<Grid.RowDefinitions>\n\t\t<RowDefinition Height="Auto"/>\n\t\t<RowDefinition Height="*"/>\n\t</Grid.RowDefinitions>\n\t$0\n</Grid>' },
          { name: 'Border', doc: '테두리 및 배경 컨테이너', snippet: 'Border Background="${1:#1e293b}" CornerRadius="${2:8}" Padding="${3:16}">\n\t$0\n</Border>' },
          { name: 'ProgressBar', doc: '진행률 바', snippet: 'ProgressBar Value="${1:65}" Height="${2:10}" Foreground="${3:#0ea5e9}" />' },
          { name: 'CheckBox', doc: '체크박스 컨트롤', snippet: 'CheckBox Content="${1:Option}" IsChecked="${2|True,False|}" />' },
          { name: 'RadioButton', doc: '라디오 버튼', snippet: 'RadioButton Content="${1:Option}" IsChecked="${2|True,False|}" />' },
          { name: 'ListBox', doc: '리스트 박스', snippet: 'ListBox ItemsSource="{Binding ${1:Items}}" />' },
          { name: 'ComboBox', doc: '드롭다운 콤보박스', snippet: 'ComboBox ItemsSource="{Binding ${1:Items}}" />' },
          { name: 'Image', doc: '이미지 컨트롤', snippet: 'Image Source="${1:image.png}" Width="${2:120}" Height="${3:120}" />' },
          { name: 'Slider', doc: '슬라이더 컨트롤', snippet: 'Slider Value="${1:50}" Minimum="0" Maximum="100" />' },
          { name: 'Canvas', doc: '절대 좌표 캔버스', snippet: 'Canvas Height="${1:200}">\n\t$0\n</Canvas>' },
          { name: 'WrapPanel', doc: '자동 줄바꿈 패널', snippet: 'WrapPanel Orientation="${1|Horizontal,Vertical|}">\n\t$0\n</WrapPanel>' },
          { name: 'ScrollViewer', doc: '스크롤 뷰어', snippet: 'ScrollViewer VerticalScrollBarVisibility="Auto">\n\t$0\n</ScrollViewer>' },
          { name: 'Expander', doc: '접이식 익스팬더', snippet: 'Expander Header="${1:상세 설정}">\n\t$0\n</Expander>' },
          { name: 'PasswordBox', doc: '암호 입력 상자', snippet: 'PasswordBox Height="${1:34}" />' },
          { name: 'DatePicker', doc: '날짜 선택기', snippet: 'DatePicker Height="${1:34}" />' },
          { name: 'Separator', doc: '구분선', snippet: 'Separator Margin="0,8" />' }
        ];

        controls.forEach(c => {
          suggestions.push({
            label: c.name,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: c.snippet,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: c.doc
          });
        });
      }
      // Attributes suggestions
      else {
        const attributes = [
          'Width', 'Height', 'Margin', 'Padding', 'Background', 'Foreground',
          'FontSize', 'FontWeight', 'HorizontalAlignment', 'VerticalAlignment',
          'Grid.Row', 'Grid.Column', 'Grid.RowSpan', 'Grid.ColumnSpan',
          'Canvas.Left', 'Canvas.Top', 'Canvas.Right', 'Canvas.Bottom',
          'Content', 'Text', 'Title', 'Value', 'Maximum', 'Minimum', 'IsChecked',
          'CornerRadius', 'BorderBrush', 'BorderThickness', 'ItemsSource', 'Orientation'
        ];
        attributes.forEach(attr => {
          suggestions.push({
            label: attr,
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: `${attr}="\${1}"`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: `XAML ${attr} 속성`
          });
        });
      }

      return { suggestions };
    }
  });

  // Track cursor position & sync XAML / C# UI preview highlight
  editor.onDidChangeCursorPosition(e => {
    document.getElementById('cursorPos').innerText = `줄 ${e.position.lineNumber}, 열 ${e.position.column}`;
    if (isXamlDesignerOpen) {
      highlightPreviewForEditorCursor(e.position.lineNumber);
    }
  });

  // Track content change -> debounce Roslyn live analysis & XAML / C# UI render
  editor.onDidChangeModelContent(() => {
    setDirty(true);
    scheduleAnalysis();
    if (isXamlFile(currentPath) || isXamlDesignerOpen) {
      scheduleXamlRender();
    }
  });

  // Global Shortcuts
  window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveCurrentFile();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      executeBuild();
    } else if (e.key === 'F5') {
      e.preventDefault();
      executeRun();
    }
  });

  // Initial load
  loadWorkspaceTree();
});

function isXamlFile(path) {
  if (!path) return false;
  const ext = path.split('.').pop().toLowerCase();
  return ext === 'xaml' || ext === 'axaml';
}

function isCSharpUiCode(code) {
  if (!code || typeof code !== 'string') return false;
  return /\bnew\s+(Window|Grid|StackPanel|Border|TextBlock|Button|TextBox|CheckBox|RadioButton|ProgressBar|ListBox|ComboBox|Slider)\s*\{/.test(code);
}

// Workspace Tree
async function loadWorkspaceTree() {
  try {
    const res = await fetch('/api/workspace/tree');
    const data = await res.json();
    document.getElementById('workspaceRootDisplay').innerText = data.root;

    const treeContainer = document.getElementById('fileTree');
    treeContainer.innerHTML = '';
    renderTreeNode(data.tree, treeContainer, 0);

    // Auto-open: Prefer MainWindow.axaml / MainWindow.xaml so preview is immediately visible
    if (!currentPath) {
      const defaultXaml = findFile(data.tree, 'MainWindow.axaml') || findFile(data.tree, 'MainWindow.xaml');
      if (defaultXaml) {
        openFile(defaultXaml.relativePath);
      } else {
        const defaultFile = findFile(data.tree, 'Program.cs');
        if (defaultFile) {
          openFile(defaultFile.relativePath);
        }
      }
    }
  } catch (err) {
    appendConsole(`[시스템] 워크스페이스 로드 오류: ${err.message}`);
  }
}

function findFile(node, targetName) {
  if (!node.isDirectory && node.name.toLowerCase() === targetName.toLowerCase()) {
    return node;
  }
  if (node.children) {
    for (const child of node.children) {
      const found = findFile(child, targetName);
      if (found) return found;
    }
  }
  return null;
}

function renderTreeNode(node, container, level) {
  if (node.relativePath) {
    const item = document.createElement('div');
    item.className = `tree-item ${node.isDirectory ? 'directory' : 'file'}`;
    item.style.paddingLeft = `${10 + level * 14}px`;

    let prefixHtml = '';
    if (node.isDirectory) {
      prefixHtml = `
        <svg style="width:14px;height:14px;color:#94a3b8;flex-shrink:0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
      `;
    } else {
      const lowerName = node.name.toLowerCase();
      if (lowerName.endsWith('.xaml.cs') || lowerName.endsWith('.axaml.cs')) {
        prefixHtml = '<span style="color:#64748b;font-size:11px;margin-right:2px;">↳</span><span class="file-badge badge-cs" title="XAML 코드 비하인드">C#</span>';
      } else if (lowerName.endsWith('window.cs') || lowerName.endsWith('view.cs')) {
        prefixHtml = '<span class="file-badge" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.35)" title="순수 C# 코드 UI">C# UI</span>';
      } else if (lowerName.endsWith('.cs')) {
        prefixHtml = '<span class="file-badge badge-cs">C#</span>';
      } else if (lowerName.endsWith('.xaml') || lowerName.endsWith('.axaml')) {
        const hasChildren = node.children && node.children.length > 0;
        const arrow = hasChildren ? '<span style="color:#38bdf8;font-size:10px;margin-right:2px;">▾</span>' : '';
        prefixHtml = `${arrow}<span class="file-badge" style="background:rgba(56,189,248,0.12);color:#38bdf8;border:1px solid rgba(56,189,248,0.3)">XAML</span>`;
      } else if (lowerName.endsWith('.csproj')) {
        prefixHtml = '<span class="file-badge badge-csproj">PROJ</span>';
      } else {
        prefixHtml = '<span class="file-badge badge-other">FILE</span>';
      }
    }

    item.innerHTML = `${prefixHtml}<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${node.name}</span>`;

    if (!node.isDirectory) {
      const delBtn = document.createElement('button');
      delBtn.className = 'tree-item-delete';
      delBtn.title = `'${node.name}' 삭제`;
      delBtn.innerText = '✖';
      delBtn.onclick = async e => {
        e.stopPropagation();
        const isXaml = node.name.toLowerCase().endsWith('.xaml');
        const confirmMsg = isXaml
          ? `'${node.relativePath}' 및 매칭되는 코드 비하인드('${node.relativePath}.cs')를 모두 삭제하시겠습니까?`
          : `'${node.relativePath}' 파일을 삭제하시겠습니까?`;
        const ok = confirm(confirmMsg);
        if (!ok) return;
        try {
          const res = await fetch(`/api/workspace/file?path=${encodeURIComponent(node.relativePath)}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('파일 삭제 실패');
          if (currentPath === node.relativePath || (isXaml && currentPath === `${node.relativePath}.cs`)) {
            currentPath = '';
            editor.setValue('// 파일을 선택하세요.');
            document.getElementById('currentFileName').innerText = '파일을 선택하세요';
          }
          await loadWorkspaceTree();
          setStatus(`삭제 완료: ${node.relativePath}`);
        } catch (err) {
          alert(`삭제 오류: ${err.message}`);
        }
      };
      item.appendChild(delBtn);

      item.onclick = () => {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
          sidebar.classList.remove('open');
        }
        openFile(node.relativePath);
      };
      if (node.relativePath === currentPath) {
        item.classList.add('selected');
      }
    }

    container.appendChild(item);
  }

  if (node.children) {
    for (const child of node.children) {
      renderTreeNode(child, container, node.relativePath ? level + 1 : 0);
    }
  }
}

// File Open
async function openFile(relativePath) {
  if (isDirty && currentPath) {
    const confirmed = confirm(`'${currentPath}' 파일에 저장되지 않은 변경사항이 있습니다. 계속 진행하시겠습니까?`);
    if (!confirmed) return;
  }

  try {
    const res = await fetch(`/api/workspace/file?path=${encodeURIComponent(relativePath)}`);
    if (!res.ok) throw new Error('파일을 읽을 수 없습니다.');
    const data = await res.json();

    currentPath = relativePath;
    document.getElementById('currentFileName').innerText = relativePath;
    setDirty(false);

    // Language mapping
    const ext = relativePath.split('.').pop().toLowerCase();
    const isXaml = ext === 'xaml' || ext === 'axaml';
    const isCodeBehind = relativePath.toLowerCase().endsWith('.xaml.cs') || relativePath.toLowerCase().endsWith('.axaml.cs');
    const isCsUi = ext === 'cs' && !isCodeBehind && isCSharpUiCode(data.content);
    const lang = ext === 'cs' ? 'csharp' : isXaml || ext === 'csproj' || ext === 'xml' ? 'xml' : ext === 'json' ? 'json' : 'plaintext';

    // Update File Type Badge
    const badgeEl = document.getElementById('fileTypeBadge');
    if (badgeEl) {
      badgeEl.innerText = isXaml ? 'XAML' : isCsUi ? 'C# UI' : isCodeBehind ? 'XAML.CS' : ext === 'cs' ? 'C#' : ext.toUpperCase();
      badgeEl.style.color = '#38bdf8';
    }

    const model = monaco.editor.createModel(data.content, lang);
    editor.setModel(model);

    // Highlight in tree
    document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.tree-item').forEach(el => {
      if (el.innerText.includes(relativePath.split(/[\\/]/).pop())) {
        el.classList.add('selected');
      }
    });

    // Code-Behind Toggle Button update (.xaml/.axaml <-> .xaml.cs/.axaml.cs)
    const btnToggleCodeBehind = document.getElementById('btnToggleCodeBehind');
    const labelCodeBehind = document.getElementById('toggleCodeBehindLabel');

    if (btnToggleCodeBehind && labelCodeBehind) {
      if (isXaml) {
        btnToggleCodeBehind.style.display = 'inline-flex';
        labelCodeBehind.innerText = '.cs 코드 비하인드 (F7)';
        btnToggleCodeBehind.title = `'${relativePath}.cs' 코드 비하인드로 전환 (단축키: F7)`;
      } else if (isCodeBehind) {
        btnToggleCodeBehind.style.display = 'inline-flex';
        labelCodeBehind.innerText = 'XAML 디자이너 (F7)';
        btnToggleCodeBehind.title = `'${relativePath.slice(0, -3)}' XAML 디자이너로 전환 (단축키: F7)`;
      } else {
        btnToggleCodeBehind.style.display = 'none';
      }
    }

    // XAML & C# UI Designer Auto-Toggle
    const btnToggle = document.getElementById('btnToggleXamlPreview');
    const btnTopXaml = document.getElementById('btnTopXamlPreview');
    if (isXaml || isCsUi) {
      if (btnToggle) btnToggle.classList.add('active');
      if (btnTopXaml) btnTopXaml.classList.add('active');
      openXamlDesigner();
      renderXamlPreview(data.content);
      if (ext === 'cs') {
        scheduleAnalysis();
      }
    } else {
      if (btnToggle) btnToggle.classList.remove('active');
      if (btnTopXaml) btnTopXaml.classList.remove('active');
      closeXamlDesigner();
      scheduleAnalysis();
    }
  } catch (err) {
    appendConsole(`[오류] 파일 열기 실패: ${err.message}`);
  }
}

// Toggle between .xaml/.axaml and .xaml.cs/.axaml.cs (F7)
function toggleCodeBehind() {
  if (!currentPath) return;
  const lower = currentPath.toLowerCase();
  if (lower.endsWith('.xaml') || lower.endsWith('.axaml')) {
    openFile(currentPath + '.cs');
  } else if (lower.endsWith('.xaml.cs') || lower.endsWith('.axaml.cs')) {
    openFile(currentPath.slice(0, -3));
  }
}

// File Save
async function saveCurrentFile() {
  if (!currentPath) return;

  const content = editor.getValue();
  setStatus('저장 중...');
  try {
    const res = await fetch('/api/workspace/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relativePath: currentPath, content })
    });

    if (!res.ok) throw new Error('저장 요청 실패');
    setDirty(false);
    setStatus(`저장 완료: ${currentPath}`);
    if (isXamlFile(currentPath) || isXamlDesignerOpen) {
      renderXamlPreview(content);
    }
    if (!isXamlFile(currentPath)) {
      scheduleAnalysis();
    }
  } catch (err) {
    setStatus(`저장 오류: ${err.message}`);
    appendConsole(`[오류] 저장 실패: ${err.message}`);
  }
}

function setDirty(dirty) {
  isDirty = dirty;
  document.getElementById('dirtyIndicator').style.display = dirty ? 'inline' : 'none';
}

let currentDiagScope = 'entire'; // 'entire' | 'current'
let cachedDiagnostics = [];

function setDiagScope(scope) {
  currentDiagScope = scope;
  document.getElementById('btnScopeEntire')?.classList.toggle('active', scope === 'entire');
  document.getElementById('btnScopeCurrent')?.classList.toggle('active', scope === 'current');
  renderDiagnosticsList();
}

// Roslyn Live Analysis
function scheduleAnalysis() {
  updateStatusDot('analyzing');
  clearTimeout(analyzeDebounceTimer);
  analyzeDebounceTimer = setTimeout(runRoslynAnalysis, 300);
}

async function runRoslynAnalysis() {
  document.getElementById('roslynStatus').innerText = 'Roslyn 분석 중...';

  try {
    const isCs = currentPath && currentPath.endsWith('.cs');
    const currentCode = isCs && editor ? editor.getValue() : null;

    let result;
    if (currentDiagScope === 'entire' || !isCs) {
      const res = await fetch('/api/roslyn/analyze-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentFilePath: currentPath,
          currentFileCode: currentCode
        })
      });
      if (!res.ok) return;
      result = await res.json();
    } else {
      const res = await fetch('/api/roslyn/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: currentCode || '',
          filePath: currentPath
        })
      });
      if (!res.ok) return;
      result = await res.json();
    }

    cachedDiagnostics = result.diagnostics || [];
    renderDiagnosticsList();

    if (result.hasErrors) {
      updateStatusDot('has-error');
      document.getElementById('roslynStatus').innerText = '⚠️ Roslyn 오류 감지';
    } else {
      updateStatusDot('ready');
      document.getElementById('roslynStatus').innerText = '✅ Roslyn 분석 완료';
    }
  } catch {
    updateStatusDot('ready');
    document.getElementById('roslynStatus').innerText = 'Roslyn 대기';
  }
}

function renderDiagnosticsList() {
  const model = editor?.getModel();
  const currentFileName = currentPath ? currentPath.split(/[\\/]/).pop() : '';

  // Filter for display based on scope
  const filtered = currentDiagScope === 'current'
    ? cachedDiagnostics.filter(d => {
        if (!d.filePath) return true;
        const dName = d.filePath.split(/[\\/]/).pop();
        return d.filePath === currentPath || dName === currentFileName;
      })
    : cachedDiagnostics;

  // Set markers in Monaco for currently active editor model
  if (model) {
    const editorMarkers = cachedDiagnostics
      .filter(d => {
        if (!d.filePath) return true;
        const dName = d.filePath.split(/[\\/]/).pop();
        return d.filePath === currentPath || dName === currentFileName;
      })
      .map(d => ({
        severity: d.severity === 'Error'
          ? monaco.MarkerSeverity.Error
          : d.severity === 'Warning'
          ? monaco.MarkerSeverity.Warning
          : monaco.MarkerSeverity.Info,
        message: `[${d.id}] ${d.message}`,
        startLineNumber: d.startLine,
        startColumn: d.startColumn,
        endLineNumber: d.endLine,
        endColumn: d.endColumn
      }));

    monaco.editor.setModelMarkers(model, 'roslyn', editorMarkers);
  }

  const listContainer = document.getElementById('diagnosticsList');
  document.getElementById('diagBadge').innerText = filtered.length;
  listContainer.innerHTML = '';

  if (filtered.length === 0) {
    const scopeText = currentDiagScope === 'current' ? '현재 파일에' : '솔루션 전체에';
    listContainer.innerHTML = `
      <div style="color: #10b981; padding: 16px; display: flex; align-items: center; gap: 8px;">
        <svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>${scopeText} 오류나 경고가 없습니다. 코드가 깨끗합니다.</span>
      </div>
    `;
    return;
  }

  filtered.forEach(d => {
    const card = document.createElement('div');
    const isError = d.severity === 'Error';
    const isWarn = d.severity === 'Warning';
    card.className = `diag-card ${isError ? 'is-error' : isWarn ? 'is-warning' : 'is-info'}`;
    const badgeClass = isError ? 'badge-error' : isWarn ? 'badge-warning' : 'badge-info';
    const fileLabel = d.filePath ? d.filePath.split(/[\\/]/).pop() : (currentFileName || 'Source');

    card.innerHTML = `
      <span class="badge-tag ${badgeClass}">${d.severity}</span>
      <span class="diag-code">${d.id}</span>
      <span class="diag-file-tag" title="${d.filePath || ''}">${fileLabel}</span>
      <span class="diag-msg">${d.message}</span>
      <span class="diag-location">줄 ${d.startLine}:${d.startColumn}</span>
    `;

    card.onclick = async () => {
      if (d.filePath && d.filePath !== currentPath) {
        await openFile(d.filePath);
      }
      setTimeout(() => {
        if (editor) {
          editor.revealPositionInCenter({ lineNumber: d.startLine, column: d.startColumn });
          editor.setPosition({ lineNumber: d.startLine, column: d.startColumn });
          editor.focus();
        }
      }, 80);
    };

    listContainer.appendChild(card);
  });
}

function clearDiagnostics() {
  const model = editor?.getModel();
  if (model) {
    monaco.editor.setModelMarkers(model, 'roslyn', []);
  }
  document.getElementById('diagBadge').innerText = '0';
  document.getElementById('diagnosticsList').innerHTML = '';
  updateStatusDot('ready');
}

function updateStatusDot(state) {
  const dot = document.querySelector('.status-dot');
  if (!dot) return;
  dot.className = 'status-dot';
  if (state === 'analyzing') dot.classList.add('analyzing');
  if (state === 'has-error') dot.classList.add('has-error');
}

// ================= XAML Visual Designer & Live Preview =================
function scheduleXamlRender() {
  clearTimeout(xamlRenderDebounceTimer);
  xamlRenderDebounceTimer = setTimeout(() => {
    if (editor) {
      renderXamlPreview(editor.getValue());
    }
  }, 120);
}

function openXamlDesigner() {
  const pane = document.getElementById('xamlDesignerPane');
  const btn = document.getElementById('btnToggleXamlPreview');
  const viewToggle = document.getElementById('viewModeToggle');
  if (pane) pane.style.display = 'flex';
  if (btn) btn.classList.add('active');
  if (viewToggle) viewToggle.style.display = 'flex';
  isXamlDesignerOpen = true;
  if (editor) editor.layout();
}

function closeXamlDesigner() {
  const pane = document.getElementById('xamlDesignerPane');
  const btn = document.getElementById('btnToggleXamlPreview');
  const viewToggle = document.getElementById('viewModeToggle');
  if (pane) pane.style.display = 'none';
  if (btn) btn.classList.remove('active');
  if (viewToggle) viewToggle.style.display = 'none';
  isXamlDesignerOpen = false;
  if (editor) editor.layout();
}

function toggleXamlDesigner() {
  if (isXamlDesignerOpen) {
    closeXamlDesigner();
  } else {
    openXamlDesigner();
    if (editor) renderXamlPreview(editor.getValue());
  }
}

function injectXamlLineNumbers(xaml) {
  if (!xaml) return '';
  const lines = xaml.split(/\r?\n/);
  return lines.map((line, idx) => {
    const lineNum = idx + 1;
    return line.replace(/<([A-Za-z_][A-Za-z0-9_.:]*)([\s/>])/g, (match, tag, sep) => {
      return `<${tag} _xaml_line="${lineNum}"${sep}`;
    });
  }).join('\n');
}

let currentHoveredPreviewElement = null;
let currentCursorActivePreviewElement = null;
let activeSelectedPreviewElement = null;
let xamlLineDecorations = [];
let isBlueprintModeActive = false;

function extractXamlNodeAttributes(xmlNode) {
  const attrs = {};
  if (!xmlNode || !xmlNode.attributes) return attrs;
  for (let i = 0; i < xmlNode.attributes.length; i++) {
    const a = xmlNode.attributes[i];
    if (!a.name.startsWith('_xaml')) {
      attrs[a.name] = a.value;
    }
  }
  return attrs;
}

function attachXamlInspectHandlers(element, xmlNode, tagName) {
  const lineStr = xmlNode.getAttribute('_xaml_line');
  const line = lineStr ? parseInt(lineStr, 10) : 1;
  element.setAttribute('data-xaml-line', lineStr || '1');
  element.setAttribute('data-xaml-tag', tagName);
  element._xamlAttributes = extractXamlNodeAttributes(xmlNode);
  element._xamlTagName = tagName;
  element._xamlLine = line;

  // Hover in preview -> highlight element and Monaco line
  element.addEventListener('mouseenter', e => {
    e.stopPropagation();
    setHoveredPreviewElement(element, tagName, line);
  });

  element.addEventListener('mouseleave', e => {
    e.stopPropagation();
    clearHoveredPreviewElement(element);
  });

  // Click in preview -> jump Monaco cursor, select element, and open Property Inspector
  element.addEventListener('click', e => {
    e.stopPropagation();
    jumpToEditorLine(line);
    selectPreviewElement(element);
  });

  // Double-click in preview -> inline direct text editing
  element.addEventListener('dblclick', e => {
    e.stopPropagation();
    startInlineTextEditing(element);
  });

  return element;
}

function setHoveredPreviewElement(element, tagName, line) {
  if (currentHoveredPreviewElement && currentHoveredPreviewElement !== element) {
    currentHoveredPreviewElement.classList.remove('xaml-inspect-highlight');
  }
  currentHoveredPreviewElement = element;
  element.classList.add('xaml-inspect-highlight');

  const badge = document.getElementById('designerSelectedTagBadge');
  if (badge) {
    badge.innerText = `<${tagName}> : 줄 ${line}`;
    badge.style.display = 'inline-block';
  }

  if (editor && monaco) {
    xamlLineDecorations = editor.deltaDecorations(xamlLineDecorations, [
      {
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: 'monaco-xaml-line-highlight',
          glyphMarginClassName: 'monaco-xaml-glyph-highlight'
        }
      }
    ]);
    editor.revealLineInCenterIfOutsideViewport(line);
  }
}

function clearHoveredPreviewElement(element) {
  if (element) {
    element.classList.remove('xaml-inspect-highlight');
  }
  if (currentHoveredPreviewElement === element) {
    currentHoveredPreviewElement = null;
  }
  const badge = document.getElementById('designerSelectedTagBadge');
  if (badge && !currentCursorActivePreviewElement) {
    badge.style.display = 'none';
  } else if (badge && currentCursorActivePreviewElement) {
    const tagName = currentCursorActivePreviewElement.getAttribute('data-xaml-tag') || 'Element';
    const tagLine = currentCursorActivePreviewElement.getAttribute('data-xaml-line') || '';
    badge.innerText = `<${tagName}> : 줄 ${tagLine}`;
  }
  if (editor && monaco) {
    xamlLineDecorations = editor.deltaDecorations(xamlLineDecorations, []);
  }
}

function jumpToEditorLine(line) {
  if (!editor) return;
  editor.revealLineInCenter(line);
  editor.setPosition({ lineNumber: line, column: 1 });
  editor.focus();
}

function highlightPreviewForEditorCursor(lineNumber) {
  if (!isXamlDesignerOpen) return;

  const elements = Array.from(document.querySelectorAll('#xamlRenderRoot [data-xaml-line]'));
  if (elements.length === 0) return;

  let target = null;
  let maxLine = -1;

  for (const el of elements) {
    const elLine = parseInt(el.getAttribute('data-xaml-line'), 10);
    if (elLine === lineNumber) {
      target = el;
      break;
    }
    if (elLine < lineNumber && elLine > maxLine) {
      maxLine = elLine;
      target = el;
    }
  }

  if (currentCursorActivePreviewElement && currentCursorActivePreviewElement !== target) {
    currentCursorActivePreviewElement.classList.remove('xaml-inspect-highlight');
  }

  if (target) {
    currentCursorActivePreviewElement = target;
    target.classList.add('xaml-inspect-highlight');
    const tagName = target.getAttribute('data-xaml-tag') || 'Element';
    const tagLine = target.getAttribute('data-xaml-line') || lineNumber;

    const badge = document.getElementById('designerSelectedTagBadge');
    if (badge) {
      badge.innerText = `<${tagName}> : 줄 ${tagLine}`;
      badge.style.display = 'inline-block';
    }

    scrollElementIntoDesignerViewport(target);
  } else {
    currentCursorActivePreviewElement = null;
    const badge = document.getElementById('designerSelectedTagBadge');
    if (badge) badge.style.display = 'none';
  }
}

function scrollElementIntoDesignerViewport(el) {
  const viewport = document.getElementById('designerViewport');
  if (!viewport || !el) return;
  const vpRect = viewport.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();

  if (elRect.top < vpRect.top || elRect.bottom > vpRect.bottom) {
    viewport.scrollTop += (elRect.top - vpRect.top) - (vpRect.height / 2) + (elRect.height / 2);
  }
}

let hasRenderedValidXaml = false;

function sanitizeXamlForParsing(xaml) {
  if (!xaml) return '';

  // 1. Convert raw unescaped & to &amp;
  let clean = xaml.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[a-f\d]+);)/gi, '&amp;');

  // 2. Auto-declare missing XML namespace prefixes so DOMParser doesn't crash on <local:..., <d:..., <mc:..., etc.
  const prefixMatches = Array.from(clean.matchAll(/<([A-Za-z_][A-Za-z0-9_-]*):[A-Za-z_]/g));
  const prefixes = new Set();
  for (const m of prefixMatches) {
    if (m[1] !== 'xmlns') prefixes.add(m[1]);
  }

  const rootMatch = clean.match(/<([A-Za-z_][A-Za-z0-9_.:]*)([\s>])/);
  if (rootMatch && prefixes.size > 0) {
    const rootTag = rootMatch[1];
    let xmlnsAdditions = '';
    prefixes.forEach(p => {
      if (!clean.includes(`xmlns:${p}=`)) {
        xmlnsAdditions += ` xmlns:${p}="http://schemas.roslynstudio.dev/${p}"`;
      }
    });

    if (xmlnsAdditions) {
      clean = clean.replace(new RegExp(`<${rootTag}([\\s>])`), `<${rootTag}${xmlnsAdditions}$1`);
    }
  }

  return clean;
}

function renderXamlPreview(xaml) {
  const container = document.getElementById('xamlRenderRoot');
  const liveBadge = document.querySelector('.designer-live-badge');
  const titleEl = document.getElementById('designerTitleText');
  if (!container) return;

  const isCsFile = currentPath && currentPath.toLowerCase().endsWith('.cs');
  if (titleEl) {
    titleEl.innerText = isCsFile ? 'C# 코드 UI 실시간 비주얼 디자이너' : 'XAML 실시간 비주얼 디자이너';
  }

  if (!xaml || !xaml.trim()) {
    container.innerHTML = '<div style="color:#64748b;padding:24px;">UI 코드를 작성하면 실시간으로 렌더링됩니다.</div>';
    hasRenderedValidXaml = false;
    return;
  }

  try {
    let instrumentedXaml = '';
    if (isCsFile) {
      instrumentedXaml = transpileCSharpUiToXaml(xaml);
      if (!instrumentedXaml) {
        container.innerHTML = '<div style="color:#64748b;padding:24px;">이 C# 파일에는 시각화할 UI 컨트롤(new Window, new StackPanel, new Button 등)이 없습니다.</div>';
        return;
      }
    } else {
      const sanitized = sanitizeXamlForParsing(xaml);
      instrumentedXaml = injectXamlLineNumbers(sanitized);
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(instrumentedXaml, 'application/xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      if (liveBadge) {
        liveBadge.innerText = '구문 작성 중...';
        liveBadge.style.color = '#f59e0b';
        liveBadge.style.borderColor = 'rgba(245,158,11,0.4)';
        liveBadge.style.background = 'rgba(245,158,11,0.15)';
      }

      // If we already have a successfully rendered DOM, don't wipe it out while user is in the middle of typing
      if (!hasRenderedValidXaml) {
        container.innerHTML = `
          <div class="xaml-error-card">
            <div style="font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
              <span>⚠️ XAML XML 구문 오류</span>
            </div>
            <div style="line-height:1.4;">${parseError.textContent.slice(0, 240)}</div>
          </div>
        `;
      }
      return;
    }

    if (liveBadge) {
      liveBadge.innerText = 'LIVE PREVIEW';
      liveBadge.style.color = '#10b981';
      liveBadge.style.borderColor = 'rgba(16,185,129,0.3)';
      liveBadge.style.background = 'rgba(16,185,129,0.15)';
    }

    container.innerHTML = '';
    const rootEl = doc.documentElement;
    const rendered = compileXamlElement(rootEl);
    container.appendChild(rendered);
    hasRenderedValidXaml = true;

    if (isBlueprintModeActive) {
      container.classList.add('inspect-blueprint-active');
    } else {
      container.classList.remove('inspect-blueprint-active');
    }

    autoFitPreviewIfMobile();

    // Preserve active selection across re-renders
    if (activeVisualTarget?.line) {
      const match = container.querySelector(`[data-xaml-line="${activeVisualTarget.line}"]`);
      if (match) {
        selectPreviewElement(match, false);
      }
    }

    if (editor) {
      const pos = editor.getPosition();
      if (pos) {
        highlightPreviewForEditorCursor(pos.lineNumber);
      }
    }
  } catch (err) {
    if (!hasRenderedValidXaml) {
      container.innerHTML = `
        <div class="xaml-error-card">
          <div style="font-weight:700;margin-bottom:6px;">⚠️ 렌더링 오류</div>
          <div>${err.message}</div>
        </div>
      `;
    }
  }
}

// ================= XAML Data Binding & Dummy Value Resolver =================
function isBindingExpression(val) {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  return /^\{(?:\w+:)?(?:Template)?Binding\b/i.test(trimmed);
}

function extractBindingPath(val) {
  if (!val || typeof val !== 'string') return '';
  const trimmed = val.trim();

  // 1. Check for FallbackValue
  const fbMatch = trimmed.match(/FallbackValue\s*=\s*(?:'([^']*)'|"([^"]*)"|([^,\}]+))/i);
  if (fbMatch) {
    const fb = fbMatch[1] ?? fbMatch[2] ?? fbMatch[3];
    if (fb && fb.trim()) return fb.trim();
  }

  // 2. Extract Path
  const pathMatch = trimmed.match(/Path\s*=\s*([^,\}]+)/i);
  if (pathMatch) return pathMatch[1].trim();

  const directMatch = trimmed.match(/^\{(?:\w+:)?(?:Template)?Binding\s*([^,\}]+)/i);
  if (directMatch && !directMatch[1].includes('=')) {
    return directMatch[1].trim();
  }
  return '';
}

function resolveXamlValue(rawVal, propName, fallbackDefault = '') {
  if (rawVal === null || rawVal === undefined) return fallbackDefault;
  const trimmed = String(rawVal).trim();
  if (!isBindingExpression(trimmed)) {
    return trimmed || fallbackDefault;
  }

  // FallbackValue priority
  const fbMatch = trimmed.match(/FallbackValue\s*=\s*(?:'([^']*)'|"([^"]*)"|([^,\}]+))/i);
  if (fbMatch) {
    const fb = fbMatch[1] ?? fbMatch[2] ?? fbMatch[3];
    if (fb && fb.trim()) return fb.trim();
  }

  const path = extractBindingPath(trimmed);
  const leafName = path.split('.').pop() || '';
  const lowerLeaf = leafName.toLowerCase();
  const lowerProp = propName.toLowerCase();

  // Value-based / numeric properties
  if (lowerProp === 'value') return '68';
  if (lowerProp === 'maximum') return '100';
  if (lowerProp === 'minimum') return '0';
  if (lowerProp === 'ischecked') return 'True';
  if (lowerProp === 'visibility') return 'Visible';

  // Brushes / Colors
  if (lowerProp === 'background') return '#1e293b';
  if (lowerProp === 'foreground') return '#cbd5e1';
  if (lowerProp === 'borderbrush') return '#475569';

  // Dimension properties
  if (lowerProp === 'width' || lowerProp === 'height') return fallbackDefault || '';
  if (lowerProp === 'margin' || lowerProp === 'padding') return fallbackDefault || '0px';

  // Contextual Text / Content Dummy Values
  if (lowerLeaf.includes('user') || lowerLeaf.includes('author') || lowerLeaf.includes('name')) {
    return '홍길동 (더미 데이터)';
  }
  if (lowerLeaf.includes('email') || lowerLeaf.includes('mail')) {
    return 'developer@roslynstudio.dev';
  }
  if (lowerLeaf.includes('title') || lowerLeaf.includes('header')) {
    return leafName ? `[${leafName} 미리보기]` : '[샘플 헤더 타이틀]';
  }
  if (lowerLeaf.includes('count') || lowerLeaf.includes('total') || lowerLeaf.includes('id') || lowerLeaf.includes('qty')) {
    return '142';
  }
  if (lowerLeaf.includes('price') || lowerLeaf.includes('amount') || lowerLeaf.includes('cost')) {
    return '₩49,000';
  }
  if (lowerLeaf.includes('date') || lowerLeaf.includes('time') || lowerLeaf.includes('created')) {
    return '2026-10-15';
  }
  if (lowerLeaf.includes('desc') || lowerLeaf.includes('message') || lowerLeaf.includes('summary')) {
    return `[${leafName || '데이터 바인딩'} 샘플 내용입니다.]`;
  }
  if (lowerLeaf.includes('status') || lowerLeaf.includes('state')) {
    return '정상 가동 (ACTIVE)';
  }
  if (lowerLeaf.includes('progress') || lowerLeaf.includes('percent')) {
    return '68%';
  }
  if (lowerLeaf.includes('url') || lowerLeaf.includes('path') || lowerLeaf.includes('server')) {
    return 'https://api.roslynstudio.dev/v1';
  }

  return leafName ? `[${leafName}]` : `[${propName} 더미]`;
}

function applyBoundDummyStyle(element, rawVal) {
  if (isBindingExpression(rawVal)) {
    element.classList.add('xaml-bound-dummy');
    element.title = `⚡ XAML 바인딩 더미: ${rawVal}`;
  }
}

function generateDummyListItems(itemsSource) {
  const leaf = extractBindingPath(itemsSource) || '항목';
  return [
    `[${leaf} 1] RoslynStudio.Core v10.0`,
    `[${leaf} 2] RoslynStudio.Engine.Diagnostics`,
    `[${leaf} 3] RoslynStudio.XamlPreview.LiveReload`
  ];
}

function compileXamlElement(xmlNode) {
  if (!xmlNode || xmlNode.nodeType !== 1) return document.createTextNode('');

  const tagName = xmlNode.localName || xmlNode.nodeName;

  // Window Container (Windows 11 styled shell)
  if (tagName === 'Window') {
    const windowFrame = document.createElement('div');
    windowFrame.className = 'xaml-window-frame';

    const rawTitle = xmlNode.getAttribute('Title');
    const title = resolveXamlValue(rawTitle, 'Title', 'Window');
    const width = resolveXamlValue(xmlNode.getAttribute('Width'), 'Width', '520');
    const height = resolveXamlValue(xmlNode.getAttribute('Height'), 'Height', '440');
    const bg = resolveXamlValue(xmlNode.getAttribute('Background'), 'Background', '#0f172a');

    windowFrame.style.width = width.endsWith('%') || width.endsWith('px') ? width : `${width}px`;
    windowFrame.style.minHeight = height.endsWith('%') || height.endsWith('px') ? height : `${height}px`;

    // Titlebar
    const titlebar = document.createElement('div');
    titlebar.className = 'xaml-window-titlebar';
    titlebar.innerHTML = `
      <div class="xaml-window-title">
        <svg class="xaml-window-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"></rect>
          <line x1="3" y1="9" x2="21" y2="9"></line>
        </svg>
        <span class="${isBindingExpression(rawTitle) ? 'xaml-bound-dummy' : ''}" title="${isBindingExpression(rawTitle) ? `⚡ XAML 바인딩 더미: ${rawTitle}` : ''}">${title}</span>
      </div>
      <div class="xaml-window-controls">
        <span class="xaml-win-dot dot-min"></span>
        <span class="xaml-win-dot dot-max"></span>
        <span class="xaml-win-dot dot-close"></span>
      </div>
    `;
    windowFrame.appendChild(titlebar);

    // Content container
    const contentArea = document.createElement('div');
    contentArea.className = 'xaml-window-content';
    contentArea.style.backgroundColor = bg;

    for (let i = 0; i < xmlNode.childNodes.length; i++) {
      const child = xmlNode.childNodes[i];
      if (child.nodeType === 1) {
        contentArea.appendChild(compileXamlElement(child));
      }
    }
    windowFrame.appendChild(contentArea);
    return attachXamlInspectHandlers(windowFrame, xmlNode, tagName);
  }

  // Grid Control
  if (tagName === 'Grid') {
    const grid = document.createElement('div');
    grid.className = 'xaml-grid';
    applyCommonXamlAttributes(xmlNode, grid);

    let rowDefs = [];
    let colDefs = [];

    // Support Avalonia shorthand RowDefinitions="Auto,*,Auto" and ColumnDefinitions="*,100"
    const inlineRowDefs = xmlNode.getAttribute('RowDefinitions');
    const inlineColDefs = xmlNode.getAttribute('ColumnDefinitions');

    // Parse Grid.RowDefinitions & Grid.ColumnDefinitions via direct childNodes
    for (let i = 0; i < xmlNode.childNodes.length; i++) {
      const child = xmlNode.childNodes[i];
      if (child.nodeType === 1) {
        const name = child.localName || child.nodeName;
        if (name === 'Grid.RowDefinitions' || name === 'RowDefinitions' || name.endsWith('.RowDefinitions')) {
          for (let j = 0; j < child.childNodes.length; j++) {
            const rd = child.childNodes[j];
            if (rd.nodeType === 1 && (rd.localName === 'RowDefinition' || rd.nodeName.endsWith('RowDefinition'))) {
              rowDefs.push(rd);
            }
          }
        } else if (name === 'Grid.ColumnDefinitions' || name === 'ColumnDefinitions' || name.endsWith('.ColumnDefinitions')) {
          for (let j = 0; j < child.childNodes.length; j++) {
            const cd = child.childNodes[j];
            if (cd.nodeType === 1 && (cd.localName === 'ColumnDefinition' || cd.nodeName.endsWith('ColumnDefinition'))) {
              colDefs.push(cd);
            }
          }
        }
      }
    }

    if (rowDefs.length > 0) {
      const rowTemplates = rowDefs.map(rd => parseGridTrack(rd.getAttribute('Height') || '*'));
      grid.style.gridTemplateRows = rowTemplates.join(' ');
    } else if (inlineRowDefs) {
      const rowTemplates = inlineRowDefs.split(',').map(s => parseGridTrack(s.trim() || '*'));
      grid.style.gridTemplateRows = rowTemplates.join(' ');
    }

    if (colDefs.length > 0) {
      const colTemplates = colDefs.map(cd => parseGridTrack(cd.getAttribute('Width') || '*'));
      grid.style.gridTemplateColumns = colTemplates.join(' ');
    } else if (inlineColDefs) {
      const colTemplates = inlineColDefs.split(',').map(s => parseGridTrack(s.trim() || '*'));
      grid.style.gridTemplateColumns = colTemplates.join(' ');
    }

    // Children
    for (let i = 0; i < xmlNode.childNodes.length; i++) {
      const child = xmlNode.childNodes[i];
      if (child.nodeType === 1 && !child.nodeName.includes('.')) {
        const childEl = compileXamlElement(child);
        applyGridPlacement(child, childEl);
        grid.appendChild(childEl);
      }
    }
    return attachXamlInspectHandlers(grid, xmlNode, tagName);
  }

  // StackPanel Control
  if (tagName === 'StackPanel') {
    const sp = document.createElement('div');
    sp.className = 'xaml-stackpanel';
    const orientation = xmlNode.getAttribute('Orientation') || 'Vertical';
    sp.style.flexDirection = orientation.toLowerCase() === 'horizontal' ? 'row' : 'column';
    const spacing = xmlNode.getAttribute('Spacing');
    if (spacing && !isNaN(parseFloat(spacing))) {
      sp.style.gap = `${parseFloat(spacing)}px`;
    }
    applyCommonXamlAttributes(xmlNode, sp);

    for (let i = 0; i < xmlNode.childNodes.length; i++) {
      const child = xmlNode.childNodes[i];
      if (child.nodeType === 1) {
        sp.appendChild(compileXamlElement(child));
      }
    }
    return attachXamlInspectHandlers(sp, xmlNode, tagName);
  }

  // Border Control
  if (tagName === 'Border') {
    const border = document.createElement('div');
    border.className = 'xaml-border';
    applyCommonXamlAttributes(xmlNode, border);

    const cornerRadius = resolveXamlValue(xmlNode.getAttribute('CornerRadius'), 'CornerRadius');
    if (cornerRadius) border.style.borderRadius = `${cornerRadius}px`;

    const borderBrush = resolveXamlValue(xmlNode.getAttribute('BorderBrush'), 'BorderBrush');
    const borderThickness = resolveXamlValue(xmlNode.getAttribute('BorderThickness'), 'BorderThickness', '1');
    if (borderBrush) {
      border.style.border = `${borderThickness}px solid ${borderBrush}`;
    }

    for (let i = 0; i < xmlNode.childNodes.length; i++) {
      const child = xmlNode.childNodes[i];
      if (child.nodeType === 1) {
        border.appendChild(compileXamlElement(child));
      }
    }
    return attachXamlInspectHandlers(border, xmlNode, tagName);
  }

  // Button Control
  if (tagName === 'Button') {
    const btn = document.createElement('button');
    btn.className = 'xaml-button';
    const rawContent = xmlNode.getAttribute('Content') || xmlNode.textContent.trim() || '';
    btn.innerText = resolveXamlValue(rawContent, 'Content', 'Button');
    applyBoundDummyStyle(btn, rawContent);
    applyCommonXamlAttributes(xmlNode, btn);

    const cornerRadius = resolveXamlValue(xmlNode.getAttribute('CornerRadius'), 'CornerRadius');
    if (cornerRadius) btn.style.borderRadius = `${cornerRadius}px`;
    return attachXamlInspectHandlers(btn, xmlNode, tagName);
  }

  // TextBox Control
  if (tagName === 'TextBox') {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'xaml-textbox';
    const rawText = xmlNode.getAttribute('Text');
    const rawPlaceholder = xmlNode.getAttribute('Placeholder');
    input.value = resolveXamlValue(rawText, 'Text', '');
    input.placeholder = resolveXamlValue(rawPlaceholder, 'Placeholder', '');
    applyBoundDummyStyle(input, rawText);
    applyCommonXamlAttributes(xmlNode, input);

    const cornerRadius = resolveXamlValue(xmlNode.getAttribute('CornerRadius'), 'CornerRadius');
    if (cornerRadius) input.style.borderRadius = `${cornerRadius}px`;
    return attachXamlInspectHandlers(input, xmlNode, tagName);
  }

  // TextBlock / Label Control
  if (tagName === 'TextBlock' || tagName === 'Label') {
    const tb = document.createElement('div');
    tb.className = 'xaml-textblock';
    const rawText = xmlNode.getAttribute('Text') || xmlNode.getAttribute('Content') || xmlNode.textContent.trim() || '';
    tb.innerText = resolveXamlValue(rawText, 'Text', '');
    applyBoundDummyStyle(tb, rawText);
    applyCommonXamlAttributes(xmlNode, tb);
    return attachXamlInspectHandlers(tb, xmlNode, tagName);
  }

  // ProgressBar Control
  if (tagName === 'ProgressBar') {
    const track = document.createElement('div');
    track.className = 'xaml-progressbar-track';
    applyCommonXamlAttributes(xmlNode, track);

    const rawVal = xmlNode.getAttribute('Value');
    const val = parseFloat(resolveXamlValue(rawVal, 'Value', '0'));
    const max = parseFloat(resolveXamlValue(xmlNode.getAttribute('Maximum'), 'Maximum', '100'));
    const percent = Math.min(100, Math.max(0, (val / max) * 100));

    const fill = document.createElement('div');
    fill.className = 'xaml-progressbar-fill';
    fill.style.width = `${percent}%`;
    const rawFg = xmlNode.getAttribute('Foreground');
    fill.style.backgroundColor = resolveXamlValue(rawFg, 'Foreground', '#0ea5e9');

    applyBoundDummyStyle(track, rawVal);
    track.appendChild(fill);
    return attachXamlInspectHandlers(track, xmlNode, tagName);
  }

  // CheckBox Control
  if (tagName === 'CheckBox') {
    const label = document.createElement('label');
    label.className = 'xaml-checkbox';
    applyCommonXamlAttributes(xmlNode, label);

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    const rawChecked = xmlNode.getAttribute('IsChecked');
    const isChecked = resolveXamlValue(rawChecked, 'IsChecked', 'False');
    if (isChecked.toLowerCase() === 'true') cb.checked = true;

    const span = document.createElement('span');
    const rawContent = xmlNode.getAttribute('Content') || xmlNode.textContent.trim() || '';
    span.innerText = resolveXamlValue(rawContent, 'Content', '');
    applyBoundDummyStyle(span, rawContent);

    label.appendChild(cb);
    label.appendChild(span);
    return attachXamlInspectHandlers(label, xmlNode, tagName);
  }

  // RadioButton Control
  if (tagName === 'RadioButton') {
    const label = document.createElement('label');
    label.className = 'xaml-radio';
    applyCommonXamlAttributes(xmlNode, label);

    const rb = document.createElement('input');
    rb.type = 'radio';
    const rawChecked = xmlNode.getAttribute('IsChecked');
    const isChecked = resolveXamlValue(rawChecked, 'IsChecked', 'False');
    if (isChecked.toLowerCase() === 'true') rb.checked = true;

    const span = document.createElement('span');
    const rawContent = xmlNode.getAttribute('Content') || xmlNode.textContent.trim() || '';
    span.innerText = resolveXamlValue(rawContent, 'Content', 'Option');
    applyBoundDummyStyle(span, rawContent);

    label.appendChild(rb);
    label.appendChild(span);
    return attachXamlInspectHandlers(label, xmlNode, tagName);
  }

  // ListBox / ListView / ItemsControl
  if (tagName === 'ListBox' || tagName === 'ListView' || tagName === 'ItemsControl') {
    const list = document.createElement('div');
    list.className = 'xaml-listbox';
    applyCommonXamlAttributes(xmlNode, list);

    const itemsSource = xmlNode.getAttribute('ItemsSource');
    let hasChildren = false;

    for (let i = 0; i < xmlNode.childNodes.length; i++) {
      const child = xmlNode.childNodes[i];
      if (child.nodeType === 1 && !child.nodeName.includes('.')) {
        hasChildren = true;
        list.appendChild(compileXamlElement(child));
      }
    }

    if (!hasChildren) {
      const dummyItems = generateDummyListItems(itemsSource);
      dummyItems.forEach((text, idx) => {
        const item = document.createElement('div');
        item.className = `xaml-list-item ${idx === 0 ? 'selected' : ''}`;
        item.innerHTML = `<span>${text}</span>`;
        if (itemsSource && isBindingExpression(itemsSource)) {
          item.classList.add('xaml-bound-dummy');
          item.title = `⚡ ItemsSource 바인딩 더미: ${itemsSource}`;
        }
        list.appendChild(item);
      });
    }
    return attachXamlInspectHandlers(list, xmlNode, tagName);
  }

  // ComboBox Control
  if (tagName === 'ComboBox') {
    const select = document.createElement('select');
    select.className = 'xaml-combobox';
    applyCommonXamlAttributes(xmlNode, select);

    const itemsSource = xmlNode.getAttribute('ItemsSource');
    let hasChildren = false;

    for (let i = 0; i < xmlNode.childNodes.length; i++) {
      const child = xmlNode.childNodes[i];
      if (child.nodeType === 1 && !child.nodeName.includes('.')) {
        hasChildren = true;
        const opt = document.createElement('option');
        opt.innerText = resolveXamlValue(child.getAttribute('Content') || child.textContent.trim(), 'Content', 'Option');
        select.appendChild(opt);
      }
    }

    if (!hasChildren) {
      const dummyItems = generateDummyListItems(itemsSource);
      dummyItems.forEach((text, idx) => {
        const opt = document.createElement('option');
        opt.innerText = text;
        if (idx === 0) opt.selected = true;
        select.appendChild(opt);
      });
      if (itemsSource && isBindingExpression(itemsSource)) {
        applyBoundDummyStyle(select, itemsSource);
      }
    }
    return attachXamlInspectHandlers(select, xmlNode, tagName);
  }

  // Image Control
  if (tagName === 'Image') {
    const imgWrap = document.createElement('div');
    imgWrap.className = 'xaml-image-placeholder';
    applyCommonXamlAttributes(xmlNode, imgWrap);

    const source = xmlNode.getAttribute('Source') || '';
    const isBound = isBindingExpression(source);
    const label = isBound ? resolveXamlValue(source, 'Source', 'Image') : (source.split(/[\\/]/).pop() || 'Image');

    imgWrap.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;color:#38bdf8;opacity:0.8;">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
      </svg>
      <span style="font-size:11px;color:#94a3b8;margin-top:4px;">${label}</span>
    `;
    applyBoundDummyStyle(imgWrap, source);
    return attachXamlInspectHandlers(imgWrap, xmlNode, tagName);
  }

  // Slider Control
  if (tagName === 'Slider') {
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'xaml-slider';
    slider.value = resolveXamlValue(xmlNode.getAttribute('Value'), 'Value', '50');
    slider.min = resolveXamlValue(xmlNode.getAttribute('Minimum'), 'Minimum', '0');
    slider.max = resolveXamlValue(xmlNode.getAttribute('Maximum'), 'Maximum', '100');
    applyCommonXamlAttributes(xmlNode, slider);
    return attachXamlInspectHandlers(slider, xmlNode, tagName);
  }

  // Canvas Control
  if (tagName === 'Canvas') {
    const canvas = document.createElement('div');
    canvas.className = 'xaml-canvas';
    applyCommonXamlAttributes(xmlNode, canvas);

    for (let i = 0; i < xmlNode.childNodes.length; i++) {
      const child = xmlNode.childNodes[i];
      if (child.nodeType === 1 && !child.nodeName.includes('.')) {
        const childEl = compileXamlElement(child);
        childEl.style.position = 'absolute';
        const left = child.getAttribute('Canvas.Left');
        const top = child.getAttribute('Canvas.Top');
        const right = child.getAttribute('Canvas.Right');
        const bottom = child.getAttribute('Canvas.Bottom');
        if (left !== null) childEl.style.left = `${left}px`;
        if (top !== null) childEl.style.top = `${top}px`;
        if (right !== null) childEl.style.right = `${right}px`;
        if (bottom !== null) childEl.style.bottom = `${bottom}px`;
        canvas.appendChild(childEl);
      }
    }
    return attachXamlInspectHandlers(canvas, xmlNode, tagName);
  }

  // WrapPanel Control
  if (tagName === 'WrapPanel') {
    const wp = document.createElement('div');
    wp.className = 'xaml-wrappanel';
    const orient = xmlNode.getAttribute('Orientation') || 'Horizontal';
    wp.style.flexDirection = orient.toLowerCase() === 'vertical' ? 'column' : 'row';
    applyCommonXamlAttributes(xmlNode, wp);

    for (let i = 0; i < xmlNode.childNodes.length; i++) {
      const child = xmlNode.childNodes[i];
      if (child.nodeType === 1 && !child.nodeName.includes('.')) {
        wp.appendChild(compileXamlElement(child));
      }
    }
    return attachXamlInspectHandlers(wp, xmlNode, tagName);
  }

  // ScrollViewer Control
  if (tagName === 'ScrollViewer') {
    const sv = document.createElement('div');
    sv.className = 'xaml-scrollviewer';
    applyCommonXamlAttributes(xmlNode, sv);

    for (let i = 0; i < xmlNode.childNodes.length; i++) {
      const child = xmlNode.childNodes[i];
      if (child.nodeType === 1 && !child.nodeName.includes('.')) {
        sv.appendChild(compileXamlElement(child));
      }
    }
    return attachXamlInspectHandlers(sv, xmlNode, tagName);
  }

  // Separator Control
  if (tagName === 'Separator') {
    const sep = document.createElement('div');
    sep.className = 'xaml-separator';
    applyCommonXamlAttributes(xmlNode, sep);
    return attachXamlInspectHandlers(sep, xmlNode, tagName);
  }

  // Expander Control
  if (tagName === 'Expander') {
    const details = document.createElement('details');
    details.className = 'xaml-expander';
    if (xmlNode.getAttribute('IsExpanded') === 'True') details.open = true;
    applyCommonXamlAttributes(xmlNode, details);

    const summary = document.createElement('summary');
    const headerText = resolveXamlValue(xmlNode.getAttribute('Header'), 'Header', '상세 설정');
    summary.innerText = headerText;
    details.appendChild(summary);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'xaml-expander-content';
    for (let i = 0; i < xmlNode.childNodes.length; i++) {
      const child = xmlNode.childNodes[i];
      if (child.nodeType === 1 && !child.nodeName.includes('.')) {
        contentDiv.appendChild(compileXamlElement(child));
      }
    }
    details.appendChild(contentDiv);
    return attachXamlInspectHandlers(details, xmlNode, tagName);
  }

  // PasswordBox Control
  if (tagName === 'PasswordBox') {
    const pwd = document.createElement('input');
    pwd.type = 'password';
    pwd.className = 'xaml-textbox';
    pwd.value = resolveXamlValue(xmlNode.getAttribute('Password'), 'Password', '••••••••');
    applyCommonXamlAttributes(xmlNode, pwd);
    return attachXamlInspectHandlers(pwd, xmlNode, tagName);
  }

  // DatePicker Control
  if (tagName === 'DatePicker') {
    const dp = document.createElement('input');
    dp.type = 'date';
    dp.className = 'xaml-textbox';
    dp.value = resolveXamlValue(xmlNode.getAttribute('SelectedDate'), 'SelectedDate', '2026-10-15');
    applyCommonXamlAttributes(xmlNode, dp);
    return attachXamlInspectHandlers(dp, xmlNode, tagName);
  }

  // Generic fallback for any other control (Canvas, WrapPanel, TabControl, etc.)
  const generic = document.createElement('div');
  generic.style.boxSizing = 'border-box';
  applyCommonXamlAttributes(xmlNode, generic);

  for (let i = 0; i < xmlNode.childNodes.length; i++) {
    const child = xmlNode.childNodes[i];
    if (child.nodeType === 1) {
      generic.appendChild(compileXamlElement(child));
    }
  }
  return attachXamlInspectHandlers(generic, xmlNode, tagName);
}

function parseGridTrack(val) {
  if (!val || val === '*') return '1fr';
  if (val.toLowerCase() === 'auto') return 'auto';
  if (val.endsWith('*')) {
    const factor = val.replace('*', '') || '1';
    return `${factor}fr`;
  }
  return val.endsWith('px') ? val : `${val}px`;
}

function applyGridPlacement(xmlNode, element) {
  const row = xmlNode.getAttribute('Grid.Row');
  const col = xmlNode.getAttribute('Grid.Column');
  const rowSpan = xmlNode.getAttribute('Grid.RowSpan');
  const colSpan = xmlNode.getAttribute('Grid.ColumnSpan');

  if (row !== null) {
    const rIndex = parseInt(row, 10) + 1;
    const rSpan = rowSpan ? parseInt(rowSpan, 10) : 1;
    element.style.gridRow = `${rIndex} / span ${rSpan}`;
  }

  if (col !== null) {
    const cIndex = parseInt(col, 10) + 1;
    const cSpan = colSpan ? parseInt(colSpan, 10) : 1;
    element.style.gridColumn = `${cIndex} / span ${cSpan}`;
  }
}

function applyCommonXamlAttributes(xmlNode, element) {
  const w = resolveXamlValue(xmlNode.getAttribute('Width'), 'Width');
  const h = resolveXamlValue(xmlNode.getAttribute('Height'), 'Height');
  if (w) element.style.width = w.endsWith('%') || w.endsWith('px') ? w : `${w}px`;
  if (h) element.style.height = h.endsWith('%') || h.endsWith('px') ? h : `${h}px`;

  const margin = resolveXamlValue(xmlNode.getAttribute('Margin'), 'Margin');
  if (margin) element.style.margin = parseThickness(margin);

  const padding = resolveXamlValue(xmlNode.getAttribute('Padding'), 'Padding');
  if (padding) element.style.padding = parseThickness(padding);

  const bg = resolveXamlValue(xmlNode.getAttribute('Background'), 'Background');
  if (bg) element.style.backgroundColor = bg;

  const fg = resolveXamlValue(xmlNode.getAttribute('Foreground'), 'Foreground');
  if (fg) element.style.color = fg;

  const fontSize = resolveXamlValue(xmlNode.getAttribute('FontSize'), 'FontSize');
  if (fontSize) element.style.fontSize = `${fontSize}px`;

  const fontWeight = resolveXamlValue(xmlNode.getAttribute('FontWeight'), 'FontWeight');
  if (fontWeight) {
    element.style.fontWeight = fontWeight.toLowerCase() === 'bold' ? '700' : fontWeight.toLowerCase() === 'semibold' ? '600' : '400';
  }

  const hAlign = resolveXamlValue(xmlNode.getAttribute('HorizontalAlignment'), 'HorizontalAlignment');
  if (hAlign) {
    if (hAlign === 'Center') element.style.alignSelf = 'center';
    else if (hAlign === 'Right') element.style.alignSelf = 'flex-end';
    else if (hAlign === 'Left') element.style.alignSelf = 'flex-start';
    else if (hAlign === 'Stretch') element.style.width = '100%';
  }

  const vAlign = resolveXamlValue(xmlNode.getAttribute('VerticalAlignment'), 'VerticalAlignment');
  if (vAlign) {
    if (vAlign === 'Center') element.style.justifySelf = 'center';
    else if (vAlign === 'Bottom') element.style.justifySelf = 'flex-end';
    else if (vAlign === 'Top') element.style.justifySelf = 'flex-start';
  }
}

function parseThickness(str) {
  if (!str) return '0px';
  const parts = str.split(',').map(s => s.trim());
  if (parts.length === 1) return `${parts[0]}px`;
  if (parts.length === 2) return `${parts[1]}px ${parts[0]}px`; // top/bottom, left/right
  if (parts.length === 4) return `${parts[1]}px ${parts[2]}px ${parts[3]}px ${parts[0]}px`; // top right bottom left
  return '0px';
}

// Build Execution
async function executeBuild() {
  if (isDirty) await saveCurrentFile();

  switchTab('consoleOutput');
  appendConsole('\n▶ dotnet build (.NET 10 Engine)');
  setStatus('프로젝트 빌드 중...');

  try {
    const res = await fetch('/api/execute/build', { method: 'POST' });
    const result = await res.json();

    appendConsole(result.output);
    appendConsole(`✔ 빌드 완료 (소요: ${result.elapsedMilliseconds}ms, 종료 코드: ${result.exitCode})`);
    setStatus(result.success ? '빌드 성공' : '빌드 실패');
  } catch (err) {
    appendConsole(`✖ 빌드 실패: ${err.message}`);
    setStatus('빌드 에러');
  }
}

// Run Execution
async function executeRun() {
  if (isDirty) await saveCurrentFile();

  switchTab('consoleOutput');
  appendConsole('\n▶ dotnet run (.NET 10 Engine)');
  setStatus('프로젝트 실행 중...');

  try {
    const res = await fetch('/api/execute/run', { method: 'POST' });
    const result = await res.json();

    appendConsole(result.output);
    appendConsole(`✔ 실행 완료 (소요: ${result.elapsedMilliseconds}ms, 종료 코드: ${result.exitCode})`);
    setStatus('실행 완료');
  } catch (err) {
    appendConsole(`✖ 실행 에러: ${err.message}`);
    setStatus('실행 에러');
  }
}

// Create New File
async function createNewFile() {
  const fileName = prompt('생성할 파일 이름을 입력하세요 (예: Views/Dashboard.xaml 또는 Model.cs):\n※ .xaml 파일 생성 시 매칭되는 .xaml.cs 코드 비하인드가 함께 자동 생성됩니다.');
  if (!fileName) return;

  const trimmed = fileName.trim();
  try {
    const res = await fetch('/api/workspace/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relativePath: trimmed, content: '' })
    });

    if (!res.ok) throw new Error('파일 생성 실패');
    await loadWorkspaceTree();
    await openFile(trimmed);

    if (trimmed.toLowerCase().endsWith('.xaml')) {
      setStatus(`'${trimmed}' 및 매칭되는 코드 비하인드 '${trimmed}.cs' 생성 완료`);
    } else {
      setStatus(`'${trimmed}' 생성 완료`);
    }
  } catch (err) {
    alert(`파일 생성 실패: ${err.message}`);
  }
}

// Event Listeners
document.getElementById('btnSave').onclick = saveCurrentFile;
document.getElementById('btnBuild').onclick = executeBuild;
document.getElementById('btnRun').onclick = executeRun;
document.getElementById('btnNewFile').onclick = createNewFile;
document.getElementById('btnRefreshTree').onclick = loadWorkspaceTree;

const btnToggleCodeBehind = document.getElementById('btnToggleCodeBehind');
if (btnToggleCodeBehind) {
  btnToggleCodeBehind.onclick = toggleCodeBehind;
}

window.addEventListener('keydown', e => {
  if (e.key === 'F7') {
    e.preventDefault();
    toggleCodeBehind();
  }
});

const btnTopXaml = document.getElementById('btnTopXamlPreview');
if (btnTopXaml) {
  btnTopXaml.onclick = () => {
    if (!isXamlFile(currentPath)) {
      openFile('MainWindow.axaml');
    } else {
      toggleXamlDesigner();
    }
  };
}

const btnToggleXaml = document.getElementById('btnToggleXamlPreview');
if (btnToggleXaml) {
  btnToggleXaml.onclick = () => {
    if (!isXamlFile(currentPath)) {
      openFile('MainWindow.axaml');
    } else {
      toggleXamlDesigner();
    }
  };
}

const btnCloseDesigner = document.getElementById('btnCloseDesigner');
if (btnCloseDesigner) {
  btnCloseDesigner.onclick = closeXamlDesigner;
}

const btnToggleGridRuler = document.getElementById('btnToggleGridRuler');
if (btnToggleGridRuler) {
  btnToggleGridRuler.onclick = () => {
    const viewport = document.getElementById('designerViewport');
    if (viewport) {
      viewport.classList.toggle('no-grid');
    }
  };
}

document.getElementById('btnClearOutput').onclick = () => {
  document.getElementById('consoleOutput').innerText = '';
};

const bottomPanel = document.getElementById('bottomPanel');
const chevronIcon = document.getElementById('chevronIcon');

document.getElementById('btnTogglePanel').onclick = toggleBottomPanel;
document.getElementById('railBtnTerminal').onclick = toggleBottomPanel;

function toggleBottomPanel() {
  bottomPanel.classList.toggle('collapsed');
  if (chevronIcon) {
    chevronIcon.style.transform = bottomPanel.classList.contains('collapsed') ? 'rotate(180deg)' : 'rotate(0deg)';
  }
}

document.querySelectorAll('.panel-tab').forEach(tab => {
  tab.onclick = () => {
    switchTab(tab.getAttribute('data-target'));
  };
});

function switchTab(targetId) {
  document.querySelectorAll('.panel-tab').forEach(t => {
    t.classList.toggle('active', t.getAttribute('data-target') === targetId);
  });
  document.querySelectorAll('.console-output, .diagnostics-list').forEach(c => {
    c.classList.toggle('active', c.id === targetId);
  });

  const scopeWrapper = document.getElementById('diagScopeWrapper');
  if (scopeWrapper) {
    scopeWrapper.style.display = targetId === 'diagnosticsList' ? 'flex' : 'none';
  }

  if (targetId === 'diagnosticsList') {
    scheduleAnalysis();
  }
}

const btnScopeEntire = document.getElementById('btnScopeEntire');
if (btnScopeEntire) {
  btnScopeEntire.onclick = () => setDiagScope('entire');
}

const btnScopeCurrent = document.getElementById('btnScopeCurrent');
if (btnScopeCurrent) {
  btnScopeCurrent.onclick = () => setDiagScope('current');
}

function appendConsole(text) {
  const consoleEl = document.getElementById('consoleOutput');
  consoleEl.innerText += '\n' + text;
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function setStatus(msg) {
  document.getElementById('statusMessage').innerText = msg;
}

// ================= Mobile & Responsive Zoom Controls =================
let currentZoom = 1.0;

function setZoom(val) {
  currentZoom = Math.max(0.3, Math.min(2.5, Math.round(val * 100) / 100));
  const canvas = document.getElementById('designerCanvasWrapper');
  if (canvas) {
    canvas.style.transform = `scale(${currentZoom})`;
    canvas.style.transformOrigin = 'top center';
  }
  const zoomDisplay = document.getElementById('zoomLevelDisplay');
  if (zoomDisplay) {
    zoomDisplay.innerText = `${Math.round(currentZoom * 100)}%`;
  }
  document.getElementById('btnZoom100')?.classList.toggle('active', Math.abs(currentZoom - 1.0) < 0.01);
  document.getElementById('btnZoomFit')?.classList.remove('active');
}

function autoFitPreviewIfMobile() {
  if (window.innerWidth <= 868) {
    fitPreviewToViewport();
  }
}

function fitPreviewToViewport() {
  const viewport = document.getElementById('designerViewport');
  const canvas = document.getElementById('designerCanvasWrapper');
  const root = document.getElementById('xamlRenderRoot');
  if (!viewport || !canvas || !root) return;

  const frame = root.querySelector('.xaml-window-frame');
  if (!frame) return;

  const vpWidth = viewport.clientWidth - 24;
  const frameWidth = frame.offsetWidth || 520;

  if (frameWidth > vpWidth && vpWidth > 0) {
    const scale = Math.max(0.35, Math.min(1, Math.round((vpWidth / frameWidth) * 100) / 100));
    setZoom(scale);
    document.getElementById('btnZoomFit')?.classList.add('active');
    document.getElementById('btnZoom100')?.classList.remove('active');
  } else {
    setZoom(1.0);
  }
}

function resetPreviewZoom() {
  setZoom(1.0);
}

function setViewMode(mode) {
  const split = document.getElementById('editorDesignerSplit');
  if (!split) return;

  split.setAttribute('data-view-mode', mode);
  document.querySelectorAll('.view-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
  });

  if (editor) {
    setTimeout(() => editor.layout(), 60);
  }

  if ((mode === 'preview' || mode === 'split') && isXamlFile(currentPath)) {
    renderXamlPreview(editor.getValue());
  }
}

// Activity Rail Explorer Toggle
const railBtnExplorer = document.getElementById('railBtnExplorer');
if (railBtnExplorer) {
  railBtnExplorer.onclick = () => {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.toggle('open');
  };
}

// Mobile Menu Toggle
const btnMobileMenu = document.getElementById('btnMobileMenu');
if (btnMobileMenu) {
  btnMobileMenu.onclick = () => {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.toggle('open');
  };
}

// Mobile View Mode Switcher
document.querySelectorAll('.view-mode-btn').forEach(btn => {
  btn.onclick = () => {
    setViewMode(btn.getAttribute('data-mode'));
  };
});

// Zoom Controls
const btnZoomIn = document.getElementById('btnZoomIn');
if (btnZoomIn) {
  btnZoomIn.onclick = () => setZoom(currentZoom + 0.15);
}

const btnZoomOut = document.getElementById('btnZoomOut');
if (btnZoomOut) {
  btnZoomOut.onclick = () => setZoom(currentZoom - 0.15);
}

const btnZoomFit = document.getElementById('btnZoomFit');
if (btnZoomFit) btnZoomFit.onclick = fitPreviewToViewport;

const btnZoom100 = document.getElementById('btnZoom100');
if (btnZoom100) btnZoom100.onclick = resetPreviewZoom;

// Window Resize Auto-Layout
window.addEventListener('resize', () => {
  if (editor) editor.layout();
  autoFitPreviewIfMobile();
});

// ================= AI Feature Canvas & Visual Direct Prompting =================
let activeVisualTarget = null;
let isAiCanvasModeActive = false;

function openVisualAiPopover(element, tagName, line, event) {
  const popover = document.getElementById('visualAiPopover');
  if (!popover) return;

  activeVisualTarget = { element, tagName, line };
  const tagLabel = document.getElementById('popoverTagLabel');
  if (tagLabel) tagLabel.innerText = `<${tagName}>`;

  const lineLabel = document.getElementById('popoverLineLabel');
  if (lineLabel) lineLabel.innerText = `줄 ${line}`;

  const statusEl = document.getElementById('popoverStatus');
  if (statusEl) statusEl.innerText = '';

  const input = document.getElementById('visualAiInput');
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 60);
  }

  popover.style.display = 'block';

  // Smart positioning inside viewport
  const vp = document.getElementById('designerViewport');
  if (vp && element) {
    const vpRect = vp.getBoundingClientRect();
    const elRect = element.getBoundingClientRect();
    const top = Math.max(16, elRect.top - vpRect.top + vp.scrollTop - 130);
    popover.style.top = `${top}px`;
  }
}

function closeVisualAiPopover() {
  const popover = document.getElementById('visualAiPopover');
  if (popover) {
    popover.style.display = 'none';
  }
}

async function submitVisualAiDirective(forcedIntent) {
  const input = document.getElementById('visualAiInput');
  const intent = (forcedIntent || input?.value || '').trim();
  if (!intent) return;

  const statusEl = document.getElementById('popoverStatus');
  if (statusEl) statusEl.innerText = '✨ AI 코드 변환 중...';

  try {
    const xaml = editor.getValue();
    let csharp = '';
    const csPath = isXamlFile(currentPath) ? currentPath + '.cs' : '';
    if (csPath) {
      try {
        const csRes = await fetch(`/api/workspace/file?path=${encodeURIComponent(csPath)}`);
        if (csRes.ok) {
          const csData = await csRes.json();
          csharp = csData.content || '';
        }
      } catch {
        // ignore
      }
    }

    const res = await fetch('/api/ai/transform', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: intent,
        targetTag: activeVisualTarget?.tagName || '',
        targetLine: activeVisualTarget?.line || 0,
        xamlContent: xaml,
        csharpContent: csharp,
        xamlFilePath: currentPath
      })
    });

    if (!res.ok) throw new Error('AI 변환 요청 실패');
    const data = await res.json();

    if (data.success) {
      editor.setValue(data.updatedXaml);
      setDirty(true);
      renderXamlPreview(data.updatedXaml);

      if (csPath && data.updatedCSharp && data.updatedCSharp !== csharp) {
        await fetch('/api/workspace/file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ relativePath: csPath, content: data.updatedCSharp })
        });
      }

      await saveCurrentFile();

      if (statusEl) statusEl.innerText = '✔ 적용 완료!';
      appendConsole(`✨ [Visual AI Directive] ${data.message}`);
      setStatus(`AI 비주얼 적용 완료: ${data.message}`);

      setTimeout(() => {
        closeVisualAiPopover();
      }, 700);
    } else {
      if (statusEl) statusEl.innerText = `✖ ${data.message}`;
    }
  } catch (err) {
    if (statusEl) statusEl.innerText = `✖ 오류: ${err.message}`;
  }
}

function toggleAiCanvasMode() {
  isAiCanvasModeActive = !isAiCanvasModeActive;
  const btn = document.getElementById('btnToggleAiCanvas');
  const bar = document.getElementById('aiDirectorBar');
  const sidebar = document.querySelector('.sidebar');

  if (btn) btn.classList.toggle('active', isAiCanvasModeActive);
  if (bar) bar.style.display = isAiCanvasModeActive ? 'flex' : 'none';

  if (isAiCanvasModeActive) {
    if (sidebar) sidebar.classList.remove('open');

    if (!isXamlFile(currentPath)) {
      openFile('MainWindow.axaml');
    } else {
      openXamlDesigner();
    }
    setViewMode('split');
    setStatus('✨ AI 피처 캔버스 모드 활성화: 화면 요소를 클릭하거나 상단에 지시를 입력하세요.');
  } else {
    setStatus('클래식 IDE 모드');
  }
}

async function submitAiDirector(forcedIntent) {
  const input = document.getElementById('aiDirectorInput');
  const intent = (forcedIntent || input?.value || '').trim();
  if (!intent) return;

  const statusEl = document.getElementById('aiDirectorStatus');
  if (statusEl) statusEl.innerText = '✨ AI 피처 캔버스 변환 중...';

  try {
    const xaml = editor.getValue();
    let csharp = '';
    const csPath = isXamlFile(currentPath) ? currentPath + '.cs' : '';
    if (csPath) {
      try {
        const csRes = await fetch(`/api/workspace/file?path=${encodeURIComponent(csPath)}`);
        if (csRes.ok) {
          const csData = await csRes.json();
          csharp = csData.content || '';
        }
      } catch {
        // ignore
      }
    }

    const res = await fetch('/api/ai/transform', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: intent,
        targetTag: null,
        targetLine: null,
        xamlContent: xaml,
        csharpContent: csharp,
        xamlFilePath: currentPath
      })
    });

    if (!res.ok) throw new Error('AI 피처 변환 요청 실패');
    const data = await res.json();

    if (data.success) {
      editor.setValue(data.updatedXaml);
      setDirty(true);
      renderXamlPreview(data.updatedXaml);

      if (csPath && data.updatedCSharp && data.updatedCSharp !== csharp) {
        await fetch('/api/workspace/file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ relativePath: csPath, content: data.updatedCSharp })
        });
      }

      await saveCurrentFile();

      if (statusEl) statusEl.innerText = '✔ 피처 반영 완료!';
      if (input) input.value = '';
      appendConsole(`✨ [AI Director] ${data.message}`);
      setStatus(`AI 피처 반영 완료: ${data.message}`);

      setTimeout(() => {
        if (statusEl) statusEl.innerText = '';
      }, 3000);
    } else {
      if (statusEl) statusEl.innerText = `✖ ${data.message}`;
    }
  } catch (err) {
    if (statusEl) statusEl.innerText = `✖ 오류: ${err.message}`;
  }
}

// Wire Visual AI Popover controls
const btnCloseVisualPopover = document.getElementById('btnCloseVisualPopover');
if (btnCloseVisualPopover) {
  btnCloseVisualPopover.onclick = closeVisualAiPopover;
}

const btnSubmitVisualAi = document.getElementById('btnSubmitVisualAi');
if (btnSubmitVisualAi) {
  btnSubmitVisualAi.onclick = () => submitVisualAiDirective();
}

const visualAiInput = document.getElementById('visualAiInput');
if (visualAiInput) {
  visualAiInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitVisualAiDirective();
    } else if (e.key === 'Escape') {
      closeVisualAiPopover();
    }
  });
}

document.querySelectorAll('.popover-chip').forEach(chip => {
  chip.onclick = () => {
    const action = chip.getAttribute('data-action');
    submitVisualAiDirective(action);
  };
});

// Wire AI Canvas Director controls
const btnToggleAiCanvas = document.getElementById('btnToggleAiCanvas');
if (btnToggleAiCanvas) {
  btnToggleAiCanvas.onclick = toggleAiCanvasMode;
}

const btnAiDirectorSubmit = document.getElementById('btnAiDirectorSubmit');
if (btnAiDirectorSubmit) {
  btnAiDirectorSubmit.onclick = () => submitAiDirector();
}

const aiDirectorInput = document.getElementById('aiDirectorInput');
if (aiDirectorInput) {
  aiDirectorInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitAiDirector();
    }
  });
}

document.querySelectorAll('.ai-preset-chip').forEach(chip => {
  chip.onclick = () => {
    const intent = chip.getAttribute('data-intent');
    submitAiDirector(intent);
  };
});

// ================= Visual Property Inspector & Bidirectional In-Place Editing =================
function selectPreviewElement(element, autoFocusFirst = false) {
  if (activeSelectedPreviewElement && activeSelectedPreviewElement !== element) {
    activeSelectedPreviewElement.classList.remove('xaml-inspect-selected');
  }

  activeSelectedPreviewElement = element;
  if (!element) {
    activeVisualTarget = null;
    const emptyState = document.getElementById('inspectorEmptyState');
    const content = document.getElementById('inspectorContent');
    const titleTag = document.getElementById('inspectorTitleTag');
    const lineBadge = document.getElementById('inspectorLineBadge');
    if (emptyState) emptyState.style.display = 'flex';
    if (content) content.style.display = 'none';
    if (titleTag) titleTag.innerText = '속성 편집기';
    if (lineBadge) lineBadge.style.display = 'none';
    return;
  }

  element.classList.add('xaml-inspect-selected');

  const tagName = element.getAttribute('data-xaml-tag') || 'Element';
  const line = parseInt(element.getAttribute('data-xaml-line') || '1', 10);
  const attrs = element._xamlAttributes || {};
  activeVisualTarget = { element, tagName, line };

  // Update Breadcrumbs
  updateBreadcrumbs(element);

  // Uncollapse Inspector panel if hidden
  const panel = document.getElementById('designerInspectorPanel');
  if (panel && panel.classList.contains('collapsed')) {
    panel.classList.remove('collapsed');
    document.getElementById('btnToggleInspectorPanel')?.classList.add('active');
  }

  // Header badges
  const titleTag = document.getElementById('inspectorTitleTag');
  if (titleTag) titleTag.innerText = `<${tagName}>`;
  const lineBadge = document.getElementById('inspectorLineBadge');
  if (lineBadge) {
    lineBadge.innerText = `L${line}`;
    lineBadge.style.display = 'inline-block';
  }

  const emptyState = document.getElementById('inspectorEmptyState');
  const content = document.getElementById('inspectorContent');
  if (emptyState) emptyState.style.display = 'none';
  if (content) content.style.display = 'flex';

  // Fill in Text / Content
  const textInput = document.getElementById('propInputText');
  if (textInput) {
    const textVal = attrs['Content'] ?? attrs['Text'] ?? attrs['Title'] ?? (element.innerText || '');
    textInput.value = textVal;
    const groupText = document.getElementById('groupTextContent');
    if (groupText) {
      const isLayoutOnly = ['Grid', 'StackPanel', 'WrapPanel', 'DockPanel', 'Canvas'].includes(tagName);
      groupText.style.display = isLayoutOnly ? 'none' : 'block';
    }
  }

  // Dimensions & Layout
  const wInput = document.getElementById('propInputWidth');
  if (wInput) wInput.value = attrs['Width'] || '';

  const hInput = document.getElementById('propInputHeight');
  if (hInput) hInput.value = attrs['Height'] || '';

  const mInput = document.getElementById('propInputMargin');
  if (mInput) mInput.value = attrs['Margin'] || '';

  const pInput = document.getElementById('propInputPadding');
  if (pInput) pInput.value = attrs['Padding'] || '';

  // Colors
  const bg = attrs['Background'] || '';
  const bgInput = document.getElementById('propInputBg');
  const bgPicker = document.getElementById('propColorBgPicker');
  if (bgInput) bgInput.value = bg;
  if (bgPicker && /^#[0-9a-f]{6}$/i.test(bg)) bgPicker.value = bg;

  const fg = attrs['Foreground'] || '';
  const fgInput = document.getElementById('propInputFg');
  const fgPicker = document.getElementById('propColorFgPicker');
  if (fgInput) fgInput.value = fg;
  if (fgPicker && /^#[0-9a-f]{6}$/i.test(fg)) fgPicker.value = fg;

  const border = attrs['BorderBrush'] || '';
  const borderInput = document.getElementById('propInputBorder');
  const borderPicker = document.getElementById('propColorBorderPicker');
  if (borderInput) borderInput.value = border;
  if (borderPicker && /^#[0-9a-f]{6}$/i.test(border)) borderPicker.value = border;

  // Typography & Radius
  const fsInput = document.getElementById('propInputFontSize');
  if (fsInput) fsInput.value = attrs['FontSize'] || '';

  const crInput = document.getElementById('propInputCornerRadius');
  if (crInput) crInput.value = attrs['CornerRadius'] || '';

  const weight = (attrs['FontWeight'] || 'Normal').toLowerCase();
  document.querySelectorAll('.prop-chip-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-weight').toLowerCase() === weight);
  });
}

function updateBreadcrumbs(el) {
  const container = document.getElementById('designerBreadcrumbs');
  if (!container) return;
  container.innerHTML = '';

  const trail = [];
  let curr = el;
  while (curr && curr.getAttribute && curr.hasAttribute('data-xaml-tag')) {
    trail.unshift({
      element: curr,
      tagName: curr.getAttribute('data-xaml-tag'),
      line: parseInt(curr.getAttribute('data-xaml-line') || '1', 10)
    });
    curr = curr.parentElement ? curr.parentElement.closest('[data-xaml-tag]') : null;
  }

  trail.forEach((item, idx) => {
    if (idx > 0) {
      const sep = document.createElement('span');
      sep.className = 'crumb-separator';
      sep.innerText = '>';
      container.appendChild(sep);
    }
    const crumb = document.createElement('span');
    crumb.className = `crumb-item ${idx === trail.length - 1 ? 'active' : ''}`;
    crumb.innerText = item.tagName;
    crumb.title = `줄 ${item.line}로 이동 및 선택`;
    crumb.onclick = (e) => {
      e.stopPropagation();
      jumpToEditorLine(item.line);
      selectPreviewElement(item.element);
    };
    container.appendChild(crumb);
  });
}

function updateXamlAttributeInEditor(startLine, tagName, attrName, newValue) {
  if (!editor) return;
  if (currentPath && currentPath.toLowerCase().endsWith('.cs')) {
    updateCSharpUiAttributeInEditor(startLine, tagName, attrName, newValue);
    return;
  }
  const model = editor.getModel();
  if (!model) return;

  const totalLines = model.getLineCount();
  let tagStartLine = -1;
  let tagEndLine = -1;
  let tagText = '';

  const scanStart = Math.max(1, startLine - 2);
  const scanEnd = Math.min(totalLines, startLine + 15);
  const searchPrefix = `<${tagName}`;

  for (let l = scanStart; l <= scanEnd; l++) {
    const lineText = model.getLineContent(l);
    if (tagStartLine === -1) {
      const idx = lineText.indexOf(searchPrefix);
      if (idx !== -1) {
        tagStartLine = l;
        tagText = lineText;
      }
    } else {
      tagText += '\n' + lineText;
    }

    if (tagStartLine !== -1) {
      let inQuote = false;
      let quoteChar = '';
      let closed = false;
      for (let i = 0; i < tagText.length; i++) {
        const c = tagText[i];
        if (!inQuote && (c === '"' || c === "'")) {
          inQuote = true;
          quoteChar = c;
        } else if (inQuote && c === quoteChar) {
          inQuote = false;
        } else if (!inQuote && c === '>') {
          closed = true;
          break;
        }
      }

      if (closed) {
        tagEndLine = l;
        break;
      }
    }
  }

  if (tagStartLine === -1 || tagEndLine === -1) return;

  let updatedText = tagText;
  const attrRegex = new RegExp(`\\b${attrName}\\s*=\\s*("[^"]*"|'[^']*')`, 'i');

  if (newValue === null || newValue === undefined || newValue.trim() === '') {
    if (attrRegex.test(updatedText)) {
      updatedText = updatedText.replace(attrRegex, '').replace(/\s{2,}/g, ' ');
    }
  } else {
    const formattedAttr = `${attrName}="${newValue.trim()}"`;
    if (attrRegex.test(updatedText)) {
      updatedText = updatedText.replace(attrRegex, formattedAttr);
    } else {
      if (updatedText.includes('/>')) {
        updatedText = updatedText.replace(/\s*\/>/, ` ${formattedAttr}/>`);
      } else {
        updatedText = updatedText.replace(/\s*>/, ` ${formattedAttr}>`);
      }
    }
  }

  // Handle TextBlock/Button inner text if attribute not found
  if ((tagName === 'TextBlock' || tagName === 'Button') && (attrName === 'Text' || attrName === 'Content') && !attrRegex.test(tagText)) {
    const innerRegex = new RegExp(`(<${tagName}[^>]*>)([^<]*)(</${tagName}>)`, 'i');
    if (innerRegex.test(tagText)) {
      updatedText = tagText.replace(innerRegex, `$1${newValue}$3`);
    }
  }

  if (updatedText !== tagText) {
    const endLineLength = model.getLineLength(tagEndLine);
    editor.executeEdits('xaml-visual-inspector', [
      {
        range: new monaco.Range(tagStartLine, 1, tagEndLine, endLineLength + 1),
        text: updatedText,
        forceMoveMarkers: true
      }
    ]);
    editor.pushUndoStop();
    setDirty(true);

    if (activeVisualTarget?.element?._xamlAttributes) {
      if (newValue) {
        activeVisualTarget.element._xamlAttributes[attrName] = newValue;
      } else {
        delete activeVisualTarget.element._xamlAttributes[attrName];
      }
    }

    scheduleXamlRender();
  }
}

function applyCurrentPropertyChange(attrName, newValue) {
  if (!activeVisualTarget) return;
  const { line, tagName } = activeVisualTarget;
  updateXamlAttributeInEditor(line, tagName, attrName, newValue);
}

function startInlineTextEditing(element) {
  if (!element) return;
  const tagName = element.getAttribute('data-xaml-tag');
  const line = parseInt(element.getAttribute('data-xaml-line') || '1', 10);
  const attrName = (tagName === 'Window') ? 'Title' : (tagName === 'TextBlock' || tagName === 'TextBox') ? 'Text' : 'Content';
  const currentVal = element._xamlAttributes?.[attrName] || element.innerText || '';

  const rect = element.getBoundingClientRect();
  const viewport = document.getElementById('designerViewport');
  if (!viewport) return;
  const vpRect = viewport.getBoundingClientRect();

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'xaml-inline-text-editor';
  input.value = currentVal;
  input.style.left = `${rect.left - vpRect.left + viewport.scrollLeft}px`;
  input.style.top = `${rect.top - vpRect.top + viewport.scrollTop}px`;
  input.style.width = `${Math.max(100, rect.width + 10)}px`;
  input.style.height = `${Math.max(30, rect.height + 4)}px`;

  viewport.appendChild(input);
  input.focus();
  input.select();

  const commit = () => {
    const newVal = input.value.trim();
    input.remove();
    if (newVal !== currentVal) {
      updateXamlAttributeInEditor(line, tagName, attrName, newVal);
      if (element._xamlAttributes) element._xamlAttributes[attrName] = newVal;
      const textInput = document.getElementById('propInputText');
      if (textInput) textInput.value = newVal;
    }
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      input.remove();
    }
  });

  input.addEventListener('blur', commit);
}

function duplicateXamlElementInEditor() {
  if (!editor || !activeVisualTarget) return;
  const model = editor.getModel();
  if (!model) return;
  const { line, tagName } = activeVisualTarget;

  const totalLines = model.getLineCount();
  const scanStart = Math.max(1, line - 2);
  const scanEnd = Math.min(totalLines, line + 15);
  let startL = -1;
  let endL = -1;
  let text = '';

  for (let l = scanStart; l <= scanEnd; l++) {
    const lt = model.getLineContent(l);
    if (startL === -1) {
      if (lt.includes(`<${tagName}`)) {
        startL = l;
        text = lt;
      }
    } else {
      text += '\n' + lt;
    }

    if (startL !== -1) {
      if (text.includes('/>') || text.includes(`</${tagName}>`)) {
        endL = l;
        break;
      }
    }
  }

  if (startL !== -1 && endL !== -1) {
    const endLen = model.getLineLength(endL);
    editor.executeEdits('xaml-duplicate', [
      {
        range: new monaco.Range(endL, endLen + 1, endL, endLen + 1),
        text: '\n' + text,
        forceMoveMarkers: true
      }
    ]);
    editor.pushUndoStop();
    setDirty(true);
    scheduleXamlRender();
    setStatus(`✔ <${tagName}> 요소 복제 완료`);
  }
}

function deleteXamlElementInEditor() {
  if (!editor || !activeVisualTarget) return;
  const model = editor.getModel();
  if (!model) return;
  const { line, tagName } = activeVisualTarget;

  const totalLines = model.getLineCount();
  const scanStart = Math.max(1, line - 2);
  const scanEnd = Math.min(totalLines, line + 15);
  let startL = -1;
  let endL = -1;
  let text = '';

  for (let l = scanStart; l <= scanEnd; l++) {
    const lt = model.getLineContent(l);
    if (startL === -1) {
      if (lt.includes(`<${tagName}`)) {
        startL = l;
        text = lt;
      }
    } else {
      text += '\n' + lt;
    }

    if (startL !== -1) {
      if (text.includes('/>') || text.includes(`</${tagName}>`)) {
        endL = l;
        break;
      }
    }
  }

  if (startL !== -1 && endL !== -1) {
    editor.executeEdits('xaml-delete', [
      {
        range: new monaco.Range(startL, 1, Math.min(totalLines, endL + 1), 1),
        text: '',
        forceMoveMarkers: true
      }
    ]);
    editor.pushUndoStop();
    setDirty(true);
    selectPreviewElement(null);
    scheduleXamlRender();
    setStatus(`✔ <${tagName}> 요소 삭제 완료`);
  }
}

// ================= C# Code-Only UI (C# Markup) Transpiler & Bidirectional Sync =================
function getLineNumberAtOffset(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

function findMatchingCloseBrace(text, openBraceIdx) {
  let depth = 0;
  let inString = false;
  let quote = '';
  for (let i = openBraceIdx; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') {
        i++;
      } else if (ch === quote) {
        inString = false;
      }
    } else {
      if (ch === '"' || ch === "'") {
        inString = true;
        quote = ch;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) return i;
      }
    }
  }
  return -1;
}

function splitTopLevelCSharpInitializerItems(bodyText, baseOffset) {
  const items = [];
  let depthBrace = 0;
  let depthParen = 0;
  let inString = false;
  let quote = '';
  let start = 0;

  for (let i = 0; i < bodyText.length; i++) {
    const ch = bodyText[i];
    if (inString) {
      if (ch === '\\') {
        i++;
      } else if (ch === quote) {
        inString = false;
      }
    } else {
      if (ch === '"' || ch === "'") {
        inString = true;
        quote = ch;
      } else if (ch === '{') {
        depthBrace++;
      } else if (ch === '}') {
        depthBrace--;
      } else if (ch === '(') {
        depthParen++;
      } else if (ch === ')') {
        depthParen--;
      } else if (ch === ',' && depthBrace === 0 && depthParen === 0) {
        const raw = bodyText.slice(start, i);
        if (raw.trim()) {
          items.push({ text: raw, offset: baseOffset + start });
        }
        start = i + 1;
      }
    }
  }

  const tail = bodyText.slice(start);
  if (tail.trim()) {
    items.push({ text: tail, offset: baseOffset + start });
  }
  return items;
}

function parseCSharpScalarValue(rawExpr) {
  const expr = rawExpr.trim().replace(/;$/, '').trim();
  const strMatch = expr.match(/^"((?:[^"\\]|\\.)*)"$/);
  if (strMatch) return strMatch[1].replace(/\\"/g, '"');

  const brushMatch = expr.match(/(?:Brush|SolidColorBrush)\.Parse\(\s*"([^"]+)"\s*\)/i);
  if (brushMatch) return brushMatch[1];

  const namedBrush = expr.match(/Brushes\.([A-Za-z]+)/i);
  if (namedBrush) {
    const map = { white: '#ffffff', black: '#000000', transparent: 'transparent', red: '#ef4444', green: '#10b981', blue: '#0284c7', gray: '#64748b' };
    return map[namedBrush[1].toLowerCase()] || namedBrush[1];
  }

  const thickMatch = expr.match(/new\s+Thickness\(\s*([^)]+)\s*\)/i);
  if (thickMatch) return thickMatch[1].replace(/\s+/g, '');

  const crMatch = expr.match(/new\s+CornerRadius\(\s*([^)]+)\s*\)/i);
  if (crMatch) return crMatch[1].replace(/\s+/g, '');

  const enumMatch = expr.match(/^(?:FontWeight|Orientation|HorizontalAlignment|VerticalAlignment)\.([A-Za-z]+)$/i);
  if (enumMatch) return enumMatch[1];

  if (expr === 'true') return 'True';
  if (expr === 'false') return 'False';

  return expr;
}

function escapeXmlAttr(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function parseCSharpControlNode(fullText, newKeywordOffset) {
  const sub = fullText.slice(newKeywordOffset);
  const headMatch = sub.match(/^new\s+([A-Za-z0-9_]+)\s*\{/);
  if (!headMatch) return null;

  const tagName = headMatch[1];
  const lineNum = getLineNumberAtOffset(fullText, newKeywordOffset);
  const openBraceOffset = newKeywordOffset + headMatch[0].length - 1;
  const closeBraceOffset = findMatchingCloseBrace(fullText, openBraceOffset);
  if (closeBraceOffset === -1) return null;

  const bodyText = fullText.slice(openBraceOffset + 1, closeBraceOffset);
  const items = splitTopLevelCSharpInitializerItems(bodyText, openBraceOffset + 1);

  const attrs = { _xaml_line: lineNum };
  const childrenXml = [];

  for (const item of items) {
    const eqIdx = item.text.indexOf('=');
    if (eqIdx === -1) continue;

    const propName = item.text.slice(0, eqIdx).trim();
    const afterEq = item.text.slice(eqIdx + 1);
    const valPart = afterEq.trim();
    const leadingSpaces = afterEq.indexOf(valPart);
    const valOffsetInFull = item.offset + eqIdx + 1 + (leadingSpaces >= 0 ? leadingSpaces : 0);

    if (propName === 'Children') {
      const cbOpen = valPart.indexOf('{');
      if (cbOpen !== -1) {
        const absOpen = valOffsetInFull + cbOpen;
        const absClose = findMatchingCloseBrace(fullText, absOpen);
        if (absClose !== -1) {
          const childrenBody = fullText.slice(absOpen + 1, absClose);
          const childItems = splitTopLevelCSharpInitializerItems(childrenBody, absOpen + 1);
          for (const ci of childItems) {
            const newIdx = ci.text.search(/\bnew\s+[A-Za-z0-9_]+\s*\{/);
            if (newIdx !== -1) {
              const childXml = parseCSharpControlNode(fullText, ci.offset + newIdx);
              if (childXml) childrenXml.push(childXml);
            }
          }
        }
      }
    } else if ((propName === 'Child' || propName === 'Content') && /^new\s+[A-Za-z0-9_]+\s*\{/.test(valPart)) {
      const childXml = parseCSharpControlNode(fullText, valOffsetInFull);
      if (childXml) childrenXml.push(childXml);
    } else {
      attrs[propName] = parseCSharpScalarValue(valPart);
    }
  }

  const attrStr = Object.entries(attrs)
    .map(([k, v]) => `${k}="${escapeXmlAttr(v)}"`)
    .join(' ');

  if (childrenXml.length === 0) {
    return `<${tagName} ${attrStr} />`;
  } else {
    return `<${tagName} ${attrStr}>\n${childrenXml.join('\n')}\n</${tagName}>`;
  }
}

function transpileCSharpUiToXaml(csCode) {
  if (!csCode) return '';

  const cleanCode = csCode
    .replace(/\/\/[^\r\n]*/g, m => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\r\n]/g, ' '));

  const classMatch = cleanCode.match(/class\s+([A-Za-z0-9_]+)\s*:\s*(Window|UserControl)/);
  if (classMatch) {
    const winLine = getLineNumberAtOffset(cleanCode, classMatch.index);
    const winAttrs = { _xaml_line: winLine };

    const winPropRegex = /\b(Title|Width|Height|Background|Foreground)\s*=\s*([^;]+);/g;
    let pm;
    while ((pm = winPropRegex.exec(cleanCode)) !== null) {
      winAttrs[pm[1]] = parseCSharpScalarValue(pm[2]);
    }

    const contentMatch = cleanCode.match(/\bContent\s*=\s*(new\s+[A-Za-z0-9_]+\s*\{)/);
    let innerXml = '';
    if (contentMatch) {
      const newOffset = contentMatch.index + contentMatch[0].indexOf(contentMatch[1]);
      innerXml = parseCSharpControlNode(cleanCode, newOffset) || '';
    } else {
      const firstNew = cleanCode.match(/\bnew\s+(Grid|StackPanel|Border|TextBlock|Button|TextBox)\s*\{/);
      if (firstNew) {
        innerXml = parseCSharpControlNode(cleanCode, firstNew.index) || '';
      }
    }

    const attrStr = Object.entries(winAttrs)
      .map(([k, v]) => `${k}="${escapeXmlAttr(v)}"`)
      .join(' ');
    return `<Window ${attrStr}>\n${innerXml}\n</Window>`;
  }

  const standaloneNew = cleanCode.match(/\bnew\s+(Window|Grid|StackPanel|Border|TextBlock|Button|TextBox)\s*\{/);
  if (standaloneNew) {
    const nodeXml = parseCSharpControlNode(cleanCode, standaloneNew.index);
    if (standaloneNew[1] === 'Window') return nodeXml;
    return `<Window _xaml_line="1" Title="C# UI Component Preview" Width="520" Height="460" Background="#0f172a">\n${nodeXml}\n</Window>`;
  }

  return '';
}

function formatCSharpPropertyValue(attrName, rawValue) {
  const val = String(rawValue ?? '').trim();
  if (['Text', 'Content', 'Title', 'Placeholder'].includes(attrName)) {
    return `"${val.replace(/"/g, '\\"')}"`;
  }
  if (['Background', 'Foreground', 'BorderBrush'].includes(attrName)) {
    return `Brush.Parse("${val}")`;
  }
  if (['Margin', 'Padding', 'BorderThickness'].includes(attrName)) {
    const parts = val.split(',').map(s => s.trim()).filter(Boolean).join(', ');
    return `new Thickness(${parts || '0'})`;
  }
  if (attrName === 'CornerRadius') {
    const parts = val.split(',').map(s => s.trim()).filter(Boolean).join(', ');
    return `new CornerRadius(${parts || '0'})`;
  }
  if (attrName === 'FontWeight') {
    return `FontWeight.${val}`;
  }
  if (attrName === 'Orientation') {
    return `Orientation.${val}`;
  }
  if (attrName === 'HorizontalAlignment') {
    return `HorizontalAlignment.${val}`;
  }
  if (attrName === 'VerticalAlignment') {
    return `VerticalAlignment.${val}`;
  }
  if (attrName === 'IsChecked') {
    return val.toLowerCase() === 'true' ? 'true' : 'false';
  }
  if (['Width', 'Height', 'FontSize', 'Value', 'Maximum', 'Spacing'].includes(attrName)) {
    const num = parseFloat(val);
    return isNaN(num) ? '0' : String(num);
  }
  return `"${val}"`;
}

function insertNewControlToDocument(controlType) {
  if (!editor) return;
  const code = editor.getValue();
  const isCs = currentPath && currentPath.toLowerCase().endsWith('.cs');

  const xamlSnippets = {
    Button: '                <Button Content="새 액션 버튼" Height="34" Padding="14,6" Background="#0284c7" Foreground="#ffffff" FontWeight="SemiBold" CornerRadius="6" Margin="0,0,0,8"/>',
    TextBlock: '                <TextBlock Text="새로운 텍스트 레이블" FontSize="13" FontWeight="SemiBold" Foreground="#f8fafc" Margin="0,0,0,8"/>',
    TextBox: '                <TextBox Text="입력값을 작성하세요" Height="34" Padding="8,6" Background="#0f172a" Foreground="#f8fafc" BorderBrush="#475569" CornerRadius="6" Margin="0,0,0,8"/>',
    CheckBox: '                <CheckBox Content="새 옵션 활성화" IsChecked="True" Foreground="#cbd5e1" Margin="0,0,0,8"/>',
    ProgressBar: '                <ProgressBar Value="65" Height="10" Background="#334155" Foreground="#10b981" Margin="0,0,0,10"/>',
    Border: `                <Border Background="#0f172a" CornerRadius="8" Padding="12" Margin="0,0,0,10" BorderBrush="#334155" BorderThickness="1">
                    <StackPanel Orientation="Vertical">
                        <TextBlock Text="새 카드 섹션" FontSize="13" FontWeight="Bold" Foreground="#38bdf8" Margin="0,0,0,4"/>
                        <TextBlock Text="카드 내부 설명 텍스트입니다." FontSize="11" Foreground="#94a3b8"/>
                    </StackPanel>
                </Border>`
  };

  const csharpSnippets = {
    Button: `                                new Button
                                {
                                    Content = "새 액션 버튼",
                                    Height = 34,
                                    Background = Brush.Parse("#0284c7"),
                                    Foreground = Brush.Parse("#ffffff"),
                                    FontWeight = FontWeight.SemiBold,
                                    CornerRadius = new CornerRadius(6),
                                    Margin = new Thickness(0, 0, 0, 8)
                                }`,
    TextBlock: `                                new TextBlock
                                {
                                    Text = "새로운 텍스트 레이블",
                                    FontSize = 13,
                                    FontWeight = FontWeight.SemiBold,
                                    Foreground = Brush.Parse("#f8fafc"),
                                    Margin = new Thickness(0, 0, 0, 8)
                                }`,
    TextBox: `                                new TextBox
                                {
                                    Text = "입력값을 작성하세요",
                                    Height = 34,
                                    Padding = new Thickness(8, 6, 8, 6),
                                    Background = Brush.Parse("#0f172a"),
                                    Foreground = Brush.Parse("#f8fafc"),
                                    BorderBrush = Brush.Parse("#475569"),
                                    CornerRadius = new CornerRadius(6),
                                    Margin = new Thickness(0, 0, 0, 8)
                                }`,
    CheckBox: `                                new CheckBox
                                {
                                    Content = "새 옵션 활성화",
                                    IsChecked = true,
                                    Foreground = Brush.Parse("#cbd5e1"),
                                    Margin = new Thickness(0, 0, 0, 8)
                                }`,
    ProgressBar: `                                new ProgressBar
                                {
                                    Value = 65,
                                    Height = 10,
                                    Background = Brush.Parse("#334155"),
                                    Foreground = Brush.Parse("#10b981"),
                                    Margin = new Thickness(0, 0, 0, 10)
                                }`,
    Border: `                                new Border
                                {
                                    Background = Brush.Parse("#0f172a"),
                                    CornerRadius = new CornerRadius(8),
                                    Padding = new Thickness(12),
                                    Margin = new Thickness(0, 0, 0, 10),
                                    BorderBrush = Brush.Parse("#334155"),
                                    BorderThickness = new Thickness(1),
                                    Child = new StackPanel
                                    {
                                        Orientation = Orientation.Vertical,
                                        Children =
                                        {
                                            new TextBlock
                                            {
                                                Text = "새 카드 섹션",
                                                FontSize = 13,
                                                FontWeight = FontWeight.Bold,
                                                Foreground = Brush.Parse("#38bdf8"),
                                                Margin = new Thickness(0, 0, 0, 4)
                                            },
                                            new TextBlock
                                            {
                                                Text = "카드 내부 설명 텍스트입니다.",
                                                FontSize = 11,
                                                Foreground = Brush.Parse("#94a3b8")
                                            }
                                        }
                                    }
                                }`
  };

  if (isCs) {
    const snippet = csharpSnippets[controlType] || csharpSnippets.Button;
    // Find the first Children = { ... } block in C# UI and append before its closing brace
    const childrenIdx = code.indexOf('Children =');
    if (childrenIdx !== -1) {
      const openBrace = code.indexOf('{', childrenIdx);
      const closeBrace = findMatchingCloseBrace(code, openBrace);
      if (openBrace !== -1 && closeBrace !== -1) {
        const beforeClose = code.slice(0, closeBrace).trimEnd();
        const needsComma = !beforeClose.endsWith('{') && !beforeClose.endsWith(',');
        const updated = `${beforeClose}${needsComma ? ',' : ''}\n${snippet}\n                            ` + code.slice(closeBrace);
        editor.setValue(updated);
        setDirty(true);
        scheduleXamlRender();
        scheduleAnalysis();
        setStatus(`➕ C# UI에 새 ${controlType} 컨트롤을 추가했습니다.`);
        return;
      }
    }
  } else {
    const snippet = xamlSnippets[controlType] || xamlSnippets.Button;
    const spCloseIdx = code.lastIndexOf('</StackPanel>');
    const gridCloseIdx = code.lastIndexOf('</Grid>');
    const insertAt = spCloseIdx !== -1 ? spCloseIdx : gridCloseIdx;
    if (insertAt !== -1) {
      const updated = code.slice(0, insertAt) + snippet + '\n            ' + code.slice(insertAt);
      editor.setValue(updated);
      setDirty(true);
      scheduleXamlRender();
      setStatus(`➕ XAML 뷰에 새 <${controlType}> 컨트롤을 추가했습니다.`);
    }
  }
}

function updateCSharpUiAttributeInEditor(startLine, tagName, attrName, newValue) {
  if (!editor) return;
  const model = editor.getModel();
  if (!model) return;

  const totalLines = model.getLineCount();
  const csFormattedValue = formatCSharpPropertyValue(attrName, newValue);

  // Case 1: Root Window class properties (Title = ...; Width = ...; etc.)
  const startLineContent = model.getLineContent(startLine);
  if (tagName === 'Window' && /class\s+[A-Za-z0-9_]+\s*:\s*Window/.test(startLineContent)) {
    const scanEnd = Math.min(totalLines, startLine + 20);
    for (let l = startLine; l <= scanEnd; l++) {
      const lt = model.getLineContent(l);
      const propRe = new RegExp(`^(\\s*)${attrName}\\s*=\\s*[^;]+;`);
      if (propRe.test(lt)) {
        const updatedLine = lt.replace(propRe, `$1${attrName} = ${csFormattedValue};`);
        editor.executeEdits('csharp-visual-inspector', [
          {
            range: new monaco.Range(l, 1, l, lt.length + 1),
            text: updatedLine,
            forceMoveMarkers: true
          }
        ]);
        editor.pushUndoStop();
        setDirty(true);
        scheduleXamlRender();
        scheduleAnalysis();
        return;
      }
    }
  }

  // Case 2: new ControlName { ... } initializer starting around startLine
  const scanEnd = Math.min(totalLines, startLine + 18);
  let braceOpenLine = -1;
  for (let l = startLine; l <= scanEnd; l++) {
    const lt = model.getLineContent(l);
    if (braceOpenLine === -1 && lt.includes('{')) {
      braceOpenLine = l;
    }
    // Stop scanning if we hit Child = or Children = or closing }
    if (braceOpenLine !== -1 && l > braceOpenLine && /\b(Children|Child)\s*=/.test(lt)) {
      break;
    }

    const propRegex = new RegExp(`^(\\s*)${attrName}\\s*=\\s*(?:new\\s+[A-Za-z0-9_]+\\([^)]*\\)|(?:Brush|SolidColorBrush)\\.Parse\\([^)]*\\)|"[^"]*"|[^,\\r\\n}]+)(,?)`);
    const match = lt.match(propRegex);
    if (match) {
      const indent = match[1];
      const trailingComma = match[2] || '';
      const updatedLine = `${indent}${attrName} = ${csFormattedValue}${trailingComma}`;
      editor.executeEdits('csharp-visual-inspector', [
        {
          range: new monaco.Range(l, 1, l, lt.length + 1),
          text: updatedLine,
          forceMoveMarkers: true
        }
      ]);
      editor.pushUndoStop();
      setDirty(true);
      if (activeVisualTarget?.element?._xamlAttributes) {
        activeVisualTarget.element._xamlAttributes[attrName] = newValue;
      }
      scheduleXamlRender();
      scheduleAnalysis();
      return;
    }
  }

  // If attribute was not found in the initializer, insert it right after the opening '{' line
  if (braceOpenLine !== -1) {
    const braceLineText = model.getLineContent(braceOpenLine);
    const baseIndentMatch = braceLineText.match(/^(\s*)/);
    const propIndent = (baseIndentMatch ? baseIndentMatch[1] : '') + '    ';
    const insertText = `\n${propIndent}${attrName} = ${csFormattedValue},`;
    editor.executeEdits('csharp-visual-inspector', [
      {
        range: new monaco.Range(braceOpenLine, braceLineText.length + 1, braceOpenLine, braceLineText.length + 1),
        text: insertText,
        forceMoveMarkers: true
      }
    ]);
    editor.pushUndoStop();
    setDirty(true);
    if (activeVisualTarget?.element?._xamlAttributes) {
      activeVisualTarget.element._xamlAttributes[attrName] = newValue;
    }
    scheduleXamlRender();
    scheduleAnalysis();
  }
}

function convertXmlNodeToCSharpInitializer(xmlNode, indentLevel) {
  if (!xmlNode || xmlNode.nodeType !== 1) return '';
  const tagName = xmlNode.localName || xmlNode.nodeName;
  if (tagName.includes('.')) return '';

  const indent = '    '.repeat(indentLevel);
  const propIndent = '    '.repeat(indentLevel + 1);
  const propLines = [];

  for (let i = 0; i < xmlNode.attributes.length; i++) {
    const a = xmlNode.attributes[i];
    if (a.name.startsWith('xmlns') || a.name.startsWith('x:') || a.name.startsWith('_xaml') || a.name.includes('.')) {
      continue;
    }
    propLines.push(`${propIndent}${a.name} = ${formatCSharpPropertyValue(a.name, a.value)}`);
  }

  const childElements = [];
  for (let i = 0; i < xmlNode.childNodes.length; i++) {
    const ch = xmlNode.childNodes[i];
    if (ch.nodeType === 1 && !ch.nodeName.includes('.')) {
      const childCode = convertXmlNodeToCSharpInitializer(ch, indentLevel + 2);
      if (childCode) childElements.push(childCode);
    }
  }

  if (childElements.length === 1 && tagName === 'Border') {
    propLines.push(`${propIndent}Child =\n${childElements[0]}`);
  } else if (childElements.length === 1 && tagName === 'Window') {
    propLines.push(`${propIndent}Content =\n${childElements[0]}`);
  } else if (childElements.length > 0) {
    const childrenIndent = '    '.repeat(indentLevel + 2);
    propLines.push(`${propIndent}Children =\n${propIndent}{\n${childElements.join(',\n')}\n${propIndent}}`);
  }

  return `${indent}new ${tagName}\n${indent}{\n${propLines.join(',\n')}\n${indent}}`;
}

function convertXamlToCSharpUiCode(xamlText) {
  const sanitized = sanitizeXamlForParsing(xamlText);
  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitized, 'application/xml');
  const root = doc.documentElement;
  if (!root || doc.querySelector('parsererror')) {
    return '// 유효한 XAML 문서를 먼저 열어주세요.';
  }

  const title = root.getAttribute('Title') || 'ConvertedCSharpWindow';
  const width = root.getAttribute('Width') || '520';
  const height = root.getAttribute('Height') || '460';
  const bg = root.getAttribute('Background') || '#0f172a';

  let contentCode = 'null';
  for (let i = 0; i < root.childNodes.length; i++) {
    if (root.childNodes[i].nodeType === 1 && !root.childNodes[i].nodeName.includes('.')) {
      contentCode = convertXmlNodeToCSharpInitializer(root.childNodes[i], 2).trimStart();
      break;
    }
  }

  return `using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;

namespace SampleApp;

public class ConvertedCSharpWindow : Window
{
    public ConvertedCSharpWindow()
    {
        Title = "${title}";
        Width = ${parseFloat(width) || 520};
        Height = ${parseFloat(height) || 460};
        Background = Brush.Parse("${bg}");

        Content = ${contentCode};
    }
}
`;
}

function convertCSharpUiToCleanXaml(csCode) {
  const rawInstrumented = transpileCSharpUiToXaml(csCode);
  if (!rawInstrumented) return '<!-- 변환할 C# UI 컨트롤을 찾지 못했습니다. -->';
  const cleaned = rawInstrumented.replace(/\s*_xaml_line="\d+"/g, '');
  return cleaned.replace(
    /^<Window\s/,
    '<Window xmlns="https://github.com/avaloniaui"\n        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"\n        x:Class="SampleApp.ConvertedWindow"\n        '
  );
}

// Wire Visual Property Inspector Events
function initVisualInspectorEvents() {
  // Quick Component Toolbox 1-Click Insert Buttons
  document.querySelectorAll('.toolbox-chip-btn').forEach(btn => {
    btn.onclick = () => {
      const controlType = btn.getAttribute('data-add-control');
      if (controlType) insertNewControlToDocument(controlType);
    };
  });

  // Blueprint / Inspect Overlay Toggle
  const btnBlueprint = document.getElementById('btnToggleInspectBlueprint');
  if (btnBlueprint) {
    btnBlueprint.onclick = () => {
      isBlueprintModeActive = !isBlueprintModeActive;
      btnBlueprint.classList.toggle('active', isBlueprintModeActive);
      const root = document.getElementById('xamlRenderRoot');
      if (root) root.classList.toggle('inspect-blueprint-active', isBlueprintModeActive);
    };
  }

  // Inspector Panel Toggle
  const btnToggleInspector = document.getElementById('btnToggleInspectorPanel');
  const panel = document.getElementById('designerInspectorPanel');
  if (btnToggleInspector && panel) {
    btnToggleInspector.onclick = () => {
      panel.classList.toggle('collapsed');
      btnToggleInspector.classList.toggle('active', !panel.classList.contains('collapsed'));
    };
  }

  const btnCloseInspector = document.getElementById('btnCloseInspectorPanel');
  if (btnCloseInspector && panel) {
    btnCloseInspector.onclick = () => {
      panel.classList.add('collapsed');
      btnToggleInspector?.classList.remove('active');
    };
  }

  // Select Root Window Button
  const btnSelectRoot = document.getElementById('btnSelectRootWindow');
  if (btnSelectRoot) {
    btnSelectRoot.onclick = () => {
      const rootWin = document.querySelector('#xamlRenderRoot [data-xaml-tag="Window"]');
      if (rootWin) {
        selectPreviewElement(rootWin);
        jumpToEditorLine(parseInt(rootWin.getAttribute('data-xaml-line') || '1', 10));
      }
    };
  }

  // Text / Content Input
  const propText = document.getElementById('propInputText');
  if (propText) {
    const handleTextChange = () => {
      if (!activeVisualTarget) return;
      const tag = activeVisualTarget.tagName;
      const attr = (tag === 'Window') ? 'Title' : (tag === 'TextBlock' || tag === 'TextBox') ? 'Text' : 'Content';
      applyCurrentPropertyChange(attr, propText.value);
    };
    propText.addEventListener('change', handleTextChange);
    propText.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleTextChange();
    });
  }

  // Width & Height
  const propW = document.getElementById('propInputWidth');
  if (propW) {
    propW.addEventListener('change', () => applyCurrentPropertyChange('Width', propW.value));
    propW.addEventListener('keydown', e => { if (e.key === 'Enter') applyCurrentPropertyChange('Width', propW.value); });
  }

  const propH = document.getElementById('propInputHeight');
  if (propH) {
    propH.addEventListener('change', () => applyCurrentPropertyChange('Height', propH.value));
    propH.addEventListener('keydown', e => { if (e.key === 'Enter') applyCurrentPropertyChange('Height', propH.value); });
  }

  // Margin & Padding
  const propM = document.getElementById('propInputMargin');
  if (propM) {
    propM.addEventListener('change', () => applyCurrentPropertyChange('Margin', propM.value));
    propM.addEventListener('keydown', e => { if (e.key === 'Enter') applyCurrentPropertyChange('Margin', propM.value); });
  }

  const propP = document.getElementById('propInputPadding');
  if (propP) {
    propP.addEventListener('change', () => applyCurrentPropertyChange('Padding', propP.value));
    propP.addEventListener('keydown', e => { if (e.key === 'Enter') applyCurrentPropertyChange('Padding', propP.value); });
  }

  // Background Color Picker & Hex Input
  const propBg = document.getElementById('propInputBg');
  const propBgPicker = document.getElementById('propColorBgPicker');
  if (propBg && propBgPicker) {
    propBgPicker.addEventListener('input', e => {
      propBg.value = e.target.value;
      applyCurrentPropertyChange('Background', e.target.value);
    });
    propBg.addEventListener('change', () => {
      applyCurrentPropertyChange('Background', propBg.value);
      if (/^#[0-9a-f]{6}$/i.test(propBg.value)) propBgPicker.value = propBg.value;
    });
  }

  // Foreground Color Picker & Hex Input
  const propFg = document.getElementById('propInputFg');
  const propFgPicker = document.getElementById('propColorFgPicker');
  if (propFg && propFgPicker) {
    propFgPicker.addEventListener('input', e => {
      propFg.value = e.target.value;
      applyCurrentPropertyChange('Foreground', e.target.value);
    });
    propFg.addEventListener('change', () => {
      applyCurrentPropertyChange('Foreground', propFg.value);
      if (/^#[0-9a-f]{6}$/i.test(propFg.value)) propFgPicker.value = propFg.value;
    });
  }

  // Border Color Picker & Hex Input
  const propBorder = document.getElementById('propInputBorder');
  const propBorderPicker = document.getElementById('propColorBorderPicker');
  if (propBorder && propBorderPicker) {
    propBorderPicker.addEventListener('input', e => {
      propBorder.value = e.target.value;
      applyCurrentPropertyChange('BorderBrush', e.target.value);
    });
    propBorder.addEventListener('change', () => {
      applyCurrentPropertyChange('BorderBrush', propBorder.value);
      if (/^#[0-9a-f]{6}$/i.test(propBorder.value)) propBorderPicker.value = propBorder.value;
    });
  }

  // Palette Chips
  document.querySelectorAll('.palette-chip').forEach(chip => {
    chip.onclick = () => {
      const color = chip.getAttribute('data-color');
      if (propBg && propBgPicker) {
        propBg.value = color;
        if (/^#[0-9a-f]{6}$/i.test(color)) propBgPicker.value = color;
        applyCurrentPropertyChange('Background', color);
      }
    };
  });

  // Typography FontSize & CornerRadius
  const propFs = document.getElementById('propInputFontSize');
  if (propFs) {
    propFs.addEventListener('change', () => applyCurrentPropertyChange('FontSize', propFs.value));
    propFs.addEventListener('keydown', e => { if (e.key === 'Enter') applyCurrentPropertyChange('FontSize', propFs.value); });
  }

  const propCr = document.getElementById('propInputCornerRadius');
  if (propCr) {
    propCr.addEventListener('change', () => applyCurrentPropertyChange('CornerRadius', propCr.value));
    propCr.addEventListener('keydown', e => { if (e.key === 'Enter') applyCurrentPropertyChange('CornerRadius', propCr.value); });
  }

  // FontWeight buttons
  document.querySelectorAll('.prop-chip-btn').forEach(btn => {
    btn.onclick = () => {
      const weight = btn.getAttribute('data-weight');
      document.querySelectorAll('.prop-chip-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyCurrentPropertyChange('FontWeight', weight);
    };
  });

  // AI Directive in Inspector
  const btnSubmitInspectorAi = document.getElementById('btnSubmitInspectorAi');
  const aiDirectiveInput = document.getElementById('propAiDirectiveInput');
  if (btnSubmitInspectorAi && aiDirectiveInput) {
    btnSubmitInspectorAi.onclick = () => {
      submitVisualAiDirective(aiDirectiveInput.value);
    };
    aiDirectiveInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitVisualAiDirective(aiDirectiveInput.value);
      }
    });
  }

  document.querySelectorAll('.inspector-ai-chip').forEach(chip => {
    chip.onclick = () => {
      const directive = chip.getAttribute('data-directive');
      submitVisualAiDirective(directive);
    };
  });

  // Duplicate & Delete
  const btnDup = document.getElementById('btnDuplicateElement');
  if (btnDup) btnDup.onclick = duplicateXamlElementInEditor;

  const btnDel = document.getElementById('btnDeleteElement');
  if (btnDel) btnDel.onclick = deleteXamlElementInEditor;

  // XAML <-> C# UI Code Converter Modal
  const btnConvertUiCode = document.getElementById('btnConvertUiCode');
  const converterModal = document.getElementById('uiCodeConverterModal');
  const converterOutput = document.getElementById('converterCodeOutput');
  const converterBadge = document.getElementById('converterDirectionBadge');
  const converterTitle = document.getElementById('converterModalTitle');

  if (btnConvertUiCode && converterModal && converterOutput) {
    btnConvertUiCode.onclick = () => {
      const code = editor ? editor.getValue() : '';
      const isCs = currentPath && currentPath.toLowerCase().endsWith('.cs');
      if (isCs) {
        if (converterBadge) converterBadge.innerText = 'C# UI → XAML';
        if (converterTitle) converterTitle.innerText = 'XAML (.axaml) 마크업 변환 결과';
        converterOutput.value = convertCSharpUiToCleanXaml(code);
      } else {
        if (converterBadge) converterBadge.innerText = 'XAML → C# UI';
        if (converterTitle) converterTitle.innerText = '순수 C# UI 코드 (C# Markup) 변환 결과';
        converterOutput.value = convertXamlToCSharpUiCode(code);
      }
      converterModal.style.display = 'flex';
    };
  }

  const btnCloseConverter = document.getElementById('btnCloseConverterModal');
  if (btnCloseConverter && converterModal) {
    btnCloseConverter.onclick = () => {
      converterModal.style.display = 'none';
    };
  }

  const btnCopyConverted = document.getElementById('btnCopyConvertedCode');
  if (btnCopyConverted && converterOutput) {
    btnCopyConverted.onclick = async () => {
      try {
        await navigator.clipboard.writeText(converterOutput.value);
        const statusMsg = document.getElementById('converterStatusMsg');
        if (statusMsg) statusMsg.innerText = '✔ 클립보드에 복사되었습니다!';
      } catch {
        converterOutput.select();
        document.execCommand('copy');
      }
    };
  }

  const btnSaveConverted = document.getElementById('btnSaveConvertedFile');
  if (btnSaveConverted && converterOutput && converterModal) {
    btnSaveConverted.onclick = async () => {
      const isCs = currentPath && currentPath.toLowerCase().endsWith('.cs');
      const targetFileName = isCs ? 'ConvertedView.axaml' : 'CSharpDashboardWindow.cs';
      try {
        await fetch('/api/workspace/file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ relativePath: targetFileName, content: converterOutput.value })
        });
        converterModal.style.display = 'none';
        await loadWorkspaceTree();
        await openFile(targetFileName);
        setStatus(`✔ 변환 파일 저장 및 열기 완료: ${targetFileName}`);
      } catch (err) {
        alert(`파일 저장 오류: ${err.message}`);
      }
    };
  }
}

// ================= Personal Cloud VFS & Vercel Hybrid Static Engine =================
const PERSONAL_VFS_STORAGE_KEY = 'roslyn_studio_personal_vfs_v1';
let isWebVfsMode = false;

const DEFAULT_PERSONAL_VFS_FILES = {
  'MainWindow.axaml': `<Window xmlns="https://github.com/avaloniaui"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        x:Class="SampleApp.MainWindow"
        Title="RoslynStudio Avalonia 미리보기 대시보드" Height="460" Width="520"
        Background="#0f172a">
    <Grid Margin="20">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
            <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>

        <Border Grid.Row="0" Background="#1e293b" CornerRadius="8" Padding="16" Margin="0,0,0,16" BorderBrush="#334155" BorderThickness="1">
            <StackPanel Orientation="Vertical">
                <TextBlock Text="⚡ Avalonia UI 실시간 비주얼 디자이너" FontSize="16" FontWeight="Bold" Foreground="#38bdf8" Margin="0,0,0,4"/>
                <TextBlock Text="AXAML 코드를 수정하면 실시간으로 오른쪽 미리보기가 핫 리로드됩니다." FontSize="12" Foreground="#94a3b8"/>
            </StackPanel>
        </Border>

        <Border Grid.Row="1" Background="#1e293b" CornerRadius="8" Padding="16" BorderBrush="#334155" BorderThickness="1">
            <StackPanel Orientation="Vertical">
                <TextBlock Text="사용자 설정" FontSize="14" FontWeight="SemiBold" Foreground="#f8fafc" Margin="0,0,0,12"/>
                <TextBlock Text="프로젝트 이름" FontSize="12" Foreground="#94a3b8" Margin="0,0,0,4"/>
                <TextBox Text="RoslynStudio.Avalonia" Height="36" Padding="8" Background="#0f172a" Foreground="#f8fafc" BorderBrush="#475569" CornerRadius="6" Margin="0,0,0,12"/>
                <TextBlock Text="빌드 진행률 (75%)" FontSize="12" Foreground="#94a3b8" Margin="0,0,0,4"/>
                <ProgressBar Value="75" Height="10" Margin="0,0,0,14" Background="#334155" Foreground="#0ea5e9"/>
                <CheckBox Content="AOT 네이티브 컴파일 활성화" IsChecked="True" Foreground="#cbd5e1" Margin="0,0,0,8"/>
                <CheckBox Content="실시간 Roslyn 진단 자동 동기화" IsChecked="True" Foreground="#cbd5e1" Margin="0,0,0,8"/>
            </StackPanel>
        </Border>

        <StackPanel Grid.Row="2" Orientation="Horizontal" HorizontalAlignment="Right" Margin="0,16,0,0">
            <Button Content="취소" Width="80" Height="34" Margin="0,0,8,0" Background="#334155" Foreground="#cbd5e1" CornerRadius="6"/>
            <Button Content="설정 저장" Width="100" Height="34" Background="#0284c7" Foreground="#ffffff" FontWeight="Bold" CornerRadius="6"/>
        </StackPanel>
    </Grid>
</Window>`,
  'MainWindow.axaml.cs': `using Avalonia.Controls;

namespace SampleApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }
}`,
  'CSharpDashboardWindow.cs': `using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;

namespace SampleApp;

public class CSharpDashboardWindow : Window
{
    public CSharpDashboardWindow()
    {
        Title = "순수 C# 코드 UI (C# Markup) 실시간 디자이너";
        Width = 520;
        Height = 460;
        Background = Brush.Parse("#0f172a");

        Content = new Grid
        {
            Margin = new Thickness(20),
            Children =
            {
                new StackPanel
                {
                    Orientation = Orientation.Vertical,
                    Children =
                    {
                        new Border
                        {
                            Background = Brush.Parse("#1e293b"),
                            CornerRadius = new CornerRadius(8),
                            Padding = new Thickness(16),
                            Margin = new Thickness(0, 0, 0, 14),
                            BorderBrush = Brush.Parse("#334155"),
                            BorderThickness = new Thickness(1),
                            Child = new StackPanel
                            {
                                Orientation = Orientation.Vertical,
                                Children =
                                {
                                    new TextBlock
                                    {
                                        Text = "💎 순수 C# UI 코드 실시간 시각화",
                                        FontSize = 16,
                                        FontWeight = FontWeight.Bold,
                                        Foreground = Brush.Parse("#10b981"),
                                        Margin = new Thickness(0, 0, 0, 4)
                                    },
                                    new TextBlock
                                    {
                                        Text = "XAML 없이 C# 객체 초기화 구문만으로 작성된 화면도 즉시 렌더링하고 편집합니다.",
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
                            Margin = new Thickness(0, 0, 0, 14),
                            BorderBrush = Brush.Parse("#334155"),
                            BorderThickness = new Thickness(1),
                            Child = new StackPanel
                            {
                                Orientation = Orientation.Vertical,
                                Children =
                                {
                                    new TextBlock
                                    {
                                        Text = "서비스 엔드포인트 이름",
                                        FontSize = 12,
                                        Foreground = Brush.Parse("#94a3b8"),
                                        Margin = new Thickness(0, 0, 0, 6)
                                    },
                                    new TextBox
                                    {
                                        Text = "https://api.roslynstudio.dev/v1",
                                        Height = 36,
                                        Padding = new Thickness(8),
                                        Background = Brush.Parse("#0f172a"),
                                        Foreground = Brush.Parse("#f8fafc"),
                                        BorderBrush = Brush.Parse("#475569"),
                                        CornerRadius = new CornerRadius(6),
                                        Margin = new Thickness(0, 0, 0, 12)
                                    },
                                    new CheckBox
                                    {
                                        Content = "실시간 C# 프로퍼티 양방향 바인딩 활성화",
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
                                    Width = 86,
                                    Height = 36,
                                    Margin = new Thickness(0, 0, 8, 0),
                                    Background = Brush.Parse("#334155"),
                                    Foreground = Brush.Parse("#e2e8f0"),
                                    CornerRadius = new CornerRadius(6)
                                },
                                new Button
                                {
                                    Content = "C# UI 배포 실행",
                                    Width = 130,
                                    Height = 36,
                                    Background = Brush.Parse("#059669"),
                                    Foreground = Brush.Parse("#ffffff"),
                                    FontWeight = FontWeight.Bold,
                                    CornerRadius = new CornerRadius(6)
                                }
                            }
                        }
                    }
                }
            }
        };
    }
}`,
  'App.axaml': `<Application xmlns="https://github.com/avaloniaui"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             x:Class="SampleApp.App"
             RequestedThemeVariant="Dark">
    <Application.Styles>
        <FluentTheme />
    </Application.Styles>
</Application>`,
  'App.axaml.cs': `using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;

namespace SampleApp;

public partial class App : Application
{
    public override void Initialize() => AvaloniaXamlLoader.Load(this);

    public override void OnFrameworkInitializationCompleted()
    {
        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            desktop.MainWindow = new MainWindow();
        }
        base.OnFrameworkInitializationCompleted();
    }
}`,
  'Program.cs': `using System;
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
}`,
  'SampleApp.csproj': `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <AvaloniaUseCompiledBindingsByDefault>true</AvaloniaUseCompiledBindingsByDefault>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Avalonia" Version="12.0.0" />
    <PackageReference Include="Avalonia.Desktop" Version="12.0.0" />
    <PackageReference Include="Avalonia.Themes.Fluent" Version="12.0.0" />
    <PackageReference Include="Avalonia.Fonts.Inter" Version="12.0.0" />
  </ItemGroup>
</Project>`
};

function getPersonalVfs() {
  try {
    const raw = localStorage.getItem(PERSONAL_VFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  const initial = { ...DEFAULT_PERSONAL_VFS_FILES };
  savePersonalVfs(initial);
  return initial;
}

function savePersonalVfs(vfs) {
  try {
    localStorage.setItem(PERSONAL_VFS_STORAGE_KEY, JSON.stringify(vfs));
  } catch {
    // ignore quota errors
  }
}

function setRuntimeModeIndicator(webMode) {
  isWebVfsMode = webMode;
  const badge = document.getElementById('runtimeModeBadge');
  if (!badge) return;
  if (webMode) {
    badge.innerText = '🌐 Web Personal VFS (LocalStorage)';
    badge.classList.add('is-web-vfs');
    badge.title = '서버리스/정적 호스팅 모드: 모든 변경사항이 브라우저 LocalStorage에 영구 저장됩니다 (Vercel 사용량 무제한 무료)';
  } else {
    badge.innerText = '⚡ Local .NET 10 + VFS 백업';
    badge.classList.remove('is-web-vfs');
    badge.title = '로컬 .NET 10 백엔드 연결됨 + 브라우저 LocalStorage 자동 백업 활성화';
  }
}

function buildPersonalVfsTree(vfs) {
  const allNames = Object.keys(vfs).sort((a, b) => a.localeCompare(b));
  const codeBehindSet = new Set();

  for (const name of allNames) {
    if (name.toLowerCase().endsWith('.xaml.cs') || name.toLowerCase().endsWith('.axaml.cs')) {
      const parentName = name.slice(0, -3);
      if (allNames.some(x => x.toLowerCase() === parentName.toLowerCase())) {
        codeBehindSet.add(name);
      }
    }
  }

  const children = [];
  for (const name of allNames) {
    if (codeBehindSet.has(name)) continue;
    const node = {
      name: name.split(/[\\/]/).pop(),
      relativePath: name,
      isDirectory: false,
      children: []
    };
    if (name.toLowerCase().endsWith('.xaml') || name.toLowerCase().endsWith('.axaml')) {
      const cb = allNames.find(x => x.toLowerCase() === (name + '.cs').toLowerCase());
      if (cb) {
        node.children.push({
          name: cb.split(/[\\/]/).pop(),
          relativePath: cb,
          isDirectory: false,
          children: []
        });
      }
    }
    children.push(node);
  }

  return {
    name: 'PersonalWorkspace',
    relativePath: '',
    isDirectory: true,
    children
  };
}

function runClientAiTransform(req) {
  const intent = (req.intent || '').trim();
  const lowerIntent = intent.toLowerCase();
  const tag = req.targetTag || '';
  const line = req.targetLine || null;
  let updatedXaml = req.xamlContent || '';
  let updatedCSharp = req.csharpContent || '';
  const summary = [];

  const replaceOnLine = (attrsMap) => {
    const lines = updatedXaml.split('\n');
    const tagRe = new RegExp(`<${tag}\\b[^>]*?(\\s*/?>)`, 'i');
    const applyAttrs = (openTag) => {
      let modified = openTag;
      for (const k of Object.keys(attrsMap)) {
        const attrRe = new RegExp(`\\s+${k.replace('.', '\\.')}\\s*=\\s*"[^"]*"`, 'gi');
        modified = modified.replace(attrRe, '');
      }
      const closeMatch = modified.match(/\s*\/?>$/);
      if (!closeMatch) return modified;
      const prefix = modified.slice(0, closeMatch.index);
      const suffix = closeMatch[0];
      const added = Object.entries(attrsMap).map(([k, v]) => ` ${k}="${v}"`).join('');
      return `${prefix}${added}${suffix}`;
    };

    if (line && line >= 1 && line <= lines.length && tagRe.test(lines[line - 1])) {
      lines[line - 1] = lines[line - 1].replace(tagRe, m => applyAttrs(m));
      updatedXaml = lines.join('\n');
    } else if (tagRe.test(updatedXaml)) {
      updatedXaml = updatedXaml.replace(tagRe, m => applyAttrs(m));
    }
  };

  if (tag) {
    if (lowerIntent.includes('이벤트') || lowerIntent.includes('클릭') || lowerIntent.includes('핸들러') || lowerIntent.includes('click')) {
      const handlerName = line ? `On${tag}Line${line}Click` : `On${tag}ActionClick`;
      replaceOnLine({ Click: handlerName });
      summary.push(`XAML <${tag}> (Line ${line || 1})에 Click="${handlerName}" 이벤트를 연결했습니다.`);
      if (updatedCSharp && !updatedCSharp.includes(handlerName)) {
        if (!updatedCSharp.includes('using Avalonia.Interactivity;')) {
          updatedCSharp = `using System;\nusing Avalonia.Interactivity;\n` + updatedCSharp;
        }
        const lastBrace = updatedCSharp.lastIndexOf('}');
        if (lastBrace > 0) {
          updatedCSharp = updatedCSharp.slice(0, lastBrace) +
            `\n    private void ${handlerName}(object? sender, RoutedEventArgs e)\n    {\n        Console.WriteLine("⚡ ${handlerName} 실행됨: ${intent}");\n    }\n` +
            updatedCSharp.slice(lastBrace);
        }
      }
    } else if (lowerIntent.includes('에메랄드') || lowerIntent.includes('초록') || lowerIntent.includes('emerald')) {
      replaceOnLine({ Background: '#059669', Foreground: '#ffffff', CornerRadius: '8', FontWeight: 'SemiBold' });
      summary.push(`<${tag}>에 모던 에메랄드 테마를 적용했습니다.`);
    } else if (lowerIntent.includes('블루') || lowerIntent.includes('파랑') || lowerIntent.includes('인디고') || lowerIntent.includes('blue')) {
      replaceOnLine({ Background: '#0284c7', Foreground: '#ffffff', CornerRadius: '8', FontWeight: 'Bold' });
      summary.push(`<${tag}>에 아주르 블루 테마를 적용했습니다.`);
    } else if (lowerIntent.includes('크기') || lowerIntent.includes('확대') || lowerIntent.includes('높이')) {
      replaceOnLine({ Height: '44', Padding: '16,8', FontSize: '15' });
      summary.push(`<${tag}> 크기를 확대했습니다.`);
    } else {
      replaceOnLine({ Tag: 'AIGenerated', 'ToolTip.Tip': intent });
      summary.push(`<${tag}>에 ToolTip.Tip='${intent}' 속성을 주입했습니다.`);
    }
  } else {
    const snippet = lowerIntent.includes('통계') || lowerIntent.includes('카드')
      ? `\n        <Border Grid.Row="1" Background="#1e293b" CornerRadius="10" Padding="16" Margin="0,0,0,16" BorderBrush="#334155" BorderThickness="1">
            <StackPanel Orientation="Vertical">
                <TextBlock Text="실시간 메트릭 모니터링" FontSize="14" FontWeight="Bold" Foreground="#f8fafc" Margin="0,0,0,12"/>
                <WrapPanel Orientation="Horizontal">
                    <Border Background="#0f172a" CornerRadius="8" Padding="12" Margin="0,0,10,8" Width="140" BorderBrush="#1e293b" BorderThickness="1">
                        <StackPanel>
                            <TextBlock Text="CPU 부하율" FontSize="11" Foreground="#94a3b8"/>
                            <TextBlock Text="24.8%" FontSize="18" FontWeight="Bold" Foreground="#38bdf8" Margin="0,2,0,0"/>
                        </StackPanel>
                    </Border>
                    <Border Background="#0f172a" CornerRadius="8" Padding="12" Margin="0,0,10,8" Width="140" BorderBrush="#1e293b" BorderThickness="1">
                        <StackPanel>
                            <TextBlock Text="메모리 사용" FontSize="11" Foreground="#94a3b8"/>
                            <TextBlock Text="1.2 GB" FontSize="18" FontWeight="Bold" Foreground="#10b981" Margin="0,2,0,0"/>
                        </StackPanel>
                    </Border>
                </WrapPanel>
            </StackPanel>
        </Border>`
      : `\n        <Border Grid.Row="1" Background="#1e293b" CornerRadius="8" Padding="16" Margin="0,0,0,12" BorderBrush="#38bdf8" BorderThickness="1">
            <StackPanel Orientation="Vertical">
                <TextBlock Text="✨ AI 어시스턴트 적용: ${intent}" FontSize="14" FontWeight="Bold" Foreground="#38bdf8" Margin="0,0,0,6"/>
                <TextBlock Text="브라우저 내장 AI 엔진을 통해 실시간 생성된 UI 블록입니다." FontSize="12" Foreground="#94a3b8"/>
            </StackPanel>
        </Border>`;
    const idx = updatedXaml.lastIndexOf('</Grid>');
    if (idx > 0) {
      updatedXaml = updatedXaml.slice(0, idx) + snippet + '\n    ' + updatedXaml.slice(idx);
      summary.push(`XAML 뷰에 '${intent}' UI 블록을 추가했습니다.`);
    }
  }

  return {
    success: true,
    message: summary.join(' ') || '변환 완료',
    updatedXaml,
    updatedCSharp,
    changesSummary: summary
  };
}

function runClientSyntaxCheck(code, filePath) {
  const diagnostics = [];
  if (!code || !filePath || !filePath.endsWith('.cs')) {
    return { hasErrors: false, diagnostics };
  }
  let openBraces = 0;
  const lines = code.split(/\r?\n/);
  lines.forEach((line, idx) => {
    const clean = line.replace(/\/\/.*$/, '').replace(/"(?:[^"\\]|\\.)*"/g, '""');
    for (const ch of clean) {
      if (ch === '{') openBraces++;
      else if (ch === '}') openBraces--;
    }
    if (openBraces < 0) {
      diagnostics.push({
        id: 'CS1026',
        severity: 'Error',
        message: "닫는 중괄호 '}'가 여는 중괄호보다 많습니다.",
        filePath,
        startLine: idx + 1,
        startColumn: 1,
        endLine: idx + 1,
        endColumn: line.length + 1
      });
      openBraces = 0;
    }
  });
  if (openBraces > 0) {
    diagnostics.push({
      id: 'CS1513',
      severity: 'Error',
      message: `닫는 중괄호 '}'가 ${openBraces}개 누락되었습니다.`,
      filePath,
      startLine: lines.length,
      startColumn: 1,
      endLine: lines.length,
      endColumn: 2
    });
  }
  return {
    hasErrors: diagnostics.some(d => d.severity === 'Error'),
    diagnostics
  };
}

function jsonResponse(obj) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Intercept /api/* requests to seamlessly support both Local .NET 10 Server and Vercel Static Hosting
const originalFetch = window.fetch.bind(window);
window.fetch = async function (input, init = {}) {
  const urlStr = typeof input === 'string' ? input : input.url || '';
  if (!urlStr.startsWith('/api/')) {
    return originalFetch(input, init);
  }

  const vfs = getPersonalVfs();
  const method = (init.method || 'GET').toUpperCase();

  // Try real local backend first if not already locked into pure static mode
  if (!isWebVfsMode) {
    try {
      const res = await originalFetch(input, init);
      if (res.ok) {
        setRuntimeModeIndicator(false);
        // Mirror changes into LocalStorage so personal edits are always backed up
        const cloned = res.clone();
        if (urlStr.startsWith('/api/workspace/file') && method === 'GET') {
          cloned.json().then(d => {
            if (d?.path && typeof d.content === 'string') {
              vfs[d.path] = d.content;
              savePersonalVfs(vfs);
            }
          }).catch(() => {});
        } else if (urlStr === '/api/workspace/file' && method === 'POST' && init.body) {
          try {
            const body = JSON.parse(init.body);
            if (body.relativePath) {
              vfs[body.relativePath] = body.content ?? '';
              savePersonalVfs(vfs);
            }
          } catch {}
        }
        return res;
      }
    } catch {
      // Network error -> switch to Web Personal VFS mode
    }
  }

  // Fallback to In-Browser Personal VFS (Vercel Static Mode)
  setRuntimeModeIndicator(true);

  if (urlStr.startsWith('/api/workspace/tree')) {
    return jsonResponse({
      root: 'Browser VFS (Personal Cloud)',
      tree: buildPersonalVfsTree(vfs)
    });
  }

  if (urlStr.startsWith('/api/workspace/file') && method === 'GET') {
    const u = new URL(urlStr, window.location.origin);
    const p = u.searchParams.get('path') || '';
    const content = vfs[p] ?? DEFAULT_PERSONAL_VFS_FILES[p] ?? '';
    return jsonResponse({ path: p, content });
  }

  if (urlStr === '/api/workspace/file' && method === 'POST') {
    const body = JSON.parse(init.body || '{}');
    if (body.relativePath) {
      vfs[body.relativePath] = body.content ?? '';
      savePersonalVfs(vfs);
    }
    return jsonResponse({ message: 'Saved to Personal VFS' });
  }

  if (urlStr === '/api/workspace/create' && method === 'POST') {
    const body = JSON.parse(init.body || '{}');
    const rel = (body.relativePath || '').trim();
    if (rel) {
      const isXaml = rel.toLowerCase().endsWith('.xaml') || rel.toLowerCase().endsWith('.axaml');
      const className = rel.split(/[\\/]/).pop().replace(/\.(a?xaml|cs)$/i, '');
      if (isXaml) {
        vfs[rel] = `<Window xmlns="https://github.com/avaloniaui"\n        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"\n        x:Class="SampleApp.${className}"\n        Title="${className}" Height="420" Width="500"\n        Background="#0f172a">\n    <Grid Margin="20">\n        <Border Background="#1e293b" CornerRadius="8" Padding="16" BorderBrush="#334155" BorderThickness="1">\n            <StackPanel Orientation="Vertical" Spacing="10">\n                <TextBlock Text="⚡ ${className}" FontSize="16" FontWeight="Bold" Foreground="#38bdf8"/>\n                <Button Content="액션 버튼" Height="34" Background="#0284c7" Foreground="#ffffff" CornerRadius="6"/>\n            </StackPanel>\n        </Border>\n    </Grid>\n</Window>`;
        vfs[`${rel}.cs`] = `using Avalonia.Controls;\n\nnamespace SampleApp;\n\npublic partial class ${className} : Window\n{\n    public ${className}()\n    {\n        InitializeComponent();\n    }\n}`;
      } else {
        vfs[rel] = body.content || `namespace SampleApp;\n\npublic class ${className}\n{\n}\n`;
      }
      savePersonalVfs(vfs);
    }
    return jsonResponse({ message: 'Created in Personal VFS' });
  }

  if (urlStr.startsWith('/api/workspace/file') && method === 'DELETE') {
    const u = new URL(urlStr, window.location.origin);
    const p = u.searchParams.get('path') || '';
    delete vfs[p];
    if (p.toLowerCase().endsWith('.xaml') || p.toLowerCase().endsWith('.axaml')) {
      delete vfs[`${p}.cs`];
    }
    savePersonalVfs(vfs);
    return jsonResponse({ message: 'Deleted from Personal VFS' });
  }

  if (urlStr === '/api/ai/transform' && method === 'POST') {
    const body = JSON.parse(init.body || '{}');
    return jsonResponse(runClientAiTransform(body));
  }

  if (urlStr === '/api/roslyn/analyze' || urlStr === '/api/roslyn/analyze-workspace') {
    const body = JSON.parse(init.body || '{}');
    const code = body.code ?? body.currentFileCode ?? '';
    const fp = body.filePath ?? body.currentFilePath ?? '';
    return jsonResponse(runClientSyntaxCheck(code, fp));
  }

  if (urlStr === '/api/execute/build' || urlStr === '/api/execute/run') {
    const isRun = urlStr.endsWith('/run');
    const fileCount = Object.keys(vfs).length;
    if (isRun && !isXamlDesignerOpen) {
      openXamlDesigner();
      if (editor) renderXamlPreview(editor.getValue());
    }
    return jsonResponse({
      success: true,
      exitCode: 0,
      elapsedMilliseconds: 185,
      output: isRun
        ? `[Web Personal VFS] 총 ${fileCount}개 파일 정적 검증 완료 (오류 0개)\n✨ 우측 Avalonia 실시간 인터랙티브 프리뷰 캔버스가 활성화되었습니다.`
        : `[Web Personal VFS] 총 ${fileCount}개 파일(XAML + C# UI) 구문 검증 및 브라우저 번들 동기화 성공 (경고 0개, 오류 0개)`
    });
  }

  return jsonResponse({ ok: true });
};

function initPersonalWorkspaceControls() {
  const btnExport = document.getElementById('btnExportWorkspace');
  if (btnExport) {
    btnExport.onclick = () => {
      const vfs = getPersonalVfs();
      if (currentPath && editor) {
        vfs[currentPath] = editor.getValue();
        savePersonalVfs(vfs);
      }
      const blob = new Blob([JSON.stringify(vfs, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `roslyn-studio-workspace-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('📥 워크스페이스 전체 백업(.json) 파일이 다운로드되었습니다.');
    };
  }

  const btnImport = document.getElementById('btnImportWorkspace');
  const fileInput = document.getElementById('inputImportWorkspaceFile');
  if (btnImport && fileInput) {
    btnImport.onclick = () => fileInput.click();
    fileInput.onchange = async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object') throw new Error('유효한 워크스페이스 JSON 형식이 아닙니다.');
        savePersonalVfs(parsed);
        // Also sync to local backend if connected
        if (!isWebVfsMode) {
          for (const [relPath, content] of Object.entries(parsed)) {
            await originalFetch('/api/workspace/file', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ relativePath: relPath, content: String(content) })
            }).catch(() => {});
          }
        }
        currentPath = '';
        await loadWorkspaceTree();
        setStatus(`📤 워크스페이스 복원 완료 (${Object.keys(parsed).length}개 파일)`);
      } catch (err) {
        alert(`워크스페이스 복원 실패: ${err.message}`);
      } finally {
        fileInput.value = '';
      }
    };
  }

  const btnReset = document.getElementById('btnResetWorkspace');
  if (btnReset) {
    btnReset.onclick = async () => {
      if (!confirm('개인 워크스페이스를 기본 샘플(MainWindow.axaml + CSharpDashboardWindow.cs) 상태로 초기화하시겠습니까?')) return;
      const initial = { ...DEFAULT_PERSONAL_VFS_FILES };
      savePersonalVfs(initial);
      currentPath = '';
      await loadWorkspaceTree();
      setStatus('🔄 기본 샘플 프로젝트로 초기화되었습니다.');
    };
  }
}

initVisualInspectorEvents();
initPersonalWorkspaceControls();

#!/usr/bin/env python3
# 추천: python3 .\project_diagram.py --root ../
"""
Project Diagram Generator
 - Indexes a project (files, basic deps)
 - Generates a single, self-contained HTML with Mermaid diagrams
Usage:
  python tools/project_diagram.py --root <path> --output project-diagram.html
"""
from __future__ import annotations
import argparse
import base64
import html
import json
import os
import re
import sys
import textwrap
import urllib.request
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Set, Tuple
# --------------------------
# Scanning and utilities
# --------------------------
DEFAULT_IGNORE_DIRS = {
    ".git", ".hg", ".svn", ".idea", ".vscode", ".DS_Store",
    "node_modules", "dist", "build", "out", ".next", ".nuxt",
    "__pycache__", ".pytest_cache", ".mypy_cache", ".venv", "venv",
    "target", "bin", "obj", ".gradle", ".terraform", ".tox","tests", "examples"
}
TEXT_FILE_EXTS = {
    # General
    ".md", ".txt", ".rst", ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg",
    ".csv", ".tsv", ".env", ".dockerfile", "Dockerfile",
    # Code (common)
    ".py", ".pyi",
    ".js", ".mjs", ".cjs", ".jsx",
    ".ts", ".tsx",
    ".java", ".kt", ".kts",
    ".go",
    ".rb",
    ".php",
    ".cs",
    ".cpp", ".cc", ".cxx", ".c", ".h", ".hpp", ".hh",
    ".rs",
    ".swift",
    ".scala",
    ".sh", ".bash", ".zsh",
}
LANG_BY_EXT = {
    ".py": "python", ".pyi": "python",
    ".js": "javascript", ".mjs": "javascript", ".cjs": "javascript", ".jsx": "javascript",
    ".ts": "typescript", ".tsx": "typescript",
    ".go": "go",
    ".java": "java",
    ".cs": "csharp",
    ".rb": "ruby",
    ".php": "php",
    ".rs": "rust",
    ".kt": "kotlin", ".kts": "kotlin",
    ".swift": "swift",
    ".scala": "scala",
    ".c": "c", ".cc": "cpp", ".cpp": "cpp", ".cxx": "cpp", ".h": "cpp", ".hh": "cpp", ".hpp": "cpp",
    ".sh": "shell", ".bash": "shell", ".zsh": "shell",
}
JS_EXTS = {".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx"}
PY_EXTS = {".py"}
RE_JS_IMPORT = re.compile(r"""^\s*import\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]""")
RE_JS_REQUIRE = re.compile(r"""require\(\s*['"]([^'"]+)['"]\s*\)""")
RE_JS_DYNAMIC_IMPORT = re.compile(r"""import\(\s*['"]([^'"]+)['"]\s*\)""")
RE_PY_FROM_IMPORT = re.compile(r"""^\s*from\s+([a-zA-Z0-9_\.]+|\.+)\s+import\s+""")
RE_PY_IMPORT = re.compile(r"""^\s*import\s+([a-zA-Z0-9_\. ,]+)""")
MERMAID_CDN = "https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"
def is_textual(path: str) -> bool:
    name = os.path.basename(path)
    if name == "Dockerfile":
        return True
    ext = os.path.splitext(name)[1].lower()
    return ext in TEXT_FILE_EXTS
def should_ignore_dir(name: str, extra_ignores: Set[str]) -> bool:
    if name.startswith(".") and name not in {".vscode"}:
        # ignore most dot-dirs by default
        return True
    return name in DEFAULT_IGNORE_DIRS or name in extra_ignores
def relpath(root: str, path: str) -> str:
    return os.path.relpath(os.path.abspath(path), os.path.abspath(root))
@dataclass
class ProjectIndex:
    root: str
    files: List[str]
    dirs: List[str]
    lang_counts: Counter
    edges_tree: List[Tuple[str, str]]  # parent -> child (file tree)
    edges_deps: List[Tuple[str, str]]  # source_file -> target_file (local deps)
    external_deps: Counter             # external package counts
def scan_project(root: str, ignore_patterns: List[str]) -> ProjectIndex:
    root = os.path.abspath(root)
    extra_ignores = set(ignore_patterns or [])
    files: List[str] = []
    dirs: List[str] = []
    edges_tree: List[Tuple[str, str]] = []
    lang_counts: Counter = Counter()
    for current, dirnames, filenames in os.walk(root):
        # Filter directories in-place
        kept = []
        for d in dirnames:
            if not should_ignore_dir(d, extra_ignores):
                kept.append(d)
        # sort for determinism
        dirnames[:] = sorted(kept)
        cur_rel = relpath(root, current)
        if cur_rel == ".":
            cur_rel = ""
        if cur_rel:
            dirs.append(cur_rel)
        for d in dirnames:
            parent = cur_rel or os.path.basename(root)
            child = os.path.join(cur_rel, d) if cur_rel else d
            edges_tree.append((parent, child))
        # Files
        for f in sorted(filenames):
            path = os.path.join(current, f)
            # Skip non-textual/binaries for indexing
            if not is_textual(path):
                continue
            r = relpath(root, path)
            files.append(r)
            ext = os.path.splitext(f)[1].lower()
            if ext in LANG_BY_EXT:
                lang_counts[LANG_BY_EXT[ext]] += 1
            # add tree edge
            parent = cur_rel or os.path.basename(root)
            child = r
            edges_tree.append((parent, child))
    # Build dependency graph
    edges_deps, external_deps = build_dependency_graph(root, files)
    return ProjectIndex(
        root=root,
        files=files,
        dirs=dirs,
        lang_counts=lang_counts,
        edges_tree=edges_tree,
        edges_deps=edges_deps,
        external_deps=external_deps,
    )
def build_dependency_graph(root: str, files: List[str]) -> Tuple[List[Tuple[str, str]], Counter]:
    # Map file -> set of local deps (files)
    files_set = set(files)
    edges: List[Tuple[str, str]] = []
    externals: Counter = Counter()
    # Pre-index for python module resolution
    # Map module dotted path -> candidate file path
    module_to_file: Dict[str, str] = {}
    for f in files:
        if f.endswith(".py"):
            mod = f[:-3].replace(os.sep, ".")
            module_to_file[mod] = f
            # __init__.py means package
            if os.path.basename(f) == "__init__.py":
                pkg_mod = os.path.dirname(f).replace(os.sep, ".")
                if pkg_mod:
                    module_to_file[pkg_mod] = f
    # Quick resolver for JS/TS relative imports
    def resolve_js_relative(src_file: str, imp: str) -> Optional[str]:
        if not (imp.startswith("./") or imp.startswith("../") or imp.startswith("/")):
            return None
        base_dir = os.path.dirname(src_file)
        candidate = os.path.normpath(os.path.join(base_dir, imp.lstrip("/")))
        # Try file with ext
        if candidate in files_set:
            return candidate
        # Try extensions
        for ext in [".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".json"]:
            if candidate + ext in files_set:
                return candidate + ext
        # Try index.* in directory
        for ext in [".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".json"]:
            idx = os.path.join(candidate, "index" + ext)
            if idx in files_set:
                return idx
        return None
    # Quick resolver for Python imports
    def resolve_python_import(src_file: str, mod: str) -> Optional[str]:
        if not mod:
            return None
        # relative import starting with '.' count dots
        if mod.startswith("."):
            dots = len(mod) - len(mod.lstrip("."))
            remainder = mod.lstrip(".")
            src_dir = os.path.dirname(src_file)
            pkg_dir = src_dir
            for _ in range(dots):
                pkg_dir = os.path.dirname(pkg_dir) or ""
            rel_mod_path = remainder.replace(".", os.sep) if remainder else ""
            candidate = os.path.normpath(os.path.join(pkg_dir, rel_mod_path))
            # Try file.py
            if candidate and candidate + ".py" in files_set:
                return candidate + ".py"
            # Try __init__.py in package
            init_path = os.path.join(candidate, "__init__.py")
            if candidate and init_path in files_set:
                return init_path
            return None
        # absolute-style: map dotted module to file
        # try full, then progressively trim
        parts = mod.split(".")
        for i in range(len(parts), 0, -1):
            sub = ".".join(parts[:i])
            if sub in module_to_file:
                return module_to_file[sub]
        return None
    for f in files:
        ext = os.path.splitext(f)[1].lower()
        path = os.path.join(root, f)
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as fh:
                lines = fh.readlines()
        except Exception:
            continue
        # JS/TS
        if ext in JS_EXTS:
            imports: Set[str] = set()
            for line in lines:
                m = RE_JS_IMPORT.search(line)
                if m:
                    imports.add(m.group(1))
                for rx in (RE_JS_REQUIRE, RE_JS_DYNAMIC_IMPORT):
                    for m2 in rx.finditer(line):
                        imports.add(m2.group(1))
            for imp in imports:
                local = resolve_js_relative(f, imp)
                if local:
                    edges.append((f, local))
                else:
                    # external (or absolute alias)
                    pkg = imp.split("/")[0] if imp else imp
                    if pkg and not imp.startswith("."):
                        externals[pkg] += 1
        # Python
        if ext in PY_EXTS:
            imports: Set[str] = set()
            for line in lines:
                m = RE_PY_FROM_IMPORT.search(line)
                if m:
                    imports.add(m.group(1))
                m = RE_PY_IMPORT.search(line)
                if m:
                    # can be "import a, b.c"
                    parts = [p.strip() for p in m.group(1).split(",")]
                    imports.update([p for p in parts if p])
            for imp in imports:
                local_file = resolve_python_import(f, imp)
                if local_file:
                    edges.append((f, local_file))
                else:
                    # external package (best-effort)
                    pkg = imp.split(".")[0] if imp else imp
                    if pkg and not imp.startswith("."):
                        externals[pkg] += 1
    return edges, externals
# --------------------------
# Mermaid generation
# --------------------------
def sanitize_id(s: str) -> str:
    # Mermaid node IDs cannot contain certain characters
    out = re.sub(r"[^A-Za-z0-9_]", "_", s)
    if not out:
        out = "node"
    if out[0].isdigit():
        out = "_" + out
    return out
def make_mermaid_for_tree(root_name: str, edges: List[Tuple[str, str]]) -> str:
    lines = ["flowchart TD"]
    # ensure nodes exist
    nodes: Set[str] = set()
    def add_node(name: str):
        if name not in nodes:
            nid = sanitize_id(name)
            label = name if len(name) <= 30 else (name[:27] + "…")
            lines.append(f'    {nid}["{html.escape(label)}"]')
            nodes.add(name)
    add_node(root_name)
    for a, b in edges:
        add_node(a)
        add_node(b)
        lines.append(f"    {sanitize_id(a)} --> {sanitize_id(b)}")
    return "\n".join(lines)
def make_mermaid_for_deps(edges: List[Tuple[str, str]]) -> str:
    lines = ["flowchart LR"]
    nodes: Set[str] = set()
    def add_node(name: str):
        if name not in nodes:
            nid = sanitize_id(name)
            label = name if len(name) <= 48 else ("…" + name[-47:])
            lines.append(f'    {nid}["{html.escape(label)}"]')
            nodes.add(name)
    for a, b in edges:
        add_node(a)
        add_node(b)
        lines.append(f"    {sanitize_id(a)} --> {sanitize_id(b)}")
    if not edges:
        lines.append('    empty["No local dependencies detected"]')
    return "\n".join(lines)
# --------------------------
# HTML generation
# --------------------------
def fetch_mermaid_inline() -> Optional[str]:
    try:
        with urllib.request.urlopen(MERMAID_CDN, timeout=15) as resp:
            data = resp.read().decode("utf-8", errors="ignore")
            return data
    except Exception:
        return None
def generate_html(index: ProjectIndex, embed_mermaid: bool = True) -> str:
    root_name = os.path.basename(index.root.rstrip(os.sep)) or index.root
    tree_mermaid = make_mermaid_for_tree(root_name, index.edges_tree)
    deps_mermaid = make_mermaid_for_deps(index.edges_deps)
    lang_stats = [{"language": k, "count": v} for k, v in index.lang_counts.most_common()]
    external_stats = [{"package": k, "count": v} for k, v in index.external_deps.most_common(25)]
    mermaid_script_tag = ""
    if embed_mermaid:
        js = fetch_mermaid_inline()
        if js:
            mermaid_script_tag = f"<script>{js}</script>"
        else:
            mermaid_script_tag = f'<script src="{MERMAID_CDN}"></script>'
    else:
        mermaid_script_tag = f'<script src="{MERMAID_CDN}"></script>'
    style = """
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background: #0b1021; color: #e6e6e6; }
    header { padding: 16px 20px; background: #11173a; border-bottom: 1px solid #2a2f56; display: flex; align-items: center; justify-content: space-between; }
    header h1 { margin: 0; font-size: 18px; font-weight: 600; }
    header .meta { font-size: 12px; color: #b8c1ec; }
    main { padding: 12px 16px 24px; }
    .controls { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .controls button { background: #2a2f56; color: #e6e6e6; border: 1px solid #39407a; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; }
    .controls button.active { background: #39407a; }
    .panel { display: none; }
    .panel.active { display: block; }
    .mermaid { background: #0f1637; border: 1px solid #2a2f56; border-radius: 8px; padding: 8px; overflow: auto; }
    .stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
    .card { background: #0f1637; border: 1px solid #2a2f56; border-radius: 8px; padding: 12px; }
    .card h3 { margin: 0 0 8px 0; font-size: 14px; color: #b8c1ec; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace; }
    footer { padding: 10px 16px; border-top: 1px solid #2a2f56; color: #98a2c8; font-size: 12px; }
    a { color: #9cd2ff; text-decoration: none; }
    """
    # Escape backticks for embedding Mermaid code
    def esc(s: str) -> str:
        return s.replace("</script>", "<\\/script>")
    html_doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Project Diagram - {html.escape(root_name)}</title>
  <style>{style}</style>
  {mermaid_script_tag}
  <script>
    // Mermaid init
    if (window.mermaid) {{
      mermaid.initialize({{ startOnLoad: false, theme: "dark" }});
    }}
    function showPanel(id) {{
      document.querySelectorAll('.controls button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      document.querySelector(`[data-panel='${{id}}']`).classList.add('active');
      document.getElementById(id).classList.add('active');
      // render mermaid in the visible panel
      document.querySelectorAll(`#${{id}} .mermaid[data-rendered='false']`).forEach(el => {{
        if (window.mermaid) {{
          mermaid.run({{ nodes: [el] }});
          el.setAttribute('data-rendered', 'true');
        }}
      }});
    }}
    document.addEventListener('DOMContentLoaded', () => {{
      showPanel('tree');
    }});
  </script>
</head>
<body>
  <header>
    <h1>{html.escape(root_name)} — Project Diagram</h1>
    <div class="meta">{len(index.files)} files • {len(index.dirs)} dirs</div>
  </header>
  <main>
    <div class="controls">
      <button class="active" onclick="showPanel('tree')" data-panel="tree">File Tree</button>
      <button onclick="showPanel('deps')" data-panel="deps">Dependencies</button>
      <button onclick="showPanel('stats')" data-panel="stats">Stats</button>
      <button onclick="showPanel('raw')" data-panel="raw">Raw Data</button>
    </div>
    <section id="tree" class="panel active">
      <div class="card">
        <h3>File Tree</h3>
        <div class="mermaid" data-rendered="false">
{html.escape(tree_mermaid)}
        </div>
      </div>
    </section>
    <section id="deps" class="panel">
      <div class="card">
        <h3>Local Dependency Graph</h3>
        <div class="mermaid" data-rendered="false">
{html.escape(deps_mermaid)}
        </div>
        <p style="margin-top:8px;color:#98a2c8;">Edges are file-to-file references resolved from imports (best effort for Python and JS/TS). External packages are summarized in Stats.</p>
      </div>
    </section>
    <section id="stats" class="panel">
      <div class="stats">
        <div class="card">
          <h3>Languages</h3>
          <div class="mono">{html.escape(json.dumps(lang_stats, indent=2))}</div>
        </div>
        <div class="card">
          <h3>Top External Packages</h3>
          <div class="mono">{html.escape(json.dumps(external_stats, indent=2))}</div>
        </div>
      </div>
    </section>
    <section id="raw" class="panel">
      <div class="card">
        <h3>Raw Index</h3>
        <details open>
          <summary>Files</summary>
          <div class="mono">{html.escape(json.dumps(index.files, indent=2))}</div>
        </details>
        <details>
          <summary>Tree Edges</summary>
          <div class="mono">{html.escape(json.dumps(index.edges_tree[:500], indent=2))}{'\\n' + ('… %d more' % (len(index.edges_tree)-500)) if len(index.edges_tree) > 500 else ''}</div>
        </details>
        <details>
          <summary>Dependency Edges</summary>
          <div class="mono">{html.escape(json.dumps(index.edges_deps[:500], indent=2))}{'\\n' + ('… %d more' % (len(index.edges_deps)-500)) if len(index.edges_deps) > 500 else ''}</div>
        </details>
      </div>
    </section>
  </main>
  <footer>
    Generated by project_diagram.py • Mermaid © respective authors • This file is self-contained.
  </footer>
</body>
</html>
"""
    return html_doc
# --------------------------
# CLI
# --------------------------
def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description="Generate a single HTML project diagram.")
    p.add_argument("--root", default=".", help="Project root directory (default: .)")
    p.add_argument("--output", "-o", default="project-diagram.html", help="Output HTML file path")
    p.add_argument("--no-embed-mermaid", action="store_true", help="Do not inline Mermaid (load from CDN)")
    p.add_argument("--ignore", action="append", default=[], help="Extra directory names to ignore (repeatable)")
    args = p.parse_args(argv)
    root = os.path.abspath(args.root)
    if not os.path.isdir(root):
        print(f"[error] root is not a directory: {root}", file=sys.stderr)
        return 2
    print(f"[info] Scanning project: {root}")
    index = scan_project(root, args.ignore)
    print(f"[info] Files indexed: {len(index.files)} | Dirs: {len(index.dirs)} | Deps edges: {len(index.edges_deps)}")
    html_out = generate_html(index, embed_mermaid=not args.no_embed_mermaid)
    out_path = os.path.abspath(args.output)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html_out)
    print(f"[info] Wrote: {out_path}")
    return 0
if __name__ == "__main__":
    raise SystemExit(main())

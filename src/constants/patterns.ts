// src/constants/patterns.ts
export const DEFAULT_IGNORE_PATTERNS: ReadonlyArray<string> = [
  // Node
  "node_modules",
  "package-lock.json",
  "yarn.lock",
  ".npm",

  // Version Control
  ".git",
  ".svn",
  ".hg",

  // Build
  "dist",
  "build",
  "out",

  // Python
  ".venv/**",
  "venv/**",
  "__pycache__",
  "*.pyc",
  "*.pyo",
  "*.pyd",
  ".Python",
  "pip-log.txt",
  "pip-delete-this-directory.txt",
  ".tox",
  ".coverage",
  ".coverage.*",
  ".cache",
  "nosetests.xml",
  "coverage.xml",
  "*.cover",
  "*.log",
  ".pytest_cache",

  // IDE
  ".idea",
  ".vscode",
  "*.swp",
  "*.swo",

  // Temp
  ".tmp",
  "tmp",

  // OS
  ".DS_Store",
  "Thumbs.db",

  // Common binary files
  "*.jpg",
  "*.jpeg",
  "*.png",
  "*.gif",
  "*.ico",
  "*.pdf",
  "*.exe",
  "*.dll",
  "*.so",
  "*.dylib",

  // Project specific
  "codesnap",
] as const;

export const DEFAULT_IGNORE_PATTERNS = [
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
  // IDE
  ".idea",
  ".vscode",
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
  "codesnap",
] as const;

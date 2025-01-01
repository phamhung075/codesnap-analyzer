export interface AnalyzeOptions {
  maxFileSize?: number;
  include?: string[];
  exclude?: string[];
  output?: string | null;
}

export interface AnalyzeResult {
  files: FileInfo[];
  stats: DirectoryStats;
  tokenCounts: TokenCount;
  summary: string;
  tree: string;
}

export interface FileInfo {
  path: string;
  content: string | null;
  size: number;
}

export interface DirectoryStats {
  totalFiles: number;
  totalSize: number;
}

export interface TokenCount {
  gpt35: number;
  gpt4: number;
  claude: number;
  llama2: number;
}

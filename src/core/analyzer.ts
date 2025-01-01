// src/core/analyzer.ts
import fs from 'fs-extra';
import path from 'path';
import { Minimatch } from 'minimatch';
import { FileInfo, DirectoryStats, AnalyzeOptions, AnalyzeResult, TokenCount } from '../types/types';
import { FILE_LIMITS } from '../constants/analyze';
import { DEFAULT_IGNORE_PATTERNS } from '../constants/patterns';
import { FileUtils } from '../utils/file';
import { TokenCounter } from '../utils/token-counter';
import { OutputFormatter } from '../services/formatter';

export class DirectoryAnalyzer {
  private readonly directory: string;
  private readonly options: AnalyzeOptions;
  private readonly ignorePatterns: Set<string>;
  private readonly baseDirectory: string;

  constructor(directory: string, options: AnalyzeOptions = {}) {
    this.directory = path.resolve(directory);
    this.baseDirectory = this.directory;
    this.options = options;
    this.ignorePatterns = new Set<string>();
    this.loadIgnorePatterns();
  }

  private loadIgnorePatterns(): void {
    // Add default patterns first
    DEFAULT_IGNORE_PATTERNS.forEach(pattern => this.ignorePatterns.add(pattern));

    // Find and process all .gitignore files from root to target directory
    let currentDir = this.directory;
    const gitignoreFiles: string[] = [];

    // Traverse up the directory tree to find all .gitignore files
    while (true) {
      const gitignorePath = path.join(currentDir, '.gitignore');
      if (fs.existsSync(gitignorePath)) {
        gitignoreFiles.unshift(gitignorePath); // Add to start for correct priority
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) { // Reached root
        break;
      }
      currentDir = parentDir;
    }

    // Process found .gitignore files
    if (gitignoreFiles.length > 0) {
      console.log('\n📋 Found .gitignore files:');
      gitignoreFiles.forEach(filePath => {
        console.log(`   ✅ ${filePath}`);
        this.processGitignoreFile(filePath);
      });
    } else {
      console.log('\n⚠️ No .gitignore files found in directory hierarchy');
      console.log('   Using default ignore patterns only');
    }

    // Log all active patterns
    console.log('\n📋 Active ignore patterns:');
    console.log('\n   Default patterns:');
    DEFAULT_IGNORE_PATTERNS.forEach(pattern => {
      console.log(`   - ${pattern}`);
    });

    if (gitignoreFiles.length > 0) {
      console.log('\n   From .gitignore files:');
      Array.from(this.ignorePatterns)
        .filter(pattern => !DEFAULT_IGNORE_PATTERNS.includes(pattern as any))
        .forEach(pattern => {
          console.log(`   - ${pattern}`);
        });
    }
  }

  private processGitignoreFile(gitignorePath: string): void {
    try {
      const gitignoreDir = path.dirname(gitignorePath);
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      const patterns = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

      patterns.forEach(pattern => {
        if (pattern.startsWith('!')) {
          // Handle negation patterns
          const negatedPattern = pattern.slice(1);
          this.ignorePatterns.delete(this.normalizePattern(negatedPattern, gitignoreDir));
        } else {
          // Handle regular patterns
          this.ignorePatterns.add(this.normalizePattern(pattern, gitignoreDir));
        }
      });
    } catch (error) {
      console.warn(`   ⚠️  Error processing ${gitignorePath}:`, error);
    }
  }

  private normalizePattern(pattern: string, gitignoreDir: string): string {
    // Remove leading slash
    pattern = pattern.startsWith('/') ? pattern.slice(1) : pattern;

    // Handle absolute paths relative to the gitignore location
    const relativeToBase = path.relative(this.baseDirectory, gitignoreDir);
    pattern = relativeToBase ? `${relativeToBase}/${pattern}` : pattern;

    return pattern.replace(/\\/g, '/');
  }

  private shouldIgnore(filePath: string): boolean {
    const relativePath = path.relative(this.baseDirectory, filePath).replace(/\\/g, '/');

    return Array.from(this.ignorePatterns).some(pattern => {
      // Handle directory-only patterns (ending with /)
      if (pattern.endsWith('/')) {
        return new Minimatch(pattern.slice(0, -1), { dot: true }).match(relativePath);
      }

      // Handle file patterns
      return new Minimatch(pattern, { dot: true }).match(relativePath);
    });
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(this.baseDirectory, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (this.shouldIgnore(fullPath)) {
          console.log(`   ⏭️  Skipping directory: ${relativePath} (matches ignore pattern)`);
          continue;
        }
        files.push(...(await this.getAllFiles(fullPath)));
      } else {
        if (this.shouldIgnore(fullPath)) {
          console.log(`   ⏭️  Skipping file: ${relativePath} (matches ignore pattern)`);
          continue;
        }
        files.push(fullPath);
      }
    }

    return files.sort();
  }

  async analyze(): Promise<{ files: FileInfo[], stats: DirectoryStats, tokenCounts: TokenCount }> {
    console.log('\n📂 Starting directory analysis...');
    console.log(`📁 Base directory: ${this.directory}`);

    const stats: DirectoryStats = {
      totalFiles: 0,
      totalSize: 0
    };

    const files: FileInfo[] = [];
    const maxFileSize = this.options.maxFileSize || FILE_LIMITS.MAX_FILE_SIZE;

    console.log(`\n⚙️  Settings:`);
    console.log(`   Max file size: ${(maxFileSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Max total files: ${FILE_LIMITS.MAX_FILES}`);
    console.log(`   Max total size: ${(FILE_LIMITS.MAX_TOTAL_SIZE / 1024 / 1024).toFixed(2)} MB`);

    console.log('\n🔍 Scanning for files...');
    const allFiles = await this.getAllFiles(this.directory);
    console.log(`✨ Found ${allFiles.length} files total`);

    console.log('\n📄 Processing files:');
    for (const filePath of allFiles) {
      const relativePath = path.relative(this.directory, filePath).replace(/\\/g, '/');
      const fileSize = (await fs.stat(filePath)).size;

      const isText = await FileUtils.isTextFile(filePath);
      let content: string | null = null;

      if (isText && fileSize <= maxFileSize) {
        try {
          content = await FileUtils.readFileContent(filePath);
          console.log(`   ✅ Reading: ${relativePath}`);
        } catch (error) {
          console.warn(`   ❌ Failed to read: ${relativePath} - Error: ${error}`);
          continue;
        }
      } else {
        const skipReason = [];
        if (!isText) skipReason.push('binary file');
        if (fileSize > maxFileSize) skipReason.push('file too large');
        console.log(`   ⏭️  Skipping content for: ${relativePath} (${skipReason.join(', ')})`);
      }

      files.push({
        path: relativePath,
        content,
        size: fileSize
      });

      stats.totalFiles += 1;
      stats.totalSize += fileSize;

      if (stats.totalFiles > FILE_LIMITS.MAX_FILES) {
        console.log('\n⚠️  Reached maximum file limit');
        break;
      }
      if (stats.totalSize > FILE_LIMITS.MAX_TOTAL_SIZE) {
        console.log('\n⚠️  Reached maximum total size limit');
        break;
      }
    }

    // Calculate tokens
    const allContent = files
      .map(file => file.content)
      .filter((content): content is string => content !== null)
      .join('\n');

    const tokenCounts = await TokenCounter.countTokens(allContent);

    return {
      files: files.sort((a, b) => a.path.localeCompare(b.path)),
      stats,
      tokenCounts
    };
  }
}

export async function analyze(directory: string, options: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const analyzer = new DirectoryAnalyzer(directory, options);
  const { files, stats, tokenCounts } = await analyzer.analyze();

  const summary = OutputFormatter.createSummary(directory, stats, tokenCounts);
  const tree = OutputFormatter.createTree(files);
  const content = OutputFormatter.createContent(files);

  if (options.output) {
    const outputContent = `${summary}\n\n${tree}\n\n${content}`;
    await fs.ensureDir(path.dirname(options.output));
    await fs.writeFile(options.output, outputContent, 'utf-8');
  }

  return {
    files,
    stats,
    tokenCounts,
    summary,
    tree
  };
}
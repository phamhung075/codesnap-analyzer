// src/_core/helper/codesnap/services/analyzer.ts
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
    private readonly ignorePatterns: string[];

    constructor(directory: string, options: AnalyzeOptions = {}) {
        this.directory = directory;
        this.options = options;
        this.ignorePatterns = this.loadGitignorePatterns();
    }

    private loadGitignorePatterns(): string[] {
        const allPatterns: Set<string> = new Set();
        const gitignorePath = path.join(this.directory, '.gitignore');

        // First add default patterns
        DEFAULT_IGNORE_PATTERNS.forEach(pattern => allPatterns.add(pattern));

        console.log('\n🔍 Looking for .gitignore at:', gitignorePath);

        try {
            if (fs.existsSync(gitignorePath)) {
                console.log('✅ Found .gitignore file');
                const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
                const gitignorePatterns = gitignoreContent
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'));

                gitignorePatterns.forEach(pattern => {
                    allPatterns.add(pattern);
                    // Add version with trailing slash for directories if not present
                    if (!pattern.endsWith('/')) {
                        allPatterns.add(`${pattern}/`);
                    }
                });

                console.log('\n📋 Active ignore patterns:');
                console.log('\n   Default patterns:');
                DEFAULT_IGNORE_PATTERNS.forEach(pattern => {
                    console.log(`   - ${pattern}`);
                });

                console.log('\n   From .gitignore:');
                gitignorePatterns.forEach(pattern => {
                    console.log(`   - ${pattern}`);
                });
            } else {
                console.log('❌ No .gitignore file found');
                console.log('\n📋 Using only default ignore patterns:');
                DEFAULT_IGNORE_PATTERNS.forEach(pattern => {
                    console.log(`   - ${pattern}`);
                });
            }
        } catch (error) {
            console.warn('❌ Error reading .gitignore:', error);
        }

        return Array.from(allPatterns);
    }

    private shouldSkipDirectory(dirPath: string): boolean {
        const relativePath = path.relative(this.directory, dirPath).replace(/\\/g, '/');
        return this.ignorePatterns.some(pattern => {
            pattern = pattern.replace(/\/$/, '');

            // For directory patterns without wildcards
            if (!pattern.includes('*')) {
                return relativePath === pattern || relativePath.startsWith(`${pattern}/`);
            }

            // For patterns with wildcards
            const matcher = new Minimatch(pattern, { dot: true });
            return matcher.match(relativePath);
        });
    }

    private shouldSkipFile(filePath: string): boolean {
        const relativePath = path.relative(this.directory, filePath).replace(/\\/g, '/');
        return this.ignorePatterns.some(pattern => {
            // Remove trailing slash if exists
            pattern = pattern.replace(/\/$/, '');

            // For exact file matches without wildcards
            if (!pattern.includes('*')) {
                return relativePath === pattern;
            }

            // For patterns with wildcards
            const matcher = new Minimatch(pattern, { dot: true });
            return matcher.match(relativePath);
        });
    }

    private async getAllFiles(dir: string): Promise<string[]> {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const files: string[] = [];

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(this.directory, fullPath).replace(/\\/g, '/');

            if (entry.isDirectory()) {
                if (this.shouldSkipDirectory(fullPath)) {
                    console.log(`   ⏭️  Skipping directory: ${relativePath} (matches ignore pattern)`);
                    continue;
                }
                files.push(...(await this.getAllFiles(fullPath)));
            } else {
                if (this.shouldSkipFile(fullPath)) {
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
                let skipReason = [];
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

        console.log('\n📊 Analysis complete!');
        console.log(`   Total files processed: ${stats.totalFiles}`);
        console.log(`   Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
        console.log('\n' + TokenCounter.formatTokenCounts(tokenCounts));

        return { files: files.sort((a, b) => a.path.localeCompare(b.path)), stats, tokenCounts };
    }

}

export async function analyze(directory: string, options: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const analyzer = new DirectoryAnalyzer(directory, options);
  const { files, stats, tokenCounts } = await analyzer.analyze();
  
  // Create summary and tree using the formatter
  const summary = OutputFormatter.createSummary(directory, stats, tokenCounts);
  const tree = OutputFormatter.createTree(files);
  const content = OutputFormatter.createContent(files);

  // Write to output file if specified
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
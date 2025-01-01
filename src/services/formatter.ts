// src/services/formatter.ts
import path from 'path';
import { FileInfo, DirectoryStats, TokenCount } from '../types/types';
import { TokenCounter } from '../utils/token-counter';

interface TreeNode {
  name: string;
  type: 'file' | 'directory';
  children: TreeNode[];
  path: string;
}

export class OutputFormatter {
  static createSummary(directory: string, stats: DirectoryStats, tokenCounts: TokenCount): string {
    const summary = TokenCounter.formatTokenCounts(tokenCounts);

    const lines = [
      `Project Directory: ${path.basename(directory)}`,
      `Total Files Analyzed: ${stats.totalFiles}`,
      `Total Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`,
      `Date: ${new Date().toISOString()}`,
      '',
      summary
    ];

    return lines.join('\n');
  }

  private static formatNumber(num: number): string {
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`;
    }
    if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return num.toString();
  }

  static createTree(files: FileInfo[]): string {
    const tree = this.buildFileTree(files);
    const lines = ['Directory structure:', ...this.renderTree(tree)];
    return lines.join('\n');
  }

  private static buildFileTree(files: FileInfo[]): TreeNode {
    const root: TreeNode = {
      name: '',
      type: 'directory',
      children: [],
      path: ''
    };

    // Sort files to ensure consistent ordering
    const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

    for (const file of sortedFiles) {
      const parts = file.path.split(/[\\/]/);
      let currentNode = root;

      // Process each part of the path
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        const nodePath = parts.slice(0, i + 1).join('/');

        // Find existing node or create new one
        let node = currentNode.children.find(n => n.name === part);
        
        if (!node) {
          node = {
            name: part,
            type: isFile ? 'file' : 'directory',
            children: [],
            path: nodePath
          };
          currentNode.children.push(node);
          
          // Sort children after adding new node
          currentNode.children.sort((a, b) => {
            // Directories come first
            if (a.type !== b.type) {
              return a.type === 'directory' ? -1 : 1;
            }
            // Then sort alphabetically
            return a.name.localeCompare(b.name);
          });
        }

        currentNode = node;
      }
    }

    return root;
  }

  private static renderTree(node: TreeNode, prefix: string = '', isLast: boolean = true, level: number = 0): string[] {
    const lines: string[] = [];

    if (node.name) {
      const line = prefix + (isLast ? '└── ' : '├── ') + node.name + (node.type === 'directory' ? '/' : '');
      lines.push(line);
    }

    const childPrefix = node.name ? prefix + (isLast ? '    ' : '│   ') : '';

    if (node.type === 'directory') {
      node.children.forEach((child, index) => {
        const isLastChild = index === node.children.length - 1;
        lines.push(...this.renderTree(child, childPrefix, isLastChild, level + 1));
      });
    }

    return lines;
  }

  static createContent(files: FileInfo[]): string {
    const output: string[] = [];
    const separator = '=' + '='.repeat(47) + '\n';

    // Add README.md first if it exists
    const readme = files.find(f => f.path.toLowerCase() === 'readme.md');
    if (readme?.content) {
      output.push(separator + `File: ${readme.path}\n` + separator + readme.content + '\n');
    }

    // Add all other files
    files.forEach(file => {
      if (file.content && file.path.toLowerCase() !== 'readme.md') {
        output.push(separator + `File: ${file.path}\n` + separator + file.content + '\n');
      }
    });

    return output.join('\n');
  }
}
import fs from 'fs-extra';
import path from 'path';

interface ComponentInfo {
    type: 'class' | 'function' | 'interface' | 'constant' | 'type';
    name: string;
    methods?: string[];
    properties?: string[];
    content?: string;
}

export class ArchitectureFormatter {
    private readonly basePath: string;
    private readonly outputPath: string;
    private readonly ignoreDirs = ['node_modules', '.git', 'dist', 'build', 'coverage'];

    constructor(basePath: string, outputPath: string) {
        this.basePath = basePath;
        this.outputPath = outputPath;
    }

    private extractBraceContent(content: string, startIndex: number): string | null {
        let braceCount = 0;
        let start = -1;
        
        for (let i = startIndex; i < content.length; i++) {
            if (content[i] === '{') {
                if (braceCount === 0) start = i;
                braceCount++;
            } else if (content[i] === '}') {
                braceCount--;
                if (braceCount === 0 && start !== -1) {
                    return content.substring(start, i + 1);
                }
            }
        }
        return null;
    }

    private formatBraceContent(content: string): string {
        if (!content) return '';
        // Remove outer braces and trim
        content = content.slice(1, -1).trim();
        // Split by commas and format each line
        const lines = content.split(',').map(line => line.trim()).filter(line => line);
        return lines.map(line => `        ${line}`).join('\n');
    }

    private async analyzeFile(filePath: string): Promise<{ name: string; description?: string; components: ComponentInfo[] }> {
        const content = await fs.readFile(filePath, 'utf-8');
        const components: ComponentInfo[] = [];

        // Extract file description from comments
        const commentMatch = content.match(/\/\*\*([\s\S]*?)\*\//);
        const description = commentMatch 
            ? commentMatch[1].replace(/\s*\*\s*/g, '').trim()
            : undefined;

        // Find classes and their methods with content
        const classMatches = content.matchAll(/(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*{([^}]+)}/g);
        for (const match of classMatches) {
            const className = match[1];
            const classContent = match[2];
            const methods: string[] = [];
            const methodRegex = /(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)(?:\s*:\s*[^{;]+)?/g;
            
            let methodMatch;
            while ((methodMatch = methodRegex.exec(classContent)) !== null) {
                const methodName = methodMatch[0];
                if (!methodName.includes(className) && !methodName.startsWith('_')) {
                    // Get content inside braces if it exists
                    const braceContent = this.extractBraceContent(classContent, methodMatch.index + methodMatch[0].length);
                    methods.push(methodName + (braceContent ? ' ' + braceContent : ''));
                }
            }
            
            components.push({ type: 'class', name: className, methods });
        }

        // Find interfaces with content
        const interfaceRegex = /(?:export\s+)?interface\s+(\w+)\s*{([^}]+)}/g;
        let match;
        while ((match = interfaceRegex.exec(content)) !== null) {
            const properties = match[2]
                .split('\n')
                .map(line => line.trim())
                .filter(line => line);
            components.push({ 
                type: 'interface', 
                name: match[1],
                properties
            });
        }

        // Find constants with their values
        const constRegex = /(?:export\s+)?const\s+([A-Z_][A-Z0-9_]*)\s*=\s*({[^}]+}|\[[^\]]+\])/g;
        while ((match = constRegex.exec(content)) !== null) {
            const braceContent = match[2];
            components.push({ 
                type: 'constant', 
                name: match[1],
                content: braceContent
            });
        }

        // Find functions with their signatures
        const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*[^{]+)?/g;
        while ((match = functionRegex.exec(content)) !== null) {
            const braceContent = this.extractBraceContent(content, match.index + match[0].length);
            components.push({ 
                type: 'function', 
                name: match[1],
                content: braceContent || ''
            });
        }

        return {
            name: path.basename(filePath),
            description,
            components
        };
    }

    private formatComponent(comp: ComponentInfo, prefix: string): string {
        let output = `${prefix}- ${comp.type}: ${comp.name}`;
        
        if (comp.content) {
            output += ' {\n';
            output += this.formatBraceContent(comp.content);
            output += `\n${prefix}  }`;
        }
        output += '\n';

        if (comp.methods?.length) {
            comp.methods.forEach(method => {
                const hasBraces = method.includes('{');
                if (hasBraces) {
                    const [signature, content] = method.split('{');
                    output += `${prefix}    - ${signature.trim()} {\n`;
                    output += this.formatBraceContent(`{${content}`);
                    output += `\n${prefix}      }`;
                } else {
                    output += `${prefix}    - ${method.trim()}`;
                }
                output += '\n';
            });
        }

        if (comp.properties?.length) {
            output += comp.properties.map(prop => `${prefix}    ${prop}\n`).join('');
        }

        return output;
    }

    private async scanDirectory(currentPath: string, prefix: string = ''): Promise<string> {
        let output = '';
        const files = await fs.readdir(currentPath, { withFileTypes: true });
        const items = files.filter(file => !this.ignoreDirs.includes(file.name));
        
        for (let i = 0; i < items.length; i++) {
            const file = items[i];
            const isLast = i === items.length - 1;
            const fullPath = path.join(currentPath, file.name);
            
            const currentPrefix = isLast ? '└── ' : '├── ';
            const nestedPrefix = prefix + (isLast ? '    ' : '│   ');

            if (file.isDirectory()) {
                output += `${prefix}${currentPrefix}${file.name}/\n`;
                output += await this.scanDirectory(fullPath, nestedPrefix);
            } else if (file.name.endsWith('.ts') || file.name.endsWith('.js')) {
                const analysis = await this.analyzeFile(fullPath);
                output += `${prefix}${currentPrefix}${file.name}`;
                if (analysis.description) {
                    output += ` # ${analysis.description}`;
                }
                output += '\n';

                // Format components with proper indentation
                analysis.components.forEach(comp => {
                    output += this.formatComponent(comp, nestedPrefix + '    ');
                });
            }
        }

        return output;
    }

    public async generateArchitectureFile(): Promise<void> {
        let output = '# Project Architecture\n\n';
        output += await this.scanDirectory(this.basePath);
        await fs.writeFile(this.outputPath, output, 'utf-8');
        console.log(`✅ Architecture documentation written to: ${this.outputPath}`);
    }
}

export async function generateFormattedArchitecture(basePath: string, outputPath: string): Promise<void> {
    const formatter = new ArchitectureFormatter(basePath, outputPath);
    await formatter.generateArchitectureFile();
}
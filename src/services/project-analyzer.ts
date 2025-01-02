import fs from 'fs-extra';
import path from 'path';

interface MethodInfo {
    name: string;
    parameters: string[];
    returnType?: string;
    visibility?: 'public' | 'private' | 'protected';
    isStatic?: boolean;
    isAsync?: boolean;
    content: string;
}

interface PropertyInfo {
    name: string;
    type: string;
    visibility?: 'public' | 'private' | 'protected';
    isOptional?: boolean;
    defaultValue?: string;
}

interface CodeComponent {
    type: 'class' | 'function' | 'interface' | 'constant' | 'type';
    name: string;
    methods?: MethodInfo[];
    properties?: PropertyInfo[];
    content?: string;
    extends?: string;
    implements?: string[];
}

export interface AnalysisOptions {
    directory: string;
    output?: string;
    format?: 'md' | 'json';
}

export interface AnalysisResult {
    success: boolean;
    outputPath?: string;
    error?: string;
}

export class ProjectAnalyzer {
    private readonly basePath: string;
    private readonly outputPath: string;
    private readonly ignoreDirs = ['node_modules', '.git', 'dist', 'build', 'coverage'];

    constructor(basePath: string, outputPath: string) {
        this.basePath = path.resolve(basePath);
        this.outputPath = outputPath;
    }

    private extractBraceContent(content: string): string {
        let braceCount = 1;
        const startIndex = content.indexOf('{') + 1;
        let endIndex = startIndex;

        for (let i = startIndex; i < content.length; i++) {
            if (content[i] === '{') braceCount++;
            if (content[i] === '}') braceCount--;
            
            if (braceCount === 0) {
                endIndex = i;
                break;
            }
        }

        return content.slice(startIndex, endIndex).trim();
    }

    private parseMethodSignature(signature: string): Omit<MethodInfo, 'content'> {
        const result = {
            name: '',
            parameters: [] as string[],
            returnType: undefined as string | undefined,
            visibility: undefined as 'public' | 'private' | 'protected' | undefined,
            isStatic: false,
            isAsync: false
        };

        // Extract visibility
        if (signature.includes('private ')) result.visibility = 'private';
        else if (signature.includes('protected ')) result.visibility = 'protected';
        else if (signature.includes('public ')) result.visibility = 'public';

        // Check modifiers
        result.isStatic = signature.includes('static ');
        result.isAsync = signature.includes('async ');

        // Extract name and parameters
        const methodMatch = signature.match(/(\w+)\s*\((.*?)\)/);
        if (methodMatch) {
            result.name = methodMatch[1];
            result.parameters = methodMatch[2]
                .split(',')
                .map(param => param.trim())
                .filter(Boolean);
        }

        // Extract return type
        const returnMatch = signature.match(/\):\s*([^{]+)/);
        if (returnMatch) {
            result.returnType = returnMatch[1].trim();
        }

        return result;
    }

    private parsePropertyDeclaration(declaration: string): PropertyInfo {
        const result: PropertyInfo = {
            name: '',
            type: '',
            isOptional: false
        };

        // Extract visibility
        if (declaration.includes('private ')) result.visibility = 'private';
        else if (declaration.includes('protected ')) result.visibility = 'protected';
        else if (declaration.includes('public ')) result.visibility = 'public';

        // Parse property structure
        const match = declaration.match(/(\w+)(\??):\s*([^;=]+)(?:\s*=\s*(.+))?/);
        if (match) {
            result.name = match[1];
            result.isOptional = match[2] === '?';
            result.type = match[3].trim();
            if (match[4]) {
                result.defaultValue = match[4].trim().replace(/;$/, '');
            }
        }

        return result;
    }

    private async analyzeFile(filePath: string): Promise<CodeComponent[]> {
        const content = await fs.readFile(filePath, 'utf-8');
        const components: CodeComponent[] = [];

        // Extract constants
        const constantRegex = /(?:export\s+)?const\s+([A-Z_][A-Z0-9_]*)\s*=\s*({[\s\S]*?});/g;
        let match;
        while ((match = constantRegex.exec(content))) {
            components.push({
                type: 'constant',
                name: match[1],
                content: match[2]
            });
        }

        // Extract functions
        const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)[^{]*{/g;
        while ((match = functionRegex.exec(content))) {
            const signature = content.slice(match.index, match.index + match[0].length - 1);
            const methodInfo = this.parseMethodSignature(signature);
            components.push({
                type: 'function',
                name: methodInfo.name,
                methods: [{
                    ...methodInfo,
                    content: ''
                }]
            });
        }

        // Extract classes
        const classRegex = /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?\s*{([^}]+)}/g;
        while ((match = classRegex.exec(content))) {
            const [, className, extendsClass, implementsStr, classBody] = match;
            
            const methods: MethodInfo[] = [];
            const properties: PropertyInfo[] = [];

            // Extract methods
            const methodRegex = /(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)(?:\s*:\s*[^{]+)?{[^}]+}/g;
            let methodMatch;
            while ((methodMatch = methodRegex.exec(classBody))) {
                const methodSignature = methodMatch[0].substring(0, methodMatch[0].indexOf('{'));
                const methodContent = this.extractBraceContent(methodMatch[0]);
                
                const parsedMethod = this.parseMethodSignature(methodSignature);
                if (!parsedMethod.name.startsWith('_')) {
                    methods.push({
                        ...parsedMethod,
                        content: methodContent
                    });
                }
            }

            // Extract properties
            const propertyRegex = /(?:public|private|protected)?\s+readonly?\s*(\w+)(?:\?)?:\s*([^;\n]+)(?:;|\n|$)/g;
            let propertyMatch;
            while ((propertyMatch = propertyRegex.exec(classBody))) {
                const propertyInfo = this.parsePropertyDeclaration(propertyMatch[0]);
                if (!propertyInfo.name.startsWith('_')) {
                    properties.push(propertyInfo);
                }
            }

            components.push({
                type: 'class',
                name: className,
                extends: extendsClass,
                implements: implementsStr ? implementsStr.split(',').map(s => s.trim()) : undefined,
                methods,
                properties
            });
        }

        // Extract interfaces
        const interfaceRegex = /(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+(\w+))?\s*{([^}]+)}/g;
        while ((match = interfaceRegex.exec(content))) {
            const [, interfaceName, extendsInterface, interfaceBody] = match;
            const properties: PropertyInfo[] = [];

            const propertyLines = interfaceBody
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('//'));

            for (const line of propertyLines) {
                const propertyInfo = this.parsePropertyDeclaration(line);
                if (propertyInfo.name) {
                    properties.push(propertyInfo);
                }
            }

            components.push({
                type: 'interface',
                name: interfaceName,
                extends: extendsInterface,
                properties
            });
        }

        return components;
    }

    private renderTreeLine(prefix: string, isLast: boolean, content: string): string {
        return `${prefix}${isLast ? '└── ' : '├── '}${content}\n`;
    }

    private formatComponent(comp: CodeComponent, prefix: string, isLast: boolean): string {
        let output = '';
        let constStr = '';
        const newPrefix = prefix + (isLast ? '    ' : '│   ');

        switch (comp.type) {
            case 'class':
                output += this.renderTreeLine(prefix, false, `Class: ${comp.name}`);
                
                // Properties group
                if (comp.properties?.length) {
                    output += this.renderTreeLine(newPrefix, !comp.methods?.length, 'Properties');
                    const propsPrefix = newPrefix + '│   ';
                    comp.properties.forEach((prop, idx) => {
                        const isLastProp = idx === comp.properties!.length - 1;
                        let propStr = prop.name;
                        if (prop.type) propStr += `: ${prop.type}`;
                        output += this.renderTreeLine(propsPrefix, isLastProp, propStr);
                    });
                }

                // Methods group
                if (comp.methods?.length) {
                    output += this.renderTreeLine(newPrefix, true, 'Methods');
                    const methodsPrefix = newPrefix + '│   ';
                    comp.methods.forEach((method, idx) => {
                        const isLastMethod = idx === comp.methods!.length - 1;
                        let methodStr = method.name;
                        if (method.visibility) methodStr = `${method.visibility} ${methodStr}`;
                        if (method.isStatic) methodStr = `static ${methodStr}`;
                        methodStr += `(${method.parameters.join(', ')})`;
                        if (method.returnType) methodStr += `: ${method.returnType}`;
                        output += this.renderTreeLine(methodsPrefix, isLastMethod, methodStr);
                    });
                }
                break;

            case 'interface':
                output += this.renderTreeLine(prefix, false, `Interface: ${comp.name}`);
                if (comp.properties?.length) {
                    comp.properties.forEach((prop, idx) => {
                        const isLastProp = idx === comp.properties!.length - 1;
                        let propStr = prop.name;
                        if (prop.isOptional) propStr += '?';
                        propStr += `: ${prop.type}`;
                        output += this.renderTreeLine(newPrefix, isLastProp, propStr);
                    });
                }
                break;

            case 'constant':
                output += this.renderTreeLine(prefix, false, 'Constants');
                constStr = comp.name;
                if (comp.content) {
                    constStr += ` ${comp.content}`;
                }
                output += this.renderTreeLine(newPrefix, true, constStr);
                break;

            case 'function':
                output += this.renderTreeLine(prefix, false, 'Functions');
                if (comp.methods?.[0]) {
                    const method = comp.methods[0];
                    let funcStr = method.name;
                    if (method.isAsync) funcStr = `async ${funcStr}`;
                    funcStr += `(${method.parameters.join(', ')})`;
                    if (method.returnType) funcStr += `: ${method.returnType}`;
                    output += this.renderTreeLine(newPrefix, true, funcStr);
                }
                break;
        }

        return output;
    }

    private async generateDirectoryTree(dir: string, prefix = ''): Promise<string> {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const filteredEntries = entries
            .filter(entry => !this.ignoreDirs.includes(entry.name))
            .filter(entry => !entry.name.startsWith('.'));

        let output = '';

        for (let i = 0; i < filteredEntries.length; i++) {
            const entry = filteredEntries[i];
            const isLast = i === filteredEntries.length - 1;
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                output += this.renderTreeLine(prefix, isLast, entry.name + '/');
                output += await this.generateDirectoryTree(
                    fullPath,
                    prefix + (isLast ? '    ' : '│   ')
                );
            } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) {
                output += this.renderTreeLine(prefix, isLast, entry.name);
                const components = await this.analyzeFile(fullPath);
                
                // Group components by type
                const typeOrder = ['constant', 'interface', 'class', 'function'];
                const grouped = components.reduce((acc, comp) => {
                    if (!acc[comp.type]) acc[comp.type] = [];
                    acc[comp.type].push(comp);
                    return acc;
                }, {} as Record<string, CodeComponent[]>);

                const newPrefix = prefix + (isLast ? '    ' : '│   ');
                
                // Output components in specified order
                typeOrder.forEach(type => {
                    if (grouped[type]) {
                        grouped[type].forEach((comp, idx) => {
                            const isLastOfType = idx === grouped[type].length - 1;
                            output += this.formatComponent(comp, newPrefix, isLastOfType);
                        });
                    }
                });
            }
        }

        return output;
    }

    public async analyze(): Promise<void> {
        const output = '# Project Architecture\n\n';
        const structure = await this.generateDirectoryTree(this.basePath);
        await fs.writeFile(this.outputPath, output + structure, 'utf-8');
    }
}

export async function generateAnalysis(options: AnalysisOptions): Promise<AnalysisResult> {
    try {
        const analyzer = new ProjectAnalyzer(options.directory, options.output || 'project-analysis.md');
        await analyzer.analyze();
        return {
            success: true,
            outputPath: options.output
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
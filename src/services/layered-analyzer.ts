// src/services/layered-analyzer.ts
import type { TSESTree } from "@typescript-eslint/typescript-estree";
import {
  AST_NODE_TYPES,
  parse,
  simpleTraverse as SimpleTraverser,
} from "@typescript-eslint/typescript-estree";
import * as path from "path";
import { DirectoryAnalyzer } from "../core/analyzer";
import {
  LayerOptions,
  LayeredAnalysis,
  Component,
  ComponentRelation,
  ComponentMetrics,
  APIDefinition,
  APIEndpoint,
  APIParameter,
  ASTNode,
  MethodNode,
  ClassNode,
} from "../types/layer-types";
import { FileInfo } from "../types/types";
import { console } from "inspector";

export class LayeredAnalyzer {
  private readonly baseAnalyzer: DirectoryAnalyzer;
  private readonly options: LayerOptions;
  private cache: Map<string, LayeredAnalysis>;

  constructor(directory: string, options: LayerOptions) {
    this.baseAnalyzer = new DirectoryAnalyzer(directory, options);
    this.options = options;
    this.cache = new Map();
  }

  private generateCacheKey(): string {
    return `${this.options.depth}-${this.options.focusPath || "all"}-${Date.now()}`;
  }

  async analyze(): Promise<LayeredAnalysis> {
    const cacheKey = this.generateCacheKey();
    const cachedResult = await this.cache.get(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }

    const { files } = await this.baseAnalyzer.analyze();

    let result: LayeredAnalysis;
    switch (this.options.depth) {
      case "top":
        result = await this.analyzeTopLayer(files);
        break;
      case "middle":
        result = await this.analyzeMiddleLayer(files);
        break;
      case "detail":
        result = await this.analyzeDetailLayer(files, this.options.focusPath);
        break;
      default:
        throw new Error(`Invalid analysis depth: ${this.options.depth}`);
    }

    this.cache.set(cacheKey, result);
    return result;
  }

  private async analyzeHighLevelRelations(
    components: Component[]
  ): Promise<ComponentRelation[]> {
    const relations: ComponentRelation[] = [];

    for (const source of components) {
      for (const target of components) {
        if (source.path === target.path) continue;

        // Check for dependencies
        if (source.dependencies.includes(target.path)) {
          relations.push({
            source: source.path,
            target: target.path,
            type: "imports",
            weight: await this.calculateRelationWeight(source, target),
          });
        }
      }
    }

    return relations;
  }

  private async calculateRelationWeight(
    source: Component,
    target: Component
  ): Promise<number> {
    // Weight calculation factors:
    // 1. Number of imports/references (0.4)
    // 2. Shared responsibilities (0.3)
    // 3. Change coupling (0.3)

    const importWeight = await this.calculateImportWeight(source, target);
    const responsibilityWeight = this.calculateResponsibilityWeight(
      source,
      target
    );
    const changeWeight = await this.calculateChangeWeight(source, target);

    return importWeight * 0.4 + responsibilityWeight * 0.3 + changeWeight * 0.3;
  }

  private async calculateImportWeight(
    source: Component,
    target: Component
  ): Promise<number> {
    // Count direct imports and references
    const importCount = source.dependencies.filter(
      (d) => d === target.path
    ).length;
    return Math.min(importCount / 10, 1); // Normalize to 0-1
  }

  private calculateResponsibilityWeight(
    source: Component,
    target: Component
  ): number {
    // Compare component descriptions and APIs for shared concepts
    const sourceTerms = new Set(source.description.toLowerCase().split(/\W+/));
    const targetTerms = new Set(target.description.toLowerCase().split(/\W+/));

    let sharedTerms = 0;
    for (const term of sourceTerms) {
      if (targetTerms.has(term)) sharedTerms++;
    }

    return sharedTerms / Math.max(sourceTerms.size, targetTerms.size);
  }

  private async calculateChangeWeight(
    source: Component,
    target: Component
  ): Promise<number> {
    // Calculate how often the components change together
    if (!source.changeFrequency || !target.changeFrequency) return 0;

    return Math.min(
      source.changeFrequency / target.changeFrequency,
      target.changeFrequency / source.changeFrequency
    );
  }

  private async analyzeTopLayer(files: FileInfo[]): Promise<LayeredAnalysis> {
    const components = await this.identifyMajorComponents(files);
    const relations = await this.analyzeHighLevelRelations(components);
    const metrics = await this.calculateMetrics(components, relations);

    return {
      layer: "top",
      components,
      relations,
      metrics,
      timestamp: Date.now(),
      version: "1.0.0",
    };
  }

  private async extractModuleDependencies(
    files: FileInfo[]
  ): Promise<string[]> {
    const dependencies: Set<string> = new Set();

    for (const file of files) {
      if (!file.content) continue;

      try {
        const ast = parse(file.content, {
          range: true,
          loc: true,
          comment: true,
          tokens: true,
          jsx: true,
        });

        SimpleTraverser(ast, {
          enter(node: ASTNode) {
            if (node.type === AST_NODE_TYPES.ImportDeclaration) {
              const importPath = (node as TSESTree.ImportDeclaration).source
                .value;
              if (typeof importPath === "string") {
                dependencies.add(importPath);
              }
            }
          },
        });
      } catch (error) {
        console.warn(
          `Erreur lors de l'analyse du fichier ${file.path} pour les dépendances :`,
          error
        );
      }
    }

    return Array.from(dependencies);
  }

  private async calculateChangeFrequency(files: FileInfo[]): Promise<number> {
    // Implementation would typically involve git history analysis
    // For now, return a placeholder value
    return files.length > 0 ? 0.5 : 0;
  }

  private calculateHalsteadVolume(content: string): number {
    // Basic Halstead volume calculation
    const operators = new Set<string>();
    const operands = new Set<string>();

    // Simple tokenization for demonstration
    const tokens = content.match(/[a-zA-Z_]\w*|[+\-*/=<>!&|]+/g) || [];

    for (const token of tokens) {
      if (token.match(/^[+\-*/=<>!&|]+$/)) {
        operators.add(token);
      } else {
        operands.add(token);
      }
    }

    const n1 = operators.size;
    const n2 = operands.size;
    const N1 = tokens.filter((t) => t.match(/^[+\-*/=<>!&|]+$/)).length;
    const N2 = tokens.filter((t) => !t.match(/^[+\-*/=<>!&|]+$/)).length;

    return (N1 + N2) * Math.log2(n1 + n2);
  }

  private async calculateMaintainability(files: FileInfo[]): Promise<number> {
    // Calculate maintainability index using standard formula
    let totalMaintainability = 0;

    for (const file of files) {
      if (!file.content) continue;

      const volume = this.calculateHalsteadVolume(file.content);
      const complexity = await this.calculateModuleComplexity([file]);
      const loc = file.content.split("\n").length;

      // Maintainability Index formula
      const mi = Math.max(
        0,
        ((171 -
          5.2 * Math.log(volume) -
          0.23 * complexity -
          16.2 * Math.log(loc)) *
          100) /
          171
      );

      totalMaintainability += mi;
    }

    return files.length > 0 ? totalMaintainability / files.length : 0;
  }

  private async identifyMajorComponents(
    files: FileInfo[]
  ): Promise<Component[]> {
    const components: Component[] = [];
    const moduleGroups = this.groupFilesByModule(files);

    for (const [modulePath, moduleFiles] of moduleGroups.entries()) {
      const complexity = await this.calculateModuleComplexity(moduleFiles);
      const dependencies = await this.extractModuleDependencies(moduleFiles);

      components.push({
        path: modulePath,
        type: "module",
        name: path.basename(modulePath),
        description: await this.generateModuleDescription(moduleFiles),
        complexity,
        dependencies,
        changeFrequency: await this.calculateChangeFrequency(moduleFiles),
        maintainability: await this.calculateMaintainability(moduleFiles),
      });
    }

    return components;
  }

  private groupFilesByModule(files: FileInfo[]): Map<string, FileInfo[]> {
    const moduleGroups = new Map<string, FileInfo[]>();

    for (const file of files) {
      const modulePath = this.getModulePath(file.path);
      const moduleFiles = moduleGroups.get(modulePath) || [];
      moduleFiles.push(file);
      moduleGroups.set(modulePath, moduleFiles);
    }

    return moduleGroups;
  }

  private getModulePath(filePath: string): string {
    // Get the parent directory as the module path
    return path.dirname(filePath);
  }

  private async generateModuleDescription(files: FileInfo[]): Promise<string> {
    // Analyze file contents to generate a meaningful description
    const contents = files
      .map((f) => f.content)
      .filter((content): content is string => content !== null)
      .join("\n");

    // Extract key concepts and responsibilities
    const concepts = await this.extractKeyConcepts(contents);
    return concepts.join(". ");
  }

  private async extractKeyConcepts(content: string): Promise<string[]> {
    const concepts: string[] = [];

    // Parse comments and documentation
    const commentRegex = /\/\*\*([\s\S]*?)\*\/|\/\/.*/g;
    const comments = content.match(commentRegex) || [];

    // Extract key terms and phrases
    for (const comment of comments) {
      const cleaned = comment.replace(/\/\*\*|\*\/|\/\//g, "").trim();
      if (cleaned) concepts.push(cleaned);
    }

    return concepts;
  }

  private async calculateModuleComplexity(files: FileInfo[]): Promise<number> {
    let totalComplexity = 0;

    for (const file of files) {
      if (!file.content) continue;

      try {
        const ast = parse(file.content, {
          range: true,
          loc: true,
          comment: true,
          tokens: true,
          jsx: true,
        });

        // Calculate cyclomatic complexity
        totalComplexity += this.calculateCyclomaticComplexity(ast);
      } catch (error) {
        console.warn(`Error parsing file ${file.path}:`, error);
      }
    }

    return totalComplexity / files.length; // Average complexity
  }

  private calculateCyclomaticComplexity(ast: TSESTree.Node): number {
    let complexity = 1; // Base complexity

    SimpleTraverser(ast, {
      enter(node: TSESTree.Node) {
        switch (node.type) {
          case AST_NODE_TYPES.IfStatement:
          case AST_NODE_TYPES.WhileStatement:
          case AST_NODE_TYPES.DoWhileStatement:
          case AST_NODE_TYPES.ForStatement:
          case AST_NODE_TYPES.ForInStatement:
          case AST_NODE_TYPES.ForOfStatement:
          case AST_NODE_TYPES.ConditionalExpression:
            complexity++;
            break;
          case AST_NODE_TYPES.SwitchCase:
            if ((node as TSESTree.SwitchCase).test) complexity++;
            break;
          case AST_NODE_TYPES.LogicalExpression:
            if (
              (node as TSESTree.LogicalExpression).operator === "&&" ||
              (node as TSESTree.LogicalExpression).operator === "||"
            ) {
              complexity++;
            }
            break;
        }
      },
    });

    return complexity;
  }

  private async analyzeMiddleLayer(
    files: FileInfo[]
  ): Promise<LayeredAnalysis> {
    const components = await this.identifyModuleBoundaries(files);
    const relations = await this.analyzeModuleInterconnections(components);
    const metrics = await this.calculateMetrics(components, relations);

    return {
      layer: "middle",
      components,
      relations,
      metrics,
      timestamp: Date.now(),
      version: "1.0.0",
    };
  }

  private async identifyModuleBoundaries(
    files: FileInfo[]
  ): Promise<Component[]> {
    // Similar to identifyMajorComponents but with more focus on boundaries
    const components = await this.identifyMajorComponents(files);

    // Enhance with boundary information
    for (const component of components) {
      const apis = await this.extractAPIs(
        files.filter((f) => f.path.startsWith(component.path))
      );
      if (apis.length > 0) {
        component.apis = apis;
      }
    }

    return components;
  }

  private async analyzeModuleInterconnections(
    components: Component[]
  ): Promise<ComponentRelation[]> {
    const relations = await this.analyzeHighLevelRelations(components);

    // Enhance with more detailed interconnection analysis
    for (const relation of relations) {
      const source = components.find((c) => c.path === relation.source);
      const target = components.find((c) => c.path === relation.target);

      if (source?.apis && target?.apis) {
        relation.description = this.analyzeAPIUsage(source.apis, target.apis);
      }
    }

    return relations;
  }

  private analyzeAPIUsage(
    sourceApis: APIDefinition[],
    targetApis: APIDefinition[]
  ): string {
    const usages: string[] = [];

    for (const sourceApi of sourceApis) {
      for (const targetApi of targetApis) {
        // Check for API dependencies
        const dependencies = this.findAPIDependencies(sourceApi, targetApi);
        if (dependencies.length > 0) {
          usages.push(
            `${sourceApi.name} uses ${targetApi.name} for: ${dependencies.join(", ")}`
          );
        }
      }
    }

    return usages.join(". ");
  }

  private findAPIDependencies(
    source: APIDefinition,
    target: APIDefinition
  ): string[] {
    const dependencies: string[] = [];

    // Check endpoint usage
    for (const sourceEndpoint of source.endpoints) {
      for (const targetEndpoint of target.endpoints) {
        if (this.endpointsDependOn(sourceEndpoint, targetEndpoint)) {
          dependencies.push(`${sourceEndpoint.name} → ${targetEndpoint.name}`);
        }
      }
    }

    return dependencies;
  }

  private endpointsDependOn(source: APIEndpoint, target: APIEndpoint): boolean {
    // Check if source endpoint depends on target endpoint
    // 1. Check parameter type dependencies
    const parameterDependency = source.parameters.some((param) =>
      target.parameters.some((targetParam) => param.type === targetParam.type)
    );

    // 2. Check return type dependencies
    const returnTypeDependency = source.returnType.includes(target.returnType);

    // 3. Check path dependencies (if one is a subset of another)
    const pathDependency =
      source.path.includes(target.path) || target.path.includes(source.path);

    return parameterDependency || returnTypeDependency || pathDependency;
  }

  private async analyzeDetailLayer(
    files: FileInfo[],
    focusPath?: string
  ): Promise<LayeredAnalysis> {
    const targetFiles = focusPath
      ? files.filter((f) => f.path.startsWith(focusPath))
      : files;

    const components = await this.performDetailedAnalysis(targetFiles);
    const relations = await this.analyzeDetailedRelations(components);
    const metrics = await this.calculateDetailedMetrics(components, relations);

    return {
      layer: "detail",
      components,
      relations,
      metrics,
      timestamp: Date.now(),
      version: "1.0.0",
    };
  }

  private async performDetailedAnalysis(
    files: FileInfo[]
  ): Promise<Component[]> {
    const components: Component[] = [];

    for (const file of files) {
      if (!file.content) continue;

      try {
        const ast = parse(file.content, {
          range: true,
          loc: true,
          comment: true,
          tokens: true,
          jsx: true,
        });

        const complexity = this.calculateCyclomaticComplexity(ast);
        const dependencies = await this.extractModuleDependencies([file]);
        const apis = await this.extractAPIs([file]);

        components.push({
          path: file.path,
          type: "file",
          name: path.basename(file.path),
          description: await this.generateModuleDescription([file]),
          complexity,
          dependencies,
          changeFrequency: await this.calculateChangeFrequency([file]),
          maintainability: await this.calculateMaintainability([file]),
          apis: apis.length > 0 ? apis : undefined,
        });
      } catch (error) {
        console.warn(`Error analyzing file ${file.path}:`, error);
      }
    }

    return components;
  }

  private async analyzeDetailedRelations(
    components: Component[]
  ): Promise<ComponentRelation[]> {
    const relations: ComponentRelation[] = [];

    for (const source of components) {
      for (const target of components) {
        if (source.path === target.path) continue;

        const relation = await this.analyzeComponentRelation(source, target);
        if (relation) {
          relations.push(relation);
        }
      }
    }

    return relations;
  }

  private async analyzeComponentRelation(
    source: Component,
    target: Component
  ): Promise<ComponentRelation | null> {
    // Analyze the relationship between two components
    const weight = await this.calculateRelationWeight(source, target);

    if (weight > 0) {
      return {
        source: source.path,
        target: target.path,
        type: "imports",
        weight,
        description: `Relationship strength: ${(weight * 100).toFixed(1)}%`,
      };
    }

    return null;
  }

  private async calculateMetrics(
    components: Component[],
    relations: ComponentRelation[]
  ): Promise<ComponentMetrics> {
    return {
      totalComponents: components.length,
      averageComplexity: this.calculateAverageComplexity(components),
      dependencyDepth: this.calculateDependencyDepth(relations),
      cohesion: await this.calculateCohesion(components),
      coupling: this.calculateCoupling(components, relations),
    };
  }

  private calculateAverageComplexity(components: Component[]): number {
    return (
      components.reduce((sum, c) => sum + c.complexity, 0) / components.length
    );
  }

  private calculateDependencyDepth(relations: ComponentRelation[]): number {
    // Calculate the maximum depth of the dependency tree
    const graph = this.buildDependencyGraph(relations);
    return this.findLongestPath(graph);
  }

  private buildDependencyGraph(
    relations: ComponentRelation[]
  ): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();

    for (const relation of relations) {
      const targets = graph.get(relation.source) || new Set<string>();
      targets.add(relation.target);
      graph.set(relation.source, targets);
    }

    return graph;
  }

  private findLongestPath(graph: Map<string, Set<string>>): number {
    let maxDepth = 0;
    const visited = new Set<string>();

    function dfs(node: string, depth: number): void {
      if (visited.has(node)) return;

      visited.add(node);
      maxDepth = Math.max(maxDepth, depth);

      const neighbors = graph.get(node) || new Set<string>();
      for (const neighbor of neighbors) {
        dfs(neighbor, depth + 1);
      }

      visited.delete(node);
    }

    for (const node of graph.keys()) {
      dfs(node, 0);
    }

    return maxDepth;
  }

  private async calculateCohesion(components: Component[]): Promise<number> {
    // Calculate cohesion based on:
    // 1. Shared responsibilities
    // 2. Internal dependencies
    // 3. Semantic similarity

    let totalCohesion = 0;

    for (const component of components) {
      const internalCohesion = await this.calculateInternalCohesion(component);
      totalCohesion += internalCohesion;
    }

    return totalCohesion / components.length;
  }

  private async calculateInternalCohesion(
    component: Component
  ): Promise<number> {
    // Factor 1: Method-Method Cohesion
    const methodCohesion = await this.calculateMethodCohesion(component);

    // Factor 2: Property Usage Cohesion
    const propertyCohesion = await this.calculatePropertyCohesion(component);

    // Factor 3: Semantic Cohesion
    const semanticCohesion = await this.calculateSemanticCohesion(component);

    // Weighted average of different cohesion metrics
    return (
      methodCohesion * 0.4 + propertyCohesion * 0.3 + semanticCohesion * 0.3
    );
  }

  private async calculateMethodCohesion(component: Component): Promise<number> {
    if (!component.apis) return 0;

    let sharedParameters = 0;
    let totalComparisons = 0;

    // Compare method parameters and return types
    for (const api of component.apis) {
      for (const endpoint1 of api.endpoints) {
        for (const endpoint2 of api.endpoints) {
          if (endpoint1 === endpoint2) continue;

          const sharedParams = this.countSharedParameters(
            endpoint1.parameters,
            endpoint2.parameters
          );

          sharedParameters += sharedParams;
          totalComparisons++;
        }
      }
    }

    return totalComparisons > 0
      ? sharedParameters / (totalComparisons * 2) // Normalize to 0-1
      : 0;
  }

  private countSharedParameters(
    params1: APIParameter[],
    params2: APIParameter[]
  ): number {
    let shared = 0;

    for (const p1 of params1) {
      for (const p2 of params2) {
        if (p1.type === p2.type) shared++;
      }
    }

    return shared;
  }

  private async calculatePropertyCohesion(
    component: Component
  ): Promise<number> {
    if (!component.apis) return 0;

    let sharedProperties = 0;
    let totalProperties = 0;

    // Analyze property usage across methods
    for (const api of component.apis) {
      for (const type of api.types) {
        if (type.properties) {
          const propertyUsage = await this.analyzePropertyUsage(
            type.properties,
            api.endpoints
          );

          sharedProperties += propertyUsage.shared;
          totalProperties += propertyUsage.total;
        }
      }
    }

    return totalProperties > 0 ? sharedProperties / totalProperties : 0;
  }

  private async analyzePropertyUsage(
    properties: Record<string, string>,
    endpoints: APIEndpoint[]
  ): Promise<{ shared: number; total: number }> {
    let shared = 0;
    const total = Object.keys(properties).length;

    for (const [, type] of Object.entries(properties)) {
      let usageCount = 0;

      for (const endpoint of endpoints) {
        // Check if property is used in parameters or return type
        const isUsed =
          endpoint.parameters.some((p) => p.type === type) ||
          endpoint.returnType.includes(type);

        if (isUsed) usageCount++;
      }

      if (usageCount > 1) shared++;
    }

    return { shared, total };
  }

  private async calculateSemanticCohesion(
    component: Component
  ): Promise<number> {
    // Calculate semantic similarity between different parts of the component
    const terms = await this.extractSemanticTerms(component);

    if (terms.length < 2) return 1;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < terms.length; i++) {
      for (let j = i + 1; j < terms.length; j++) {
        totalSimilarity += this.calculateTermSimilarity(terms[i], terms[j]);
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  private async extractSemanticTerms(component: Component): Promise<string[]> {
    const terms: string[] = [];

    // Extract terms from component name and description
    terms.push(...component.name.split(/[^a-zA-Z0-9]+/));
    terms.push(...component.description.split(/[^a-zA-Z0-9]+/));

    // Extract terms from APIs if available
    if (component.apis) {
      for (const api of component.apis) {
        terms.push(...api.name.split(/[^a-zA-Z0-9]+/));
        for (const endpoint of api.endpoints) {
          terms.push(...endpoint.name.split(/[^a-zA-Z0-9]+/));
          terms.push(...endpoint.description.split(/[^a-zA-Z0-9]+/));
        }
      }
    }

    // Clean and normalize terms
    return terms
      .map((term) => term.toLowerCase())
      .filter((term) => term.length > 2) // Remove short terms
      .filter((term, index, self) => self.indexOf(term) === index); // Remove duplicates
  }

  private calculateTermSimilarity(term1: string, term2: string): number {
    // Simple Levenshtein distance-based similarity
    const distance = this.levenshteinDistance(term1, term2);
    const maxLength = Math.max(term1.length, term2.length);

    return 1 - distance / maxLength;
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () =>
      Array(n + 1).fill(0)
    );

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j - 1] + 1, // substitution
            dp[i - 1][j] + 1, // deletion
            dp[i][j - 1] + 1 // insertion
          );
        }
      }
    }

    return dp[m][n];
  }

  private calculateCoupling(
    components: Component[],
    relations: ComponentRelation[]
  ): number {
    // Calculate coupling based on:
    // 1. Afferent coupling (incoming dependencies)
    // 2. Efferent coupling (outgoing dependencies)
    // 3. Instability (ratio of efferent coupling)

    let totalCoupling = 0;

    for (const component of components) {
      const afferentCoupling = this.calculateAfferentCoupling(
        component,
        relations
      );
      const efferentCoupling = this.calculateEfferentCoupling(
        component,
        relations
      );

      const instability =
        efferentCoupling / (afferentCoupling + efferentCoupling);
      totalCoupling += instability;
    }

    return totalCoupling / components.length;
  }

  private calculateAfferentCoupling(
    component: Component,
    relations: ComponentRelation[]
  ): number {
    // Count incoming dependencies
    return relations.filter((r) => r.target === component.path).length;
  }

  private calculateEfferentCoupling(
    component: Component,
    relations: ComponentRelation[]
  ): number {
    // Count outgoing dependencies
    return relations.filter((r) => r.source === component.path).length;
  }

  private async extractAPIs(files: FileInfo[]): Promise<APIDefinition[]> {
    const apis: APIDefinition[] = [];

    for (const file of files) {
      if (!file.content) continue;

      try {
        const ast = parse(file.content, {
          range: true,
          loc: true,
          comment: true,
          tokens: true,
          jsx: true,
        });

        // Extract API definitions from AST
        const fileApis = await this.extractAPIsFromAST(ast);
        apis.push(...fileApis);
      } catch (error) {
        console.warn(`Error parsing file ${file.path} for APIs:`, error);
      }
    }

    return apis;
  }

  private async extractAPIsFromAST(ast: ASTNode): Promise<APIDefinition[]> {
    const apis: APIDefinition[] = [];
    let currentApi: Partial<APIDefinition> | null = null;

    const createEndpointFromMethod = (methodNode: MethodNode): APIEndpoint => {
      return {
        name: methodNode.key.name,
        path: `/${methodNode.key.name}`,
        method: "GET", // Default, should be extracted from decorators
        parameters: this.extractMethodParameters(methodNode),
        returnType: this.extractMethodReturnType(methodNode),
        description: this.extractMethodDescription(methodNode),
      };
    };

    SimpleTraverser(ast, {
      enter: (node: ASTNode) => {
        switch (node.type) {
          case AST_NODE_TYPES.ClassDeclaration: {
            const classNode = node as ClassNode;
            currentApi = {
              name: classNode.id.name,
              version: "1.0.0",
              endpoints: [],
              types: [],
            };
            break;
          }
          case AST_NODE_TYPES.MethodDefinition: {
            const methodNode = node as MethodNode;
            if (currentApi && methodNode.key.type === "Identifier") {
              const endpoint = createEndpointFromMethod(methodNode);
              currentApi.endpoints = [
                ...(currentApi.endpoints || []),
                endpoint,
              ];
            }
            break;
          }
        }
      },

      leave: (node: ASTNode) => {
        if (node.type === AST_NODE_TYPES.ClassDeclaration && currentApi) {
          apis.push(currentApi as APIDefinition);
          currentApi = null;
        }
      },
    });

    return apis;
  }

  private extractMethodParameters(methodNode: MethodNode): APIParameter[] {
    const parameters: APIParameter[] = [];

    if (
      methodNode.value.type === AST_NODE_TYPES.FunctionExpression ||
      methodNode.value.type === AST_NODE_TYPES.TSEmptyBodyFunctionExpression
    ) {
      for (const param of methodNode.value.params) {
        if (param.type === AST_NODE_TYPES.Identifier) {
          parameters.push({
            name: param.name,
            type: this.getParameterType(param),
            description: "",
            required: true, // Default to true; adjust logic as needed
          });
        }
      }
    }

    return parameters;
  }

  private getParameterType(param: TSESTree.Identifier): string {
    if ("typeAnnotation" in param && param.typeAnnotation) {
      return this.typeAnnotationToString(param.typeAnnotation);
    }
    return "any";
  }

  private typeAnnotationToString(
    typeAnnotation: TSESTree.TSTypeAnnotation
  ): string {
    const type = typeAnnotation.typeAnnotation;
    switch (type.type) {
      case AST_NODE_TYPES.TSStringKeyword:
        return "string";
      case AST_NODE_TYPES.TSNumberKeyword:
        return "number";
      case AST_NODE_TYPES.TSBooleanKeyword:
        return "boolean";
      case AST_NODE_TYPES.TSObjectKeyword:
        return "object";
      case AST_NODE_TYPES.TSArrayType:
        return `${this.typeAnnotationToString({ typeAnnotation: type.elementType } as TSESTree.TSTypeAnnotation)}[]`;
      default:
        return "any";
    }
  }

  private extractMethodReturnType(methodNode: MethodNode): string {
    if (
      methodNode.value.type === AST_NODE_TYPES.FunctionExpression ||
      methodNode.value.type === AST_NODE_TYPES.TSEmptyBodyFunctionExpression
    ) {
      if ("returnType" in methodNode.value && methodNode.value.returnType) {
        return this.typeAnnotationToString(methodNode.value.returnType);
      }
    }
    return "any";
  }

  private extractMethodDescription(
    methodNode: TSESTree.MethodDefinition
  ): string {
    // Access leading comments directly from MethodDefinition node
    const comments =
      (methodNode as TSESTree.Node & { leadingComments?: TSESTree.Comment[] })
        .leadingComments || [];

    for (const comment of comments) {
      if (comment.type === "Block" && comment.value.trim().startsWith("*")) {
        // Parse JSDoc comment
        return comment.value
          .split("\n")
          .map((line: string) => line.trim().replace(/^\*\s?/, ""))
          .filter((line: string) => line.length > 0)
          .join(" ");
      }
    }

    return "";
  }

  private async calculateDetailedMetrics(
    components: Component[],
    relations: ComponentRelation[]
  ): Promise<ComponentMetrics> {
    const totalComponents = components.length;
    const averageComplexity = this.calculateAverageComplexity(components);
    const dependencyDepth = this.calculateDependencyDepth(relations);
    const cohesion = await this.calculateCohesion(components);
    const coupling = this.calculateCoupling(components, relations);

    return {
      totalComponents,
      averageComplexity,
      dependencyDepth,
      cohesion,
      coupling,
    };
  }
}

// README.md
# CodeSnap Analyzer Node.js

A tool for creating comprehensive snapshots of your codebase with token counting for LLMs.

## Installation

```bash
npm install -g codesnap-analyzer
```

## Usage

### Command Line

```bash
# Analyze current directory
codesnap

# Analyze specific directory
codesnap ./my-project

# With options
codesnap . -o output.txt -i "*.ts" "*.tsx" -e "tests" "docs"
```

### Programmatic Usage

```typescript
import { analyze } from 'codesnap-analyzer';

async function analyzeProject() {
  const result = await analyze('./my-project', {
    output: 'analysis.txt',
    includePatterns: ['*.ts', '*.tsx'],
    excludePatterns: ['tests', 'docs']
  });

  console.log(result.summary);
  console.log(result.tokenCounts);
}
```

## Features

- Comprehensive codebase analysis
- Token counting for multiple LLM models (GPT-3.5, GPT-4, Claude, LLaMA 2)
- Respect .gitignore patterns
- Customizable include/exclude patterns
- Binary file detection
- Size limits handling
- Tree structure visualization

## Options

- \`output\`: Output file path
- \`excludePatterns\`: Additional patterns to exclude
- \`includePatterns\`: Patterns to include

## Token Counting

Provides token counts for:
- GPT-3.5
- GPT-4
- Claude
- LLaMA 2

## License

MIT

# CodeSnap Analyzer Node.js
https://github.com/phamhung075/codesnap-analyzer

A tool for creating comprehensive snapshots of your codebase with token counting for LLMs.
result like GitIngest
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

### Example Output Command Line
```
PS D:\DaiHung\__labo\codesnap> codesnap . 
📸 Starting CodeSnap analysis...
📁 Project: codesnap-analyzer
📂 Directory: D:\DaiHung\__labo\codesnap
📝 Output will be saved to: D:\DaiHung\__labo\codesnap\codesnap\codesnap-analyzer.txt

🔍 Looking for .gitignore at: D:\DaiHung\__labo\codesnap\.gitignore
✅ Found .gitignore file

📋 Active ignore patterns:

   Default patterns:
   - node_modules
   - package-lock.json
   - yarn.lock
   - .npm
   - .git
   - .svn
   - .hg
   - dist
   - build
   - out
   - .idea
   - .vscode
   - .tmp
   - tmp
   - .DS_Store
   - Thumbs.db
   - *.jpg
   - *.jpeg
   - *.png
   - *.gif
   - *.ico
   - *.pdf
   - *.exe
   - *.dll
   - *.so
   - *.dylib
   - codesnap

   From .gitignore:
   - node_modules/
   - package-lock.json
   - yarn.lock
   - .npm/
   - dist/
   - build/
   - lib/
   - *.tsbuildinfo
   - coverage/
   - .nyc_output/
   - jest-report/
   - test-report/
   - logs/
   - *.log
   - npm-debug.log*
   - yarn-debug.log*
   - yarn-error.log*
   - pids
   - *.pid
   - *.seed
   - *.pid.lock
   - .idea/
   - .vscode/
   - *.swp
   - *.swo
   - .DS_Store
   - .env
   - .env.*
   - !.env.example
   - .temp/
   - .tmp/
   - .cache/
   - *.tsbuildinfo
   - .npm
   - .eslintcache
   - docs/_build/
   - docs/_static/
   - docs/_templates/
   - debug.log
   - debug.test.log
   - output/
   - codesnap/

📂 Starting directory analysis...
📁 Base directory: D:\DaiHung\__labo\codesnap

⚙️  Settings:
   Max file size: 10.00 MB
   Max total files: 10000
   Max total size: 500.00 MB

🔍 Scanning for files...
   ⏭️  Skipping directory: .git (matches ignore pattern)
   ⏭️  Skipping directory: codesnap (matches ignore pattern)
   ⏭️  Skipping directory: dist (matches ignore pattern)
   ⏭️  Skipping directory: node_modules (matches ignore pattern)
✨ Found 18 files total

📄 Processing files:
   ✅ Reading: .gitignore
   ✅ Reading: README.md
   ✅ Reading: eslint.config.mjs
   ✅ Reading: jestconfig.json
   ✅ Reading: package.json
   ✅ Reading: pnpm-lock.yaml
   ✅ Reading: src/__tests__/cli.test.ts
   ✅ Reading: src/cli.ts
   ✅ Reading: src/constants/analyze.ts
   ✅ Reading: src/constants/patterns.ts
   ✅ Reading: src/core/analyzer.ts
   ✅ Reading: src/index.ts
   ✅ Reading: src/services/codesnap.ts
   ✅ Reading: src/services/formatter.ts
   ✅ Reading: src/types/types.ts
   ✅ Reading: src/utils/file.ts
   ✅ Reading: src/utils/token-counter.ts
   ✅ Reading: tsconfig.json


📊 Analysis complete!
   Total files processed: 18
   Total size: 0.15 MB
   Total files processed: 18
   Total size: 0.15 MB

Token counts by model:
   GPT-3.5: 68.6K
   GPT-3.5: 68.6K
   GPT-4:   68.6K
   Claude:  68.6K
   LLaMA 2: 75.5K
   LLaMA 2: 75.5K

✅ Analysis completed successfully!
📊 Summary:
Project Directory: codesnap
✅ Analysis completed successfully!
📊 Summary:
Project Directory: codesnap
📊 Summary:
Project Directory: codesnap
Project Directory: codesnap
Total Files Analyzed: 18
Total Size: 0.15 MB
Total Size: 0.15 MB
Date: 2025-01-01T11:33:08.158Z

Token counts by model:
   GPT-3.5: 68.6K
   GPT-4:   68.6K
   Claude:  68.6K
   LLaMA 2: 75.5K
```

### Example Output File
[codesnap-analyzer.txt](./codesnap-analyzer.txt)

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

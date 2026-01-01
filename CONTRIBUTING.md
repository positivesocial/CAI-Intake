# Contributing to CAI Intake

Thank you for your interest in contributing to CAI Intake! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors. We expect all participants to:

- Be respectful and considerate
- Welcome newcomers and help them contribute
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Personal attacks or trolling
- Publishing others' private information
- Any conduct that could reasonably be considered inappropriate

---

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- Node.js 20+ installed
- npm or yarn package manager
- Git configured with your name and email
- Access to a PostgreSQL database (or Supabase account)
- API keys for AI providers (for full functionality)

### Types of Contributions

We welcome various types of contributions:

| Type | Description |
|------|-------------|
| 🐛 **Bug Fixes** | Fix issues and improve stability |
| ✨ **Features** | Add new functionality |
| 📚 **Documentation** | Improve docs, add examples |
| 🎨 **UI/UX** | Improve design and usability |
| ⚡ **Performance** | Optimize speed and efficiency |
| 🧪 **Tests** | Add or improve test coverage |

---

## Development Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/CAI-Intake.git
cd CAI-Intake
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp env.example .env
# Edit .env with your configuration
```

### 4. Set Up Database

```bash
npm run db:generate
npm run db:push
```

### 5. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

---

## Making Changes

### Branch Naming

Use descriptive branch names:

```
feature/add-voice-input
fix/excel-column-mapping
docs/update-api-reference
chore/update-dependencies
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add voice dictation input mode
fix: correct edge banding notation parsing
docs: update API authentication section
chore: upgrade to Next.js 16
refactor: simplify parser detection logic
test: add unit tests for material mapping
```

### Commit Message Format

```
<type>(<scope>): <short description>

<optional body>

<optional footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Example:**

```
feat(parser): add support for MaxCut PDF format

- Detect MaxCut files by header pattern
- Parse L-L-W-W edge banding notation
- Extract actual size vs cutting size

Closes #123
```

---

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Define types for all function parameters and return values
- Prefer interfaces over type aliases for object shapes

```typescript
// ✅ Good
interface ParseResult {
  parts: CutPart[];
  confidence: number;
  warnings?: string[];
}

function parseText(input: string, options: ParseOptions): ParseResult {
  // ...
}

// ❌ Bad
function parseText(input: any, options: any) {
  // ...
}
```

### React Components

- Use functional components with hooks
- Prefer named exports
- Use TypeScript for props
- Keep components focused and small

```typescript
// ✅ Good
interface PartRowProps {
  part: CutPart;
  onEdit: (id: string) => void;
  isSelected?: boolean;
}

export function PartRow({ part, onEdit, isSelected = false }: PartRowProps) {
  return (
    // ...
  );
}
```

### File Organization

```
src/
├── app/                    # Next.js App Router pages
├── components/
│   ├── ui/                 # Base UI components
│   ├── intake/             # Feature-specific components
│   └── [feature]/          # Other feature components
├── lib/
│   ├── schema/             # Zod schemas
│   ├── parsers/            # Parsing logic
│   ├── ai/                 # AI provider clients
│   └── utils/              # Utility functions
└── types/                  # TypeScript types
```

### Styling

- Use Tailwind CSS for styling
- Follow the design system (shadcn/ui)
- Use CSS variables for theming
- Ensure mobile responsiveness

```tsx
// ✅ Good
<button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
  Save
</button>

// ❌ Bad
<button style={{ padding: '8px 16px', backgroundColor: 'blue' }}>
  Save
</button>
```

---

## Testing

### Running Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

### Writing Tests

- Write tests for all new features
- Test edge cases
- Mock external dependencies (AI, database)

```typescript
import { describe, it, expect } from 'vitest';
import { parsePartText } from '@/lib/parsers/pattern-parser';

describe('parsePartText', () => {
  it('parses basic dimension format', () => {
    const result = parsePartText('720x560 qty 2');
    expect(result.length).toBe(1);
    expect(result[0].size.L).toBe(720);
    expect(result[0].size.W).toBe(560);
    expect(result[0].qty).toBe(2);
  });

  it('handles edge banding notation', () => {
    const result = parsePartText('720x560 edge 2L2W');
    expect(result[0].ops?.edging?.edges?.L1?.apply).toBe(true);
    expect(result[0].ops?.edging?.edges?.L2?.apply).toBe(true);
    expect(result[0].ops?.edging?.edges?.W1?.apply).toBe(true);
    expect(result[0].ops?.edging?.edges?.W2?.apply).toBe(true);
  });
});
```

---

## Pull Request Process

### Before Submitting

1. ✅ Code compiles without errors (`npm run build`)
2. ✅ All tests pass (`npm run test`)
3. ✅ Linting passes (`npm run lint`)
4. ✅ Documentation updated if needed
5. ✅ Commits follow conventions

### PR Template

When creating a PR, include:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring
- [ ] Other (specify)

## Testing
How was this tested?

## Screenshots (if UI changes)
Add screenshots here

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Added tests (if applicable)
- [ ] Updated documentation (if applicable)
```

### Review Process

1. Submit PR against `main` branch
2. CI checks must pass
3. At least one maintainer approval required
4. Merge after approval (squash and merge preferred)

---

## Reporting Issues

### Bug Reports

When reporting a bug, include:

```markdown
## Description
Clear description of the bug

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: [e.g., macOS 14.0]
- Browser: [e.g., Chrome 120]
- CAI Intake version: [e.g., 2.0.0]

## Screenshots/Logs
If applicable
```

### Feature Requests

```markdown
## Problem
What problem does this solve?

## Proposed Solution
How should it work?

## Alternatives Considered
What else was considered?

## Additional Context
Any other information
```

---

## Questions?

- Open a [GitHub Discussion](https://github.com/positivesocial/CAI-Intake/discussions)
- Join our [Discord](https://discord.gg/cai-intake)
- Email: dev@cai-intake.io

---

Thank you for contributing to CAI Intake! 🎉


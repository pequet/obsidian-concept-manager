# Obsidian Concept Manager

A CustomJS script for managing conceptual relationships and knowledge connections in Obsidian.

## Features

- Dynamic concept relationship mapping
- Multi-dimensional classification (domain, category, level, unit)
- Confidence-scored concept associations
- Cross-note relationship visualization
- Subject-specific filtering

## Installation

1.  Make sure you have the `CustomJS` and `Dataview` plugins installed in Obsidian.
2.  Copy the `scripts/ConceptManager.js` file into your CustomJS scripts directory. You can configure this path in the CustomJS plugin settings.
3.  Restart Obsidian to load the script.

## Usage

### Initial Test
Always verify script loading first:

```dataviewjs
const { ConceptManager } = customJS;
console.log(ConceptManager.helloWorld());
```

### Basic Usage
Get related concepts for the current note:

```dataviewjs
const { ConceptManager } = customJS;
const related = ConceptManager.getRelatedConcepts({ dv });
dv.table(["Concept", "Confidence"], related.map(r => [r.concept.file.link, `${r.confidence.toFixed(2)}%`]));
```

## Prerequisites

1.  **Metadata Requirements**:
    - All concepts must have a `type` field.
    - Recommended fields: `subject`, `domain`, `levels`, `units`.
2.  **Plugin Requirements**:
    - **CustomJS**: Mandatory for script execution.
    - **Dataview**: Required for metadata processing.


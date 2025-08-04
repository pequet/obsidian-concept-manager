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

## How Concept Manager Scoring Works

The `ConceptManager.getRelatedConcepts()` method uses a **flexible, dynamic scoring system**:

### 🎯 **New Dynamic System** (Recommended)

Specify exactly which frontmatter fields to match on using `matchCriteria`:

```dataviewjs
// Find other hub pages with same type and subject
const { ConceptManager } = customJS;
ConceptManager.getRelatedConcepts({ 
    dv, 
    matchCriteria: {
        type: true,        // Use current page's type value
        subject: true      // Use current page's subject value
    },
    debug: true 
});
```

```dataviewjs
// Find concepts with specific values
const { ConceptManager } = customJS;
ConceptManager.getRelatedConcepts({ 
    dv, 
    matchCriteria: {
        subject: "PKM LENS",  // Explicit value
        type: "hub",          // Explicit value  
        level: true,          // Use current page's level
        domain: null          // Don't match on domain
    },
    debug: true 
});
```

### 📊 **Scoring System**

1. **Frontmatter Field Matching**: **`scoreMultiplier` points per matching value** (default: 1.5 points) in any specified field
2. **Path Proximity** (optional): **2 points** for exact same folder, **1 point** for subfolders

### 🔧 **All Parameters**

```dataviewjs
const { ConceptManager } = customJS;
ConceptManager.getRelatedConcepts({ 
    dv,
    matchCriteria: {},        // Frontmatter fields to match (defaults to {subject: true, type: true, domain: true})
    includePath: true,        // true (default), false (no path scoring), "strict" (same path only)
    strictPath: false,        // Only return same-path files (default: false)
    minScore: 0.66,          // Minimum confidence 0.0-1.0 (default: 0.66 = 66%)
    maxResults: 10,          // Maximum results (default: 10)
    scoreMultiplier: 1.5,    // Points per matching frontmatter value (default: 1.5)
    debug: false             // Show detailed breakdown (default: false)
});
```

### 🔧 **Match Criteria Options**

For each frontmatter field in `matchCriteria`:
- **`true`**: Use current page's value for this field
- **`"explicit value"`**: Use this specific value  
- **`null`** or **`false`**: Ignore this field completely
- **Empty `{}`**: Defaults to `{subject: true, type: true, domain: true}`

### 📁 **Path Control Examples**

```dataviewjs
// Default: Include path scoring
const { ConceptManager } = customJS;
ConceptManager.getRelatedConcepts({ dv, includePath: true });

// Disable path completely  
ConceptManager.getRelatedConcepts({ dv, includePath: false });

// Only same-path files
ConceptManager.getRelatedConcepts({ dv, includePath: "strict" });
```

### 🐛 **Enhanced Debug Output**

With `debug: true`, you'll see:
- **All parameters used** (includePath, minScore, maxResults, scoreMultiplier, etc.)
- **What frontmatter keys are being considered**
- **What matching values are being used** (current page vs explicit)
- **Step-by-step scoring breakdown**
- **Dynamic results table** showing ALL results, then filtered results count

### 🧮 **Scoring Calculation**
- **Total possible score** = (# of criteria × scoreMultiplier) + (path points if enabled)
- **Confidence** = `(actual score / max possible) × 100`
- **Graceful degradation**: Missing frontmatter fields don't break the system

### 💡 **Quick Display Example**

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


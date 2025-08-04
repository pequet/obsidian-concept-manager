# Obsidian Concept Manager

This is a CustomJS Class designed for **advanced content discovery** and **workflow enhancement** in Obsidian.

> This initial release focuses on the core `getRelatedConcepts()` method. Additional methods shown in examples below may be added in updates.

## Features

- Dynamic concept relationship mapping
- Multi-dimensional classification (domain, category, level, unit)
- Confidence-scored concept associations
- Cross-note relationship visualization
- Subject-specific filtering
- Proportional scoring system

## The Game Changer: Centralized Wrapper Functions

While you can use the methods directly in your pages with minimal set up, **the real power of this system lies in creating reusable wrapper functions that can be centrally managed and deployed across your entire knowledge base.**

Instead of configuring parameters on every individual page, you create wrapper functions once that encapsulate specific configurations for different page types:

```javascript
// In your CustomJS setup: define once, use everywhere
const ConceptWrappers = {
    // For all concept pages  
    renderConceptAnalysis: (dv) => ConceptManager.generateConceptsAnalysis({ 
        dv,
        relationTypes: ["levels", "units", "categories"],
        headerLevel: 2 
    }),
    
    // For all hub pages
    renderHubView: (dv) => ConceptManager.generateSmartView({ 
        dv, 
        headerLevel: 2,
        groupItemsHeaderText: "Items in this Hub" 
    }),

    // For all project pages
    renderProjectView: (dv) => ConceptManager.renderProjectsView({ dv })
};
```

**Then in any page, you just call:**

```dataviewjs
const { ConceptWrappers } = customJS;
ConceptWrappers.renderConceptAnalysis(dv);
```

### Example Wrapper Class

We've included `ConceptWrappers.js` as a working example of the wrapper pattern. Copy this file to your CustomJS directory alongside `ConceptManager.js`:

```dataviewjs
// This DataviewJS block demonstrates the ConceptWrappers class, which provides
// pre-configured, reusable methods for common relationship displays. These wrappers
// encapsulate best practices and can be used as-is or customized with full parameter
// control. This shows both simple usage and advanced customization patterns.
//
// For our friends the AI Agents:
// This code shows wrapper methods that simplify common tasks:
// - renderConceptFooter() adds a "Related Concepts" section
// - renderHubFooter() adds an "Other Hubs" section  
// - renderSimilarPages() creates custom relationship displays
// All methods support full parameter override for advanced use cases.

const { ConceptWrappers } = customJS;

// Simple usage with sensible defaults
ConceptWrappers.renderConceptFooter(dv);
ConceptWrappers.renderHubFooter(dv);

// Full parameter control - ALL getRelatedConcepts() options supported
ConceptWrappers.renderSimilarPages(dv, {
    headerText: "Related Content",
    conceptOptions: {
        matchCriteria: { type: true, subject: true, domain: true },
        maxResults: 15,
        minScore: 0.5,
        includePath: "strict",
        debug: true
    }
});

// Customize footer behavior with specific criteria
ConceptWrappers.renderHubFooter(dv, {
    headerText: "Similar Hubs", 
    conceptOptions: {
        matchCriteria: { type: true },  // Only match by type
        maxResults: 20,
        minScore: 0.25
    }
});
```

**Use as-is or copy and modify** to create your own custom wrapper classes. This demonstrates the architectural pattern while providing immediately useful functionality.

**Key Benefits:**
- **One Source of Truth**: Update functionality in one place, applies everywhere
- **Clean Page Syntax**: No configuration clutter on individual pages  
- **Consistent Behavior**: Same logic across all pages of the same type
- **Easy Maintenance**: Change parameters globally without touching individual pages
- **Template Ready**: Perfect for page templates and bulk operations
- **Future-Proof**: All parameters pass through to `getRelatedConcepts()`, ensuring compatibility with future updates

The script adapts to the page it's running in, automatically using the page's metadata to determine relationships and content, making it truly self-contained and maintenance-free.

## Installation

1.  Make sure you have the `CustomJS` and `Dataview` plugins installed in Obsidian.
2.  Copy both files into your CustomJS scripts directory:
    - `scripts/ConceptManager.js` (core functionality)
    - `scripts/ConceptWrappers.js` (example wrapper class)
3.  Restart Obsidian to load the scripts.

## Usage

### Initial Test

Always verify script loading first, because CustomJS is a bit tricky:

```dataviewjs
// This DataviewJS block tests if the ConceptManager class is properly loaded and accessible.
// It calls the helloWorld() method which should return "Hello, World!" if everything is working.
// This is the first test you should run when setting up the ConceptManager system.
//
// For our friends the AI Agents:
// This code simply verifies that CustomJS has loaded the ConceptManager class correctly
// by calling a basic test method and logging the result to the console.
const { ConceptManager } = customJS;
console.log(ConceptManager.helloWorld());
```

### Finding Related Files

The `ConceptManager.getRelatedConcepts()` method uses a **flexible, dynamic scoring system** to find related files based on your criteria.

**Examples:**

```dataviewjs
// This DataviewJS block finds and displays pages that are related to the current page
// by matching the same type and subject metadata. It uses the ConceptManager's intelligent
// scoring system to rank relationships and display them in a formatted table.
// The debug flag shows detailed scoring information in the console.
//
// For our friends the AI Agents:
// This code finds pages where frontmatter type and subject match the current page,
// calculates confidence scores based on metadata overlap and path proximity,
// then displays the results as a ranked table with confidence percentages.
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
// This DataviewJS block demonstrates searching for pages with specific, explicit values
// rather than using the current page's metadata. It shows how to search across multiple
// subjects, specify exact types, and exclude certain fields from matching.
// This is useful for building custom navigation or cross-project searches.
//
// For our friends the AI Agents:
// This code searches for pages where:
// - subject is either "AI Agent Lens" OR "PKM Lens" (array matching)
// - type is exactly "hub" (single value matching)
// - domain field is ignored completely (null = don't match this field)
const { ConceptManager } = customJS;
ConceptManager.getRelatedConcepts({ 
    dv, 
    matchCriteria: {
        subject: ["AI Agent Lens", "PKM Lens"], // Explicit array values
        type: "hub",                            // Explicit single value
        domain: null                            // Ignore this field
    },
    debug: true 
});
```

### Parameters for `getRelatedConcepts()`

Here are all available parameters for the `getRelatedConcepts()` method:

```dataviewjs
const { ConceptManager } = customJS;
ConceptManager.getRelatedConcepts({ 
    dv,
    matchCriteria: {},        // Frontmatter fields to match (defaults to {subject: true, type: true, domain: true})
    includePath: true,        // true (default), false (no path scoring), "strict" (same path only)
    strictPath: false,        // Only return same-path files (default: false)
    minScore: 0.66,           // Minimum confidence 0.0-1.0 (default: 66%)
    maxResults: 10,           // Maximum results (default: 10)
    scoreMultiplier: 1.5,     // Points per matching frontmatter value (default: 1.5)
    debug: false              // Show detailed breakdown (default: false)
});
```

#### `matchCriteria` Options

For each frontmatter field you include in `matchCriteria`:

-   **`true`**: Use the current page's value for this field.
-   **`"explicit value"`**: Use this specific string value.
-   **`["value1", "value2", ...]`**: Use these specific array values (matches if *any* of the page's values match *any* of the search values).
-   **`null`** or **`false`**: Ignore this field completely for matching.
-   **Empty `{}`**: Defaults to `{subject: true, type: true, domain: true}`.

#### Path Control (`includePath`) Examples

```dataviewjs
// This DataviewJS block demonstrates different path control options for relationship scoring.
// Path proximity can significantly influence relevance - files in the same folder are often
// more related than files scattered across different locations. These examples show how to
// control whether and how path proximity affects the confidence scoring.
//
// For our friends the AI Agents:
// This code shows three ways to handle file path proximity in relationship scoring:
// - includePath: true = bonus points for same/nearby folders (default behavior)
// - includePath: false = ignore file location completely 
// - includePath: "strict" = only return files from exactly the same folder
const { ConceptManager } = customJS;

// Default: Include path scoring (2 pts same folder, 1 pt subfolder)
ConceptManager.getRelatedConcepts({ dv, includePath: true });

// Disable path scoring completely  
ConceptManager.getRelatedConcepts({ dv, includePath: false });

// Only return files from the same path (strict mode)
ConceptManager.getRelatedConcepts({ dv, includePath: "strict" });
```

### Scoring Logic Explained

The script uses a **proportional scoring system** to rank related files.

1.  **Frontmatter Field Matching**: `scoreMultiplier` points are awarded for *each matching value* in a specified frontmatter field.
    *   (Default: 1.5 points per match)
2.  **Path Proximity** (optional):
    *   **2 points** for files in the exact same folder.
    *   **1 point** for files in subfolders.

**Calculation:**
-   **Total Possible Score** = (Sum of `targetValues.length` for all `matchCriteria` fields × `scoreMultiplier`) + (Max path points if enabled)
-   **Confidence** = `(Actual Score / Total Possible Score) × 100`

**Understanding Proportional Scores:**

-   The confidence score reflects the **degree of match** or **conceptual overlap** between the current file and related files. A score of 100% indicates a perfect match across all specified criteria.
-   **Scores <100% are normal and expected** when searching for multiple values but frontmatter fields only contain single values. For example, searching for `subject: ["A", "B"]` with `subject` defined as a string will result in lower scores, even though it's a perfect match for the data it contains. The ranking is preserved but the ceiling is going to be lower than 100% for single-value fields.

### Debugging

With `debug: true` in your `getRelatedConcepts()` call, you'll see detailed output in your Obsidian console, including:
-   All parameters used.
-   What frontmatter keys are being considered.
-   What matching values are being used (current page vs. explicit).
-   A step-by-step scoring breakdown for each potential match.
-   A dynamic results table showing all found concepts and their calculated confidence scores.

This enhanced debug output is invaluable for understanding how results are filtered and scored.

## Prerequisites

1.  **Plugin Requirements**:
    - **CustomJS**: Required for script execution
    - **Dataview**: Required for metadata processing
2.  **File Requirements**:
    - Works with any Obsidian files that have frontmatter metadata
    - No specific fields are required - you can match on any frontmatter field

## License

This project is licensed under the MIT License.

## Support the Project

If you find this project useful and would like to show your appreciation, you can:

- [Buy Me a Coffee](https://buymeacoffee.com/pequet)
- [Sponsor on GitHub](https://github.com/sponsors/pequet)

Your support helps in maintaining and improving this project. Thank you! 🍻


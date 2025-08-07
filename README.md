# Obsidian Concept Manager

This is a CustomJS Class designed for **advanced content discovery** and **workflow enhancement** in Obsidian.

> This initial release focuses on the core `getRelatedConcepts()` method. Additional methods shown in examples below may be added in updates.

## Features

- Dynamic concept relationship mapping
- Bidirectional relationship discovery (finds both similar concepts and others that reference the current concept)
- Multi-dimensional classification (domain, category, level, unit)
- Confidence-scored concept associations
- Cross-note relationship visualization
- Subject-specific filtering
- Dual-weighted proportional scoring system (regular vs. reverse relationships)
- **NEW**: Distance-based path scoring that rewards structural organization proximity

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
    matchCriteria: {},             // Frontmatter fields to match (defaults to {subject: true, type: true, domain: true})
    includePath: true,             // true (default), false (no path scoring), "strict" (same path only)
    strictPath: false,             // Only return same-path files (default: false)
    minScore: 0.66,                // Minimum confidence 0.0-1.0 (default: 66%)
    minResults: 5,                 // Minimum results to return (default: 5)
    strictMinResults: true,       // Apply min results limit strictly (default: true)
    maxResults: 10,                // Maximum results (default: 10)
    strictMaxResults: false,       // Apply max results limit strictly (default: false)
    scoreMultiplier: 1.5,          // Points per matching frontmatter value (default: 1.5)
    reverseScoreMultiplier: 2.5,   // Points per reverse relationship (default: 2.5)
    pathDistanceMultiplier: 2.0,   // Base points for path distance scoring (default: 2.0)
    maxPathDistance: 5,           // Maximum filesystem distance to consider (default: 5)
    debug: false                   // Show detailed breakdown (default: false)
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

// Default: Include distance-based path scoring (proximity rewards)
ConceptManager.getRelatedConcepts({ dv, includePath: true });

// Disable path scoring completely  
ConceptManager.getRelatedConcepts({ dv, includePath: false });

// Only return files from the same path (strict mode)
ConceptManager.getRelatedConcepts({ dv, includePath: "strict" });

// Custom distance-based scoring (higher multiplier, shorter max distance)
ConceptManager.getRelatedConcepts({ 
    dv, 
    pathDistanceMultiplier: 3.0,  // More points for proximity
    maxPathDistance: 5            // Only consider files within 5 jumps
});
```

### Scoring Logic Explained

The script uses a **proportional scoring system** to rank related files.

1.  **Frontmatter Field Matching**: `scoreMultiplier` points are awarded for *each matching value* in a specified frontmatter field.
    *   (Default: 1.5 points per match)
2.  **Reverse Relationship Lookup**: `reverseScoreMultiplier` points are awarded when other pages reference the current page in their `group-*` fields.
    *   For example: If Maya Deren has `domain-category: film-director`, the system will find pages with `group-film-director: "Maya Deren"`
    *   (Default: 2.0 points per reverse relationship - higher than regular matches to reflect stronger creative bonds)
3.  **Path Distance Scoring** (NEW - optional):
    *   **Distance-based scoring** that rewards structural organization proximity
    *   **Formula**: 0 jumps = `pathDistanceMultiplier` points; 1+ jumps = `pathDistanceMultiplier / (1 + distance)` points
    *   **Examples** (with default `pathDistanceMultiplier: 2.0`):
        - 0 jumps (same folder): **2.0 points** (Maya.md ↔ Divine.md)
        - 2 jumps (sibling folders): **0.67 points** (People/Maya.md ↔ Movies/Pink.md) 
        - 5 jumps (distant cousins): **0.33 points** (People/Maya.md ↔ Cinematic Theory/Movements/Avant-Garde.md)
    *   **Replaces** old binary system (0/1/2 points) with **smooth proximity gradient**
    *   **Performance**: Limited to `maxPathDistance` jumps (default: 10) and valid subjects only

**Calculation:**
-   **Total Possible Score** = (Sum of `targetValues.length` for all `matchCriteria` fields × `scoreMultiplier`) + (Potential reverse relationships × `reverseScoreMultiplier`) + (Max path points if enabled)
-   **Confidence** = `(Actual Score / Total Possible Score) × 100`

**Understanding Proportional Scores:**

-   The confidence score reflects the **degree of match** or **conceptual overlap** between the current file and related files. A score of 100% indicates a perfect match across all specified criteria.
-   **Scores <100% are normal and expected** when searching for multiple values but frontmatter fields only contain single values. For example, searching for `subject: ["A", "B"]` with `subject` defined as a string will result in lower scores, even though it's a perfect match for the data it contains. The ranking is preserved but the ceiling is going to be lower than 100% for single-value fields.

**Tuning Relationship Strength:**

The system recognizes that different types of relationships have different strengths:

-   **`scoreMultiplier`** (default: 1.5): For contextual similarity (e.g., two directors, two actors)
-   **`reverseScoreMultiplier`** (default: 2.0): For direct creative relationships (e.g., director → their film)

You can adjust these values to fine-tune how the system weighs different relationship types:

```dataviewjs
const { ConceptManager } = customJS;
ConceptManager.getRelatedConcepts({ 
    dv,
    scoreMultiplier: 1.0,          // Lower weight for similarity
    reverseScoreMultiplier: 3.0,   // Higher weight for direct relationships
    debug: true 
});
```

### Minimum Results Feature

The `minResults` and `strictMinResults` parameters provide adaptive scoring to ensure you get meaningful results even when your criteria are too restrictive:

```dataviewjs
const { ConceptManager } = customJS;
ConceptManager.getRelatedConcepts({
    dv,
    minScore: 0.85,            // Start with high confidence requirement
    minResults: 5,             // But ensure at least 5 results
    strictMinResults: true,    // Allow adaptive scoring
    debug: true                // Show the adaptation process
});
```

With `strictMinResults: true`, the system will lower the `minScore` threshold until `minResults` is reached.

### Maximum Results Feature

The `maxResults` and `strictMaxResults` parameters provide flexibility in the number of results returned.

```dataviewjs
const { ConceptManager } = customJS;
ConceptManager.getRelatedConcepts({
    dv,
    maxResults: 10,
    strictMaxResults: true,
    debug: true
});
```

With `strictMaxResults: false`, the system will keep the results past the `maxResults` limit, if they have the same confidence score.

### Debugging

With `debug: true` in your `getRelatedConcepts()` call, you'll see detailed output in your Obsidian console, including:
-   All parameters used.
-   What frontmatter keys are being considered.
-   What matching values are being used (current page vs. explicit).
-   A step-by-step scoring breakdown for each potential match.
-   A dynamic results table showing all found concepts and their calculated confidence scores.

This enhanced debug output is invaluable for understanding how results are filtered and scored.

## 📍 Distance-Based Path Scoring

The distance-based path scoring system leverages **Structural Organization** - the principle that filesystem placement reflects conceptual relationships in your knowledge base. When files are organized into meaningful domain-specific folders, their physical proximity often indicates stronger conceptual connections.

### Structural Organization Integration

Path distance scoring recognizes that your folder structure represents semantic clustering:
- **Same folder**: Files addressing the same domain or concept area
- **Sibling folders**: Related but distinct domains  
- **Distant paths**: Conceptually distant or cross-domain relationships

This aligns with the framework's **Structural Organization** principle, where "folder hierarchy reflects knowledge taxonomy" and "path structure indicates conceptual relationships."

### Distance Calculation

The system measures filesystem navigation steps between files, rewarding structural proximity:

```
Maya Deren ─→ Divine
Distance: 0 hops 

 People            # Same folder
 ├─ Maya Deren.md  # Starting point
 └─ Divine.md      # Ending point

Maya Deren ─→ Pink Flamingos
Distance: 2 hops

 Production                    # Common ancestor
 │  └─ [1↑] People/            # [1↑] First level up
 │          └─ Maya Deren.md   # Starting point
 └─ [1↓] Movies/               # [1↓] First level down
         └─ Pink Flamingos.md  # Ending point

Maya Deren ─→ American Avant-Garde
Distance: 4 hops

 2. Knowledge                                # Common ancestor
 │  └─ [2↑] Production/                      # [2↑] Second level up
 │          └─ [1↑] People/                  # [1↑] First level up
 │                  └─ Maya Deren.md         # Starting point
 └─ [1↓] Cinematic Theory/                   # [1↓] First level down
         └─ [2↓] Movements/                  # [2↓] Second level down
                 └─ American Avant-Garde.md  # Ending point
```

### Scoring Formula

**Distance = 0**: `pathDistanceMultiplier` points (full reward)  
**Distance > 0**: `pathDistanceMultiplier / (1 + distance)` points (decaying reward)

**Default Examples** (`pathDistanceMultiplier: 2.0`):
- 0 jumps: **2.00 points** (100% - same folder)
- 1 jump: **1.00 points** (50% - parent/child)  
- 2 jumps: **0.67 points** (33% - siblings)
- 5 jumps: **0.33 points** (17% - distant cousins)

### Performance & Scope Control

**Smart Limitations:**
- Only considers files with **valid subjects** (from config)
- Respects **`maxPathDistance`** threshold (default: 10 jumps)
- **No vault-wide scanning** 

**⚡ Performance Benefits:**
- Prevents unnecessary distance calculations for irrelevant files
- Maintains sub-second response times even in large vaults
- Focuses on conceptually related content only

### Migration from Old System

The old `getFilesInSamePath()` method is deprecated but preserved for backward compatibility. All new implementations automatically use the distance-based approach when you call `getRelatedConcepts()`.

**No breaking changes** - existing code continues to work with improved scoring!

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


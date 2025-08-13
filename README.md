# Obsidian Concept Manager

This is a CustomJS Class designed for **advanced content discovery** and **workflow enhancement** in Obsidian.

## Features

 - Dynamic concept relationship mapping
 - Contextual Activation (scope-aware) lights up only context‑relevant regions for discovery and traversal. See: [Contextual Activation](docs/100-Contextual-Activation.md).
 - Bidirectional relationship discovery (forward and reverse references)
 - Multi-dimensional classification (domain, category, level, unit...)
 - Confidence-calibrated concept associations
 - Proportional weighting for direct and reverse relationships
 - Proximity-weighted path scoring (rewards filesystem adjacency as a proxy for structural organization)

## Optional Hub Frontmatter (relation labels and names)

Hubs can define three optional, cosmetic frontmatter fields used for display labels and naming. They do not affect matching logic; they only control wording in UI output.

- name-canonical: Preferred plural or human-facing name for the hub’s category. Falls back to the Hub file name if omitted.
- relation-incoming: Label used when showing relationships pointing to this category (e.g., "Directed by").
- relation-outgoing: Label used when showing relationships from this category (e.g., "Directed").

Resolution order in code:
- Display names come from name-canonical when present; otherwise the Hub file name.
- Relation labels are fetched from the matching Hub for the same subject and domain-category; if missing, we fall back to the display name.

Examples (from sample project):

```yaml
---
type: hub
domain: concepts
subject: Sample Project
domain-category: director
name-canonical: Directors
relation-incoming: Directed by
relation-outgoing: Directed
---
```

```yaml
---
type: hub
domain: concepts
subject: Sample Project
domain-category: actor
name-canonical: Actors
relation-incoming: Actors
relation-outgoing: Acted in
---
```

## The Game Changer: Smarter Wrapper (Zero‑Config)

While you can 'raw‑dog' it by calling the raw `ConceptManager` API directly, the simplest way, and only one you should need, is to use the new `renderSmarterView` wrapper everywhere. It supersedes older helper wrappers and removes the need for per‑page tuning. Paste one line at the bottom of any Hub or Concept page and it will adapt, stream each section as it’s ready, and only update when content meaningfully changes (no flicker, even with Dataview auto‑refresh).

```dataviewjs
// Copy both scripts to your CustomJS directory, then use:
const { ConceptWrappers } = customJS;
// Zero‑config, stable, section‑by‑section view
ConceptWrappers.renderSmarterView(dv);

// Optional overrides
// ConceptWrappers.renderSmarterView(dv, {
//   headerLevel: 2,
//   sections: ['contentClassifications', 'keyConnections', 'relatedContent', 'relatedHubs'],
//   prioritySections: [],                                              // Build these first (visual order unchanged)
//   concurrency: 2,                                                    // Single‑threaded interleaving at yield points
//   observeQuietMs: 200,                                               // Commit after DOM stays quiet this long (think: tables rendering, etc)
//   observeMaxWaitMs: 3000,                                            // Hard cap to commit
//   collapseEmptySections: true,
//   debug: false
// });
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

## Contextual Activation: Neural Graph, Scoped

Contextual Activation makes the vault behave like a neural graph: selecting a context “lights up” the relevant subset of notes and edges while other areas remain inactive for discovery. Discovery and scoring operate strictly within this activated subset. Learn more: [docs/010-Contextual-Activation.md](docs/100-Contextual-Activation.md).

## Installation

1.  Make sure you have the `CustomJS` and `Dataview` plugins installed in Obsidian.
2.  Copy both files into your CustomJS scripts directory:
    - `scripts/ConceptManager.js` (core functionality)
    - `scripts/ConceptWrappers.js` (example wrapper class)
3.  Restart Obsidian to load the scripts.

## Usage (simple → deeper)

### 0. Initial test (recommended)

```dataviewjs
const { ConceptManager } = customJS;
console.log(ConceptManager.helloWorld());
```

### 1. Wrapper Quick Start (recommended)

Use the Smarter Wrapper. One line on any page does the right thing by default.

```dataviewjs
const { ConceptWrappers } = customJS;
ConceptWrappers.renderSmarterView(dv);
```

### Supersedes earlier helpers

The Smarter Wrapper replaces and renders obsolete the previous helper methods. Replace any usage of the old helpers with the new single call below.

Before:

```dataviewjs
// ConceptWrappers.renderSmartView(dv)
// ConceptWrappers.renderLightSmartView(dv)
// ConceptWrappers.renderGroupSmartView(dv)
```

After:

```dataviewjs
ConceptWrappers.renderSmarterView(dv)
```

### 2. Direct Smart View (no wrapper)

```dataviewjs
const { ConceptManager } = customJS;
ConceptManager.generateSmartView({ dv, enabledSteps: ['contentClassifications','keyConnections','relatedContent','relatedHubs'] });
```

### Concurrency and Priority (How it behaves)

- Single-threaded reality: Obsidian JS runs on one main thread. Concurrency>1 does not run CPU in parallel: it allows interleaving when work yields (rendering/microtasks). Purely synchronous work still runs sequentially.
- Concretely, this means that start time beats duration: even with concurrency>1, the section that starts earlier will block the other sections that, even shorter, will appear later.
- Priority scheduling: Use `prioritySections` to start certain sections earlier.

### 3. Deep API: getRelatedConcepts (full control)

```dataviewjs
const { ConceptManager } = customJS;
ConceptManager.getRelatedConcepts({ 
    dv,
    matchCriteria: {},            // Frontmatter fields to match (defaults to {subject: true, type: true, domain: true})
    includePath: true,            // true (default), false (no path scoring), "strict" (same path only)
    strictPath: false,            // Only return same-path files (default: false)
    minScore: 0.5,                // Minimum confidence 0.0-1.0 (default: 50%)
    minResults: 5,                // Minimum results to return (default: 5)
    strictMinResults: true,       // Apply min results limit strictly (default: true)
    maxResults: 10,               // Maximum results (default: 10)
    strictMaxResults: false,      // Apply max results limit strictly (default: false)
    scoreMultiplier: 1.5,         // Points per matching frontmatter value (default: 1.5)
    reverseScoreMultiplier: 3.0,  // Points per reverse relationship (default: 3.0)
    forwardScoreMultiplier: 3.0,  // Points per forward relationship from current page (default: 3.0)
    pathDistanceMultiplier: 2.0,  // Base points for path distance scoring (default: 2.0)
    maxPathDistance: 5,           // Maximum filesystem distance to consider (default: 5)
    debug: false                  // Show detailed breakdown (default: false)
});
```

#### `matchCriteria` Options

For each frontmatter field you include in `matchCriteria`:

-   **`true`**: Use the current page's value for this field.
-   **`"explicit value"`**: Use this specific string value.
-   **`["value1", "value2", ...]`**: Use these specific array values (matches if *any* of the page's values match *any* of the search values).
-   **`null`** or **`false`**: Ignore this field completely for matching.
-   **Empty `{}`**: Defaults to `{subject: true, type: true, domain: true}`.

#### Path Control (`includePath`) Options

- `true`: default proximity scoring
- `false`: ignore path proximity
- `"strict"`: same-folder only
- `pathDistanceMultiplier`: stronger reward for closer files (e.g., 3.0 > 2.0)
- `maxPathDistance`: max directory hops across folder structure considered

#### Results Control (minScore, minResults, maxResults)

- **minScore**: Minimum confidence threshold (0.0–1.0). Results below this are excluded.
- **minResults + strictMinResults**:
  - If `strictMinResults: true` (default) and fewer than `minResults` would be returned at the current `minScore`, the threshold is automatically lowered (not below 0.10) to include at least `minResults` when possible.
  - If `strictMinResults: false`, the `minScore` is not adjusted; you may get fewer than `minResults`.
- **maxResults + strictMaxResults**:
  - If `strictMaxResults: true`, the list is hard-capped at `maxResults`.
  - If `strictMaxResults: false` (default), ties are included: results with the same confidence as the last included item are also returned, so the total may exceed `maxResults`.

### Scoring Logic (short)

- Functional (frontmatter): award `scoreMultiplier` per matching value (configurable)
- Reverse (group-* backrefs): award `reverseScoreMultiplier` when other pages list the current page (configurable)
- Forward (from current page): award `forwardScoreMultiplier` when the current page lists other pages (configurable)
- Structural (path proximity): 0 hops = full `pathDistanceMultiplier`; more hops earn `pathDistanceMultiplier/(1+distance)`

The Confidence Score is a proportional score out of the total possible.

## 📍 Distance-Based Path Scoring

The distance-based path scoring system leverages **Structural Organization** - the principle that filesystem placement reflects conceptual relationships in your knowledge base. When files are organized into meaningful domain-specific folders, their physical proximity often indicates stronger conceptual connections.

### Structural Organization Integration

Path distance scoring recognizes that your folder structure represents semantic clustering:
- **Same folder**: Files addressing the same domain or concept area
- **Sibling folders**: Related but distinct domains  
- **Distant paths**: Conceptually distant or cross-domain relationships

This aligns with the framework's **Structural Organization** principle, where "folder hierarchy reflects knowledge taxonomy" and "path structure indicates conceptual relationships."

### Distance Calculation

Structural proximity is a first‑class signal in this system. It captures directory‑tree proximity (how many directory steps separate two notes) and stands orthogonal to Functional relationships.

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

### Performance & Scope Control

**Smart Limitations:**
- Only considers files with **valid subjects** and **valid domains** (from config)
- Respects **`maxPathDistance`** threshold (default: 5 hops)
- **No vault-wide scanning** 

**⚡ Performance Benefits:**
- Prevents unnecessary distance calculations for irrelevant files
- Maintains sub-second response times even in large vaults
- Focuses on conceptually related content only

## Prerequisites

1.  **Plugin Requirements**:
    - **CustomJS**: Required for script execution
    - **Dataview**: Required for metadata processing
2.  **File Requirements**:
    - Minimal shared frontmatter vocabulary is required:
      - `subject`: namespace for context activation and config lookup
      - `domain`: content area classification (e.g., concepts, methods, patterns)
      - `type`: use `hub` for Hub pages; omit or use other values for Group pages
      - `domain-category`: links Group pages to their Hub(s) (string or array)
    - Per-subject config page:
      - A note with `type: config` and matching `subject` defines `valid_subjects`, `valid_domains`, and `valid_filters` used for scope and performance
    - Flexible beyond the basics: once the shared vocabulary is present, you can match on any additional frontmatter fields and extend groups/categories via config
    - Reference implementation: a [Sample Project](https://github.com/pequet/project-sample) repository (coming soon) will showcase the expected frontmatter and config layout

## The Concept Manager Ecosystem

- **[Subject Index Cache](https://github.com/pequet/obsidian-subject-index-cache)** - Lightning-fast caching layer
- **[Concept Manager](https://github.com/pequet/obsidian-concept-manager)** - Core relationship discovery engine (this project)
- **[Sample Project](https://github.com/pequet/project-sample)** - Turn-key implementation and examples
 
## License

This project is licensed under the MIT License.

## Support the Project

If you find this project useful and would like to show your appreciation, you can:

- [Buy Me a Coffee](https://buymeacoffee.com/pequet)
- [Sponsor on GitHub](https://github.com/sponsors/pequet)

Your support helps in maintaining and improving this project. Thank you! 🍻


---
type: guide
domain: methods
subject: Concept Manager
status: active
tags: notes-active
summary: "Comprehensive frontmatter specification for the Obsidian Concept Manager plugin and its integration patterns."
---

# Concept Manager Frontmatter Specification

The Obsidian Concept Manager plugin implements a minimal, opinionated frontmatter system that enables powerful automated content organization, relationship discovery, and dynamic view generation. This specification defines the metadata patterns that unlock the plugin's full capabilities while maintaining flexibility for diverse knowledge domains.

## Core Philosophy

The Concept Manager's frontmatter approach is built on three foundational principles:

1. **Semantic Relationships Over File Hierarchy**: Content connections are defined by meaning and metadata, not folder structures
2. **Minimal Schema, Maximum Power**: A small set of standardized fields enables complex automated behaviors and relationship discovery
3. **Domain-Agnostic Architecture**: The system adapts to any knowledge domain (cinema, research, business, etc.) without requiring schema changes

## Required Fields

Every file using Concept Manager functionality must include these essential fields:

### `subject: [project-namespace]`
- **Purpose**: Establishes project or domain namespace for content isolation and context activation
- **Usage**: Enables the plugin to distinguish between different knowledge domains or projects
- **Benefits**: Prevents content bleeding between unrelated domains, enables multi-project workflows
- **Examples**: 
  - `subject: Sample Project` (cinema knowledge base)
  - `subject: Research Notes` (academic work)
  - `subject: Business Strategy` (organizational knowledge)

### `type: [functional-classification]`
- **Purpose**: Defines the functional role and behavior of the page within the knowledge system
- **Usage**: Determines how the plugin processes, displays, and links content
- **Standard values**:
  - `overview` - Standard content pages with concepts, entities, or detailed information (90% of files)
  - `hub` - Navigation centers that aggregate and organize related content
  - `config` - System configuration files that define domain-specific parameters
  - `guide` - Step-by-step instructions and procedural documentation
  - `log` - Chronological records and development histories
- **Example**: `type: overview`

### `domain: [content-classification]`
- **Purpose**: Categories content by its fundamental nature and role in the knowledge system
- **Usage**: Enables cross-cutting queries, relationship discovery, and intelligent content filtering
- **Standard values**:
  - `concepts` - Individual entities, ideas, people, works, or knowledge elements
  - `methods` - Processes, procedures, workflows, and operational content
  - `patterns` - Recurring solutions, templates, and structural frameworks
- **Example**: `domain: concepts`

### `status: [lifecycle-stage]`
- **Purpose**: Tracks content maturity, maintenance needs, and reliability
- **Usage**: Helps filter content based on completeness and enables quality-based views
- **Standard values**:
  - `draft` - Initial creation phase, content may be incomplete
  - `active` - Currently maintained and actively developed
  - `finalized` - Complete, stable, and reliable content
  - `archived` - No longer actively maintained but preserved for reference
- **Example**: `status: active`

### `tags: [note-status]`
- **Purpose**: Indicates the working status of the note (exclusively for note lifecycle, NOT semantic content)
- **Critical restriction**: ONLY for note status, never for content categorization
- **Valid values** (only these three are permitted):
  - `notes-active` - Currently being worked on (use for 99% of files)
  - `notes-references` - Verbatim sources requiring no modification
  - `notes-research` - Requires investigation, verification, or additional research
- **Example**: `tags: notes-active`

## Power Fields (Optional)

These fields unlock the Concept Manager's advanced relationship and organizational capabilities:

### `domain-category: [grouping-classification]`
- **Purpose**: Enables hub functionality and content aggregation for organizational pages
- **Usage**: Applied ONLY to pages that function as groups, hubs, or organizational centers
- **Benefits**: Allows the plugin to identify grouping pages and generate appropriate aggregation views
- **Domain-specific examples**:
  - Cinema: `film`, `cinema-theme`, `cinematic-movement`, `film-director`
  - Research: `methodology`, `data-source`, `research-field`, `publication-type`
  - Business: `department`, `strategy-area`, `stakeholder-type`, `process-category`

### `group-*: [relationship-links]`
- **Purpose**: Creates semantic links between related content, enabling automated relationship discovery
- **Pattern**: Field name format is `group-[category]`, value matches related content identifiers
- **Benefits**: Enables bidirectional relationship discovery, automated cross-referencing, and intelligent content suggestions
- **Relationship examples**:
  ```yaml
  # Cinema domain
  group-cinema-theme: ["Crime", "Dreams"]
  group-film-director: "Maya Deren"
  group-release-year: 1943
  group-cinematic-movement: "American Avant-Garde"
  
  # Research domain
  group-methodology: "Qualitative Analysis"
  group-research-field: ["Psychology", "Cognitive Science"]
  group-data-source: "Survey 2024"
  
  # Business domain
  group-department: "Product Development"
  group-stakeholder-type: ["Customers", "Investors"]
  group-strategy-area: "Market Expansion"
  ```

### `name-canonical: [preferred-display-name]`
- **Purpose**: Provides preferred display name when filename differs from desired presentation
- **Usage**: Particularly useful for hubs, technical files, or content with descriptive filenames
- **Example**: `name-canonical: "French New Wave Movement"`

### `relation-incoming/outgoing: [semantic-relationship-labels]`
- **Purpose**: Defines the semantic nature of relationships for enhanced discovery and understanding
- **Usage**: Clarifies relationship meaning beyond simple connections
- **Examples**:
  ```yaml
  relation-incoming: "influenced by"
  relation-outgoing: "influences"
  
  relation-incoming: "contains"
  relation-outgoing: "part of"
  
  relation-incoming: "builds on"
  relation-outgoing: "foundation for"
  ```

### `summary: [concise-description]`
- **Purpose**: Provides brief, clear description for automated displays, navigation, and discovery
- **Usage**: Appears in relationship tables, hub listings, and search results
- **Best practice**: One clear, informative sentence describing the content's essence and purpose
- **Examples**:
  - `summary: "Experimental film exploring dreams and psychological states"`
  - `summary: "Qualitative research methodology for analyzing user behavior"`
  - `summary: "Strategic framework for product market expansion"`

## Frontmatter Examples by Use Case

### Standard Concept Page
```yaml
---
type: overview
domain: concepts
group-research-field: "User Experience"
group-methodology: ["Qualitative", "Quantitative"]
group-stakeholder-type: "Design Team"
status: active
tags: notes-active
subject: UX Research Project
summary: "Comprehensive analysis of user interaction patterns"
---
```

### Hub/Aggregation Page
```yaml
---
type: hub
domain: concepts
domain-category: methodology
subject: UX Research Project
status: active
tags: notes-active
name-canonical: "Research Methodologies Hub"
summary: "Central navigation for all research methodologies and approaches"
---
```

### Configuration Page
```yaml
---
type: config
domain: methods
subject: UX Research Project
status: active
tags: notes-active
summary: "Configuration settings for UX research knowledge base"
valid_subjects: ["UX Research Project"]
valid_domains: ["concepts", "methods", "patterns"]
valid_categories: ["methodology", "stakeholder-type", "research-field"]
---
```

### Pattern/Template Page
```yaml
---
type: overview
domain: patterns
group-methodology: "Design Thinking"
group-process-stage: ["Discovery", "Definition"]
status: finalized
tags: notes-active
subject: Design Framework
summary: "Reusable pattern for conducting user research interviews"
relation-outgoing: "guides"
relation-incoming: "supported by"
---
```

## Plugin Integration Patterns

The Concept Manager's automated components rely on this frontmatter structure:

### Smart View Generation
- Uses `domain` and `domain-category` to determine appropriate display modes
- Automatically renders relationship tables, content lists, and hub navigation
- Adapts behavior based on page classification and metadata richness

### Relationship Discovery Engine
- Leverages `group-*` fields for bidirectional connection mapping
- Discovers both explicit relationships (shared group values) and reverse relationships (pages referencing current page)
- Enables intelligent content suggestions and automated cross-referencing

### Hub Organization System
- Utilizes `domain-category` for content aggregation and filtering
- Generates dynamic navigation based on relationship patterns
- Creates adaptive organizational structures that evolve with content

### Context Activation
- Relies on `subject` field for project-specific content isolation
- Enables multi-domain workflows without content bleeding
- Supports contextual switching between different knowledge domains

## Best Practices and Guidelines

### Essential Practices
1. **Maintain Consistency**: Use exact field names and standardized values across all content
2. **Start with Requirements**: Always include all required fields before adding optional ones
3. **Think Relationally**: Consider how each piece of content connects to others when assigning `group-*` values
4. **Semantic Precision**: Use `tags` field exclusively for note status, never for content categorization
5. **Meaningful Summaries**: Write summaries that help both humans and automated systems understand content purpose

### Advanced Techniques
6. **Relationship Planning**: Map out relationship categories before creating content to ensure consistency
7. **Hub Strategy**: Designate clear organizational hubs using `domain-category` to create navigation structure
8. **Validation Setup**: Use configuration files to define valid values and maintain domain integrity
9. **Evolution Mindset**: Design frontmatter that can grow with your knowledge domain without breaking existing content

### Domain Adaptation
10. **Category Customization**: Adapt `domain-category` and `group-*` patterns to your specific knowledge domain
11. **Relationship Semantics**: Use `relation-incoming/outgoing` to capture domain-specific relationship meanings
12. **Subject Namespacing**: Use clear, consistent `subject` values to enable multi-project workflows

## Validation and Quality Control

### Configuration-Based Validation
- Define `valid_subjects`, `valid_domains`, and `valid_categories` in configuration files
- Use these lists to ensure consistency and prevent metadata drift
- Regularly audit content against validation standards

### Quality Indicators
- **Complete Frontmatter**: All required fields present and properly formatted
- **Semantic Relationships**: Meaningful `group-*` connections that enhance discovery
- **Clear Summaries**: Informative descriptions that aid navigation and understanding
- **Consistent Categorization**: Proper use of `domain-category` for organizational content

## Migration and Adoption

### Starting Fresh
1. Begin with required fields only
2. Add `summary` field for immediate navigation benefits
3. Gradually introduce `group-*` relationships as patterns emerge
4. Implement hubs with `domain-category` once content volume justifies organization

### Existing Content Migration
1. Audit current frontmatter patterns and identify mapping opportunities
2. Standardize `subject` values to enable context isolation
3. Convert categorical tags to `group-*` relationships
4. Establish hub pages with `domain-category` for major content areas
5. Validate migrated content against plugin requirements

This frontmatter specification transforms static notes into an intelligent, interconnected knowledge system that grows more valuable with every addition.

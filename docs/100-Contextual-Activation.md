---
type: guide
domain: methods
subject: Concept Manager
status: active
tags: [notes-active]
summary: A scope-aware mechanism that lights up relevant subsets of the vault like a neural graph, enabling focused discovery and faster queries.
---

# Contextual Activation

**Core idea**: In a large vault with multiple Subjects (Core, Projects, Analytical Lenses), configuration at different levels declares which Subjects/Domains are valid for the active context. When a context is selected, those sets become "activated," lighting up relevant regions for discovery and relationship traversal.

**Effect**: Activated regions behave like a neural graph—subsets of notes and edges become live for analysis; other areas remain ignored by discovery tools. Connections are allowed to flow to these active areas.

**Mechanism**: Config files define `valid_subjects` and `valid_domains` for a scope (global, Project, Analytical Lens). Tools (like the `ConceptManager` class) restrict processing to those validated sets.

**Why it matters**: Enables focused, context-aware knowledge exploration without polluting results with irrelevant areas ; promotes multi-project coexistence and reusable foundational layers across contexts.

**The purpose**: Explicitly and purposefully curate which knowledge bases can connect. We turn on connections to preset arrays of knowledge bases that we want to be interrelated. We turn off the ones we don't want to dilute the context because they are not relevant or we are not seeking active, explicit connections to be made with the rest of the map. The neural graph metaphor: connections flow between activated nodes while inactive areas remain isolated.

## Naming candidates

- Contextual Activation
- Scoped Activation
- Context‑Gated Discovery
- Activation Mask (Context Mask)
- Lens‑Scoped Activation
- Selective Topology Activation
- Contextual Gating (Gated Context)

## Next

- Document how `valid_subjects` and `valid_domains` are defined/merged across scope levels.
- Illustrate activation overlays (graph heatmap metaphor) and how switching contexts changes active regions.
- Clarify precedence and defaults when a context omits explicit lists.



---
type: guide
domain: methods
subject: Concept Manager
status: active
tags: notes-active
summary: "Explains the dual-context 'distraction-free' workflow for this boilerplate."
---

# The Dual-Context Development Workflow

This boilerplate allows for a powerful, dual-context workflow designed for focus and efficiency.

## Distraction-Free Development

The primary ergonomic benefit of this structure is the ability to achieve a **"distraction-free" development mode**. While this repository lives inside a larger framework, you should do a significant amount of your work by opening **this folder directly** in your IDE.

This provides several key advantages:

-   **Reduced Cognitive Load:** You can focus entirely on the public-facing code without the mental overhead of the entire parent project and its context.
-   **Optimized Tooling Performance:** AI assistants, file searches, indexing, and linters operate on a much smaller, more relevant context window. 
-   **Enforced Modularity:** Think about the public repository as a self-contained unit, improving its design and reusability.
-   **Simplified Collaboration:** When collaborating with others who don't need access to the private parent framework, you can share just this repository without issue.

## Seamless Context Switching

The workflow is designed for seamless switching between the two contexts, allowing for **System-Level Management** a literal keystroke away:

-   Manage the `private/` assets, process the project's `Inbox` items, review Archived materials, and update the project's knowledge base and methods.
- Access the parent framework and its knowledge base and methods from this wider view.
- Commit changes to both the submodule (this repo) and the parent repository from this wider view.

## The `private/` Directory

As explained in the [Framework Context Document](docs/000-Framework-Context.md), this folder contains private assets that are versioned within the parent framework.

This powerful pattern allows us to:

-   Keep development artifacts (like session history) tied to the project.
-   Preserve them in the private parent repository's version history.
-   Prevent them from ever being committed to the public repository's history.

By embracing this dual-context workflow, you gain the focus of working on a small, dedicated project with the power and organizational rigor of a much larger, integrated framework. 

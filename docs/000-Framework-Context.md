---
type: guide
domain: methods
subject: Concept Manager
status: active
tags: notes-active
summary: "Explains this repository's context within the parent framework."
---

> [!NOTE]
> This document originates from a boilerplate template which may have evolved since this project was created. The latest version can be found in the [cursor-project-boilerplate repository](https://github.com/pequet/cursor-project-boilerplate/blob/main/docs/000-Framework-Context.md).

# Framework Context

This public repository, while fully functional on its own, is designed to serve as a **submodule** within a larger, homegrown and highly opinionated private framework for integrated thinking. The current document is thus a "convex mirror" looking out from the repository into the framework that gives it context.

For a standalone user, this information is optional. For the developer concerned with the system-level context, it is crucial, embodying the design principle: "when in doubt, zoom out."

## A Progressively Unfolding Structure

The parent framework's architecture is best understood by progressively unfolding its layers, from the highest level down to the specific location of this repository.

### Level 1: The `Core` and `Projects`

At the highest level, the entire system is divided into two main parts:

```text
Root/
├── Core/         # The stable, shared foundation
└── Projects/     # Modular "plugins" that extend the Core
```

-   **`Core`:** Contains the stable, foundational elements of the system.
-   **`Projects`:** A collection of modular "plugins" that extend the `Core`. This public repository is part of a Project called `Obsidian`.

### Level 2: The `MVC` Pattern in `Core`

The `Core` is organized using the Model-View-Controller (MVC) architectural pattern:

```text
Core/
├── Controllers/  # Logic connecting Models and Views
├── Models/       # Data and business logic
└── Views/        # User interfaces and public-facing elements
```

-   **`Models`:** Holds the data, logic, and state.
-   **`Views`:** Contains all user-facing interfaces. This is where public repositories like the one you're in now reside.
-   **`Controllers`:** The operational logic that connects `Models` and `Views`.

### Level 3: Inside `Views` 

Putting it all together, this public repository (`obsidian-concept-manager/`) is located within the `Views` directory, under `Public Repositories`.

The path from the root is as follows:

```text
Core/
└── Views/
    └── Public Repositories/
        └── Obsidian/
            └── Concept Manager/               # Grouping
                ├── obsidian-concept-manager/  # This Public Repo
                └── private/                   # Assets tracked by the parent framework
```

### Level 4: Split Repository Pattern

This path reveals a **Public-Private Pattern** at the `Concept Manager` level, which separates the public-facing code (the submodule) from its private development assets (`private/`). These private assets, typically including `.cursor/`, `.specstory/`, `inbox/`, `memory-bank/` (and confidential files) are thus allowed to be informed and tracked by the parent framework, not the public submodule.

```text
Concept Manager/                                  # Grouping
├── obsidian-concept-manager/                     # This Public Repo (contains symlinks to the private assets)
│   ├── .cursor -> ../private/.cursor/
│   ├── .specstory -> ../private/.specstory/
│   ├── inbox -> ../private/inbox/
│   ├── memory-bank -> ../private/memory-bank/
│   ├── archives/
│   ├── docs/
│   ├── scripts/
│   └── src/
└── private/                                      # Assets tracked by the parent framework
    ├── .cursor/
    ├── .specstory/
    ├── inbox/
    └── memory-bank/
```

This organization allows for a clean public repository while maintaining a rich, private context for development, and the ability to switch between the two contexts seamlessly.

## Development Principles

This layered structure enables a powerful and organized development workflow guided by three key principles:

-   **Inbox-Driven Development:** All new ideas, notes, tasks, and raw information related to this project are first captured in the parent `Models/0. Inbox/` and then moved to the public repository `obsidian-concept-manager/inbox/`. This keeps the public repository clean while ensuring no idea is lost.
-   **Archival Over Deletion:** Following a "never delete" principle, files are moved to the `obsidian-concept-manager/archives/` or back to the parent `Models/4. Archives/` instead of being deleted. This preserves a complete history of the project's evolution.
-   **Private Asset Management:** The sibling `private/` directory stores development artifacts (`.cursor/`, `.specstory/`, `inbox/`, `memory-bank/`) that are essential for development and should be versioned in the private parent repository, but are not part of the public-facing submodule. 

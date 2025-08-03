# Concept Manager

This repository is a boilerplate for creating new projects in the Cursor IDE, with an emphasis on AI-assisted development. It provides a structured foundation that leverages AI tools and a "memory bank" system to ensure development continuity and efficiency.

## Reasoning

This boilerplate is built on the idea that AI can be a powerful partner in the development process. The structure and tools included are designed to:
- Provide long-term memory and context to the AI.
- Automate repetitive tasks.
- Enforce best practices through AI-readable rules.
- Evolve with the projects.

## Context

While you can use this boilerplate as-is, its unique structure does not exist in vacuum and full potential are best understood by reviewing two core context documents.

![Self Portrait by M.C. Escher](assets/57a95e87272bed1cbe000aa19566db81.jpg)

This is us with two core context documents:

-   **[Framework Context](docs/000-Framework-Context.md):** Explains the parent framework's architecture.
-   **[Development Workflow](docs/010-Development-Workflow.md):** Explains the "distraction-free" development process and seamless context switching.

## Self-Evolving Foundation

This boilerplate is designed as a living foundation for your projects, intended to evolve in two primary ways:

*   **Through Tools:** It adapts as its underlying AI tools and the development ecosystem evolve, incorporating new features and best practices.
*   **Through Use:** As you work on projects, you will identify patterns, scripts, and AI rules unique to your tech stack, workflow and style. These should be "graduated" back into your boilerplate, making it a more powerful, personalized foundation for future work.

## Getting Started

To get started with this boilerplate, follow the steps in the **[New Project Checklist](NEW_PROJECT_CHECKLIST.md)**. This checklist will guide you through the process of customizing the boilerplate for your own project.

### Requirements

This boilerplate is heavily optimized for an AI-assisted development workflow. 

*   **[Cursor IDE](https://cursor.com):** The primary development environment this boilerplate is designed for, but it could be adapted for other IDEs such as Windsurf or Copilot.
*   **[vibe-tools](https://github.com/eastlondoner/vibe-tools):** (fka `cursor-tools`) It's referenced in `.cursor/rules/vibe-tools.mdc` and is crucial for many automated tasks. It must be globally installed (`npm install -g vibe-tools`) with API keys configured in `~/.vibe-tools/.env`.
*   **[SpecStory Extension](https://github.com/specstoryai/getspecstory):** This extension for Cursor/VSCode helps with long-term memory. It automatically saves AI interactions, which populates the `.specstory/` directory and helps generate `derived-cursor-rules.mdc`, allowing the AI to learn from past interactions. Review the history periodically for insights on the learning process that should become rulesets.
*   **Memory Bank:** The project's core long-term memory system resides in the `memory-bank/` directory, providing persistent context to the AI to ensure continuity across sessions. This system is governed by rule `210-memory-bank.mdc` and is an adaptation of a community-driven pattern for AI memory. Within this system, the [`project-journey.md`](memory-bank/project-journey.md) file acts as a `motivation engine`, helping to mark progress against clear goalposts and ensure the project is always moving forward in a positive direction.
*   **Boilerplate Preservation**: To prevent accidental deletion of key configuration files and context, this boilerplate is governed by rule `300-boilerplate-initialization-protocol.mdc`. This rule instructs the AI to preserve all boilerplate files unless explicitly told otherwise.

### Integration with the Core Framework

If you are using this boilerplate within our larger framework, the recommended first step is to add your new project as a Git submodule. This creates the correct directory structure and links your private development environment.

For the complete procedure, see the guide: **[[Core/Controllers/Methods/Guides/Git/How to Correctly Add a Git Submodule.md]]**

### How to Use This Boilerplate

This is a template repository. **Do not work in it directly.** Follow these two manual steps to start a new project:

> **Warning**
> This boilerplate contains critical configuration files such as `vibe-tools.config.json` and `repomix.config.json`, and context in directories like `.cursor/`, `.specstory/`, and `memory-bank/`. **Do not delete or overwrite these files** when starting a new project, as they are essential for the AI's performance and continuity.

**Step 1: Copy and Paste Boilerplate Files**

1.  In your file explorer, navigate to this directory.
2.  Select and copy all files and folders.
3.  Paste them into your new project's directory.

**Step 2: Search and Replace**

1.  Open the new project folder in your IDE.
2.  Use the global search-and-replace feature to update the placeholder names.
3.  Follow the `NEW_PROJECT_CHECKLIST.md` to complete the setup.

## Script Usage Example

This boilerplate includes an example script `scripts/run_main_script.sh`. You should modify or replace this with scripts relevant to your own project. It demonstrates argument parsing and provides a template for your own executables.

### Basic Usage

Get the current time in UTC (the default):
```bash
./scripts/run_main_script.sh
```

### Advanced Usage

Get the current time in multiple specific timezones:
```bash
./scripts/run_main_script.sh "America/New_York" "Europe/London" "Asia/Tokyo"
```

Use the integrated AI to ask a question:
```bash
./scripts/run_main_script.sh -q "How many humans live on earth?"
```

## Advanced Usage: Private Context

For private or proprietary projects, you may want to keep your `.cursor`, `memory-bank`, and other context directories in a separate, private repository. You can do this by using symbolic links.

1.  Move the context directories to your private repository.
2.  Create symbolic links from this project's root to the directories in your private repository.

Example:
```bash
# Assuming your private repo is in a parallel directory called "private-context"
# Move the directories
mv .cursor ../private-context/
mv memory-bank ../private-context/

# Create symbolic links
ln -s ../private-context/.cursor .
ln -s ../private-context/memory-bank .
```
This allows you to maintain your project-specific context privately while still using the public boilerplate structure.

## License

This project is licensed under the MIT License.

## Support the Project

If you find this project useful and would like to show your appreciation, you can:

- [Buy Me a Coffee](https://buymeacoffee.com/pequet)
- [Sponsor on GitHub](https://github.com/sponsors/pequet)
- [Deploy on DigitalOcean](https://www.digitalocean.com/?refcode=51594d5c5604) (affiliate link $) 

Your support helps in maintaining and improving this project. 


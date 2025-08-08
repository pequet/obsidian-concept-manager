/*
 *  ███   Obsidian Concept Manager Wrappers (CustomJS)
 * █ ███  Version: 1.0.0
 * █ ███  Author: Benjamin Pequet
 *  ███   GitHub: https://github.com/pequet/obsidian-concept-manager/
 *
 * Purpose:
 *   Example wrapper class demonstrating how to create reusable, centrally managed
 *   functions that encapsulate specific ConceptManager configurations for different
 *   page types. Copy and modify this class to create your own custom wrappers.
 *
 * Prerequisites:
 *   - ConceptManager.js must be loaded first
 *   - DataView plugin
 *   - CustomJS plugin
 *
 * Usage:
 *   ```dataviewjs
 *   const { ConceptWrappers } = customJS;
 *   
 *   // Default full view (zero-config)
 *   ConceptWrappers.renderSmartView(dv);
 *   
 *   // Optional overrides (keep it simple)
 *   // ConceptWrappers.renderSmartView(dv, { headerLevel: 3, debug: true });
 *   
 *   // Convenience variants
 *   // ConceptWrappers.renderLightSmartView(dv);        // concept analysis only
 *   // ConceptWrappers.renderGroupSmartView(dv);        // items + relationships only
 *   // ConceptWrappers.renderLightSmartView(dv, { headerLevel: 3 });
 *   // ConceptWrappers.renderGroupSmartView(dv, { debug: true });
 *   ```
 *
 * Changelog:
 *   1.0.0 - 2025-08-04 - Initial release with basic wrapper examples.
 *
 * Support the Project:
 *   - Buy Me a Coffee: https://buymeacoffee.com/pequet
 *   - GitHub Sponsors: https://github.com/sponsors/pequet
 */

// --- Constants & Global Variables ---
// (None required)

// --- Class Definition ---
class ConceptWrappers {
    constructor() {
        console.log("ConceptWrappers class loaded and ready 📦");
        
        // Initialize any properties here
        this.debug = false;
        // No defaults required; wrapper is zero-config
    }

    // --- Public Methods ---
    
    /**
     * Single-entry, zero-config wrapper for Smart View.
     * Adapts automatically to the current page.
     * @param {Object} dv - Dataview API
     */
    renderSmartView(dv, { headerLevel = 2, debug = false } = {}) {
        const { ConceptManager } = customJS;
        // Opinionated presets (centralized) with simple overrides
        ConceptManager.generateSmartView({
            dv,
            headerLevel,
            enabledSteps: ['conceptAnalysis', 'groupItems', 'viewTable'],
            debug
        });
    }

    /**
     * Convenience: Light view (concept analysis only)
     */
    renderLightSmartView(dv, { headerLevel = 2, debug = false } = {}) {
        const { ConceptManager } = customJS;
        ConceptManager.generateSmartView({
            dv,
            headerLevel,
            enabledSteps: ['conceptAnalysis'],
            debug
        });
    }

    /**
     * Convenience: Group-focused (items + relationships)
     */
    renderGroupSmartView(dv, { headerLevel = 2, debug = false } = {}) {
        const { ConceptManager } = customJS;
        ConceptManager.generateSmartView({
            dv,
            headerLevel,
            enabledSteps: ['groupItems', 'viewTable'],
            debug
        });
    }

}

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
 *   // This DataviewJS block demonstrates the ConceptWrappers class usage patterns.
 *   // These wrapper methods provide pre-configured relationship displays that can be
 *   // used with sensible defaults or fully customized with any getRelatedConcepts() parameters.
 *   //
 *   // For our friends the AI Agents:
 *   // This code shows how to use wrapper methods that encapsulate common relationship
 *   // display patterns, supporting both simple calls and full parameter customization.
 *   const { ConceptWrappers } = customJS;
 *   
 *   // Smart View Presets (NEW!)
 *   ConceptWrappers.renderFullSmartView(dv);      // All features: concept analysis + group views
 *   ConceptWrappers.renderLightSmartView(dv);     // Concept analysis only
 *   ConceptWrappers.renderGroupSmartView(dv);     // Group-focused: items + relationships
 *   
 *   // Traditional relationship displays
 *   ConceptWrappers.renderConceptFooter(dv);      // Similar concepts
 *   ConceptWrappers.renderHubFooter(dv);          // Related hubs
 *   
 *   // Full parameter control (ALL options supported)
 *   ConceptWrappers.renderFullSmartView(dv, {
 *       headerLevel: 3, 
 *       debug: true,
 *       groupItemsHeaderText: "Custom Header"
 *   });
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
const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_HEADER_LEVEL = 3;

// --- Class Definition ---
class ConceptWrappers {
    constructor() {
        console.log("ConceptWrappers class loaded and ready 📦");
        
        // Initialize any properties here
        this.debug = false;
        this.defaultMaxResults = DEFAULT_MAX_RESULTS;
        this.defaultHeaderLevel = DEFAULT_HEADER_LEVEL;
    }

    // --- Public Methods ---
    
    /**
     * Renders a flexible "Similar Pages" section for any page type
     * 
     * FUTURE-PROOF DESIGN: All conceptOptions are passed directly to getRelatedConcepts(),
     * ensuring compatibility with future parameter additions without code changes.
     * 
     * @param {Object} dv - DataView API object
     * @param {Object} [options={}] - Display and concept search options
     * @param {string} [options.headerText="Similar Pages"] - Custom header text
     * @param {number} [options.headerLevel=3] - Header level (1-6) 
     * @param {Object} [options.conceptOptions={}] - All options passed directly to getRelatedConcepts()
     *   - Supports ALL current and future getRelatedConcepts() parameters
     *   - Examples: matchCriteria, maxResults, minScore, includePath, strictPath, debug, etc.
     */
    renderSimilarPages(dv, { 
        headerText = "Similar Pages", 
        headerLevel = DEFAULT_HEADER_LEVEL,
        conceptOptions = {}
    } = {}) {
        const { ConceptManager } = customJS;
        
        // FUTURE-PROOF: Pass ALL conceptOptions directly to getRelatedConcepts
        // This ensures any new parameters added to getRelatedConcepts will work automatically
        const defaultConceptOptions = {
            dv,
            matchCriteria: { type: true, subject: true },
            maxResults: DEFAULT_MAX_RESULTS,
            debug: false
        };
        
        // Merge defaults with user-provided options, allowing full override
        const finalOptions = { ...defaultConceptOptions, ...conceptOptions, dv };
        const related = ConceptManager.getRelatedConcepts(finalOptions);

        if (headerLevel > 0) {
            dv.header(headerLevel, headerText);
        }

        if (related.length === 0) {
            dv.paragraph("*No similar pages found.*");
            return;
        }

        dv.table(
            ["Page", "Confidence", "Match"],
            related.map(r => [
                r.concept.file.link,
                `${(r.confidence).toFixed(2)}%`,
                r.inSamePath ? "Same path" : "Cross-reference"
            ])
        );
    }

    /**
     * Renders a standard footer for concept pages
     * 
     * FUTURE-PROOF DESIGN: All options are passed through to renderSimilarPages and 
     * ultimately to getRelatedConcepts(), ensuring full parameter control and 
     * compatibility with future updates.
     * 
     * @param {Object} dv - DataView API object
     * @param {Object} [options={}] - All rendering and concept search options
     * @param {string} [options.headerText="Related Concepts"] - Custom header text
     * @param {number} [options.headerLevel=3] - Header level (1-6)
     * @param {Object} [options.conceptOptions={}] - Passed directly to getRelatedConcepts()
     *   - Full control over: matchCriteria, maxResults, minScore, includePath, strictPath, debug, etc.
     */
    renderConceptFooter(dv, options = {}) {
        const defaultOptions = {
            headerText: "Related Content",
            headerLevel: DEFAULT_HEADER_LEVEL,
            conceptOptions: {
                matchCriteria: { type: true, subject: true },
                maxResults: 10,
                minScore: 0.6
            }
        };
        
        // Merge user options with defaults, allowing full override
        const finalOptions = {
            ...defaultOptions,
            ...options,
            conceptOptions: { ...defaultOptions.conceptOptions, ...options.conceptOptions }
        };
        
        dv.paragraph("---");
        this.renderSimilarPages(dv, finalOptions);
    }

    /**
     * Renders a standard footer for hub pages
     * 
     * FUTURE-PROOF DESIGN: All options are passed through to renderSimilarPages and 
     * ultimately to getRelatedConcepts(), ensuring full parameter control and 
     * compatibility with future updates.
     * 
     * @param {Object} dv - DataView API object
     * @param {Object} [options={}] - All rendering and concept search options
     * @param {string} [options.headerText="Other Hubs"] - Custom header text
     * @param {number} [options.headerLevel=3] - Header level (1-6)
     * @param {Object} [options.conceptOptions={}] - Passed directly to getRelatedConcepts()
     *   - Full control over: matchCriteria, maxResults, minScore, includePath, strictPath, debug, etc.
     */
    renderHubFooter(dv, options = {}) {
        const defaultOptions = {
            headerText: "Related Content",
            headerLevel: DEFAULT_HEADER_LEVEL,
            conceptOptions: {
                matchCriteria: { 
                    type: true, 
                    subject: true,
                    domain: true
                },
                maxResults: 10,
                minScore: 0.6
            }
        };
        
        // Merge user options with defaults, allowing full override
        const finalOptions = {
            ...defaultOptions,
            ...options,
            conceptOptions: { ...defaultOptions.conceptOptions, ...options.conceptOptions }
        };
        
        dv.paragraph("---");
        this.renderSimilarPages(dv, finalOptions);
    }

    /**
     * Renders the full smart view with all available features enabled
     * 
     * Executes all 3 steps of the SmartView generator:
     * 1. Concept Analysis - Shows concept relationships and groups
     * 2. Group Items List - Shows items belonging to this group
     * 3. View Table - Shows group relationships and hubs
     * 
     * @param {Object} dv - DataView API object
     * @param {Object} [options={}] - All smart view options
     * @param {number} [options.headerLevel=2] - Header level (1-6)
     * @param {string} [options.groupItemsHeaderText] - Custom header for group items
     * @param {boolean} [options.debug=false] - Enable debug output
     */
    renderFullSmartView(dv, options = {}) {
        const { ConceptManager } = customJS;
        
        const defaultOptions = {
            dv,
            headerLevel: 2,
            enabledSteps: ['conceptAnalysis', 'groupItems', 'viewTable'],
            debug: false
        };
        
        const finalOptions = { ...defaultOptions, ...options, dv };
        
        ConceptManager.generateSmartView(finalOptions);
    }

    /**
     * Renders a lightweight smart view focused on concept analysis only
     * 
     * Executes only step 1 of the SmartView generator:
     * 1. Concept Analysis - Shows concept relationships and groups
     * 
     * Perfect for pages where you only want to show concept relationships
     * without the additional group-related views.
     * 
     * @param {Object} dv - DataView API object
     * @param {Object} [options={}] - All smart view options
     * @param {number} [options.headerLevel=2] - Header level (1-6)
     * @param {boolean} [options.debug=false] - Enable debug output
     */
    renderLightSmartView(dv, options = {}) {
        const { ConceptManager } = customJS;
        
        const defaultOptions = {
            dv,
            headerLevel: 2,
            enabledSteps: ['conceptAnalysis'],
            debug: false
        };
        
        const finalOptions = { ...defaultOptions, ...options, dv };
        
        ConceptManager.generateSmartView(finalOptions);
    }

    /**
     * Renders a group-focused smart view for pages with domain-category
     * 
     * Executes steps 2 and 3 of the SmartView generator:
     * 2. Group Items List - Shows items belonging to this group
     * 3. View Table - Shows group relationships and hubs
     * 
     * Perfect for group/category pages where you want to focus on
     * group membership and relationships without concept analysis.
     * 
     * @param {Object} dv - DataView API object
     * @param {Object} [options={}] - All smart view options
     * @param {number} [options.headerLevel=2] - Header level (1-6)
     * @param {string} [options.groupItemsHeaderText] - Custom header for group items
     * @param {boolean} [options.debug=false] - Enable debug output
     */
    renderGroupSmartView(dv, options = {}) {
        const { ConceptManager } = customJS;
        
        const defaultOptions = {
            dv,
            headerLevel: 2,
            enabledSteps: ['groupItems', 'viewTable'],
            debug: false
        };
        
        const finalOptions = { ...defaultOptions, ...options, dv };
        
        ConceptManager.generateSmartView(finalOptions);
    }

}

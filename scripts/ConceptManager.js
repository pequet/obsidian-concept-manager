/*
 *  ███   Obsidian Concept Manager
 * █ ███  Version: 1.0.0
 * █ ███  Author: Benjamin Pequet
 *  ███   GitHub: https://github.com/pequet/obsidian-concept-manager/
 *
 * Purpose:
 *   A CustomJS script for managing conceptual relationships and knowledge 
 *   connections in Obsidian.
 *
 * Prerequisites:
 *   - DataView plugin
 *   - CustomJS plugin
 *
 * Usage:
 *   - Initial Test
 *   ```dataviewjs
 *   const { ConceptManager } = customJS;
 *   ConceptManager.helloWorld();
 *   ```
 * 
 *   - Dynamic System (Recommended)
 *   ```dataviewjs
 *   const { ConceptManager } = customJS;
 *   ConceptManager.getRelatedConcepts({ 
 *     dv, 
 *     matchCriteria: {
 *       [any frontmatter field]: true       // Use current page's value for this field
 *       [any frontmatter field]: "value"    // Use explicit value for this field
 *       [any frontmatter field]: null       // Ignore this field
 *       [any frontmatter field]: false      // Ignore this field
 *       [any frontmatter field]: ["value1", "value2", ...]    // Use explicit values for this field
 *     },
 *     debug: true 
 *   });
 *   ```
 * 
 *   - Smart View Generator (Recommended)
 *     Runs an adaptive view that analyzes the page and renders:
 *       1) Concept Analysis, 2) Group Items List, 3) View Table
 *     (Steps 2–3 run when the page has suitable frontmatter. Control steps via `enabledSteps`.)
 *   ```dataviewjs
 *   const { ConceptManager } = customJS;
 *   ConceptManager.generateSmartView({ 
 *     dv,
 *     headerLevel: 2,
 *     enabledSteps: ['conceptAnalysis', 'groupItems', 'viewTable'],
 *     debug: false
 *   });
 * 
 *   // Lightweight mode (concept analysis only)
 *   // ConceptManager.generateSmartView({ dv, enabledSteps: ['conceptAnalysis'] });
 * 
 *   // Group-focused mode (items + relationships only)
 *   // ConceptManager.generateSmartView({ dv, enabledSteps: ['groupItems', 'viewTable'] });
 *   ```
 * 
 *   - Wrapper-Based (Optional)
 *     Prefer a simple call with sensible defaults? Use `ConceptWrappers.js`:
 *   ```dataviewjs
 *   const { ConceptWrappers } = customJS;
 *   // Default full view
 *   ConceptWrappers.renderSmartView(dv);
 *   // Light / Group variants (optional)
 *   // ConceptWrappers.renderLightSmartView(dv);  // concept analysis only
 *   // ConceptWrappers.renderGroupSmartView(dv);  // items + relationships
 *   // Minimal overrides when needed
 *   // ConceptWrappers.renderSmartView(dv, { headerLevel: 3, debug: true });
 *   ```
 * 
 * Performance Debugging & Optimization:
  *   - What’s implemented (safe by default):
  *     • Performance timers and counters (disabled by default)
  *       - Methods: enablePerfLogging({ enabled, logToConsole }), disablePerfLogging(), resetPerfStats(),
  *         getPerfSummary(), printPerfSummaryToDv({ dv })
  *     • Subject/Domain early filtering inside dv.pages().where(...) to minimize candidate sets
  *       - Applied in: getRelatedFilesByDistance, generateViewTable (hub + regular),
  *         generateGroupItemsList, renderKeyConnectionsForConcept
  *     • Config memoization per subject for getConfigForSubject
  *       - Methods: enableConfigMemoization({ enabled, ttlMs }), invalidateConfigCache(subject?)
  *     • Sets usage policy: use Sets only for subject/domain gating (built once per query call);
  *       avoid per-row Sets (value matches still use arrays)
  * 
  *   - How to use (example):
  *   ```dataviewjs
  *   const { ConceptManager } = customJS;
  *   ConceptManager.resetPerfStats()
  *     .enablePerfLogging({ enabled: true, logToConsole: true })
  *     .enableConfigMemoization({ enabled: true, ttlMs: 0 });
  *   
  *   ConceptManager.generateSmartView({ dv, headerLevel: 2, debug: false });
  *   ConceptManager.printPerfSummaryToDv({ dv });
  *   ```
  * 
  *   - Not implemented (by design):
  *     • Sub-vault caching of page subsets (risk of staleness). Could be added later with TTL and manual invalidation
  *     • Per-row Set conversions (these were slower in practice)
  * 
  *   - Tips to further reduce work if needed:
  *     • Disable path scoring: includePath: false (in getRelatedConcepts)
  *     • Lower maxPathDistance (in getRelatedConcepts)
  *     • Limit enabledSteps in generateSmartView (e.g., ['conceptAnalysis'] only)
  *     • Narrow scans by path using Dataview query paths if your vault adheres to folder conventions
  * 
 * Support the Project:
 *   - Buy Me a Coffee: https://buymeacoffee.com/pequet
 *   - GitHub Sponsors: https://github.com/sponsors/pequet
 */

class ConceptManager {
    constructor() {
        console.log("ConceptManager class loaded and ready 💡");
        
        // Cache maps to store previously retrieved concepts and relations
        this.conceptCache = new Map();
        this.relationsCache = new Map();
        
        // Initialize any properties here
        this.debug = false;

        // Performance logging controls
        this.perf = { enabled: false, logToConsole: true };

        // Aggregated perf totals and call counters (reset per render/session as desired)
        this._perfTotals = new Map(); // label -> { count, totalMs }
        this._callCounts = {};        // functionName -> count

        // Config memoization
        this._configCache = new Map(); // subject -> { value, cachedAt }
        this._configCacheOptions = { enabled: true, ttlMs: 0 }; // ttlMs = 0 means no TTL
    }

    // --- Performance Logging Controls ---
    enablePerfLogging({ enabled = true, logToConsole = true } = {}) {
        this.perf = this.perf || {};
        this.perf.enabled = !!enabled;
        this.perf.logToConsole = !!logToConsole;
        return this;
    }

    disablePerfLogging() {
        if (!this.perf) this.perf = {};
        this.perf.enabled = false;
        return this;
    }

    _perfStart(label) {
        if (!this.perf || !this.perf.enabled) return null;
        const startedAtMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        return { label, startedAtMs };
    }

    _perfEnd(token, details = {}) {
        if (!this.perf || !this.perf.enabled || !token) return;
        const endedAtMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const durationMs = endedAtMs - token.startedAtMs;
        // Aggregate totals
        const agg = this._perfTotals.get(token.label) || { count: 0, totalMs: 0 };
        agg.count += 1;
        agg.totalMs += durationMs;
        this._perfTotals.set(token.label, agg);
        if (this.perf.logToConsole && typeof console !== 'undefined') {
            const payload = { durationMs: Math.round(durationMs), ...details };
            if (console.debug) {
                console.debug('[ConceptManager][perf]', token.label, payload);
            } else if (console.log) {
                console.log('[ConceptManager][perf]', token.label, payload);
            }
        }
    }

    printPerfSummaryToDv({ dv }) {
        if (!dv) return;
        const summary = this.getPerfSummary();
        dv.header(3, 'Performance Summary');
        const calls = Object.entries(summary.callCounts).map(([fn, count]) => `${fn}: ${count}`);
        if (calls.length > 0) {
            dv.paragraph('Function Calls:');
            dv.list(calls);
        } else {
            dv.paragraph('Function Calls: none recorded');
        }
        const totals = Object.entries(summary.totals).map(([label, v]) => `${label}: count=${v.count}, totalMs=${v.totalMs}`);
        if (totals.length > 0) {
            dv.paragraph('Timers:');
            dv.list(totals);
        } else {
            dv.paragraph('Timers: none recorded');
        }
    }

    resetPerfStats() {
        this._perfTotals = new Map();
        this._callCounts = {};
        return this;
    }

    getPerfSummary() {
        // Convert Map to plain object for easier logging/reading
        const totals = {};
        for (const [label, v] of this._perfTotals.entries()) {
            totals[label] = { count: v.count, totalMs: Math.round(v.totalMs) };
        }
        return { totals, callCounts: { ...this._callCounts } };
    }

    enableConfigMemoization({ enabled = true, ttlMs = 0 } = {}) {
        this._configCacheOptions.enabled = !!enabled;
        this._configCacheOptions.ttlMs = Number(ttlMs) >= 0 ? Number(ttlMs) : 0;
        return this;
    }

    invalidateConfigCache(subject = null) {
        if (subject) {
            this._configCache.delete(subject);
        } else {
            this._configCache.clear();
        }
        return this;
    }

    _incrementCallCount(functionName) {
        this._callCounts[functionName] = (this._callCounts[functionName] || 0) + 1;
    }

    /*
     * Use this as a test to ensure the class is working and the methods are exposed
     * 
     * @returns {string} "Hello, World!"
     */
    helloWorld() {
        return "Hello, World!";
    }

    /**
     * Core method that finds pages based on matching frontmatter fields
     * @param relationType - The frontmatter field to match (e.g., domain, level, unit)
     * @param relationValue - The value(s) to match in that field
     * @param relationSubject - Optional subject filter
     * @param allowedDomains - Array of domains to search in (defaults to current page's domain)
     */
    getConceptsByRelationType({ dv, relationType, relationValue, relationSubject = null, allowedDomains = null }) {
        const searchValues = Array.isArray(relationValue) ? relationValue : [relationValue];
        console.log(`Searching ${relationType} for values:`, searchValues);

        return dv.pages()
            .where(p => {
                // Filter by allowed domains (configurable now)
                if (allowedDomains && !allowedDomains.includes(p.domain)) return false;
                if (relationSubject && p.subject !== relationSubject) return false;
                
                // Handle both single values and arrays in frontmatter
                const pageValues = Array.isArray(p[relationType]) ? p[relationType] : [p[relationType]];
                console.log(`${p.file.name} has ${relationType}:`, pageValues);

                // Check for any matching values
                const matches = searchValues.filter(v => pageValues.includes(v));
                if (matches.length > 0) {
                    console.log(`${p.file.name} matches with:`, matches);
                    return true;
                }
                return false;
            });
    }

    /**
     * Calculates the filesystem distance (number of directory jumps) between two file paths.
     * This measures how many directory navigation steps are needed to get from one file to another.
     * 
     * Distance calculation:
     * - 0 jumps: Files in the same directory (Maya.md, Divine.md)
     * - 2 jumps: Files in sibling directories (People/Maya.md → Movies/Pink.md = ../Movies/)
     * - 5 jumps: Files across different branches (People/Maya.md → Cinematic Theory/Movements/Avant-Garde.md = ../../../Cinematic Theory/Movements/)
     * 
     * @param {string} path1 - First file path 
     * @param {string} path2 - Second file path
     * @returns {number} Number of directory jumps needed to navigate from path1's directory to path2's directory
     * 
     * @example
     * // Same folder: 0 jumps
     * calculatePathDistance("Projects/Sample/People/Maya.md", "Projects/Sample/People/Divine.md") // Returns 0
     * 
     * // Sibling folders: 2 jumps (../Movies/)
     * calculatePathDistance("Projects/Sample/People/Maya.md", "Projects/Sample/Movies/Pink.md") // Returns 2
     * 
     * // Distant cousins: 5 jumps (../../../Cinematic Theory/Movements/)
     * calculatePathDistance("Projects/Sample/People/Maya.md", "Projects/Sample/Cinematic Theory/Movements/Avant-Garde.md") // Returns 5
     */
    calculatePathDistance(path1, path2) {
        // Handle same file case
        if (path1 === path2) return 0;
        
        // Get directory paths (remove filenames)
        const dir1Parts = path1.split('/').slice(0, -1);
        const dir2Parts = path2.split('/').slice(0, -1);
        
        // Handle same directory case
        if (dir1Parts.join('/') === dir2Parts.join('/')) return 0;
        
        // Find common ancestor directory
        let commonLength = 0;
        const minLength = Math.min(dir1Parts.length, dir2Parts.length);
        
        for (let i = 0; i < minLength; i++) {
            if (dir1Parts[i] === dir2Parts[i]) {
                commonLength = i + 1;
            } else {
                break;
            }
        }
        
        // Calculate steps: up from dir1 to common ancestor + down from common ancestor to dir2
        const stepsUp = dir1Parts.length - commonLength;
        const stepsDown = dir2Parts.length - commonLength;
        
        return stepsUp + stepsDown;
    }

    /**
     * Gets files and their filesystem distances from the current file, replacing the old binary same-path approach.
     * Uses distance-based scoring that rewards structural organization proximity.
     * 
     * @param {Object} params - Parameters object
     * @param {Object} params.dv - Dataview API object  
     * @param {string} params.currentPath - Full path to the current file
     * @param {Array} params.validSubjects - Array of valid subjects to limit scope (prevents vault-wide scanning)
     * @param {Array} params.validDomains - Array of valid domains to limit scope (prevents irrelevant domain matches)
     * @param {number} [params.maxDistance=10] - Maximum distance to consider (performance optimization)
     * @returns {Array} Array of {file, distance} objects sorted by distance
     */
    getRelatedFilesByDistance({ dv, currentPath, validSubjects = [], validDomains = [], maxDistance = 10 }) {
        const __perfMethod = this._perfStart('getRelatedFilesByDistance');
        const relatedFiles = [];
        
        // Early-filter candidates by subject/domain inside the query
        const validSubjectsSet = new Set(validSubjects || []);
        const validDomainsSet = new Set(validDomains || []);
        const __qStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const candidateFiles = dv.pages().where(p => {
            if (p.file.path === currentPath) return false;
            if (validSubjectsSet.size > 0 && !validSubjectsSet.has(p.subject)) return false;
            if (validDomainsSet.size > 0 && !validDomainsSet.has(p.domain)) return false;
            return true;
        }).array();
        const __qDuration = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - __qStart;
        
        // For backward-compatible logging variables
        const allFiles = candidateFiles;
        const subjectFilteredFiles = candidateFiles;

        // Perf log for the query and filtering scope
        this._perfEnd(__perfMethod && { label: 'getRelatedFilesByDistance.query', startedAtMs: __qStart }, {
            allFiles: allFiles.length,
            subjectFiltered: subjectFilteredFiles.length,
            candidateFiles: candidateFiles.length,
            maxDistance,
            validSubjects: validSubjects.length,
            validDomains: validDomains.length
        });
        
        candidateFiles.forEach(file => {
            const distance = this.calculatePathDistance(currentPath, file.file.path);
            
            // Only include files within the maximum distance threshold
            if (distance <= maxDistance) {
                relatedFiles.push({ file, distance });
            }
        });
        
        // Sort by distance (closest first)
        const sorted = relatedFiles.sort((a, b) => a.distance - b.distance);
        this._perfEnd(__perfMethod, { returned: sorted.length });
        return sorted;
    }

    /**
     * DEPRECATED: Gets files that are in the same directory path as the current file.
     * This method is kept for backward compatibility but will be removed in a future version.
     * Use getRelatedFilesByDistance() instead for better proximity scoring.
     * 
     * @deprecated Use getRelatedFilesByDistance() instead
     */
    getFilesInSamePath({ dv, currentPath }) {
        const pathParts = currentPath.split('/');
        // Remove the filename to get just the directory path
        const dirPath = pathParts.slice(0, -1).join('/');
        const currentDepth = pathParts.length - 1; // Subtract 1 for filename
                
        const allSamePathFiles = dv.pages()
            .where(p => p.file.path.startsWith(dirPath) && p.file.path !== currentPath);
            
        // Separate files in exact same folder vs subfolders
        const exactFolder = [];
        const subFolders = [];
        
        allSamePathFiles.forEach(file => {
            const fileDepth = file.file.path.split('/').length - 1; // Subtract 1 for filename
            if (fileDepth === currentDepth) {
                exactFolder.push(file);
            } else {
                subFolders.push(file);
            }
        });
        
        return { exactFolder, subFolders };
    }

    /**
     * Main method for finding related concepts and calculating their relationship strength
     * Uses a flexible matching system where you can specify any frontmatter fields to match on.
     * 
     * Scoring system:
     * 1. Frontmatter field matching: scoreMultiplier points each for matching any specified frontmatter fields
     * 2. Path proximity (NEW): Distance-based scoring that rewards structural organization proximity:
     *    - 0 jumps (same folder): pathDistanceMultiplier points (e.g., 2.0 points)
     *    - 1+ jumps: pathDistanceMultiplier / (1 + distance) points (e.g., 1.0, 0.67, 0.4 points)
     *    - Replaces old binary 0/1/2 system with smooth proximity gradient
     * 
     * @param {Object} params - Parameters object
     * @param {Object} params.dv - DataView API object
     * @param {Object} params.matchCriteria - Object specifying which frontmatter fields to match on
     *   - Key: frontmatter field name (e.g., 'type', 'subject', 'level', 'domain')  
     *   - Value: true (use current page's value), string (explicit value), or null/false (ignore)
     *   - If empty, defaults to: { subject: true, type: true, domain: true }
     * @param {boolean|string} params.includePath - Path scoring mode:
     *   - true: Include distance-based path scoring - DEFAULT
     *   - false: Disable path scoring completely
     *   - "strict": Only return files from same path (sets strictPath=true)
     * @param {boolean} params.strictPath - Only return same-path files if true (default: false)
     * @param {number} params.minScore - Minimum confidence score to include (0.0-1.0, default: 0.66)
     * @param {number} params.maxResults - Maximum number of results to return (default: 10)
     * @param {boolean} params.strictMaxResults - Apply max results limit strictly (default: false). 
     *   If false, continues showing results with same confidence score as the last included result.
     * @param {number} params.scoreMultiplier - Points awarded per matching frontmatter value (default: 1.5)
     * @param {number} params.pathDistanceMultiplier - Base points for path distance scoring (default: 2.0)
     * @param {number} params.maxPathDistance - Maximum filesystem distance to consider (default: 10)
     * @param {boolean} params.debug - Show detailed debug output (default: false)
     * @returns {Array} Array of related concepts with scores, sorted by total score
     * 
     * @example
     * // Find other hub pages with same type and subject  
     * getRelatedConcepts({ 
     *   dv, 
     *   matchCriteria: {
     *     type: true,        // Use current page's type value
     *     subject: true      // Use current page's subject value
     *   },
     *   debug: true 
     * })
     * 
     * @example  
     * // Find concepts with specific values
     * getRelatedConcepts({ 
     *   dv, 
     *   matchCriteria: {
     *     subject: "PKM LENS",  // Explicit value
     *     type: "hub",          // Explicit value
     *     level: true,          // Use current page's level
     *     domain: null          // Don't match on domain
     *   },
     *   debug: true 
     * })
     * 
     * @example
     * // Traditional relation-based matching (backwards compatible)
     * getRelatedConcepts({ 
     *   dv, 
     *   matchCriteria: {
     *     levels: true,    // Use current page's levels
     *     units: true      // Use current page's units
     *   },
     *   debug: true 
     * })
     */
    getRelatedConcepts({ 
        dv, 
        matchCriteria = {}, 
        includePath = true, 
        strictPath = false, 
        minScore = 0.5, 
        minResults = 5,
        strictMinResults = true,
        maxResults = 10, 
        strictMaxResults = false,
        scoreMultiplier = 1.5,
        reverseScoreMultiplier = 3.0,
        forwardScoreMultiplier = 3.0,
        pathDistanceMultiplier = 3.0,
        maxPathDistance = 5,
        debug = false 
    }) {
        const __perfMethod = this._perfStart('getRelatedConcepts');
        const current = dv.current();
        
        // Get config validation for the current page's subject
        const __cfgToken = this._perfStart('getRelatedConcepts.config');
        const config = this.getConfigForSubject({ 
            dv, 
            subject: current.subject, 
            debug: debug 
        });
        this._perfEnd(__cfgToken, { hasConfig: !!config && config.hasConfig, validSubjects: (config.validSubjects || []).length, validDomains: (config.validDomains || []).length });
        
        if (debug) {
            dv.paragraph(`**🔧 Config Lookup for Subject: "${config.debugInfo.subject}"**`);
            if (config.debugInfo.configPagesFound === 1) {
                dv.paragraph(`✅ Found Config: ${config.debugInfo.configPageName}`);
                dv.paragraph(`  • valid_filters: [${config.debugInfo.validFilters.join(', ')}]`);
                dv.paragraph(`  • valid_subjects: [${config.debugInfo.validSubjects.join(', ')}]`);
                dv.paragraph(`  • valid_domains: [${config.debugInfo.validDomains.join(', ')}]`);
            } else if (config.debugInfo.configPagesFound > 1) {
                dv.paragraph(`⚠️ Warning: Found ${config.debugInfo.configPagesFound} config pages - using first: ${config.debugInfo.configPageName}`);
                dv.paragraph(`  • All matches: [${config.debugInfo.allConfigMatches.join(', ')}]`);
                dv.paragraph(`  • valid_filters: [${config.debugInfo.validFilters.join(', ')}]`);
                dv.paragraph(`  • valid_subjects: [${config.debugInfo.validSubjects.join(', ')}]`);
                dv.paragraph(`  • valid_domains: [${config.debugInfo.validDomains.join(', ')}]`);
            } else {
                dv.paragraph(`❌ No Config page found for subject "${config.debugInfo.subject}"`);
                dv.paragraph(`  • Using default valid_subjects: [${config.debugInfo.validSubjects.join(', ')}]`);
                dv.paragraph(`  • No valid_filters available`);
                dv.paragraph(`  • No valid_domains available`);
            }
            dv.paragraph("---");
        }
        
        // Handle includePath modes
        if (includePath === "strict") {
            strictPath = true;
            includePath = true;
        }
        
        // Set default matchCriteria if none provided
        if (Object.keys(matchCriteria).length === 0) {
            matchCriteria = {
                subject: true,
                type: true,
                domain: true
            };
        }
        
        // Validate and filter matchCriteria to only include valid group fields
        if (config.validFilters.length > 0) {
            const validatedCriteria = {};
            Object.keys(matchCriteria).forEach(field => {
                if (field.startsWith('group-')) {
                    // Check if this group field is valid according to config
                    const validation = this.isValidGroupField({ 
                        groupFieldName: field, 
                        validFilters: config.validFilters
                    });
                    if (validation.isValid) {
                        validatedCriteria[field] = matchCriteria[field];
                    } else if (debug) {
                        dv.paragraph(`⚠️ Ignoring invalid group field: ${validation.reason}`);
                    }
                } else {
                    // Non-group fields are always included
                    validatedCriteria[field] = matchCriteria[field];
                }
            });
            matchCriteria = validatedCriteria;
            
            if (debug) {
                dv.paragraph(`**Group Field Validation Results:**`);
                const originalFields = Object.keys(validatedCriteria).length > 0 ? Object.keys(validatedCriteria).join(', ') : 'none';
                const groupFields = Object.keys(validatedCriteria).filter(f => f.startsWith('group-')).join(', ') || 'none';
                dv.paragraph(`  • Valid criteria fields after filtering: ${originalFields}`);
                dv.paragraph(`  • Valid group fields: ${groupFields}`);
                dv.paragraph("---");
            }
        }
        
        // Process matchCriteria to get actual values to match on
        const resolvedCriteria = {};
        const searchFilters = {};
        
        // ALWAYS filter by valid subjects from config
        searchFilters['subject'] = config.validSubjects;
        
        Object.keys(matchCriteria).forEach(field => {
            const criteriaValue = matchCriteria[field];
            
            if (criteriaValue === null || criteriaValue === false) {
                // Ignore this field
                return;
            }
            
            // Skip group-* fields that aren't in config valid_filters
            if (field.startsWith('group-')) {
                const validation = this.isValidGroupField({ 
                    groupFieldName: field, 
                    validFilters: config.validFilters
                });
                if (!validation.isValid) {
                    if (debug) {
                        dv.paragraph(`⚠️ Skipping invalid group field: ${validation.reason}`);
                    }
                    return;
                }
            }
            
            if (criteriaValue === true) {
                // Use current page's value
                resolvedCriteria[field] = current[field];
            } else {
                // Use explicit value
                resolvedCriteria[field] = criteriaValue;
            }
            
            // Set up domain filter if specified
            if (field === 'domain') {
                searchFilters[field] = resolvedCriteria[field];
            }
        });
        
        if (debug) {
            dv.header(3, "🐛 DEBUG: ConceptManager.getRelatedConcepts()");
            dv.paragraph(`**Current file:** ${current.file.path}`);
            dv.paragraph(`**Parameters:**`);
            dv.paragraph(`  • includePath: ${includePath}`);
            dv.paragraph(`  • strictPath: ${strictPath}`);
            dv.paragraph(`  • minScore: ${minScore}`);
            dv.paragraph(`  • maxResults: ${maxResults}`);
            dv.paragraph(`  • strictMaxResults: ${strictMaxResults}`);
            dv.paragraph(`  • scoreMultiplier: ${scoreMultiplier} (regular field matches)`);
            dv.paragraph(`  • reverseScoreMultiplier: ${reverseScoreMultiplier} (reverse relationships)`);
            dv.paragraph(`  • forwardScoreMultiplier: ${forwardScoreMultiplier} (forward relationships from current page)`);
            dv.paragraph(`  • pathDistanceMultiplier: ${pathDistanceMultiplier} (base path scoring)`);
            dv.paragraph(`  • maxPathDistance: ${maxPathDistance} (max filesystem jumps)`);
            dv.paragraph(`  **Path Scoring Formula:** distance=0 → ${pathDistanceMultiplier} pts; distance>0 → ${pathDistanceMultiplier}/(1+distance) pts`);
            dv.paragraph(`**Current frontmatter values:**`);
            Object.keys(current).forEach(key => {
                if (typeof current[key] !== 'function' && key !== 'file') {
                    dv.paragraph(`  • ${key}: ${Array.isArray(current[key]) ? current[key].join(', ') : current[key]}`);
                }
            });
            dv.paragraph(`**Final resolved criteria (after validation):**`);
            Object.keys(resolvedCriteria).forEach(field => {
                const value = resolvedCriteria[field];
                const displayValue = Array.isArray(value) ? value.join(', ') : (value || 'undefined');
                dv.paragraph(`  • ${field}: ${displayValue}`);
            });
            dv.paragraph(`**Search filters applied to ALL queries:**`);
            Object.keys(searchFilters).forEach(filter => {
                const value = searchFilters[filter];
                const displayValue = Array.isArray(value) ? value.join(', ') : (value || 'undefined');
                dv.paragraph(`  • ${filter}: [${displayValue}]`);
            });
            dv.paragraph("---");
        }
        
        // Get files with distance-based scoring (if path scoring is enabled)
        const relatedConcepts = new Map();
        
        if (includePath) {
            // Use new distance-based approach, limited to valid subjects for performance
            const __distToken = this._perfStart('getRelatedConcepts.distanceSearch');
            const distanceFiles = this.getRelatedFilesByDistance({ 
                dv, 
                currentPath: current.file.path, 
                validSubjects: config.validSubjects,
                validDomains: config.validDomains,
                maxDistance: maxPathDistance 
            });
            this._perfEnd(__distToken, { count: distanceFiles.length, maxDistance: maxPathDistance, includePath });
        
            if (debug) {
                dv.paragraph(`**Step 1: Finding files by distance-based path scoring**`);
                dv.paragraph(`Current file: ${current.file.path}`);
                dv.paragraph(`Valid subjects: [${config.validSubjects.join(', ')}]`);
                dv.paragraph(`Valid domains: [${config.validDomains.join(', ')}]`);
                dv.paragraph(`Max distance: ${maxPathDistance} jumps`);
                dv.paragraph(`Files found: ${distanceFiles.length} within distance threshold`);
                
                if (distanceFiles.length > 0) {
                    dv.paragraph("**Distance breakdown:**");
                    const distanceGroups = {};
                    distanceFiles.forEach(({file, distance}) => {
                        if (!distanceGroups[distance]) distanceGroups[distance] = [];
                        distanceGroups[distance].push(file.file.path);
                    });
                    
                    Object.keys(distanceGroups).sort((a, b) => parseInt(a) - parseInt(b)).forEach(distance => {
                        const files = distanceGroups[distance];
                        const score = distance === '0' ? pathDistanceMultiplier : (pathDistanceMultiplier / (1 + parseInt(distance))).toFixed(2);
                        dv.paragraph(`  • Distance ${distance} jumps (${score} pts): ${files.length} files`);
                        if (files.length <= 5) {
                            dv.list(files);
                        } else {
                            dv.list(files.slice(0, 300).concat([`... and ${files.length - 300} more`]));
                        }
                    });
                }
                dv.paragraph("---");
            }
        
            // Add distance-based scores using new formula
            distanceFiles.forEach(({file, distance}) => {
                const conceptId = file.file.path;
                
                // Calculate score: 0 distance = full points, >0 distance = decaying points
                const pathScore = distance === 0 ? 
                    pathDistanceMultiplier : 
                    pathDistanceMultiplier / (1 + distance);
                
                relatedConcepts.set(conceptId, { 
                    concept: file, 
                    scores: new Map([["path", pathScore]])
                });
            });
            
            if (debug) {
                dv.paragraph(`**Step 2: Applied distance-based path scoring**`);
                dv.paragraph(`Added ${distanceFiles.length} concepts with distance-based path scores`);
                
                if (distanceFiles.length > 0) {
                    const scoreExamples = distanceFiles.slice(0, 3).map(({file, distance}) => {
                        const score = distance === 0 ? pathDistanceMultiplier : (pathDistanceMultiplier / (1 + distance)).toFixed(2);
                        return `${file.file.name} (${distance} jumps = ${score} pts)`;
                    });
                    dv.paragraph(`Examples: ${scoreExamples.join(', ')}`);
                }
                dv.paragraph("---");
            }
        }
    
        // Process each frontmatter field criteria
        let stepCounter = strictPath ? 1 : 3; // Step numbering starts at 3 if we already did path scoring
        
        Object.keys(resolvedCriteria).forEach(field => {
            const targetValue = resolvedCriteria[field];
            
            if (!targetValue) {
                if (debug) {
                    dv.paragraph(`**Step ${stepCounter}: Checking frontmatter field '${field}'**`);
                    dv.paragraph(`❌ Target value is null/undefined for '${field}' - skipping`);
                    stepCounter++;
                }
                return;
            }
    
            const targetValues = Array.isArray(targetValue) ? targetValue : [targetValue];
            
            if (debug) {
                dv.paragraph(`**Step ${stepCounter}: Checking frontmatter field '${field}'**`);
                dv.paragraph(`**EXACT QUERY BEING RUN:**`);
                dv.paragraph(`  • Field: "${field}"`);
                dv.paragraph(`  • Target value(s): [${targetValues.join(', ')}]`);
                if (searchFilters.subject) {
                    const searchSubjects = Array.isArray(searchFilters.subject) ? searchFilters.subject : [searchFilters.subject];
                    dv.paragraph(`  • Subject filter: [${searchSubjects.join(', ')}] (from config valid_subjects)`);
                } else {
                    dv.paragraph(`  • Subject filter: none`);
                }
                if (searchFilters.domain) {
                    const searchDomains = Array.isArray(searchFilters.domain) ? searchFilters.domain : [searchFilters.domain];
                    dv.paragraph(`  • Domain filter: [${searchDomains.join(', ')}] (current page's domain)`);
                } else {
                    dv.paragraph(`  • Domain filter: none`);
                }
                dv.paragraph(`  • Exclude current page: ${current.file.name}`);
                dv.paragraph(`  • Query: Find pages where ${field} contains ANY of [${targetValues.join(', ')}] AND subject in valid_subjects AND NOT current page`);
            }
            
            // Find all files that match this criteria
            const __fieldToken = this._perfStart(`getRelatedConcepts.fieldQuery:${field}`);
            const matchingConcepts = dv.pages()
                .where(p => {
                    // Exclude current page
                    if (p.file.path === current.file.path) return false;
                    
                    // Apply subject filter if it's in searchFilters (handle arrays properly)
                    if (searchFilters.subject) {
                        const searchSubjects = Array.isArray(searchFilters.subject) ? searchFilters.subject : [searchFilters.subject];
                        if (!searchSubjects.includes(p.subject)) return false;
                    }
                    // Apply domain filter if it's in searchFilters (handle arrays properly)
                    if (searchFilters.domain) {
                        const searchDomains = Array.isArray(searchFilters.domain) ? searchFilters.domain : [searchFilters.domain];
                        if (!searchDomains.includes(p.domain)) return false;
                    }
                    
                    // Check if this field matches
                    const pageValue = p[field];
                    if (!pageValue) return false;
                    
                    const pageValues = Array.isArray(pageValue) ? pageValue : [pageValue];
                    // Check if any of the target values match any of the page values
                    return targetValues.some(tv => pageValues.includes(tv));
            });
            this._perfEnd(__fieldToken, { field, matches: matchingConcepts.length, targetCount: targetValues.length, subjectFilterApplied: !!searchFilters.subject, domainFilterApplied: !!searchFilters.domain });
            
            if (debug) {
                dv.paragraph(`**QUERY RESULTS:**`);
                dv.paragraph(`  • Found ${matchingConcepts.length} files matching '${field}' criteria`);
                if (matchingConcepts.length > 0 && matchingConcepts.length <= 10) {
                    dv.paragraph(`  • Matching pages:`);
                    matchingConcepts.forEach(c => {
                        const pageValues = Array.isArray(c[field]) ? c[field] : [c[field]];
                        const matchingValues = targetValues.filter(v => pageValues.includes(v));
                        dv.paragraph(`    - ${c.file.name}: ${field}=[${pageValues.join(', ')}] (matches: [${matchingValues.join(', ')}])`);
                    });
                } else if (matchingConcepts.length > 10) {
                    dv.paragraph(`  • Too many matches to list (${matchingConcepts.length} pages)`);
                    dv.paragraph(`  • Sample of first 3:`);
                    Array.from(matchingConcepts).slice(0, 3).forEach(c => {
                        const pageValues = Array.isArray(c[field]) ? c[field] : [c[field]];
                        const matchingValues = targetValues.filter(v => pageValues.includes(v));
                        dv.paragraph(`    - ${c.file.name}: ${field}=[${pageValues.join(', ')}] (matches: [${matchingValues.join(', ')}])`);
                    });
                }
            }
    
            // Add scores for each matching concept
            matchingConcepts.forEach(concept => {
                const conceptId = concept.file.path;
                if (!relatedConcepts.has(conceptId)) {
                    relatedConcepts.set(conceptId, { 
                        concept, 
                        scores: new Map([["path", 0]]) 
                    });
                }
                
                const conceptValues = Array.isArray(concept[field]) ? 
                    concept[field] : [concept[field]];
                const matchingValues = targetValues.filter(v => conceptValues.includes(v));
                relatedConcepts.get(conceptId).scores.set(field, matchingValues.length * scoreMultiplier); // points per match
                // TMI: Uncomment to see the matching values and their scores
                // if (debug) {
                //     dv.paragraph(`  → ${concept.file.name}: ${matchingValues.length} matching values (${matchingValues.join(', ')}) = ${matchingValues.length * scoreMultiplier} points`); // points per match
                // }
            });
            
            if (debug) {
                dv.paragraph("---");
            }
            stepCounter++;
        });
        
        // REVERSE RELATIONSHIP LOOKUP: Find pages that reference the current page
        if (current['domain-category']) {
            const domainCategories = Array.isArray(current['domain-category']) ? current['domain-category'] : [current['domain-category']];
            const currentPageName = current.file.name;
            
            if (debug) {
                dv.paragraph(`**Step ${stepCounter}: Reverse relationship lookup**`);
                dv.paragraph(`**Current page name:** "${currentPageName}"`);
                dv.paragraph(`**Domain categories:** [${domainCategories.join(', ')}]`);
            }
            
            domainCategories.forEach(category => {
                const groupFieldName = `group-${category}`;
                const __revToken = this._perfStart(`getRelatedConcepts.reverse:${groupFieldName}`);
                
                // Validate that this group field is in config
                const validation = this.isValidGroupField({ 
                    groupFieldName: groupFieldName, 
                    validFilters: config.validFilters
                });
                
                if (!validation.isValid) {
                    if (debug) {
                        dv.paragraph(`⚠️ Skipping reverse lookup for invalid group field: ${validation.reason}`);
                    }
                    this._perfEnd(__revToken, { skipped: true });
                    return;
                }
                
                if (debug) {
                    dv.paragraph(`**REVERSE LOOKUP QUERY:**`);
                    dv.paragraph(`  • Looking for pages with field: "${groupFieldName}"`);
                    dv.paragraph(`  • That contain value: "${currentPageName}"`);
                    dv.paragraph(`  • Subject filter: [${config.validSubjects.join(', ')}] (from config)`);
                }
                
                // Find pages that reference the current page in this group field
                const reverseMatchingConcepts = dv.pages()
                    .where(p => {
                        // Filter by valid subjects
                        if (!config.validSubjects.includes(p.subject)) return false;
                        
                        // Exclude current page
                        if (p.file.path === current.file.path) return false;
                        
                        // Check if this page has the group field
                        if (!p[groupFieldName]) return false;
                        
                        // Check if the field contains the current page name
                        const fieldValue = p[groupFieldName];
                        if (Array.isArray(fieldValue)) {
                            return fieldValue.some(val => val && val.toString().includes(currentPageName));
                        } else {
                            return fieldValue && fieldValue.toString().includes(currentPageName);
                        }
                    });
                this._perfEnd(__revToken, { matches: reverseMatchingConcepts.length });
                
                if (debug) {
                    dv.paragraph(`**REVERSE LOOKUP RESULTS:**`);
                    dv.paragraph(`  • Found ${reverseMatchingConcepts.length} files with reverse references`);
                    if (reverseMatchingConcepts.length > 0) {
                        dv.paragraph(`  • Matching pages:`);
                        reverseMatchingConcepts.forEach(concept => {
                            const fieldValue = concept[groupFieldName];
                            const displayValue = Array.isArray(fieldValue) ? fieldValue.join(', ') : fieldValue;
                            dv.paragraph(`    - ${concept.file.name}: ${groupFieldName}=[${displayValue}] (contains: ${currentPageName})`);
                        });
                    }
                }
                
                // Add points for reverse relationships
                reverseMatchingConcepts.forEach(concept => {
                    const conceptId = concept.file.path;
                    if (!relatedConcepts.has(conceptId)) {
                        relatedConcepts.set(conceptId, { 
                            concept, 
                            scores: new Map([["path", 0]]) 
                        });
                    }
                    
                    const points = reverseScoreMultiplier; // Higher weight for direct creative relationships
                    relatedConcepts.get(conceptId).scores.set(`${groupFieldName}-reverse`, points);
                });
            });
            
            if (debug) {
                dv.paragraph("---");
            }
            
            stepCounter++;
        }
        
        // FORWARD RELATIONSHIP LOOKUP: Award points when the CURRENT page references candidates by name
        // Example: On a Film page, "group-film-director: John Waters" or "group-film-actor: John Waters"
        // should give points to the Person page(s) whose domain-category includes "film-director" or "film-actor" respectively.
        {
            const currentGroupFields = Object.keys(current).filter(k => k.startsWith('group-') && current[k]);
            if (currentGroupFields.length > 0) {
                if (debug) {
                    dv.paragraph(`**Step ${stepCounter}: Forward relationship lookup (current → others)**`);
                    dv.paragraph(`Current group fields: [${currentGroupFields.join(', ')}]`);
                }

                currentGroupFields.forEach(groupFieldName => {
                    const __fwdToken = this._perfStart(`getRelatedConcepts.forward:${groupFieldName}`);
                    // Validate this group field against config
                    const validation = this.isValidGroupField({ 
                        groupFieldName, 
                        validFilters: config.validFilters 
                    });

                    if (!validation.isValid) {
                        if (debug) {
                            dv.paragraph(`⚠️ Skipping forward lookup for invalid group field: ${validation.reason}`);
                        }
                        this._perfEnd(__fwdToken, { skipped: true });
                        return;
                    }

                    const entityNames = this.normalizeValues(current[groupFieldName]);
                    const expectedCategory = validation.filterName; // e.g., film-director, film-actor, cinema-theme

                    if (debug) {
                        dv.paragraph(`**FORWARD LOOKUP QUERY (${groupFieldName}):**`);
                        dv.paragraph(`  • Values on current page: [${entityNames.join(', ')}]`);
                        dv.paragraph(`  • Looking for pages whose file name matches any of these values`);
                        dv.paragraph(`  • And whose domain-category includes: "${expectedCategory}"`);
                    }

                    let totalForwardMatches = 0;
                    entityNames.forEach(nameValue => {
                        const nameValueLower = String(nameValue).toLowerCase();
                        const forwardMatches = dv.pages()
                            .where(p => {
                                // Subject/domain safety filters
                                if (!config.validSubjects.includes(p.subject)) return false;
                                if (p.file.path === current.file.path) return false;

                                // Must have domain-category including the expected category
                                if (!p['domain-category']) return false;
                                const cats = this.normalizeValues(p['domain-category']);
                                if (!cats.includes(expectedCategory)) return false;

                                // Name match against page file name (case-insensitive, substring tolerant)
                                const pageNameLower = String(p.file.name).toLowerCase();
                                return pageNameLower.includes(nameValueLower);
                            });
                        totalForwardMatches += forwardMatches.length;

                        if (debug) {
                            const count = forwardMatches.length;
                            if (count > 0) {
                                dv.paragraph(`  • Found ${count} page(s) referenced by current.${groupFieldName} containing "${nameValue}":`);
                                forwardMatches.forEach(concept => {
                                    dv.paragraph(`    - ${concept.file.name} (domain-category includes "${expectedCategory}")`);
                                });
                            }
                        }

                        forwardMatches.forEach(concept => {
                            const conceptId = concept.file.path;
                            if (!relatedConcepts.has(conceptId)) {
                                relatedConcepts.set(conceptId, { 
                                    concept, 
                                    scores: new Map([["path", 0]]) 
                                });
                            }
                            // Award points for the forward reference from current page
                            const key = `${groupFieldName}-forward`;
                            relatedConcepts.get(conceptId).scores.set(key, forwardScoreMultiplier);
                        });
                    });
                    this._perfEnd(__fwdToken, { names: entityNames.length, matches: totalForwardMatches });
                });

                if (debug) {
                    dv.paragraph(`Forward lookup complete.`);
                    dv.paragraph("---");
                }

                stepCounter++;
            }
        }
        
        // Calculate final scores
        if (debug) {
            dv.paragraph(`**Step ${stepCounter}: Calculating final scores**`);
            dv.paragraph(`Total concepts found: ${relatedConcepts.size}`);
        }
        
        const results = Array.from(relatedConcepts.values()).map(({ concept, scores }) => {
            const pathScore = scores.get("path") || 0;
            
            // Sum all frontmatter field scores (excluding path)
            const frontmatterScores = Array.from(scores.entries())
                .filter(([key]) => key !== "path")
                .reduce((sum, [, score]) => sum + score, 0);
            
            const totalScore = pathScore + frontmatterScores;
            
            // Calculate max possible score based on criteria
            let maxPossibleScore = strictPath ? 0 : pathDistanceMultiplier; // Max path score equals potential same-folder points
            
            Object.keys(resolvedCriteria).forEach(field => {
                const targetValue = resolvedCriteria[field];
                if (targetValue) {
                    const targetValues = Array.isArray(targetValue) ? targetValue : [targetValue];
                    maxPossibleScore += targetValues.length * scoreMultiplier; // points per matching value
                }
            });
            
            // Add potential reverse relationship points
            if (current['domain-category']) {
                const domainCategories = Array.isArray(current['domain-category']) ? current['domain-category'] : [current['domain-category']];
                domainCategories.forEach(category => {
                    const groupFieldName = `group-${category}`;
                    const validation = this.isValidGroupField({ 
                        groupFieldName: groupFieldName, 
                        validFilters: config.validFilters
                    });
                    if (validation.isValid) {
                        maxPossibleScore += reverseScoreMultiplier; // Add potential reverse relationship points
                    }
                });
            }

            // Add potential forward relationship points (one per valid group-* field on current page)
            const currentGroupFieldsForMax = Object.keys(current).filter(k => k.startsWith('group-') && current[k]);
            currentGroupFieldsForMax.forEach(groupFieldName => {
                const validation = this.isValidGroupField({ 
                    groupFieldName, 
                    validFilters: config.validFilters 
                });
                if (validation.isValid) {
                    maxPossibleScore += forwardScoreMultiplier;
                }
            });
            
            const confidence = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
            
            if (debug) {
                const scoreBreakdown = Array.from(scores.entries())
                    .map(([key, score]) => `${key}=${score}`)
                    .join(', ');
                    
                // Build detailed breakdown showing which fields matched
                let detailedBreakdown = [];
                scores.forEach((score, field) => {
                    if (field === "path") {
                        detailedBreakdown.push(`${field}=${score}${score > 0 ? '' : ''}`);
                    } else if (field.endsWith('-reverse')) {
                        // Show reverse relationship
                        const baseField = field.replace('-reverse', '');
                        detailedBreakdown.push(`${baseField}=${score} (reverse: contains "${current.file.name}")`);
                    } else if (field.endsWith('-forward')) {
                        // Show forward relationship
                        const baseField = field.replace('-forward', '');
                        detailedBreakdown.push(`${baseField}=${score} (forward: current.${baseField} contains "${concept.file.name}")`);
                    } else {
                        // Show which values matched for this field
                        const conceptValue = concept[field];
                        const targetValue = resolvedCriteria[field];
                        if (conceptValue && targetValue) {
                            const conceptValues = Array.isArray(conceptValue) ? conceptValue : [conceptValue];
                            const targetValues = Array.isArray(targetValue) ? targetValue : [targetValue];
                            const matches = targetValues.filter(v => conceptValues.includes(v));
                            detailedBreakdown.push(`${field}=${score} (matches: [${matches.join(', ')}])`);
                        } else {
                            detailedBreakdown.push(`${field}=${score}`);
                        }
                    }
                });
                
                if (confidence >= minScore * 100) {
                    dv.paragraph(`✓ ${concept.file.name}: ${detailedBreakdown.join(', ')}, total=${totalScore}/${maxPossibleScore} = ${confidence.toFixed(2)}%`);
                } else {
                    // Show failed matches too for debugging
                    dv.paragraph(`✗ ${concept.file.name}: ${detailedBreakdown.join(', ')}, total=${totalScore}/${maxPossibleScore} = ${confidence.toFixed(2)}%`);
                }
            }
            
            return { 
                concept, 
                confidence,
                inSamePath: pathScore > 0 
            };
        });
        
        if (debug) {
            dv.paragraph("---");
            dv.paragraph(`**Step ${stepCounter + 1}: Applying filters**`);
            dv.paragraph(`Search filters: ${Object.keys(searchFilters).length > 0 ? 
                Object.entries(searchFilters).map(([k,v]) => `${k}=${v}`).join(', ') : 'none'}`);
            dv.paragraph(`Strict path mode: ${strictPath}`);
            dv.paragraph(`Minimum confidence: ${(minScore * 100).toFixed(1)}%`);
            dv.paragraph(`Max results: ${maxResults}`);
            dv.paragraph(`Strict max results: ${strictMaxResults}`);
            dv.paragraph(`Min results: ${minResults}`);
            dv.paragraph(`Strict min results: ${strictMinResults}`);
        }
        
        // Apply filtering and sorting
        // Pre-filter for path and sort by confidence
        const preSortedResults = results
            .filter(r => !strictPath || r.inSamePath) // Only include same-path files if strictPath is true
            .sort((a, b) => b.confidence - a.confidence);
        
        // Calculate adaptive minScore if needed
        let adaptiveMinScore = minScore;
        if (strictMinResults) {
            // Check how many results we'd get with current minScore
            const currentResults = preSortedResults.filter(r => r.confidence >= minScore * 100);
            
            if (currentResults.length < minResults && preSortedResults.length >= minResults) {
                // We need to lower the threshold
                // Find the score that would give us at least minResults
                const targetScore = preSortedResults[minResults - 1].confidence;
                // Don't go below 10% minimum
                adaptiveMinScore = Math.max(0.1, targetScore / 100);
                
                if (debug) {
                    dv.paragraph(`**Adaptive MinScore:** Lowered from ${(minScore * 100).toFixed(1)}% to ${(adaptiveMinScore * 100).toFixed(1)}% to reach minResults=${minResults}`);
                }
            }
        }
        
        // Apply the (possibly adapted) minimum score threshold
        const sortedResults = preSortedResults.filter(r => r.confidence >= adaptiveMinScore * 100);
        
        // Apply max results limit with optional strict mode
        let filtered;
        if (strictMaxResults) {
            // Strict mode: simply cut off at maxResults
            filtered = sortedResults.slice(0, maxResults);
        } else {
            // Non-strict mode: include all results with same confidence as the last included result
            if (sortedResults.length <= maxResults) {
                filtered = sortedResults;
            } else {
                // Get initial results up to maxResults
                filtered = sortedResults.slice(0, maxResults);
                
                // Get the confidence score of the last included result
                const lastIncludedScore = filtered[filtered.length - 1].confidence;
                
                // Continue adding results that have the same confidence score
                for (let i = maxResults; i < sortedResults.length; i++) {
                    if (sortedResults[i].confidence === lastIncludedScore) {
                        filtered.push(sortedResults[i]);
                    } else {
                        // Once we hit a different score, stop
                        break;
                    }
                }
            }
        }
        
        // Apply subject validation using config
        const subjectFiltering = this.filterPagesByValidSubjects({
            pages: filtered.map(r => r.concept),
            validSubjects: config.validSubjects,
            currentPagePath: current.file.path,
            debug: debug
        });

        // Apply domain validation using config
        const domainFiltering = this.filterPagesByValidDomains({
            pages: subjectFiltering.filtered,
            validDomains: config.validDomains,
            currentPagePath: current.file.path,
            debug: debug
        });

        if (debug) {
            dv.paragraph(`**Final Subject Filtering (Safety Check):**`);
            dv.paragraph(`  • Input concepts: ${subjectFiltering.debugInfo.inputCount}`);
            dv.paragraph(`  • Valid subjects: [${subjectFiltering.debugInfo.validSubjects.join(', ')}]`);
            dv.paragraph(`  • Concepts after subject filtering: ${subjectFiltering.debugInfo.filteredCount}`);
            if (subjectFiltering.debugInfo.inputCount === subjectFiltering.debugInfo.filteredCount) {
                dv.paragraph(`  • ✅ No additional subject filtering needed (queries already filtered by valid subjects)`);
            } else {
                dv.paragraph(`  • ⚠️ Additional subject filtering applied: ${subjectFiltering.debugInfo.inputCount - subjectFiltering.debugInfo.filteredCount} concepts removed`);
            }
            if (subjectFiltering.debugInfo.excludedCurrentPage) {
                dv.paragraph(`  • Current page already excluded in queries: ${subjectFiltering.debugInfo.currentPagePath}`);
            }
            
            dv.paragraph(`**Final Domain Filtering (Safety Check):**`);
            dv.paragraph(`  • Input concepts: ${domainFiltering.debugInfo.inputCount}`);
            dv.paragraph(`  • Valid domains: [${domainFiltering.debugInfo.validDomains.join(', ')}]`);
            dv.paragraph(`  • Concepts after domain filtering: ${domainFiltering.debugInfo.filteredCount}`);
            if (domainFiltering.debugInfo.noFiltering) {
                dv.paragraph(`  • ✅ No domain filtering applied (no valid_domains configured)`);
            } else if (domainFiltering.debugInfo.inputCount === domainFiltering.debugInfo.filteredCount) {
                dv.paragraph(`  • ✅ No additional domain filtering needed (queries already filtered by valid domains)`);
            } else {
                dv.paragraph(`  • ⚠️ Additional domain filtering applied: ${domainFiltering.debugInfo.inputCount - domainFiltering.debugInfo.filteredCount} concepts removed`);
            }
        }
        
        // Rebuild the filtered results with only valid subjects and domains
        const finalResults = filtered.filter(result => 
            domainFiltering.filtered.some(validPage => 
                validPage.file.path === result.concept.file.path
            )
        );
            
        if (debug) {
            // Debug: Show what's in resolvedCriteria
            dv.paragraph(`**Debug Info:**`);
            dv.paragraph(`Resolved criteria: ${Object.keys(resolvedCriteria).map(k => `${k}=${resolvedCriteria[k]}`).join(', ')}`);
            
            // Show ALL results in debug table (unfiltered)
            dv.paragraph(`**All Results: ${results.length} concepts found**`);
            if (results.length > 0) {
                // Build dynamic table columns based on what was actually used
                const columns = ["Concept", "Confidence"];
                
                // Add path column if path scoring was enabled
                if (includePath) {
                    columns.push("Same Path");
                }
                
                // Add columns for each criteria that was used (ensure we have the field)
                Object.keys(resolvedCriteria).forEach(field => {
                    if (resolvedCriteria[field] !== undefined && resolvedCriteria[field] !== null) {
                        const capitalizedField = field.charAt(0).toUpperCase() + field.slice(1);
                        columns.push(capitalizedField);
                    }
                });
                
                // Build table rows for ALL results
                const rows = results.map(r => {
                    const row = [
                        r.concept.file.link,
                        `${r.confidence.toFixed(2)}%`
                    ];
                    
                    // Add path column if enabled
                    if (includePath) {
                        row.push(r.inSamePath ? "✓" : "✗");
                    }
                    
                    // Add values for each criteria (only if field is defined)
                    Object.keys(resolvedCriteria).forEach(field => {
                        if (resolvedCriteria[field] !== undefined && resolvedCriteria[field] !== null) {
                            const value = r.concept[field];
                            row.push(Array.isArray(value) ? value.join(', ') : (value || '-'));
                        }
                    });
                    
                    return row;
                });
                
                dv.table(columns, rows);
            } else {
                dv.paragraph("❌ No concepts found matching the criteria");
            }
            
            const filterDescription = strictMaxResults ? 
                `strict maxResults=${maxResults}` : 
                `maxResults=${maxResults} (non-strict, included ${filtered.length > maxResults ? filtered.length - maxResults : 0} additional results with same confidence)`;
            dv.paragraph(`**Filtered Results: ${filtered.length} concepts (after minScore=${(adaptiveMinScore * 100).toFixed(1)}%, ${filterDescription})**`);
            dv.paragraph(`**Final Results: ${finalResults.length} concepts (after subject validation with validSubjects=[${subjectFiltering.debugInfo.validSubjects.join(', ')}])**`);
            dv.paragraph("---");
        }
        
        this._perfEnd(__perfMethod, { results: finalResults.length });
        return finalResults;
    }

    /**
     * Utility method to normalize values to arrays (borrowed from legacy)
     * Handles both string and array formats, including nested arrays
     * @param {string|Array} values - The values to normalize
     * @returns {Array} - The normalized array
     */
    normalizeValues(values) {
        if (!values) return [];
        if (Array.isArray(values)) {
            // Flatten nested arrays and convert all to strings
            return values.flat(Infinity).map(v => String(v));
        }
        return [String(values)]; // Convert to string and then to array with single item
    }

    /**
     * Utility method to get configuration and validation settings for a given subject
     * Centralizes the logic for finding config pages and extracting valid filters/subjects
     * 
     * @param {Object} params - Parameters object
     * @param {Object} params.dv - The dataview API object
     * @param {string} params.subject - The subject to find config for
     * @param {boolean} [params.debug=false] - Show debug output
     * @returns {Object} Configuration object with validFilters, validSubjects, and configPage
     * 
     * @example
     * const config = this.getConfigForSubject({ dv, subject: "Sample Project", debug: true });
     * // Returns: { validFilters: [...], validSubjects: [...], configPage: {...} }
     */
    getConfigForSubject({ dv, subject, debug = false }) {
        this._incrementCallCount('getConfigForSubject');

        // Memoization
        if (this._configCacheOptions.enabled) {
            const cached = this._configCache.get(subject);
            if (cached) {
                const nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                const ageMs = nowMs - cached.cachedAt;
                if (this._configCacheOptions.ttlMs === 0 || ageMs <= this._configCacheOptions.ttlMs) {
                    return cached.value;
                }
            }
        }

        const __perfToken = this._perfStart('getConfigForSubject');
        // Find config page with matching subject
        const configPages = dv.pages()
            .where(p => 
                p.type === "config" && 
                p.subject === subject
            );
            
        const configPage = configPages.length > 0 ? configPages[0] : null;
        
        // Extract valid filters, subjects, and domains from config
        let validFilters = configPage ? (configPage.valid_filters || []) : [];
        let validSubjects = configPage ? (configPage.valid_subjects || []) : [];
        let validDomains = configPage ? (configPage.valid_domains || []) : [];
        
        // If no valid subjects found, default to current subject
        if (!validSubjects.length) {
            validSubjects = [subject];
        }
        
        const debugInfo = {
            subject,
            configPagesFound: configPages.length,
            configPageName: configPage ? configPage.file.name : null,
            allConfigMatches: configPages.map(p => p.file.name),
            validFilters,
            validSubjects,
            validDomains,
            hasConfig: !!configPage
        };
        
        const result = {
            validFilters,
            validSubjects,
            validDomains,
            configPage,
            hasConfig: !!configPage,
            debugInfo
        };

        // Store in cache
        if (this._configCacheOptions.enabled) {
            const nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            this._configCache.set(subject, { value: result, cachedAt: nowMs });
        }

        this._perfEnd(__perfToken, { subject, hasConfig: result.hasConfig });
        return result;
    }

    /**
     * Utility method to validate if a group field name is allowed according to config
     * 
     * @param {Object} params - Parameters object
     * @param {string} params.groupFieldName - The group field name to validate (e.g., "group-release-year")
     * @param {Array} params.validFilters - Array of valid filter names from config (clean names like "release-year")
     * @param {boolean} [params.debug=false] - Show debug output
     * @returns {boolean} True if the group field is valid
     * 
     * @example
     * const isValid = this.isValidGroupField({ 
     *   groupFieldName: "group-release-year", 
     *   validFilters: ["release-year", "film-director"], 
     *   debug: true 
     * });
     */
    isValidGroupField({ groupFieldName, validFilters, debug = false }) {
        if (!groupFieldName.startsWith('group-')) {
            return { isValid: false, reason: `"${groupFieldName}" is not a group field (doesn't start with 'group-')` };
        }
        
        // Strip "group-" prefix and compare against clean validFilters
        const filterName = groupFieldName.replace('group-', '');
        const isValid = validFilters.includes(filterName);
        
        return { 
            isValid, 
            filterName,
            reason: isValid ? 
                `"${groupFieldName}" is valid ("${filterName}" found in valid_filters)` : 
                `"${groupFieldName}" is invalid ("${filterName}" not in valid_filters: [${validFilters.join(', ')}])`
        };
    }

    /**
     * Utility method to filter pages by valid subjects
     * 
     * @param {Object} params - Parameters object
     * @param {Array} params.pages - Array of pages to filter
     * @param {Array} params.validSubjects - Array of valid subject values
     * @param {string} [params.currentPagePath] - Current page path to exclude from results
     * @param {boolean} [params.debug=false] - Show debug output
     * @returns {Array} Filtered array of pages
     */
    filterPagesByValidSubjects({ pages, validSubjects, currentPagePath = null, debug = false }) {
        const filtered = pages.filter(page => {
            // Exclude current page if specified
            if (currentPagePath && page.file.path === currentPagePath) {
                return false;
            }
            
            // Check if page subject is in valid subjects
            return validSubjects.includes(page.subject);
        });
        
        const debugInfo = {
            inputCount: pages.length,
            validSubjects,
            filteredCount: filtered.length,
            excludedCurrentPage: currentPagePath ? true : false,
            currentPagePath
        };
        
        return { filtered, debugInfo };
    }

    filterPagesByValidDomains({ pages, validDomains, currentPagePath = null, debug = false }) {
        // If no valid domains specified, return all pages
        if (!validDomains || validDomains.length === 0) {
            return {
                filtered: pages,
                debugInfo: {
                    inputCount: pages.length,
                    validDomains: [],
                    filteredCount: pages.length,
                    excludedCurrentPage: currentPagePath ? true : false,
                    currentPagePath,
                    noFiltering: true
                }
            };
        }

        const filtered = pages.filter(page => {
            // Exclude current page if specified
            if (currentPagePath && page.file.path === currentPagePath) {
                return false;
            }
            
            // Check if page domain is in valid domains
            return validDomains.includes(page.domain);
        });
        
        const debugInfo = {
            inputCount: pages.length,
            validDomains,
            filteredCount: filtered.length,
            excludedCurrentPage: currentPagePath ? true : false,
            currentPagePath
        };
        
        return { filtered, debugInfo };
    }

    /**
     * ...
     */
    getRelationLabel({ dv, domainCategory, direction, subject, debug = false }) {
        if (debug) {
            dv.paragraph(`**🔍 Looking up relation label for domain-category: "${domainCategory}" and direction: "${direction}"**`);
            dv.paragraph(`Search criteria: type="hub", domain-category="${domainCategory}", subject="${subject}"`);
        }
        // ...
        
    }


    /**
     * Gets the canonical display name for a domain category by looking for a Hub page
     * Searches for Hub pages with matching domain-category and subject
     * 
     * @param {Object} params - Parameters object
     * @param {Object} params.dv - The dataview API object
     * @param {string} params.domainCategory - The domain category to find a name for (e.g., "cat-breed")
     * @param {string} params.subject - The subject to filter hubs by
     * @param {boolean} [params.debug=false] - Show debug output
     * @returns {string|null} The canonical name or null if not found
     */
    getCanonicalNameForCategory({ dv, domainCategory, subject, debug = false }) {
        if (debug) {
            dv.paragraph(`**🔍 Looking up canonical name for domain-category: "${domainCategory}"**`);
            dv.paragraph(`Search criteria: type="hub", domain-category="${domainCategory}", subject="${subject}"`);
        }
        
        // Look for Hub pages with matching domain-category (string or array) and subject
        const hubs = dv.pages()
            .where(p => {
                if (p.type !== "hub") return false;
                if (p.subject !== subject) return false;
                if (!p["domain-category"]) return false;
                const hubCats = this.normalizeValues(p["domain-category"]);
                return hubCats.includes(domainCategory);
            });
        
        if (debug) {
            dv.paragraph(`Found ${hubs.length} matching Hub(s)`);
            if (hubs.length > 1) {
                dv.paragraph(`⚠️ Multiple Hubs found - using first: ${hubs.map(h => h.file.name).join(', ')}`);
            }
        }
        
        if (hubs.length > 0) {
            const hub = hubs[0]; // Take first if multiple
            
            // Check for explicit canonical-name field first
            if (hub["canonical-name"]) {
                if (debug) {
                    dv.paragraph(`✅ Found explicit canonical-name: "${hub["canonical-name"]}" in Hub: ${hub.file.name}`);
                }
                return hub["canonical-name"];
            } else {
                // Fall back to file name (without .md extension)
                const fileName = hub.file.name;
                if (debug) {
                    dv.paragraph(`✅ No canonical-name field found, using Hub name: "${fileName}"`);
                }
                return fileName;
            }
        } else {
            if (debug) {
                dv.paragraph(`❌ No Hub found for domain-category: "${domainCategory}"`);
                dv.paragraph(`**🔧 To fix this:** Create a Hub page with this frontmatter:`);
                dv.paragraph("```yaml");
                dv.paragraph("---");
                dv.paragraph("type: hub");
                dv.paragraph("domain: concepts");
                dv.paragraph(`domain-category: ${domainCategory}`);
                dv.paragraph(`subject: ${subject}`);
                dv.paragraph("canonical-name: [Your Display Name]  # optional - will use file name if omitted");
                dv.paragraph("status: active");
                dv.paragraph("tags: notes-active");
                dv.paragraph(`summary: Hub for organizing ${domainCategory} items`);
                dv.paragraph("---");
                dv.paragraph("```");
            }
            return null;
        }
    }

    /**
     * Gets a display-friendly name for a domain category with graceful fallback
     * First tries to get canonical name from hub, falls back to formatted kebab-case
     * 
     * @param {Object} params - Parameters object
     * @param {Object} params.dv - The dataview API object
     * @param {string} params.domainCategory - The domain category to get display name for
     * @param {string} params.subject - The subject to filter hubs by
     * @param {boolean} [params.debug=false] - Show debug output
     * @returns {string} The display name (never null - always returns something usable)
     */
    getDisplayNameForCategory({ dv, domainCategory, subject, debug = false }) {
        if (debug) {
            dv.paragraph(`**📝 Getting display name for domain-category: "${domainCategory}"**`);
        }
        
        // Try to get canonical name from hub
        const canonicalName = this.getCanonicalNameForCategory({ dv, domainCategory, subject, debug });
        
        if (canonicalName) {
            if (debug) {
                dv.paragraph(`✅ Using canonical name: "${canonicalName}"`);
            }
            return canonicalName;
        } else {
            // Fall back to kebab-case
            if (debug) {
                dv.paragraph(`⚙️ No Hub found, using fallback: "${domainCategory}"`);
                dv.paragraph(`💡 Tip: Create a Hub page to customize this display name. Optionally, add a "canonical-name" field to the Hub page to override the page name.`);
            }
            const titleCase = String(domainCategory)
                .replace(/[-_]+/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase());
            return titleCase;
        }
    }

    /**
     * Gets a relation label (incoming/outgoing) for a given domain category from its Hub frontmatter.
     * Falls back to the category display name if no specific relation label is defined.
     *
     * Expected Hub frontmatter keys:
     * - relation-incoming: e.g., "Directed by", "Starring"
     * - relation-outgoing: e.g., "Directed", "Acted in"
     *
     * @param {Object} params - Parameters object
     * @param {Object} params.dv - The Dataview API object
     * @param {string} params.domainCategory - The domain category to resolve (e.g., "director", "actor")
     * @param {string} params.subject - Subject namespace to filter the Hub
     * @param {('incoming'|'outgoing')} [params.direction='outgoing'] - Relation direction
     * @param {boolean} [params.debug=false] - Enable debug output
     * @returns {string} The relation label or a sensible fallback
     */
    getRelationLabel({ dv, domainCategory, subject, direction = 'outgoing', debug = false }) {
        const directionKey = direction === 'incoming' ? 'relation-incoming' : 'relation-outgoing';

        if (debug) {
            dv.paragraph(`**🧭 Resolving relation label** for category: "${domainCategory}", subject: "${subject}", direction: "${direction}"`);
        }

        // Look for Hub pages with matching domain-category (string or array) and subject
        const hubs = dv.pages()
            .where(p => {
                if (p.type !== "hub") return false;
                if (p.subject !== subject) return false;
                if (!p["domain-category"]) return false;
                const hubCats = this.normalizeValues(p["domain-category"]);
                return hubCats.includes(domainCategory);
            });

        if (hubs.length > 0) {
            const hub = hubs[0];
            const label = hub[directionKey];

            if (typeof label === 'string' && label.trim().length > 0) {
                if (debug) {
                    dv.paragraph(`✅ Using hub frontmatter label (${directionKey}): "${label}" from Hub: ${hub.file.name}`);
                }
                return label.trim();
            }

            if (debug) {
                dv.paragraph(`ℹ️ No "${directionKey}" on Hub: ${hub.file.name}. Falling back to display name for category.`);
            }
        } else if (debug) {
            dv.paragraph(`❌ No Hub found for domain-category: "${domainCategory}" and subject: "${subject}". Using fallback.`);
        }

        // Fallback to the category display name (canonical name or formatted key)
        return this.getDisplayNameForCategory({ dv, domainCategory, subject, debug });
    }

    /**
     * Generates a table view based on the current page type and domain-category
     * Originally expected frontmatter:
     * - domain-category (string or array) - REQUIRED
     * - type (to check if it's a "Hub") 
     * - domain (to filter related pages)
     * 
     * For hub pages: Shows all Groups (Concept/Core Pattern) with matching domain-category
     * For non-hub pages: Shows related Groups (Concept/Core Pattern) and link to parent Hub
     * 
     * @param {Object} params - The parameters object
     * @param {Object} params.dv - The dataview API object
     * @param {number} [params.headerLevel=2] - The level for the header (1-6)
     * @param {boolean} [params.debug=false] - Show detailed debug output
     */
    generateViewTable({ dv, headerLevel = 2, debug = false }) {
        try {
            const currentPage = dv.current();
            
            // Get config validation for the current page's subject
            const config = this.getConfigForSubject({ 
                dv, 
                subject: currentPage.subject, 
                debug: debug 
            });
            
            if (debug) {
                dv.paragraph(`**🔧 Config Lookup for generateViewTable: "${config.debugInfo.subject}"**`);
                if (config.debugInfo.hasConfig) {
                    dv.paragraph(`✅ Found Config: ${config.debugInfo.configPageName}`);
                    dv.paragraph(`  • valid_filters: [${config.debugInfo.validFilters.join(', ')}]`);
                    dv.paragraph(`  • valid_subjects: [${config.debugInfo.validSubjects.join(', ')}]`);
                } else {
                    dv.paragraph(`❌ No Config page found for subject "${config.debugInfo.subject}"`);
                    dv.paragraph(`  • Using default valid_subjects: [${config.debugInfo.validSubjects.join(', ')}]`);
                }
                dv.paragraph("---");
                
                dv.header(3, "🐛 DEBUG: ConceptManager.generateViewTable()");
                dv.paragraph(`**Current file:** ${currentPage.file.path}`);
                
                // ANNOUNCE WHAT WE'RE TRYING TO DO
                dv.paragraph(`**🎯 WHAT THIS METHOD DOES:**`);
                if (currentPage.type === "hub") {
                    dv.paragraph(`  • This is a HUB page → Show all related Group (Concept/Core Pattern) pages that belong to this hub`);
                    dv.paragraph(`  • WHY IS THIS A HUB PAGE? → Has type: "hub"`);
                    dv.paragraph(`  • AS OPPOSED TO WHAT? → Pages without type: "hub" are Group (Concept/Core Pattern) pages`);
                    dv.paragraph(`  • We'll list all pages with matching domain-category (excluding other hubs)`);
                } else {
                    dv.paragraph(`  • This is a Group (Concept/Core Pattern) page → Find ALL hubs this page belongs to`);
                    dv.paragraph(`  • WHY IS THIS A Group (Concept/Core Pattern) PAGE? → Does NOT have type: "hub"`);
                    dv.paragraph(`  • AS OPPOSED TO WHAT? → Pages with type: "hub" are Hub pages`);
                    dv.paragraph(`  • We'll show links to ALL parent Hubs (can belong to multiple Hubs)`);
                    dv.paragraph(`  • We'll show other related pages in ALL matching Hubs`);
                    dv.paragraph(`  • For "${currentPage.file.name}" (domain-category: ${currentPage["domain-category"]}) → Find ALL Hubs with matching domain-category`);
                }
                
                dv.paragraph(`**Parameters:**`);
                dv.paragraph(`  • headerLevel: ${headerLevel}`);
                dv.paragraph(`**Current frontmatter values:**`);
                Object.keys(currentPage).forEach(key => {
                    if (typeof currentPage[key] !== 'function' && key !== 'file') {
                        dv.paragraph(`  • ${key}: ${Array.isArray(currentPage[key]) ? currentPage[key].join(', ') : currentPage[key]}`);
                    }
                });
                dv.paragraph("---");
            }
            
            // Check if currentPage exists
            if (!currentPage) {
                throw new Error("Could not access the current page metadata");
            }
            
            // Check if we have the required fields
            if (!currentPage["domain-category"]) {
                if (debug) {
                    dv.paragraph(`❌ **Missing required metadata:** No domain-category found in frontmatter`);
                    dv.paragraph(`**Available frontmatter fields:** ${Object.keys(currentPage).filter(k => k !== 'file' && typeof currentPage[k] !== 'function').join(', ')}`);
                }
                throw new Error("Missing required metadata: No domain-category found in frontmatter");
            }
            
            // Get and normalize the domain category key
            const domainCategoryKeys = this.normalizeValues(currentPage["domain-category"]);
            
            if (debug) {
                dv.paragraph(`**Step 1: Processing domain-category**`);
                dv.paragraph(`Raw domain-category: ${currentPage["domain-category"]}`);
                dv.paragraph(`Normalized domain-category: [${domainCategoryKeys.join(', ')}]`);
                dv.paragraph(`Current page type: ${currentPage.type || 'undefined'}`);
                dv.paragraph("---");
            }
            
            // Different behavior based on page type
            if (currentPage.type === "hub") {
                if (debug) {
                    dv.paragraph(`**Step 2: Processing as Hub page**`);
                    dv.paragraph(`Looking for pages that match domain-category AND are not Hubs...`);
                }
                
                // This is a Hub page - show all related Groups (Concept/Core Pattern)
                
                // Adaptive header: "<Category Name> in this Hub" (e.g., "Movies in this Hub")
                if (headerLevel > 0) {
                    const hubCategory = (domainCategoryKeys && domainCategoryKeys.length > 0) ? domainCategoryKeys[0] : null;
                    const hubCategoryName = hubCategory ? this.getDisplayNameForCategory({
                        dv,
                        domainCategory: hubCategory,
                        subject: currentPage.subject,
                        debug: false
                    }) : "Items";
                    dv.header(headerLevel, `${hubCategoryName} in this Hub`);
                }

                // Get related pages - match any page that has at least one matching domain category
                const validSubjectsSet = new Set(config.validSubjects || []);
                const validDomainsSet = new Set(config.validDomains || []);
                const allPages = dv.pages()
                    .where(p => {
                        if (!p["domain-category"]) return false;
                        // Early subject/domain filters
                        if (validSubjectsSet.size > 0 && !validSubjectsSet.has(p.subject)) return false;
                        if (validDomainsSet.size > 0 && !validDomainsSet.has(p.domain)) return false;
                        const pageCats = this.normalizeValues(p["domain-category"]);
                        return pageCats.some(cat => domainCategoryKeys.includes(cat)) && 
                            p.type !== "hub"; // Exclude hub pages
                    });
                    
                // Apply subject validation
                const pageFiltering = this.filterPagesByValidSubjects({
                    pages: Array.from(allPages),
                    validSubjects: config.validSubjects,
                    currentPagePath: currentPage.file.path,
                    debug: debug
                });
                
                // Apply domain validation
                const domainFiltering = this.filterPagesByValidDomains({
                    pages: pageFiltering.filtered,
                    validDomains: config.validDomains,
                    currentPagePath: currentPage.file.path,
                    debug: debug
                });
                
                const pages = domainFiltering.filtered;
                
                if (debug) {
                    dv.paragraph(`**Subject Filtering for Hub Pages:**`);
                    dv.paragraph(`  • Before subject filtering: ${pageFiltering.debugInfo.inputCount} pages`);
                    dv.paragraph(`  • After subject filtering: ${pageFiltering.debugInfo.filteredCount} pages`);
                    dv.paragraph(`  • Valid subjects: [${pageFiltering.debugInfo.validSubjects.join(', ')}]`);
                    
                    dv.paragraph(`**Domain Filtering for Hub Pages:**`);
                    dv.paragraph(`  • Before domain filtering: ${domainFiltering.debugInfo.inputCount} pages`);
                    dv.paragraph(`  • After domain filtering: ${domainFiltering.debugInfo.filteredCount} pages`);
                    dv.paragraph(`  • Valid domains: [${domainFiltering.debugInfo.validDomains.join(', ')}]`);
                    if (domainFiltering.debugInfo.noFiltering) {
                        dv.paragraph(`  • ✅ No domain filtering applied (no valid_domains configured)`);
                    }
                }

                if (debug) {
                    dv.paragraph(`Found ${pages.length} non-Hub pages with matching domain-category`);
                    if (pages.length > 0) {
                        dv.paragraph("**Matching pages:**");
                        pages.forEach(p => {
                            const pageCats = this.normalizeValues(p["domain-category"]);
                            dv.paragraph(`  • ${p.file.name}: domain-category=[${pageCats.join(', ')}]`);
                        });
                    }
                    dv.paragraph("---");
                }

                if (pages.length > 0) {
                    // Simple fixed table: Name, Type, Domain, [Subject], Summary
                    const pagesArray = Array.from(pages);

                    // Determine if Subject column is needed (multiple subjects present)
                    const uniqueSubjects = Array.from(new Set(pagesArray.map(p => p.subject).filter(Boolean)));
                    const includeSubjectColumn = uniqueSubjects.length > 1;

                    // Sort by name for consistency
                    const sortedPages = [...pagesArray].sort((a, b) => a.file.name.localeCompare(b.file.name));

                    // Build columns: Name, Summary, Subject (optional), Type, Domain (requested order)
                    const columns = ["Name", "Summary"]; 
                    columns.push("Type", "Domain");
                    if (includeSubjectColumn) columns.push("Subject");

                    // Build rows
                    const rows = sortedPages.map(p => {
                        const row = [p.file.link, p.summary || ""];
                        row.push(p.type || "", p.domain || "");
                        if (includeSubjectColumn) row.push(p.subject || "");
                        return row; 
                    });

                    dv.table(columns, rows);
                } else {
                    dv.paragraph("*No related Groups (Concepts/Core Patterns) found with matching domain categories. Please ensure pages have the appropriate frontmatter.*");
                }

            } else {
                if (debug) {
                    dv.paragraph(`**Step 2: Processing as REGULAR page**`);
                    dv.paragraph(`Looking for ALL Hub pages with matching domain-category...`);
                }
                
                // This is a regular page - show related Groups (Concepts/Core Patterns) and link to ALL matching Hubs
                
                // Find ALL Hub pages for this domain-category
                const validSubjectsSet2 = new Set(config.validSubjects || []);
                const validDomainsSet2 = new Set(config.validDomains || []);
                const hubs = dv.pages()
                    .where(p => {
                        if (p.type !== "hub") return false;
                        if (!p["domain-category"]) return false;
                        // Early subject/domain filters
                        if (validSubjectsSet2.size > 0 && !validSubjectsSet2.has(p.subject)) return false;
                        if (validDomainsSet2.size > 0 && !validDomainsSet2.has(p.domain)) return false;
                        const hubCats = this.normalizeValues(p["domain-category"]);
                        return hubCats.some(cat => domainCategoryKeys.includes(cat));
                    });
                    
                if (debug) {
                    dv.paragraph(`**Step 2a: EXACT SEARCH CRITERIA for Hub pages**`);
                    dv.paragraph(`We need Hub pages with these requirements:`);
                    dv.paragraph(`  1. type: "hub"`);
                    dv.paragraph(`  2. domain-category: one of [${domainCategoryKeys.join(', ')}]`);
                    dv.paragraph(`**Current page domain-category:** [${domainCategoryKeys.join(', ')}]`);
                    
                    if (hubs.length > 0) {
                        dv.paragraph(`✅ **FOUND ${hubs.length} MATCHING HUB(S):**`);
                        hubs.forEach(hub => {
                            const hubCats = this.normalizeValues(hub["domain-category"]);
                            dv.paragraph(`  • ${hub.file.name}:`);
                            dv.paragraph(`    - type: ${hub.type}`);
                            dv.paragraph(`    - domain: ${hub.domain}`);
                            dv.paragraph(`    - domain-category: [${hubCats.join(', ')}]`);
                            dv.paragraph(`    - file path: ${hub.file.path}`);
                        });
                    } else {
                        dv.paragraph(`❌ **NO MATCHING HUBS FOUND**`);
                        dv.paragraph(`**MISSING HUB REQUIREMENTS:** Create a page with this EXACT frontmatter:`);
                        dv.paragraph("```yaml");
                        dv.paragraph("type: hub");
                        dv.paragraph("domain: [your-domain] # can be any domain");
                        dv.paragraph(`domain-category: ${domainCategoryKeys[0]} # or [${domainCategoryKeys.join(', ')}]`);
                        dv.paragraph("```");
                        
                        // Show debugging info
                        const allHubs = dv.pages().where(p => p.type === "hub");
                        dv.paragraph(`**DEBUGGING: Hub search results:**`);
                        dv.paragraph(`  • Total pages with type="hub": ${allHubs.length}`);
                        dv.paragraph(`  • Hubs with matching domain-category: 0`);
                 
                        // TMI: Uncomment to see all hubs
                        // if (allHubs.length > 0) {
                        //     dv.paragraph("**Available hubs (none match):**");
                        //     allHubs.forEach(h => {
                        //         const hCats = h["domain-category"] ? this.normalizeValues(h["domain-category"]) : ['none'];
                        //         dv.paragraph(`  • ${h.file.name}: domain-category=[${hCats.join(', ')}], domain=${h.domain}`);
                        //     });
                        // }
                    }
                    dv.paragraph("---");
                }
                    
                // Show links to all hubs if found and headerLevel is greater than 0
                if (headerLevel > 0 && hubs.length > 0) {
                    dv.header(headerLevel, `Related Hubs`);
                }
                
                if (hubs.length > 0) {
                    if (hubs.length === 1) {
                        dv.paragraph(`This page belongs to the [[${hubs[0].file.path}|${hubs[0].file.name}]] Hub.`);
                    } else {
                        dv.paragraph(`This page belongs to ${hubs.length} Hubs:`);
                        hubs.forEach(hub => {
                            dv.paragraph(`• [[${hub.file.path}|${hub.file.name}]]`);
                        });
                    }
                    
                    // Find other Groups (Concepts/Core Patterns) in ALL matching Hubs
                    const validSubjectsSet3 = new Set(config.validSubjects || []);
                    const validDomainsSet3 = new Set(config.validDomains || []);
                    const allRelatedGroups = dv.pages()
                        .where(p => {
                            if (!p["domain-category"] || p.file.path === currentPage.file.path || p.type === "hub") return false;
                            // Early subject/domain filters
                            if (validSubjectsSet3.size > 0 && !validSubjectsSet3.has(p.subject)) return false;
                            if (validDomainsSet3.size > 0 && !validDomainsSet3.has(p.domain)) return false;
                            // Check if page matches any of the hubs
                            const pageCats = this.normalizeValues(p["domain-category"]);
                            return hubs.some(hub => {
                                const hubCats = this.normalizeValues(hub["domain-category"]);
                                return pageCats.some(cat => hubCats.includes(cat));
                            });
                        });
                        
                    // Apply subject validation
                    const groupFiltering = this.filterPagesByValidSubjects({
                        pages: Array.from(allRelatedGroups),
                        validSubjects: config.validSubjects,
                        currentPagePath: currentPage.file.path,
                        debug: debug
                    });
                    
                    // Apply domain validation
                    const domainFiltering = this.filterPagesByValidDomains({
                        pages: groupFiltering.filtered,
                        validDomains: config.validDomains,
                        currentPagePath: currentPage.file.path,
                        debug: debug
                    });
                    
                    const relatedGroups = domainFiltering.filtered.sort(p => p.file.name);
                    
                    if (debug) {
                        dv.paragraph(`**Subject Filtering for Related Groups:**`);
                        dv.paragraph(`  • Before subject filtering: ${groupFiltering.debugInfo.inputCount} groups`);
                        dv.paragraph(`  • After subject filtering: ${groupFiltering.debugInfo.filteredCount} groups`);
                        dv.paragraph(`  • Valid subjects: [${groupFiltering.debugInfo.validSubjects.join(', ')}]`);
                        
                        dv.paragraph(`**Domain Filtering for Related Groups:**`);
                        dv.paragraph(`  • Before domain filtering: ${domainFiltering.debugInfo.inputCount} groups`);
                        dv.paragraph(`  • After domain filtering: ${domainFiltering.debugInfo.filteredCount} groups`);
                        dv.paragraph(`  • Valid domains: [${domainFiltering.debugInfo.validDomains.join(', ')}]`);
                        if (domainFiltering.debugInfo.noFiltering) {
                            dv.paragraph(`  • ✅ No domain filtering applied (no valid_domains configured)`);
                        }
                    }
                        
                    if (debug) {
                        dv.paragraph(`**Step 3: Finding related Groups (Concepts/Core Patterns) in ALL matching Hubs**`);
                        dv.paragraph(`Searching across ${hubs.length} Hub(s) for related Groups (Concepts/Core Patterns)...`);
                        hubs.forEach(hub => {
                            const hubCats = this.normalizeValues(hub["domain-category"]);
                            dv.paragraph(`  • Hub: ${hub.file.name}, domain-category=[${hubCats.join(', ')}]`);
                        });
                        dv.paragraph(`Found ${relatedGroups.length} related Groups (Concepts/Core Patterns) (excluding current page and Hubs)`);
                        if (relatedGroups.length > 0) {
                            dv.paragraph("**Related Groups (Concepts/Core Patterns):**");
                            relatedGroups.forEach(g => {
                                const gCats = this.normalizeValues(g["domain-category"]);
                                dv.paragraph(`  • ${g.file.name}: domain-category=[${gCats.join(', ')}]`);
                            });
                        }
                        dv.paragraph("---");
                    }
                        
                    if (relatedGroups.length > 0) {
                        if (headerLevel > 0) {
                            const hubText = hubs.length === 1 ? "This Hub" : "These Hubs";
                            dv.header(headerLevel + 1, `Peers in ${hubText}`);
                        }
                        
                        // Get the first domain category to use as key column
                        const categoryKey = domainCategoryKeys.length > 0 ? domainCategoryKeys[0] : null;
                        
                        // Check if any related group has a value for this category key
                        const anyGroupHasKeyValue = categoryKey && Array.from(relatedGroups).some(p => p[categoryKey]);
                            
                            // Include Subject column only if multiple subjects are present
                            const uniqueSubjects = Array.from(new Set(Array.from(relatedGroups).map(p => p.subject).filter(Boolean)));
                            const includeSubjectColumn = uniqueSubjects.length > 1;
                            // Include Hubs column only when listing across multiple hubs
                            const includeHubsColumn = hubs.length > 1;
                        
                        if (categoryKey && anyGroupHasKeyValue) {
                            // Create an array from the pages collection for sorting
                            const pagesArray = Array.from(relatedGroups);
                            
                            // Sort the array by the key value
                            pagesArray.sort((a, b) => {
                                const aValue = a[categoryKey] || "";
                                const bValue = b[categoryKey] || "";
                                return aValue.localeCompare(bValue);
                            });
                            
                                // Columns: Key, Name, Summary, Hubs? Type, Domain, Subject?
                                const columns = ["Key", "Name", "Summary"]; 
                                if (includeHubsColumn) columns.push("Hubs");
                                columns.push("Type", "Domain");
                                if (includeSubjectColumn) columns.push("Subject");

                                const rows = pagesArray.map(p => {
                                    const row = [
                                        p[categoryKey] || "",
                                        p.file.link,
                                        p.summary || "",
                                    ];
                                    if (includeHubsColumn) {
                                        // Determine which hubs this page relates to
                                        const pageCats = this.normalizeValues(p["domain-category"] || []);
                                        const matchingHubs = Array.from(hubs).filter(h => {
                                            const hubCats = this.normalizeValues(h["domain-category"] || []);
                                            return pageCats.some(cat => hubCats.includes(cat));
                                        });
                                        const hubsCell = matchingHubs
                                            .map(h => dv.fileLink(h.file.path, false, h.file.name))
                                            .join(', ');
                                        row.push(hubsCell);
                                    }
                                    row.push(p.type || "", p.domain || "");
                                    if (includeSubjectColumn) row.push(p.subject || "");
  

                                    // row.push(p.summary);
                                    return row;
                                });

                                dv.table(columns, rows);
                        } else {
                            // Fallback to original behavior if no domain categories or no groups have values for the key
                            const pagesArray = Array.from(relatedGroups);
                            pagesArray.sort((a, b) => a.file.name.localeCompare(b.file.name));
                            
                                // Columns: Name, Summary, Hubs?, Type, Domain, Subject?
                                const columns = ["Name", "Summary"]; 
                                if (includeHubsColumn) columns.push("Hubs");
                                columns.push("Type", "Domain");
                                if (includeSubjectColumn) columns.push("Subject");

                                const rows = pagesArray.map(p => {
                                    const row = [
                                        p.file.link,
                                        p.summary || "",
                                    ];
                                    if (includeHubsColumn) {
                                        const pageCats = this.normalizeValues(p["domain-category"] || []);
                                        const matchingHubs = Array.from(hubs).filter(h => {
                                            const hubCats = this.normalizeValues(h["domain-category"] || []);
                                            return pageCats.some(cat => hubCats.includes(cat));
                                        });
                                        const hubsCell = matchingHubs
                                            .map(h => dv.fileLink(h.file.path, false, h.file.name))
                                            .join(', ');
                                        row.push(hubsCell);
                                    }
                                    row.push(p.type || "", p.domain || "");
                                    if (includeSubjectColumn) row.push(p.subject || "");
                                    // row.push(p.summary);
                                    return row;
                                });

                                dv.table(columns, rows);
                        }
                    } 
                } else {
                    dv.paragraph("*No Hub pages found for this Domain Category. Please create a Hub page with matching domain-category.*");
                }
            }
        } catch (error) {
            dv.header(headerLevel, "⚠️ Error Loading Content");
            dv.paragraph("**Something went wrong while trying to display content.**");
            dv.paragraph(`Error: ${error.message}`);
            
            if (debug) {
                dv.paragraph("**Debug Info:**");
                dv.paragraph(`Current page available fields: ${Object.keys(dv.current()).filter(k => k !== 'file' && typeof dv.current()[k] !== 'function').join(', ')}`);
            }
            
            // Check for specific error conditions and provide helpful messages
            if (error.message.includes("domain-category")) {
                dv.paragraph("**Possible solutions:**");
                dv.list([
                    "Ensure this file has proper frontmatter with 'domain-category' defined",
                    "**Try restarting Obsidian** - changes to frontmatter often require a restart to be recognized",
                    "Check that your pages exist and have the correct metadata"
                ]);
            } else if (error.message.includes("undefined") || error.message.includes("access")) {
                dv.paragraph("**Possible solutions:**");
                dv.list([
                    "**Try restarting Obsidian** - this often resolves indexing issues",
                    "Ensure all required files exist with proper metadata",
                    "Check for syntax errors in frontmatter (must be valid YAML)"
                ]);
            } else {
                dv.paragraph("**Possible solutions:**");
                dv.list([
                    "**Try restarting Obsidian** - this resolves most metadata-related issues",
                    "Ensure all required plugin dependencies are installed and enabled",
                    "Check console logs for more details (Ctrl+Shift+I or Cmd+Option+I)"
                ]);
            }
        }
    }

    /**
     * Generates a list of items that belong to a specific group
     * Originally expected frontmatter:
     * - domain-category (string or array) - to determine what type of group this is
     * - Uses current page's file.name as the group value to search for
     * 
     * For example: On a "1995" year page, shows all movies with group-year: "1995"
     * 
     * @param {Object} params - The parameters object
     * @param {Object} params.dv - The dataview API object
     * @param {string|Array} [params.groupType] - Optional: The group type(s) to filter by (defaults to current page's domain-category)
     * @param {number} [params.headerLevel=2] - The level for the header (1-6)
     * @param {string} [params.headerText] - Custom header text (defaults to current page name)
     * @param {boolean} [params.debug=false] - Show detailed debug output
     */
    generateGroupItemsList({ dv, groupType, headerLevel = 2, headerText, debug = false }) {
        try {
            const currentPage = dv.current();
            
            // Get config validation for the current page's subject
            const config = this.getConfigForSubject({ 
                dv, 
                subject: currentPage.subject, 
                debug: debug 
            });
            
            if (debug) {
                dv.paragraph(`**🔧 Config Lookup for generateGroupItemsList: "${config.debugInfo.subject}"**`);
                if (config.debugInfo.hasConfig) {
                    dv.paragraph(`✅ Found Config: ${config.debugInfo.configPageName}`);
                    dv.paragraph(`  • valid_filters: [${config.debugInfo.validFilters.join(', ')}]`);
                    dv.paragraph(`  • valid_subjects: [${config.debugInfo.validSubjects.join(', ')}]`);
                } else {
                    dv.paragraph(`❌ No Config page found for subject "${config.debugInfo.subject}"`);
                    dv.paragraph(`  • Using default valid_subjects: [${config.debugInfo.validSubjects.join(', ')}]`);
                }
                dv.paragraph("---");
                
                dv.header(3, "🐛 DEBUG: ConceptManager.generateGroupItemsList()");
                dv.paragraph(`**Current file:** ${currentPage.file.path}`);
                
                // ANNOUNCE WHAT WE'RE TRYING TO DO
                dv.paragraph(`**🎯 WHAT THIS METHOD DOES:**`);
                dv.paragraph(`  • This is a GROUP (CONCEPT/CORE PATTERN) page → Show all items that belong to this Group`);
                dv.paragraph(`  • WHY IS THIS A GROUP (CONCEPT/CORE PATTERN) PAGE? → Has domain-category field`);
                dv.paragraph(`  • AS OPPOSED TO WHAT? → Pages without domain-category are NOT Group (Concept/Core Pattern) pages`);
                dv.paragraph(`  • Example: If this is "1995" year page → Show all movies with group-year: "1995"`);
                dv.paragraph(`  • Example: If this is "Tarantino" director page → Show all movies with group-director: "Tarantino"`);
                dv.paragraph(`  • Current domain-category: "${currentPage["domain-category"]}"`);
                dv.paragraph(`  • Current page: "${currentPage.file.name}" → Search for items with this as their group-${currentPage["domain-category"]} value (CHECK!!???)`);
                dv.paragraph(`**Parameters:**`);
                dv.paragraph(`  • groupType: ${groupType || 'auto-detect from domain-category'}`);
                dv.paragraph(`  • headerLevel: ${headerLevel}`);
                dv.paragraph(`  • headerText: ${headerText || 'auto-generate'}`);
                
                dv.paragraph(`**Current frontmatter values:**`);
                Object.keys(currentPage).forEach(key => {
                    if (typeof currentPage[key] !== 'function' && key !== 'file') {
                        dv.paragraph(`  • ${key}: ${Array.isArray(currentPage[key]) ? currentPage[key].join(', ') : currentPage[key]}`);
                    }
                });
                dv.paragraph("---");
            }
            
            // Get the group types from the current page's domain-category if not provided
            let groupTypes = groupType ? 
                (Array.isArray(groupType) ? groupType : [groupType]) : 
                this.normalizeValues(currentPage["domain-category"]);
                
            // Validate group types against config valid filters
            if (config.validFilters.length > 0) {
                const validatedGroupTypes = groupTypes.filter(type => {
                    // Compare domain-category value directly against clean validFilters
                    const isValid = config.validFilters.includes(type);
                    if (debug && !isValid) {
                        dv.paragraph(`⚠️ Ignoring invalid group type: "${type}" (not in config valid_filters: [${config.validFilters.join(', ')}])`);
                    }
                    return isValid;
                });
                
                if (debug) {
                    dv.paragraph(`**Group Type Validation:**`);
                    dv.paragraph(`  • Original types: [${groupTypes.join(', ')}]`);
                    dv.paragraph(`  • Valid types after filtering: [${validatedGroupTypes.join(', ')}]`);
                    dv.paragraph(`  • Config valid_filters: [${config.validFilters.join(', ')}]`);
                }
                
                groupTypes = validatedGroupTypes;
            }
            
            if (debug) {
                dv.paragraph(`**Step 1: Determining Group (Concept/Core Pattern) types**`);
                dv.paragraph(`Raw domain-category: ${currentPage["domain-category"]}`);
                dv.paragraph(`Resolved Group (Concept/Core Pattern) types: [${groupTypes.join(', ')}]`);
                if (groupType) {
                    dv.paragraph(`Override provided: ${groupType} (ignoring domain-category)`);
                }
                dv.paragraph("---");
            }
            
            if (!groupTypes || groupTypes.length === 0) {
                if (debug) {
                    dv.paragraph(`❌ **ERROR:** No Group (Concept/Core Pattern) types available`);
                    dv.paragraph(`**Available frontmatter fields:** ${Object.keys(currentPage).filter(k => k !== 'file' && typeof currentPage[k] !== 'function').join(', ')}`);
                }
                throw new Error("No Group (Concept/Core Pattern) type specified and couldn't determine from page's domain-category");
            }
            
            // The group value is the current page's name
            const groupValue = currentPage.file.name;
            
            if (debug) {
                dv.paragraph(`**Step 2: Group (Concept/Core Pattern) search setup**`);
                dv.paragraph(`Group (Concept/Core Pattern) value to search for: "${groupValue}"`);
                dv.paragraph(`Will search for pages with these fields matching "${groupValue}":`);
                groupTypes.forEach(type => {
                    dv.paragraph(`  • group-${type}: "${groupValue}"`);
                });
                dv.paragraph("---");
            }
            
            // Display a single wrapper header before processing all group types,
            // with a dynamic count of total connections across all relation types.
            // Only show if there is at least one connection.
            if (headerLevel > 0) {
                let totalConnections = 0;
                groupTypes.forEach(type => {
                    const groupFieldName = `group-${type}`;
                    const validSubjectsSet = new Set(config.validSubjects || []);
                    const validDomainsSet = new Set(config.validDomains || []);
                    const allMatchingPages = dv.pages()
                        .where(p => {
                            if (!p[groupFieldName]) return false;
                            // Early subject/domain filters
                            if (validSubjectsSet.size > 0 && !validSubjectsSet.has(p.subject)) return false;
                            if (validDomainsSet.size > 0 && !validDomainsSet.has(p.domain)) return false;
                            const pageValues = this.normalizeValues(p[groupFieldName]);
                            return pageValues.some(val => 
                                String(val).toLowerCase() === String(groupValue).toLowerCase()
                            );
                        });

                    const pageMatching = this.filterPagesByValidSubjects({
                        pages: Array.from(allMatchingPages),
                        validSubjects: config.validSubjects,
                        currentPagePath: currentPage.file.path,
                        debug: false
                    });

                    const domainMatching = this.filterPagesByValidDomains({
                        pages: pageMatching.filtered,
                        validDomains: config.validDomains,
                        currentPagePath: currentPage.file.path,
                        debug: false
                    });

                    totalConnections += domainMatching.filtered.length;
                });

                if (totalConnections > 0) {
                    const baseText = (headerText || 'Key Connections').replace(/\s*\(.*\)\s*$/, '');
                    dv.header(headerLevel, `${baseText} (${totalConnections})`);
                }
            }
            
            // Process each group type
            groupTypes.forEach((type, index) => {
                if (debug) {
                    dv.paragraph(`**Step 3.${index + 1}: Processing Group (Concept/Core Pattern) type "${type}"**`);
                }
                
                // // Default header text if not provided (previous noisy header removed by design)
                
                // Use the normalized group field name (e.g., "group-year" for year pages)
                const groupFieldName = `group-${type}`;
                
                if (debug) {
                    dv.paragraph(`**EXACT SEARCH CRITERIA:**`);
                    dv.paragraph(`  • Looking for pages with field: "${groupFieldName}"`);
                    dv.paragraph(`  • Field value must match: "${groupValue}" (case insensitive)`);
                }
                
                // Find all pages with matching group value
                const allMatchingPages = dv.pages()
                    .where(p => {
                        if (!p[groupFieldName]) return false;
                        
                        // Normalize the page's group value to handle string, number, or array
                        const pageValues = this.normalizeValues(p[groupFieldName]);
                        
                        // Check if the group value matches (case insensitive)
                        return pageValues.some(val => 
                            String(val).toLowerCase() === String(groupValue).toLowerCase()
                        );
                    });
                    
                // Apply subject validation
                const pageMatching = this.filterPagesByValidSubjects({
                    pages: Array.from(allMatchingPages),
                    validSubjects: config.validSubjects,
                    currentPagePath: currentPage.file.path,
                    debug: debug
                });
                
                // Apply domain validation
                const domainMatching = this.filterPagesByValidDomains({
                    pages: pageMatching.filtered,
                    validDomains: config.validDomains,
                    currentPagePath: currentPage.file.path,
                    debug: debug
                });
                
                const matchingPages = domainMatching.filtered.sort(p => p.file.name);
                
                if (debug) {
                    dv.paragraph(`**Subject Filtering for Group Items:**`);
                    dv.paragraph(`  • Before subject filtering: ${pageMatching.debugInfo.inputCount} pages`);
                    dv.paragraph(`  • After subject filtering: ${pageMatching.debugInfo.filteredCount} pages`);
                    dv.paragraph(`  • Valid subjects: [${pageMatching.debugInfo.validSubjects.join(', ')}]`);
                    
                    dv.paragraph(`**Domain Filtering for Group Items:**`);
                    dv.paragraph(`  • Before domain filtering: ${domainMatching.debugInfo.inputCount} pages`);
                    dv.paragraph(`  • After domain filtering: ${domainMatching.debugInfo.filteredCount} pages`);
                    dv.paragraph(`  • Valid domains: [${domainMatching.debugInfo.validDomains.join(', ')}]`);
                    if (domainMatching.debugInfo.noFiltering) {
                        dv.paragraph(`  • ✅ No domain filtering applied (no valid_domains configured)`);
                    }
                }
                
                if (debug) {
                    dv.paragraph(`**SEARCH RESULTS:**`);
                    dv.paragraph(`  • Found ${matchingPages.length} pages with ${groupFieldName}: "${groupValue}"`);
                    if (matchingPages.length > 0) {
                        dv.paragraph("**Matching pages:**");
                        matchingPages.forEach(page => {
                            const pageValues = this.normalizeValues(page[groupFieldName]);
                            dv.paragraph(`  • ${page.file.name}: ${groupFieldName}=[${pageValues.join(', ')}]`);
                        });
                    } else {
                        dv.paragraph(`**No pages found with ${groupFieldName} matching "${groupValue}"**`);
                        
                        // Show pages that have this field but different values (debugging)
                        const pagesWithField = dv.pages().where(p => p[groupFieldName]);
                        if (pagesWithField.length > 0) {
                            dv.paragraph(`**Pages that have ${groupFieldName} field but different values:**`);
                            const samplePages = Array.from(pagesWithField).slice(0, 5); // Show max 5 for debugging
                            samplePages.forEach(page => {
                                const pageValues = this.normalizeValues(page[groupFieldName]);
                                dv.paragraph(`  • ${page.file.name}: ${groupFieldName}=[${pageValues.join(', ')}]`);
                            });
                            if (pagesWithField.length > 5) {
                                dv.paragraph(`  • ... and ${pagesWithField.length - 5} more pages`);
                            }
                        } else {
                            dv.paragraph(`**No pages found with ${groupFieldName} field at all**`);
                            dv.paragraph(`**To fix this:** Add this frontmatter to relevant pages:`);
                            dv.paragraph("```yaml");
                            dv.paragraph(`${groupFieldName}: ${groupValue}`);
                            dv.paragraph("```");
                        }
                    }
                    dv.paragraph("---");
                }
                
                // Render per-category subheader one level deeper than wrapper header
                if (headerLevel > 0) {
                    const subHeaderLevel = Math.min(6, headerLevel + 1);
                    const relationLabel = this.getRelationLabel({
                        dv,
                        domainCategory: type,
                        subject: currentPage.subject,
                        direction: 'outgoing',
                        debug
                    });
                    dv.header(subHeaderLevel, relationLabel);
                }
                
                if (matchingPages.length > 0) {
                    // Create a list of matching pages with their summaries
                    const listItems = matchingPages.map(page => {
                        const title = page.file.name;
                        const summary = page.summary || "";
                        return `**[[${page.file.path}|${title}]]** - ${summary}`;
                    });
                    
                    dv.list(listItems);
                } else {
                    dv.paragraph(`*No items found with ${groupFieldName}: "${groupValue}". See debug info above for details.*`);
                }
            });
        } catch (error) {
            dv.header(headerLevel, "⚠️ Error Loading Content");
            dv.paragraph(`**Error:** ${error.message}`);
            if (debug) {
                dv.paragraph("**Debug Info:**");
                dv.paragraph(`Current page available fields: ${Object.keys(dv.current()).filter(k => k !== 'file' && typeof dv.current()[k] !== 'function').join(', ')}`);
            }
            dv.paragraph("Please check your parameters and try again.");
        }
    }

    /**
     * Helper: Discover relation types (group-* fields) for the current concept page
     * Returns clean relation type names with "group-" prefix removed and filtered by validFilters
     *
     * @param {Object} params
     * @param {Object} params.dv - The dataview API object
     * @param {Array<string>|null} params.relationTypes - Optional override list of clean relation types
     * @param {Array<string>} params.validFilters - The list of valid filter names from the config page
     * @param {boolean} [params.debug=false] - Enable debug logging
     * @returns {{ relationTypes: Array<string> }}
     */
    discoverRelationTypesForCurrentConcept({ dv, relationTypes, validFilters, debug = false }) {
            const currentPage = dv.current();

        if (relationTypes && relationTypes.length > 0) {
            if (debug) {
                dv.paragraph(`Using provided relationTypes override: [${relationTypes.join(', ')}]`);
            }
            return { relationTypes };
        }

            if (debug) {
                dv.paragraph(`**Step 2: Determining relation types (group-* fields)**`);
            }
            
                // Get all group-* fields from current page
                const allGroupFields = Object.keys(currentPage)
                    .filter(key => key.startsWith("group-"));
                    
                if (debug) {
                    dv.paragraph(`All group-* fields found: [${allGroupFields.join(', ')}]`);
                }
                
        // Convert to clean names and filter by valid filters from config
        const discovered = allGroupFields
            .map(key => key.replace('group-', ''))
            .filter(cleanName => validFilters.includes(cleanName));
                
                if (debug) {
            dv.paragraph(`Filtered by valid_filters: [${discovered.join(', ')}]`);
            if (discovered.length < allGroupFields.length) {
                const ignored = allGroupFields
                    .map(key => key.replace('group-', ''))
                    .filter(cleanName => !validFilters.includes(cleanName));
                dv.paragraph(`Ignored (not in valid_filters): [${ignored.join(', ')}]`);
            }
            dv.paragraph("---");
        }

        return { relationTypes: discovered };
    }

    /**
     * Helper: Render the Classifications section for the provided relation types
     * This corresponds to "Step 3!!!!" that displays organized sections per relation type
     *
     * @param {Object} params
     * @param {Object} params.dv - The dataview API object
     * @param {Array<string>} params.relationTypes - Clean relation type names (without "group-" prefix)
     * @param {number} [params.headerLevel=2] - Header level to use
     * @param {string} [params.subject] - Subject to use when resolving display names (defaults to current page's subject)
     * @param {boolean} [params.debug=false] - Enable debug logging
     */
    renderConceptClassifications({ dv, relationTypes, headerLevel = 2, subject, showTable = false, debug = false }) {
        const currentPage = dv.current();
        const currentSubject = subject || currentPage.subject;

        // Insert a single wrapper header "Categories" before any per-type sections
        const presentTypes = relationTypes.filter(type => {
            const currentValues = currentPage["group-" + type];
            const normalized = this.normalizeValues(currentValues || [])
                .map(v => String(v).trim())
                .filter(v => v.length > 0);
            return normalized.length > 0;
        });

        if (presentTypes.length > 0 && headerLevel > 0) {
            dv.header(headerLevel, `Classifications`);
        }

        // Collect rows for the aggregate table to be rendered AFTER the current output
        const classificationTableRows = [];
        // For bullet presentation above the table
        const bulletSections = [];
        const bulletSubjects = new Set();

            relationTypes.forEach((type, index) => {
                if (debug) {
                    dv.paragraph(`**Step 3.${index + 1}: Processing relation type "${type}"**`);
                }
                
                const hubCategory = type.replace('group-', '');
                
                if (debug) {
                    dv.paragraph(`Hub category to look for: "${hubCategory}"`);
                    dv.paragraph(`Looking for hub with: type="hub" AND domain-category="${hubCategory}"`);
                }
                
            const headerText = this.getDisplayNameForCategory({
                dv,
                domainCategory: hubCategory,
                subject: currentSubject,
                debug
            });
                    
                if (debug) {
                dv.paragraph(`🧭 Display name resolved for category "${hubCategory}": ${headerText}`);
                }

                const currentValues = currentPage["group-" + type] || [];
            const normalizedValues = this.normalizeValues(currentValues)
                .map(v => String(v).trim())
                .filter(v => v.length > 0);
                
                if (debug) {
                    dv.paragraph(`**🔍 HEADER DECISION POINT FOR "${type}":**`);
                    dv.paragraph(`  • Current page has values: ${currentValues.length > 0 ? 'YES' : 'NO'}`);
                    dv.paragraph(`  • Values: [${normalizedValues.join(', ')}]`);
                    dv.paragraph(`  • Header text would be: "${headerText}"`);
                }

                if (normalizedValues.length === 0 || (normalizedValues.length === 1 && normalizedValues[0] === '')) {
                    if (debug) {
                        dv.paragraph(`**❌ SKIPPING HEADER AND SECTION - No values found for "${type}"**`);
                        dv.paragraph("---");
                    }
                return;
                }

                if (debug) {
                dv.paragraph(`**✅ PRINTING SUBHEADER because we have ${normalizedValues.length} values to process**`);
                }
                
                
                if (debug) {
                    dv.paragraph(`**Values for ${type}: [${normalizedValues.join(', ')}]**`);
                    dv.paragraph(`Will create links for each value by searching for pages with file.name matching the value AND domain="concepts" or "patterns"`);
                }

            // STEP 1: Collect all matching data first (case-insensitive; supports aliases)
                const matchResults = normalizedValues.map(value => {
                const valueString = String(value).trim();
                const valueLower = valueString.toLowerCase();
                    const matchingPages = dv.pages()
                    .where(p => (
                        (p.domain === "concepts" || p.domain === "patterns") &&
                        (
                            (p.file && p.file.name && String(p.file.name).toLowerCase() === valueLower) ||
                            (Array.isArray(p.aliases) && p.aliases.some(a => String(a).toLowerCase() === valueLower))
                        )
                    ));
                return { value: valueString, matchingPages };
                });

                // STEP 2: Process results and handle multiple matches
                const processedResults = matchResults.map(({ value, matchingPages }) => {
                    if (matchingPages.length === 0) {
                        return { value, link: value, status: 'no_match' };
                    } else if (matchingPages.length === 1) {
                        const match = matchingPages[0];
                        return { 
                            value, 
                            link: `[[${match.file.path}|${value}]]`, 
                            status: 'single_match',
                            matchPath: match.file.path
                        };
                    } else {
                        const match = matchingPages[0];
                        return { 
                            value, 
                            link: `[[${match.file.path}|${value}]]`, 
                            status: 'multiple_matches',
                            count: matchingPages.length,
                            matchPath: match.file.path,
                            allMatches: matchingPages.map(p => p.file.name)
                        };
                    }
                });

                if (debug) {
                    const summary = processedResults.reduce((acc, result) => {
                        acc[result.status] = (acc[result.status] || 0) + 1;
                        return acc;
                    }, {});
                    dv.paragraph(`**${type} Link Summary:** ${summary.single_match || 0} exact matches, ${summary.multiple_matches || 0} ambiguous matches, ${summary.no_match || 0} unmatched`);
                    if (summary.multiple_matches > 0) {
                        dv.paragraph(`⚠️ Warning: ${summary.multiple_matches} values had multiple matches - using first match found`);
                        processedResults.filter(r => r.status === 'multiple_matches').forEach(result => {
                            dv.paragraph(`  • "${result.value}" → ${result.count} matches: [${result.allMatches.join(', ')}] → using: ${result.matchPath}`);
                        });
                    }
                    if (summary.no_match > 0) {
                        processedResults.filter(r => r.status === 'no_match').forEach(result => {
                            dv.paragraph(`  • "${result.value}" → No Group (Concept/Core Pattern) page found (searching for: file.name="${result.value}" AND domain="concepts" or "patterns")`);
                        });
                    }
                }

                const hasAnyMatches = processedResults.some(result => result.status !== 'no_match');

                if (debug) {
                    dv.paragraph(`**🎯 FINAL OUTPUT DECISION:**`);
                    dv.paragraph(`  • Total values processed: ${processedResults.length}`);
                    dv.paragraph(`  • Values with matches: ${processedResults.filter(r => r.status !== 'no_match').length}`);
                    dv.paragraph(`  • Will show: bullets + table`);
                }

                // Build bullets (subject only if multiple projects overall)
                const bulletsForType = processedResults
                    .filter(r => r.status !== 'no_match')
                    .map((res, idx) => {
                        const firstMatch = (matchResults[idx] && matchResults[idx].matchingPages && matchResults[idx].matchingPages.length > 0)
                            ? matchResults[idx].matchingPages[0]
                            : null;
                        const subjectText = firstMatch && firstMatch.subject ? firstMatch.subject : "";
                        if (subjectText) bulletSubjects.add(subjectText);
                        return { link: res.link, subject: subjectText };
                    });
                if (bulletsForType.length > 0) {
                    bulletSections.push({ headerText, bullets: bulletsForType });
                }

                if (debug) {
                    dv.paragraph("---");
                }

            // Build detailed rows for the aggregate table, one per matched value
            // Include count next to the group label on the first row only
            const matchedPerType = processedResults
                .map((res, idx) => {
                    const firstMatch = (matchResults[idx] && matchResults[idx].matchingPages && matchResults[idx].matchingPages.length > 0)
                        ? matchResults[idx].matchingPages[0]
                        : null;
                    if (!firstMatch) return null;
                    const pageLink = dv.fileLink(firstMatch.file.path, false, res.value || firstMatch.file.name);
                    // const summaryText = firstMatch.summary || "";
                    const subjectText = firstMatch.subject || "";
                    return { pageLink, subjectText };
                })
                .filter(Boolean);

            const perTypeCount = matchedPerType.length;
            matchedPerType.forEach((row, index) => {
                const labelCell = index === 0 ? `**${headerText}** (${perTypeCount})` : "";
                classificationTableRows.push([labelCell, row.pageLink, row.subjectText]);
            });
        });
        
        // Render the aggregate table under the existing output (only if there are rows)
        if (classificationTableRows.length > 0) {
            // Print bullet presentation above the table
            if (bulletSections && bulletSections.length > 0) {
                const includeSubjectsInBullets = bulletSubjects.size > 1;
                bulletSections.forEach(section => {
                    const subHeaderLevel = Math.min(6, headerLevel + 1);
                    dv.header(subHeaderLevel, section.headerText);
                    const items = section.bullets.map(b => (includeSubjectsInBullets && b.subject)
                        ? `${b.link} (${b.subject})`
                        : b.link);
                    dv.list(items);
                });
            }

            if (showTable) {
                const uniqueSubjects = Array.from(new Set(
                    classificationTableRows
                        .map(r => r[2])
                        .filter(s => s && String(s).trim().length > 0)
                ));
                const includeSubjectColumn = uniqueSubjects.length > 1;

                const firstColHeader = `Category`;
                const headers = includeSubjectColumn
                    ? [firstColHeader, "Pages", "Subjects"]
                    : [firstColHeader, "Pages"];
                const rows = includeSubjectColumn
                    ? classificationTableRows
                    : classificationTableRows.map(r => r.slice(0, 2));

                dv.table(headers, rows);
            }
        }
    }

    /**
     * Helper: Render Key Connections for a concept page.
     * For each relation type, finds pages where group-<type> matches current page name.
     * Skips empty categories and prints a single total in the wrapper header.
     *
     * @param {Object} params
     * @param {Object} params.dv - The dataview API object
     * @param {Array<string>} params.relationTypes - Clean relation type names (without "group-" prefix)
     * @param {number} [params.headerLevel=2] - Header level to use
     * @param {boolean} [params.debug=false] - Enable debug logging
     */
    renderKeyConnectionsForConcept({ dv, relationTypes, headerLevel = 2, debug = false }) {
        const currentPage = dv.current();
        const currentSubject = currentPage.subject;
        const groupValue = currentPage.file.name;

        const config = this.getConfigForSubject({ dv, subject: currentSubject, debug: false });

        // Collect rows for a consolidated table rendered after the bullet lists
        const keyConnectionsTableRows = [];

        // Compute total connections after subject/domain validation
        let totalConnections = 0;
        (relationTypes || []).forEach(type => {
            const groupFieldName = `group-${type}`;
            const validSubjectsSet = new Set(config.validSubjects || []);
            const validDomainsSet = new Set(config.validDomains || []);
            const allMatchingPages = dv.pages().where(p => {
                if (!p[groupFieldName]) return false;
                // Early subject/domain filters
                if (validSubjectsSet.size > 0 && !validSubjectsSet.has(p.subject)) return false;
                if (validDomainsSet.size > 0 && !validDomainsSet.has(p.domain)) return false;
                const pageValues = this.normalizeValues(p[groupFieldName]);
                return pageValues.some(val => String(val).toLowerCase() === String(groupValue).toLowerCase());
            });

            const pageMatching = this.filterPagesByValidSubjects({
                pages: Array.from(allMatchingPages),
                validSubjects: config.validSubjects,
                currentPagePath: currentPage.file.path,
                debug: false
            });

            const domainMatching = this.filterPagesByValidDomains({
                pages: pageMatching.filtered,
                validDomains: config.validDomains,
                currentPagePath: currentPage.file.path,
                debug: false
            });

            totalConnections += domainMatching.filtered.length;
        });

        if (totalConnections > 0 && headerLevel > 0) {
            dv.header(headerLevel, `Key Connections`);
        }

        // Render only non-empty categories
        (relationTypes || []).forEach(type => {
            const groupFieldName = `group-${type}`;
            const validSubjectsSet = new Set(config.validSubjects || []);
            const validDomainsSet = new Set(config.validDomains || []);

            const allMatchingPages = dv.pages().where(p => {
                if (!p[groupFieldName]) return false;
                // Early subject/domain filters
                if (validSubjectsSet.size > 0 && !validSubjectsSet.has(p.subject)) return false;
                if (validDomainsSet.size > 0 && !validDomainsSet.has(p.domain)) return false;
                const pageValues = this.normalizeValues(p[groupFieldName]);
                return pageValues.some(val => String(val).toLowerCase() === String(groupValue).toLowerCase());
            });

            const pageMatching = this.filterPagesByValidSubjects({
                pages: Array.from(allMatchingPages),
                validSubjects: config.validSubjects,
                currentPagePath: currentPage.file.path,
                debug
            });

            const domainMatching = this.filterPagesByValidDomains({
                pages: pageMatching.filtered,
                validDomains: config.validDomains,
                currentPagePath: currentPage.file.path,
                debug
            });

            const matchingPages = domainMatching.filtered.sort(p => p.file.name);
            if (matchingPages.length === 0) return; // skip empty

            const relationLabel = this.getRelationLabel({
                dv,
                domainCategory: type,
                subject: currentSubject,
                direction: 'outgoing',
                debug
            });

            // Removed per-category subheaders and bullet lists; keeping consolidated table only

            // Append rows for the consolidated table (do not repeat the relation label for subsequent rows)
            const relationCount = matchingPages.length;
            matchingPages.forEach((page, index) => {
                const labelCell = index === 0 ? `**${relationLabel}** (${relationCount})` : "";
                const pageLink = dv.fileLink(page.file.path, false, page.file.name);
                const summaryText = page.summary || "";
                const subjectText = page.subject || "";
                keyConnectionsTableRows.push([labelCell, pageLink, summaryText, subjectText]);
            });
        });

        // Render consolidated table beneath the lists with conditional Subjects column
        if (keyConnectionsTableRows.length > 0) {
            const uniqueSubjects = Array.from(new Set(
                keyConnectionsTableRows
                    .map(r => r[3])
                    .filter(s => s && String(s).trim().length > 0)
            ));
            const includeSubjectColumn = uniqueSubjects.length > 1;

            const headers = includeSubjectColumn
                ? ["Connection", "Pages", "Summary", "Subjects"]
                : ["Connection", "Pages", "Summary"];

            const rows = includeSubjectColumn
                ? keyConnectionsTableRows
                : keyConnectionsTableRows.map(r => r.slice(0, 3));

            dv.table(headers, rows);
        }
    }

    /**
     * Helper: Render the Related Content table based on current page and relationTypes
     * This corresponds to what was previously Step 4 inside generateConceptsAnalysis
     *
     * @param {Object} params
     * @param {Object} params.dv - The dataview API object
     * @param {Array<string>} params.relationTypes - Clean relation type names (without "group-" prefix)
     * @param {Array<string>} [params.validSubjects] - Optional list of valid subjects to filter related concepts by
     * @param {number} [params.headerLevel=2] - Header level to use
     * @param {boolean} [params.debug=false] - Enable debug logging
     */
    renderTopRelatedContent({ dv, relationTypes, validSubjects, headerLevel = 2, debug = false }) {
        const currentPage = dv.current();
        const currentSubject = currentPage.subject;

        // Default validSubjects to current subject if not provided
        const subjectsToUse = (validSubjects && validSubjects.length > 0) ? validSubjects : [currentSubject];

            if (debug) {
                dv.paragraph(`**Step 4: Finding related concepts**`);
            dv.paragraph(`Using getRelatedConcepts with relationTypes: [${(relationTypes || []).join(', ')}]`);
            dv.paragraph(`Subject filter: ${subjectsToUse.join(', ')}`);
            }
            
            // Build match criteria from current page's group-* fields and domain-category
            const matchCriteria = {};
            
            if (currentPage["domain-category"]) {
                matchCriteria["domain-category"] = true;
            }
            
        (relationTypes || []).forEach(type => {
                const groupFieldName = `group-${type}`;
                const values = currentPage[groupFieldName];
                if (values) {
                matchCriteria[groupFieldName] = true;
                }
            });
            
            if (debug) {
                dv.paragraph(`**Building Match Criteria for getRelatedConcepts:**`);
                dv.paragraph(`  • domain-category: ${currentPage["domain-category"] ? 'included' : 'not present'}`);
                dv.paragraph(`  • group-* fields from current page:`);
            (relationTypes || []).forEach(type => {
                    const groupFieldName = `group-${type}`;
                    const values = currentPage[groupFieldName];
                    dv.paragraph(`    - ${groupFieldName}: ${values ? `"${Array.isArray(values) ? values.join(', ') : values}"` : 'not present'}`);
                });
                dv.paragraph(`  • Final match criteria: ${Object.keys(matchCriteria).map(k => `${k}=true`).join(', ')}`);
            }
            
            const related = this.getRelatedConcepts({ 
                dv, 
                matchCriteria,
            debug
            });

            const filteredResults = related
                .filter(r => r.concept.file.path !== currentPage.file.path)
            .filter(r => subjectsToUse.includes(r.concept.subject))
                .sort((a, b) => b.confidence - a.confidence);

            if (debug) {
                dv.paragraph(`**Related "CONCEPTS" found: ${related.length}**`);
                dv.paragraph(`**After filtering by subject: ${filteredResults.length}**`);
            dv.paragraph(`**Valid subjects: [${subjectsToUse.join(', ')}]**`);
                dv.paragraph("---");
            }

            // Display related concepts section
        dv.header(headerLevel, "Related Content");

            if (filteredResults.length === 0) {
                dv.paragraph("No related \"CONCEPTS\" found.");
            } else {
            // Include Subject column if results span multiple subjects (within the subjectsToUse filter)
            const uniqueSubjects = Array.from(new Set(filteredResults.map(r => r.concept.subject).filter(Boolean)));
            const includeSubjectColumn = uniqueSubjects.length > 1;

            const headers = ["Name", "Type", "Domain", "Confidence", ...(includeSubjectColumn ? ["Subject"] : [])];
            const rows = filteredResults.map(r => [
                        dv.fileLink(r.concept.file.path, false, r.concept.file.name),
                        r.concept.type || "",
                        r.concept.domain || "",  
                        `${r.confidence.toFixed(1)}%`,
                        ...(includeSubjectColumn ? [r.concept.subject || ""] : [])
            ]);

            dv.table(headers, rows);
        }
    }

    /**
     * Generates an analysis of a concept's group relationships and related concepts
     * Originally expected frontmatter:
     * - subject (to find config page) - REQUIRED
     * - group-* fields (like group-year, group-director, etc.) - dynamically detected
     * 
     * Shows which groups this concept belongs to + finds related concepts
     * 
     * @param {Object} params - The parameters object
     * @param {Object} params.dv - The dataview API object
     * @param {Array} [params.relationTypes] - Optional array of relation types to check (defaults to auto-detect group-* fields)
     * @param {number} [params.headerLevel=2] - The level for the header (1-6)
     * @param {boolean} [params.debug=false] - Show detailed debug output
     */
    generateConceptsAnalysis({ dv, relationTypes = null, headerLevel = 2, debug = false }) {
        try {
            const currentPage = dv.current();
            const currentSubject = currentPage.subject;

            if (debug) {
                dv.header(3, "🐛 DEBUG: ConceptManager.generateConceptsAnalysis()");
                dv.paragraph(`**Current file:** ${currentPage.file.path}`);
                
                // ANNOUNCE WHAT WE'RE TRYING TO DO
                dv.paragraph(`**🎯 WHAT THIS METHOD DOES:**`);
                dv.paragraph(`  • This is **presumably** a "CONCEPT" page → Show which Groups (Concept/Core Pattern) this "CONCEPT" belongs to`);
                dv.paragraph(`  • Example: If "CONCEPT" has group-year: "1995" → Show link to "1995" year page`);
                dv.paragraph(`  • Example: If "CONCEPT" has group-director: "Tarantino" → Show link to "Tarantino" director page`);
                dv.paragraph(`  • Then show related "CONCEPTS" using similar Group (Concept/Core Pattern) memberships`);
                
                dv.paragraph(`**Parameters:**`);
                dv.paragraph(`  • relationTypes: ${relationTypes ? relationTypes.join(', ') : 'auto-detect group-* fields'}`);
                dv.paragraph(`  • headerLevel: ${headerLevel}`);
                dv.paragraph(`  • subject: ${currentSubject}`);
                
                dv.paragraph(`**Current frontmatter values:**`);
                Object.keys(currentPage).forEach(key => {
                    if (typeof currentPage[key] !== 'function' && key !== 'file') {
                        dv.paragraph(`  • ${key}: ${Array.isArray(currentPage[key]) ? currentPage[key].join(', ') : currentPage[key]}`);
                    }
                });
                dv.paragraph("---");
            }

            // STEP 1: Get config and valid filters + subjects
            if (debug) {
                dv.paragraph(`**Step 1: Finding config page**`);
                dv.paragraph(`Looking for Config page with: type="config" AND subject="${currentSubject}"`);
            }
            
            const configPages = dv.pages()
                .where(p => 
                    p.type === "config" && 
                    p.subject === currentSubject
                );
                
            const configPage = configPages.length > 0 ? configPages[0] : null;
                
            let validFilters = configPage ? (configPage.valid_filters || []) : [];
            let validSubjects = configPage ? (configPage.valid_subjects || []) : [];
            
            if (debug) {
                if (configPages.length === 1) {
                    dv.paragraph(`✅ Found Config: ${configPage.file.name}`);
                    dv.paragraph(`  • valid_filters: [${validFilters.join(', ')}]`);
                    dv.paragraph(`  • valid_subjects: [${validSubjects.join(', ')}]`);
                } else if (configPages.length > 1) {
                    dv.paragraph(`⚠️ Warning: Found ${configPages.length} config pages for subject "${currentSubject}" - using first: ${configPage.file.name}`);
                    dv.paragraph(`  • All matches: [${configPages.map(p => p.file.name).join(', ')}]`);
                    dv.paragraph(`  • valid_filters: [${validFilters.join(', ')}]`);
                    dv.paragraph(`  • valid_subjects: [${validSubjects.join(', ')}]`);
                } else {
                    dv.paragraph(`❌ No Config page found`);
                    dv.paragraph(`**To fix this:** Create a Config page with this frontmatter:`);
                    dv.paragraph("```yaml");
                    dv.paragraph("type: config");
                    dv.paragraph(`subject: ${currentSubject}`);
                    dv.paragraph("valid_filters: [film-year, film-director, cinema-genre] # example");
                    dv.paragraph("valid_subjects: [Subject1, Subject2] # example");
                    dv.paragraph("```");
                }
                dv.paragraph("---");
            }
            
            // If no valid subjects found, default to current subject
            if (!validSubjects.length) {
                validSubjects = [currentSubject];
            }

            // NOTE: Classifications wrapper header is inserted just before rendering sections below (Step 3)

            // Reordered: Classifications → Key Connections → Related Content

            // STEP 2: Discover relation types (group-* fields)
            const discovery = this.discoverRelationTypesForCurrentConcept({
                dv,
                relationTypes,
                validFilters,
                debug
            });
            relationTypes = discovery.relationTypes;

            if (debug) {
                dv.paragraph(`**Final relation types to process: [${relationTypes.join(', ')}]**`);
                dv.paragraph("---");
            }

            if (relationTypes.length === 0) {
                if (debug) {
                    dv.paragraph(`❌ **No relation types to process**`);
                    dv.paragraph(`**Reasons:**`);
                    dv.paragraph(`  • No group-* fields found in current page frontmatter`);
                    dv.paragraph(`  • OR config valid_filters doesn't include any of the group-* field names`);
                }
                dv.paragraph("No Group (Concept/Core Pattern) relationships found.");
                return;
            }

            // STEP 3: Display organized sections for each type of relation
            this.renderConceptClassifications({
                dv,
                relationTypes,
                headerLevel,
                subject: currentSubject,
                showTable: false,
                debug
            });

            // STEP 3.5: Key Connections (inserted between classifications and top related)
            this.renderKeyConnectionsForConcept({
                dv,
                relationTypes,
                headerLevel,
                debug
            });

            // End of reorder block

            // STEP 4: Related Content - now delegated to helper
            this.renderTopRelatedContent({
                dv,
                relationTypes,
                validSubjects,
                headerLevel,
                debug
            });
        } catch (error) {
            dv.header(headerLevel, "⚠️ Error Loading Content");
            dv.paragraph(`**Error:** ${error.message}`);
            if (debug) {
                dv.paragraph("**Debug Info:**");
                dv.paragraph(`Current page available fields: ${Object.keys(dv.current()).filter(k => k !== 'file' && typeof dv.current()[k] !== 'function').join(', ')}`);
            }
            dv.paragraph("Please check your parameters and try again.");
        }
    }

    /**
     * Smart view generator that automatically determines what to display based on the current page's metadata.
     * 
     * ## Processing Steps:
     * 1. **Page Analysis**: Analyzes current page metadata (domain, subject, type, domain-category)
     * 2. **Config Lookup**: Searches for config file with matching subject to get valid_filters for relation types
     * 3. **Concept Analysis**: If domain is "concepts" or "patterns", calls `generateConceptsAnalysis()` 
     *    - Shows which groups this concept belongs to + finds related concepts
     * 4. **Group Items List**: If page has "domain-category", calls `generateGroupItemsList()`
     *    - Shows all items that belong to this group (e.g., all movies from 1995)
     * 5. **View Table**: If page has "domain-category", calls `generateViewTable()`
     *    - Shows related groups and hub relationships based on domain-category
     * 
     * Note: Step 4 runs only if Step 3 did not run (to avoid duplicate Key Connections).
     * 
     * ## Step Selection:
     * You can control which steps execute using the `enabledSteps` parameter:
     * - `conceptAnalysis`: Step 3 - Shows concept relationships and groups
     * - `groupItems`: Step 4 - Shows items belonging to this group  
     * - `viewTable`: Step 5 - Shows group relationships and hubs
     * 
     * @param {Object} params - Parameters object
     * @param {Object} params.dv - The Dataview API object
     * @param {number} [params.headerLevel=2] - The level for headers (1-6)
     * @param {Array<string>} [params.enabledSteps=['conceptAnalysis', 'groupItems', 'viewTable']] - Which view steps to execute
     * @param {boolean} [params.debug=false] - Enable debug logging
     * 
     * @example
     * ```dataviewjs
     * // Full smart view (all steps)
     * ConceptManager.generateSmartView({ dv });
     * 
     * // Light mode (concept analysis only)
     * ConceptManager.generateSmartView({ 
     *   dv, 
     *   enabledSteps: ['conceptAnalysis'] 
     * });
     * 
     * // Group-focused mode (skip concept analysis)
     * ConceptManager.generateSmartView({ 
     *   dv, 
     *   enabledSteps: ['groupItems', 'viewTable'] 
     * });
     * ```
     */
    generateSmartView({ dv, headerLevel = 2, enabledSteps = ['conceptAnalysis', 'groupItems', 'viewTable'], debug = false }) {
        try {
            if (debug) {
                dv.header(headerLevel, "🔬 Smart View Generator - Debug Mode");
                dv.paragraph("**Function:** generateSmartView");
                dv.paragraph("**Purpose:** Automatically determines what to display based on current page's metadata");
                dv.paragraph(`**Enabled Steps:** ${enabledSteps.join(', ')}`);
                dv.paragraph("---");
            }


            // Step 1: Get current page and basic analysis
            const currentPage = dv.current();
            
            if (debug) {
                dv.paragraph(`**Step 1: Analyzing Current Page**`);
                dv.paragraph(`Current page: ${currentPage.file.name}`);
                dv.paragraph(`Current page path: ${currentPage.file.path}`);
                dv.paragraph(`Current page domain: ${currentPage.domain || "undefined"}`);
                dv.paragraph(`Current page subject: ${currentPage.subject || "undefined"}`);
                dv.paragraph(`Current page type: ${currentPage.type || "undefined"}`);
                dv.paragraph(`Has domain-category: ${currentPage["domain-category"] ? "Yes" : "No"}`);
                if (currentPage["domain-category"]) {
                    const categories = this.normalizeValues(currentPage["domain-category"]);
                    dv.paragraph(`Domain categories: ${categories.join(', ')}`);
                }
                dv.paragraph("---");
            }


            
            // Step 2: Look for config file
            if (debug) {
                dv.paragraph(`**Step 2: Looking for Configuration**`);
                dv.paragraph(`Searching for config with subject: ${currentPage.subject}`);
            }

            // Get config validation for the current page's subject
            const configData = this.getConfigForSubject({ 
                dv, 
                subject: currentPage.subject, 
                debug: debug 
            });
            
            if (debug) {
                dv.paragraph(`**🔧 Config Lookup for generateSmartView: "${configData.debugInfo.subject}"**`);
                if (configData.debugInfo.hasConfig) {
                    dv.paragraph(`✅ Found Config: ${configData.debugInfo.configPageName}`);
                    dv.paragraph(`  • valid_filters: [${configData.debugInfo.validFilters.join(', ')}]`);
                    dv.paragraph(`  • valid_subjects: [${configData.debugInfo.validSubjects.join(', ')}]`);
                } else {
                    dv.paragraph(`❌ No Config page found for subject "${configData.debugInfo.subject}"`);
                    dv.paragraph(`  • Using default valid_subjects: [${configData.debugInfo.validSubjects.join(', ')}]`);
                }
                dv.paragraph("---");
            }

            let viewsGenerated = 0;
            
            // Step 3: Check if we should run concept analysis
            const stepEnabled = enabledSteps.includes('conceptAnalysis');
            const domainRequirementMet = currentPage.domain === "concepts" || currentPage.domain === "patterns";
            const shouldRunConceptAnalysis = stepEnabled && domainRequirementMet;
            
            if (debug) {
                dv.paragraph(`**Step 3: Concept Analysis Check**`);
                dv.paragraph(`Step enabled: ${stepEnabled ? "Yes" : "No"}`);
                dv.paragraph(`Current domain: ${currentPage.domain}`);
                dv.paragraph(`Domain requirement met: ${domainRequirementMet ? "Yes" : "No"}`);
                dv.paragraph(`Should run Concept Analysis: ${shouldRunConceptAnalysis ? "Yes" : "No"}`);
                dv.paragraph(`Reasoning: ${!stepEnabled ? "Step disabled by enabledSteps parameter" : !domainRequirementMet ? `Domain is "${currentPage.domain || 'undefined'}" (requires "concepts" or "patterns")` : "All requirements met"}`);
            }

            if (shouldRunConceptAnalysis) {
                if (debug) {
                    dv.paragraph(`**Executing Concept Analysis...**`);
                }

                // Get relation types from config
                const relationTypes = configData.validFilters || [];
                
                if (debug) {
                    dv.paragraph(`Relation types to use: ${relationTypes.length > 0 ? relationTypes.join(', ') : "none (will use defaults)"}`);
                    dv.paragraph("---");
                }
                
                // Generate concept analysis
                this.generateConceptsAnalysis({ 
                    dv, 
                    relationTypes,
                    headerLevel: headerLevel,
                    debug: debug
                });
                
                viewsGenerated++;
                
                if (debug) {
                    dv.paragraph(`✅ Concept Analysis completed. Views generated so far: ${viewsGenerated}`);
                    dv.paragraph("---");
                }
            } else {
                if (debug) {
                    dv.paragraph(`❌ Skipping Concept Analysis - ${!stepEnabled ? "step disabled by user" : "domain requirements not met"}`);
                    dv.paragraph("---");
                }
            }
            


            
            // Step 4: Check if we should run Group (Concept/Core Pattern) items list
            const step4Enabled = enabledSteps.includes('groupItems');
            const hasDomainCategory = !!currentPage["domain-category"];
            // Avoid duplicating Key Connections if Concept Analysis already rendered them
            const shouldRunGroupItems = step4Enabled && hasDomainCategory && !shouldRunConceptAnalysis;
            
            if (debug) {
                dv.paragraph(`**Step 4: Group (Concept/Core Pattern) Items List Check**`);
                dv.paragraph(`Step enabled: ${step4Enabled ? "Yes" : "No"}`);
                dv.paragraph(`Has domain-category: ${hasDomainCategory ? "Yes" : "No"}`);
                dv.paragraph(`Concept Analysis already ran: ${shouldRunConceptAnalysis ? "Yes" : "No"}`);
                dv.paragraph(`Should run Group (Concept/Core Pattern) items list: ${shouldRunGroupItems ? "Yes" : "No"}`);
                dv.paragraph(`Reasoning: ${!step4Enabled ? "Step disabled by enabledSteps parameter" : !hasDomainCategory ? "No domain-category found in frontmatter" : shouldRunConceptAnalysis ? "Already rendered inside Concept Analysis (avoiding duplicate Key Connections)" : "All requirements met"}`);
            }

            if (shouldRunGroupItems) {
                // Add some spacing
                dv.paragraph("");
                
                if (debug) {
                    dv.paragraph(`**Preparing Group (Concept/Core Pattern) Items List Header...**`);
                }

                // // Generate default header text based on domain-category if not provided
                // let headerText = groupItemsHeaderText;
                // if (!headerText) {
                //     const categories = this.normalizeValues(currentPage["domain-category"]);
                //     if (categories.length > 0) {
                //         headerText = `asdfgh Items in this Group (Concept/Core Pattern) ${currentPage["domain-category"]}: ${currentPage.file.name}`;
                //     }
                // }

                let headerText = `Key Connections (n)`; // Content related to ${currentPage.file.name} ??????????????????????
                
                if (debug) {
                    dv.paragraph(`Final header text: ${headerText}`);
                    dv.paragraph(`**Executing Group (Concept/Core Pattern) Items List...**`);
                }
                
                // Generate group items list
                this.generateGroupItemsList({ 
                    dv, 
                    headerLevel,
                    headerText,
                    debug: debug
                });
                
                viewsGenerated++;
                
                if (debug) {
                    dv.paragraph(`✅ Group (Concept/Core Pattern) items list completed. Views generated so far: ${viewsGenerated}`);
                    dv.paragraph("---");
                }
            } else {
                if (debug) {
                    const reason = !step4Enabled ? "step disabled by user" : !hasDomainCategory ? "no domain-category found" : "already rendered inside Concept Analysis";
                    dv.paragraph(`❌ Skipping Group (Concept/Core Pattern) items list - ${reason}`);
                    dv.paragraph("---");
                }
            }
            


            // Step 5: Check if we should run view table (group relationships)
            const step5Enabled = enabledSteps.includes('viewTable');
            const hasDomainCategoryForTable = !!currentPage["domain-category"];
            const shouldRunViewTable = step5Enabled && hasDomainCategoryForTable;
            
            if (debug) {
                dv.paragraph(`**Step 5: View Table (Group Relationships) Check**`);
                dv.paragraph(`Step enabled: ${step5Enabled ? "Yes" : "No"}`);
                dv.paragraph(`Has domain-category: ${hasDomainCategoryForTable ? "Yes" : "No"}`);
                dv.paragraph(`Should run view table: ${shouldRunViewTable ? "Yes" : "No"}`);
                dv.paragraph(`Reasoning: ${!step5Enabled ? "Step disabled by enabledSteps parameter" : !hasDomainCategoryForTable ? "No domain-category found in frontmatter" : "All requirements met"}`);
            }

            if (shouldRunViewTable) {
                // Add some spacing
                dv.paragraph("");
                
                if (debug) {
                    dv.paragraph(`**Executing View Table (Group Relationships)...**`);
                }
                
                // Generate view table
                this.generateViewTable({ 
                    dv, 
                    headerLevel,
                    debug: debug
                });
                
                viewsGenerated++;
                
                if (debug) {
                    dv.paragraph(`✅ View table completed. Views generated so far: ${viewsGenerated}`);
                    dv.paragraph("---");
                }
            } else {
                if (debug) {
                    dv.paragraph(`❌ Skipping view table - ${!step5Enabled ? "step disabled by user" : "no domain-category found"}`);
                    dv.paragraph("---");
                }
            }

            // Final summary
            if (debug) {
                dv.paragraph(`**📊 COMPREHENSIVE FINAL SUMMARY**`);
                dv.paragraph(`Total views generated: ${viewsGenerated} out of 3 possible views`);
                dv.paragraph("");
                
                dv.paragraph(`**🔍 ALL VIEWS CONSIDERED AND THEIR STATUS:**`);
                
                // View 1: Concept Analysis
                dv.paragraph(`**1. Concept Analysis:**`);
                if (shouldRunConceptAnalysis) {
                    dv.paragraph(`   ✅ **EXECUTED** - All requirements met`);
                    dv.paragraph(`   📋 Step enabled: ${stepEnabled}, Domain: "${currentPage.domain}"`);
                } else {
                    dv.paragraph(`   ❌ **SKIPPED** - ${!stepEnabled ? "Step disabled by user" : "Domain requirement not met"}`);
                    if (!stepEnabled) {
                        dv.paragraph(`   📋 Reason: 'conceptAnalysis' not in enabledSteps parameter`);
                        dv.paragraph(`   🔧 Fix: Add 'conceptAnalysis' to enabledSteps array`);
                    } else {
                        dv.paragraph(`   📋 Reason: Page domain is "${currentPage.domain || 'undefined'}" (requires "concepts" or "patterns")`);
                        dv.paragraph(`   🔧 Fix: Set domain to "concepts" or "patterns" in frontmatter`);
                    }
                }
                
                // View 2: Group Items List  
                dv.paragraph(`**2. Group (Concept/Core Pattern) Items List:**`);
                if (shouldRunGroupItems) {
                    dv.paragraph(`   ✅ **EXECUTED** - All requirements met`);
                    dv.paragraph(`   📋 Step enabled: ${step4Enabled}, Has domain-category: ${hasDomainCategory}`);
                } else {
                    const skippedReason = !step4Enabled ? "Step disabled by user" : !hasDomainCategory ? "Missing domain-category field" : "Rendered inside Concept Analysis (avoided duplicate)";
                    dv.paragraph(`   ❌ **SKIPPED** - ${skippedReason}`);
                    if (!step4Enabled) {
                        dv.paragraph(`   📋 Reason: 'groupItems' not in enabledSteps parameter`);
                        dv.paragraph(`   🔧 Fix: Add 'groupItems' to enabledSteps array`);
                    } else if (!hasDomainCategory) {
                        dv.paragraph(`   📋 Reason: Page does not have "domain-category" in frontmatter`);
                        dv.paragraph(`   🔧 Fix: Add "domain-category: [category-name]" to frontmatter`);
                    } else {
                        dv.paragraph(`   📋 Reason: Concept Analysis was executed and already rendered Key Connections`);
                    }
                }
                
                // View 3: View Table
                dv.paragraph(`**3. View Table (Group Relationships):**`);
                if (shouldRunViewTable) {
                    dv.paragraph(`   ✅ **EXECUTED** - All requirements met`);
                    dv.paragraph(`   📋 Step enabled: ${step5Enabled}, Has domain-category: ${hasDomainCategoryForTable}`);
                } else {
                    dv.paragraph(`   ❌ **SKIPPED** - ${!step5Enabled ? "Step disabled by user" : "Missing domain-category field"}`);
                    if (!step5Enabled) {
                        dv.paragraph(`   📋 Reason: 'viewTable' not in enabledSteps parameter`);
                        dv.paragraph(`   🔧 Fix: Add 'viewTable' to enabledSteps array`);
                    } else {
                        dv.paragraph(`   📋 Reason: Page does not have "domain-category" in frontmatter`);
                        dv.paragraph(`   🔧 Fix: Add "domain-category: [category-name]" to frontmatter`);
                    }
                }
                
                dv.paragraph("");
                dv.paragraph(`**📈 EXECUTION SUMMARY:**`);
                dv.paragraph(`  • Views executed: ${viewsGenerated}`);
                dv.paragraph(`  • Views skipped: ${3 - viewsGenerated}`);
                dv.paragraph(`  • Success rate: ${Math.round((viewsGenerated / 3) * 100)}%`);
                
                if (viewsGenerated === 0) {
                    dv.paragraph("");
                    dv.paragraph(`⚠️ **NO VIEWS EXECUTED** - Either steps are disabled or page doesn't meet requirements`);
                    dv.paragraph(`**Potential fixes:**`);
                    dv.paragraph(`  • Enable more steps: Add 'conceptAnalysis', 'groupItems', or 'viewTable' to enabledSteps`);
                    dv.paragraph(`  • For Concept Analysis: Add domain: "concepts" or domain: "patterns"`);
                    dv.paragraph(`  • For Group views: Add domain-category: [category-name]`);
                } else if (viewsGenerated < 3) {
                    dv.paragraph("");
                    dv.paragraph(`💡 **OPTIMIZATION OPPORTUNITY:** ${3 - viewsGenerated} additional view(s) could be enabled`);
                    dv.paragraph(`Check the step analysis above for specific requirements.`);
                }
                
                dv.paragraph("");
                dv.paragraph(`**Smart View Generator completed!** 🎉`);
            }

        } catch (error) {
            dv.header(headerLevel, "⚠️ Error in Smart View Generator");
            dv.paragraph(`**Error:** ${error.message}`);
            if (debug) {
                dv.paragraph("**Debug Info:**");
                dv.paragraph(`Error occurred in generateSmartView function`);
                dv.paragraph(`Current page: ${dv.current().file?.name || "unknown"}`);
                dv.paragraph(`Current page available fields: ${Object.keys(dv.current()).filter(k => k !== 'file' && typeof dv.current()[k] !== 'function').join(', ')}`);
                dv.paragraph(`Stack trace: ${error.stack}`);
            }
            dv.paragraph("Please check your parameters and try again.");
            console.error("Error in generateSmartView:", error);
        }
    }
} 
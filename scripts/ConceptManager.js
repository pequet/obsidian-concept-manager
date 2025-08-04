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
 *   const { ConceptManager } = CustomJS;
 *   ConceptManager.helloWorld();
 *   ```
 *   - Basic Usage
 *   ```dataviewjs
 *   const { ConceptManager } = CustomJS;
 *   ConceptManager.getRelatedConcepts({ dv });
 *   ```
 */

class ConceptManager {
    constructor() {
        console.log("ConceptManager class loaded and ready 💡");
        
        // Cache maps to store previously retrieved concepts and relations
        this.conceptCache = new Map();
        this.relationsCache = new Map();
        
        // Initialize any properties here
        this.debug = false;
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
     * Finds files that share the same directory structure as the current file.
     * Used internally by other methods to find related concepts in the same directory.
     * 
     * @param {Object} params - The parameters object
     * @param {Object} params.dv - The dataview API object
     * @param {string} params.currentPath - The full path of the current file
     * @returns {Object} Object with exactFolder and subFolders arrays
     * @example
     * // If current file is in "Technical Analysis/Time-Based Analysis/concept.md"
     * // Returns { exactFolder: [...], subFolders: [...] }
     * const pathFiles = getFilesInSamePath({ dv, currentPath: "path/to/file.md" });
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
     * 1. Frontmatter field matching: 2 points each for matching any specified frontmatter fields
     * 2. Path proximity (automatic): 2 points for files in exact same folder, 1 point for files in subfolders  
     * 
     * @param {Object} params - Parameters object
     * @param {Object} params.dv - DataView API object
     * @param {Object} params.matchCriteria - Object specifying which frontmatter fields to match on
     *   - Key: frontmatter field name (e.g., 'type', 'subject', 'level', 'domain')  
     *   - Value: true (use current page's value), string (explicit value), or null/false (ignore)
     * @param {boolean} params.strictPath - Only return same-path files if true (default: false)
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
    getRelatedConcepts({ dv, matchCriteria = {}, strictPath = false, debug = false }) {
        const current = dv.current();
        
        // Process matchCriteria to get actual values to match on
        const resolvedCriteria = {};
        const searchFilters = {};
        
        Object.keys(matchCriteria).forEach(field => {
            const criteriaValue = matchCriteria[field];
            
            if (criteriaValue === null || criteriaValue === false) {
                // Ignore this field
                return;
            } else if (criteriaValue === true) {
                // Use current page's value
                resolvedCriteria[field] = current[field];
            } else {
                // Use explicit value
                resolvedCriteria[field] = criteriaValue;
            }
            
            // Set up search filters (for domain limiting if specified)
            if (field === 'subject' || field === 'domain') {
                searchFilters[field] = resolvedCriteria[field];
            }
        });
        
        if (debug) {
            dv.header(3, "🐛 DEBUG: ConceptManager.getRelatedConcepts()");
            dv.paragraph(`**Current file:** ${current.file.path}`);
            dv.paragraph(`**Current frontmatter values:**`);
            Object.keys(current).forEach(key => {
                if (typeof current[key] !== 'function' && key !== 'file') {
                    dv.paragraph(`  • ${key}: ${Array.isArray(current[key]) ? current[key].join(', ') : current[key]}`);
                }
            });
            dv.paragraph(`**Match criteria requested:**`);
            Object.keys(matchCriteria).forEach(field => {
                dv.paragraph(`  • ${field}: ${matchCriteria[field]} → ${resolvedCriteria[field] || 'ignored'}`);
            });
            dv.paragraph(`**Strict path mode:** ${strictPath}`);
            dv.paragraph("---");
        }
        
        // Get files in same directory structure (unless strictPath is disabled)
        const relatedConcepts = new Map();
        
        if (!strictPath) {
            const pathFiles = this.getFilesInSamePath({ dv, currentPath: current.file.path });
        
        if (debug) {
            dv.paragraph(`**Step 1: Finding files in same directory path**`);
            dv.paragraph(`Directory path: ${current.file.path.split('/').slice(0, -1).join('/')}`);
                dv.paragraph(`Files found - Exact folder: ${pathFiles.exactFolder.length}, Subfolders: ${pathFiles.subFolders.length}`);
                if (pathFiles.exactFolder.length > 0) {
                    dv.paragraph("**Exact folder files:**");
                    dv.list(pathFiles.exactFolder.map(f => f.file.path));
                }
                if (pathFiles.subFolders.length > 0) {
                    dv.paragraph("**Subfolder files:**");
                    dv.list(pathFiles.subFolders.map(f => f.file.path));
            }
            dv.paragraph("---");
        }
        
            // Add path-based scores
            // 2 points for files in exact same folder
            pathFiles.exactFolder.forEach(concept => {
            const conceptId = concept.file.path;
            relatedConcepts.set(conceptId, { 
                concept, 
                    scores: new Map([["path", 2]]) // 2 points for exact same folder
                });
            });
            
            // 1 point for files in subfolders
            pathFiles.subFolders.forEach(concept => {
                const conceptId = concept.file.path;
                relatedConcepts.set(conceptId, { 
                    concept, 
                    scores: new Map([["path", 1]]) // 1 point for subfolders
                });
            });
            
            if (debug) {
                dv.paragraph(`**Step 2: Adding path-based scores**`);
                dv.paragraph(`Added ${pathFiles.exactFolder.length} concepts with path score of 2 (exact same folder)`);
                dv.paragraph(`Added ${pathFiles.subFolders.length} concepts with path score of 1 (subfolders)`);
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
                dv.paragraph(`Target value(s) for '${field}': ${targetValues.join(', ')}`);
                dv.paragraph(`Looking for files that match these values...`);
            }
            
            // Find all files that match this criteria
            const matchingConcepts = dv.pages()
                .where(p => {
                    // Apply subject filter if it's in searchFilters
                    if (searchFilters.subject && p.subject !== searchFilters.subject) return false;
                    // Apply domain filter if it's in searchFilters  
                    if (searchFilters.domain && p.domain !== searchFilters.domain) return false;
                    
                    // Check if this field matches
                    const pageValue = p[field];
                    if (!pageValue) return false;
                    
                    const pageValues = Array.isArray(pageValue) ? pageValue : [pageValue];
                    // Check if any of the target values match any of the page values
                    return targetValues.some(tv => pageValues.includes(tv));
            });
            
            if (debug) {
                dv.paragraph(`Found ${matchingConcepts.length} files matching '${field}' criteria:`);
                if (matchingConcepts.length > 0) {
                    matchingConcepts.forEach(c => {
                        const pageValues = Array.isArray(c[field]) ? c[field] : [c[field]];
                        dv.paragraph(`  • ${c.file.name}: ${field} = ${pageValues.join(', ')}`);
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
                relatedConcepts.get(conceptId).scores.set(field, matchingValues.length * 2); // 2 points per match
                
                if (debug) {
                    dv.paragraph(`  → ${concept.file.name}: ${matchingValues.length} matching values (${matchingValues.join(', ')}) = ${matchingValues.length * 2} points`);
                }
            });
            
            if (debug) {
                dv.paragraph("---");
            }
            stepCounter++;
        });
        
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
            let maxPossibleScore = strictPath ? 0 : 2; // Max path score
            
            Object.keys(resolvedCriteria).forEach(field => {
                const targetValue = resolvedCriteria[field];
                if (targetValue) {
                    const targetValues = Array.isArray(targetValue) ? targetValue : [targetValue];
                    maxPossibleScore += targetValues.length * 2; // 2 points per matching value
                }
            });
            
            const confidence = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
            
            if (debug) {
                const scoreBreakdown = Array.from(scores.entries())
                    .map(([key, score]) => `${key}=${score}`)
                    .join(', ');
                dv.paragraph(`${concept.file.name}: ${scoreBreakdown}, total=${totalScore}/${maxPossibleScore} = ${confidence.toFixed(2)}%`);
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
            dv.paragraph(`Minimum confidence: > 0%`);
        }
        
        const filtered = results
            .filter(r => !strictPath || r.inSamePath) // Only include same-path files if strictPath is true
            .filter(r => r.confidence > 0)
            .sort((a, b) => b.confidence - a.confidence);
            
        if (debug) {
            dv.paragraph(`**Final Results: ${filtered.length} concepts**`);
            if (filtered.length > 0) {
                dv.table(
                    ["Concept", "Confidence", "Same Path", "Type", "Domain", "Subject"],
                    filtered.map(r => [
                        r.concept.file.name,
                        `${r.confidence.toFixed(2)}%`,
                        r.inSamePath ? "✓" : "✗",
                        r.concept.type,
                        r.concept.domain,
                        r.concept.subject
                    ])
                );
            } else {
                dv.paragraph("❌ No concepts found matching the criteria");
            }
            dv.paragraph("---");
        }
        
        return filtered;
    }
} 
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
     * @returns {Array} Array of pages in the same directory
     * @example
     * // If current file is in "Technical Analysis/Time-Based Analysis/concept.md"
     * // Returns all files in "Technical Analysis/Time-Based Analysis/" except the current file
     * const samePathFiles = getFilesInSamePath({ dv, currentPath: "path/to/file.md" });
     */
    getFilesInSamePath({ dv, currentPath }) {
        const pathParts = currentPath.split('/');
        // Remove the filename to get just the directory path
        const dirPath = pathParts.slice(0, -1).join('/');
                
        return dv.pages()
            .where(p => p.file.path.startsWith(dirPath) && p.file.path !== currentPath);
    }

    /**
     * Main method for finding related concepts and calculating their relationship strength
     * Currently:
     * 1. Looks for matches in each relation type (path i.e. category, level, unit)
     * 2. Calculates a confidence score based on number of matching values
     * 3. Returns sorted list of related concepts with confidence scores
     * 
     * @param {Object} params - Parameters object
     * @param {Object} params.dv - DataView API object
     * @param {Array} params.relationTypes - Frontmatter fields to check for matches (default: ["levels", "units"])
     * @param {string} params.subject - Subject filter (defaults to current page's subject)
     * @param {boolean} params.strictPath - Only return same-path files if true
     * @param {boolean} params.debug - Show detailed debug output
     * @param {boolean} params.includeType - Whether to include 'type' as a scoring dimension (default: false)
     * @param {string} params.typeMode - How to handle type scoring: 'current' (match current page type) or 'ignore' (default: 'current')
     * @param {Array} params.allowedDomains - Domains to search in (defaults to current page's domain, or ['concepts', 'patterns'] if not specified)
     */
    getRelatedConcepts({ dv, relationTypes = ["levels", "units"], subject, strictPath = false, debug = false, includeType = false, typeMode = 'current', allowedDomains = null }) {
        const current = dv.current();
        
        // Set up domain filtering
        const searchDomains = allowedDomains || [current.domain] || ['concepts', 'patterns'];
        
        // Set up type filtering if enabled
        const targetType = typeMode === 'current' ? current.type : null;
        
        if (debug) {
            dv.header(3, "🐛 DEBUG: ConceptManager.getRelatedConcepts()");
            dv.paragraph(`**Current file:** ${current.file.path}`);
            dv.paragraph(`**Current subject:** ${current.subject}`);
            dv.paragraph(`**Current domain:** ${current.domain}`);
            dv.paragraph(`**Current type:** ${current.type}`);
            dv.paragraph(`**Relation types to check:** ${relationTypes.join(', ')}`);
            dv.paragraph(`**Subject filter:** ${subject || 'none (using current subject)'}`);
            dv.paragraph(`**Strict path mode:** ${strictPath}`);
            dv.paragraph(`**Include type scoring:** ${includeType} (mode: ${typeMode})`);
            dv.paragraph(`**Search domains:** ${searchDomains.join(', ')}`);
            dv.paragraph("---");
        }
        
        // VALID FILTERS: relationTypes is already filtered by the caller (generateConceptsAnalysis)
        // so we don't need to filter it again here
        
        // Get files in same directory structure
        const samePathFiles = this.getFilesInSamePath({ dv, currentPath: current.file.path });
        
        if (debug) {
            dv.paragraph(`**Step 1: Finding files in same directory path**`);
            dv.paragraph(`Directory path: ${current.file.path.split('/').slice(0, -1).join('/')}`);
            dv.paragraph(`Files found in same path: ${samePathFiles.length}`);
            if (samePathFiles.length > 0) {
                dv.list(samePathFiles.map(f => f.file.path));
            }
            dv.paragraph("---");
        }
        
        console.log("Files in same path:", samePathFiles.map(f => f.file.path));
    
        const currentSubject = current.subject;
        const relatedConcepts = new Map();
        
        // First, add path-based scores - increased from 1 to 2 for stronger path weight
        samePathFiles.forEach(concept => {
            const conceptId = concept.file.path;
            relatedConcepts.set(conceptId, { 
                concept, 
                scores: new Map([["path", 2]]) // Increased to 2 points for same path
            });
        });
        
        if (debug) {
            dv.paragraph(`**Step 2: Adding path-based scores (2 points each)**`);
            dv.paragraph(`Added ${samePathFiles.length} concepts with path score of 2`);
            dv.paragraph("---");
        }
    
        // Then check each relation type for matches
        relationTypes.forEach(relationType => {
            const values = current[relationType];
            if (!values) {
                if (debug) {
                    dv.paragraph(`**Step 3.${relationTypes.indexOf(relationType) + 1}: Checking relation type '${relationType}'**`);
                    dv.paragraph(`❌ Current file has no '${relationType}' values - skipping`);
                }
                return;
            }
    
            const currentValues = Array.isArray(values) ? values : [values];
            const selfScore = currentValues.length;
            
            if (debug) {
                dv.paragraph(`**Step 3.${relationTypes.indexOf(relationType) + 1}: Checking relation type '${relationType}'**`);
                dv.paragraph(`Current file's ${relationType} values: ${currentValues.join(', ')}`);
                dv.paragraph(`Looking for files with domains [${searchDomains.join(', ')}] that share these values...`);
            }
    
            const concepts = this.getConceptsByRelationType({
                dv,
                relationType,
                relationValue: values,
                relationSubject: currentSubject,
                allowedDomains: searchDomains
            });
            
            if (debug) {
                dv.paragraph(`Found ${concepts.length} matching concepts for '${relationType}':`);
                if (concepts.length > 0) {
                    concepts.forEach(c => {
                        const conceptValues = Array.isArray(c[relationType]) ? c[relationType] : [c[relationType]];
                        dv.paragraph(`  - ${c.file.name}: ${relationType} = ${conceptValues.join(', ')}`);
                    });
                }
            }
    
            concepts.forEach(concept => {
                const conceptId = concept.file.path;
                if (!relatedConcepts.has(conceptId)) {
                    relatedConcepts.set(conceptId, { 
                        concept, 
                        scores: new Map([["path", 0]]) 
                    });
                }
                
                const conceptValues = Array.isArray(concept[relationType]) ? 
                    concept[relationType] : [concept[relationType]];
                const matchingValues = currentValues.filter(v => conceptValues.includes(v));
                relatedConcepts.get(conceptId).scores.set(relationType, matchingValues.length);
                
                if (debug) {
                    dv.paragraph(`  → ${concept.file.name}: ${matchingValues.length} matching values (${matchingValues.join(', ')})`);
                }
            });
            
            if (debug) {
                dv.paragraph("---");
            }
        });
        
        // Add type-based scoring if enabled
        if (includeType && targetType) {
            if (debug) {
                dv.paragraph(`**Step 3.${relationTypes.length + 1}: Adding type-based scoring**`);
                dv.paragraph(`Looking for files with type '${targetType}'...`);
            }
            
            // Find all files with matching type in allowed domains
            const typeMatches = dv.pages()
                .where(p => {
                    if (searchDomains && !searchDomains.includes(p.domain)) return false;
                    if (p.subject !== (subject || currentSubject)) return false;
                    return p.type === targetType;
                });
            
            if (debug) {
                dv.paragraph(`Found ${typeMatches.length} files with matching type '${targetType}'`);
            }
            
            typeMatches.forEach(concept => {
                const conceptId = concept.file.path;
                if (!relatedConcepts.has(conceptId)) {
                    relatedConcepts.set(conceptId, { 
                        concept, 
                        scores: new Map([["path", 0]]) 
                    });
                }
                
                relatedConcepts.get(conceptId).scores.set("type", 1);
                
                if (debug) {
                    dv.paragraph(`  → ${concept.file.name}: +1 point for matching type`);
                }
            });
            
            if (debug) {
                dv.paragraph("---");
            }
        }
    
        // Calculate final scores and confidence
        if (debug) {
            dv.paragraph(`**Step 4: Calculating confidence scores**`);
            dv.paragraph(`Total concepts found: ${relatedConcepts.size}`);
        }
        
        const results = Array.from(relatedConcepts.values()).map(({ concept, scores }) => {
            const pathScore = scores.get("path") || 0;
            const conceptTypeScore = scores.get("type") || 0;
            const relationScores = Array.from(scores.values())
                .reduce((sum, score) => sum + score, 0) - pathScore - conceptTypeScore;
            
            const totalScore = pathScore + conceptTypeScore + relationScores;
            
            // VALID FILTERS: Only consider the filtered relationTypes in maxPossibleScore
            const relationTypeScore = relationTypes.reduce((sum, type) => {
                return sum + (current[type] ? 
                    (Array.isArray(current[type]) ? current[type].length : 1) : 0);
            }, 0);
            
            const maxTypeScore = (includeType && targetType) ? 1 : 0;
            const maxPossibleScore = 2 + relationTypeScore + maxTypeScore;
            
            const confidence = (totalScore / maxPossibleScore) * 100;
            
            if (debug) {
                dv.paragraph(`${concept.file.name}: path=${pathScore}, type=${conceptTypeScore}, relations=${relationScores}, total=${totalScore}/${maxPossibleScore} = ${confidence.toFixed(2)}%`);
            }
            
            console.log(`${concept.file.name}: path=${pathScore}, relations=${relationScores}, total=${totalScore}/${maxPossibleScore} = ${confidence}%`);
            
            return { 
                concept, 
                confidence,
                inSamePath: pathScore > 0 
            };
        });
        
        if (debug) {
            dv.paragraph("---");
            dv.paragraph(`**Step 5: Applying filters**`);
            dv.paragraph(`Subject filter: ${subject || currentSubject}`);
            dv.paragraph(`Strict path mode: ${strictPath}`);
            dv.paragraph(`Minimum confidence: > 0%`);
        }
        
        const filtered = results
            .filter(r => !strictPath || r.inSamePath) // Only include same-path files if strictPath is true
            .sort((a, b) => b.confidence - a.confidence)
            .filter(r => r.confidence > 0)
            .filter(r => r.concept.subject === (subject || currentSubject));
            
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
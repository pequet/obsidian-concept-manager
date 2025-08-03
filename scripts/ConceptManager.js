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
     */
    getConceptsByRelationType({ dv, relationType, relationValue, relationSubject = null }) {
        const searchValues = Array.isArray(relationValue) ? relationValue : [relationValue];
        console.log(`Searching ${relationType} for values:`, searchValues);

        return dv.pages()
            .where(p => {
                // Currently filters for pages with domain: concepts or patterns
                if (!['concepts', 'patterns'].includes(p.domain)) return false;
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
     */
    getRelatedConcepts({ dv, relationTypes = ["levels", "units"], subject, strictPath = false }) {
        const current = dv.current();
        
        // VALID FILTERS: relationTypes is already filtered by the caller (generateConceptsAnalysis)
        // so we don't need to filter it again here
        
        // Get files in same directory structure
        const samePathFiles = this.getFilesInSamePath({ dv, currentPath: current.file.path });
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
    
        // Then check each relation type for matches
        relationTypes.forEach(relationType => {
            const values = current[relationType];
            if (!values) return;
    
            const currentValues = Array.isArray(values) ? values : [values];
            const selfScore = currentValues.length;
    
            const concepts = this.getConceptsByRelationType({
                dv,
                relationType,
                relationValue: values,
                relationSubject: currentSubject
            });
    
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
            });
        });
    
        // Calculate final scores and confidence
        const results = Array.from(relatedConcepts.values()).map(({ concept, scores }) => {
            const pathScore = scores.get("path") || 0;
            const relationScores = Array.from(scores.values())
                .reduce((sum, score) => sum + score, 0) - pathScore;
            
            const totalScore = pathScore + relationScores;
            
            // VALID FILTERS: Only consider the filtered relationTypes in maxPossibleScore
            const maxPossibleScore = 2 + relationTypes.reduce((sum, type) => {
                return sum + (current[type] ? 
                    (Array.isArray(current[type]) ? current[type].length : 1) : 0);
            }, 0);
            
            const confidence = (totalScore / maxPossibleScore) * 100;
            
            console.log(`${concept.file.name}: path=${pathScore}, relations=${relationScores}, total=${totalScore}/${maxPossibleScore} = ${confidence}%`);
            
            return { 
                concept, 
                confidence,
                inSamePath: pathScore > 0 
            };
        });
    
        return results
            .filter(r => !strictPath || r.inSamePath) // Only include same-path files if strictPath is true
            .sort((a, b) => b.confidence - a.confidence)
            .filter(r => r.confidence > 0)
            .filter(r => r.concept.subject === subject);
    }
} 
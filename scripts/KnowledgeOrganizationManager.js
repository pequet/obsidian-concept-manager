/*
 *  ███   Knowledge Organization Manager
 * █ ███  Version: 1.0.0
 * █ ███  Author: Benjamin Pequet
 *  ███   GitHub: https://github.com/pequet/obsidian-concept-manager/
 *
 * Purpose:
 *   A CustomJS class for managing knowledge organization and metadata validation
 *   in Obsidian.
 *
 * Prerequisites:
 *   - DataView plugin
 *   - CustomJS plugin
 *
 * Usage:
 *   - Simple Organization Table (accordion view)
 *   ```dataviewjs
 *   customJS.KnowledgeOrganizationManager.renderSimpleOrganizationTable(dv, 'field-name', dv.current().subject);
 *   ```
 * 
 *   - Organization Tree View
 *   ```dataviewjs
 *   const { KnowledgeOrganizationManager } = customJS;
 *   KnowledgeOrganizationManager.renderOrganizationTree({ dv });
 *   ```
 */

class KnowledgeOrganizationManager {
    constructor() {
        console.log("KnowledgeOrganizationManager class loaded and ready 👾");

        // Initialize performance tracking
        this.perf = {
            enabled: false,
            logToConsole: false
        };
        this._perfTotals = new Map();
        this._callCounts = new Map();
    }

    // Performance and utility methods
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
                console.debug('[KnowledgeOrganizationManager][perf]', token.label, payload);
            } else if (console.log) {
                console.log('[KnowledgeOrganizationManager][perf]', token.label, payload);
            }
        }
    }

    _getNowMs() {
        return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    }

    _formatTimestamp(date = new Date()) {
        const pad = (n) => String(n).padStart(2, '0');
        const yyyy = date.getFullYear();
        const mm = pad(date.getMonth() + 1);
        const dd = pad(date.getDate());
        const hh = pad(date.getHours());
        const min = pad(date.getMinutes());
        const ss = pad(date.getSeconds());
        return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
    }

    _renderTimestamp({ dv, label = 'Rendered at', durationMs = null } = {}) {
        if (!dv) return;
        const ts = this._formatTimestamp(new Date());
        const hasBuild = (typeof durationMs === 'number' && isFinite(durationMs));
        const buildMs = hasBuild ? Math.round(durationMs) : null;
        const buildAttr = hasBuild ? ` data-kom-build-ms="${buildMs}"` : '';
        const extraText = hasBuild ? `(build: ${buildMs}ms)` : '';
        
        // Use el.innerHTML for proper HTML rendering
        const tsDiv = dv.el("div", "");
        tsDiv.innerHTML = `<div data-kom-ts="1" class="kom-ts"${buildAttr} style="color:#888; font-size:0.9em; margin-top:6px;"><span class="kom-ts-label">${label}</span>: <span class="kom-ts-time">${ts}</span><span class="kom-ts-extra">${extraText}</span></div>`;
    }

    _incrementCallCount(methodName) {
        const count = this._callCounts.get(methodName) || 0;
        this._callCounts.set(methodName, count + 1);
    }

    // Helper methods for data gathering and organization
    _isArchivedPath(p) {
        const path = String(p.file.path).toLowerCase();
        return path.includes('/archives/') || path.includes('/4. archives/');
    }

    _getCurrentPageSubject(dv) {
        const currentPage = dv.current();
        let currentSubject = null;

        // Try to get the actual current page subject
        if (currentPage && currentPage.subject) {
            currentSubject = currentPage.subject;
        } else {
            // Alternative method: try to find this specific file by name pattern
            const currentFileName = currentPage?.file?.name;
            if (currentFileName) {
                const thisFile = dv.pages().where(p => p.file.name === currentFileName).first();
                if (thisFile && thisFile.subject) {
                    currentSubject = thisFile.subject;
                }
            }
        }

        return currentSubject;
    }

    _getFieldDisplayName(fieldName) {
        return fieldName.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    _findMasterValidationFile(dv, currentSubject, fieldName) {
        return dv.pages()
            .where(p => 
                p.subject === currentSubject &&
                (p.domain === "knowledge-organization" || p.domain === "methods") &&
                p["validates-field"] === fieldName
            )
            .first();
    }
    
    _findGeneralMasterValidationFile(dv, fieldName) {
        return dv.pages()
            .where(p => 
                p.subject === "General" &&
                (p.domain === "knowledge-organization" || p.domain === "methods") &&
                p["validates-field"] === fieldName
            )
            .first();
    }

    async _parseApprovedCategories(masterCategoriesFile, dv) {
        const approvedCategories = [];
        const categoryDefinitions = new Map();
        
        if (!masterCategoriesFile) {
            return { approvedCategories, categoryDefinitions };
        }

        // Parse the markdown tables to extract category names
        let fileContent = null;
        try {
            // Use app.vault.cachedRead with proper async handling
            const file = app.vault.getAbstractFileByPath(masterCategoriesFile.file.path);
            if (file) {
                fileContent = await app.vault.cachedRead(file);
            } else {
                // Alternative: try to read the file contents using dv.io.load
                try {
                    fileContent = dv.io.load(masterCategoriesFile.file.path);
                    // If dv.io.load returns a Promise, await it
                    if (fileContent && typeof fileContent.then === 'function') {
                        fileContent = await fileContent;
                    }
                } catch (ioError) {
                    fileContent = null;
                }
            }
        } catch (error) {
            fileContent = null;
        }
        
        if (fileContent && typeof fileContent === 'string') {
            // Look for category names in backticks in the table rows
            const lines = fileContent.split('\n');
            lines.forEach(line => {
                // Match lines that contain category definitions with backticks
                // Format: | `category-name` | Definition text | Usage context |
                const fullMatch = line.match(/^\|\s*`([^`]+)`\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/);
                if (fullMatch) {
                    const category = fullMatch[1].trim();
                    const definition = fullMatch[2].trim();
                    const usageContext = fullMatch[3].trim();
                    
                    if (category && category !== 'Category') {
                        approvedCategories.push(category);
                        categoryDefinitions.set(category, {
                            definition: definition,
                            usageContext: usageContext
                        });
                    }
                } else {
                    // Fallback to simple category match for backwards compatibility
                    const categoryMatch = line.match(/^\|\s*`([^`]+)`\s*\|/);
                    if (categoryMatch) {
                        const category = categoryMatch[1].trim();
                        if (category && category !== 'Category') {
                            approvedCategories.push(category);
                            // Add a placeholder definition if not found above
                            if (!categoryDefinitions.has(category)) {
                                categoryDefinitions.set(category, {
                                    definition: "Validated category",
                                    usageContext: "Various"
                                });
                            }
                        }
                    }
                }
            });
        }

        return { approvedCategories, categoryDefinitions };
    }

    async _gatherCategoryData(dv, fieldName, currentSubject) {
        // Get approved categories from master validation file
        const masterCategoriesFile = this._findMasterValidationFile(dv, currentSubject, fieldName);
        const { approvedCategories, categoryDefinitions } = await this._parseApprovedCategories(masterCategoriesFile, dv);
        
        // Get General (Core) approved categories for cross-reference
        const generalMasterFile = this._findGeneralMasterValidationFile(dv, fieldName);
        const { approvedCategories: generalApprovedCategories = [], categoryDefinitions: generalCategoryDefinitions = new Map() } = 
            await this._parseApprovedCategories(generalMasterFile, dv);
            
        // Get all pages with matching subject, excluding archives
        const pages = dv.pages()
            .where(p => !this._isArchivedPath(p) && p.subject === currentSubject);

        // Get config file to determine root path for trimming
        const configFile = dv.pages()
            .where(p => p.type === "config")
            .first();

        let repoRoot = "";
        if (configFile) {
            const pathParts = configFile.file.path.split('/');
            repoRoot = pathParts.slice(0, 2).join('/');
        }

        // Initialize and collect all field values with their associated files
        const categoryMap = new Map();

        pages.forEach(p => {
            const categories = p[fieldName];
            if (categories) {
                const categoryArray = Array.isArray(categories) ? categories : [categories];
                
                categoryArray.forEach(cat => {
                    if (!categoryMap.has(cat)) {
                        categoryMap.set(cat, []);
                    }
                    categoryMap.get(cat).push({
                        link: p.file.link,
                        path: p.file.path,
                        page: p
                    });
                });
            }
        });

        return {
            categoryMap,
            approvedCategories,
            generalApprovedCategories,
            categoryDefinitions,
            generalCategoryDefinitions,
            masterCategoriesFile,
            generalMasterFile,
            pages,
            repoRoot
        };
    }

    // Rendering helper methods
    _renderDebugInfo(dv, currentSubject, fieldName, masterCategoriesFile, approvedCategories) {
        dv.header(3, "🐛 DEBUG: Functional Organization Analysis");
        dv.paragraph(`**Current Subject:** "${currentSubject}"`);
        dv.paragraph(`**Looking for field validation:** "${fieldName}"`);
        dv.paragraph(`**Master Categories File:** ${masterCategoriesFile ? 'Found' : 'Not Found'}`);
        if (masterCategoriesFile) {
            dv.paragraph(`**Master Categories File Path:** ${masterCategoriesFile.file.path}`);
        } else {
            dv.paragraph("**Master File Search Failed - Frontmatter criteria not met:**");
            
            // Check each condition separately using frontmatter
            const subjectMatches = dv.pages().where(p => p.subject === currentSubject);
            dv.paragraph(`  • Files with subject=${currentSubject}: ${subjectMatches.length}`);
            
            const domainMatches = dv.pages().where(p => p.subject === currentSubject && 
                (p.domain === "knowledge-organization" || p.domain === "methods"));
            dv.paragraph(`  • Files with subject + domain: ${domainMatches.length}`);
            
            const validatesFieldMatches = dv.pages().where(p => p.subject === currentSubject && 
                (p.domain === "knowledge-organization" || p.domain === "methods") &&
                p["validates-field"] === fieldName);
            dv.paragraph(`  • Files with all criteria + validates-field match: ${validatesFieldMatches.length}`);
            
            // Show what we actually found
            if (domainMatches.length > 0) {
                dv.paragraph("**Found files with matching subject + domain:**");
                domainMatches.forEach(f => {
                    const validatesFieldMatch = f["validates-field"] === fieldName;
                    dv.paragraph(`    • ${f.file.name} (domain: "${f.domain}", validates-field match: ${validatesFieldMatch})`);
                    dv.paragraph(`      validates-field: "${f["validates-field"]}"`);
                });
            }
        }
        dv.paragraph(`**Approved Categories:** ${approvedCategories.length} loaded`);
    }

    _renderSummaryStats(dv, categoryMap, approvedCategories, fieldName, generalApprovedCategories = []) {
        const totalCategories = Array.from(categoryMap.keys()).length;
        const projectValidCategories = Array.from(categoryMap.keys()).filter(cat => approvedCategories.includes(cat)).length;
        const generalValidCategories = Array.from(categoryMap.keys()).filter(cat => !approvedCategories.includes(cat) && generalApprovedCategories.includes(cat)).length;
        const validCategories = projectValidCategories + generalValidCategories;
        const needsReview = totalCategories - validCategories;
        
        dv.paragraph(`**Total Categories:** ${totalCategories} | **✅ Project Validated:** ${projectValidCategories} | **🔄 Core Framework:** ${generalValidCategories} | **❓ Needs Review:** ${needsReview}`);
    }

    _renderLegendAndValidation(dv, fieldName, fieldDisplayName, masterCategoriesFile, approvedCategories, currentSubject, categoryDefinitions = new Map(), generalApprovedCategories = [], generalMasterFile = null) {
        // Legend
        dv.header(2, "Legend");
        dv.paragraph(`**✅** = Validated in this project's Master ${fieldDisplayName} file`);
        dv.paragraph(`**🔄** = Core Framework category (validated in General subject)`);
        dv.paragraph("**❓** = Needs review and validation");
        dv.paragraph("**(number)** = Usage count across the vault");

        // Show validation status at bottom
        if (masterCategoriesFile) {
            dv.paragraph(`**Project Validation:** ${approvedCategories.length} approved ${fieldName} categories loaded from [[${masterCategoriesFile.file.name}]]`);
        } else {
            dv.paragraph(`**Project Validation:** No master validation file found for subject "${currentSubject}".`);
        }
        
        if (generalMasterFile && generalApprovedCategories.length > 0) {
            dv.paragraph(`**Core Validation:** ${generalApprovedCategories.length} approved ${fieldName} categories loaded from ${generalMasterFile.file.link}`);
        }
    }

    /**
     * Renders a simple alphabetical table of categories with validation status using accordion view.
     * 
     * @param {Object} dv - Dataview API object
     * @param {string} fieldName - Field name to analyze (e.g., 'domain-category', 'type', 'status')
     * @param {string} currentSubject - Current page subject for filtering
     * @param {boolean} [showDefinitions=null] - Show definitions column (auto-detected if null)
     * @param {boolean} [debug=false] - Show detailed debug output
     * @returns {void} Renders directly to the page
     */
    async renderSimpleOrganizationTable(dv, fieldName = 'domain-category', currentSubject, showDefinitions = null, debug = false) {
        const __wallStartMs = this._getNowMs(); // wall-clock start independent of perf logging
        const __perfMethod = this._perfStart('renderSimpleOrganizationTable');
        this._incrementCallCount('renderSimpleOrganizationTable');

        if (!currentSubject) {
            dv.header(2, "⚠️ Cannot Read Current Page Subject");
            dv.paragraph("The DataviewJS query cannot access the current page's `subject` frontmatter field.");
            this._perfEnd(__perfMethod, { error: 'no_subject' });
            return;
        }

        // Gather category data using helper function
        const { 
            categoryMap, 
            approvedCategories, 
            generalApprovedCategories = [], 
            categoryDefinitions, 
            generalCategoryDefinitions = new Map(),
            masterCategoriesFile, 
            generalMasterFile,
            pages, 
            repoRoot 
        } = await this._gatherCategoryData(dv, fieldName, currentSubject);

        // Auto-determine showDefinitions if not explicitly set
        if (showDefinitions === null) {
            showDefinitions = masterCategoriesFile ? true : false;
        }

        const fieldDisplayName = this._getFieldDisplayName(fieldName);

        // Show debug information if requested
        if (debug) {
            this._renderDebugInfo(dv, currentSubject, fieldName, masterCategoriesFile, approvedCategories);
        }

        if (categoryMap.size === 0) {
            dv.paragraph(`No ${fieldName} values found in the vault.`);
            this._perfEnd(__perfMethod, { categories: 0 });
            return;
        }

        // Summary stats
        this._renderSummaryStats(dv, categoryMap, approvedCategories, fieldName, generalApprovedCategories);

        // Create accordion table - single HTML table with collapsible rows
        const categories = Array.from(categoryMap.keys()).sort(); // Alphabetical sort
        
        // Start building HTML for the table
        let htmlContent = `
        <table class="metadata-validation-table">
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Usage</th>
                    ${showDefinitions ? '<th>Description</th>' : ''}
                </tr>
            </thead>
            <tbody>
        `;

        // Build table rows with accordion WITH validation indicators and proper columns
        categories.forEach(cat => {
            const files = categoryMap.get(cat);
            const usageCount = files.length;
            const fileText = usageCount === 1 ? "file" : "files";
            
            // Determine indicator based on whether the category is in the master list
            const isValid = approvedCategories.includes(cat);
            const isGeneralValid = generalApprovedCategories && generalApprovedCategories.includes(cat);
            let indicator = '❓';
            
            if (isValid) {
                indicator = '✅'; // Validated in this project
            } else if (isGeneralValid) {
                indicator = '🔄'; // Core Framework category
            }
            
            // Get description from master validation file if available
            let description = "";
            if (showDefinitions) {
                if (isValid && categoryDefinitions.has(cat)) {
                    // Use project-specific definition
                    const catInfo = categoryDefinitions.get(cat);
                    description = catInfo.definition;
                } else if (isGeneralValid && generalCategoryDefinitions.has(cat)) {
                    // Use Core Framework definition if no project-specific definition exists
                    const catInfo = generalCategoryDefinitions.get(cat);
                    description = catInfo.definition + " _(Core Framework)_";
                } else {
                    description = ""; // Empty for unvalidated categories when showing definitions
                }
            }

            // Create file links list with simple file names - properly formatted for Obsidian internal links
            const fileLinks = files.map(f => {
                const fileName = f.page.file.name;
                const filePath = f.page.file.path;
                // Format that works in HTML rendering for Obsidian internal links
                return `<a class="internal-link" data-href="${filePath}" data-file="${fileName}">${fileName}</a>`;
            }).join(', ');
            
            // Add row with accordion WITH indicators and correct columns
            htmlContent += `
                <tr>
                    <td><span class="metadata-indicator">${indicator}</span> <code class="metadata-category">${cat}</code></td>
                    <td><span class="metadata-count">${usageCount} ${fileText}</span></td>
                    ${showDefinitions ? `<td>${description}</td>` : ''}
                </tr>
                <tr class="file-details-row">
                    <td colspan="${showDefinitions ? '3' : '2'}" class="file-details-cell">
                        <details class="metadata-accordion">
                            <summary class="metadata-summary">
                                Files (click to view)
                            </summary>
                            <div class="metadata-files">
                                ${fileLinks}
                            </div>
                        </details>
                    </td>
                </tr>
            `;
        });

        // Close the table
        htmlContent += `
            </tbody>
        </table>
        <style>
            .metadata-validation-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
            }
            .metadata-validation-table th,
            .metadata-validation-table td {
                text-align: left;
                padding: 6px;
                border-bottom: 1px solid #eee;
                vertical-align: top;
            }
            .metadata-validation-table th {
                border-bottom: 2px solid #ddd;
                font-weight: bold;
            }
            .file-details-row td {
                padding: 0;
            }
            .file-details-cell {
                padding: 0 !important;
            }
            .metadata-indicator {
                margin-right: 6px;
            }
            .metadata-category {
                margin-right: 6px;
                font-weight: bold;
            }
            .metadata-count {
                color: #666;
                font-size: 0.9em;
            }
            .metadata-files {
                padding: 6px 12px;
                background-color: rgba(0,0,0,0.02);
                margin-bottom: 8px;
                font-size: 0.95em;
                border-bottom: 1px solid #eee;
            }
            .metadata-description {
                margin-top: 4px;
            }
            /* Hide default triangles */
            .metadata-accordion summary::-webkit-details-marker,
            .metadata-accordion summary::marker {
                display: none;
                content: '';
            }
            .metadata-summary {
                cursor: pointer;
                padding: 4px 8px;
                background: rgba(0,0,0,0.03);
                display: inline-block;
            }
        </style>
        `;

        // Render the table - use el.innerHTML for proper HTML rendering
        const containerDiv = dv.el("div", "");
        containerDiv.innerHTML = htmlContent;

        // Render legend and validation information
        this._renderLegendAndValidation(dv, fieldName, fieldDisplayName, masterCategoriesFile, approvedCategories, 
            currentSubject, categoryDefinitions, generalApprovedCategories, generalMasterFile);

        // Add timestamp and performance info
        const __duration = this._getNowMs() - __wallStartMs;
        this._renderTimestamp({ dv, label: 'Table rendered at', durationMs: __duration });

        this._perfEnd(__perfMethod, { 
            categories: categoryMap.size,
            pages: pages.length,
            approvedCategories: approvedCategories.length
        });
    }

    /**
     * Renders a tree view of domain categories using dashes as folder/subfolder hierarchy
     * Shows the category organization in namespace structure like a wireframe
     * 
     * @param {Object} params - Parameters object
     * @param {Object} params.dv - Dataview API object
     * @param {string} [params.fieldName='domain-category'] - Field name to analyze (e.g., 'domain-category', 'type', 'status')
     * @param {boolean} [params.debug=false] - Show detailed debug output
     * @returns {void} Renders the tree directly to the page
     */
    async renderOrganizationTree({ dv, fieldName = 'domain-category', debug = false }) {
        // Unconditional wall-clock start so duration is meaningful even if perf logging disabled
        const __wallStartMs = this._getNowMs();
        const __perfMethod = this._perfStart('renderOrganizationTree');
        this._incrementCallCount('renderOrganizationTree');

        // Get current page's subject for filtering
        const currentSubject = this._getCurrentPageSubject(dv);

        if (!currentSubject) {
            dv.header(2, "⚠️ Cannot Read Current Page Subject");
            dv.paragraph("The DataviewJS query cannot access the current page's `subject` frontmatter field.");
            this._perfEnd(__perfMethod, { error: 'no_subject' });
            return;
        }

        // Gather category data using helper function
        const { 
            categoryMap, 
            approvedCategories, 
            generalApprovedCategories = [], 
            categoryDefinitions, 
            generalCategoryDefinitions = new Map(),
            masterCategoriesFile, 
            generalMasterFile,
            pages, 
            repoRoot 
        } = await this._gatherCategoryData(dv, fieldName, currentSubject);

        const fieldDisplayName = this._getFieldDisplayName(fieldName);

        // Show debug information if requested
        if (debug) {
            this._renderDebugInfo(dv, currentSubject, fieldName, masterCategoriesFile, approvedCategories);
        }

        if (categoryMap.size === 0) {
            dv.paragraph(`No ${fieldName} values found in the vault.`);
            this._perfEnd(__perfMethod, { categories: 0 });
            return;
        }

        // Summary stats
        this._renderSummaryStats(dv, categoryMap, approvedCategories, fieldName, generalApprovedCategories);

        // Build tree structure based on dashes
        const tree = new Map();
        const categories = Array.from(categoryMap.keys());

        categories.forEach(cat => {
            const files = categoryMap.get(cat);
            const isProjectValid = approvedCategories.includes(cat);
            const isGeneralValid = generalApprovedCategories.includes(cat);
            
            // Set indicator based on validation: project-specific, Core Framework, or needs validation
            let indicator;
            if (isProjectValid) {
                indicator = '✅'; // Validated in this project
            } else if (isGeneralValid) {
                indicator = '🔄'; // Core Framework category
            } else {
                indicator = '❓'; // Needs validation
            }
            const usageCount = files.length;
            
            // Split by dashes to create hierarchy
            const parts = cat.split('-');
            let currentLevel = tree;
            
            // Build the tree path
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const isLastPart = i === parts.length - 1;
                
                if (!currentLevel.has(part)) {
                    currentLevel.set(part, {
                        children: new Map(),
                        isCategory: false,
                        fullName: '',
                        indicator: '',
                        usageCount: 0
                    });
                }
                
                const node = currentLevel.get(part);
                
                if (isLastPart) {
                    // This is the final category
                    node.isCategory = true;
                    node.fullName = cat;
                    node.indicator = indicator;
                    node.usageCount = usageCount;
                }
                
                currentLevel = node.children;
            }
        });

        // Render the tree
        const renderTreeLevel = (level, indent = '') => {
            const entries = Array.from(level.entries()).sort(([a], [b]) => a.localeCompare(b));
            const lines = [];
            
            entries.forEach(([key, node], index) => {
                const isLast = index === entries.length - 1;
                const connector = isLast ? '└── ' : '├── ';
                const nextIndent = indent + (isLast ? '    ' : '│   ');
                
                if (node.isCategory) {
                    // This is a full category - show with validation status
                    lines.push(`${indent}${connector}${node.indicator} \`${node.fullName}\` (${node.usageCount})`);
                } else {
                    // This is just a namespace folder
                    lines.push(`${indent}${connector}**${key}-**`);
                }
                
                // Render children
                if (node.children.size > 0) {
                    lines.push(...renderTreeLevel(node.children, nextIndent));
                }
            });
            
            return lines;
        };

        dv.header(2, "Category Tree Structure");
        const treeLines = renderTreeLevel(tree);
        dv.paragraph("```\n" + treeLines.join('\n') + "\n```");

        // Render legend and validation information
        this._renderLegendAndValidation(dv, fieldName, fieldDisplayName, masterCategoriesFile, approvedCategories, currentSubject, categoryDefinitions, generalApprovedCategories, generalMasterFile);

        // Add timestamp and performance info
        // Use wall start (independent of perf logging) for accurate duration
        const __duration = this._getNowMs() - __wallStartMs;
        this._renderTimestamp({ dv, label: 'Tree rendered at', durationMs: __duration });

        this._perfEnd(__perfMethod, { 
            categories: categoryMap.size,
            pages: pages.length,
            approvedCategories: approvedCategories.length
        });
    }
}

// Register the class instance in customJS
customJS.KnowledgeOrganizationManager = new KnowledgeOrganizationManager();

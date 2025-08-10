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
        this._smarterCache = new Map(); // key -> lastRenderedHTML
    }

    // --- Public Methods ---
    
    /**
     * Minimal DV proxy creator that captures render calls (header, paragraph, list, table)
     * into markdown and renders them into a target element. Data methods (current, pages, fileLink)
     * delegate to the real dv.
     *
     * This allows calling ConceptManager.generateSmartView() unchanged while directing
     * its output into a specific slot.
     *
     * @param {Object} params
     * @param {Object} params.dv - The real Dataview API
     * @param {HTMLElement} params.targetElement - Where to render captured output
     * @param {string} params.sourcePath - Current page path for markdown link resolution
     * @returns {Object} dvProxy
     */
    _createDvProxy({ dv, targetElement, sourcePath }) {
        const recordedOps = []; // retained but unused with direct rendering path

        const escapePipes = (text) => String(text).replace(/\|/g, '\\|');
        const toDisplayName = (path, fallback) => {
            try {
                const name = path?.split('/')?.pop() || fallback || '';
                return name.replace(/\.md$/i, '');
            } catch (_) {
                return fallback || '';
            }
        };

        const isFileLinkToken = (v) => v && typeof v === 'object' && v.__kind === 'file-link';
        const tryCoerceDataviewLink = (v) => {
            // Handles dv link-like objects used in existing code (e.g., r.concept.file.link)
            try {
                const path = v?.path || v?.file?.path;
                const display = v?.display || v?.file?.name || null;
                if (path) return { __kind: 'file-link', path, embed: false, display };
            } catch (_) { /* ignore */ }
            return null;
        };

        const cellToMarkdown = (cell) => {
            if (cell == null) return '';
            if (isFileLinkToken(cell)) {
                const display = cell.display || toDisplayName(cell.path, '');
                return cell.embed
                    ? `![[${cell.path}|${display}]]`
                    : `[[${cell.path}|${display}]]`;
            }
            const maybeLink = tryCoerceDataviewLink(cell);
            if (maybeLink) return cellToMarkdown(maybeLink);
            if (typeof cell === 'string') return escapePipes(cell);
            if (typeof cell === 'number' || typeof cell === 'boolean') return String(cell);
            try {
                return escapePipes(String(cell));
            } catch (_) {
                return '';
            }
        };

        const renderMarkdownTo = (markdown) => {
            // Prefer Obsidian's MarkdownRenderer when available
            try {
                const OBS = (typeof window !== 'undefined' && window.obsidian) ? window.obsidian : undefined;
                if (OBS && OBS.MarkdownRenderer && typeof OBS.MarkdownRenderer.renderMarkdown === 'function') {
                    OBS.MarkdownRenderer.renderMarkdown(markdown, targetElement, sourcePath || '/', null);
                    return;
                }
                const MR = (typeof MarkdownRenderer !== 'undefined') ? MarkdownRenderer : (typeof window !== 'undefined' ? window.MarkdownRenderer : undefined);
                if (MR && typeof MR.renderMarkdown === 'function') {
                    MR.renderMarkdown(markdown, targetElement, sourcePath || '/', null);
                    return;
                }
                const APP = (typeof app !== 'undefined') ? app : (typeof window !== 'undefined' ? window.app : undefined);
                if (MR && APP && typeof MR.render === 'function') {
                    MR.render(APP, markdown, targetElement, sourcePath || '/', null);
                    return;
                }
            } catch (_) { /* fallback below */ }
            // Fallback: inject as-is (markdown not rendered)
            targetElement.textContent = markdown;
        };

        const withContainer = (fn) => {
            const prev = dv.container;
            try {
                dv.container = targetElement;
                return fn();
            } finally {
                dv.container = prev;
            }
        };

        const dvProxy = {
            // Data passthrough
            current: (...args) => dv.current(...args),
            pages: (...args) => dv.pages(...args),
            fileLink: (...args) => dv.fileLink(...args),

            // Direct render into slot using real Dataview (ensures Obsidian rendering)
            header: (level, text) => withContainer(() => dv.header(level, text)),
            paragraph: (text) => withContainer(() => dv.paragraph(text)),
            list: (items) => withContainer(() => dv.list(items)),
            table: (columns, rows) => withContainer(() => dv.table(columns, rows)),

            // Controls
            flush: () => {},
            getHtml: () => {
                // Not strictly HTML unless markdown is rendered; return compiled markdown
                let md = '';
                for (const op of recordedOps) {
                    if (op.type === 'header') md += `${'#'.repeat(op.level)} ${op.text}\n\n`;
                    else if (op.type === 'paragraph') md += `${op.markdown}\n\n`;
                    else if (op.type === 'list') md += op.items.map(i => `- ${i}`).join('\n') + '\n\n';
                    else if (op.type === 'table') {
                        const head = `| ${op.columns.map(escapePipes).join(' | ')} |\n`;
                        const sep = `| ${op.columns.map(() => '---').join(' | ')} |\n`;
                        const body = op.rows.map(row => `| ${row.map(cellToMarkdown).join(' | ')} |`).join('\n') + '\n\n';
                        md += head + sep + body;
                    }
                }
                return md.trim();
            },
            clear: () => { recordedOps.length = 0; }
        };

        return dvProxy;
    }

    /**
     * Orchestrated smart rendering: runs generateSmartView once per section,
     * capturing output into ordered placeholders via the DV proxy. Does not modify
     * ConceptManager.generateSmartView.
     *
     * @param {Object} dv - Dataview API
     * @param {Object} options
     * @param {Array<string>} [options.sections=['relatedContent','directConnections','relatedHubs']] - Sections to run
     * @param {number} [options.headerLevel=2] - Header level to pass through
     * @param {number} [options.concurrency=1] - Max concurrent section builds (UI-friendly: 1–2)
     * @param {boolean} [options.debug=false] - Wrapper-level debug logging
     */
    renderSmarterView(dv, { sections = ['directConnections', 'relatedContent', 'relatedHubs'], headerLevel = 2, concurrency = 1, debug = false, observeQuietMs = 200, observeMaxWaitMs = 3000, collapseEmptySections = true } = {}) {
        const { ConceptManager } = customJS;

        // Root container and ordered slots
        const root = dv.el('div', '');
        const sourcePath = dv.current()?.file?.path || '/';
        const makeKey = (section) => `${sourcePath}::${section}::h${headerLevel}`;
        if (debug && console && console.log) {
            console.log('[SmarterView] init', {
                sections,
                headerLevel,
                concurrency,
                observeQuietMs,
                observeMaxWaitMs,
                sourcePath
            });
        }
        const slots = sections.map((section) => {
            const slot = document.createElement('div');
            slot.setAttribute('data-section', section);
            slot.style.minHeight = '1em';
            slot.style.marginBottom = '0.5rem';
            const cached = this._smarterCache.get(makeKey(section));
            if (cached !== undefined) {
                // Pre-fill from cache to avoid flash on DV reruns
                if (collapseEmptySections && cached === '') {
                    // Previously known empty: keep collapsed
                    slot.style.display = 'none';
                    slot.style.minHeight = '0';
                    slot.style.marginBottom = '0';
                    slot.innerHTML = '';
                } else {
                    slot.innerHTML = cached;
                }
            } else if (debug) {
                slot.textContent = `Loading ${section}…`;
            }
            root.appendChild(slot);
            return slot;
        });

        // Create tasks
        const tasks = sections.map((section, index) => () => new Promise((resolve) => {
            // Yield to let placeholders paint
            setTimeout(() => {
                let staging = null;
                try {
                if (debug && console && console.log) console.log('[SmarterView] start', { section, index });
                    // Create an off-screen staging container attached to DOM so async renderers can complete
                    staging = document.createElement('div');
                    staging.setAttribute('data-staging', section);
                    staging.style.position = 'absolute';
                    staging.style.left = '-10000px';
                    staging.style.top = '-10000px';
                    staging.style.width = '0';
                    staging.style.height = '0';
                    staging.style.overflow = 'hidden';
                    document.body.appendChild(staging);
                if (debug && console && console.log) console.log('[SmarterView] staging attached', { section, index });

                    const dvProxy = this._createDvProxy({ dv, targetElement: staging, sourcePath });
                    ConceptManager.generateSmartView({
                        dv: dvProxy,
                        headerLevel,
                        enabledSteps: [section],
                    // Force ConceptManager debug off; wrapper handles its own logging
                    debug: false
                    });
                if (debug && console && console.log) console.log('[SmarterView] CM invoked', { section, index });

                    // Wait for DOM mutations to settle before committing to the visible slot
                    const startedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                    const key = makeKey(section);
                const quietMs = Number(observeQuietMs) || 200; // no mutations for this long => commit
                const maxWaitMs = Number(observeMaxWaitMs) || 3000; // hard cap
                    let lastMutationAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

                    const observer = new MutationObserver(() => {
                        lastMutationAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                    });
                    observer.observe(staging, { childList: true, subtree: true, characterData: true });
                if (debug && console && console.log) console.log('[SmarterView] observer attached', { section, index, quietMs, maxWaitMs });

                    const tick = () => {
                        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                        const quietFor = now - lastMutationAt;
                        const waited = now - startedAt;
                        const hasAnyContent = staging.querySelector('table, tr, td, th, ul, li, p, h1, h2, h3, h4, h5, h6') || (staging.textContent || '').trim().length > 0;
                        if ((hasAnyContent && quietFor >= quietMs) || waited >= maxWaitMs) {
                            observer.disconnect();
                            const rawHtml = staging.innerHTML;
                            const hadCache = this._smarterCache.has(key);
                            const oldHtml = hadCache ? this._smarterCache.get(key) : '';

                            // Determine if result has meaningful visible content
                            const meaningfulNode = staging.querySelector('table tr, td, th, ul li, ol li, h1, h2, h3, h4, h5, h6, a[href], img, pre, code, blockquote');
                            const hasMeaningfulText = ((staging.textContent || '').trim().length > 0);
                            const isMeaningful = Boolean(meaningfulNode || hasMeaningfulText);

                            const newHtml = (collapseEmptySections && !isMeaningful) ? '' : rawHtml;
                            const changed = (!hadCache) || (newHtml !== oldHtml);

                            if (debug && console && console.log) {
                                const tableRows = staging.querySelectorAll('table tr').length;
                                const cellCount = staging.querySelectorAll('td, th').length;
                                console.log('[SmarterView] commit', { section, index, quietFor, waited, tableRows, cellCount, isMeaningful, changed, timedOut: waited >= maxWaitMs });
                            }

                            if (changed) {
                                if (newHtml === '') {
                                    // Collapse empty section
                                    slots[index].innerHTML = '';
                                    slots[index].style.display = 'none';
                                    slots[index].style.minHeight = '0';
                                    slots[index].style.marginBottom = '0';
                                    this._smarterCache.set(key, '');
                                    if (debug && console && console.log) console.log('[SmarterView] collapsed (empty)', { section, index });
                                } else {
                                    // Show populated section
                                    const frag = document.createDocumentFragment();
                                    while (staging.firstChild) frag.appendChild(staging.firstChild);
                                    slots[index].replaceChildren(frag);
                                    slots[index].style.display = '';
                                    slots[index].style.minHeight = '1em';
                                    slots[index].style.marginBottom = '0.5rem';
                                    this._smarterCache.set(key, newHtml);
                                    if (debug && console && console.log) console.log('[SmarterView] updated', { section, index, bytes: newHtml.length });
                                }
                            } else if (!isMeaningful && collapseEmptySections) {
                                // Ensure collapsed state even if unchanged
                                slots[index].innerHTML = '';
                                slots[index].style.display = 'none';
                                slots[index].style.minHeight = '0';
                                slots[index].style.marginBottom = '0';
                                // Prime cache if missing so future runs don't show loading
                                if (!hadCache) this._smarterCache.set(key, '');
                                if (debug && console && console.log) console.log('[SmarterView] unchanged (still empty, collapsed)', { section, index });
                            } else if (debug && console && console.log) {
                                console.log('[SmarterView] unchanged', { section, index });
                            }
                            if (staging && staging.parentNode) staging.parentNode.removeChild(staging);
                            if (debug && console && console.log) console.log('[SmarterView] done', { section, index, ms: Math.round(waited) });
                            resolve();
                        } else {
                            setTimeout(tick, 60);
                        }
                    };
                    setTimeout(tick, 80);
                } catch (err) {
                    if (console && console.error) console.error('[SmarterView] error', { section, index, err });
                    // Simple error display inside the slot
                    slots[index].textContent = `Error rendering ${section}: ${err?.message || err}`;
                    if (staging && staging.parentNode) staging.parentNode.removeChild(staging);
                    resolve();
                }
            }, 0);
        }));

        // Run with a simple concurrency limiter
        const runWithConcurrency = (fns, limit) => {
            const queue = [...fns];
            const workers = new Array(Math.max(1, Number(limit) || 1)).fill(0).map(async () => {
                while (queue.length > 0) {
                    const fn = queue.shift();
                    if (!fn) break;
                    await fn();
                }
            });
            return Promise.all(workers);
        };

        // Fire-and-forget; DVJS blocks are usually fine without awaiting here
        runWithConcurrency(tasks, concurrency);
    }







    
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
            enabledSteps: ['directConnections', 'relatedContent', 'relatedHubs'],
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
            enabledSteps: ['relatedContent'],
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
            enabledSteps: ['directConnections', 'relatedHubs'],
            debug
        });
    }

}

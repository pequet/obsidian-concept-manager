/*
 *  ███   Obsidian Concept Manager Wrappers (CustomJS)
 * █ ███  Version: 1.1.0
 * █ ███  Author: Benjamin Pequet
 *  ███   GitHub: https://github.com/pequet/obsidian-concept-manager/
 *
 * Purpose:
 *   High-stability, section-by-section orchestration around `ConceptManager.generateSmartView`.
 *   Streams each section as it becomes ready, diff-detects changes, collapses empty
 *   sections, and refreshes the UI only when content meaningfully changes.
 *
 *   Designed to remain stable even when Dataview auto-refreshes repeatedly; the
 *   wrapper compares new output to the last cached DOM (timestamps ignored) and
 *   updates only when necessary. This prevents flicker and redundant re-renders.
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
 *   // Zero-config: renders Classifications, Key Connections, Related Content, Related Hubs
 *   ConceptWrappers.renderSmarterView(dv);
 *
 *   // Optional overrides
 *   // ConceptWrappers.renderSmarterView(dv, {
 *   //     sections: ['contentClassifications', 'keyConnections', 'relatedContent', 'relatedHubs'],
 *   //     headerLevel: 2,
 *   //     concurrency: 2,              // 1 = sequential, >1 = interleaved builds
 *   //     observeQuietMs: 200,         // commit after DOM stays quiet for this long
 *   //     observeMaxWaitMs: 3000,      // hard cap to commit even if still mutating
 *   //     collapseEmptySections: true, // hide sections with no meaningful content
 *   //     debug: false
 *   // });
 *   ```
 *
 * Changelog:
 *   1.1.0 - 2025-08-10 - Overhaul: add `renderSmarterView` with caching, diff-aware
 *                         updates, concurrency limiting, and empty-section collapsing.
 *                         Remove legacy helpers `renderSmartView`, `renderLightSmartView`,
 *                         and `renderGroupSmartView`.
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
     * renderSmarterView — Stable, section-by-section Smart View with caching and concurrency.
     *
     * Overview:
     * - Runs `ConceptManager.generateSmartView` once per section using an off-screen staging
     *   container. A MutationObserver waits until rendering settles (no DOM mutations for
     *   `observeQuietMs`) or a hard cap (`observeMaxWaitMs`) is reached. The final DOM is then
     *   committed into a visible slot for that section.
     * - Uses a per-section cache (keyed by `currentFilePath::section::h<headerLevel>`) to compare
     *   the newly produced HTML with the last committed HTML. Timestamp nodes are stripped from
     *   both old and new before comparison, so changing clocks do not force re-renders.
     * - If there is no meaningful change, the UI is left untouched. This keeps the view stable
     *   under Dataview auto-refreshes.
     * - Empty/non-meaningful results can be collapsed entirely when `collapseEmptySections` is true.
     *
     * Concurrency model:
     * - `concurrency` controls how many section-build workers run at once. With `concurrency = 1`
     *   sections build sequentially in their listed order. With `concurrency > 1`, they are
     *   interleaved; whichever section settles first will display first. This is why a slower
     *   section started earlier may still appear after a faster one, and vice versa — completion
     *   order depends on actual render/settle time, not index order.
     * - Recommended starting point: `concurrency: 2` for a balance of responsiveness and load.
     *
     * Commit timing:
     * - Commit when DOM mutations have been quiet for `observeQuietMs` ms, or after
     *   `observeMaxWaitMs` ms as a safety cap if the stream of mutations never stops.
     *
     * @param {Object} dv - Dataview API instance.
     * @param {Object} options - Rendering options.
     * @param {Array<string>} [options.sections=['directConnections','relatedContent','relatedHubs']] - Sections to run.
     * @param {number} [options.headerLevel=2] - Header level passed through to ConceptManager.
     * @param {number} [options.concurrency=2] - Number of parallel section workers (1 = sequential).
     * @param {Array<string>} [options.prioritySections=[]] - Build scheduling priority (visual order unchanged).
     * @param {boolean} [options.debug=false] - Enable wrapper-level debug logs.
     * @param {number} [options.observeQuietMs=200] - Required quiet period (ms) before commit.
     * @param {number} [options.observeMaxWaitMs=3000] - Hard cap (ms) to force commit.
     * @param {boolean} [options.collapseEmptySections=true] - Hide sections with no meaningful content.
     * @param {boolean} [options.showTimestamp=true] - Pass-through to ConceptManager.
     * @param {boolean} [options.showTimeBuild=true] - Pass-through to ConceptManager.
     */
     renderSmarterView(dv, { sections = ['contentClassifications', 'keyConnections', 'relatedContent', 'relatedHubs'], headerLevel = 2, concurrency = 2, prioritySections = [], debug = false, observeQuietMs = 200, observeMaxWaitMs = 3000, collapseEmptySections = true, showTimestamp = true, showTimeBuild = false } = {}) {
        const { ConceptManager } = customJS;

        // Root container and ordered slots
        const root = dv.el('div', '');
        const sourcePath = dv.current()?.file?.path || '/';
        const makeKey = (section) => `${sourcePath}::${section}::h${headerLevel}`;
        const SECTION_LABELS = {
            contentClassifications: 'Classifications',
            keyConnections: 'Key Connections',
            relatedContent: 'Related Content',
            relatedHubs: 'Related Hubs'
        };
        if (debug && console && console.log) {
            console.log('[SmarterView] init', {
                sections,
                headerLevel,
                concurrency,
                prioritySections,
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
                    // Rehydrate cached HTML; keep as-is (contains timestamps)
                    slot.innerHTML = cached;
                }
            } else {
                const label = SECTION_LABELS[section] || section;
                slot.textContent = `Loading ${label}…`;
            }
            root.appendChild(slot);
            return slot;
        });

        // Create per-section tasks (each builds off-screen and commits when settled)
        const taskTuples = sections.map((section, index) => ({ section, index, run: () => new Promise((resolve) => {
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
                    debug: false,
                        showTimestamp,
                        showTimeBuild
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

                            // Normalize HTML by stripping timestamp nodes so diffs ignore them
                            const stripTimestamps = (html) => {
                                try {
                                    const tmp = document.createElement('div');
                                    tmp.innerHTML = html || '';
                                    tmp.querySelectorAll('[data-ocm-ts], .ocm-ts').forEach(n => n.parentNode && n.parentNode.removeChild(n));
                                    return tmp.innerHTML;
                                } catch (_) {
                                    return html || '';
                                }
                            };

                            // Determine if result has meaningful visible content
                            const meaningfulNode = staging.querySelector('table tr, td, th, ul li, ol li, h1, h2, h3, h4, h5, h6, a[href], img, pre, code, blockquote');
                            const hasMeaningfulText = ((staging.textContent || '').trim().length > 0);
                            const isMeaningful = Boolean(meaningfulNode || hasMeaningfulText);

                            const newHtml = (collapseEmptySections && !isMeaningful) ? '' : rawHtml;
                            const changed = (!hadCache) || (stripTimestamps(newHtml) !== stripTimestamps(oldHtml));

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
                                    // Update timestamp label to "Updated at" when replacing existing content
                                    try {
                                        if (hadCache) {
                                            const labels = slots[index].querySelectorAll('[data-ocm-ts] .ocm-ts-label');
                                            labels.forEach(node => { node.textContent = 'Updated at'; });
                                        }
                                        // Enrich timestamp with settle time (only when showTimeBuild is true)
                                        if (showTimeBuild) {
                                            const tsNode = slots[index].querySelector('[data-ocm-ts]');
                                            if (tsNode) {
                                                const extra = tsNode.querySelector('.ocm-ts-extra');
                                                const buildAttr = tsNode.getAttribute('data-ocm-build-ms');
                                                const buildMs = buildAttr ? Number(buildAttr) : null;
                                                const settleMs = Math.round(waited);
                                                const parts = [];
                                                if (typeof buildMs === 'number' && isFinite(buildMs)) parts.push(`build: ${buildMs}ms`);
                                                parts.push(`settle: ${settleMs}ms`);
                                                if (extra) {
                                                    extra.textContent = `(${parts.join(', ')})`;
                                                } else {
                                                    const span = document.createElement('span');
                                                    span.className = 'ocm-ts-extra';
                                                    span.textContent = `(${parts.join(', ')})`;
                                                    tsNode.appendChild(document.createTextNode(' '));
                                                    tsNode.appendChild(span);
                                                }
                                                tsNode.setAttribute('data-ocm-settle-ms', String(settleMs));
                                            }
                                        }
                                    } catch (_) { /* ignore */ }
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
                            } else {
                                // Unchanged: keep UI as-is; optionally enrich settle time only when showTimeBuild is true
                                try {
                                    if (showTimeBuild) {
                                        const tsNode = slots[index].querySelector('[data-ocm-ts]');
                                        if (tsNode) {
                                            const extra = tsNode.querySelector('.ocm-ts-extra');
                                            const buildAttr = tsNode.getAttribute('data-ocm-build-ms');
                                            const buildMs = buildAttr ? Number(buildAttr) : null;
                                            const settleMs = Math.round(waited);
                                            const parts = [];
                                            if (typeof buildMs === 'number' && isFinite(buildMs)) parts.push(`build: ${buildMs}ms`);
                                            parts.push(`settle: ${settleMs}ms`);
                                            if (extra) {
                                                extra.textContent = `(${parts.join(', ')})`;
                                            } else {
                                                const span = document.createElement('span');
                                                span.className = 'ocm-ts-extra';
                                                span.textContent = `(${parts.join(', ')})`;
                                                tsNode.appendChild(document.createTextNode(' '));
                                                tsNode.appendChild(span);
                                            }
                                            tsNode.setAttribute('data-ocm-settle-ms', String(settleMs));
                                        }
                                    }
                                } catch (_) { /* ignore */ }
                                if (debug && console && console.log) {
                                    console.log('[SmarterView] unchanged', { section, index });
                                }
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
                    const label = SECTION_LABELS[section] || section;
                    slots[index].textContent = `Error rendering ${label}: ${err?.message || err}`;
                    if (staging && staging.parentNode) staging.parentNode.removeChild(staging);
                    resolve();
                }
            }, 0);
        }) }));

        // Reorder tasks by scheduling priority while keeping visual order of slots unchanged
        const prioritySet = new Set(Array.isArray(prioritySections) ? prioritySections : []);
        const orderedTaskTuples = [...taskTuples].sort((a, b) => {
            const aPr = prioritySet.has(a.section) ? 0 : 1;
            const bPr = prioritySet.has(b.section) ? 0 : 1;
            if (aPr !== bPr) return aPr - bPr; // priority first
            return a.index - b.index;          // then original order
        });
        const tasks = orderedTaskTuples.map(t => t.run);

        // Run with a simple concurrency limiter (queue + N workers)
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

        // Fire-and-forget; DVJS blocks are usually fine without awaiting
        runWithConcurrency(tasks, concurrency);
    }

    // Deprecated helpers removed in v1.1.0:
    // - renderSmartView
    // - renderLightSmartView
    // - renderGroupSmartView

}



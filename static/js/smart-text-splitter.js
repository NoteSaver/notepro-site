/**
 * ====================================================================
 * ✂️ SMART TEXT SPLITTER - HTML-Aware
 * ====================================================================
 * HTML structure को maintain करते हुए text split करता है
 * MS Word जैसा intelligent splitting
 */

class SmartTextSplitter {
    constructor() {
        this.textMeasurer = window.textMeasurer;
        this.preserveTags = ['STRONG', 'B', 'EM', 'I', 'U', 'SPAN', 'A', 'CODE'];
        
        console.log('✅ Smart Text Splitter initialized');
    }

    /**
     * Split element को दो parts में divide करता है
     * @returns {beforePart, afterPart}
     */
    splitElement(element, maxHeight, containerWidth) {
        const elementType = element.tagName.toLowerCase();
        
        // Different strategies for different elements
        switch (elementType) {
            case 'p':
            case 'div':
                return this.splitParagraph(element, maxHeight, containerWidth);
            
            case 'h1':
            case 'h2':
            case 'h3':
            case 'h4':
            case 'h5':
            case 'h6':
                return this.splitHeading(element, maxHeight);
            
            case 'ul':
            case 'ol':
                return this.splitList(element, maxHeight);
            
            case 'table':
                return this.splitTable(element, maxHeight);
            
            case 'blockquote':
                return this.splitBlockquote(element, maxHeight);
            
            default:
                return this.splitGeneric(element, maxHeight);
        }
    }

    /**
     * Paragraph को split करता है
     */
    splitParagraph(paragraph, maxHeight, containerWidth) {
        const clone = paragraph.cloneNode(true);
        const font = this.textMeasurer.getFontFromElement(paragraph);
        const lineHeight = this.textMeasurer.getLineHeight(paragraph);

        // Check if entire paragraph fits
        const paraHeight = this.textMeasurer.measureElementHeight(paragraph);
        if (paraHeight <= maxHeight) {
            return {
                beforePart: paragraph.cloneNode(true),
                afterPart: null
            };
        }

        // Need to split
        const textContent = this.extractTextWithFormatting(paragraph);
        const result = this.splitFormattedText(
            textContent, 
            maxHeight, 
            containerWidth, 
            font, 
            lineHeight
        );

        const beforePara = document.createElement(paragraph.tagName);
        const afterPara = document.createElement(paragraph.tagName);
        
        // Copy attributes
        this.copyAttributes(paragraph, beforePara);
        this.copyAttributes(paragraph, afterPara);

        beforePara.innerHTML = result.beforeHTML;
        afterPara.innerHTML = result.afterHTML;

        return {
            beforePart: beforePara,
            afterPart: afterPara
        };
    }

    /**
     * Heading को split करता है (keep-with-next principle)
     */
    splitHeading(heading, maxHeight) {
        // Headings should NOT split
        // If it doesn't fit, move entire heading to next page
        const headingHeight = this.textMeasurer.measureElementHeight(heading);
        
        if (headingHeight <= maxHeight) {
            return {
                beforePart: heading.cloneNode(true),
                afterPart: null
            };
        } else {
            // Heading too big, must move to next page
            return {
                beforePart: null,
                afterPart: heading.cloneNode(true)
            };
        }
    }

    /**
     * List को split करता है (item-by-item)
     */
    splitList(list, maxHeight) {
        const listType = list.tagName;
        const beforeList = document.createElement(listType);
        const afterList = document.createElement(listType);
        
        this.copyAttributes(list, beforeList);
        this.copyAttributes(list, afterList);

        let currentHeight = 0;
        let splitFound = false;

        Array.from(list.children).forEach(item => {
            const itemHeight = this.textMeasurer.measureElementHeight(item);
            
            if (!splitFound && currentHeight + itemHeight <= maxHeight) {
                beforeList.appendChild(item.cloneNode(true));
                currentHeight += itemHeight;
            } else {
                afterList.appendChild(item.cloneNode(true));
                splitFound = true;
            }
        });

        return {
            beforePart: beforeList.children.length > 0 ? beforeList : null,
            afterPart: afterList.children.length > 0 ? afterList : null
        };
    }

    /**
     * Table को split करता है (row-by-row)
     */
    splitTable(table, maxHeight) {
        const beforeTable = table.cloneNode(false);
        const afterTable = table.cloneNode(false);

        const tbody = table.querySelector('tbody') || table;
        const rows = Array.from(tbody.querySelectorAll('tr'));

        let currentHeight = 0;
        let splitFound = false;

        rows.forEach(row => {
            const rowHeight = this.textMeasurer.measureElementHeight(row);
            
            if (!splitFound && currentHeight + rowHeight <= maxHeight) {
                beforeTable.appendChild(row.cloneNode(true));
                currentHeight += rowHeight;
            } else {
                afterTable.appendChild(row.cloneNode(true));
                splitFound = true;
            }
        });

        return {
            beforePart: beforeTable.children.length > 0 ? beforeTable : null,
            afterPart: afterTable.children.length > 0 ? afterTable : null
        };
    }

    /**
     * Blockquote को split करता है
     */
    splitBlockquote(blockquote, maxHeight) {
        // Try not to split blockquotes
        const bqHeight = this.textMeasurer.measureElementHeight(blockquote);
        
        if (bqHeight <= maxHeight) {
            return {
                beforePart: blockquote.cloneNode(true),
                afterPart: null
            };
        }

        // Must split - treat like paragraph
        return this.splitParagraph(blockquote, maxHeight);
    }

    /**
     * Generic split (fallback)
     */
    splitGeneric(element, maxHeight) {
        const elementHeight = this.textMeasurer.measureElementHeight(element);
        
        if (elementHeight <= maxHeight) {
            return {
                beforePart: element.cloneNode(true),
                afterPart: null
            };
        } else {
            return {
                beforePart: null,
                afterPart: element.cloneNode(true)
            };
        }
    }

    /**
     * Extract text with inline formatting preserved
     */
    extractTextWithFormatting(element) {
        const parts = [];
        
        const traverse = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                if (node.textContent.trim()) {
                    parts.push({
                        type: 'text',
                        content: node.textContent,
                        formatting: []
                    });
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const tag = node.tagName.toUpperCase();
                
                if (this.preserveTags.includes(tag)) {
                    // Start formatting
                    parts.push({
                        type: 'format-start',
                        tag: tag,
                        attributes: this.getAttributes(node)
                    });
                    
                    // Process children
                    Array.from(node.childNodes).forEach(child => traverse(child));
                    
                    // End formatting
                    parts.push({
                        type: 'format-end',
                        tag: tag
                    });
                } else {
                    // Process children only
                    Array.from(node.childNodes).forEach(child => traverse(child));
                }
            }
        };

        traverse(element);
        return parts;
    }

    /**
     * Split formatted text intelligently
     */
    splitFormattedText(parts, maxHeight, containerWidth, font, lineHeight) {
        const maxLines = Math.floor(maxHeight / lineHeight);
        let currentLine = 0;
        let beforeHTML = '';
        let afterHTML = '';
        let splitPoint = -1;
        let openTags = [];

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];

            if (part.type === 'text') {
                const lines = this.textMeasurer.estimateLines(
                    part.content, 
                    containerWidth, 
                    font, 
                    lineHeight
                );

                if (currentLine + lines <= maxLines) {
                    currentLine += lines;
                    beforeHTML += this.escapeHtml(part.content);
                } else {
                    // Need to split this text
                    splitPoint = i;
                    
                    // Calculate how much fits
                    const remainingLines = maxLines - currentLine;
                    const remainingHeight = remainingLines * lineHeight;
                    
                    const splitResult = this.textMeasurer.findTextThatFits(
                        part.content,
                        containerWidth,
                        font
                    );

                    beforeHTML += this.escapeHtml(splitResult.fitted);
                    afterHTML = this.escapeHtml(splitResult.overflow);
                    
                    // Add remaining parts to afterHTML
                    for (let j = i + 1; j < parts.length; j++) {
                        if (parts[j].type === 'text') {
                            afterHTML += this.escapeHtml(parts[j].content);
                        } else if (parts[j].type === 'format-start') {
                            afterHTML += this.createOpenTag(parts[j]);
                        } else if (parts[j].type === 'format-end') {
                            afterHTML += `</${parts[j].tag.toLowerCase()}>`;
                        }
                    }
                    
                    break;
                }
            } else if (part.type === 'format-start') {
                const openTag = this.createOpenTag(part);
                beforeHTML += openTag;
                openTags.push(part.tag);
            } else if (part.type === 'format-end') {
                beforeHTML += `</${part.tag.toLowerCase()}>`;
                openTags.pop();
            }
        }

        // Close any open tags in beforeHTML
        while (openTags.length > 0) {
            const tag = openTags.pop();
            beforeHTML += `</${tag.toLowerCase()}>`;
        }

        return { beforeHTML, afterHTML };
    }

    /**
     * Helper: Create opening tag with attributes
     */
    createOpenTag(part) {
        let tag = `<${part.tag.toLowerCase()}`;
        
        if (part.attributes) {
            for (const [key, value] of Object.entries(part.attributes)) {
                tag += ` ${key}="${value}"`;
            }
        }
        
        tag += '>';
        return tag;
    }

    /**
     * Helper: Get attributes from element
     */
    getAttributes(element) {
        const attrs = {};
        for (const attr of element.attributes) {
            attrs[attr.name] = attr.value;
        }
        return attrs;
    }

    /**
     * Helper: Copy attributes
     */
    copyAttributes(from, to) {
        for (const attr of from.attributes) {
            to.setAttribute(attr.name, attr.value);
        }
    }

    /**
     * Helper: Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ==================== GLOBAL INSTANCE ====================

window.smartSplitter = new SmartTextSplitter();

console.log('✅ Smart Text Splitter ready to use');

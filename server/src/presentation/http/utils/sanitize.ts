/**
 * HTML Sanitization Utilities
 *
 * Server-side HTML sanitization for defense-in-depth.
 * Provides sanitization for email content to prevent XSS attacks.
 */

import sanitizeHtml from 'sanitize-html';

/**
 * Default sanitization options for email HTML content.
 * Allows common email formatting tags while removing scripts and dangerous elements.
 */
const emailSanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    // Text formatting
    'p', 'br', 'span', 'div', 'a', 'b', 'i', 'u', 'strong', 'em', 'small',
    'sub', 'sup', 'mark', 's', 'strike', 'del', 'ins',
    // Lists
    'ul', 'ol', 'li',
    // Headings
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    // Tables
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
    // Other common email elements
    'blockquote', 'pre', 'code', 'hr',
    // Images (with restrictions)
    'img',
  ],
  allowedAttributes: {
    'a': ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'td': ['colspan', 'rowspan', 'align', 'valign'],
    'th': ['colspan', 'rowspan', 'align', 'valign'],
    'table': ['border', 'cellpadding', 'cellspacing', 'width'],
    '*': ['style', 'class'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: {
    img: ['http', 'https', 'data'],
  },
  allowedStyles: {
    '*': {
      // Only allow safe CSS properties
      'color': [/.*/],
      'background-color': [/.*/],
      'font-size': [/.*/],
      'font-weight': [/.*/],
      'font-style': [/.*/],
      'font-family': [/.*/],
      'text-align': [/.*/],
      'text-decoration': [/.*/],
      'margin': [/.*/],
      'margin-top': [/.*/],
      'margin-bottom': [/.*/],
      'margin-left': [/.*/],
      'margin-right': [/.*/],
      'padding': [/.*/],
      'padding-top': [/.*/],
      'padding-bottom': [/.*/],
      'padding-left': [/.*/],
      'padding-right': [/.*/],
      'border': [/.*/],
      'width': [/.*/],
      'height': [/.*/],
      'line-height': [/.*/],
    },
  },
  // Transform links to add security attributes
  transformTags: {
    'a': (tagName, attribs) => {
      return {
        tagName,
        attribs: {
          ...attribs,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      };
    },
  },
};

/**
 * Sanitize HTML content from emails.
 * Removes potentially dangerous scripts, event handlers, and other XSS vectors.
 *
 * @param html - Raw HTML string to sanitize
 * @returns Sanitized HTML string safe for rendering
 */
export function sanitizeEmailHtml(html: string | null | undefined): string | null {
  if (html === null || html === undefined) {
    return null;
  }

  return sanitizeHtml(html, emailSanitizeOptions);
}

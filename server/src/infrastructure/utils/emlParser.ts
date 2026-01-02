/**
 * EML Parser Utility
 *
 * Parses .eml files into a format compatible with the triage system.
 * Used for testing the triage pipeline with manually uploaded emails.
 */

export interface ParsedEmail {
  subject: string;
  htmlBody: string;
  textBody: string;
  fromAddress: string;
  fromName?: string;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  receivedAt: Date;
  messageId?: string;
  headers: Record<string, string>;
}

/**
 * Parse an EML file content into a structured format
 * This is a simple parser that handles the basic EML format
 */
export function parseEmlContent(emlContent: string): ParsedEmail {
  const lines = emlContent.split(/\r?\n/);
  const headers: Record<string, string> = {};
  let bodyStartIndex = 0;
  let currentHeader = '';
  let currentValue = '';

  // Parse headers (until empty line)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    // Empty line marks end of headers
    if (line.trim() === '') {
      // Save last header if exists
      if (currentHeader) {
        headers[currentHeader.toLowerCase()] = currentValue.trim();
      }
      bodyStartIndex = i + 1;
      break;
    }

    // Continuation of previous header (starts with whitespace)
    if (/^\s+/.test(line) && currentHeader) {
      currentValue += ' ' + line.trim();
      continue;
    }

    // New header
    const headerMatch = line.match(/^([^:]+):\s*(.*)$/);
    if (headerMatch) {
      // Save previous header
      if (currentHeader) {
        headers[currentHeader.toLowerCase()] = currentValue.trim();
      }
      currentHeader = headerMatch[1] ?? '';
      currentValue = headerMatch[2] ?? '';
    }
  }

  // Extract body content
  const bodyContent = lines.slice(bodyStartIndex).join('\n');
  const { htmlBody, textBody } = extractBodyContent(bodyContent, headers['content-type'] ?? '');

  // Parse addresses
  const { address: fromAddress, name: fromName } = parseEmailAddress(headers['from'] ?? '');
  const toAddresses = parseAddressList(headers['to'] ?? '');
  const ccAddresses = parseAddressList(headers['cc'] ?? '');
  const bccAddresses = parseAddressList(headers['bcc'] ?? '');

  // Parse date
  const dateStr = headers['date'] ?? '';
  let receivedAt = new Date();
  if (dateStr) {
    try {
      receivedAt = new Date(dateStr);
      if (isNaN(receivedAt.getTime())) {
        receivedAt = new Date();
      }
    } catch {
      receivedAt = new Date();
    }
  }

  return {
    subject: decodeHeader(headers['subject'] ?? ''),
    htmlBody,
    textBody,
    fromAddress,
    fromName: fromName ? decodeHeader(fromName) : undefined,
    toAddresses,
    ccAddresses,
    bccAddresses,
    receivedAt,
    messageId: headers['message-id'],
    headers,
  };
}

/**
 * Extract HTML and text body from email content
 * Handles both simple and multipart MIME messages
 */
function extractBodyContent(
  body: string,
  contentType: string
): { htmlBody: string; textBody: string } {
  let htmlBody = '';
  let textBody = '';

  // Check if it's a multipart message
  const boundaryMatch = contentType.match(/boundary="?([^";\s]+)"?/i);

  if (boundaryMatch && boundaryMatch[1]) {
    const boundary = boundaryMatch[1];
    const parts = body.split(new RegExp(`--${escapeRegex(boundary)}`, 'g'));

    for (const part of parts) {
      if (!part.trim() || part.trim() === '--') continue;

      const partLines = part.split(/\r?\n/);
      const partHeaders: Record<string, string> = {};
      let partBodyStart = 0;

      // Parse part headers
      for (let i = 0; i < partLines.length; i++) {
        const line = partLines[i] ?? '';
        if (line.trim() === '') {
          partBodyStart = i + 1;
          break;
        }
        const headerMatch = line.match(/^([^:]+):\s*(.*)$/);
        if (headerMatch && headerMatch[1] && headerMatch[2] !== undefined) {
          partHeaders[headerMatch[1].toLowerCase()] = headerMatch[2];
        }
      }

      const partBody = partLines.slice(partBodyStart).join('\n');
      const partContentType = partHeaders['content-type'] ?? '';

      // Recursively handle nested multipart
      if (partContentType.includes('multipart/')) {
        const nested = extractBodyContent(partBody, partContentType);
        if (nested.htmlBody) htmlBody = nested.htmlBody;
        if (nested.textBody) textBody = nested.textBody;
      } else if (partContentType.includes('text/html')) {
        htmlBody = decodeContent(partBody, partHeaders['content-transfer-encoding']);
      } else if (partContentType.includes('text/plain')) {
        textBody = decodeContent(partBody, partHeaders['content-transfer-encoding']);
      }
    }
  } else if (contentType.includes('text/html')) {
    htmlBody = body;
  } else if (contentType.includes('text/plain') || !contentType) {
    textBody = body;
    // Convert plain text to simple HTML
    htmlBody = `<pre>${escapeHtml(body)}</pre>`;
  }

  // If we only have text, wrap it in HTML
  if (!htmlBody && textBody) {
    htmlBody = `<pre>${escapeHtml(textBody)}</pre>`;
  }

  // If we only have HTML, extract text
  if (!textBody && htmlBody) {
    textBody = stripHtml(htmlBody);
  }

  return { htmlBody, textBody };
}

/**
 * Decode content based on transfer encoding
 */
function decodeContent(content: string, encoding?: string): string {
  if (!encoding) return content;

  encoding = encoding.toLowerCase().trim();

  if (encoding === 'base64') {
    try {
      return Buffer.from(content.replace(/\s/g, ''), 'base64').toString('utf-8');
    } catch {
      return content;
    }
  }

  if (encoding === 'quoted-printable') {
    return decodeQuotedPrintable(content);
  }

  return content;
}

/**
 * Decode quoted-printable encoding
 */
function decodeQuotedPrintable(str: string): string {
  // Remove soft line breaks
  str = str.replace(/=\r?\n/g, '');

  // Decode encoded characters
  return str.replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
}

/**
 * Decode MIME encoded header value
 */
function decodeHeader(value: string): string {
  // Handle =?charset?encoding?text?= format
  return value.replace(
    /=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi,
    (_match: string, _charset: string, encoding: string, text: string) => {
      try {
        if (encoding.toUpperCase() === 'B') {
          return Buffer.from(text, 'base64').toString('utf-8');
        } else if (encoding.toUpperCase() === 'Q') {
          return decodeQuotedPrintable(text.replace(/_/g, ' '));
        }
      } catch {
        // Fall through to return original
      }
      return text;
    }
  );
}

/**
 * Parse an email address field to extract address and name
 */
function parseEmailAddress(field: string): { address: string; name?: string } {
  const decoded = decodeHeader(field);

  // Format: "Name" <email@example.com> or Name <email@example.com>
  const match = decoded.match(/^"?([^"<]*)"?\s*<([^>]+)>$/);
  if (match && match[1] !== undefined && match[2]) {
    const name = match[1].trim();
    return {
      name: name || undefined,
      address: match[2].trim().toLowerCase(),
    };
  }

  // Format: email@example.com (Name)
  const altMatch = decoded.match(/^([^\s(]+)\s*\(([^)]+)\)$/);
  if (altMatch && altMatch[1] && altMatch[2]) {
    return {
      address: altMatch[1].trim().toLowerCase(),
      name: altMatch[2].trim(),
    };
  }

  // Just an email address
  return { address: decoded.trim().toLowerCase() };
}

/**
 * Parse a comma-separated list of email addresses
 */
function parseAddressList(field: string): string[] {
  if (!field) return [];

  const addresses: string[] = [];
  const decoded = decodeHeader(field);

  // Split by comma, but not commas inside quotes or angle brackets
  let current = '';
  let inQuotes = false;
  let inBrackets = false;

  for (const char of decoded) {
    if (char === '"' && !inBrackets) {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === '<' && !inQuotes) {
      inBrackets = true;
      current += char;
    } else if (char === '>' && !inQuotes) {
      inBrackets = false;
      current += char;
    } else if (char === ',' && !inQuotes && !inBrackets) {
      if (current.trim()) {
        const { address } = parseEmailAddress(current.trim());
        if (address) addresses.push(address);
      }
      current = '';
    } else {
      current += char;
    }
  }

  // Don't forget the last one
  if (current.trim()) {
    const { address } = parseEmailAddress(current.trim());
    if (address) addresses.push(address);
  }

  return addresses;
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Strip HTML tags to get plain text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripMd(text: string): string {
  if (!text) return '';
  return text
    .replace(/^#{1,6}\s+/gm, '')        // # headings
    .replace(/\*\*(.+?)\*\*/gs, '$1')   // **bold**
    .replace(/__(.+?)__/gs, '$1')       // __bold__
    .replace(/\*(.+?)\*/gs, '$1')       // *italic*
    .replace(/_(.+?)_/gs, '$1')         // _italic_
    .replace(/`{1,3}(.+?)`{1,3}/gs, '$1') // `code`
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // [link](url)
    .replace(/^[-*+]\s+/gm, '')         // - list items
    .replace(/^>\s*/gm, '')             // > blockquote
    .replace(/^\s*\n/gm, '\n')          // blank lines
    .trim();
}

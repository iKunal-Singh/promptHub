import React from 'react';
import { diff_match_patch, DIFF_DELETE, DIFF_INSERT, DIFF_EQUAL } from 'diff-match-patch';

interface LiveDiffViewProps {
  oldContent: string;
  newContent: string;
  oldTitle?: string;
  newTitle?: string;
}

const LiveDiffView: React.FC<LiveDiffViewProps> = ({ oldContent, newContent, oldTitle, newTitle }) => {
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(oldContent, newContent);
  dmp.diff_cleanupSemantic(diffs); // Or dmp.diff_cleanupEfficiency(diffs);

  // diff_prettyHtml generates HTML with <ins> and <del> tags.
  // Styling for these tags will be handled by global CSS.
  // Example: <del style="background:#ffe6e6;">deleted</del><ins style="background:#e6ffe6;">inserted</ins>
  // The default output of diff_prettyHtml uses <del> and <ins> tags with inline styles
  // or relies on classes if dmp.Diff_Timeout is set to 0, which is not the default.
  // For simplicity and to use external CSS classes, we might need to adjust,
  // but let's first use its direct output.
  // The library's diff_prettyHtml actually produces inline styles like:
  // <del style="background:#ffe6e6;">Hello</del><ins style="background:#e6ffe6;">World</ins>
  // We want to use CSS classes .diff-ins and .diff-del.
  // The dmp.diff_prettyHtml method does not directly support classes.
  // We need to manually map diffs to HTML elements with classes.

  const diffHtml = diffs.map(([op, data], index) => {
    switch (op) {
      case DIFF_INSERT:
        return `<ins class="diff-ins" key="diff-${index}">${data}</ins>`;
      case DIFF_DELETE:
        return `<del class="diff-del" key="diff-${index}">${data}</del>`;
      case DIFF_EQUAL:
        return `<span key="diff-${index}">${data}</span>`;
      default:
        // Should not happen
        return `<span key="diff-${index}">${data}</span>`;
    }
  }).join('');

  return (
    <div className="live-diff-container" data-testid="live-diff-container">
      {(oldTitle || newTitle) && (
        <div className="diff-titles" style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #eee' }}>
          <div className="diff-title-old" style={{ fontWeight: 'bold', flex: 1, textAlign: 'center' }}>{oldTitle || 'Previous'}</div>
          <div className="diff-title-new" style={{ fontWeight: 'bold', flex: 1, textAlign: 'center' }}>{newTitle || 'Current'}</div>
        </div>
      )}
      <div
        className="live-diff-view"
        data-testid="live-diff-output"
        style={{
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace',
          padding: '10px',
          border: '1px solid #ccc',
          maxHeight: '400px', // Increased max height for comparison view
          overflowY: 'auto'
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: diffHtml }} />
      </div>
    </div>
  );
};

export default LiveDiffView;

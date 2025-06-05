import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import LiveDiffView from './LiveDiffView';

// Helper to get text content from diff elements, handling potential multiple segments
const getDiffText = (container: HTMLElement, className: string): string => {
  const elements = container.querySelectorAll(className);
  return Array.from(elements).map(el => el.textContent).join('');
};

describe('LiveDiffView', () => {
  it('renders no diffs for identical content', () => {
    render(<LiveDiffView oldContent="Hello world" newContent="Hello world" />);
    expect(screen.queryByText(/Hello world/i)).toBeInTheDocument();
    expect(screen.queryByTestId('diff-ins')).not.toBeInTheDocument();
    expect(screen.queryByTestId('diff-del')).not.toBeInTheDocument();

    const diffOutput = screen.getByTestId('live-diff-output');
    expect(diffOutput.querySelector('.diff-ins')).toBeNull();
    expect(diffOutput.querySelector('.diff-del')).toBeNull();
    expect(diffOutput.textContent).toBe('Hello world');
  });

  it('renders additions correctly', () => {
    render(<LiveDiffView oldContent="Hello" newContent="Hello world" />);
    const diffOutput = screen.getByTestId('live-diff-output');
    const insText = getDiffText(diffOutput, '.diff-ins');
    expect(insText).toBe(' world');
    expect(diffOutput.querySelector('.diff-del')).toBeNull();
    // Check full content as well
    expect(diffOutput.textContent).toBe('Hello world');
  });

  it('renders deletions correctly', () => {
    render(<LiveDiffView oldContent="Hello world" newContent="Hello" />);
    const diffOutput = screen.getByTestId('live-diff-output');
    const delText = getDiffText(diffOutput, '.diff-del');
    expect(delText).toBe(' world');
    expect(diffOutput.querySelector('.diff-ins')).toBeNull();
    expect(diffOutput.textContent).toBe('Hello');
  });

  it('renders mixed changes correctly', () => {
    render(<LiveDiffView oldContent="Hello old world" newContent="Hello new world" />);
    const diffOutput = screen.getByTestId('live-diff-output');
    const delText = getDiffText(diffOutput, '.diff-del');
    const insText = getDiffText(diffOutput, '.diff-ins');
    expect(delText).toBe('old');
    expect(insText).toBe('new');
    // Check full content to ensure order and surrounding text
    expect(diffOutput.textContent).toBe('Hello old new world');
    // Note: textContent of mixed nodes can be tricky.
    // A more robust check might be to check innerHTML for structure if needed.
    // For example: expect(diffOutput.innerHTML).toBe('<span>Hello </span><del class="diff-del">old</del><ins class="diff-ins">new</ins><span> world</span>');
  });

  it('renders titles when provided', () => {
    render(
      <LiveDiffView
        oldContent="Old"
        newContent="New"
        oldTitle="Version 1"
        newTitle="Version 2"
      />
    );
    expect(screen.getByText('Version 1')).toBeInTheDocument();
    expect(screen.getByText('Version 2')).toBeInTheDocument();
  });

  it('renders default titles when titles are not provided', () => {
    render(<LiveDiffView oldContent="Old" newContent="New" />);
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('handles empty old content (all additions)', () => {
    render(<LiveDiffView oldContent="" newContent="Everything is new" />);
    const diffOutput = screen.getByTestId('live-diff-output');
    const insText = getDiffText(diffOutput, '.diff-ins');
    expect(insText).toBe('Everything is new');
    expect(diffOutput.querySelector('.diff-del')).toBeNull();
    expect(diffOutput.textContent).toBe('Everything is new');
  });

  it('handles empty new content (all deletions)', () => {
    render(<LiveDiffView oldContent="Everything is old" newContent="" />);
    const diffOutput = screen.getByTestId('live-diff-output');
    const delText = getDiffText(diffOutput, '.diff-del');
    expect(delText).toBe('Everything is old');
    expect(diffOutput.querySelector('.diff-ins')).toBeNull();
    expect(diffOutput.textContent).toBe(''); // After deletion, content is empty
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PromptComparisonView from './PromptComparisonView';

// Mock the LiveDiffView component
jest.mock('../common/LiveDiffView', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jest.fn((props: any) => (
    <div data-testid="mock-live-diff-view">
      <div data-testid="oldTitle">{props.oldTitle}</div>
      <div data-testid="newTitle">{props.newTitle}</div>
      <div data-testid="oldContent">{props.oldContent}</div>
      <div data-testid="newContent">{props.newContent}</div>
    </div>
  ));
});

describe('PromptComparisonView', () => {
  const mockProps = {
    versionAName: 'Version 1',
    versionAContent: 'This is version A.',
    versionBName: 'Version 2',
    versionBContent: 'This is version B, with changes.',
  };

  it('renders and passes correct props to LiveDiffView', () => {
    render(<PromptComparisonView {...mockProps} />);

    // Check that the mocked LiveDiffView is rendered
    expect(screen.getByTestId('mock-live-diff-view')).toBeInTheDocument();

    // Check that props are passed correctly to the mocked LiveDiffView
    expect(screen.getByTestId('oldTitle')).toHaveTextContent(mockProps.versionAName);
    expect(screen.getByTestId('newTitle')).toHaveTextContent(mockProps.versionBName);
    expect(screen.getByTestId('oldContent')).toHaveTextContent(mockProps.versionAContent);
    expect(screen.getByTestId('newContent')).toHaveTextContent(mockProps.versionBContent);
  });

  it('renders the main container', () => {
    render(<PromptComparisonView {...mockProps} />);
    // The component itself has a class 'prompt-comparison-view'
    // We can check if the element containing the mock is present.
    // This is less critical as we're focused on prop passing to the mock.
    const liveDiffViewMock = screen.getByTestId('mock-live-diff-view');
    expect(liveDiffViewMock.parentElement).toHaveClass('prompt-comparison-view');
  });
});

import React from 'react';
import LiveDiffView from '../common/LiveDiffView'; // Adjust path as necessary

interface PromptComparisonViewProps {
  versionAName: string;
  versionAContent: string;
  versionBName: string;
  versionBContent: string;
}

const PromptComparisonView: React.FC<PromptComparisonViewProps> = ({
  versionAName,
  versionAContent,
  versionBName,
  versionBContent,
}) => {
  return (
    <div className="prompt-comparison-view" style={{ padding: '10px' }}>
      {/*
        The titles for the columns (e.g., "Version X" and "Version Y")
        are now handled directly by LiveDiffView.
      */}
      <LiveDiffView
        oldContent={versionAContent}
        newContent={versionBContent}
        oldTitle={versionAName}
        newTitle={versionBName}
      />
    </div>
  );
};

export default PromptComparisonView;

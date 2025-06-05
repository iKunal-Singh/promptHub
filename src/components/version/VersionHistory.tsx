import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card';
import Button from '../common/Button';
import { History, ArrowLeft, ArrowRight, Check, X, Clock, User, GitBranch, GitMerge, GitPullRequest, CompareArrows } from 'lucide-react';
import { format } from 'date-fns';
import { useVersionControl } from '../../hooks/useVersionControl';
import toast from 'react-hot-toast';
import PromptComparisonView from './PromptComparisonView'; // Added import

interface VersionHistoryProps {
  promptId: string;
  onRestore: (version: any) => void;
  currentPromptContent: string;
  currentPromptTitle: string;
}

export default function VersionHistory({
  promptId,
  onRestore,
  currentPromptContent,
  currentPromptTitle
}: VersionHistoryProps) {
  // const [selectedVersion, setSelectedVersion] = useState<any>(null); // Seems unused, can remove if not needed for other features
  // const [showDiff, setShowDiff] = useState(false); // Seems unused
  const [activeBranch, setActiveBranch] = useState<string | null>(null);
  const [versionForCompare, setVersionForCompare] = useState<any | null>(null);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  
  const {
    versions,
    branches,
    isLoading,
    createBranch,
    createVersion,
    submitReview,
    mergeBranches,
    calculateDiff
  } = useVersionControl(promptId);

  const handleCreateBranch = async () => {
    const name = prompt('Enter branch name:');
    if (!name) return;

    try {
      await createBranch.mutateAsync({
        name,
        type: 'feature',
        description: `Feature branch: ${name}`
      });
      toast.success('Branch created successfully');
    } catch (error) {
      toast.error('Failed to create branch');
    }
  };

  const handleMergeBranch = async (sourceBranchId: string, targetBranchId: string) => {
    try {
      await mergeBranches.mutateAsync({
        sourceBranchId,
        targetBranchId
      });
      toast.success('Branches merged successfully');
    } catch (error) {
      toast.error('Failed to merge branches');
    }
  };

  const handleSubmitReview = async (versionId: string, approved: boolean) => {
    try {
      await submitReview.mutateAsync({
        versionId,
        status: approved ? 'approved' : 'changes_requested',
        feedback: approved ? 'LGTM!' : 'Please address the following issues...'
      });
      toast.success(approved ? 'Changes approved' : 'Changes requested');
    } catch (error) {
      toast.error('Failed to submit review');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-primary-500 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Branch Selection */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center">
              <GitBranch size={16} className="mr-2" />
              Branches
            </CardTitle>
            <Button
              size="sm"
              onClick={handleCreateBranch}
              leftIcon={<GitBranch size={14} />}
            >
              New Branch
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {branches?.map(branch => (
              <div
                key={branch.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  activeBranch === branch.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-center">
                  <GitBranch size={16} className="mr-2" />
                  <div>
                    <p className="font-medium">{branch.name}</p>
                    <p className="text-sm text-gray-500">
                      Created {format(new Date(branch.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveBranch(branch.id)}
                  >
                    Switch
                  </Button>
                  {branch.type !== 'main' && (
                    <Button
                      size="sm"
                      leftIcon={<GitMerge size={14} />}
                      onClick={() => handleMergeBranch(branch.id, branches[0].id)}
                    >
                      Merge to Main
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Version History */}
      <Card>
        <CardHeader>
          <CardTitle>Version History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {versions?.map(version => (
              <div
                key={version.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center">
                      <h3 className="font-medium">Version {version.version_number}</h3>
                      {version.branch_id && (
                        <div className="ml-2 flex items-center text-gray-500">
                          <GitBranch size={14} className="mr-1" />
                          <span className="text-sm">
                            {branches?.find(b => b.id === version.branch_id)?.name}
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{version.change_log}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSubmitReview(version.id, true)}
                      leftIcon={<Check size={14} />}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSubmitReview(version.id, false)}
                      leftIcon={<X size={14} />}
                    >
                      Request Changes
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setVersionForCompare(version);
                        setIsCompareModalOpen(true);
                      }}
                      leftIcon={<CompareArrows size={14} />}
                    >
                      Compare with Current
                    </Button>
                     <Button
                        size="sm"
                        variant="primary"
                        onClick={() => onRestore(version)}
                        leftIcon={<History size={14} />}
                      >
                        Restore
                      </Button>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center">
                    <User size={14} className="mr-1" />
                    <span>{version.created_by.email}</span>
                  </div>
                  <div className="flex items-center">
                    <Clock size={14} className="mr-1" />
                    <span>
                      {format(new Date(version.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                </div>

                {version.reviews?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium mb-2">Reviews</h4>
                    <div className="space-y-2">
                      {version.reviews.map((review: any) => (
                        <div
                          key={review.id}
                          className={`text-sm p-2 rounded ${
                            review.status === 'approved'
                              ? 'bg-green-50 text-green-700'
                              : 'bg-yellow-50 text-yellow-700'
                          }`}
                        >
                          {review.feedback}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {isCompareModalOpen && versionForCompare && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000 // Ensure modal is on top
          }}
          onClick={() => setIsCompareModalOpen(false)} // Close on backdrop click
        >
          <div
            style={{
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              width: '80%',
              maxWidth: '1000px',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={e => e.stopPropagation()} // Prevent modal close when clicking inside
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Compare Versions</h2>
              <Button onClick={() => setIsCompareModalOpen(false)} variant="ghost" size="sm">
                <X size={20} />
              </Button>
            </div>
            <PromptComparisonView
              versionAName={`Version ${versionForCompare.version_number} (${format(new Date(versionForCompare.created_at), 'MMM d, h:mm a')})`}
              versionAContent={versionForCompare.content?.body || JSON.stringify(versionForCompare.content, null, 2)}
              versionBName={currentPromptTitle}
              versionBContent={currentPromptContent}
            />
          </div>
        </div>
      )}
    </div>
  );
}
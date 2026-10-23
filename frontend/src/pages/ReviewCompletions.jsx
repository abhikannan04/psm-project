import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../utils/mockData';
import api from '../services/api';
import { toast } from 'react-toastify';
import { CheckCircle, XCircle, MessageSquare, AlertTriangle, Clock, User, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Create a custom event to notify sidebar of count changes
const createCompletionEvent = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('completionCountChanged'));
  }
};

const ReviewCompletions = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);
  const [comments, setComments] = useState({});
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedProjectForReject, setSelectedProjectForReject] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionType, setRejectionType] = useState('action_plan'); // 'action_plan' or 'project_completion'

  const getDelayInfo = (endDateString) => {
    if (!endDateString) return null;
    const endDate = new Date(endDateString);
    endDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (endDate < today) {
      const diffTime = Math.abs(today - endDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return `Overdue by ${diffDays} ${diffDays === 1 ? 'day' : 'days'}`;
    }
    return null;
  };

  // Check if user is valid
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">Authentication Error</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Please log in to access this page.
          </p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    loadPendingCompletions();
  }, []);

  const loadPendingCompletions = async () => {
    try {
      setLoading(true);
      // Fetch both pending projects and their associated status submissions
      const [projectsResponse, statusesResponse] = await Promise.all([
        apiService.getPendingCompletions(),
        apiService.getAllTeamUpdates()
      ]);
      
      const projectsData = projectsResponse.data.data || [];
      const statusesData = statusesResponse.data || [];
      
      // Combine project data with their latest status submissions
      const projectsWithStatuses = projectsData.map(project => {
        // Find the latest status submission for this project that marks as completed
        const projectStatuses = statusesData
          .filter(status => 
            status.project_id === project.id && 
            status.mark_as_completed === true
          )
          .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
        
        const latestStatus = projectStatuses[0] || null;
        
        return {
          ...project,
          latest_status: latestStatus,
          type: 'project_completion' // This is a project completion request
        };
      });
      
      // Set only project completions (no action plans)
      setProjects(projectsWithStatuses);
    } catch (error) {
      toast.error('Failed to load pending completions');
      console.error('Error loading pending completions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveActionPlan = async (statusId, comment = '') => {
    setReviewing(statusId);
    try {
      await api.post(`/statuses/approve/${statusId}`);
      toast.success('Action plan approved successfully!');
      createCompletionEvent(); // Notify sidebar to update count
      loadPendingCompletions(); // Reload to remove from list
    } catch (error) {
      toast.error('Failed to approve action plan');
      console.error('Error approving action plan:', error);
    } finally {
      setReviewing(null);
    }
  };

  // New function to approve project completion
  const handleApproveProjectCompletion = async (projectId) => {
    setReviewing(projectId);
    try {
      const comment = comments[projectId] || '';
      await api.post(`/projects/${projectId}/approve-completion`, { comments: comment });
      toast.success('Project completion approved successfully!');
      createCompletionEvent(); // Notify sidebar to update count
      loadPendingCompletions(); // Reload to remove from list
    } catch (error) {
      toast.error('Failed to approve project completion');
      console.error('Error approving project completion:', error);
    } finally {
      setReviewing(null);
    }
  };

  const handleReject = async (statusId, reason) => {
    setReviewing(statusId);
    try {
      await api.post(`/statuses/reject/${statusId}`, { reason });
      toast.success('Project completion rejected. Employee can resubmit.');
      createCompletionEvent(); // Notify sidebar to update count
      setShowRejectModal(false);
      setSelectedProjectForReject(null);
      setRejectionReason('');
      loadPendingCompletions(); // Reload to remove from list
    } catch (error) {
      toast.error('Failed to reject project completion');
      console.error('Error rejecting project completion:', error);
    } finally {
      setReviewing(null);
    }
  };

  // New function to reject project completion
  const handleRejectProjectCompletion = async (projectId, reason) => {
    setReviewing(projectId);
    try {
      await api.post(`/projects/${projectId}/reject-completion`, { reason });
      toast.success('Project completion rejected. Employee can resubmit project completion request.');
      createCompletionEvent(); // Notify sidebar to update count
      setShowRejectModal(false);
      setSelectedProjectForReject(null);
      setRejectionReason('');
      loadPendingCompletions(); // Reload to remove from list
    } catch (error) {
      toast.error('Failed to reject project completion');
      console.error('Error rejecting project completion:', error);
    } finally {
      setReviewing(null);
    }
  };

  const openRejectModal = (item, type = 'project_completion') => {
    setSelectedProjectForReject(item);
    setRejectionType(type);
    setShowRejectModal(true);
    setRejectionReason('');
  };

  const closeRejectModal = () => {
    setShowRejectModal(false);
    setSelectedProjectForReject(null);
    setRejectionReason('');
    setRejectionType('action_plan');
  };

  const handleCommentChange = (projectId, comment) => {
    setComments(prev => ({
      ...prev,
      [projectId]: comment
    }));
  };

  // Rejection Modal
  if (showRejectModal && selectedProjectForReject) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {rejectionType === 'action_plan' ? 'Reject Action Plan' : 'Reject Project Completion'}
            </h3>
            <button
              onClick={closeRejectModal}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Please provide a reason for rejecting the project completion for "{selectedProjectForReject.name || 'Unnamed Project'}":
          </p>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={4}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            placeholder="Enter detailed reason for rejection (required)..."
          />
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={closeRejectModal}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (rejectionReason.trim().length === 0) {
                  toast.error('Rejection reason is required');
                  return;
                }
                
                if (rejectionType === 'action_plan') {
                  // For action plans, use the status ID
                  const statusId = selectedProjectForReject.id;
                  if (!statusId) {
                    toast.error('Status ID is missing for action plan');
                    return;
                  }
                  handleReject(statusId, rejectionReason.trim());
                } else {
                  // For project completions, use the project ID
                  const projectId = selectedProjectForReject.id;
                  if (!projectId) {
                    toast.error('Project ID is missing for project completion');
                    return;
                  }
                  handleRejectProjectCompletion(projectId, rejectionReason.trim());
                }
              }}
              disabled={rejectionReason.trim().length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {reviewing === (rejectionType === 'action_plan' ? selectedProjectForReject.id : selectedProjectForReject.id) ? 'Processing...' : 'Reject'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Error state
  if (!projects) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">Error loading data</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Failed to load pending completions. Please try again later.
          </p>
          <button
            onClick={loadPendingCompletions}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Review Projects</h1>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Pending Project Approvals</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Review project completion requests from your team
          </p>
        </div>
        
        {projects && Array.isArray(projects) && projects.length > 0 ? (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {projects.map((project) => (
              <li key={project.id || project.name} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {`Project: ${project.name || 'Unnamed Project'}`}
                      </p>
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                        Project Completion
                      </span>
                      {getDelayInfo(project.end_date) && (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 animate-pulse">
                          {getDelayInfo(project.end_date)}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-gray-900 dark:text-gray-200">
                      {project.description || 'No description provided'}
                    </p>
                    {project.latest_status && (
                      <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-1">
                          <User className="h-4 w-4 mr-1" />
                          <span>Submitted by: {project.latest_status.employee_name}</span>
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          <span className="font-medium">Final Action Plan:</span> {project.latest_status.status_text}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Submitted on: {new Date(project.latest_status.submitted_at).toLocaleString()}
                        </div>
                      </div>
                    )}
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Approval Comments (optional):
                        </label>
                        <textarea
                          value={comments[project.id] || ''}
                          onChange={(e) => handleCommentChange(project.id, e.target.value)}
                          rows={2}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          placeholder="Enter comments for approval (optional)..."
                        />
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0 flex flex-col space-y-2">
                    {project.id ? (
                      <>
                        <button
                          onClick={() => openRejectModal(project, 'project_completion')}
                          disabled={reviewing === project.id}
                          className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 text-sm font-medium"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject Project Completion
                        </button>
                        <button
                          onClick={() => handleApproveProjectCompletion(project.id)}
                          disabled={reviewing === project.id}
                          className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 text-sm font-medium"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve Project Completion
                        </button>
                      </>
                    ) : (
                      <div className="text-red-500 text-sm">Error: Project ID missing</div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-6 py-12 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No pending requests</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              All requests have been reviewed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewCompletions;
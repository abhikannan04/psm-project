import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../utils/mockData';
import api from '../services/api';
import { toast } from 'react-toastify';
import { CheckCircle, XCircle, MessageSquare, AlertTriangle, Clock, User, X, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Create a custom event to notify sidebar of count changes
const createActionPlanEvent = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('actionPlanCountChanged'));
  }
};

// Create a custom event to notify project view of approval
const createActionPlanApprovedEvent = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('actionPlanApproved'));
  }
};

const ReviewActionPlans = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [actionPlans, setActionPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);
  const [comments, setComments] = useState({});
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedActionPlanForReject, setSelectedActionPlanForReject] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showHistory, setShowHistory] = useState({}); // Track which action plans have history shown

  const getActionPlanStatusText = (status) => {
    switch (status) {
      case 'started':
        return 'Started';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'under_approval':
        return 'Under Approval';
      case 'on_hold':
        return 'On Hold';
      default:
        return status;
    }
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
    loadPendingActionPlans();
  }, []);

  const loadPendingActionPlans = async () => {
    try {
      setLoading(true);
      // Fetch all team updates to find pending action plans
      const statusesResponse = await apiService.getAllTeamUpdates();
      const statusesData = statusesResponse.data || [];

      // Get pending action plans that are either:
      // 1. Marked as completed and pending review
      // 2. Have action plan status updates pending approval
      const pendingActionPlans = statusesData
        .filter(status =>
          (status.mark_as_completed === true && status.review_status === 'pending') ||
          (status.action_plan_status === 'under_approval' && status.review_status === 'pending')
        )
        .map(status => {
          // Extract requested status from review_comments for status updates
          let requestedStatus = null;
          if (status.action_plan_status === 'under_approval' &&
            status.review_comments &&
            status.review_comments.startsWith('Requested status: ')) {
            requestedStatus = status.review_comments.replace('Requested status: ', '');
          }

          // For completion requests, the requested status is the current action_plan_status
          if (status.mark_as_completed && !requestedStatus && status.action_plan_status) {
            requestedStatus = status.action_plan_status;
          }

          return {
            ...status,
            type: status.mark_as_completed ? 'completion_request' : 'status_update',
            requested_status: requestedStatus
          };
        });

      setActionPlans(pendingActionPlans);
    } catch (error) {
      toast.error('Failed to load pending action plans');
      console.error('Error loading pending action plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveActionPlan = async (statusId, comment = '', type = 'completion_request') => {
    setReviewing(statusId);
    try {
      let response;
      if (type === 'status_update') {
        // For status updates, we need to approve the status change
        response = await api.post(`/statuses/approve-status-update/${statusId}`);
      } else {
        // For completion requests, use the existing endpoint
        response = await api.post(`/statuses/approve/${statusId}`);
      }

      // Notify the employee about the approval
      if (response.data && response.data.action_plan_status) {
        toast.success(
          type === 'status_update'
            ? `Status update approved successfully! New status: ${getActionPlanStatusText(response.data.action_plan_status)}`
            : `Action plan request approved successfully! Status: ${getActionPlanStatusText(response.data.action_plan_status)}`
        );
      } else {
        toast.success(type === 'status_update' ? 'Status update approved successfully!' : 'Action plan request approved successfully!');
      }

      createActionPlanEvent(); // Notify sidebar to update count
      loadPendingActionPlans(); // Reload to remove from list
    } catch (error) {
      toast.error(type === 'status_update' ? 'Failed to approve status update' : 'Failed to approve action plan');
      console.error('Error approving action plan:', error);
    } finally {
      setReviewing(null);
    }
  };

  const handleReject = async (statusId, reason, type = 'completion_request') => {
    setReviewing(statusId);
    try {
      if (type === 'status_update') {
        // For status updates, we need to reject the status change
        await api.post(`/statuses/reject-status-update/${statusId}`, { reason });
      } else {
        // For completion requests, use the existing endpoint
        await api.post(`/statuses/reject/${statusId}`, { reason });
      }
      toast.success(type === 'status_update' ? 'Status update rejected. Employee can resubmit.' : 'Action plan request rejected. Employee can resubmit.');
      createActionPlanEvent(); // Notify sidebar to update count
      setShowRejectModal(false);
      setSelectedActionPlanForReject(null);
      setRejectionReason('');
      loadPendingActionPlans(); // Reload to remove from list
    } catch (error) {
      toast.error(type === 'status_update' ? 'Failed to reject status update' : 'Failed to reject action plan request');
      console.error('Error rejecting action plan:', error);
    } finally {
      setReviewing(null);
    }
  };

  const openRejectModal = (actionPlan) => {
    setSelectedActionPlanForReject(actionPlan);
    setShowRejectModal(true);
    setRejectionReason('');
  };

  const closeRejectModal = () => {
    setShowRejectModal(false);
    setSelectedActionPlanForReject(null);
    setRejectionReason('');
  };

  const handleCommentChange = (statusId, comment) => {
    setComments(prev => ({
      ...prev,
      [statusId]: comment
    }));
  };

  const toggleHistory = (statusId) => {
    setShowHistory(prev => ({
      ...prev,
      [statusId]: !prev[statusId]
    }));
  };

  // Rejection Modal
  if (showRejectModal && selectedActionPlanForReject) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {selectedActionPlanForReject.type === 'status_update' ? 'Reject Status Update' : 'Reject Project Completion'}
            </h3>
            <button
              onClick={closeRejectModal}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Please provide a reason for rejecting the {selectedActionPlanForReject.type === 'status_update' ? 'status update' : 'project completion'} for "{selectedActionPlanForReject.project_name || selectedActionPlanForReject.project_id}":
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

                // For action plans, use the status ID
                const statusId = selectedActionPlanForReject.id;
                if (!statusId) {
                  toast.error('Status ID is missing for action plan');
                  return;
                }
                handleReject(statusId, rejectionReason.trim(), selectedActionPlanForReject.type);
              }}
              disabled={rejectionReason.trim().length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {reviewing === selectedActionPlanForReject.id ? 'Processing...' : 'Reject'}
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
  if (!actionPlans) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">Error loading data</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Failed to load pending action plans. Please try again later.
          </p>
          <button
            onClick={loadPendingActionPlans}
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Review Action Plans</h1>
        {actionPlans && Array.isArray(actionPlans) && actionPlans.length > 0 && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
            {actionPlans.length} pending
          </span>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Pending Action Plan Approvals</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Review action plans from your team
          </p>
        </div>

        {actionPlans && Array.isArray(actionPlans) && actionPlans.length > 0 ? (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {actionPlans.map((actionPlan) => (
              <li key={actionPlan.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {actionPlan.type === 'status_update' ? 'Status Update Request' : 'Action Plan Request'} for {'Project name:'} {actionPlan.project_name || `Project ID: ${actionPlan.project_id}`}
                      </p>
                      <span className="ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200">
                        {actionPlan.type === 'status_update' ? 'Status Update' : 'Action Plan '}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-900 dark:text-gray-200">
                      {actionPlan.status_text}
                    </p>
                    {/* Display current action plan status and requested status */}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {
                          actionPlan.action_plan_status === 'under_approval' && actionPlan.requested_status && actionPlan.type === 'status_update'
                            ? `Requested Status: ${getActionPlanStatusText(actionPlan.requested_status)}`
                            : actionPlan.action_plan_status === 'under_approval' && actionPlan.type === 'completion_request'
                              ? `Requested Status: ${getActionPlanStatusText(actionPlan.action_plan_status)}`
                              : `Current Status: ${getActionPlanStatusText(actionPlan.action_plan_status)}`
                        }
                      </span>
                      {actionPlan.action_plan_status === 'under_approval' && actionPlan.requested_status && actionPlan.type === 'status_update' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          Previously: {getActionPlanStatusText(actionPlan.action_plan_status)}
                        </span>
                      )}
                      {actionPlan.action_plan_status === 'under_approval' && actionPlan.type === 'completion_request' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          Current Status: Under Approval
                        </span>
                      )}
                    </div>
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-1">
                        <User className="h-4 w-4 mr-1" />
                        <span>Submitted by: {actionPlan.employee_name}</span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Submitted on: {new Date(actionPlan.submitted_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Approval Comments (optional):
                        </label>
                        <textarea
                          value={comments[actionPlan.id] || ''}
                          onChange={(e) => handleCommentChange(actionPlan.id, e.target.value)}
                          rows={2}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          placeholder="Enter comments for approval (optional)..."
                        />
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0 flex flex-col space-y-2">
                    {actionPlan.id ? (
                      <>
                        <button
                          onClick={() => openRejectModal(actionPlan)}
                          disabled={reviewing === actionPlan.id}
                          className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/30 hover:bg-orange-100 dark:hover:bg-orange-900/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 text-sm font-medium"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          {actionPlan.type === 'status_update' ? 'Reject Status Update' : 'Reject Action Plan'}
                        </button>
                        <button
                          onClick={() => handleApproveActionPlan(actionPlan.id, comments[actionPlan.id] || '', actionPlan.type)}
                          disabled={reviewing === actionPlan.id}
                          className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 text-sm font-medium"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {actionPlan.type === 'status_update' ? 'Approve Status Update' : 'Approve Action Plan'}
                        </button>
                      </>
                    ) : (
                      <div className="text-red-500 text-sm">Error: Status ID missing</div>
                    )}
                  </div>
                </div>
                {/* Status History Section */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => toggleHistory(actionPlan.id)}
                    className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <History className="h-4 w-4 mr-1" />
                    {showHistory[actionPlan.id] ? 'Hide Status History' : 'Show Status History'}
                  </button>

                  {showHistory[actionPlan.id] && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Status Change History</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {/* In a real implementation, this would fetch actual history from the backend */}
                        Status history tracking will be implemented in the next update.
                      </p>
                      {/* This would be replaced with actual history data */}
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <p>• Status created as "{getActionPlanStatusText('started')}" on {new Date(actionPlan.submitted_at).toLocaleString()}</p>
                        {actionPlan.action_plan_status !== 'started' && actionPlan.action_plan_status !== 'under_approval' && (
                          <p>• Status updated to "{getActionPlanStatusText(actionPlan.action_plan_status)}" (recent)</p>
                        )}
                        {actionPlan.action_plan_status === 'under_approval' && actionPlan.requested_status && actionPlan.type === 'status_update' && (
                          <p>• Requested status update to "{getActionPlanStatusText(actionPlan.requested_status)}" (under approval)</p>
                        )}
                        {actionPlan.action_plan_status === 'under_approval' && actionPlan.type === 'completion_request' && (
                          <p>• Requested project completion with status "{getActionPlanStatusText(actionPlan.action_plan_status)}" (under approval)</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-6 py-12 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No pending action plans</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              All action plans have been reviewed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewActionPlans;
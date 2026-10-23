import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../utils/mockData';
import { toast } from 'react-toastify';
import { Users, Calendar, BarChart, FileText, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import api from '../services/api';

const ProjectDetails = () => {
  const { id } = useParams(); // Changed from projectId to id to match the route parameter
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [employeeStatuses, setEmployeeStatuses] = useState([]);
  const [teamActionPlans, setTeamActionPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingStatusId, setEditingStatusId] = useState(null);
  const [newActionPlanStatus, setNewActionPlanStatus] = useState('');
  const [activeActionPlanView, setActiveActionPlanView] = useState('my'); // 'my' or 'team'
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [reopenLoading, setReopenLoading] = useState(false);

  const loadProject = async () => {
    try {
      setLoading(true);
      const response = await apiService.getProject(id);
      setProject(response.data);
    } catch (error) {
      console.error('Error loading project:', error);
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      try {
        await apiService.deleteProject(id);
        toast.success('Project deleted successfully!');
        navigate('/projects'); // Redirect to projects list after deletion
      } catch (error) {
        toast.error('Failed to delete project');
        console.error('Error deleting project:', error);
      }
    }
  };

  const handleReopenSubmit = async () => {
    if (!reopenReason.trim()) {
      toast.error('Please enter a remark explaining why the project is being reopened.');
      return;
    }
    if (!newEndDate) {
      toast.error('Please select a new end date (deadline) for the project.');
      return;
    }

    try {
      setReopenLoading(true);
      await apiService.reopenProject(id, {
        reopen_reason: reopenReason,
        new_end_date: newEndDate
      });
      toast.success('Project has been successfully reopened and set to Active status!');
      setIsReopenModalOpen(false);
      setReopenReason('');
      setNewEndDate('');
      loadProject();
    } catch (error) {
      console.error('Error reopening project:', error);
      toast.error(error.response?.data?.error || 'Failed to reopen project');
    } finally {
      setReopenLoading(false);
    }
  };

  const loadEmployeeContributions = async () => {
    if (user.role === 'employee') {
      try {
        const response = await apiService.getEmployeeStatuses(user.id, id); // Changed from projectId to id
        setEmployeeStatuses(response.data);
      } catch (error) {
        console.error('Error loading employee contributions:', error);
      }
    }
  };

  const loadTeamActionPlans = async () => {
    try {
      const response = await apiService.getTeamActionPlans(id);
      setTeamActionPlans(response.data);
    } catch (error) {
      console.error('Error loading team action plans:', error);
    }
  };

  useEffect(() => {
    loadProject();
    loadEmployeeContributions();
    loadTeamActionPlans();
  }, [id, user.id]); // Add user.id to dependencies

  const handleMarkAsCompleted = async () => {
    if (user.role === 'employee') {
      // For employees, navigate to the status submission page where they can submit status and mark as complete
      navigate(`/status/submit/${project.id}`);
    } else {
      // For managers/admins, navigate to the review completions page
      navigate('/projects/completions');
    }
  };

  const handleRejectCompletion = async () => {
    // Navigate to the review completions page where managers can properly reject completion requests
    navigate('/projects/completions');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'in-progress':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'pending_approval':
        return 'bg-orange-100 text-orange-800';
      case 'delayed':
        return 'bg-red-100 text-red-800';
      case 'planning':
        return 'bg-purple-100 text-purple-800';
      case 'on-hold':
        return 'bg-gray-200 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionPlanStatusColor = (status) => {
    switch (status) {
      case 'started':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'testing':
        return 'bg-indigo-100 text-indigo-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'under_approval':
        return 'bg-purple-100 text-purple-800';
      case 'on_hold':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionPlanStatusText = (status) => {
    switch (status) {
      case 'started':
        return 'Started';
      case 'in_progress':
        return 'In Progress';
      case 'testing':
        return 'Testing';
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

  const startEditingStatus = (statusId, currentStatus) => {
    setEditingStatusId(statusId);
    setNewActionPlanStatus(currentStatus);
  };

  const cancelEditingStatus = () => {
    setEditingStatusId(null);
    setNewActionPlanStatus('');
  };

  const saveActionPlanStatus = async (statusId) => {
    try {
      const response = await apiService.updateActionPlanStatus(statusId, {
        action_plan_status: newActionPlanStatus
      });

      // Show success message with the new status
      toast.success(`Action plan status updated to "${getActionPlanStatusText(newActionPlanStatus)}" successfully!`);

      // Update the local state to show the new status
      setEmployeeStatuses(prevStatuses =>
        prevStatuses.map(status =>
          status.id === statusId
            ? { ...status, action_plan_status: newActionPlanStatus }
            : status
        )
      );

      // Reset editing state
      setEditingStatusId(null);
      setNewActionPlanStatus('');

    } catch (error) {
      toast.error('Failed to update action plan status');
      console.error('Error updating action plan status:', error);
    }
  };

  const handleDeleteActionPlan = async (actionPlanId) => {
    if (window.confirm('Are you sure you want to delete this action plan? This action cannot be undone.')) {
      try {
        await apiService.deleteActionPlan(actionPlanId);
        toast.success('Action plan deleted successfully!');
        // Remove the deleted action plan from the list
        setEmployeeStatuses(prevStatuses => prevStatuses.filter(status => status.id !== actionPlanId));
      } catch (error) {
        toast.error('Failed to delete action plan');
        console.error('Error deleting action plan:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Calculate managers and employees
  const managers = [];
  const employees = [];

  if (project) {
    // Add creator to managers
    if (project.created_by_name) {
      managers.push(project.created_by_name);
    }

    // Add assigners to managers
    if (project.assigned_by_names) {
      const assignedBy = project.assigned_by_names.split(',').map(s => s.trim());
      assignedBy.forEach(name => {
        if (!managers.includes(name)) {
          managers.push(name);
        }
      });
    }

    // Process team members
    if (project.team_members && project.team_members.length > 0) {
      project.team_members.forEach(member => {
        if (member.employee_role === 'manager' || member.employee_role === 'admin') {
          if (!managers.includes(member.employee_name)) {
            managers.push(member.employee_name);
          }
        } else {
          employees.push(member.employee_name);
        }
      });
    }
  }

  return (
    <div className={`space-y-6 ${['employee', 'manager'].includes(user?.role) ? 'pt-16' : ''}`}>
      {!['employee', 'manager'].includes(user.role) && (
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {project?.name}
          </h1>
          <div className="flex space-x-2">
            {/* Admin role - only view options */}
            <>
              {project?.status === 'completed' && (
                <button
                  onClick={() => setIsReopenModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 mr-2"
                >
                  Reopen Project
                </button>
              )}
              <button
                onClick={() => navigate('/projects')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Back to Projects
              </button>
            </>
          </div>
        </div>
      )}

      <div className="grid gap-6">
        {/* Project Info */}
        <div>
          <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 p-6 transition-colors duration-200">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Project Information</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</h3>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-200">{project?.description}</p>
              </div>

              {project?.reopen_reason && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
                  <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">Reopening Remark</h3>
                  <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">{project.reopen_reason}</p>
                </div>
              )}

              {/* PRD File Section - Visible to all users */}
              {project?.prd_file && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Product Requirements Document (PRD)</h3>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-2" />
                      <span className="text-sm text-gray-900 dark:text-white truncate max-w-xs">
                        {project.prd_file.originalname}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        // Create a temporary link to download/view the PRD file
                        const token = localStorage.getItem('psm_token');
                        const url = project.prd_file.url;

                        fetch(url, {
                          headers: {
                            'Authorization': `Bearer ${token}`
                          }
                        })
                          .then(response => {
                            if (!response.ok) {
                              if (response.status === 401) {
                                throw new Error('Authentication required');
                              }
                              throw new Error('Network response was not ok');
                            }
                            return response.blob();
                          })
                          .then(blob => {
                            // Create blob link to download
                            const blobUrl = window.URL.createObjectURL(new Blob([blob]));
                            const link = document.createElement('a');
                            link.href = blobUrl;
                            link.setAttribute('download', project.prd_file.originalname);
                            link.target = '_blank';

                            // Append to html link element page
                            document.body.appendChild(link);

                            // Start download
                            link.click();

                            // Clean up and remove the link
                            link.parentNode.removeChild(link);
                            window.URL.revokeObjectURL(blobUrl);
                          })
                          .catch(error => {
                            console.error('Error downloading file:', error);
                            if (error.message === 'Authentication required') {
                              // Redirect to login page
                              localStorage.removeItem('psm_token');
                              localStorage.removeItem('psm_user');
                              window.location.href = '/login';
                            } else {
                              toast.error('Failed to download PRD file. Please try again.');
                            }
                          });
                      }}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                    >
                      View
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</h3>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(project?.status)}`}>
                    {project?.status === 'active' ? 'Active' :
                      project?.status === 'pending_approval' ? 'Pending Approval' :
                        project?.status === 'delayed' ? 'Delayed' :
                          project?.status === 'in-progress' ? 'In Progress' :
                            project?.status === 'completed' ? 'Completed' :
                              project?.status === 'archived' ? 'Archived' :
                                project?.status === 'planning' ? 'Planning' :
                                  project?.status === 'on-hold' ? 'On Hold' :
                                    project?.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Timeline</h3>
                  <div className="flex items-center mt-1">
                    <Calendar className="h-4 w-4 mr-1 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm text-gray-900 dark:text-gray-200">
                      {project?.start_date ? format(new Date(project.start_date), 'MMM dd, yyyy') : ''}
                      {project?.end_date ? ` - ${format(new Date(project.end_date), 'MMM dd, yyyy')}` : ' - Present'}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Managers Involved</h3>
                  <div className="flex items-center mt-1">
                    <Users className="h-4 w-4 mr-1 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm text-gray-900 dark:text-gray-200">
                      {managers.length > 0 ? managers.join(', ') : 'No managers involved'}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Created By</h3>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-200">{project?.created_by_name || project?.created_by}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Team Members</h3>
                  <div className="flex items-center mt-1">
                    <Users className="h-4 w-4 mr-1 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm text-gray-900 dark:text-gray-200">
                      {employees.length > 0 ? employees.join(', ') : 'No team members assigned'}
                    </span>
                  </div>
                </div>

                {project?.completion_comments && (
                  <div className="md:col-span-2 border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Completion Comments / Trail</h3>
                    <p className="mt-1 text-sm font-medium text-amber-600 dark:text-amber-400">
                      {project.completion_comments}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Project Approval Requests Table - Conditionally display based on project status */}
          {user.role === 'employee' && project && (
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 p-6 mt-6 transition-colors duration-200">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Project Completion Approval Status</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Reason
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    <tr>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-200">
                        {project.status === 'completed' ? 'No recent rejection' :
                          project.rejection_reason ? project.rejection_reason :
                            project.status === 'pending_approval' ? 'Project completion request submitted for approval.' :
                              'No specific reason provided.'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${project.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-800' :
                          project.rejection_reason && project.status !== 'completed' ? 'bg-red-100 text-red-800' :
                            project.status === 'completed' ? 'bg-green-100 text-green-800' : // Green for approved
                              'bg-gray-100 text-gray-800'
                          }`}>
                          {project.status === 'pending_approval' ? 'Pending Approval' :
                            project.rejection_reason && project.status !== 'completed' ? 'Rejected' :
                              project.status === 'completed' ? 'Approved' :
                                'Not Submitted'}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}


          {/* Employee's Action Plans Toggle */}
          {/* Show for employees OR if there are team action plans available */}
          {(user.role === 'employee' || (teamActionPlans && teamActionPlans.length > 0)) && (
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 p-6 mt-6 transition-colors duration-200">
              <div className="flex space-x-4 mb-4">
                {user.role === 'employee' && (
                  <button
                    onClick={() => setActiveActionPlanView('my')}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${activeActionPlanView === 'my' ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}
                  >
                    My Action Plans
                  </button>
                )}
                <button
                  onClick={() => setActiveActionPlanView('team')}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${activeActionPlanView === 'team' ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}
                >
                  Team Action Plans
                </button>
              </div>

              {/* My Action Plans View */}
              {activeActionPlanView === 'my' && employeeStatuses.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Action Plan
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Action Plan Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {employeeStatuses.map((status) => (
                        <tr key={status.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                            {new Date(status.date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-200">
                            {/* Modified to show full action plan without truncation and allow vertical expansion */}
                            <div className="max-w-2xl break-words whitespace-normal">
                              {status.status_text}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {editingStatusId === status.id ? (
                              <div className="flex items-center space-x-2">
                                <select
                                  value={newActionPlanStatus}
                                  onChange={(e) => setNewActionPlanStatus(e.target.value)}
                                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                >
                                  <option value="started">Started</option>
                                  <option value="in_progress">In Progress</option>
                                  <option value="testing">Testing</option>
                                  <option value="completed">Completed</option>
                                  <option value="under_approval">Under Approval</option>
                                  <option value="on_hold">On Hold</option>
                                </select>
                                <button
                                  onClick={() => saveActionPlanStatus(status.id)}
                                  className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={cancelEditingStatus}
                                  className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionPlanStatusColor(status.action_plan_status)}`}>
                                {getActionPlanStatusText(status.action_plan_status)}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {/* Show status tag ONLY for mark_as_completed submissions */}
                            {status.mark_as_completed ? (
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${status.review_status === 'approved' ? 'bg-green-100 text-green-800' :
                                status.review_status === 'rejected' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                {status.review_status === 'approved' ? 'Approved' :
                                  status.review_status === 'rejected' ? 'Rejected' :
                                    'Pending Review'}
                              </span>
                            ) : (
                              // For regular submissions, show a default status
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                Submitted
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {editingStatusId !== status.id && (
                              (user.role === 'manager' || (user.role === 'employee' && parseInt(status.employee_id) === parseInt(user.id))) && (
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => startEditingStatus(status.id, status.action_plan_status)}
                                    className="inline-flex items-center px-2 py-1 border border-gray-300 rounded-md shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                                  >
                                    <Edit className="h-3 w-3 mr-1" />
                                    Edit
                                  </button>
                                  {/* Delete button for action plans */}
                                  <button
                                    onClick={() => handleDeleteActionPlan(status.id)}
                                    className="inline-flex items-center px-2 py-1 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-red-600 hover:bg-red-700"
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Delete
                                  </button>
                                </div>
                              )
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Team Action Plans View */}
              {activeActionPlanView === 'team' && teamActionPlans && teamActionPlans.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Employee
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Action Plan
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Action Plan Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {teamActionPlans.map((status) => (
                        <tr key={status.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-200">
                            {status.employee_name} ({status.employee_code})
                            {parseInt(status.employee_id) === parseInt(user.id) && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                You
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                            {new Date(status.submitted_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-200">
                            {/* Modified to show full action plan without truncation and allow vertical expansion */}
                            <div className="max-w-2xl break-words whitespace-normal">
                              {status.status_text}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionPlanStatusColor(status.action_plan_status)}`}>
                              {getActionPlanStatusText(status.action_plan_status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Empty state messages */}
              {activeActionPlanView === 'my' && employeeStatuses.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">You haven't submitted any action plans yet.</p>
                </div>
              )}
              {activeActionPlanView === 'team' && (!teamActionPlans || teamActionPlans.length === 0) && (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">No team action plans available.</p>
                </div>
              )}
            </div>
          )}



          {/* Employee Contributions for Managers */}
          {user.role !== 'employee' && project?.employee_contributions && project.employee_contributions.length > 0 && (
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 p-6 mt-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Team Contributions</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Employee
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        No of Status Reports
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {project.employee_contributions.map((contribution) => (
                      <tr key={contribution.employee_id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-200">
                          {contribution.employee_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          {contribution.status_count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Back to Projects button - hidden for employees */}
      {user.role !== 'employee' && (
        <div className="flex items-center justify-end mt-6">
          <button
            onClick={() => navigate('/projects')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Back to Projects
          </button>
        </div>
      )}
      {/* Reopen Project Modal */}
      {isReopenModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setIsReopenModalOpen(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start w-full">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                      Reopen Project: {project?.name}
                    </h3>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      Reopening this project will change its status back to <span className="font-semibold text-green-600 dark:text-green-400">Active</span>. Please set a new deadline and state the reason.
                    </p>
                    <div className="mt-4 space-y-4">
                      <div>
                        <label htmlFor="reopen-reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Remark / Reason for Reopening <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          id="reopen-reason"
                          rows="3"
                          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border"
                          placeholder="e.g. New features/requirements need to be added to this project."
                          value={reopenReason}
                          onChange={(e) => setReopenReason(e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="new-end-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          New End Date (Deadline) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          id="new-end-date"
                          min={project?.start_date ? new Date(project.start_date).toISOString().split('T')[0] : ''}
                          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border"
                          value={newEndDate}
                          onChange={(e) => setNewEndDate(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  disabled={reopenLoading}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  onClick={handleReopenSubmit}
                >
                  {reopenLoading ? 'Reopening...' : 'Reopen Project'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setIsReopenModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetails;
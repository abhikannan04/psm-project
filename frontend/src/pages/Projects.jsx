import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { Plus, Users, Calendar, Eye, AlertCircle, MoreVertical, Edit, Trash2, AlertTriangle, RotateCcw } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import ProjectFilters from '../components/ProjectFilters';
import { apiService } from '../utils/mockData';
import { toast } from 'react-toastify';

const Projects = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const statusFilter = searchParams.get('status') || 'all';
  const departmentFilter = searchParams.get('department') || null;
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(null); // Track which dropdown is open
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [projectToReopen, setProjectToReopen] = useState(null);
  const [reopenReason, setReopenReason] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [reopenLoading, setReopenLoading] = useState(false);
  const [additionalFilters, setAdditionalFilters] = useState(departmentFilter ? { department: departmentFilter } : null);

  useEffect(() => {
    loadProjects();
  }, [user]);

  useEffect(() => {
    // Initialize filters from URL parameters when component mounts
    if (departmentFilter && user.role === 'admin') {
      setAdditionalFilters({ department: departmentFilter });
    }
  }, [departmentFilter, user.role]);

  useEffect(() => {
    if (projects.length > 0) {
      filterProjects();
    }
  }, [projects, statusFilter, additionalFilters]);

  const handleFilterChange = (filters) => {
    setAdditionalFilters(filters);
    
    // Update URL parameters
    const newParams = new URLSearchParams(searchParams);
    if (filters.department && filters.department !== 'all') {
      newParams.set('department', filters.department);
    } else {
      newParams.delete('department');
    }
    setSearchParams(newParams);
  };

  const handleClearFilters = () => {
    setAdditionalFilters(null);
    
    // Remove department parameter from URL
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('department');
    setSearchParams(newParams);
  };

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await api.get('/projects');
      setProjects(response.data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterProjects = () => {
    let filtered = projects;
    
    // Apply status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'in-progress') {
        filtered = filtered.filter(project => project.status === 'in-progress');
      } else if (statusFilter === 'completed') {
        filtered = filtered.filter(project => project.status === 'completed');
      } else if (statusFilter === 'pending_approval') {
        filtered = filtered.filter(project => project.status === 'pending_approval');
      } else if (statusFilter === 'delayed') {
        filtered = filtered.filter(project => project.status === 'delayed');
      } else if (statusFilter === 'active') {
        filtered = filtered.filter(project => project.status === 'active');
      } else if (statusFilter === 'planning') {
        filtered = filtered.filter(project => project.status === 'planning');
      }
    }
    
    // Apply department filter for admin
    if (user.role === 'admin' && additionalFilters && additionalFilters.department && additionalFilters.department !== 'all') {
      filtered = filtered.filter(project => 
        project.dept_code === additionalFilters.department
      );
    }
    
    // Sort by deadline - nearest deadline first
    filtered.sort((a, b) => {
      // Projects without end_date go to the bottom
      if (!a.end_date && !b.end_date) return 0;
      if (!a.end_date) return 1;
      if (!b.end_date) return -1;
      return new Date(a.end_date) - new Date(b.end_date);
    });
    
    setFilteredProjects(filtered);
  };

  // Check if a project is near its deadline (within 3 days)
  const isNearDeadline = (project) => {
    if (!project.end_date) return false;
    // Only highlight active/in-progress projects (not completed, archived, etc.)
    const nonAlertStatuses = ['completed', 'archived', 'delayed'];
    if (nonAlertStatuses.includes(project.status)) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(project.end_date);
    endDate.setHours(0, 0, 0, 0);
    const daysLeft = differenceInDays(endDate, today);
    return daysLeft >= 0 && daysLeft <= 3;
  };

  const getDaysLeft = (project) => {
    if (!project.end_date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(project.end_date);
    endDate.setHours(0, 0, 0, 0);
    return differenceInDays(endDate, today);
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

  const toggleDropdown = (projectId) => {
    setDropdownOpen(dropdownOpen === projectId ? null : projectId);
  };

  const handleDeleteClick = (project) => {
    setProjectToDelete(project);
    setDeleteModalOpen(true);
    setDropdownOpen(null); // Close dropdown
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;
    
    try {
      await api.delete(`/projects/${projectToDelete.id}`);
      // Refresh the projects list
      loadProjects();
      setDeleteModalOpen(false);
      setProjectToDelete(null);
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project. Please try again.');
    }
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setProjectToDelete(null);
  };

  const handleReopenClick = (project) => {
    setProjectToReopen(project);
    setReopenModalOpen(true);
    setDropdownOpen(null); // Close dropdown
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
      await apiService.reopenProject(projectToReopen.id, {
        reopen_reason: reopenReason,
        new_end_date: newEndDate
      });
      toast.success('Project has been successfully reopened and set to Active status!');
      setReopenModalOpen(false);
      setProjectToReopen(null);
      setReopenReason('');
      setNewEndDate('');
      loadProjects();
    } catch (error) {
      console.error('Error reopening project:', error);
      toast.error(error.response?.data?.error || 'Failed to reopen project');
    } finally {
      setReopenLoading(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownOpen && !event.target.closest('.dropdown-container')) {
        setDropdownOpen(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center transition-colors duration-200">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {user.role === 'employee' ? 'My Projects' : 'Projects'}
          {statusFilter !== 'all' && (
            <span className="ml-2 text-lg font-normal text-gray-500 dark:text-gray-400">
              ({statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)})
            </span>
          )}
        </h1>
        <div className="flex gap-2">
          {/* Show filters for admin */}
          {user.role === 'admin' && (
            <ProjectFilters 
              initialFilters={additionalFilters}
              onFilterChange={handleFilterChange}
              onClear={handleClearFilters}
            />
          )}
          {user.role === 'manager' && (
            <Link
              to="/projects/create"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Link>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-200">
        <div className="overflow-x-hidden">
          <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>

                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Timeline
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Team
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredProjects.map((project) => {
                const nearDeadline = isNearDeadline(project);
                const daysLeft = getDaysLeft(project);
                return (
                <tr key={project.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 ${nearDeadline ? 'near-deadline-row' : ''}`}>
                  <td className="px-6 py-4">
                    <div>
                      <div className={`text-sm font-medium ${nearDeadline ? 'near-deadline-text' : 'text-gray-900 dark:text-white'}`}>
                        <Link to={`/projects/${project.id}`} className="hover:underline text-primary-600 dark:text-primary-400">
                          {project.name}
                        </Link>
                      </div>
                      {nearDeadline && (
                        <span className="near-deadline-badge mt-1">
                          <AlertTriangle className="h-3 w-3" />
                          {daysLeft === 0 ? 'Due Today!' : daysLeft === 1 ? '1 Day Left!' : `${daysLeft} Days Left!`}
                        </span>
                      )}
                      <div className="text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                        {project.description}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-start">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(project.status)}`}>
                        {project.status === 'active' ? 'Active' : 
                         project.status === 'pending_approval' ? 'Pending Approval' : 
                         project.status === 'delayed' ? 'Delayed' : 
                         project.status === 'in-progress' ? 'In Progress' :
                         project.status === 'completed' ? 'Completed' :
                         project.status === 'archived' ? 'Archived' :
                         project.status === 'planning' ? 'Planning' :
                         project.status === 'on-hold' ? 'On Hold' :
                         project.status}
                      </span>
                     
                    </div>
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center">
                      {/* <Calendar className="h-4 w-4 mr-1" /> */}
                      <span>
                        {project.start_date ? format(new Date(project.start_date), 'MMM dd') : ''}
                        {project.end_date ? ` - ${format(new Date(project.end_date), 'MMM dd, yyyy')}` : ' - Present'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-1" />
                      <span>{project.assignment_count || 0}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">
                    {user.role === 'employee' ? (
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/projects/${project.id}/submit-status`}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm rounded-md text-white bg-primary-600 hover:bg-primary-700"
                        >
                          Submit Status
                        </Link>
                        <Link
                          to={`/projects/${project.id}`}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 text-sm rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-200"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Link>
                      </div>
                    ) : user.role === 'manager' ? (
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/projects/${project.id}`}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 text-sm rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-200"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Link>
                        <Link
                          to={`/projects/${project.id}/assign`}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 text-sm rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-200"
                        >
                          <Users className="h-4 w-4 mr-1" />
                          Assign
                        </Link>
                        
                        {/* Dropdown for Edit/Delete */}
                        <div className="relative dropdown-container inline-block">
                          <button
                            onClick={() => toggleDropdown(project.id)}
                            className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 text-sm rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-200"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          
                           {dropdownOpen === project.id && (
                             <div className="origin-bottom-right absolute right-0 mb-2 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50 bottom-full">
                               <div className="flex p-1.5 space-x-1" role="menu">
                                 <Link
                                   to={`/projects/${project.id}/edit`}
                                   className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors duration-150"
                                   role="menuitem"
                                   title="Edit"
                                   onClick={() => setDropdownOpen(null)}
                                 >
                                   <Edit className="h-4 w-4" />
                                 </Link>
                                 {project.status === 'completed' && (
                                   <button
                                     onClick={() => handleReopenClick(project)}
                                     className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-md transition-colors duration-150"
                                     role="menuitem"
                                     title="Reopen"
                                   >
                                     <RotateCcw className="h-4 w-4" />
                                   </button>
                                 )}
                                 <button
                                   onClick={() => handleDeleteClick(project)}
                                   className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors duration-150"
                                   role="menuitem"
                                   title="Delete"
                                 >
                                   <Trash2 className="h-4 w-4" />
                                 </button>
                               </div>
                             </div>
                           )}
                        </div>
                      </div>
                    ) : (
                      // Admin role - only view option
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/projects/${project.id}`}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 text-sm rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-200"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Link>
                      </div>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {filteredProjects.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500 dark:text-gray-400">
              <p className="text-lg font-medium text-gray-900 dark:text-white">No projects found</p>
              <p className="mt-1">
                {user.role === 'employee' 
                  ? 'You haven\'t been assigned to any projects yet.'
                  : 'Try adjusting your filters or create a new project.'
                }
              </p>
            </div>
            {user.role === 'manager' && (
              <Link
                to="/projects/create"
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Link>
            )}
          </div>
        )}
      </div>
      
      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDeleteConfirm}
        projectName={projectToDelete?.name}
        isCompleted={projectToDelete?.status === 'completed'}
      />

      {/* Reopen Project Modal */}
      {reopenModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => { setReopenModalOpen(false); setProjectToReopen(null); }}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start w-full">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                      Reopen Project: {projectToReopen?.name}
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
                          min={projectToReopen?.start_date ? new Date(projectToReopen.start_date).toISOString().split('T')[0] : ''}
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
                  onClick={() => { setReopenModalOpen(false); setProjectToReopen(null); }}
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

export default Projects;
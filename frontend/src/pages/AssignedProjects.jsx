import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { Users, Eye, AlertTriangle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

const AssignedProjects = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssignedProjects();
  }, []);

  const loadAssignedProjects = async () => {
    try {
      setLoading(true);
      // Get projects assigned to the current user (manager or employee)
      const response = await api.get(`/assignments/employee/${user.id}`);
      
      // For each project, get additional details including assignment count
      const projectsWithDetails = await Promise.all(
        response.data.map(async (project) => {
          try {
            // Get project details to get assignment count
            const projectDetailResponse = await api.get(`/projects/${project.id}`);
            return {
              ...project,
              assignment_count: projectDetailResponse.data?.assignment_count || 0
            };
          } catch (detailError) {
            console.error(`Error fetching details for project ${project.id}:`, detailError);
            return {
              ...project,
              assignment_count: 0
            };
          }
        })
      );
      
      // Sort by deadline - nearest deadline first
      const sortedProjects = (projectsWithDetails || []).sort((a, b) => {
        if (!a.end_date && !b.end_date) return 0;
        if (!a.end_date) return 1;
        if (!b.end_date) return -1;
        return new Date(a.end_date) - new Date(b.end_date);
      });
      
      setProjects(sortedProjects);
    } catch (error) {
      console.error('Error loading assigned projects:', error);
    } finally {
      setLoading(false);
    }
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

  // Check if a project is near its deadline (within 3 days)
  const isNearDeadline = (project) => {
    if (!project.end_date) return false;
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
          Assigned Projects
        </h1>
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
              {projects.map((project) => {
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
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {projects.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500 dark:text-gray-400">
              <p className="text-lg font-medium text-gray-900 dark:text-white">No assigned projects found</p>
              <p className="mt-1">
                You haven't been assigned to any projects yet.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignedProjects;
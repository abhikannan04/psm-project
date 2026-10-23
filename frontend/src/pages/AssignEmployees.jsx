import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../utils/mockData';
import { toast } from 'react-toastify';
import { Users, X, ChevronDown, Search } from 'lucide-react';

const AssignEmployees = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  
  // Custom dropdown states
  const [isDepartmentDropdownOpen, setIsDepartmentDropdownOpen] = useState(false);
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  
  // Search terms
  const [departmentSearchTerm, setDepartmentSearchTerm] = useState('');
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  
  const departmentDropdownRef = useRef(null);
  const employeeDropdownRef = useRef(null);
  
  const { register, handleSubmit, formState: { errors }, reset } = useForm();

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (departmentDropdownRef.current && !departmentDropdownRef.current.contains(event.target)) {
        setIsDepartmentDropdownOpen(false);
        setDepartmentSearchTerm(''); // Clear search when closing
      }
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(event.target)) {
        setIsEmployeeDropdownOpen(false);
        setEmployeeSearchTerm(''); // Clear search when closing
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Get project details
      const projectResponse = await apiService.getProject(id);
      const projectData = projectResponse.data;
      setProject(projectData);
      
      // Get all employees from the backend
      const usersResponse = await apiService.getAllUsers();
      
      // Include both employees and managers for assignment
      const employeeList = usersResponse.data.filter(u => {
        return u.role === 'employee' || u.role === 'manager';
      });
      
      setEmployees(employeeList);
      
      // Set default department to manager's department
      if (user && user.department) {
        setSelectedDepartment(user.department);
      }
    } catch (error) {
      toast.error('Failed to load data');
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique departments from employees
  const getUniqueDepartments = () => {
    const departments = employees.map(emp => emp.department ? emp.department.trim() : emp.department);
    return [...new Set(departments)].filter(Boolean);
  };

  // Filter departments based on search term
  const getFilteredDepartments = () => {
    const uniqueDepartments = getUniqueDepartments();
    return uniqueDepartments.filter(dept =>
      dept.toLowerCase().includes(departmentSearchTerm.toLowerCase())
    );
  };

  // Filter employees based on selected department
  const getFilteredEmployees = () => {
    let filteredEmployees = employees;
    
    // Filter by department if selected
    if (selectedDepartment) {
      filteredEmployees = filteredEmployees.filter(emp => 
        emp.department && emp.department.trim() === selectedDepartment.trim()
      );
    }
    
    // Filter by search term if provided
    if (employeeSearchTerm) {
      filteredEmployees = filteredEmployees.filter(emp =>
        emp.name.toLowerCase().includes(employeeSearchTerm.toLowerCase())
      );
    }
    
    return filteredEmployees;
  };

  const loadAssignments = async () => {
    try {
      const assignmentsResponse = await apiService.getAssignments(id);
      setAssignments(assignmentsResponse.data);
    } catch (error) {
      toast.error('Failed to load assignments');
      console.error('Error loading assignments:', error);
    }
  };

  useEffect(() => {
    if (project) {
      loadAssignments();
    }
  }, [project]);

  const onSubmit = async (data) => {
    if (project?.status === 'completed') {
      toast.error('Cannot assign employees to a completed project');
      return;
    }
    
    setAssigning(true);
    try {
      // Use selectedEmployee instead of form data for employee_id
      await apiService.assignEmployee({
        project_id: parseInt(id),
        employee_id: parseInt(selectedEmployee)
      });
      
      toast.success('Employee assigned successfully!');
      setSelectedEmployee(''); // Reset employee selection
      setEmployeeSearchTerm(''); // Clear search term
      loadAssignments();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to assign employee');
    } finally {
      setAssigning(false);
    }
  };

  const unassignEmployee = async (assignmentId) => {
    if (project?.status === 'completed') {
      toast.error('Cannot unassign employees from a completed project');
      return;
    }
    
    try {
      await apiService.unassignEmployee(assignmentId);
      toast.success('Employee unassigned successfully!');
      loadAssignments();
    } catch (error) {
      toast.error('Failed to unassign employee');
      console.error('Error unassigning employee:', error);
    }
  };

  // Handle department selection
  const handleDepartmentSelect = (dept) => {
    setSelectedDepartment(dept);
    setIsDepartmentDropdownOpen(false);
    setDepartmentSearchTerm(''); // Clear search when selecting
  };

  // Handle employee selection
  const handleEmployeeSelect = (employeeId) => {
    setSelectedEmployee(employeeId);
    setIsEmployeeDropdownOpen(false);
    setEmployeeSearchTerm(''); // Clear search when selecting
  };

  // Handle department search input
  const handleDepartmentSearch = (e) => {
    setDepartmentSearchTerm(e.target.value);
  };

  // Handle employee search input
  const handleEmployeeSearch = (e) => {
    setEmployeeSearchTerm(e.target.value);
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
          Assign Users to {project?.name}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assignment Form */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 p-6 transition-colors duration-200">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Assign User</h2>
            
            {/* Department Filter - Custom Dropdown */}
            <div className="mb-4">
              <label htmlFor="department" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Filter by Department
              </label>
              
              {/* Custom Department Dropdown */}
              <div className="mt-1 relative" ref={departmentDropdownRef}>
                <button
                  type="button"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 transition-colors duration-200 text-left flex justify-between items-center"
                  onClick={() => setIsDepartmentDropdownOpen(!isDepartmentDropdownOpen)}
                >
                  <span>{selectedDepartment || 'All Departments'}</span>
                  <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isDepartmentDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isDepartmentDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full rounded-md bg-white dark:bg-gray-700 shadow-lg max-h-60 overflow-hidden hide-scrollbar">
                    {/* Search input for departments */}
                    <div className="p-2 border-b border-gray-200 dark:border-gray-600">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 transition-colors duration-200 text-sm"
                          placeholder="Search departments..."
                          value={departmentSearchTerm}
                          onChange={handleDepartmentSearch}
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="py-1 overflow-y-auto hide-scrollbar" style={{ maxHeight: '12rem' }}>
                      <button
                        className="block w-full text-left px-4 py-3 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                        onClick={() => handleDepartmentSelect('')}
                      >
                        All Departments
                      </button>
                      {getFilteredDepartments().map((dept) => (
                        <button
                          key={dept}
                          className="block w-full text-left px-4 py-3 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                          onClick={() => handleDepartmentSelect(dept)}
                        >
                          {dept}
                        </button>
                      ))}
                      {getFilteredDepartments().length === 0 && departmentSearchTerm && (
                        <div className="px-4 py-3 text-base text-gray-500 dark:text-gray-400">
                          No departments found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label htmlFor="employee_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Select User
                </label>
                
                {/* Custom Employee Dropdown */}
                <div className="mt-1 relative" ref={employeeDropdownRef}>
                  <button
                    type="button"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 transition-colors duration-200 text-left flex justify-between items-center"
                    onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                  >
                    <span>{selectedEmployee ? getFilteredEmployees().find(emp => emp.id == selectedEmployee)?.name : 'Choose a user'}</span>
                    <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isEmployeeDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isEmployeeDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full rounded-md bg-white dark:bg-gray-700 shadow-lg max-h-60 overflow-hidden hide-scrollbar">
                      {/* Search input for employees */}
                      <div className="p-2 border-b border-gray-200 dark:border-gray-600">
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                          </div>
                          <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 transition-colors duration-200 text-sm"
                            placeholder="Search users..."
                            value={employeeSearchTerm}
                            onChange={handleEmployeeSearch}
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="py-1 overflow-y-auto hide-scrollbar" style={{ maxHeight: '12rem' }}>
                        {getFilteredEmployees()
                          .filter(emp => !assignments.some(a => a.employee_id === emp.id))
                          .map((employee) => (
                            <button
                              key={employee.id}
                              type="button"
                              className="block w-full text-left px-4 py-3 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                              onClick={() => handleEmployeeSelect(employee.id)}
                            >
                              {employee.name}
                            </button>
                          ))}
                        {getFilteredEmployees().filter(emp => !assignments.some(a => a.employee_id === emp.id)).length === 0 && employeeSearchTerm && (
                          <div className="px-4 py-3 text-base text-gray-500 dark:text-gray-400">
                            No users found
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                {errors.employee_id && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.employee_id.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={assigning || !selectedEmployee}
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors duration-200"
              >
                {assigning ? 'Assigning...' : 'Assign User'}
              </button>
            </form>
          </div>
        </div>

        {/* Assigned Employees */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-200">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Assigned Employees</h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {assignments.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <Users className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No users assigned</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Assign users to this project to get started.
                  </p>
                </div>
              ) : (
                assignments.map((assignment) => (
                  <div key={assignment.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                        <span className="text-primary-800 dark:text-primary-200 font-medium">
                          {assignment.employee_name.charAt(0)}
                        </span>
                      </div>
                      <div className="ml-4">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">{assignment.employee_name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{assignment.employee_email}</p>
                        {assignment.employee_department && (
                          <p className="text-xs text-gray-400 dark:text-gray-500">{assignment.employee_department}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => unassignEmployee(assignment.id)}
                      className="inline-flex items-center p-2 border border-transparent rounded-full text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <button
          onClick={() => navigate('/projects')}
          className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-200"
        >
          Back to Projects
        </button>
      </div>
    </div>
  );
};

export default AssignEmployees;
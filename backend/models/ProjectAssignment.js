import db from '../db.js';

export const assignEmployeeToProject = async (assignmentData) => {
  const [id] = await db('project_assignments').insert(assignmentData).returning('id');
  return id;
};

export const getProjectAssignments = async (projectId) => {
  return await db('project_assignments')
    .join('users', 'project_assignments.employee_id', 'users.id')
    .leftJoin('users as assigners', 'project_assignments.assigned_by', 'assigners.id')
    .where('project_assignments.project_id', projectId)
    .where('project_assignments.is_active', true)
    .select('project_assignments.id', 'users.id as employee_id', 'users.name as employee_name', 'users.emp_code as employee_code', 'users.role as employee_role', 'project_assignments.assigned_at', 'assigners.name as assigned_by_name');
};

export const getEmployeeProjects = async (employeeId) => {
  return await db('project_assignments')
    .join('projects', 'project_assignments.project_id', 'projects.id')
    .where('project_assignments.employee_id', employeeId)
    .where('project_assignments.is_active', true)
    .where('projects.is_deleted', false)
    .select('projects.*');
};

export const unassignEmployee = async (assignmentId) => {
  return await db('project_assignments').where({ id: assignmentId }).update({ is_active: false });
};

export const isEmployeeAssignedToProject = async (projectId, employeeId) => {
  const assignment = await db('project_assignments')
    .where({ project_id: projectId, employee_id: employeeId, is_active: true })
    .first();
  return !!assignment;
};
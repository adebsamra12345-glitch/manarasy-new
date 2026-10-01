import apiClient from './apiClient';

export const getUsers = async (params = {}) => {
    const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '' && v !== 'all')
    );
    const query = new URLSearchParams(cleanParams).toString();
    const url = query ? `/api/users/?${query}` : '/api/users/';
    const response = await apiClient.get(url);
    return response.data;
};

export const getTeachers = async (params = {}) => {
    return getUsers({ ...params, role: 'TEACHER' });
};

export const getUserById = async (id) => {
    const response = await apiClient.get(`/api/users/${id}/`);
    return response.data;
};

export const createUser = async (userData) => {
    const response = await apiClient.post('/api/users/', userData);
    return response.data;
};

export const updateUser = async (id, userData) => {
    const response = await apiClient.put(`/api/users/${id}/`, userData);
    return response.data;
};

export const deleteUser = async (id) => {
    const response = await apiClient.delete(`/api/users/${id}/`);
    return response.data;
};

export const impersonateUser = async (id) => {
    const response = await apiClient.post(`/api/users/${id}/impersonate/`);
    return response.data;
};

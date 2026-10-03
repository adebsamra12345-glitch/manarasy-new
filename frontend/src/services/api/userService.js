import apiClient from './apiClient';

export const getUsers = async (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '' && value !== 'all') {
            if (Array.isArray(value)) {
                value.forEach(val => queryParams.append(key, val));
            } else {
                queryParams.append(key, value);
            }
        }
    });
    const query = queryParams.toString();
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

export const switchActiveRole = async (role) => {
    const response = await apiClient.post('/api/users/switch-role/', { role });
    return response.data;
};

export const getCurrentUser = async () => {
    const response = await apiClient.get('/api/users/me/');
    return response.data;
};

export const changePassword = async (data) => {
    const response = await apiClient.post('/api/users/change-password/', data);
    return response.data;
};

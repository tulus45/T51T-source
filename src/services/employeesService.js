import { requestJson } from './baseService';

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(String(reader.result || ''));
    };

    reader.onerror = () => {
      reject(new Error('Gagal membaca file foto pegawai.'));
    };

    reader.readAsDataURL(file);
  });
}

export async function listEmployees(filters = {}) {
  const searchParams = new URLSearchParams();

  if (filters.position && filters.position !== 'all') {
    searchParams.set('position', filters.position);
  }

  const queryString = searchParams.toString();

  return requestJson(`/api/employees${queryString ? `?${queryString}` : ''}`, {
    method: 'GET',
  });
}

export async function createEmployee(payload) {
  return requestJson('/api/employees', {
    body: payload,
    method: 'POST',
  });
}

export async function updateEmployee(id, payload) {
  return requestJson(`/api/employees/${id}`, {
    body: payload,
    method: 'PUT',
  });
}

export async function replaceEmployeeShiftSeparationRules(employeeId, restrictedEmployeeIds = [], createdBy = null) {
  return requestJson(`/api/employees/${employeeId}/separation-rules`, {
    body: {
      createdBy,
      restrictedEmployeeIds,
    },
    method: 'PUT',
  });
}

export async function deleteEmployee(id) {
  return requestJson(`/api/employees/${id}`, {
    method: 'DELETE',
  });
}

export async function uploadEmployeePhoto(file, _userId) {
  if (!file) {
    return null;
  }

  const dataUrl = await readFileAsDataUrl(file);

  return requestJson('/api/employees/photo', {
    body: {
      contentType: file.type,
      dataUrl,
      fileName: file.name,
    },
    method: 'POST',
  });
}

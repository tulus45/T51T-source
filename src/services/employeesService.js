import { supabase } from '../lib/supabaseClient';
import { unwrapResponse } from './baseService';

const EMPLOYEE_BUCKET = 'employee-photos';

function buildCanonicalPair(leftEmployeeId, rightEmployeeId) {
  const leftId = String(leftEmployeeId || '');
  const rightId = String(rightEmployeeId || '');

  if (!leftId || !rightId || leftId === rightId) {
    return null;
  }

  return leftId < rightId ? [leftId, rightId] : [rightId, leftId];
}

function normalizeSeparatedEmployeeIds(employeeId, values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => String(value || '')).filter(Boolean))).filter(
    (value) => value !== String(employeeId || ''),
  );
}

function attachEmployeeSeparationRules(employees = [], separationRules = []) {
  const employeeNameById = new Map(employees.map((employee) => [String(employee.id), employee.name]));
  const separatedIdsByEmployeeId = new Map(employees.map((employee) => [String(employee.id), []]));

  separationRules.forEach((rule) => {
    const leftEmployeeId = String(rule.employee_id || '');
    const rightEmployeeId = String(rule.restricted_employee_id || '');

    if (!separatedIdsByEmployeeId.has(leftEmployeeId) || !separatedIdsByEmployeeId.has(rightEmployeeId)) {
      return;
    }

    separatedIdsByEmployeeId.get(leftEmployeeId).push(rightEmployeeId);
    separatedIdsByEmployeeId.get(rightEmployeeId).push(leftEmployeeId);
  });

  return employees.map((employee) => {
    const separatedEmployeeIds = Array.from(new Set(separatedIdsByEmployeeId.get(String(employee.id)) || []));

    return {
      ...employee,
      separated_employee_ids: separatedEmployeeIds,
      separated_employee_names: separatedEmployeeIds
        .map((employeeId) => employeeNameById.get(employeeId))
        .filter(Boolean),
    };
  });
}

export async function listEmployees(filters = {}) {
  let employeeQuery = supabase.from('employees').select('*').order('hierarchy_order').order('name');

  if (filters.position && filters.position !== 'all') {
    employeeQuery = employeeQuery.eq('position', filters.position);
  }

  const [employeeResponse, separationResponse] = await Promise.all([
    employeeQuery,
    supabase.from('employee_shift_separation_rules').select('id, employee_id, restricted_employee_id'),
  ]);

  unwrapResponse(employeeResponse.error, 'Gagal mengambil data pegawai.');
  unwrapResponse(separationResponse.error, 'Gagal mengambil data relasi pisah shift pegawai.');

  return attachEmployeeSeparationRules(employeeResponse.data || [], separationResponse.data || []);
}

export async function createEmployee(payload) {
  const { data, error } = await supabase.from('employees').insert(payload).select('*').single();
  unwrapResponse(error, 'Gagal menambah pegawai.');

  return data;
}

export async function updateEmployee(id, payload) {
  const { data, error } = await supabase.from('employees').update(payload).eq('id', id).select('*').single();
  unwrapResponse(error, 'Gagal memperbarui pegawai.');

  return data;
}

export async function replaceEmployeeShiftSeparationRules(employeeId, restrictedEmployeeIds = [], createdBy = null) {
  const normalizedEmployeeId = String(employeeId || '');

  if (!normalizedEmployeeId) {
    throw new Error('Pegawai untuk rule pisah shift tidak valid.');
  }

  const targetPairs = normalizeSeparatedEmployeeIds(normalizedEmployeeId, restrictedEmployeeIds)
    .map((restrictedEmployeeId) => buildCanonicalPair(normalizedEmployeeId, restrictedEmployeeId))
    .filter(Boolean);
  const targetPairKeys = new Set(targetPairs.map((pair) => pair.join(':')));

  const { data: existingRules, error: listError } = await supabase
    .from('employee_shift_separation_rules')
    .select('id, employee_id, restricted_employee_id')
    .or(`employee_id.eq.${normalizedEmployeeId},restricted_employee_id.eq.${normalizedEmployeeId}`);

  unwrapResponse(listError, 'Gagal mengambil rule pasangan pisah shift.');

  const safeExistingRules = existingRules || [];
  const existingRuleByKey = new Map(
    safeExistingRules
      .map((rule) => {
        const canonicalPair = buildCanonicalPair(rule.employee_id, rule.restricted_employee_id);
        return canonicalPair ? [canonicalPair.join(':'), rule] : null;
      })
      .filter(Boolean),
  );

  const deleteIds = safeExistingRules
    .filter((rule) => {
      const canonicalPair = buildCanonicalPair(rule.employee_id, rule.restricted_employee_id);
      return canonicalPair && !targetPairKeys.has(canonicalPair.join(':'));
    })
    .map((rule) => rule.id);

  if (deleteIds.length > 0) {
    const { error: deleteError } = await supabase.from('employee_shift_separation_rules').delete().in('id', deleteIds);
    unwrapResponse(deleteError, 'Gagal menghapus rule pasangan pisah shift.');
  }

  const insertRows = targetPairs
    .filter((pair) => !existingRuleByKey.has(pair.join(':')))
    .map(([leftEmployeeId, rightEmployeeId]) => ({
      employee_id: leftEmployeeId,
      restricted_employee_id: rightEmployeeId,
      ...(createdBy ? { created_by: createdBy } : {}),
    }));

  if (insertRows.length > 0) {
    const { error: insertError } = await supabase.from('employee_shift_separation_rules').insert(insertRows);
    unwrapResponse(insertError, 'Gagal menyimpan rule pasangan pisah shift.');
  }
}

export async function deleteEmployee(id) {
  const { error } = await supabase.from('employees').delete().eq('id', id);
  unwrapResponse(error, 'Gagal menghapus pegawai.');
}

export async function uploadEmployeePhoto(file, userId) {
  if (!file) {
    return null;
  }

  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
  const filePath = `${userId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from(EMPLOYEE_BUCKET).upload(filePath, file, {
    cacheControl: '3600',
    upsert: false,
  });

  unwrapResponse(error, 'Upload foto pegawai gagal.');

  const { data } = supabase.storage.from(EMPLOYEE_BUCKET).getPublicUrl(filePath);

  return {
    path: filePath,
    publicUrl: data.publicUrl,
  };
}

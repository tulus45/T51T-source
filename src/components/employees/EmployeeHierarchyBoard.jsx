import { ACTIVE_EMPLOYEE_STATUSES } from '../../utils/constants';
import { getInitials } from '../../utils/helpers';

function groupEmployeesByLevel(employees) {
  const levels = employees.reduce((accumulator, employee) => {
    const level = employee.hierarchy_order || 0;

    if (!accumulator[level]) {
      accumulator[level] = [];
    }

    accumulator[level].push(employee);
    return accumulator;
  }, {});

  return Object.entries(levels)
    .map(([level, members]) => ({
      level: Number(level),
      members: members.sort((left, right) => left.name.localeCompare(right.name)),
    }))
    .sort((left, right) => left.level - right.level);
}

function getConnectorWidth(memberCount) {
  return Math.min(Math.max(memberCount * 212 - 88, 0), 980);
}

function EmployeeNodeCard({ employee }) {
  return (
    <article className="relative w-full overflow-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm md:max-w-[196px]">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-slate-100 shadow-sm">
          {employee.photo_url ? (
            <img
              alt={employee.name}
              className="h-full w-full object-contain object-center"
              src={employee.photo_url}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-100 to-slate-100 text-base font-bold text-brand-700">
              {getInitials(employee.name)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900 md:text-[15px]">{employee.name}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500 md:text-sm">{employee.position}</p>
        </div>
      </div>
    </article>
  );
}

function EmployeeHierarchyBoard({ employees }) {
  const activeEmployees = employees.filter((employee) => ACTIVE_EMPLOYEE_STATUSES.includes(employee.status));
  const groupedLevels = groupEmployeesByLevel(activeEmployees);

  return (
    <section className="surface mb-6 overflow-hidden p-5 md:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Bagan Organisasi</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Struktur pegawai toko</h2>
      </div>

      {activeEmployees.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
          <p className="text-sm font-medium text-slate-600">Belum ada pegawai aktif yang bisa ditampilkan di bagan organisasi.</p>
        </div>
      ) : (
        <div className="mt-8 space-y-6 md:space-y-7">
          {groupedLevels.map((group, index) => {
            const connectorWidth = getConnectorWidth(group.members.length);
            const hasBranches = index > 0;
            const hasHorizontal = hasBranches && group.members.length > 1;

            return (
              <div className="relative" key={group.level}>
                {hasBranches && (
                  <div className="relative hidden pt-8 md:block">
                    <div className="absolute left-1/2 top-0 h-5 w-px -translate-x-1/2 bg-slate-300" />
                    <div className="absolute left-1/2 top-5 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-white bg-brand-500 shadow-sm" />
                    {hasHorizontal && (
                      <div
                        className="absolute left-1/2 top-[1.35rem] h-px -translate-x-1/2 bg-slate-300"
                        style={{ width: `${connectorWidth}px` }}
                      />
                    )}
                  </div>
                )}

                <div className="flex flex-col items-center gap-3 md:flex-row md:flex-wrap md:justify-center md:gap-4">
                  {group.members.map((employee) => (
                    <div className="relative flex w-full justify-center md:max-w-[196px]" key={employee.id}>
                      {hasBranches && (
                        <>
                          <div className="absolute left-1/2 top-[-1.05rem] hidden h-4 w-px -translate-x-1/2 bg-slate-300 md:block" />
                          <div className="absolute left-1/2 top-[-1.1rem] hidden h-2 w-2 -translate-x-1/2 rounded-full border-2 border-white bg-slate-300 md:block" />
                        </>
                      )}
                      <EmployeeNodeCard employee={employee} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default EmployeeHierarchyBoard;
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../utils/helpers';

const weekdayLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function parseDateValue(value) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function formatDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayValue(value) {
  const parsedDate = parseDateValue(value);

  if (!parsedDate) {
    return 'Pilih tanggal';
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsedDate);
}

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function isSameDate(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isDateBefore(left, right) {
  return left.getTime() < right.getTime();
}

function isDateAfter(left, right) {
  return left.getTime() > right.getTime();
}

function isDateDisabled(date, minDate, maxDate) {
  if (minDate && isDateBefore(date, minDate)) {
    return true;
  }

  if (maxDate && isDateAfter(date, maxDate)) {
    return true;
  }

  return false;
}

function canShiftMonth(displayMonth, offset, minDate, maxDate) {
  const nextMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + offset, 1);
  const nextMonthStart = getMonthStart(nextMonth);
  const nextMonthEnd = getMonthEnd(nextMonth);

  if (minDate && isDateBefore(nextMonthEnd, minDate)) {
    return false;
  }

  if (maxDate && isDateAfter(nextMonthStart, maxDate)) {
    return false;
  }

  return true;
}

function getInitialDisplayDate(selectedDate, minDate, maxDate) {
  if (selectedDate && !isDateDisabled(selectedDate, minDate, maxDate)) {
    return selectedDate;
  }

  return minDate || maxDate || new Date();
}

function getCalendarDays(monthDate) {
  const monthStart = getMonthStart(monthDate);
  const calendarStart = new Date(monthStart);
  const offset = (monthStart.getDay() + 6) % 7;
  calendarStart.setDate(monthStart.getDate() - offset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);

    return {
      date,
      value: formatDateValue(date),
      isCurrentMonth: date.getMonth() === monthDate.getMonth(),
    };
  });
}

function DatePickerInput({ label, name, value, onChange, error, className = '', disabled = false, minDate = '', maxDate = '' }) {
  const rootRef = useRef(null);
  const selectedDate = parseDateValue(value);
  const minSelectableDate = parseDateValue(minDate);
  const maxSelectableDate = parseDateValue(maxDate);
  const displayValue = formatDisplayValue(value);
  const [isOpen, setIsOpen] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(() =>
    getMonthStart(getInitialDisplayDate(selectedDate, minSelectableDate, maxSelectableDate)),
  );

  useEffect(() => {
    setDisplayMonth(getMonthStart(getInitialDisplayDate(selectedDate, minSelectableDate, maxSelectableDate)));
  }, [maxDate, minDate, value]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const calendarDays = useMemo(() => getCalendarDays(displayMonth), [displayMonth]);
  const canGoToPreviousMonth = canShiftMonth(displayMonth, -1, minSelectableDate, maxSelectableDate);
  const canGoToNextMonth = canShiftMonth(displayMonth, 1, minSelectableDate, maxSelectableDate);
  const today = new Date();

  function emitValue(nextValue) {
    onChange?.({
      target: {
        name,
        value: nextValue,
      },
    });
  }

  function handleSelectDate(nextValue) {
    const nextDate = parseDateValue(nextValue);

    if (!nextDate || isDateDisabled(nextDate, minSelectableDate, maxSelectableDate)) {
      return;
    }

    setDisplayMonth(getMonthStart(nextDate));
    emitValue(nextValue);
    setIsOpen(false);
  }

  function handleMonthShift(offset) {
    if (!canShiftMonth(displayMonth, offset, minSelectableDate, maxSelectableDate)) {
      return;
    }

    setDisplayMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function handleToggleCalendar() {
    if (disabled) {
      return;
    }

    setIsOpen((current) => !current);
  }

  function handleOpenCalendar() {
    if (disabled) {
      return;
    }

    setIsOpen(true);
  }

  return (
    <div className={cn('relative block', isOpen ? 'z-[80]' : 'z-0', className)} ref={rootRef}>
      {label && <span className="label">{label}</span>}
      <div className="relative">
        <input
          className={cn(
            'input cursor-pointer pr-12',
            selectedDate ? 'text-slate-900' : 'text-slate-400',
            disabled ? 'cursor-not-allowed opacity-60' : '',
          )}
          disabled={disabled}
          onClick={handleOpenCalendar}
          onFocus={handleOpenCalendar}
          readOnly
          type="text"
          value={displayValue}
        />
        <input name={name} readOnly type="hidden" value={value || ''} />
        <button
          className="absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center text-slate-500 transition hover:text-slate-700"
          disabled={disabled}
          onClick={handleToggleCalendar}
          type="button"
        >
          <CalendarDays className="h-4 w-4 shrink-0" />
        </button>

        {isOpen && (
          <div className="absolute left-0 top-full z-[90] mt-2 w-[320px] rounded-3xl border border-slate-200 bg-white p-4 shadow-soft">
            <div className="mb-4 flex items-center justify-between gap-3">
              <button
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition",
                  canGoToPreviousMonth ? "hover:bg-slate-50" : "cursor-not-allowed opacity-40",
                )}
                disabled={!canGoToPreviousMonth}
                onClick={() => handleMonthShift(-1)}
                title="Bulan sebelumnya"
                type="button"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="text-sm font-semibold capitalize text-slate-900">{formatMonthLabel(displayMonth)}</p>
              <button
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition",
                  canGoToNextMonth ? "hover:bg-slate-50" : "cursor-not-allowed opacity-40",
                )}
                disabled={!canGoToNextMonth}
                onClick={() => handleMonthShift(1)}
                title="Bulan berikutnya"
                type="button"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {weekdayLabels.map((dayLabel) => (
                <span className="py-1" key={dayLabel}>
                  {dayLabel}
                </span>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const isSelected = selectedDate ? isSameDate(day.date, selectedDate) : false;
                const isToday = isSameDate(day.date, today);
                const isUnavailable = isDateDisabled(day.date, minSelectableDate, maxSelectableDate);

                return (
                  <button
                    className={cn(
                      "inline-flex h-10 items-center justify-center rounded-2xl text-sm font-medium transition",
                      day.isCurrentMonth ? "text-slate-700 hover:bg-slate-100" : "text-slate-300 hover:bg-slate-50",
                      isToday && !isSelected ? "border border-brand-200 bg-brand-50 text-brand-700" : "",
                      isSelected ? "bg-brand-600 text-white hover:bg-brand-700" : "",
                      isUnavailable ? "cursor-not-allowed text-slate-200 hover:bg-transparent" : "",
                    )}
                    disabled={isUnavailable}
                    key={day.value}
                    onClick={() => handleSelectDate(day.value)}
                    type="button"
                  >
                    {day.date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {error && <span className="mt-2 block text-sm text-red-600">{error}</span>}
    </div>
  );
}

export default DatePickerInput;
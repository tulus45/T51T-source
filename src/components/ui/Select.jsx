function Select({ label, error, options = [], className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="label">{label}</span>}
      <select className={`input ${className}`.trim()} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <span className="mt-2 block text-sm text-red-600">{error}</span>}
    </label>
  );
}

export default Select;

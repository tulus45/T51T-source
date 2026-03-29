function Textarea({ label, error, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="label">{label}</span>}
      <textarea className={`input min-h-[120px] resize-y ${className}`.trim()} {...props} />
      {error && <span className="mt-2 block text-sm text-red-600">{error}</span>}
    </label>
  );
}

export default Textarea;

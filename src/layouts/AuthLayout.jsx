function AuthLayout({ children, containerClassName = 'max-w-md' }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(79,115,255,0.22),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.18),_transparent_30%)]" />
      <div className={`relative w-full ${containerClassName}`}>{children}</div>
    </div>
  );
}

export default AuthLayout;

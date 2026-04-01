import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
      <div className="text-6xl font-mono font-bold text-white/10">404</div>
      <div className="text-white/50 font-mono text-sm tracking-widest uppercase">
        Route not found
      </div>
      <Link
        to="/observatory"
        className="glass-btn px-4 py-2 rounded-lg text-sm text-afterburner mt-2"
      >
        &larr; Back to Observatory
      </Link>
    </div>
  );
}

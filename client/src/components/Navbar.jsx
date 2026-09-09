import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const location = useLocation();

  return (
    <nav className="sticky top-0 z-50 bg-[#080b14]/85 backdrop-blur-md border-b border-white/10 px-6">
      <div className="max-w-[1280px] mx-auto h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 text-[1.2rem] font-extrabold text-slate-200 no-underline">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base bg-gradient-to-br from-yt-red to-[#ff6b6b] shadow-[0_0_40px_rgba(255,69,69,0.15)]">▶</div>
          YT<span className="text-accent">Helper</span>
        </Link>
        <ul className="flex items-center gap-2 list-none">
          <li>
            <Link
              to="/"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 
                ${location.pathname === '/' 
                  ? 'text-accent bg-slate-800' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
            >
              Library
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}

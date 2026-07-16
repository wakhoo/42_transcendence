import Timer from '../components/Timer';

export default function GamePage() {
  
  return (
    <div className="relative w-screen h-screen bg-slate-100 overflow-hidden min-w-[900px]">
    <h1 className="absolute top-5 left-8 text-4xl font-black text-slate-800 tracking widest uppercase 
    drop-shadow-[3px_3px_0_rgba(46,204,113,0.4)]">
      </h1>
      <Timer />

      {}
      
    </div>
  );
}
import { useRef, useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';



interface GameCanvasProps {

	isDrawer: boolean;
	socket?: Socket | any;
	channelId: number;
}


type DrawTool = 'pencil' | 'eraser';

export default function GameCanvas({isDrawer , socket, channelId}: GameCanvasProps) {


	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const contextRef = useRef<CanvasRenderingContext2D | null>(null);
	const prevPos = useRef<{ x: number; y: number } | null>(null);
	const [activeTool, setActiveTool] = useState<DrawTool>('pencil');
	const [color, setColor] = useState('#0a0a0a');
	const [brushSize ] = useState(4);

	const [isDrawing, setIsDrawing] = useState(false);


	useEffect(() => {

		const canvas = canvasRef.current;
		if(!canvas)
			return;
		canvas.width = 1200;
		canvas.height = 1000;
		const ctx = canvas.getContext('2d');
    	if (!ctx)
			return;

		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.strokeStyle = 'black';
		ctx.lineWidth = 5;

		contextRef.current = ctx;
		
	}, []);


	const getExactPosition = (canvas: HTMLCanvasElement, e: React.MouseEvent<HTMLCanvasElement> | MouseEvent) => {

		const rect = canvas.getBoundingClientRect();

		const scaleX = canvas.width / rect.width;
		const scaleY = canvas.height / rect.height;
		return {

			x: (e.clientX - rect.left) * scaleX,
			y: (e.clientY - rect.top) * scaleY
		};
	};


	//clique souris 
	const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {

	if(!isDrawer || !contextRef.current || !canvasRef.current)
		return;
	
	const { x, y } = getExactPosition(canvasRef.current, e);

	contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);

	setIsDrawing(true);
	prevPos.current = { x, y };

	};

	//mouvement de souris
	const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {

		if(!isDrawing || !isDrawer || !contextRef.current || !canvasRef.current || !prevPos.current)
			return;

   	 	const { x, y } = getExactPosition(canvasRef.current, e);

		drawSegment(prevPos.current.x, prevPos.current.y, x, y, color, brushSize, activeTool);
		if (socket) {
		const drawdata = {

			prevX: prevPos.current!.x,
			prevY: prevPos.current!.y,
			currentX: x,
			currentY: y,
			color: color,
			lineWidth: brushSize,
			tool: activeTool
		};
		socket.emit('draw', {drawData: drawdata , channelId: channelId});
	}
	prevPos.current = {x, y};
	};


	//dessine reellement
	const drawSegment = (x1: number, y1: number, x2: number, y2: number, segColor: string = '#FFFFFF',
		segSize: number = 4, tool: DrawTool = 'pencil') => {

		if(!contextRef.current)
				return;

		contextRef.current.beginPath();
		contextRef.current.moveTo(x1, y1);
		contextRef.current.lineTo(x2,y2);

		if (tool === 'eraser') {

			contextRef.current.globalCompositeOperation = 'destination-out';
			contextRef.current.strokeStyle = segColor;
			contextRef.current.lineWidth = segSize * 4;
		}
		else{

			contextRef.current.globalCompositeOperation = 'source-over';
			contextRef.current.strokeStyle = segColor;
			contextRef.current.lineWidth = segSize;
		}
		contextRef.current.stroke();
	};

	useEffect(() => {

		if(!socket)
			return;
	

		//dessine le trait recu d un autre joueur
		const handleIncomingDraw = (recu: any) => {

			if(isDrawer)
				return;
			const playload = recu.data || recu.drawData || recu;
			drawSegment(playload.prevX, playload.prevY, playload.currentX, playload.currentY,
				playload.color, playload.lineWidth,playload.tool || 'pencil');
		};
		socket.on('draw', handleIncomingDraw);
		return() => {
			socket.off('draw' , handleIncomingDraw);
		};

	}, [socket, isDrawer]);



	// efface le canvas et previens les autres  
	const handleEmitClear = () => {


		if(!isDrawer || !socket)
			return;

		clearCanvas();
		socket.emit('clear_canvas', {channelId: channelId});
	}

	const stopDrawing = () => {

		if(!isDrawer)
			return;
		if(!contextRef.current)
			return;
		contextRef.current.closePath();
		setIsDrawing(false);

		prevPos.current = null;
	};


	//efface tout les pixel du canvas
	const clearCanvas = () => {

		const canvas =canvasRef.current;
		if(!canvas)
			return;
		const ctx = canvas.getContext('2d');
		if(ctx)
			ctx.clearRect(0,0, canvas.width, canvas.height);
	};

	useEffect(() => {

		if(!socket)
			return;
		socket.on('round_start', clearCanvas);
		socket.on('clear_canvas', clearCanvas);
		return () => {

			socket.off('round_start', clearCanvas);
    		socket.off('clear_canvas', clearCanvas);
		};
	}, [socket]);

	// Rejoue le dessin deja fait quand on (re)rejoint une partie en cours (ex: refresh de page),
	// pour que le canvas ne reparte pas vide
	useEffect(() => {

		if(!socket)
			return;

		const handleStateSync = (data: any) => {

			if(!Array.isArray(data?.historicDraw))
				return;
			clearCanvas();
			data.historicDraw.forEach((stroke: any) => {
				drawSegment(stroke.prevX, stroke.prevY, stroke.currentX, stroke.currentY,
					stroke.color, stroke.lineWidth, stroke.tool || 'pencil');
			});
		};
		socket.on('game_state_sync', handleStateSync);
		return () => {
			socket.off('game_state_sync', handleStateSync);
		};
	}, [socket]);

	return (
    <div className="flex justify-center items-center p-4 bg-slate-100 rounded-lg">
		{isDrawer && (
                <div className="absolute top-4 bg-slate-900/90 border border-slate-700 px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-4 backdrop-blur-sm z-20">
                    
        
                    <button
                        onClick={() => setActiveTool('pencil')}
                        className={`px-4 py-1.5 rounded-full font-bold text-sm flex items-center gap-2 transition-all ${
                            activeTool === 'pencil' 
                                ? 'bg-indigo-600 text-white shadow-lg scale-105' 
                                : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                    >
                        <span>✏️</span>
                        <span>Crayon</span>
                    </button>

    
                    <button
                        onClick={() => setActiveTool('eraser')}
                        className={`px-4 py-1.5 rounded-full font-bold text-sm flex items-center gap-2 transition-all ${
                            activeTool === 'eraser' 
                                ? 'bg-amber-600 text-white shadow-lg scale-105' 
                                : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                    >
                        <span>🧽</span>
                        <span>Gomme</span>
                    </button>

                    <div className="w-px h-6 bg-slate-700" />
					<div className="flex items-center gap-1.5 ml-2">
					{['#0a0a0a', '#EF4444', '#3B82F6', '#10B981', '#F59E0B' , '#a611ac'].map((couleur) => (
						<button
						key={couleur}
						onClick={() => {
							setColor(couleur);         
							setActiveTool('pencil');   // Si on clique sur une couleur, on repasse automatiquement au crayon
						}}
						style={{ backgroundColor: couleur }}
						className={`w-6 h-6 rounded-full border border-slate-600 transition-transform ${
							color === couleur && activeTool === 'pencil' ? 'scale-125 ring-2 ring-indigo-400' : 'hover:scale-110'
						}`}
						title={`Couleur ${couleur}`}
						/>
					))}
					</div>	

                    <button
                        onClick={handleEmitClear}
                        title="Tout effacer"
                        className="bg-red-500/20 hover:bg-red-600 text-red-400 hover:text-white p-2 rounded-full transition-all active:scale-90 flex items-center justify-center w-9 h-9"
                    >
                        🗑️
                    </button>
                </div>
            )}
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing} // Quand on clique
        onMouseMove={draw}         // Quand on bouge
        onMouseUp={stopDrawing}    // Quand on relâche le clic
        onMouseLeave={stopDrawing} 
        className="absolute inset-0 w-full h-full bg-white cursor-crosshair shadow-2xl block touch-none"
      />
    </div>
  );
}





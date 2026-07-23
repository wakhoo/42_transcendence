import { useRef, useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
//import { io } from 'socket.io-client';
//import GameChat from './GameChat';
//import { useNavigate } from 'react-router-dom';


interface GameCanvasProps {

	isDrawer: boolean;
	socket?: Socket | any;
	channelId: number;
}


export default function GameCanvas({isDrawer , socket, channelId}: GameCanvasProps) {


	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const contextRef = useRef<CanvasRenderingContext2D | null>(null);
	const prevPos = useRef<{ x: number; y: number } | null>(null);

	const [isDrawing, setIsDrawing] = useState(false);

	useEffect(() => {

		const canvas = canvasRef.current;
		if(!canvas)
			return;
		canvas.width = 1000;
		canvas.height = 800;

		const context = canvas.getContext('2d');
		if(!context)
				return;

		context.lineCap = 'round';
		context.lineJoin = 'round';
		context.strokeStyle = 'black';
		context.lineWidth = 5;

		contextRef.current = context;
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

	const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {


	if(!isDrawer || !contextRef.current || !canvasRef.current)
		return;
	
	const { x, y } = getExactPosition(canvasRef.current, e);

	contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);

	setIsDrawing(true);
	prevPos.current = { x, y };

	};





	const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {

		if(!isDrawing || !isDrawer || !contextRef.current || !canvasRef.current || !prevPos.current)
			return;
		//const rect = canvasRef.current.getBoundingClientRect();
   	 	const { x, y } = getExactPosition(canvasRef.current, e);

		contextRef.current.lineTo(x,y);
		contextRef.current.stroke();

		if (socket) {
		const drawdata = {

			prevX: prevPos.current!.x,
			prevY: prevPos.current!.y,
			currentX: x,
			currentY: y,
			color: '#000000',
			lineWidth: 5
		};

		socket.emit('draw', {drawData: drawdata , channelId: channelId});
	}
	prevPos.current = {x, y};

	};

	const drawSegment = (x1: number, y1: number, x2: number, y2: number) => {

		if(!contextRef.current)
				return;

		contextRef.current.beginPath();
		contextRef.current.moveTo(x1, y1);
		contextRef.current.lineTo(x2,y2);
		contextRef.current.stroke();

	};

	useEffect(() => {

		if(!socket)
			return;
	
		const handleIncomingDraw = (recu: any) => {

			if(isDrawer)
				return;
			const playload = recu.data || recu.drawData || recu;
			drawSegment(playload.prevX, playload.prevY, playload.currentX, playload.currentY);
		};
		socket.on('draw', handleIncomingDraw);
		return() => {
			socket.off('draw' , handleIncomingDraw);
		};

	}, [socket, isDrawer]);



	const stopDrawing = () => {

		if(!isDrawer)
			return;
		if(!contextRef.current)
			return;
		contextRef.current.closePath();
		setIsDrawing(false);

		prevPos.current = null;
	};

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
		//socket.on('clear_canvas', clearCanvas);
		return () => {

			socket.off('round_start', clearCanvas);
    		//socket.off('clear_canvas', clearCanvas);
		};
	}, [socket]);

	return (
    <div className="flex justify-center items-center p-4 bg-slate-100 rounded-lg">
      <canvas
        ref={canvasRef} // On lie le HTML à notre référence React
        onMouseDown={startDrawing} // Quand on clique
        onMouseMove={draw}         // Quand on bouge
        onMouseUp={stopDrawing}    // Quand on relâche le clic
        onMouseLeave={stopDrawing} // Sécurité : si la souris sort du cadre, on arrête de dessiner
        className="bg-white border-2 border-slate-300 rounded shadow-md cursor-crosshair w-full max-w-[800px] h-auto aspect-[4/3]"
      />
    </div>
  );
}





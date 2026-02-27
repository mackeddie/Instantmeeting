import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Pencil, Eraser, Download, Trash2, Undo } from 'lucide-react';
import { RealtimeChannel } from '@supabase/supabase-js';

interface WhiteboardProps {
    channel: RealtimeChannel | null;
}

const Whiteboard: React.FC<WhiteboardProps> = ({ channel }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#8b5cf6');
    const [mode, setMode] = useState<'pencil' | 'eraser'>('pencil');

    // Ref to hold the current canvas context and drawing position for remote sync
    const lastPos = useRef<{ x: number, y: number } | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resizeCanvas = () => {
            const parent = canvas.parentElement;
            if (parent) {
                canvas.width = parent.clientWidth;
                canvas.height = parent.clientHeight;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
            }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    // Listen for remote drawing broadcasts
    useEffect(() => {
        if (!channel) return;
        const handleDraw = ({ payload }: any) => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (!canvas || !ctx) return;

            if (payload.event === 'clear') {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                return;
            }

            const { x0, y0, x1, y1, color: strokeColor, mode: strokeMode } = payload;
            ctx.beginPath();
            ctx.strokeStyle = strokeMode === 'eraser' ? '#0f172a' : strokeColor;
            ctx.lineWidth = strokeMode === 'eraser' ? 20 : 3;
            // Scale percentages back to active resolution
            ctx.moveTo(x0 * canvas.width, y0 * canvas.height);
            ctx.lineTo(x1 * canvas.width, y1 * canvas.height);
            ctx.stroke();
        };

        channel.on('broadcast', { event: 'wb_draw' }, handleDraw);
        // We do not cleanup the listener explicitly to avoid unbinding existing listeners for the room
    }, [channel]);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true);
        const { x, y } = getCoords(e);
        lastPos.current = { x, y };
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        lastPos.current = null;
    };

    const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !lastPos.current) return;

        const { x, y } = getCoords(e);

        ctx.strokeStyle = mode === 'eraser' ? '#0f172a' : color;
        ctx.lineWidth = mode === 'eraser' ? 20 : 3;

        ctx.beginPath();
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(x, y);
        ctx.stroke();

        if (channel) {
            // Broadcast as percentage of canvas to handle different screen sizes remotely
            channel.send({
                type: 'broadcast',
                event: 'wb_draw',
                payload: {
                    event: 'draw',
                    x0: lastPos.current.x / canvas.width,
                    y0: lastPos.current.y / canvas.height,
                    x1: x / canvas.width,
                    y1: y / canvas.height,
                    color,
                    mode
                }
            });
        }

        lastPos.current = { x, y };
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (channel) {
                channel.send({ type: 'broadcast', event: 'wb_draw', payload: { event: 'clear' } });
            }
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-slate-900/50 rounded-3xl overflow-hidden border border-white/5 relative">
            <div className="absolute top-4 left-1/2 -translate-x-1/2 glass px-4 py-2 rounded-2xl flex items-center space-x-4 z-10">
                <div className="flex bg-white/5 rounded-xl p-1">
                    <button
                        onClick={() => setMode('pencil')}
                        className={`p-2 rounded-lg transition-all ${mode === 'pencil' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Pencil className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setMode('eraser')}
                        className={`p-2 rounded-lg transition-all ${mode === 'eraser' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Eraser className="w-5 h-5" />
                    </button>
                </div>
                <div className="h-6 w-[1px] bg-white/10" />
                <div className="flex space-x-2">
                    {['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#ffffff'].map((c) => (
                        <button
                            key={c}
                            onClick={() => setColor(c)}
                            className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? 'scale-125 border-white' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>
                <div className="h-6 w-[1px] bg-white/10" />
                <button onClick={clearCanvas} className="p-2 text-slate-400 hover:text-red-400 transition-colors">
                    <Trash2 className="w-5 h-5" />
                </button>
            </div>
            <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseUp={stopDrawing}
                onMouseMove={draw}
                onTouchStart={startDrawing}
                onTouchEnd={stopDrawing}
                onTouchMove={draw}
                className="flex-1 cursor-crosshair bg-[#0f172a]"
            />
            <div className="absolute bottom-4 right-4 flex space-x-2">
                <button className="glass p-2 rounded-xl text-slate-400 hover:text-white"><Undo className="w-4 h-4" /></button>
                <button className="glass px-4 py-2 rounded-xl text-xs font-bold flex items-center bg-purple-600/20 text-purple-400 active:scale-95 transition-all">
                    <Download className="w-4 h-4 mr-2" /> Save Canvas
                </button>
            </div>
        </div>
    );
};

export default Whiteboard;

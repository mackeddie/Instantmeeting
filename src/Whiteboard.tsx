import React, { useRef, useEffect, useState } from 'react';
import { Pencil, Eraser, Download, Trash2, Undo } from 'lucide-react';

const Whiteboard: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#8b5cf6');
    const [mode, setMode] = useState<'pencil' | 'eraser'>('pencil');

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

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true);
        draw(e);
    };

    const stopDrawing = () => {
        const ctx = canvasRef.current?.getContext('2d');
        ctx?.beginPath();
        setIsDrawing(false);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        ctx.strokeStyle = mode === 'eraser' ? '#0f172a' : color;
        ctx.lineWidth = mode === 'eraser' ? 20 : 3;

        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
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

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Pencil, Eraser, Trash2, Download, X, Undo, Maximize2, Minimize2, 
  Sparkles, Palette, Circle 
} from 'lucide-react';

const COLORS = [
  { name: 'Yellow', hex: '#ffd600' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Cyan', hex: '#38bdf8' },
  { name: 'Green', hex: '#4ade80' },
  { name: 'Coral', hex: '#f87171' },
  { name: 'Purple', hex: '#c084fc' }
];

const SIZES = [
  { label: 'Fine', size: 2 },
  { label: 'Medium', size: 5 },
  { label: 'Bold', size: 12 },
  { label: 'Thick', size: 24 }
];

export default function Whiteboard({ 
  isOpen, 
  onClose, 
  onBroadcastAction, 
  remoteAction, 
  isEmbedded = false 
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef([]);
  const strokesHistoryRef = useRef([]); // local stroke history for redraw

  const [tool, setTool] = useState('pen'); // 'pen', 'highlighter', 'eraser'
  const [color, setColor] = useState('#ffd600');
  const [size, setSize] = useState(4);
  const [isMaximized, setIsMaximized] = useState(false);

  // Resize canvas to match display size
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Save current content before resize
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Redraw all strokes with normalized coordinates
    redrawAllStrokes();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    // Delay slightly to let modal layout settle
    const timer = setTimeout(resizeCanvas, 50);
    window.addEventListener('resize', resizeCanvas);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [isOpen, resizeCanvas, isMaximized]);

  // Redraw all strokes from history
  const redrawAllStrokes = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = containerRef.current?.getBoundingClientRect() || { width: canvas.width, height: canvas.height };

    ctx.clearRect(0, 0, rect.width, rect.height);

    for (const stroke of strokesHistoryRef.current) {
      renderStroke(ctx, stroke, rect.width, rect.height);
    }
  };

  // Render a single stroke
  const renderStroke = (ctx, stroke, width, height) => {
    if (!stroke.points || stroke.points.length < 2) return;

    ctx.save();
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = stroke.size * 2;
    } else if (stroke.tool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = stroke.size * 3;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
      ctx.globalAlpha = 1.0;
      ctx.lineWidth = stroke.size;
    }

    const p0 = stroke.points[0];
    ctx.moveTo(p0.x * width, p0.y * height);

    for (let i = 1; i < stroke.points.length; i++) {
      const pt = stroke.points[i];
      ctx.lineTo(pt.x * width, pt.y * height);
    }

    ctx.stroke();
    ctx.restore();
  };

  // Handle incoming remote stroke actions
  useEffect(() => {
    if (!remoteAction) return;

    if (remoteAction.action === 'clear') {
      strokesHistoryRef.current = [];
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const rect = containerRef.current?.getBoundingClientRect() || { width: canvas.width, height: canvas.height };
        ctx.clearRect(0, 0, rect.width, rect.height);
      }
    } else if (remoteAction.action === 'stroke' && remoteAction.stroke) {
      strokesHistoryRef.current.push(remoteAction.stroke);
      const canvas = canvasRef.current;
      if (canvas && containerRef.current) {
        const ctx = canvas.getContext('2d');
        const rect = containerRef.current.getBoundingClientRect();
        renderStroke(ctx, remoteAction.stroke, rect.width, rect.height);
      }
    }
  }, [remoteAction]);

  // Pointer drawing handlers
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;
    
    // Normalized coordinates (0.0 to 1.0)
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    };
  };

  const handlePointerDown = (e) => {
    isDrawingRef.current = true;
    const pt = getCoordinates(e);
    currentStrokeRef.current = [pt];

    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ctx = canvas.getContext('2d');
    const rect = containerRef.current.getBoundingClientRect();

    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = tool === 'eraser' ? 'transparent' : color;
    if (tool !== 'eraser') {
      ctx.arc(pt.x * rect.width, pt.y * rect.height, size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const handlePointerMove = (e) => {
    if (!isDrawingRef.current) return;
    const pt = getCoordinates(e);
    currentStrokeRef.current.push(pt);

    // Live preview local stroke
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ctx = canvas.getContext('2d');
    const rect = containerRef.current.getBoundingClientRect();
    const len = currentStrokeRef.current.length;
    if (len < 2) return;

    const pPrev = currentStrokeRef.current[len - 2];

    ctx.save();
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = size * 2;
    } else if (tool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = size * 3;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.globalAlpha = 1.0;
      ctx.lineWidth = size;
    }

    ctx.moveTo(pPrev.x * rect.width, pPrev.y * rect.height);
    ctx.lineTo(pt.x * rect.width, pt.y * rect.height);
    ctx.stroke();
    ctx.restore();
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (currentStrokeRef.current.length > 1) {
      const strokeObj = {
        tool,
        color,
        size,
        points: currentStrokeRef.current
      };
      strokesHistoryRef.current.push(strokeObj);

      // Broadcast stroke encrypted to peers
      if (onBroadcastAction) {
        onBroadcastAction({
          action: 'stroke',
          stroke: strokeObj
        });
      }
    }
    currentStrokeRef.current = [];
  };

  const handleClear = () => {
    strokesHistoryRef.current = [];
    const canvas = canvasRef.current;
    if (canvas && containerRef.current) {
      const ctx = canvas.getContext('2d');
      const rect = containerRef.current.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
    }
    if (onBroadcastAction) {
      onBroadcastAction({ action: 'clear' });
    }
  };

  const handleDownloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create an export canvas with dark background
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const ctx = exportCanvas.getContext('2d');

    // Fill dark background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    ctx.drawImage(canvas, 0, 0);

    const link = document.createElement('a');
    link.download = `nijisamvad-whiteboard-${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className={`whiteboard-overlay ${isEmbedded ? 'embedded' : ''} ${isMaximized ? 'maximized' : ''}`}>
      <div className="whiteboard-modal">
        {/* Whiteboard Header */}
        <div className="whiteboard-header">
          <div className="whiteboard-title">
            <Sparkles size={18} style={{ color: 'var(--primary)' }} />
            <span>End-to-End Encrypted Whiteboard</span>
          </div>

          <div className="whiteboard-header-actions">
            <button onClick={handleDownloadImage} className="icon-btn" title="Export as PNG">
              <Download size={18} />
            </button>
            <button onClick={() => setIsMaximized(!isMaximized)} className="icon-btn" title={isMaximized ? "Restore" : "Maximize"}>
              {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button onClick={onClose} className="icon-btn" title="Close Whiteboard">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Whiteboard Toolbar */}
        <div className="whiteboard-toolbar">
          {/* Tool Selector */}
          <div className="tool-group">
            <button 
              className={`tool-btn ${tool === 'pen' ? 'active' : ''}`} 
              onClick={() => setTool('pen')} 
              title="Pen"
            >
              <Pencil size={18} />
            </button>
            <button 
              className={`tool-btn ${tool === 'highlighter' ? 'active' : ''}`} 
              onClick={() => setTool('highlighter')} 
              title="Highlighter"
            >
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>H</span>
            </button>
            <button 
              className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`} 
              onClick={() => setTool('eraser')} 
              title="Eraser"
            >
              <Eraser size={18} />
            </button>
          </div>

          <div className="toolbar-divider" />

          {/* Color Palette */}
          <div className="color-group">
            {COLORS.map(c => (
              <button
                key={c.hex}
                className={`color-btn ${color === c.hex && tool !== 'eraser' ? 'active' : ''}`}
                style={{ backgroundColor: c.hex }}
                onClick={() => { setColor(c.hex); if (tool === 'eraser') setTool('pen'); }}
                title={c.name}
              />
            ))}
          </div>

          <div className="toolbar-divider" />

          {/* Size Selector */}
          <div className="size-group">
            {SIZES.map(s => (
              <button
                key={s.size}
                className={`size-btn ${size === s.size ? 'active' : ''}`}
                onClick={() => setSize(s.size)}
                title={`${s.label} (${s.size}px)`}
              >
                <div style={{ width: Math.max(4, s.size * 0.8), height: Math.max(4, s.size * 0.8), borderRadius: '50%', background: 'currentColor' }} />
              </button>
            ))}
          </div>

          <div className="toolbar-divider" />

          {/* Clear Button */}
          <button onClick={handleClear} className="tool-btn danger" title="Clear Canvas">
            <Trash2 size={18} />
          </button>
        </div>

        {/* Drawing Area */}
        <div className="whiteboard-canvas-container" ref={containerRef}>
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ touchAction: 'none', cursor: tool === 'eraser' ? 'crosshair' : 'default' }}
          />
        </div>
      </div>
    </div>
  );
}


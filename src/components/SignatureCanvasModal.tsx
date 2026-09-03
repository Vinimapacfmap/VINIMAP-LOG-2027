import React, { useRef, useState, useEffect } from 'react';
import { X, Eraser, CheckCircle2, FileSignature, User, FileText, Palette, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Order } from '../types';
import { resolveOrderDisplayName } from '../utils/partnerUtils';

interface SignatureCanvasModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onSaveSignature: (
    signatureDataUrl: string,
    recipientName: string,
    recipientDoc: string
  ) => void;
}

export const SignatureCanvasModal: React.FC<SignatureCanvasModalProps> = ({
  isOpen,
  onClose,
  order,
  onSaveSignature,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [penColor, setPenColor] = useState('#1e40af'); // Classic Pen Blue
  const [penWidth, setPenWidth] = useState(3);
  const [recipientName, setRecipientName] = useState('');
  const [recipientDoc, setRecipientDoc] = useState('');

  // Synchronize order details on open
  useEffect(() => {
    if (order && isOpen) {
      setRecipientName(order.recipientName || order.clientName || '');
      setRecipientDoc(order.recipientDoc || '');
      setHasDrawn(false);
      
      // Clear canvas after open delay to ensure DOM layout has computed dimensions
      setTimeout(() => {
        clearCanvas();
      }, 50);
    }
  }, [order, isOpen]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions according to display resolution
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    // Fill clean white/slate signature background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw guidelines for signature
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(20, rect.height - 35);
    ctx.lineTo(rect.width - 20, rect.height - 35);
    ctx.stroke();
    ctx.setLineDash([]);

    // Watermark line text
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('ASSINATURA BIOMÉTRICA DIGITAL (X)', rect.width - 25, rect.height - 20);

    setHasDrawn(false);
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
  };

  const handleConfirmSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !order) return;

    let finalDataUrl = '';

    if (hasDrawn) {
      // Export base64 PNG URL from interactive canvas
      finalDataUrl = canvas.toDataURL('image/png');
    } else {
      // Fallback typed signature if left blank
      const name = recipientName.trim() || order.clientName || 'Recebedor Titular';
      finalDataUrl = `typed:${name}`;
    }

    onSaveSignature(finalDataUrl, recipientName, recipientDoc);
    onClose();
  };

  if (!isOpen || !order) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col"
          id="signature-canvas-modal"
        >
          {/* Header */}
          <div className="p-5 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-xs border border-white/20">
                <FileSignature size={22} className="text-blue-100" />
              </div>
              <div>
                <h3 className="font-extrabold text-base tracking-tight leading-tight">
                  Assinatura Eletrônica em Canvas
                </h3>
                <p className="text-xs text-blue-100 font-medium">
                  Pedido #{order.id} • {resolveOrderDisplayName(order.clientName)}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form Controls & Canvas Body */}
          <div className="p-6 space-y-5 bg-slate-50/50">
            {/* Recipient Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <User size={12} className="text-blue-600" />
                  <span>Nome do Recebedor</span>
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Nome completo do recebedor"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-3xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <FileText size={12} className="text-blue-600" />
                  <span>Documento (RG / CPF)</span>
                </label>
                <input
                  type="text"
                  value={recipientDoc}
                  onChange={(e) => setRecipientDoc(e.target.value)}
                  placeholder="RG ou CPF do recebedor"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-3xs"
                />
              </div>
            </div>

            {/* Interactive Signature Canvas Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Palette size={13} className="text-blue-600" />
                  <span>Desenhe a Assinatura no Quadro Abaixo</span>
                </label>

                {/* Color & Tool Selector */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-lg">
                    {['#1e40af', '#0f172a', '#dc2626'].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setPenColor(color)}
                        className={`w-4 h-4 rounded-full transition-transform ${
                          penColor === color ? 'ring-2 ring-blue-500 scale-110' : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: color }}
                        title="Trocar cor da caneta"
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-3xs"
                    title="Limpar o quadro"
                  >
                    <Eraser size={12} />
                    <span>Limpar</span>
                  </button>
                </div>
              </div>

              {/* HTML Canvas Element */}
              <div className="border-2 border-dashed border-blue-200 rounded-2xl overflow-hidden bg-white shadow-inner relative group cursor-crosshair">
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-44 touch-none block"
                />

                {!hasDrawn && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300 font-medium text-xs">
                    <span>Use o mouse ou o toque para assinar aqui</span>
                  </div>
                )}
              </div>
            </div>

            {/* Audit compliance badge */}
            <div className="p-3 bg-blue-50/80 border border-blue-100 rounded-2xl flex items-center gap-2.5 text-blue-900 text-xs font-medium">
              <ShieldCheck size={18} className="text-blue-600 shrink-0" />
              <p className="text-[10px] leading-relaxed">
                A assinatura será gravada como imagem PNG codificada em Base64 e sincronizada no Firestore com timestamp auditado.
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmSignature}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-md shadow-blue-200 transition-all cursor-pointer"
            >
              <CheckCircle2 size={16} />
              <span>Confirmar e Salvar Assinatura</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

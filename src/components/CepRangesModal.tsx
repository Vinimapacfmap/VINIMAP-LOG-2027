/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CepRange, ClientPartner, CepTableHistoryItem } from '../types';
import FreightTableImportManager from './FreightTableImportManager';

interface CepRangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientPartner | null;
  allClientPartners?: ClientPartner[];
  onSaveCepRanges: (clientId: string, ranges: CepRange[], history?: CepTableHistoryItem[]) => void;
  onRecalculateOrdersFreight?: (clientId: string, ranges: CepRange[]) => void;
}

export default function CepRangesModal({ 
  isOpen, 
  onClose, 
  client, 
  allClientPartners,
  onSaveCepRanges,
  onRecalculateOrdersFreight
}: CepRangesModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !client) return null;

  const clientsList = allClientPartners && allClientPartners.length > 0 ? allClientPartners : [client];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-0 z-50 overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="w-full h-full max-w-full max-h-screen flex flex-col bg-white overflow-hidden shadow-2xl"
        >
          <FreightTableImportManager
            clientPartners={clientsList}
            initialSelectedClientId={client.id}
            onSaveClientCepRanges={onSaveCepRanges}
            onRecalculateOrdersFreight={onRecalculateOrdersFreight}
            isModalView={true}
            onCloseModal={onClose}
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

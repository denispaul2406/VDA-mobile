import React from 'react';
import { EscalationModal } from './EscalationModal';
import { Facility, LanguageCode } from '../types';

export interface EmergencyActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: LanguageCode;
  symptomQuery?: string;
  nearbyFacilities?: Facility[];
  emergencyInstruction?: string;
  onOpenTeleconsultation?: () => Promise<void>;
}

/**
 * Emergency Action Modal
 *
 * Canonical unified wrapper providing emergency access (108/102 ambulance,
 * eSanjeevani, nearby hospitals) with modal visibility management.
 */
export const EmergencyActionModal: React.FC<EmergencyActionModalProps> = ({
  isOpen,
  ...props
}) => {
  if (!isOpen) return null;
  return <EscalationModal {...props} />;
};


/**
 * VDA Mobile — EscalationModal Component Tests (P0 Safety-Critical UI)
 *
 * Validates:
 * - Direct emergency assistance screen (no clinician wait queue)
 * - 108 and 102 Ambulance speed dial options
 * - eSanjeevani teleconsultation action trigger
 * - Nearby emergency facility list and toggle
 * - Urgent emergency instructions and close action
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EscalationModal } from '../EscalationModal';
import { ClinicalReviewState } from '../../types';

describe('VDA Mobile — EscalationModal Component (Direct Emergency Action)', () => {
  const baseReviewState: ClinicalReviewState = {
    reviewRequested: true,
    teleconsultationOffered: true,
    teleconsultationConfigured: true,
    clinicalChatState: 'CLINICIAN_DISCONNECTED',
    clinicianResponseDeadline: new Date(Date.now() + 30000),
    firstClinicianResponseAt: null,
    fallbackShownAt: null,
    nearbyFacilities: [
      {
        name: 'District Hospital Sitapur',
        state: 'Uttar Pradesh',
        district: 'Sitapur',
        city: 'Sitapur',
        address: 'Station Road',
        contactNumber: '+91 5862 242200',
        hospitalType: 'District Hospital',
        schemes: ['PMJAY'],
        emergencyCapabilityVerified: true,
        distanceKm: 2.8,
        travelTimeMinutes: 10,
      },
    ],
    messages: [
      {
        speaker: 'PATIENT',
        text: 'I have severe chest pain',
        createdAt: new Date(),
      },
    ],
  };

  it('should render emergency guidance and reported symptoms directly without clinician waiting queue', () => {
    render(
      <EscalationModal
        review={baseReviewState}
        emergencyInstruction="Please remain calm and call 108"
        lang="en"
        onOpenTeleconsultation={vi.fn()}
      />
    );

    expect(screen.getByText(/Clinical Assistance & Emergency/i)).toBeInTheDocument();
    expect(screen.getByText('I have severe chest pain')).toBeInTheDocument();
    expect(screen.getByText(/Please remain calm and call 108/i)).toBeInTheDocument();
  });

  it('should directly render 108 and 102 ambulance calling options', () => {
    render(
      <EscalationModal
        review={baseReviewState}
        lang="en"
        onOpenTeleconsultation={vi.fn()}
      />
    );

    expect(screen.getByText('108')).toBeInTheDocument();
    expect(screen.getAllByText(/Ambulance/i).length).toBeGreaterThan(0);
    expect(screen.getByText('102')).toBeInTheDocument();

    const ambulanceLink = screen.getByRole('link', { name: /108/i });
    expect(ambulanceLink).toHaveAttribute('href', 'tel:108');
  });

  it('should directly render eSanjeevani option and trigger teleconsultation on click', () => {
    const mockOpenTeleconsultation = vi.fn();

    render(
      <EscalationModal
        review={baseReviewState}
        lang="en"
        onOpenTeleconsultation={mockOpenTeleconsultation}
      />
    );

    const teleconsultBtn = screen.getByText(/Talk to eSanjeevani/i);
    expect(teleconsultBtn).toBeInTheDocument();

    fireEvent.click(teleconsultBtn);
    expect(mockOpenTeleconsultation).toHaveBeenCalledTimes(1);
  });

  it('should render nearby emergency facilities and allow expansion', () => {
    render(
      <EscalationModal
        review={baseReviewState}
        lang="en"
        onOpenTeleconsultation={vi.fn()}
      />
    );

    expect(screen.getByText('District Hospital Sitapur')).toBeInTheDocument();
    expect(screen.getByText(/Nearby Emergency Hospitals/i)).toBeInTheDocument();

    const toggleBtn = screen.getByRole('button', { name: /Show more/i });
    expect(toggleBtn).toBeInTheDocument();
    fireEvent.click(toggleBtn);
    expect(screen.getByRole('button', { name: /Show fewer/i })).toBeInTheDocument();
  });

  it('should call onClose when dismiss button is clicked', () => {
    const mockClose = vi.fn();

    render(
      <EscalationModal
        review={baseReviewState}
        lang="en"
        onClose={mockClose}
        onOpenTeleconsultation={vi.fn()}
      />
    );

    const dismissBtn = screen.getByRole('button', { name: /Dismiss/i });
    fireEvent.click(dismissBtn);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});

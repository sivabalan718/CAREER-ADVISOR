import { describe, it, expect } from 'vitest';
import { MinorConsentService } from '../../backend/server/src/auth/minor-consent.js';

describe('Minor Consent & Age Verification Gate', () => {
  const service = new MinorConsentService();

  it('correctly identifies school minor under 18 years and triggers consent obligation', () => {
    // 16-year-old student (born in 2010 assuming test runtime)
    const sixteenYearsAgo = new Date();
    sixteenYearsAgo.setFullYear(sixteenYearsAgo.getFullYear() - 16);

    const check = service.evaluateAge(sixteenYearsAgo);
    expect(check.isMinor).toBe(true);
    expect(check.requiresGuardianConsent).toBe(true);
    expect(check.currentAge).toBe(16);
    expect(check.consentStatus).toBe('PENDING');
  });

  it('permits standard registration for college student 18 or older', () => {
    const nineteenYearsAgo = new Date();
    nineteenYearsAgo.setFullYear(nineteenYearsAgo.getFullYear() - 19);

    const check = service.evaluateAge(nineteenYearsAgo);
    expect(check.isMinor).toBe(false);
    expect(check.requiresGuardianConsent).toBe(false);
    expect(check.currentAge).toBe(19);
    expect(check.consentStatus).toBe('NOT_REQUIRED');
  });

  it('records verified guardian consent with audit trail and timestamp', () => {
    const consent = service.recordGuardianConsent({
      studentUserId: 'usr_stud_minor_01',
      studentAge: 16,
      guardianName: 'Ramesh Balan',
      guardianEmail: 'ramesh.balan@example.com',
      guardianPhone: '+91 9876543210',
      ipAddress: '127.0.0.1'
    });

    expect(consent.consentGranted).toBe(true);
    expect(consent.guardianName).toBe('Ramesh Balan');
    expect(consent.guardianEmail).toBe('ramesh.balan@example.com');
    expect(consent.consentGrantedAt).toBeDefined();
    expect(consent.consentPolicyVersion).toBe('M63_CONSENT_V1_2026');
  });

  it('rejects recording guardian consent without mandatory contact details', () => {
    expect(() => {
      service.recordGuardianConsent({
        studentUserId: 'usr_stud_minor_02',
        studentAge: 15,
        guardianName: '',
        guardianEmail: ''
      });
    }).toThrow('Guardian name and guardian email are legally required');
  });
});

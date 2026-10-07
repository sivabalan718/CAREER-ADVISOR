import { AgeCheckResult, MinorConsentRecord } from '@m63/shared';

export class MinorConsentService {
  /**
   * Evaluates if a student is a legal minor and determines guardian consent obligations.
   */
  public evaluateAge(dateOfBirth: string | Date): AgeCheckResult {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    const isMinor = age < 18;

    return {
      isMinor,
      requiresGuardianConsent: isMinor,
      currentAge: age,
      consentStatus: isMinor ? 'PENDING' : 'NOT_REQUIRED'
    };
  }

  /**
   * Validates and records guardian consent for minors.
   */
  public recordGuardianConsent(params: {
    studentUserId: string;
    studentAge: number;
    guardianName: string;
    guardianEmail: string;
    guardianPhone?: string;
    ipAddress?: string;
  }): MinorConsentRecord {
    if (!params.guardianName || !params.guardianEmail) {
      throw new Error('Guardian name and guardian email are legally required for minor consent.');
    }

    return {
      id: `consent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      studentUserId: params.studentUserId,
      studentAge: params.studentAge,
      guardianName: params.guardianName,
      guardianEmail: params.guardianEmail,
      guardianPhone: params.guardianPhone,
      consentGranted: true,
      consentGrantedAt: new Date().toISOString(),
      consentPolicyVersion: 'M63_CONSENT_V1_2026',
      ipAddress: params.ipAddress
    };
  }
}

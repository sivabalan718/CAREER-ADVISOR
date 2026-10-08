export interface MinorConsentRecord {
  id: string;
  studentUserId: string;
  studentAge: number;
  guardianName: string;
  guardianEmail: string;
  guardianPhone?: string;
  consentGranted: boolean;
  consentGrantedAt?: string;
  consentPolicyVersion: string;
  ipAddress?: string;
}

export interface AgeCheckResult {
  isMinor: boolean;
  requiresGuardianConsent: boolean;
  currentAge: number;
  consentStatus: 'NOT_REQUIRED' | 'PENDING' | 'GRANTED' | 'REVOKED';
}

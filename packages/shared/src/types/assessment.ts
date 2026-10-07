import { RIASECScores, AptitudeScores } from './student.js';

export type AssessmentCategory = 'RIASEC_INTEREST' | 'COGNITIVE_APTITUDE' | 'WORK_STYLE' | 'ACADEMIC_DIAGNOSTIC';

export interface AssessmentQuestionOption {
  id: string;
  text: string;
  weight: number;
  traitKey: string; // e.g. "realistic", "logicalReasoning"
}

export interface AssessmentQuestion {
  id: string;
  category: AssessmentCategory;
  traitTarget: string;
  prompt: string;
  options: AssessmentQuestionOption[];
  difficulty?: number;      // 0.0 to 1.0 (for future IRT/CAT calibrations)
  discrimination?: number;  // Parameter a in 2PL IRT model
}

export interface AssessmentResponse {
  questionId: string;
  selectedOptionId: string;
  responseTimeMs?: number;
  answeredAt: string;
}

export interface AdaptiveAssessmentSession {
  sessionId: string;
  studentId: string;
  category: AssessmentCategory;
  questionsPresented: string[];
  responses: AssessmentResponse[];
  currentTraitEstimates: Record<string, number>;
  estimatedStandardError: Record<string, number>;
  isCompleted: boolean;
  totalQuestionsToPresent: number;
  startedAt: string;
  completedAt?: string;
}

export interface AssessmentResult {
  sessionId: string;
  studentId: string;
  riasecResult?: RIASECScores;
  aptitudeResult?: AptitudeScores;
  confidenceScore: number;
  completedAt: string;
}

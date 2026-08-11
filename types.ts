
export enum ProcessingStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export enum ReviewStatus {
  NEW = 'NEW',
  REVIEWING = 'REVIEWING',
  APPROVED = 'APPROVED',
}

export enum ComplianceLevel {
  COMPLIANT = 'COMPLIANT',
  WARNING = 'WARNING',
  NON_COMPLIANT = 'NON_COMPLIANT'
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  details?: string;
}

export interface ComplianceData {
  level: ComplianceLevel;
  issues: string[];
  gdprFlag: boolean;
}

export interface ExtractedMetadata {
  clientName: string;
  documentType: string;
  date: string;
  referenceNumber: string;
  projectName: string;
  amount: string;
  opposingParty: string;
  department: string;
  deadline?: string;
  deadlineAction?: string;
  suggestedFolder?: string;
  summary?: string;
  urgency?: number;
  confidenceScore?: number;
  anomaly?: string;
}

export interface ScannedFile {
  id: string;
  file: File;
  fileType: 'pdf' | 'docx' | 'image' | 'excel';
  status: ProcessingStatus;
  reviewStatus: ReviewStatus;
  originalName: string;
  suggestedName: string;
  metadata?: ExtractedMetadata;
  warnings?: string[];
  errorMessage?: string;
  sourceHtml?: string;
  sourceImageUrl?: string;
  wasConverted: boolean;
  conversionTimer?: number;
  sourceArchive?: string; 
  originalFileBlob?: Blob;
  
  // New Enterprise Features
  auditLog: AuditLogEntry[];
  compliance: ComplianceData;
}

export interface GeminiResponse {
  clientName: string;
  documentType: string;
  date: string;
  referenceNumber: string;
  projectName: string;
  amount: string;
  opposingParty: string;
  department: string;
  suggestedFolder: string;
  deadline: string;
  deadlineAction: string;
  summary: string;
  urgency: number;
  confidenceScore: number;
  anomaly: string;
}

export interface PdfExportSettings {
  colorMode: 'color' | 'grayscale';
  dpi: 'original' | '150' | '300';
  autoCompress: boolean;
  autoConvertBehavior: 'ask' | 'pdf' | 'original';
}

export type ViewMode = 'cards' | 'table' | 'projects';

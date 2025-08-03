// ===== 基本型定義 =====

export interface Timestamp {
    seconds: number;
    nanoseconds: number;
}

export type Status = 'uploaded' | 'transcribed' | 'completed' | 'error' | 'processing';
export type UserRole = 'admin' | 'user';
export type PlanType = 'basic' | 'premium' | 'enterprise';

// ===== 会社情報 =====

export interface Company {
    id: string;
    name: string;
    plan: PlanType;
    created_at: Timestamp;
    updated_at: Timestamp;
    settings: CompanySettings;
}

export interface CompanySettings {
    monthly_usage_limit: number;
    api_usage_limit: number;
    max_users: number;
    storage_limit_gb: number;
}

// ===== ユーザー情報 =====

export interface User {
    id: string;
    email: string;
    name: string;
    company_id: string;
    role: UserRole;
    created_at: Timestamp;
    last_login?: Timestamp;
    is_active: boolean;
}

export interface AuthUser extends User {
    token?: string;
}

// ===== 録音データ =====

export interface Recording {
    id: string;
    user_id: string;
    company_id: string;
    title: string;
    file_path: string;
    file_size: number; // bytes
    duration: number; // seconds
    format: AudioFormat;
    created_at: Timestamp;
    status: Status;
    error_message?: string;
}

export type AudioFormat = 'mp3' | 'm4a' | 'wav' | 'aac';

// ===== 文字起こし結果 =====

export interface Transcript {
    id: string;
    recording_id: string;
    user_id: string;
    company_id: string;
    original_text: string;
    edited_text?: string;
    is_edited: boolean;
    processing_time?: number; // seconds
    confidence_score?: number;
    api_usage: WhisperUsage;
    created_at: Timestamp;
    updated_at: Timestamp;
}

export interface WhisperUsage {
    audio_duration: number; // seconds
    tokens_used?: number;
    cost?: number;
}

// ===== ケアプラン =====

export interface CarePlan {
    id: string;
    transcript_id: string;
    user_id: string;
    company_id: string;
    title: string;
    content: string;
    template_id: string;
    sections: CarePlanSection[];
    api_usage: GPTUsage;
    created_at: Timestamp;
    updated_at: Timestamp;
}

export interface CarePlanSection {
    id: string;
    title: string;
    content: string;
    order: number;
}

export interface GPTUsage {
    model: string;
    input_tokens: number;
    output_tokens: number;
    cost: number;
}

// ===== プロンプトテンプレート =====

export interface PromptTemplate {
    id: string;
    user_id?: string; // システムテンプレートの場合はnull
    company_id?: string;
    name: string;
    description?: string;
    category: string;
    prompt_content: string;
    variables?: TemplateVariable[];
    is_default: boolean;
    is_system: boolean;
    created_at: Timestamp;
    updated_at: Timestamp;
}

export interface TemplateVariable {
    name: string;
    type: 'text' | 'number' | 'select';
    required: boolean;
    default_value?: string;
    options?: string[]; // selectの場合の選択肢
}

// ===== 利用状況ログ =====

export interface UsageLog {
    id: string;
    user_id: string;
    company_id: string;
    action: UsageAction;
    resource_id: string; // recording_id, transcript_id, careplan_id
    tokens_used: number;
    cost: number;
    processing_time: number;
    created_at: Timestamp;
    year_month: string; // "2025-01" 集計用
}

export type UsageAction = 'transcribe' | 'generate_plan' | 'edit_transcript';

// ===== API レスポンス型 =====

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: ApiError;
    message?: string;
}

export interface ApiError {
    code: string;
    message: string;
    details?: any;
}

// ===== フォーム入力型 =====

export interface LoginForm {
    email: string;
    password: string;
}

export interface UserCreateForm {
    email: string;
    name: string;
    password: string;
    company_id: string;
    role: UserRole;
}

export interface TranscriptEditForm {
    original_text: string;
    edited_text: string;
}

export interface CarePlanGenerateForm {
    transcript_id: string;
    template_id: string;
    custom_instructions?: string;
}

// ===== UI状態管理 =====

export interface AppState {
    user: AuthUser | null;
    company: Company | null;
    isLoading: boolean;
    error: string | null;
}

export interface UploadState {
    file: File | null;
    progress: number;
    status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
    error: string | null;
}

export interface TranscriptionState {
    transcript: Transcript | null;
    isProcessing: boolean;
    progress: number;
    error: string | null;
}

export interface CarePlanState {
    carePlan: CarePlan | null;
    isGenerating: boolean;
    templates: PromptTemplate[];
    selectedTemplate: PromptTemplate | null;
    error: string | null;
}

// ===== ファイル処理 =====

export interface FileValidationResult {
    isValid: boolean;
    error?: string;
    warnings?: string[];
}

export interface AudioMetadata {
    duration: number;
    format: AudioFormat;
    size: number;
    channels: number;
    sampleRate: number;
}

// ===== 検索・フィルタ =====

export interface SearchFilters {
    dateFrom?: Date;
    dateTo?: Date;
    status?: Status[];
    user_id?: string;
    keyword?: string;
}

export interface PaginationOptions {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// ===== エクスポート用 =====

export interface ExportOptions {
    format: 'csv' | 'json' | 'pdf';
    dateRange: {
        start: Date;
        end: Date;
    };
    includeTranscripts: boolean;
    includeCarePlans: boolean;
}

// ===== バリデーション =====

export interface ValidationError {
    field: string;
    message: string;
    code: string;
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}
import { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import {
    onAuthStateChange,
    loginUser,
    logoutUser,
    getCompanyData,
    resetPassword,
} from '../services/auth';
import { AuthUser, Company, LoginForm, ApiResponse } from '../types';

// ===== 認証コンテキスト型定義 =====

interface AuthContextType {
    // 状態
    user: AuthUser | null;
    company: Company | null;
    loading: boolean;
    error: string | null;

    // 認証関数
    login: (email: string, password: string) => Promise<ApiResponse<AuthUser>>;
    logout: () => Promise<void>;
    sendPasswordReset: (email: string) => Promise<ApiResponse<null>>;

    // ユーティリティ
    isAuthenticated: boolean;
    isAdmin: boolean;
    clearError: () => void;
}

// ===== コンテキスト作成 =====

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ===== AuthProvider コンポーネント =====

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [company, setCompany] = useState<Company | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ===== 認証状態監視 =====

    useEffect(() => {
        const unsubscribe = onAuthStateChange(async (authUser) => {
            try {
                if (authUser) {
                    setUser(authUser);

                    // 会社情報も取得
                    const companyResult = await getCompanyData(authUser.company_id);
                    if (companyResult.success && companyResult.data) {
                        setCompany(companyResult.data);
                    } else {
                        console.error('Company data fetch failed:', companyResult.error);
                        setError('会社情報の取得に失敗しました');
                    }
                } else {
                    setUser(null);
                    setCompany(null);
                }
            } catch (err) {
                console.error('Auth state change error:', err);
                setError('認証状態の確認に失敗しました');
            } finally {
                setLoading(false);
            }
        });

        return unsubscribe;
    }, []);

    // ===== ログイン関数 =====

    const login = async (email: string, password: string): Promise<ApiResponse<AuthUser>> => {
        setLoading(true);
        setError(null);

        try {
            const result = await loginUser(email, password);

            if (!result.success) {
                setError(result.error?.message || 'ログインに失敗しました');
            }

            return result;
        } catch (err) {
            const errorMessage = 'ログイン処理でエラーが発生しました';
            setError(errorMessage);

            return {
                success: false,
                error: {
                    code: 'login-error',
                    message: errorMessage,
                },
            };
        } finally {
            setLoading(false);
        }
    };

    // ===== ログアウト関数 =====

    const logout = async (): Promise<void> => {
        setLoading(true);
        setError(null);

        try {
            await logoutUser();
            setUser(null);
            setCompany(null);
        } catch (err) {
            console.error('Logout error:', err);
            setError('ログアウトに失敗しました');
        } finally {
            setLoading(false);
        }
    };

    // ===== パスワードリセット関数 =====

    const sendPasswordReset = async (email: string): Promise<ApiResponse<null>> => {
        setError(null);

        try {
            const result = await resetPassword(email);

            if (!result.success) {
                setError(result.error?.message || 'パスワードリセットに失敗しました');
            }

            return result;
        } catch (err) {
            const errorMessage = 'パスワードリセット処理でエラーが発生しました';
            setError(errorMessage);

            return {
                success: false,
                error: {
                    code: 'password-reset-error',
                    message: errorMessage,
                },
            };
        }
    };

    // ===== エラークリア関数 =====

    const clearError = () => {
        setError(null);
    };

    // ===== 計算プロパティ =====

    const isAuthenticated = !!user;
    const isAdmin = user?.role === 'admin';

    // ===== コンテキスト値 =====

    const value: AuthContextType = {
        // 状態
        user,
        company,
        loading,
        error,

        // 関数
        login,
        logout,
        sendPasswordReset,

        // ユーティリティ
        isAuthenticated,
        isAdmin,
        clearError,
    };

    return (
        <AuthContext.Provider value= { value } >
        { children }
        </AuthContext.Provider>
  );
};

// ===== useAuth フック =====

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);

    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    return context;
};

// ===== 認証必須コンポーネントHOC =====

interface RequireAuthProps {
    children: ReactNode;
    fallback?: ReactNode;
    requireAdmin?: boolean;
}

export const RequireAuth = ({
    children,
    fallback = <div>認証が必要です </div>,
  requireAdmin = false
}: RequireAuthProps) => {
    const { isAuthenticated, isAdmin, loading } = useAuth();

    if (loading) {
        return <div>読み込み中...</div>;
    }

    if (!isAuthenticated) {
        return <>{ fallback } </>;
    }

    if (requireAdmin && !isAdmin) {
        return <div>管理者権限が必要です </div>;
    }

    return <>{ children } </>;
};

// ===== フォームバリデーション用フック =====

export const useLoginForm = () => {
    const [values, setValues] = useState<LoginForm>({
        email: '',
        password: '',
    });
    const [errors, setErrors] = useState<Partial<LoginForm>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { login } = useAuth();

    // ===== バリデーション関数 =====

    const validateForm = (): boolean => {
        const newErrors: Partial<LoginForm> = {};

        // メールアドレス検証
        if (!values.email) {
            newErrors.email = 'メールアドレスは必須です';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
            newErrors.email = 'メールアドレスの形式が正しくありません';
        }

        // パスワード検証
        if (!values.password) {
            newErrors.password = 'パスワードは必須です';
        } else if (values.password.length < 6) {
            newErrors.password = 'パスワードは6文字以上で入力してください';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // ===== 入力値変更ハンドラ =====

    const handleChange = (field: keyof LoginForm, value: string) => {
        setValues(prev => ({ ...prev, [field]: value }));

        // エラーをクリア
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: undefined }));
        }
    };

    // ===== フォーム送信ハンドラ =====

    const handleSubmit = async (onSuccess?: () => void): Promise<void> => {
        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        try {
            const result = await login(values.email, values.password);

            if (result.success) {
                onSuccess?.();
            }
        } catch (err) {
            console.error('Login form submission error:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        values,
        errors,
        isSubmitting,
        handleChange,
        handleSubmit,
        validateForm,
    };
};
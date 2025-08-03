import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
    loginUser,
    logoutUser,
    createUser,
    resetPassword,
    getCompanyData,
    getCurrentUser,
    getCurrentUserToken,
} from '../../services/auth';
import { AuthUser } from '../../types';

// Firebase のモック
jest.mock('../../services/firebase', () => ({
    auth: {
        currentUser: null,
    },
    db: {},
}));

jest.mock('firebase/auth', () => ({
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    updateProfile: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
    doc: jest.fn(),
    getDoc: jest.fn(),
    setDoc: jest.fn(),
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    getDocs: jest.fn(),
    serverTimestamp: jest.fn(() => ({ seconds: 1640995200, nanoseconds: 0 })),
    updateDoc: jest.fn(),
}));

// テスト用データ
const mockUser: AuthUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'テストユーザー',
    company_id: 'test-company-id',
    role: 'user',
    created_at: { seconds: 1640995200, nanoseconds: 0 },
    is_active: true,
    token: 'mock-token',
};

const mockAdminUser: AuthUser = {
    ...mockUser,
    id: 'test-admin-id',
    email: 'admin@example.com',
    name: '管理者',
    role: 'admin',
};

describe('認証サービス', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('loginUser', () => {
        it('正常なログインができること', async () => {
            // モックの設定
            const mockFirebaseUser = {
                uid: mockUser.id,
                getIdToken: jest.fn().mockResolvedValue('mock-token'),
            };

            const mockUserCredential = {
                user: mockFirebaseUser,
            };

            const mockUserDoc = {
                exists: () => true,
                data: () => mockUser,
            };

            // Firebase関数のモック
            const { signInWithEmailAndPassword } = require('firebase/auth');
            const { getDoc, updateDoc } = require('firebase/firestore');

            (signInWithEmailAndPassword as jest.Mock).mockResolvedValue(mockUserCredential);
            (getDoc as jest.Mock).mockResolvedValue(mockUserDoc);
            (updateDoc as jest.Mock).mockResolvedValue(undefined);

            // テスト実行
            const result = await loginUser('test@example.com', 'password123');

            // 検証
            expect(result.success).toBe(true);
            expect(result.data).toEqual(expect.objectContaining({
                email: mockUser.email,
                name: mockUser.name,
                role: mockUser.role,
            }));
            expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
                expect.anything(),
                'test@example.com',
                'password123'
            );
        });

        it('無効なメールアドレスでエラーになること', async () => {
            const { signInWithEmailAndPassword } = require('firebase/auth');

            const mockError = {
                code: 'auth/invalid-email',
                message: 'Invalid email',
            };

            (signInWithEmailAndPassword as jest.Mock).mockRejectedValue(mockError);

            const result = await loginUser('invalid-email', 'password123');

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('auth/invalid-email');
        });

        it('存在しないユーザーでエラーになること', async () => {
            const { signInWithEmailAndPassword } = require('firebase/auth');

            const mockError = {
                code: 'auth/user-not-found',
                message: 'User not found',
            };

            (signInWithEmailAndPassword as jest.Mock).mockRejectedValue(mockError);

            const result = await loginUser('notfound@example.com', 'password123');

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain('メールアドレスまたはパスワードが正しくありません');
        });

        it('無効化されたユーザーではログインできないこと', async () => {
            const mockFirebaseUser = {
                uid: mockUser.id,
                getIdToken: jest.fn().mockResolvedValue('mock-token'),
            };

            const mockUserCredential = {
                user: mockFirebaseUser,
            };

            const inactiveUser = { ...mockUser, is_active: false };
            const mockUserDoc = {
                exists: () => true,
                data: () => inactiveUser,
            };

            const { signInWithEmailAndPassword } = require('firebase/auth');
            const { getDoc } = require('firebase/firestore');
            const { signOut } = require('firebase/auth');

            (signInWithEmailAndPassword as jest.Mock).mockResolvedValue(mockUserCredential);
            (getDoc as jest.Mock).mockResolvedValue(mockUserDoc);
            (signOut as jest.Mock).mockResolvedValue(undefined);

            const result = await loginUser('test@example.com', 'password123');

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain('このアカウントは無効化されています');
            expect(signOut).toHaveBeenCalled();
        });
    });

    describe('createUser', () => {
        it('管理者が新しいユーザーを作成できること', async () => {
            // モックの設定
            const mockFirebaseUser = {
                uid: 'new-user-id',
                getIdToken: jest.fn().mockResolvedValue('mock-token'),
            };

            const mockUserCredential = {
                user: mockFirebaseUser,
            };

            const mockCompanyDoc = {
                exists: () => true,
                data: () => ({ id: 'test-company-id', name: 'テスト会社' }),
            };

            const { createUserWithEmailAndPassword, updateProfile } = require('firebase/auth');
            const { getDoc, setDoc } = require('firebase/firestore');

            (createUserWithEmailAndPassword as jest.Mock).mockResolvedValue(mockUserCredential);
            (updateProfile as jest.Mock).mockResolvedValue(undefined);
            (getDoc as jest.Mock).mockResolvedValue(mockCompanyDoc);
            (setDoc as jest.Mock).mockResolvedValue(undefined);

            // テストデータ
            const newUserData = {
                email: 'newuser@example.com',
                password: 'password123',
                name: '新規ユーザー',
                company_id: 'test-company-id',
                role: 'user' as const,
            };

            // テスト実行
            const result = await createUser(newUserData, mockAdminUser);

            // 検証
            expect(result.success).toBe(true);
            expect(result.data).toEqual(expect.objectContaining({
                email: newUserData.email,
                name: newUserData.name,
                role: newUserData.role,
                company_id: newUserData.company_id,
            }));
        });

        it('一般ユーザーは新規ユーザーを作成できないこと', async () => {
            const newUserData = {
                email: 'newuser@example.com',
                password: 'password123',
                name: '新規ユーザー',
                company_id: 'test-company-id',
                role: 'user' as const,
            };

            const result = await createUser(newUserData, mockUser);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain('ユーザー作成権限がありません');
        });

        it('存在しない会社IDでユーザー作成はエラーになること', async () => {
            const mockCompanyDoc = {
                exists: () => false,
            };

            const { getDoc } = require('firebase/firestore');
            (getDoc as jest.Mock).mockResolvedValue(mockCompanyDoc);

            const newUserData = {
                email: 'newuser@example.com',
                password: 'password123',
                name: '新規ユーザー',
                company_id: 'invalid-company-id',
                role: 'user' as const,
            };

            const result = await createUser(newUserData, mockAdminUser);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain('指定された会社が見つかりません');
        });
    });

    describe('logoutUser', () => {
        it('正常にログアウトできること', async () => {
            const { signOut } = require('firebase/auth');
            (signOut as jest.Mock).mockResolvedValue(undefined);

            const result = await logoutUser();

            expect(result.success).toBe(true);
            expect(result.message).toContain('ログアウトしました');
            expect(signOut).toHaveBeenCalled();
        });

        it('ログアウトでエラーが発生した場合の処理', async () => {
            const { signOut } = require('firebase/auth');
            const mockError = new Error('Logout failed');
            (signOut as jest.Mock).mockRejectedValue(mockError);

            const result = await logoutUser();

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain('ログアウトに失敗しました');
        });
    });

    describe('resetPassword', () => {
        it('パスワードリセットメールを送信できること', async () => {
            const { sendPasswordResetEmail } = require('firebase/auth');
            (sendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined);

            const result = await resetPassword('test@example.com');

            expect(result.success).toBe(true);
            expect(result.message).toContain('パスワードリセットメールを送信しました');
            expect(sendPasswordResetEmail).toHaveBeenCalledWith(
                expect.anything(),
                'test@example.com'
            );
        });

        it('無効なメールアドレスでエラーになること', async () => {
            const { sendPasswordResetEmail } = require('firebase/auth');
            const mockError = {
                code: 'auth/invalid-email',
                message: 'Invalid email',
            };
            (sendPasswordResetEmail as jest.Mock).mockRejectedValue(mockError);

            const result = await resetPassword('invalid-email');

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain('メールアドレスの形式が正しくありません');
        });
    });

    describe('getCompanyData', () => {
        it('会社データを正常に取得できること', async () => {
            const mockCompanyData = {
                id: 'test-company-id',
                name: 'テスト会社',
                plan: 'premium',
                settings: {
                    monthly_usage_limit: 50,
                    api_usage_limit: 300,
                },
            };

            const mockCompanyDoc = {
                exists: () => true,
                data: () => mockCompanyData,
            };

            const { getDoc } = require('firebase/firestore');
            (getDoc as jest.Mock).mockResolvedValue(mockCompanyDoc);

            const result = await getCompanyData('test-company-id');

            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockCompanyData);
        });

        it('存在しない会社IDでエラーになること', async () => {
            const mockCompanyDoc = {
                exists: () => false,
            };

            const { getDoc } = require('firebase/firestore');
            (getDoc as jest.Mock).mockResolvedValue(mockCompanyDoc);

            const result = await getCompanyData('invalid-company-id');

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain('会社情報が見つかりません');
        });
    });

    describe('getCurrentUser', () => {
        it('現在のユーザーを取得できること', () => {
            const mockAuth = require('../../services/firebase').auth;
            mockAuth.currentUser = { uid: 'test-user-id' };

            const result = getCurrentUser();

            expect(result).toEqual({ uid: 'test-user-id' });
        });

        it('ログインしていない場合はnullを返すこと', () => {
            const mockAuth = require('../../services/firebase').auth;
            mockAuth.currentUser = null;

            const result = getCurrentUser();

            expect(result).toBeNull();
        });
    });

    describe('getCurrentUserToken', () => {
        it('現在のユーザーのトークンを取得できること', async () => {
            const mockAuth = require('../../services/firebase').auth;
            const mockUser = {
                getIdToken: jest.fn().mockResolvedValue('mock-token'),
            };
            mockAuth.currentUser = mockUser;

            const result = await getCurrentUserToken();

            expect(result).toBe('mock-token');
            expect(mockUser.getIdToken).toHaveBeenCalled();
        });

        it('ログインしていない場合はnullを返すこと', async () => {
            const mockAuth = require('../../services/firebase').auth;
            mockAuth.currentUser = null;

            const result = await getCurrentUserToken();

            expect(result).toBeNull();
        });

        it('トークン取得でエラーが発生した場合はnullを返すこと', async () => {
            const mockAuth = require('../../services/firebase').auth;
            const mockUser = {
                getIdToken: jest.fn().mockRejectedValue(new Error('Token error')),
            };
            mockAuth.currentUser = mockUser;

            const result = await getCurrentUserToken();

            expect(result).toBeNull();
        });
    });
});
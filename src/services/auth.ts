import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    User as FirebaseUser,
    UserCredential,
    sendPasswordResetEmail,
    updateProfile,
} from 'firebase/auth';
import {
    doc,
    getDoc,
    setDoc,
    collection,
    query,
    where,
    getDocs,
    serverTimestamp,
    updateDoc,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { User, Company, AuthUser, UserRole, ApiResponse } from '../types';

// ===== 認証状態監視 =====

export const onAuthStateChange = (callback: (user: AuthUser | null) => void) => {
    return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
            try {
                // Firestoreからユーザー詳細情報を取得
                const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

                if (userDoc.exists()) {
                    const userData = userDoc.data() as User;
                    const authUser: AuthUser = {
                        ...userData,
                        token: await firebaseUser.getIdToken(),
                    };
                    callback(authUser);
                } else {
                    // ユーザーデータが存在しない場合はログアウト
                    await signOut(auth);
                    callback(null);
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
                callback(null);
            }
        } else {
            callback(null);
        }
    });
};

// ===== ログイン =====

export const loginUser = async (
    email: string,
    password: string
): Promise<ApiResponse<AuthUser>> => {
    try {
        const userCredential: UserCredential = await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        // Firestoreからユーザー情報を取得
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));

        if (!userDoc.exists()) {
            throw new Error('ユーザー情報が見つかりません');
        }

        const userData = userDoc.data() as User;

        // アクティブユーザーかチェック
        if (!userData.is_active) {
            await signOut(auth);
            throw new Error('このアカウントは無効化されています');
        }

        // 最終ログイン時刻を更新
        await updateDoc(doc(db, 'users', userCredential.user.uid), {
            last_login: serverTimestamp(),
        });

        const authUser: AuthUser = {
            ...userData,
            token: await userCredential.user.getIdToken(),
        };

        return {
            success: true,
            data: authUser,
            message: 'ログインに成功しました',
        };
    } catch (error: any) {
        console.error('Login error:', error);

        let errorMessage = 'ログインに失敗しました';

        switch (error.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                errorMessage = 'メールアドレスまたはパスワードが正しくありません';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'ログイン試行回数が上限に達しました。しばらく時間をおいてお試しください';
                break;
            case 'auth/user-disabled':
                errorMessage = 'このアカウントは無効化されています';
                break;
            default:
                errorMessage = error.message || 'ログインに失敗しました';
        }

        return {
            success: false,
            error: {
                code: error.code || 'login-failed',
                message: errorMessage,
            },
        };
    }
};

// ===== ユーザー作成（管理者用） =====

export const createUser = async (
    userData: {
        email: string;
        password: string;
        name: string;
        company_id: string;
        role: UserRole;
    },
    currentUser: AuthUser
): Promise<ApiResponse<User>> => {
    try {
        // 管理者権限チェック
        if (currentUser.role !== 'admin') {
            throw new Error('ユーザー作成権限がありません');
        }

        // 会社の存在確認
        const companyDoc = await getDoc(doc(db, 'companies', userData.company_id));
        if (!companyDoc.exists()) {
            throw new Error('指定された会社が見つかりません');
        }

        // Firebase Authでユーザー作成
        const userCredential = await createUserWithEmailAndPassword(
            auth,
            userData.email,
            userData.password
        );

        // プロフィール更新
        await updateProfile(userCredential.user, {
            displayName: userData.name,
        });

        // Firestoreにユーザー情報を保存
        const newUser: User = {
            id: userCredential.user.uid,
            email: userData.email,
            name: userData.name,
            company_id: userData.company_id,
            role: userData.role,
            created_at: serverTimestamp() as any,
            is_active: true,
        };

        await setDoc(doc(db, 'users', userCredential.user.uid), newUser);

        return {
            success: true,
            data: newUser,
            message: 'ユーザーを作成しました',
        };
    } catch (error: any) {
        console.error('User creation error:', error);

        let errorMessage = 'ユーザー作成に失敗しました';

        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'このメールアドレスは既に使用されています';
                break;
            case 'auth/weak-password':
                errorMessage = 'パスワードが短すぎます（6文字以上）';
                break;
            case 'auth/invalid-email':
                errorMessage = 'メールアドレスの形式が正しくありません';
                break;
            default:
                errorMessage = error.message || 'ユーザー作成に失敗しました';
        }

        return {
            success: false,
            error: {
                code: error.code || 'user-creation-failed',
                message: errorMessage,
            },
        };
    }
};

// ===== ログアウト =====

export const logoutUser = async (): Promise<ApiResponse<null>> => {
    try {
        await signOut(auth);
        return {
            success: true,
            message: 'ログアウトしました',
        };
    } catch (error: any) {
        console.error('Logout error:', error);
        return {
            success: false,
            error: {
                code: 'logout-failed',
                message: 'ログアウトに失敗しました',
            },
        };
    }
};

// ===== パスワードリセット =====

export const resetPassword = async (email: string): Promise<ApiResponse<null>> => {
    try {
        await sendPasswordResetEmail(auth, email);
        return {
            success: true,
            message: 'パスワードリセットメールを送信しました',
        };
    } catch (error: any) {
        console.error('Password reset error:', error);

        let errorMessage = 'パスワードリセットに失敗しました';

        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'このメールアドレスのユーザーが見つかりません';
                break;
            case 'auth/invalid-email':
                errorMessage = 'メールアドレスの形式が正しくありません';
                break;
            default:
                errorMessage = error.message || 'パスワードリセットに失敗しました';
        }

        return {
            success: false,
            error: {
                code: error.code || 'password-reset-failed',
                message: errorMessage,
            },
        };
    }
};

// ===== 会社情報取得 =====

export const getCompanyData = async (companyId: string): Promise<ApiResponse<Company>> => {
    try {
        const companyDoc = await getDoc(doc(db, 'companies', companyId));

        if (!companyDoc.exists()) {
            throw new Error('会社情報が見つかりません');
        }

        const companyData = companyDoc.data() as Company;

        return {
            success: true,
            data: companyData,
        };
    } catch (error: any) {
        console.error('Company data fetch error:', error);
        return {
            success: false,
            error: {
                code: 'company-fetch-failed',
                message: error.message || '会社情報の取得に失敗しました',
            },
        };
    }
};

// ===== 会社のユーザー一覧取得（管理者用） =====

export const getCompanyUsers = async (
    companyId: string,
    currentUser: AuthUser
): Promise<ApiResponse<User[]>> => {
    try {
        // 同じ会社のユーザーのみ閲覧可能
        if (currentUser.company_id !== companyId) {
            throw new Error('この会社のユーザー一覧を見る権限がありません');
        }

        const usersQuery = query(
            collection(db, 'users'),
            where('company_id', '==', companyId)
        );

        const querySnapshot = await getDocs(usersQuery);
        const users: User[] = [];

        querySnapshot.forEach((doc) => {
            users.push(doc.data() as User);
        });

        return {
            success: true,
            data: users,
        };
    } catch (error: any) {
        console.error('Company users fetch error:', error);
        return {
            success: false,
            error: {
                code: 'users-fetch-failed',
                message: error.message || 'ユーザー一覧の取得に失敗しました',
            },
        };
    }
};

// ===== ユーザー無効化/有効化（管理者用） =====

export const toggleUserStatus = async (
    userId: string,
    isActive: boolean,
    currentUser: AuthUser
): Promise<ApiResponse<null>> => {
    try {
        // 管理者権限チェック
        if (currentUser.role !== 'admin') {
            throw new Error('ユーザー状態変更権限がありません');
        }

        // 対象ユーザーの会社確認
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
            throw new Error('ユーザーが見つかりません');
        }

        const userData = userDoc.data() as User;
        if (userData.company_id !== currentUser.company_id) {
            throw new Error('異なる会社のユーザーは変更できません');
        }

        // 自分自身は無効化できない
        if (userId === currentUser.id) {
            throw new Error('自分自身のアカウントは無効化できません');
        }

        await updateDoc(doc(db, 'users', userId), {
            is_active: isActive,
            updated_at: serverTimestamp(),
        });

        return {
            success: true,
            message: `ユーザーを${isActive ? '有効' : '無効'}にしました`,
        };
    } catch (error: any) {
        console.error('User status toggle error:', error);
        return {
            success: false,
            error: {
                code: 'status-toggle-failed',
                message: error.message || 'ユーザー状態の変更に失敗しました',
            },
        };
    }
};

// ===== 現在のユーザー情報取得 =====

export const getCurrentUser = (): FirebaseUser | null => {
    return auth.currentUser;
};

// ===== トークン取得 =====

export const getCurrentUserToken = async (): Promise<string | null> => {
    const user = getCurrentUser();
    if (!user) return null;

    try {
        return await user.getIdToken();
    } catch (error) {
        console.error('Token fetch error:', error);
        return null;
    }
};
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { db, auth } from '../services/firebase';
import { Company, User, PromptTemplate } from '../types';

// ===== テスト会社データ =====

const testCompany: Omit<Company, 'id' | 'created_at' | 'updated_at'> = {
    name: '○○介護サービス株式会社',
    plan: 'premium',
    settings: {
        monthly_usage_limit: 50, // 50時間
        api_usage_limit: 300, // 300件
        max_users: 15,
        storage_limit_gb: 20,
    },
};

// ===== システムプロンプトテンプレート =====

const systemPromptTemplates: Omit<PromptTemplate, 'id' | 'created_at' | 'updated_at'>[] = [
    {
        name: '標準ケアプランテンプレート',
        description: '一般的なケアプラン作成用の基本テンプレート',
        category: 'standard',
        prompt_content: `あなたは経験豊富なケアマネージャーです。
アセスメント記録を基に、利用者に最適なケアプランを作成してください。

## 出力形式
【利用者情報】
氏名：
年齢：
要介護度：

【現状把握】
・身体状況：
・認知状況：
・生活状況：
・家族状況：

【課題・ニーズ】
1. 
2. 
3. 

【長期目標（6ヶ月）】


【短期目標（3ヶ月）】


【サービス内容】
・訪問介護：
・通所サービス：
・その他：

【モニタリング計画】


【特記事項】


## 注意事項
- 利用者の尊厳と自立支援を重視
- 安全で実現可能な計画を立案
- 家族の負担軽減も考慮
- 具体的で測定可能な目標設定`,
        is_default: true,
        is_system: true,
    },
    {
        name: '在宅サービス重点テンプレート',
        description: '在宅での生活支援に特化したケアプラン',
        category: 'home_care',
        prompt_content: `在宅生活の継続支援に特化したケアプランを作成してください。

## 重点ポイント
- 住み慣れた環境での生活継続
- 家族介護者の負担軽減
- 地域資源の活用
- 緊急時対応体制

## 評価項目
- ADL（日常生活動作）
- IADL（手段的日常生活動作）
- 居住環境の安全性
- 社会参加の機会

利用者の在宅生活が安全で快適に継続できるよう、包括的なケアプランを提案してください。`,
        is_default: false,
        is_system: true,
    },
    {
        name: '認知症対応テンプレート',
        description: '認知症の方向けの専門的なケアプラン',
        category: 'dementia',
        prompt_content: `認知症の方とご家族を支援するケアプランを作成してください。

## 認知症ケアの原則
- パーソン・センタード・ケア
- 残存機能の活用
- BPSD（行動・心理症状）への対応
- 家族支援の重要性

## 評価ポイント
- 認知機能の状態
- 行動・心理症状
- 生活リズム
- 環境要因
- 介護者の状況

認知症の進行段階に応じた適切な支援計画を立案してください。`,
        is_default: false,
        is_system: true,
    },
    {
        name: 'リハビリ重点テンプレート',
        description: '機能訓練・リハビリテーションに重点を置いたケアプラン',
        category: 'rehabilitation',
        prompt_content: `機能向上・維持を目的としたリハビリ重点のケアプランを作成してください。

## リハビリテーションの視点
- 廃用症候群の予防
- 運動機能の向上・維持
- 生活の質（QOL）の向上
- 社会復帰の支援

## 評価項目
- 運動機能（筋力、バランス、歩行）
- 日常生活動作能力
- 意欲・やる気
- 参加状況

利用者の身体機能と生活機能の向上を目指した実践的なプランを提案してください。`,
        is_default: false,
        is_system: true,
    },
];

// ===== 初期データ作成関数 =====

export const initializeTestData = async (): Promise<{
    companyId: string;
    adminUserId: string;
    normalUserId: string;
}> => {
    try {
        console.log('🚀 テストデータの初期化を開始...');

        // 1. テスト会社を作成
        const companyId = 'test-company-001';
        const companyData: Company = {
            id: companyId,
            ...testCompany,
            created_at: serverTimestamp() as any,
            updated_at: serverTimestamp() as any,
        };

        await setDoc(doc(db, 'companies', companyId), companyData);
        console.log('✅ テスト会社を作成しました');

        // 2. システムプロンプトテンプレートを作成
        for (let i = 0; i < systemPromptTemplates.length; i++) {
            const template = systemPromptTemplates[i];
            const templateId = `system-template-${i + 1}`;

            const templateData: PromptTemplate = {
                id: templateId,
                ...template,
                created_at: serverTimestamp() as any,
                updated_at: serverTimestamp() as any,
            };

            await setDoc(doc(db, 'prompt_templates', templateId), templateData);
        }
        console.log('✅ システムプロンプトテンプレートを作成しました');

        // 3. 管理者ユーザーを作成
        const adminEmail = 'admin@test-company.com';
        const adminPassword = 'password123';

        const adminCredential = await createUserWithEmailAndPassword(
            auth,
            adminEmail,
            adminPassword
        );

        await updateProfile(adminCredential.user, {
            displayName: '管理者太郎',
        });

        const adminUserData: User = {
            id: adminCredential.user.uid,
            email: adminEmail,
            name: '管理者太郎',
            company_id: companyId,
            role: 'admin',
            created_at: serverTimestamp() as any,
            is_active: true,
        };

        await setDoc(doc(db, 'users', adminCredential.user.uid), adminUserData);
        console.log('✅ 管理者ユーザーを作成しました');
        console.log(`   Email: ${adminEmail}`);
        console.log(`   Password: ${adminPassword}`);

        // 4. 一般ユーザーを作成
        const userEmail = 'user@test-company.com';
        const userPassword = 'password123';

        const userCredential = await createUserWithEmailAndPassword(
            auth,
            userEmail,
            userPassword
        );

        await updateProfile(userCredential.user, {
            displayName: 'ケアマネ花子',
        });

        const normalUserData: User = {
            id: userCredential.user.uid,
            email: userEmail,
            name: 'ケアマネ花子',
            company_id: companyId,
            role: 'user',
            created_at: serverTimestamp() as any,
            is_active: true,
        };

        await setDoc(doc(db, 'users', userCredential.user.uid), normalUserData);
        console.log('✅ 一般ユーザーを作成しました');
        console.log(`   Email: ${userEmail}`);
        console.log(`   Password: ${userPassword}`);

        console.log('🎉 テストデータの初期化が完了しました！');

        return {
            companyId,
            adminUserId: adminCredential.user.uid,
            normalUserId: userCredential.user.uid,
        };

    } catch (error) {
        console.error('❌ テストデータ初期化エラー:', error);
        throw error;
    }
};

// ===== 開発用ヘルパー関数 =====

export const resetTestData = async (): Promise<void> => {
    console.log('🗑️ テストデータのリセットを開始...');
    // 実装は必要に応じて（今回は手動削除を想定）
    console.log('手動でFirebase Consoleからデータを削除してください');
};

// ===== 本番環境チェック =====

export const isProductionEnvironment = (): boolean => {
    return process.env.NODE_ENV === 'production';
};

// ===== 安全な初期化実行 =====

export const safeInitializeTestData = async (): Promise<void> => {
    if (isProductionEnvironment()) {
        console.warn('⚠️ 本番環境ではテストデータを作成できません');
        return;
    }

    const confirmed = window.confirm(
        'テストデータを作成しますか？\n\n' +
        '以下のデータが作成されます：\n' +
        '- テスト会社\n' +
        '- 管理者ユーザー (admin@test-company.com)\n' +
        '- 一般ユーザー (user@test-company.com)\n' +
        '- システムプロンプトテンプレート'
    );

    if (confirmed) {
        try {
            await initializeTestData();
            alert('✅ テストデータの作成が完了しました！');
        } catch (error) {
            alert('❌ テストデータの作成に失敗しました。コンソールを確認してください。');
            console.error(error);
        }
    }
};
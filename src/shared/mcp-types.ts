export interface McpKey {
  id: string;
  label: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}
export interface McpSettings { keys: McpKey[]; endpoint: string; maxActiveKeys: number }
export interface IssuedMcpKey { key: McpKey; token: string }

export const MCP_TOOLS = [
  { name: 'town_get_overview', title: '町の概況', description: '利用者数・訪問履歴あり人数・しおり作成率・カテゴリ別掲載数の現在値を取得します。' },
  { name: 'town_get_spot_performance', title: 'スポット別の実績', description: '期間内のCSV訪問・クーポン利用と、期間内に作成されたしおりの現在の掲載数を比較します。' },
  { name: 'town_get_brochure_breakdown', title: 'しおりの傾向', description: '現在保存されているしおりを同行者・日数・過ごし方・デザイン別に集計します。' },
  { name: 'town_get_coupon_activity', title: 'クーポン利用', description: '期間内の利用申告件数・人数とスポット別の内訳を取得します。実来訪の証明ではありません。' },
  { name: 'town_get_share_activity', title: '共有の広がり', description: '共有URLの現在の発行・公開件数と、期間内の発行件数・ページ表示回数を取得します。閲覧人数ではありません。' },
  { name: 'town_get_activity_trend', title: '日別の推移', description: '期間内のCSV訪問・しおり初回作成・クーポン利用・共有ページ表示をJSTの日別に集計します。' },
] as const;

export const MCP_QUESTIONS = [
  '提供データだけで、しおり作成率と人気の体験カテゴリを分析してください。',
  '直近30日のスポット掲載・CSV訪問・クーポン利用を比較し、改善の仮説を挙げてください。',
  'しおりの同行者・日数・過ごし方の傾向から、町の観光施策を提案してください。',
] as const;

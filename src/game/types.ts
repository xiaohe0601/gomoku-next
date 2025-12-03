// 玩家类型枚举
export enum Player {
  BLACK = "black",
  WHITE = "white"
}

// 棋子颜色类型
export type StoneColor = "black" | "white";

// 坐标位置接口
export interface Position {
  x: number;
  y: number;
}

// 游戏状态枚举
export enum GameState {
  READY = "ready", // 准备就绪
  PLAYING = "playing", // 游戏进行中
  PAUSED = "paused", // 游戏暂停
  OVER = "over" // 游戏结束
}

// 落子记录接口
export interface Move {
  position: Position;
  player: Player;
  timestamp: number;
}

// 棋盘大小类型
export type BoardSize = 15 | 19;

// 游戏模式枚举
export enum GameMode {
  PVP = "pvp", // 玩家VS玩家
  PVE = "pve" // 玩家VS电脑
}

// 游戏结果接口
export interface GameResult {
  winner: Player | null;
  winningLine: Position[];
}

// 道具类型枚举
export enum ItemType {
  // 强化类道具（5种）
  CHAOS_STRIKE = "chaos_strike", // 混沌打击：随机移除对手的1颗棋子
  PRECISE_STRIKE = "precise_strike", // 精准打击：允许玩家指定移除对手的1颗棋子
  ACCELERATED_MOVE = "accelerated_move", // 加速落子：使玩家在本回合获得额外1次落子机会
  STRATEGY_GUIDE = "strategy_guide", // 策略指引：由系统推荐3个最优落子位置
  TOUGHEN_HEART = "toughen_heart", // 钢化我心：使玩家免疫下一次对手发起的移除类攻击

  // 弱化类道具（3种）
  SELF_MISTAKE = "self_mistake", // 自我失误：随机移除玩家自己的1颗棋子
  OPPONENT_ACCELERATION = "opponent_acceleration", // 对手加速：使对手在本回合获得额外1次落子机会
  SLIP_PENALTY = "slip_penalty" // 手滑惩罚：限制玩家本回合只能从系统随机给出的3个位置中选择1个落子
}

// 道具效果类型枚举
export enum ItemEffectType {
  INSTANT = "instant", // 即时效果
  DELAYED = "delayed", // 延迟效果
  CONTINUOUS = "continuous" // 持续效果
}

// 道具效果接口
export interface ItemEffect {
  type: ItemEffectType;
  duration?: number; // 持续时间（回合数）
  description: string;
}

// 道具信息接口
export interface ItemInfo {
  type: ItemType;
  name: string;
  description: string;
  effect: ItemEffect;
  isStrengthening: boolean; // 是否为强化类道具
  icon: string; // 道具图标
}

// 盲盒接口
export interface BlindBox {
  position: Position;
  itemType: ItemType;
  isOpened: boolean;
  timestamp: number;
}

// 玩家拥有的道具接口
export interface PlayerItem {
  itemType: ItemType;
  acquiredAt: number;
  activatedAt?: number;
  expiresAt?: number;
  isActive: boolean;
}

// 电脑AI难度类型
export type AIDifficulty = "easy" | "medium" | "hard";

// 游戏配置接口
export interface GameConfig {
  mode: GameMode;
  playerColor: Player;
  difficulty: AIDifficulty;
  enableItems: boolean; // 是否启用道具系统
}

// 游戏状态扩展 - 添加道具相关状态
export enum GameSubState {
  NORMAL = "normal", // 正常状态
  SELECTING_STRIKE_TARGET = "selecting_strike_target", // 选择打击目标
  SHOWING_ITEM_NAME = "showing_item_name", // 显示道具名称
  SHOWING_STRATEGY_GUIDE = "showing_strategy_guide", // 显示策略指引
  HAND_SLIP_PENALTY = "hand_slip_penalty" // 手滑惩罚状态
}

// 落子事件类型枚举
export enum MoveEventType {
  NORMAL_MOVE = "normal_move", // 正常落子
  EXTRA_MOVE = "extra_move", // 额外落子
  ITEM_TRIGGER = "item_trigger" // 道具触发
}

// 落子事件接口
export interface MoveEvent {
  moveId: string; // 落子事件ID
  timestamp: number; // 事件发生时间戳
  player: Player; // 玩家
  type: MoveEventType; // 事件类型
  itemType?: ItemType; // 道具类型（如果是道具触发）
  extraMovesAdded?: number; // 增加的额外落子次数
  description: string; // 事件描述
}

// 玩家落子计数接口
export interface PlayerMoveCount {
  player: Player; // 玩家
  originalMoveCount: number; // 原始落子次数（不考虑道具效果）
  extraMovesEarned: number; // 获得的额外落子次数
  extraMovesUsed: number; // 使用的额外落子次数
  currentExtraMoves: number; // 当前剩余额外落子次数
  moveEvents: MoveEvent[]; // 落子事件历史记录
}

// 游戏落子计数状态接口
export interface GameMoveCountState {
  players: Map<Player, PlayerMoveCount>; // 各玩家落子计数状态
  currentPlayer: Player; // 当前玩家
  currentMoveEventId: string; // 当前落子事件ID
}

// 游戏状态变化回调类型
export type GameStateChangeCallback = () => void;